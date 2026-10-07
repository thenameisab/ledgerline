import { NextResponse } from "next/server";
import { z } from "zod";
import getSql from "@/lib/db";
import { guardAction } from "@/lib/access";
import { recordAudit } from "@/lib/repos/audit";
import { toMoney, toDbNumeric, toNumber } from "@/lib/money";
import { assertSameOrigin } from "@/lib/http";
import { revalidateRevenue } from "@/lib/cache";
import { todayIST } from "@/lib/repos/periods";
import { findVendor } from "@/lib/vendor-registry";

const CommitmentSchema = z.object({
  vendor_name: z.string().min(1),
  // null clears the minimum from this date on — the commitment ended, which is
  // a different fact from a floor of zero.
  monthly_minimum: z.number().nonnegative().nullable(),
  status: z.enum(["estimated", "quoted", "contracted"]).optional(),
  source: z.string().max(500).nullable().optional(),
  /** The first day this minimum applies. Defaults to today. */
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Write a vendor's monthly minimum.
 *
 * A minimum is effective-dated for the same reason a rate is, and it is subject
 * to the same rule: a month that has already been costed under a floor must
 * keep it. So the date is snapped to the start of a calendar month — a floor
 * that begins on the 14th would either bind against a part-month's cost or
 * silently apply to the whole month, and neither is a thing a contract says.
 *
 * The first-minimum exception mirrors the rate card's: a vendor that has never
 * had a minimum on file has nothing to rewrite, so its first one may be dated
 * back over months already elapsed. Changing a minimum that has already applied
 * to a completed month goes forward instead.
 */
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("vendor_pricing.edit");
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.code === "unauthenticated" ? 401 : 403 },
    );
  }
  const user = guard.user;

  const parsed = CommitmentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;
  const today = todayIST();
  const requested = body.effective_from ?? today;
  // A minimum is a calendar-month figure; it starts on the 1st or not at all.
  const effectiveFrom = `${requested.slice(0, 7)}-01`;
  const thisMonthStart = `${today.slice(0, 7)}-01`;

  // The body names a vendor; the table keys on its registry id. An
  // alias resolves too, so a stale client sending a former name still writes to
  // the right vendor rather than creating one.
  const vendorRef = await findVendor(body.vendor_name);
  if (!vendorRef) {
    return NextResponse.json(
      { ok: false, error: `No vendor named ${body.vendor_name}.` },
      { status: 404 },
    );
  }

  const sql = getSql();

  type Result =
    | { ok: true; outcome: "first" | "update_in_place" | "insert_new"; before: any; after: any }
    | { ok: false; status: number; error: string; code?: string; suggested?: string };

  const result: Result = await sql.begin(async (tx) => {
    const [atDate] = await tx`
      SELECT * FROM vendor_commitments
      WHERE vendor_id = ${vendorRef.id} AND effective_from = ${effectiveFrom}
      FOR UPDATE
    `;
    const [existing] = await tx`
      SELECT 1 AS any FROM vendor_commitments WHERE vendor_id = ${vendorRef.id} LIMIT 1
    `;
    const isFirst = !existing;

    // Completed months this change would re-floor. The current month is not
    // one: its cost is still running up, and no top-up has been reported for
    // it yet (vendor-minimum.ts skips an in-progress month).
    if (!isFirst && effectiveFrom < thisMonthStart) {
      const [u] = await tx`
        SELECT COUNT(DISTINCT date_trunc('month', date))::int AS months
        FROM usage_daily
        WHERE vendor_id = ${vendorRef.id}
          AND date >= ${effectiveFrom} AND date < ${thisMonthStart}
      `;
      const months = Number((u as any)?.months ?? 0);
      if (months > 0) {
        return {
          ok: false as const,
          status: 409,
          code: "history_locked",
          error:
            `A minimum is already on file for ${vendorRef.name} over ${months} completed ` +
            `month${months === 1 ? "" : "s"}. Choose ${thisMonthStart} or later so months ` +
            `already costed keep the floor they were billed under.`,
          suggested: thisMonthStart,
        };
      }
    }

    const amount =
      body.monthly_minimum == null ? null : toDbNumeric(toMoney(body.monthly_minimum));
    const status = body.status ?? (atDate as any)?.status ?? "estimated";
    const source = body.source !== undefined ? body.source : ((atDate as any)?.source ?? null);

    const before = atDate
      ? {
          monthly_minimum:
            (atDate as any).monthly_minimum == null
              ? null
              : toNumber((atDate as any).monthly_minimum),
          status: (atDate as any).status,
          source: (atDate as any).source,
          effective_from: effectiveFrom,
        }
      : null;
    const after = {
      monthly_minimum: body.monthly_minimum,
      status,
      source,
      effective_from: effectiveFrom,
    };

    if (atDate) {
      await tx`
        UPDATE vendor_commitments
        SET monthly_minimum = ${amount}, status = ${status}, source = ${source}
        WHERE id = ${(atDate as any).id}
      `;
      return { ok: true as const, outcome: "update_in_place" as const, before, after };
    }

    await tx`
      INSERT INTO vendor_commitments
        (vendor_id, effective_from, monthly_minimum, status, source)
      VALUES (${vendorRef.id}, ${effectiveFrom}, ${amount}, ${status}, ${source})
    `;
    return {
      ok: true as const,
      outcome: isFirst ? ("first" as const) : ("insert_new" as const),
      before,
      after,
    };
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code, suggested_effective_from: result.suggested },
      { status: result.status },
    );
  }

  await recordAudit({
    user_id: user.id,
    action: result.outcome === "insert_new" ? "vendor_commitment.supersede" : "vendor_commitment.update",
    entity_type: "vendor_commitment",
    entity_id: vendorRef.name,
    before: result.before,
    after: { ...result.after, outcome: result.outcome },
  });

  revalidateRevenue();
  return NextResponse.json({ ok: true, ...result.after, outcome: result.outcome });
}
