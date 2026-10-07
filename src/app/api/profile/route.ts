import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import {
  findUserById,
  updateUserProfile,
  setUserRole,
  countAdmins,
} from "@/lib/repos/users";
import { recordAudit } from "@/lib/repos/audit";
import { isValidProfileEmoji } from "@/lib/emoji";

const ProfileSchema = z.object({
  // Omitted/undefined → editing your own profile. Present → editing another
  // user, which requires admin.
  userId: z.number().int().positive().optional(),
  display_name: z.string().trim().min(1, "Name is required.").max(120),
  // null clears the emoji (initials fallback); a string must be in the set.
  emoji: z
    .union([z.string(), z.null()])
    .refine((v) => v === null || isValidProfileEmoji(v), "Pick an emoji from the set.")
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  // Optional free-text title; blank or omitted clears it.
  job_title: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null) return null;
      const t = v.trim();
      return t.length ? t.slice(0, 120) : null;
    }),
  role: z.enum(["admin", "editor", "member"]).optional(),
});

export async function PATCH(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const parsed = ProfileSchema.safeParse(await req.json());
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
  }

  const { userId, display_name, emoji, job_title, role } = parsed.data;
  const targetId = userId ?? me.id;
  const editingSelf = targetId === me.id;

  // Editing anyone other than yourself is an admin-only action.
  if (!editingSelf && me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });
  }

  const target = await findUserById(targetId);
  if (!target) {
    return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
  }

  // Role changes are admin-only. A non-admin editing their own profile can
  // never change their role — silently ignore any role in the payload.
  const roleChange = role !== undefined && role !== target.role && me.role === "admin";
  if (roleChange && role !== "admin" && target.role === "admin" && (await countAdmins()) <= 1) {
    return NextResponse.json(
      { ok: false, fieldErrors: { role: "Cannot demote the last active admin." } },
      { status: 422 }
    );
  }

  const updated = await updateUserProfile(targetId, { display_name, emoji, job_title });
  if (!updated) {
    return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
  }

  await recordAudit({
    user_id: me.id,
    action: "user.profile_update",
    entity_type: "user",
    entity_id: String(targetId),
    before: { display_name: target.display_name, emoji: target.emoji, job_title: target.job_title },
    after: { display_name: updated.display_name, emoji: updated.emoji, job_title: updated.job_title },
  });

  if (roleChange) {
    await setUserRole(targetId, role!);
    await recordAudit({
      user_id: me.id,
      action: "user.role_change",
      entity_type: "user",
      entity_id: String(targetId),
      before: { role: target.role },
      after: { role },
    });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      display_name: updated.display_name,
      emoji: updated.emoji,
      job_title: updated.job_title,
      role: roleChange ? role : updated.role,
    },
  });
}
