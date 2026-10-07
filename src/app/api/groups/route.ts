import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { createGroup, GroupConflictError } from "@/lib/repos/accounts";
import { recordAudit } from "@/lib/repos/audit";

const CreateGroupSchema = z.object({
  name: z.string().min(1, "Group name is required.").max(200),
});

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("group.create");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }

  const parsed = CreateGroupSchema.safeParse(await req.json());
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
    const { id } = await createGroup(name);

    await recordAudit({
      user_id: guard.user.id,
      action: "group.create",
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
