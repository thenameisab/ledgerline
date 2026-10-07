import { NextResponse } from "next/server";
import { z } from "zod";
import getSql from "@/lib/db";
import { guardAction } from "@/lib/access";
import { recordAudit } from "@/lib/repos/audit";
import { toMoney, toDbNumeric, toNumber } from "@/lib/money";
import { assertSameOrigin } from "@/lib/http";
import { revalidateRevenue } from "@/lib/cache";
import { todayIST } from "@/lib/repos/periods";
import { validateSlabs } from "@/lib/pricing/slabs";
import { findVendor } from "@/lib/vendor-registry";

/**
 * One bracket of a volume-priced rate. Costs are nullable here for the
 * same reason the flat columns are: NULL is unknown, 0 is confirmed not charged.
 */
const VendorSlabSchema = z.object({
  min_hits: z.number().int().nonnegative(),
  max_hits: z.number().int().positive().nullable(),
  cost_successful: z.number().nonnegative().nullable(),
  cost_successful_no_data: z.number().nonnegative().nullable(),
  cost_failed: z.number().nonnegative().nullable(),
  cost_in_progress: z.number().nonnegative().nullable(),
});

const VendorCostSchema = z.object({
  vendor_name: z.string().min(1),
  api_code: z.string().min(1),
  // A cost may be set to null to mark that outcome's rate unknown again.
  cost_successful: z.number().nonnegative().nullable().optional(),
  cost_successful_no_data: z.number().nonnegative().nullable().optional(),
  cost_failed: z.number().nonnegative().nullable().optional(),
  cost_in_progress: z.number().nonnegative().nullable().optional(),
  // Status is set deliberately, never inferred from a value edit.
  status: z.enum(["estimated", "quoted", "contracted"]).optional(),
  // Where this pair's cost comes from at all. Not a rate — a statement
  // that no vendor invoice exists for it, or that its cost sits on the
  // components of a stitched/journey product.
  cost_basis: z.enum(["vendor", "in_house", "components"]).optional(),
  // How the rate is shaped. `flat` means the four cost columns are the
  // rates; `slab` (whole-volume) and `tier` (graduated) price on the month's
  // total through `slabs` instead.
  pricing_model: z.enum(["flat", "slab", "tier"]).optional(),
  slabs: z.array(VendorSlabSchema).optional(),
  source: z.string().max(500).nullable().optional(),
  /** The day this rate starts applying. Defaults to today. */
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const COST_FIELDS = [
  "cost_successful",
  "cost_successful_no_data",
  "cost_failed",
  "cost_in_progress",
] as const;

/**
 * Write one vendor rate.
 *
 * A rate is effective-dated, and the cost of a past day must not change after
 * the fact. So a rate that has already been applied to elapsed days is never
 * edited in place: the caller gets a new row dated today or later instead, the
 * same rule client pricing follows.
 *
 * One deliberate exception — FIRST PRICING. A row whose four costs are all NULL
 * has never priced anything: it is a placeholder saying "this vendor serves this
 * API and we do not know the rate". Filling it in is not rewriting history, it
 * is supplying the rate that was always in force, so it updates in place even
 * though usage precedes it. This is what lets the rate card built from observed
 * traffic (all rows dated the first day of usage) be filled in at all. Every
 * later change to a known rate goes through the dating rule.
 *
 * A volume-priced rate is written the same way, and is subject to the same
 * dating rule: the brackets hang off this row, so changing them IS changing
 * this rate. The four flat cost columns are forced to 0 on a volume row — the
 * per-day view yields ₹0 for it either way and `repos/vendor-volume-cost.ts`
 * supplies the month's real cost — and the bracket set is replaced whole rather
 * than merged, so what is stored is always exactly what the editor showed.
 */
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("vendor_pricing.edit");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }
  const user = guard.user;

  const parsed = VendorCostSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;

  // Brackets are validated before anything is written: contiguous from 0, one
  // open-ended top bracket, no negative costs. Same function the client side
  // uses, so a vendor ladder cannot be shaped in a way a client ladder could not.
  const isVolume = body.pricing_model === "slab" || body.pricing_model === "tier";
  if (isVolume) {
    const slabs = body.slabs ?? [];
    const slabErr = validateSlabs(
      slabs.map((s) => ({
        min_hits: s.min_hits,
        max_hits: s.max_hits,
        price_successful: s.cost_successful ?? 0,
        price_successful_no_data: s.cost_successful_no_data ?? 0,
        price_failed: s.cost_failed ?? 0,
        price_in_progress: s.cost_in_progress ?? 0,
      })),
    );
    if (slabErr) return NextResponse.json({ ok: false, error: slabErr }, { status: 400 });
  }

  // The body names a vendor; vendor_pricing keys on its registry id.
  // An alias resolves too, so a stale client sending a former name writes to
  // the right vendor rather than creating a second one.
  const vendorRef = await findVendor(body.vendor_name);
  if (!vendorRef) {
    return NextResponse.json(
      { ok: false, error: `No vendor named ${body.vendor_name}.` },
      { status: 404 },
    );
  }

  const sql = getSql();
  const today = todayIST();
  const effectiveFrom = body.effective_from ?? today;

  // A field the body omits keeps whatever the base row holds — including NULL,
  // which means "this rate is unknown". Flattening NULL to 0 would silently
  // turn an unknown rate into a confirmed "not charged".
  const keepCost = (sent: number | null | undefined, current: unknown): string | null =>
    sent !== undefined
      ? sent === null
        ? null
        : toDbNumeric(toMoney(sent))
      : ((current as string | null) ?? null);
  const asNumber = (v: unknown) => (v == null ? null : toNumber(v));

  type Result =
    | { ok: true; outcome: "first_price" | "update_in_place" | "insert_new"; row: any; before: any }
    | { ok: false; status: number; error: string; code?: string; suggested?: string };

  // Read, decide and write in one transaction: a concurrent write to the same
  // pair must not land between the history check and the update.
  const result: Result = await sql.begin(async (tx) => {
    const [atDate] = await tx`
      SELECT * FROM vendor_pricing
      WHERE vendor_id = ${vendorRef.id} AND api_code = ${body.api_code}
        AND effective_from = ${effectiveFrom}
      FOR UPDATE
    `;
    const [base] = await tx`
      SELECT * FROM vendor_pricing
      WHERE vendor_id = ${vendorRef.id} AND api_code = ${body.api_code}
        AND effective_from <= ${effectiveFrom}
      ORDER BY effective_from DESC LIMIT 1
      FOR UPDATE
    `;

    const inherit = (atDate ?? base) as any;
    // "Never priced" has to include the basis. Marking a pair in-house costs
    // its elapsed days ₹0 — a decision, applied. Reversing it later is
    // therefore a change to a cost that has been applied, and goes through the
    // dating rule like any other; without this clause the NULL cost columns
    // would keep the first-pricing exception open forever.
    const neverPriced = inherit
      ? COST_FIELDS.every((f) => (inherit as any)[f] == null) &&
        ((inherit as any).cost_basis ?? "vendor") === "vendor" &&
        // A bracketed row has costed its elapsed days a real amount, whatever
        // its (forced-to-zero) flat columns say. Same reasoning as cost_basis.
        (((inherit as any).pricing_model ?? "flat") === "flat")
      : true;

    // Days already elapsed that this rate would re-cost.
    let elapsedDays = 0;
    if (effectiveFrom < today) {
      const [u] = await tx`
        SELECT COUNT(DISTINCT date)::int AS days
        FROM usage_daily
        WHERE vendor_id = ${vendorRef.id} AND api_code = ${body.api_code}
          AND date >= ${effectiveFrom} AND date < ${today}
      `;
      elapsedDays = Number((u as any)?.days ?? 0);
    }

    // Changing a known rate over days that already have a cost is the one
    // thing this route refuses. First pricing is exempt (see the doc comment).
    if (elapsedDays > 0 && !neverPriced) {
      return {
        ok: false as const,
        status: 409,
        code: "history_locked",
        error:
          `This rate has already been applied to ${elapsedDays} day${elapsedDays === 1 ? "" : "s"} of usage. ` +
          `Choose an effective date of ${today} or later so past costs stay as billed.`,
        suggested: today,
      };
    }

    // An unspecified model is inherited, so a status or source edit does not
    // silently flatten a bracketed rate.
    const model: "flat" | "slab" | "tier" =
      body.pricing_model ?? (inherit?.pricing_model as any) ?? "flat";
    const volume = model !== "flat";

    // A volume row prices from its brackets. The flat columns are forced to 0
    // so the per-day view yields ₹0 for it and the month's real cost comes from
    // repos/vendor-volume-cost.ts — exactly what savePricingBatch does on the
    // client side.
    const dbVals = volume
      ? {
          cost_successful: "0",
          cost_successful_no_data: "0",
          cost_failed: "0",
          cost_in_progress: "0",
        }
      : {
          cost_successful: keepCost(body.cost_successful, inherit?.cost_successful),
          cost_successful_no_data: keepCost(body.cost_successful_no_data, inherit?.cost_successful_no_data),
          cost_failed: keepCost(body.cost_failed, inherit?.cost_failed),
          cost_in_progress: keepCost(body.cost_in_progress, inherit?.cost_in_progress),
        };

    /**
     * Put this row's bracket set in the state the caller described.
     *
     * A supplied set replaces the stored one whole — never merged, so what is
     * stored is exactly what the editor showed. A volume row saved WITHOUT a
     * set (a status or source edit, or a new dated version of an existing
     * ladder) inherits the brackets it supersedes rather than losing them.
     */
    const writeBrackets = async (rowId: number) => {
      if (!volume) {
        await tx`DELETE FROM vendor_pricing_slab WHERE vendor_pricing_id = ${rowId}`;
        return;
      }
      if (body.slabs !== undefined) {
        await tx`DELETE FROM vendor_pricing_slab WHERE vendor_pricing_id = ${rowId}`;
        for (const b of body.slabs) {
          await tx`
            INSERT INTO vendor_pricing_slab
              (vendor_pricing_id, min_hits, max_hits, cost_successful,
               cost_successful_no_data, cost_failed, cost_in_progress)
            VALUES (
              ${rowId}, ${b.min_hits}, ${b.max_hits},
              ${b.cost_successful == null ? null : toDbNumeric(toMoney(b.cost_successful))},
              ${b.cost_successful_no_data == null ? null : toDbNumeric(toMoney(b.cost_successful_no_data))},
              ${b.cost_failed == null ? null : toDbNumeric(toMoney(b.cost_failed))},
              ${b.cost_in_progress == null ? null : toDbNumeric(toMoney(b.cost_in_progress))}
            )
          `;
        }
        return;
      }
      const fromId = inherit?.id != null ? Number((inherit as any).id) : null;
      if (fromId != null && fromId !== rowId) {
        await tx`
          INSERT INTO vendor_pricing_slab
            (vendor_pricing_id, min_hits, max_hits, cost_successful,
             cost_successful_no_data, cost_failed, cost_in_progress)
          SELECT ${rowId}, min_hits, max_hits, cost_successful,
                 cost_successful_no_data, cost_failed, cost_in_progress
          FROM vendor_pricing_slab WHERE vendor_pricing_id = ${fromId}
          ON CONFLICT (vendor_pricing_id, min_hits) DO NOTHING
        `;
      }
    };
    // Typing a number does not confirm a rate: status only moves when the
    // caller says so. A brand-new row starts as an estimate.
    const status = body.status ?? inherit?.status ?? "estimated";
    const source = body.source !== undefined ? body.source : (inherit?.source ?? null);
    const costBasis = body.cost_basis ?? inherit?.cost_basis ?? "vendor";

    const before = atDate
      ? {
          cost_successful: asNumber((atDate as any).cost_successful),
          cost_successful_no_data: asNumber((atDate as any).cost_successful_no_data),
          cost_failed: asNumber((atDate as any).cost_failed),
          cost_in_progress: asNumber((atDate as any).cost_in_progress),
          status: (atDate as any).status,
          source: (atDate as any).source,
          cost_basis: (atDate as any).cost_basis ?? "vendor",
          pricing_model: (atDate as any).pricing_model ?? "flat",
          effective_from: effectiveFrom,
        }
      : null;

    if (atDate) {
      await tx`
        UPDATE vendor_pricing
        SET cost_successful         = ${dbVals.cost_successful},
            cost_successful_no_data = ${dbVals.cost_successful_no_data},
            cost_failed             = ${dbVals.cost_failed},
            cost_in_progress        = ${dbVals.cost_in_progress},
            status                  = ${status},
            source                  = ${source},
            cost_basis              = ${costBasis},
            pricing_model           = ${model}
        WHERE id = ${(atDate as any).id}
      `;
      await writeBrackets(Number((atDate as any).id));
      return {
        ok: true as const,
        outcome: neverPriced ? ("first_price" as const) : ("update_in_place" as const),
        row: {
          ...dbVals,
          status,
          source,
          cost_basis: costBasis,
          pricing_model: model,
          effective_from: effectiveFrom,
        },
        before,
      };
    }

    const [insertedRow] = await tx`
      INSERT INTO vendor_pricing
        (vendor_id, api_code, cost_successful, cost_successful_no_data,
         cost_failed, cost_in_progress, status, source, cost_basis,
         pricing_model, effective_from)
      VALUES (
        ${vendorRef.id}, ${body.api_code},
        ${dbVals.cost_successful}, ${dbVals.cost_successful_no_data},
        ${dbVals.cost_failed}, ${dbVals.cost_in_progress},
        ${status}, ${source}, ${costBasis}, ${model}, ${effectiveFrom}
      )
      RETURNING id
    `;
    await writeBrackets(Number((insertedRow as any).id));
    return {
      ok: true as const,
      outcome: "insert_new" as const,
      row: {
        ...dbVals,
        status,
        source,
        cost_basis: costBasis,
        pricing_model: model,
        effective_from: effectiveFrom,
      },
      before,
    };
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code, suggested_effective_from: result.suggested },
      { status: result.status },
    );
  }

  const after = {
    cost_successful: asNumber(result.row.cost_successful),
    cost_successful_no_data: asNumber(result.row.cost_successful_no_data),
    cost_failed: asNumber(result.row.cost_failed),
    cost_in_progress: asNumber(result.row.cost_in_progress),
    status: result.row.status,
    source: result.row.source,
    cost_basis: result.row.cost_basis,
    pricing_model: result.row.pricing_model,
    brackets: result.row.pricing_model === "flat" ? 0 : (body.slabs?.length ?? null),
    effective_from: result.row.effective_from,
  };

  // Audit and revalidation run outside the transaction on purpose: neither
  // should be able to roll the write back or hold its locks.
  await recordAudit({
    user_id: user.id,
    action: result.outcome === "insert_new" ? "vendor_pricing.supersede" : "vendor_pricing.update",
    entity_type: "vendor_pricing",
    entity_id: `${vendorRef.name}:${body.api_code}`,
    before: result.before,
    after: { ...after, outcome: result.outcome },
  });

  revalidateRevenue();
  return NextResponse.json({ ok: true, ...after, outcome: result.outcome });
}
