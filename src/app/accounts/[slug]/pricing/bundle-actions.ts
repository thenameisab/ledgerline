"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { revalidateRevenue } from "@/lib/cache";
import getSql from "@/lib/db";
import { guardAction } from "@/lib/access";
import { recordAudit } from "@/lib/repos/audit";
import { isBilledPair } from "@/lib/repos/statements";
import { toNumber } from "@/lib/money";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  member_codes: z.array(z.string().min(1)).min(2),
  anchor_api_code: z.string().min(1),
  price_successful: z.number().nonnegative(),
  price_successful_no_data: z.number().nonnegative(),
  price_failed: z.number().nonnegative(),
  price_in_progress: z.number().nonnegative(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CreateBundleInput = z.infer<typeof CreateSchema>;

type ActionResult = { ok: boolean; error?: string };

function revalidateAccount(slug: string) {
  revalidatePath(`/accounts/${slug}/pricing`);
  revalidatePath(`/accounts/${slug}`);
  revalidateRevenue();
}

export async function createBundle(
  accountId: number,
  slug: string,
  input: CreateBundleInput
): Promise<ActionResult> {
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid values." };
  const c = parsed.data;

  if (!c.member_codes.includes(c.anchor_api_code)) {
    return { ok: false, error: "The billing anchor must be one of the stitched SKUs." };
  }

  const sql = getSql();

  const conflicts = await sql`
    SELECT api_code FROM api_bundle_members
    WHERE client_id = ${accountId} AND api_code = ANY(${c.member_codes})
  `;
  if ((conflicts as any[]).length > 0) {
    const codes = (conflicts as any[]).map((r) => r.api_code).join(", ");
    return { ok: false, error: `Already in another stitch: ${codes}.` };
  }

  const [dupName] = await sql`
    SELECT id FROM api_bundles WHERE client_id = ${accountId} AND name = ${c.name}
  `;
  if (dupName) return { ok: false, error: "A stitch with this name already exists." };

  try {
    await sql.begin(async (tx) => {
      const [bundle] = await tx`
        INSERT INTO api_bundles (client_id, name, anchor_api_code)
        VALUES (${accountId}, ${c.name}, ${c.anchor_api_code})
        RETURNING id
      `;
      for (const code of c.member_codes) {
        await tx`
          INSERT INTO api_bundle_members (bundle_id, client_id, api_code)
          VALUES (${(bundle as any).id}, ${accountId}, ${code})
        `;
      }
      await tx`
        INSERT INTO bundle_pricing
          (bundle_id, price_successful, price_successful_no_data,
           price_failed, price_in_progress, effective_from)
        VALUES (
          ${(bundle as any).id},
          ${c.price_successful}, ${c.price_successful_no_data},
          ${c.price_failed}, ${c.price_in_progress},
          ${c.effective_from}
        )
      `;
    });
  } catch {
    return { ok: false, error: "Could not create the stitch. Try again." };
  }

  await recordAudit({
    user_id: guard.user.id,
    action: "bundle.create",
    entity_type: "bundle",
    entity_id: `${accountId}:${c.name}`,
    before: null,
    after: {
      name: c.name,
      members: c.member_codes,
      anchor_api_code: c.anchor_api_code,
      price_successful: c.price_successful,
      price_successful_no_data: c.price_successful_no_data,
      price_failed: c.price_failed,
      price_in_progress: c.price_in_progress,
      effective_from: c.effective_from,
    },
  });

  revalidateAccount(slug);
  return { ok: true };
}

const PriceSchema = z.object({
  price_successful: z.number().nonnegative(),
  price_successful_no_data: z.number().nonnegative(),
  price_failed: z.number().nonnegative(),
  price_in_progress: z.number().nonnegative(),
});

export async function saveBundlePrice(
  accountId: number,
  slug: string,
  bundleId: number,
  input: z.infer<typeof PriceSchema>
): Promise<ActionResult> {
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = PriceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid values." };
  const c = parsed.data;

  const sql = getSql();
  const [bundle] = await sql`
    SELECT id, name, anchor_api_code FROM api_bundles
    WHERE id = ${bundleId} AND client_id = ${accountId}
  `;
  if (!bundle) return { ok: false, error: "Stitch not found." };
  const b = bundle as any;

  const [latest] = await sql`
    SELECT * FROM bundle_pricing
    WHERE bundle_id = ${bundleId}
    ORDER BY effective_from DESC LIMIT 1
  `;
  if (!latest) return { ok: false, error: "Stitch has no pricing row." };
  const e = latest as any;

  const billed = await isBilledPair(accountId, b.anchor_api_code);
  const today = new Date().toISOString().slice(0, 10);

  try {
    if (!billed) {
      await sql`
        UPDATE bundle_pricing
        SET price_successful         = ${c.price_successful},
            price_successful_no_data = ${c.price_successful_no_data},
            price_failed             = ${c.price_failed},
            price_in_progress        = ${c.price_in_progress}
        WHERE id = ${e.id}
      `;
    } else {
      // Billed anchor — supersede with a new row effective today
      const [todaysRow] = await sql`
        SELECT id FROM bundle_pricing
        WHERE bundle_id = ${bundleId} AND effective_from = ${today}
      `;
      if (todaysRow) {
        await sql`
          UPDATE bundle_pricing
          SET price_successful         = ${c.price_successful},
              price_successful_no_data = ${c.price_successful_no_data},
              price_failed             = ${c.price_failed},
              price_in_progress        = ${c.price_in_progress}
          WHERE id = ${(todaysRow as any).id}
        `;
      } else {
        await sql`
          INSERT INTO bundle_pricing
            (bundle_id, price_successful, price_successful_no_data,
             price_failed, price_in_progress, effective_from)
          VALUES (
            ${bundleId},
            ${c.price_successful}, ${c.price_successful_no_data},
            ${c.price_failed}, ${c.price_in_progress},
            ${today}
          )
        `;
      }
    }
  } catch {
    return { ok: false, error: "Save failed. Try again." };
  }

  await recordAudit({
    user_id: guard.user.id,
    action: billed ? "bundle.price_supersede" : "bundle.price_update",
    entity_type: "bundle",
    entity_id: `${accountId}:${b.name}`,
    before: {
      price_successful: toNumber(e.price_successful),
      price_successful_no_data: toNumber(e.price_successful_no_data),
      price_failed: toNumber(e.price_failed),
      price_in_progress: toNumber(e.price_in_progress),
      effective_from: e.effective_from,
    },
    after: {
      ...c,
      ...(billed ? { effective_from: today, reason: "anchor_is_billed" } : {}),
    },
  });

  revalidateAccount(slug);
  return { ok: true };
}

export async function deleteBundle(
  accountId: number,
  slug: string,
  bundleId: number
): Promise<ActionResult> {
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) return { ok: false, error: guard.error };

  const sql = getSql();
  const [bundle] = await sql`
    SELECT id, name, anchor_api_code FROM api_bundles
    WHERE id = ${bundleId} AND client_id = ${accountId}
  `;
  if (!bundle) return { ok: false, error: "Stitch not found." };
  const b = bundle as any;

  const billed = await isBilledPair(accountId, b.anchor_api_code);
  if (billed) {
    return {
      ok: false,
      error: "This stitch has been billed on a finalized invoice and can't be removed.",
    };
  }

  const members = await sql`
    SELECT api_code FROM api_bundle_members WHERE bundle_id = ${bundleId}
  `;

  try {
    await sql`DELETE FROM api_bundles WHERE id = ${bundleId}`;
  } catch {
    return { ok: false, error: "Delete failed. Try again." };
  }

  await recordAudit({
    user_id: guard.user.id,
    action: "bundle.delete",
    entity_type: "bundle",
    entity_id: `${accountId}:${b.name}`,
    before: {
      name: b.name,
      anchor_api_code: b.anchor_api_code,
      members: (members as any[]).map((m) => m.api_code),
    },
    after: null,
  });

  revalidateAccount(slug);
  return { ok: true };
}
