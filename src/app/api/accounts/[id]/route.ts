import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { reassignAccountGroup } from "@/lib/repos/accounts";
import { recordAudit } from "@/lib/repos/audit";

// Membership-only account update: move an account to a group, or clear it
// with null. Full account editing (name, billing entity, status) is separate.
const UpdateSchema = z.object({
  account_id: z.number().int().positive().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("account.update");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid account id." }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const updated = await reassignAccountGroup(id, parsed.data.account_id);
  if (!updated) return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });

  await recordAudit({
    user_id: guard.user.id,
    action: "account.update",
    entity_type: "account",
    entity_id: String(id),
    after: { account_id: parsed.data.account_id },
  });

  return NextResponse.json({ ok: true, id, account_id: parsed.data.account_id });
}
