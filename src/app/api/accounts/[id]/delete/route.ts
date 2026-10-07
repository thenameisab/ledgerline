import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { recordAudit } from "@/lib/repos/audit";
import { revertStatementToDraft } from "@/lib/repos/statements";
import { previewAccountDelete, executeAccountDelete, createPendingOperation } from "@/lib/repos/account-merge";
import { notifyAccountOpRequested } from "@/lib/notify/account-ops";

function idFrom(params: { id: string }): number | null {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAction("account.delete");
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  const id = idFrom(params);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid account id." }, { status: 400 });
  const preview = await previewAccountDelete(id);
  if (!preview) return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });
  return NextResponse.json({ ok: true, preview });
}

const PostSchema = z.object({
  reason: z.string().max(1000).optional(),
  revert_statement_ids: z.array(z.number().int().positive()).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("account.delete");
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });

  const id = idFrom(params);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid account id." }, { status: 400 });

  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 422 });

  if (guard.user.role !== "admin") {
    const preview = await previewAccountDelete(id);
    if (!preview) return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });
    const opId = await createPendingOperation({ kind: "delete", sourceId: id, targetId: null, requestedBy: guard.user.id, note: parsed.data.reason });
    await recordAudit({ user_id: guard.user.id, action: "account.op.request", entity_type: "account_operation", entity_id: String(opId), after: { kind: "delete", source: id } });
    await notifyAccountOpRequested({ opId, kind: "delete", requesterName: guard.user.name ?? guard.user.email, sourceName: preview.account.display_name, targetName: null });
    return NextResponse.json({ ok: true, pending: true, opId });
  }

  for (const sid of parsed.data.revert_statement_ids ?? []) {
    await revertStatementToDraft(sid, guard.user.id);
  }
  const result = await executeAccountDelete({ id, actorId: guard.user.id, reason: parsed.data.reason });
  if (!result.ok) return NextResponse.json(result, { status: 409 });
  await recordAudit({ user_id: guard.user.id, action: "account.delete", entity_type: "account", entity_id: String(id), after: { deleted: true, op_id: result.opId } });
  return NextResponse.json({ ok: true, executed: true, opId: result.opId });
}
