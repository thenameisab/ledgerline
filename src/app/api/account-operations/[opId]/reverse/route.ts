import { NextResponse } from "next/server";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { recordAudit } from "@/lib/repos/audit";
import { getAccountOperation, reverseAccountOperation } from "@/lib/repos/account-merge";

// Undo an executed merge/delete within its reverse window. Admin-level
// (account.op.approve) — the safety valve for a mistaken operation.
export async function POST(req: Request, { params }: { params: { opId: string } }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("account.op.approve");
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });

  const opId = Number(params.opId);
  if (!Number.isInteger(opId) || opId <= 0) return NextResponse.json({ ok: false, error: "Invalid operation id." }, { status: 400 });

  const op = await getAccountOperation(opId);
  if (!op) return NextResponse.json({ ok: false, error: "Operation not found." }, { status: 404 });

  const result = await reverseAccountOperation(opId, guard.user.id);
  if (!result.ok) return NextResponse.json(result, { status: 409 });

  await recordAudit({ user_id: guard.user.id, action: "account.op.reverse", entity_type: "account_operation", entity_id: String(opId), after: { kind: op.kind } });
  return NextResponse.json({ ok: true });
}
