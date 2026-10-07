import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { recordAudit } from "@/lib/repos/audit";
import { revertStatementToDraft } from "@/lib/repos/statements";
import {
  previewAccountMerge,
  executeAccountMerge,
  createPendingOperation,
  type PricingResolutions,
} from "@/lib/repos/account-merge";
import { notifyAccountOpRequested } from "@/lib/notify/account-ops";

function idFrom(params: { id: string }): number | null {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Preview: revenue moved, row counts, pricing collisions, blocking invoices.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAction("account.merge");
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  const id = idFrom(params);
  const targetId = Number(new URL(req.url).searchParams.get("target_id"));
  if (!id || !Number.isInteger(targetId) || targetId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid account or target." }, { status: 400 });
  }
  const preview = await previewAccountMerge(id, targetId);
  if (!preview) return NextResponse.json({ ok: false, error: "Account or target not found." }, { status: 404 });
  return NextResponse.json({ ok: true, preview });
}

const PostSchema = z.object({
  target_id: z.number().int().positive(),
  resolutions: z.record(z.string(), z.enum(["target", "source"])).optional(),
  note: z.string().max(1000).optional(),
  revert_statement_ids: z.array(z.number().int().positive()).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("account.merge");
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });

  const id = idFrom(params);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid account id." }, { status: 400 });

  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 422 });
  const { target_id, note } = parsed.data;
  const resolutions = (parsed.data.resolutions ?? {}) as PricingResolutions;
  if (target_id === id) return NextResponse.json({ ok: false, error: "Cannot merge an account into itself." }, { status: 400 });

  // Editors only *request*; an admin approves + executes (enforced maker/checker).
  if (guard.user.role !== "admin") {
    const preview = await previewAccountMerge(id, target_id);
    if (!preview) return NextResponse.json({ ok: false, error: "Account or target not found." }, { status: 404 });
    const opId = await createPendingOperation({
      kind: "merge",
      sourceId: id,
      targetId: target_id,
      requestedBy: guard.user.id,
      note,
      resolutions,
    });
    await recordAudit({ user_id: guard.user.id, action: "account.op.request", entity_type: "account_operation", entity_id: String(opId), after: { kind: "merge", source: id, target: target_id } });
    await notifyAccountOpRequested({ opId, kind: "merge", requesterName: guard.user.name ?? guard.user.email, sourceName: preview.source.display_name, targetName: preview.target.display_name });
    return NextResponse.json({ ok: true, pending: true, opId });
  }

  // Admin: resolve any finalized-invoice blockers inline, then execute now.
  for (const sid of parsed.data.revert_statement_ids ?? []) {
    await revertStatementToDraft(sid, guard.user.id);
  }
  const result = await executeAccountMerge({ sourceId: id, targetId: target_id, resolutions, actorId: guard.user.id });
  if (!result.ok) return NextResponse.json(result, { status: 409 });
  await recordAudit({ user_id: guard.user.id, action: "account.merge", entity_type: "account", entity_id: String(id), after: { merged_into: target_id, op_id: result.opId } });
  return NextResponse.json({ ok: true, executed: true, opId: result.opId });
}
