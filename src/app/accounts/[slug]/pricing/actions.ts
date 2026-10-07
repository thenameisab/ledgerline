"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { revalidateRevenue } from "@/lib/cache";
import getSql from "@/lib/db";
import { guardAction } from "@/lib/access";
import { recordAudit } from "@/lib/repos/audit";
import { isBilledPair } from "@/lib/repos/statements";
import { validateSlabs } from "@/lib/pricing/slabs";
import { toNumber } from "@/lib/money";
import type postgres from "postgres";

const SlabSchema = z.object({
  min_hits: z.number().int().nonnegative(),
  max_hits: z.number().int().positive().nullable(),
  price_successful: z.number().nonnegative(),
  price_successful_no_data: z.number().nonnegative(),
  price_failed: z.number().nonnegative(),
  price_in_progress: z.number().nonnegative(),
});

const ChangeSchema = z.object({
  api_code: z.string().min(1),
  price_successful: z.number().nonnegative(),
  price_successful_no_data: z.number().nonnegative(),
  price_failed: z.number().nonnegative(),
  price_in_progress: z.number().nonnegative(),
  pricing_model: z.enum(["flat", "slab", "tier"]).optional(),
  slabs: z.array(SlabSchema).optional(),
  is_new: z.boolean().optional(),
  effective_from: z.string().optional(),
});

export type PricingChange = z.infer<typeof ChangeSchema>;
type SlabInput = z.infer<typeof SlabSchema>;

/** Replace a pricing row's bracket set. Flat rows end up with no brackets. */
async function replaceSlabs(
  sql: postgres.Sql,
  pricingId: number,
  model: "flat" | "slab" | "tier",
  slabs: SlabInput[]
): Promise<void> {
  await sql`DELETE FROM pricing_slab WHERE pricing_id = ${pricingId}`;
  if (model === "flat") return;
  for (const s of slabs) {
    await sql`
      INSERT INTO pricing_slab
        (pricing_id, min_hits, max_hits, price_successful,
         price_successful_no_data, price_failed, price_in_progress)
      VALUES (
        ${pricingId}, ${s.min_hits}, ${s.max_hits}, ${s.price_successful},
        ${s.price_successful_no_data}, ${s.price_failed}, ${s.price_in_progress}
      )
    `;
  }
}

export async function savePricingBatch(
  accountId: number,
  slug: string,
  changes: PricingChange[]
): Promise<{ ok: boolean; errors: Record<string, string>; saved: string[] }> {
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) {
    return { ok: false, errors: { _: guard.error }, saved: [] };
  }

  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);
  const errors: Record<string, string> = {};
  const saved: string[] = [];

  for (const raw of changes) {
    const parsed = ChangeSchema.safeParse(raw);
    if (!parsed.success) {
      errors[raw.api_code] = "Invalid values.";
      continue;
    }
    const c = parsed.data;
    const model = c.pricing_model ?? "flat";
    const slabs = c.slabs ?? [];

    const isVolume = model === "slab" || model === "tier";

    // Volume-priced rows (slab/tier) are priced by their brackets; the flat
    // columns stay 0 (the per-day revenue view yields 0 for them —
    // deriveStatement recomputes).
    const ps = isVolume ? 0 : c.price_successful;
    const psnd = isVolume ? 0 : c.price_successful_no_data;
    const pf = isVolume ? 0 : c.price_failed;
    const pip = isVolume ? 0 : c.price_in_progress;

    if (isVolume) {
      const slabErr = validateSlabs(slabs);
      if (slabErr) {
        errors[c.api_code] = slabErr;
        continue;
      }
    }

    const auditAfter = {
      pricing_model: model,
      ...(isVolume
        ? { tiers: slabs.length }
        : {
            price_successful: ps,
            price_successful_no_data: psnd,
            price_failed: pf,
            price_in_progress: pip,
          }),
    };

    try {
      if (c.is_new) {
        const effectiveFrom = c.effective_from ?? today;
        const [dup] = await sql`
          SELECT id FROM pricing
          WHERE client_id = ${accountId} AND api_code = ${c.api_code}
            AND effective_from = ${effectiveFrom}
        `;
        if (dup) {
          errors[c.api_code] = "A pricing row with this effective date already exists.";
          continue;
        }
        const [inserted] = await sql`
          INSERT INTO pricing
            (client_id, api_code, price_successful, price_successful_no_data,
             price_failed, price_in_progress, pricing_model, effective_from)
          VALUES (
            ${accountId}, ${c.api_code}, ${ps}, ${psnd}, ${pf}, ${pip},
            ${model}, ${effectiveFrom}
          )
          RETURNING id
        `;
        await replaceSlabs(sql, Number((inserted as any).id), model, slabs);
        await recordAudit({
          user_id: guard.user.id,
          action: "pricing.update",
          entity_type: "pricing",
          entity_id: `${accountId}:${c.api_code}`,
          before: null,
          after: { ...auditAfter, effective_from: effectiveFrom },
        });
      } else {
        const [existing] = await sql`
          SELECT * FROM pricing
          WHERE client_id = ${accountId} AND api_code = ${c.api_code}
          ORDER BY effective_from DESC LIMIT 1
        `;
        if (!existing) {
          errors[c.api_code] = "Pricing row not found.";
          continue;
        }
        const e = existing as any;
        const existingFrom = String(e.effective_from).slice(0, 10);
        // The editor always submits effective_from for priced rows; treat it
        // as a re-date only when it actually differs from what's stored.
        const newFrom = c.effective_from;
        const dateChanged = !!newFrom && newFrom !== existingFrom;
        const billed = await isBilledPair(accountId, c.api_code);

        if (dateChanged) {
          // Explicit re-date — apply straight to this row, even when billed.
          // This is the deliberate backdating path (recovering revenue from
          // usage that predates the original effective date), so unlike a
          // price-only edit it intentionally moves the finalized invoice.
          const [clash] = await sql`
            SELECT id FROM pricing
            WHERE client_id = ${accountId} AND api_code = ${c.api_code}
              AND effective_from = ${newFrom} AND id <> ${e.id}
          `;
          if (clash) {
            errors[c.api_code] = "Another pricing row already uses this effective date.";
            continue;
          }
          const [updated] = await sql`
            UPDATE pricing
            SET price_successful        = ${ps},
                price_successful_no_data = ${psnd},
                price_failed            = ${pf},
                price_in_progress       = ${pip},
                pricing_model           = ${model},
                effective_from          = ${newFrom}
            WHERE id = ${e.id}
            RETURNING id
          `;
          await replaceSlabs(sql, Number((updated as any).id), model, slabs);
        } else if (!billed) {
          const [updated] = await sql`
            UPDATE pricing
            SET price_successful        = ${ps},
                price_successful_no_data = ${psnd},
                price_failed            = ${pf},
                price_in_progress       = ${pip},
                pricing_model           = ${model}
            WHERE id = ${e.id}
            RETURNING id
          `;
          await replaceSlabs(sql, Number((updated as any).id), model, slabs);
        } else {
          // Billed pair — supersede with a new row effective today
          const [todaysRow] = await sql`
            SELECT id FROM pricing
            WHERE client_id = ${accountId} AND api_code = ${c.api_code}
              AND effective_from = ${today}
          `;
          let targetId: number;
          if (todaysRow) {
            const [updated] = await sql`
              UPDATE pricing
              SET price_successful        = ${ps},
                  price_successful_no_data = ${psnd},
                  price_failed            = ${pf},
                  price_in_progress       = ${pip},
                  pricing_model           = ${model}
              WHERE id = ${(todaysRow as any).id}
              RETURNING id
            `;
            targetId = Number((updated as any).id);
          } else {
            const [inserted] = await sql`
              INSERT INTO pricing
                (client_id, api_code, price_successful, price_successful_no_data,
                 price_failed, price_in_progress, pricing_model, effective_from)
              VALUES (
                ${accountId}, ${c.api_code}, ${ps}, ${psnd}, ${pf}, ${pip},
                ${model}, ${today}
              )
              RETURNING id
            `;
            targetId = Number((inserted as any).id);
          }
          await replaceSlabs(sql, targetId, model, slabs);
        }

        await recordAudit({
          user_id: guard.user.id,
          action: !dateChanged && billed ? "pricing.supersede" : "pricing.update",
          entity_type: "pricing",
          entity_id: `${accountId}:${c.api_code}`,
          before: {
            pricing_model: e.pricing_model ?? "flat",
            price_successful: toNumber(e.price_successful),
            price_successful_no_data: toNumber(e.price_successful_no_data),
            price_failed: toNumber(e.price_failed),
            price_in_progress: toNumber(e.price_in_progress),
            effective_from: e.effective_from,
          },
          after: {
            ...auditAfter,
            ...(dateChanged
              ? { effective_from: newFrom, reason: "re_dated" }
              : billed
              ? { effective_from: today, reason: "pair_is_billed" }
              : {}),
          },
        });
      }

      saved.push(c.api_code);
    } catch {
      errors[c.api_code] = "Save failed. Try again.";
    }
  }

  revalidatePath(`/accounts/${slug}/pricing`);
  revalidatePath(`/accounts/${slug}`);
  revalidatePath("/accounts");
  revalidateRevenue();

  return { ok: Object.keys(errors).length === 0, errors, saved };
}
