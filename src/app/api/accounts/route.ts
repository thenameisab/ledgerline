import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import getSql from "@/lib/db";
import { createAccount, AccountConflictError } from "@/lib/repos/accounts";
import { generateSlug } from "@/lib/slug";
import { recordAudit, type AuditAction } from "@/lib/repos/audit";
import { revalidateRevenue } from "@/lib/cache";

const CreateAccountSchema = z.object({
  display_name: z.string().min(1, "Display name is required.").max(200),
  billing_entity: z.string().max(500).optional().nullable(),
  account_id: z.number().int().positive().optional().nullable(),
  // When set, usage rows carrying this raw log name are attributed to the new
  // account in the same call (the aliases-screen "create as new account" path).
  resolve_raw_name: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("account.create");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }

  const body = await req.json();
  const parsed = CreateAccountSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
  }

  const { display_name, billing_entity, account_id, resolve_raw_name } = parsed.data;
  const slug = generateSlug(display_name);

  try {
    const { id, slug: savedSlug } = await createAccount({
      display_name,
      billing_entity: billing_entity ?? null,
      account_id: account_id ?? null,
      slug,
    });

    // Seed the raw log name as an alias and attribute its quarantined rows so
    // the new account's traffic surfaces immediately, not after the next sync.
    if (resolve_raw_name) {
      const sql = getSql();
      await sql`UPDATE clients SET log_aliases = ${JSON.stringify([resolve_raw_name])} WHERE id = ${id}`;
      await sql`UPDATE usage_daily SET client_id = ${id} WHERE raw_client_name = ${resolve_raw_name} AND client_id IS NULL`;
      revalidateRevenue();
    }

    await recordAudit({
      user_id: guard.user.id,
      action: "account.create" as AuditAction,
      entity_type: "account",
      entity_id: String(id),
      after: { display_name, billing_entity, account_id, slug: savedSlug, resolve_raw_name },
    });

    return NextResponse.json({ ok: true, id, slug: savedSlug });
  } catch (err) {
    if (err instanceof AccountConflictError) {
      return NextResponse.json(
        { ok: false, fieldErrors: { display_name: "An account with this name already exists." } },
        { status: 409 }
      );
    }
    throw err;
  }
}
