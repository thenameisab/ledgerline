import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import {
  updateGroup,
  deleteGroup,
  mergeGroup,
  GroupConflictError,
} from "@/lib/repos/accounts";
import { recordAudit } from "@/lib/repos/audit";

const UpdateSchema = z.object({
  name: z.string().min(1, "Group name is required.").max(200),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("group.update");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid group id." }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
  }

  const name = parsed.data.name.trim();
  try {
    const updated = await updateGroup(id, name);
    if (!updated) return NextResponse.json({ ok: false, error: "Group not found." }, { status: 404 });

    await recordAudit({
      user_id: guard.user.id,
      action: "group.update",
      entity_type: "group",
      entity_id: String(id),
      after: { name },
    });

    return NextResponse.json({ ok: true, id, name });
  } catch (err) {
    if (err instanceof GroupConflictError) {
      return NextResponse.json(
        { ok: false, fieldErrors: { name: "A group with this name already exists." } },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("group.delete");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid group id." }, { status: 400 });
  }

  const mergeIntoRaw = new URL(req.url).searchParams.get("merge_into");

  if (mergeIntoRaw != null) {
    const mergeInto = Number(mergeIntoRaw);
    if (!Number.isInteger(mergeInto) || mergeInto <= 0 || mergeInto === id) {
      return NextResponse.json({ ok: false, error: "Invalid merge target." }, { status: 400 });
    }
    const merged = await mergeGroup(id, mergeInto);
    if (!merged) return NextResponse.json({ ok: false, error: "Group or merge target not found." }, { status: 404 });
    await recordAudit({
      user_id: guard.user.id,
      action: "group.delete",
      entity_type: "group",
      entity_id: String(id),
      after: { merged_into: mergeInto },
    });
    return NextResponse.json({ ok: true, merged_into: mergeInto });
  }

  const deleted = await deleteGroup(id);
  if (!deleted) return NextResponse.json({ ok: false, error: "Group not found." }, { status: 404 });
  await recordAudit({
    user_id: guard.user.id,
    action: "group.delete",
    entity_type: "group",
    entity_id: String(id),
    after: { deleted: true },
  });
  return NextResponse.json({ ok: true });
}
