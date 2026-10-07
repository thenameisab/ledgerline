import { NextResponse } from "next/server";
import { z } from "zod";
import getSql from "@/lib/db";
import { guardAction } from "@/lib/access";
import { recordAudit } from "@/lib/repos/audit";
import { assertSameOrigin } from "@/lib/http";
import { revalidateRevenue } from "@/lib/cache";

/**
 * Edit a vendor's registry entry.
 *
 * Three fields, and only one of them is interesting. Renaming a vendor is an
 * UPDATE of `vendors.canonical_name`: nothing else in the database holds a
 * vendor's name as a key, so the rate card, the commitments and months of
 * usage all follow without being touched. The former spelling stays behind as
 * an alias, which is what keeps tomorrow's sync landing on the same vendor
 * instead of inventing a second one — the failure this whole table exists to
 * prevent.
 *
 * Aliases can also be added by hand, for the case where the split has already
 * happened upstream and two spellings are arriving at once.
 *
 * There is no delete. A vendor's name is on months of usage; `status` marks
 * one we no longer send work to and leaves its history alone.
 *
 * `charges_sandbox` is the fourth field and the only one that moves
 * money. It is deliberately not effective-dated: it is not a price that
 * changed on a date, it is a fact about the contract that we either knew or
 * did not, so recording it corrects every period at once.
 */
const VendorSchema = z.object({
  vendor_id: z.number().int().positive(),
  canonical_name: z.string().min(1).max(120).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  /**
   * Whether this vendor invoices us for sandbox calls. TRUE is the
   * default and the state of every vendor until somebody reads a contract;
   * setting it FALSE stops sandbox traffic carrying this vendor's cost.
   */
  charges_sandbox: z.boolean().optional(),
  /** Added to the vendor's alias list. */
  add_alias: z.string().min(1).max(120).optional(),
  /** Removed from it. A vendor's canonical name cannot be removed this way. */
  remove_alias: z.string().min(1).max(120).optional(),
});

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

  const parsed = VendorSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;
  const sql = getSql();

  type Result =
    | { ok: true; before: any; after: any; name: string }
    | { ok: false; status: number; error: string };

  const result: Result = await sql.begin(async (tx) => {
    const [row] = await tx`SELECT * FROM vendors WHERE id = ${body.vendor_id} FOR UPDATE`;
    if (!row) return { ok: false as const, status: 404, error: "No such vendor." };
    const current = row as any;
    const before = {
      canonical_name: current.canonical_name as string,
      status: current.status as string,
      charges_sandbox: current.charges_sandbox as boolean,
    };

    const newName = body.canonical_name?.trim();
    if (newName && newName.toLowerCase() !== before.canonical_name.toLowerCase()) {
      // The name may already belong to another vendor, in which case this is
      // a merge and not a rename. Merging is a different operation with a
      // different blast radius (two rate cards, two histories); it is refused
      // here rather than done by accident.
      const [clash] = await tx`
        SELECT v.id, v.canonical_name FROM vendor_aliases a
        JOIN vendors v ON v.id = a.vendor_id
        WHERE lower(a.alias) = lower(${newName}) AND a.vendor_id <> ${body.vendor_id}
      `;
      if (clash) {
        return {
          ok: false as const,
          status: 409,
          error:
            `${newName} already resolves to ${(clash as any).canonical_name}. ` +
            `Two vendors cannot share a spelling.`,
        };
      }
    }
    if (newName) {
      await tx`UPDATE vendors SET canonical_name = ${newName} WHERE id = ${body.vendor_id}`;
      // The old spelling is kept so usage still arriving under it resolves
      // here. This is the line that makes a rename safe.
      await tx`
        INSERT INTO vendor_aliases (vendor_id, alias) VALUES (${body.vendor_id}, ${newName})
        ON CONFLICT DO NOTHING
      `;
      // Two tables hold a denormalised copy of the name: the vendor-side
      // reconciliation feed and the dismissals filed against it. They are a
      // cache of an outside report keyed by text, not by identity, so they are
      // moved here rather than joined through the registry everywhere.
      await tx`
        UPDATE vendor_usage_daily SET vendor = ${newName}
        WHERE lower(vendor) = lower(${before.canonical_name})
      `;
      await tx`
        UPDATE vendor_recon_dismissals SET vendor = ${newName}
        WHERE lower(vendor) = lower(${before.canonical_name})
      `;
    }
    if (body.status) {
      await tx`UPDATE vendors SET status = ${body.status} WHERE id = ${body.vendor_id}`;
    }
    if (body.charges_sandbox !== undefined) {
      // Not effective-dated, unlike a rate or a minimum. This is not a price
      // that changed on a date; it is a fact about the contract that we either
      // knew or did not. Dating it would claim we were charged for sandbox up
      // to the day someone opened the agreement and read otherwise.
      await tx`
        UPDATE vendors SET charges_sandbox = ${body.charges_sandbox}
        WHERE id = ${body.vendor_id}
      `;
    }
    if (body.add_alias) {
      const alias = body.add_alias.trim();
      const [clash] = await tx`
        SELECT v.canonical_name FROM vendor_aliases a
        JOIN vendors v ON v.id = a.vendor_id
        WHERE lower(a.alias) = lower(${alias}) AND a.vendor_id <> ${body.vendor_id}
      `;
      if (clash) {
        return {
          ok: false as const,
          status: 409,
          error: `${alias} already resolves to ${(clash as any).canonical_name}.`,
        };
      }
      await tx`
        INSERT INTO vendor_aliases (vendor_id, alias) VALUES (${body.vendor_id}, ${alias})
        ON CONFLICT DO NOTHING
      `;
    }
    if (body.remove_alias) {
      const alias = body.remove_alias.trim();
      const finalName = newName ?? before.canonical_name;
      if (alias.toLowerCase() === finalName.toLowerCase()) {
        return {
          ok: false as const,
          status: 400,
          error: "A vendor's own name cannot be removed from its aliases.",
        };
      }
      await tx`
        DELETE FROM vendor_aliases
        WHERE vendor_id = ${body.vendor_id} AND lower(alias) = lower(${alias})
      `;
    }

    const [updated] = await tx`SELECT * FROM vendors WHERE id = ${body.vendor_id}`;
    const u = updated as any;
    return {
      ok: true as const,
      name: u.canonical_name as string,
      before,
      after: {
        canonical_name: u.canonical_name as string,
        status: u.status as string,
        charges_sandbox: u.charges_sandbox as boolean,
        added_alias: body.add_alias ?? null,
        removed_alias: body.remove_alias ?? null,
      },
    };
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  await recordAudit({
    user_id: user.id,
    action: "vendor.update",
    entity_type: "vendor",
    entity_id: String(body.vendor_id),
    before: result.before,
    after: result.after,
  });

  // A rename changes the vendor name every cached cost read is grouped by.
  revalidateRevenue();
  return NextResponse.json({ ok: true, canonical_name: result.name });
}
