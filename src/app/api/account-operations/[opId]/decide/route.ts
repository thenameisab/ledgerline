import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { recordAudit } from "@/lib/repos/audit";
import { revertStatementToDraft } from "@/lib/repos/statements";
import {
  getAccountOperation,
  executeAccountMerge,
  executeAccountDelete,
  rejectAccountOperation,
  type PricingResolutions,
} from "@/lib/repos/account-merge";
import { getAccount } from "@/lib/repos/accounts";
import { notifyAccountOpDecided } from "@/lib/notify/account-ops";

const Schema = z.object({
  action: z.enum(["approve", "reject"]),
  resolutions: z.record(z.string(), z.enum(["target", "source"])).optional(),
  revert_statement_ids: z.array(z.number().int().positive()).optional(),
});

export async function POST(req: Request, { params }: { params: { opId: string } }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("account.op.approve");
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });

  const opId = Number(params.opId);
  if (!Number.isInteger(opId) || opId <= 0) return NextResponse.json({ ok: false, error: "Invalid operation id." }, { status: 400 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 422 });

  const op = await getAccountOperation(opId);
  if (!op) return NextResponse.json({ ok: false, error: "Operation not found." }, { status: 404 });
  if (op.status !== "pending") return NextResponse.json({ ok: false, error: "This request has already been decided." }, { status: 409 });
  // Maker/checker: the approver must not be the requester.
  if (op.requested_by === guard.user.id) {
    return NextResponse.json({ ok: false, error: "You cannot approve your own request." }, { status: 403 });
  }

  const src = await getAccount(op.source_client_id);
  const tgt = op.target_client_id ? await getAccount(op.target_client_id) : null;

  if (parsed.data.action === "reject") {
    const ok = await rejectAccountOperation(opId, guard.user.id);
    if (!ok) return NextResponse.json({ ok: false, error: "Could not reject." }, { status: 409 });
    await recordAudit({ user_id: guard.user.id, action: "account.op.reject", entity_type: "account_operation", entity_id: String(opId) });
    await notifyAccountOpDecided({ opId, kind: op.kind, requesterId: op.requested_by, approved: false, sourceName: src?.display_name ?? "account", targetName: tgt?.display_name ?? null });
    return NextResponse.json({ ok: true, rejected: true });
  }

  // Approve = execute. Resolve blocking invoices inline first.
  for (const sid of parsed.data.revert_statement_ids ?? []) {
    await revertStatementToDraft(sid, guard.user.id);
  }

  let result: { ok: true; opId: number } | { ok: false; error: string };
  if (op.kind === "merge") {
    const resolutions = (parsed.data.resolutions ?? op.payload?.resolutions ?? {}) as PricingResolutions;
    result = await executeAccountMerge({ sourceId: op.source_client_id, targetId: op.target_client_id!, resolutions, actorId: guard.user.id, opId });
  } else {
    result = await executeAccountDelete({ id: op.source_client_id, actorId: guard.user.id, reason: op.note ?? undefined, opId });
  }
  if (!result.ok) return NextResponse.json(result, { status: 409 });

  await recordAudit({ user_id: guard.user.id, action: "account.op.approve", entity_type: "account_operation", entity_id: String(opId), after: { kind: op.kind } });
  await notifyAccountOpDecided({ opId, kind: op.kind, requesterId: op.requested_by, approved: true, sourceName: src?.display_name ?? "account", targetName: tgt?.display_name ?? null });
  return NextResponse.json({ ok: true, approved: true });
}
