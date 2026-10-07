import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { StatusBar } from "@/components/StatusBar";
import { SettingsNav } from "@/components/admin/SettingsNav";
import { requireRole } from "@/lib/access";
import {
  listUsers,
  inviteUser,
  resendInvite,
  setUserRole,
  setUserStatus,
  countAdmins,
  isInviteExpired,
  INVITE_TTL_DAYS,
  type UserRow,
  type Role,
} from "@/lib/repos/users";
import { recordAudit } from "@/lib/repos/audit";
import { sendEmail } from "@/lib/email";
import { buildInviteEmail } from "@/lib/emails/invite-email";
import { UserCog, MailPlus, ShieldCheck, UserMinus, Send, AlertTriangle, CheckCircle2 } from "lucide-react";
import { RoleSelect } from "./RoleSelect";
import { EditUserButton } from "@/components/profile/EditUserButton";
import { buttonClass } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";
import { ROW_BAD, ROW_WARN } from "@/lib/row-status";

const loginUrl = () => `${process.env.AUTH_URL ?? "http://localhost:3000"}/login`;

/** Send the branded invite email. Best-effort: returns an outcome string the
 *  invite/resend actions thread into a banner, never throws. */
async function sendInviteEmail(user: UserRow, inviterName: string | null): Promise<"sent" | "skipped" | "failed"> {
  const { subject, html, text } = buildInviteEmail({
    displayName: user.display_name,
    role: user.role,
    loginUrl: loginUrl(),
    expiresInDays: INVITE_TTL_DAYS,
    inviterName,
  });
  const res = await sendEmail({ to: user.email, subject, html, text });
  if (res.ok) return "sent";
  return res.skipped ? "skipped" : "failed";
}

const InviteSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  display_name: z.string().min(1).max(120),
  role: z.enum(["admin", "editor", "member"]),
});

async function inviteAction(formData: FormData) {
  "use server";
  const me = await requireRole("admin");
  const parsed = InviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const created = await inviteUser({ ...parsed.data, invited_by: me.id });
  await recordAudit({
    user_id: me.id,
    action: "user.invite",
    entity_type: "user",
    entity_id: String(created.id),
    after: { email: created.email, role: created.role },
  });
  const outcome = await sendInviteEmail(created, me.name);
  revalidatePath("/admin/users");
  redirect(`/admin/users?notice=${outcome}&who=${encodeURIComponent(created.email)}`);
}

async function resendInviteAction(formData: FormData) {
  "use server";
  const me = await requireRole("admin");
  const id = Number(formData.get("id"));
  const updated = await resendInvite(id);
  if (!updated) return;
  await recordAudit({
    user_id: me.id,
    action: "user.invite_resend",
    entity_type: "user",
    entity_id: String(id),
    after: { email: updated.email, invite_expires_at: updated.invite_expires_at },
  });
  const outcome = await sendInviteEmail(updated, me.name);
  revalidatePath("/admin/users");
  redirect(`/admin/users?notice=${outcome}&who=${encodeURIComponent(updated.email)}`);
}

async function setRoleAction(formData: FormData) {
  "use server";
  const me = await requireRole("admin");
  const id = Number(formData.get("id"));
  const role = String(formData.get("role")) as Role;
  if (role !== "admin" && role !== "editor" && role !== "member") return;
  if (role !== "admin" && (await countAdmins()) <= 1) {
    throw new Error("Cannot demote the last active admin.");
  }
  await setUserRole(id, role);
  await recordAudit({
    user_id: me.id,
    action: "user.role_change",
    entity_type: "user",
    entity_id: String(id),
    after: { role },
  });
  revalidatePath("/admin/users");
}

async function setStatusAction(formData: FormData) {
  "use server";
  const me = await requireRole("admin");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as "active" | "disabled";
  if (status !== "active" && status !== "disabled") return;
  if (status === "disabled" && id === me.id) {
    throw new Error("Cannot disable your own account.");
  }
  if (status === "disabled" && (await countAdmins()) <= 1) {
    throw new Error("Cannot disable the last active admin.");
  }
  await setUserStatus(id, status);
  await recordAudit({
    user_id: me.id,
    action: "user.status_change",
    entity_type: "user",
    entity_id: String(id),
    after: { status },
  });
  revalidatePath("/admin/users");
}

async function cancelInviteAction(formData: FormData) {
  "use server";
  const me = await requireRole("admin");
  const id = Number(formData.get("id"));
  // Only allow cancelling rows that are still in "invited" — never use this
  // to disable real accounts (that has its own path with last-admin guard).
  const allUsers = await listUsers();
  const target = allUsers.find((u) => u.id === id);
  if (!target || target.status !== "invited") return;
  await setUserStatus(id, "disabled");
  await recordAudit({
    user_id: me.id,
    action: "user.invite_cancel",
    entity_type: "user",
    entity_id: String(id),
    after: { status: "disabled" },
  });
  revalidatePath("/admin/users");
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { notice?: string; who?: string };
}) {
  const me = await requireRole("admin");
  const users = await listUsers();
  const adminCount = users.filter((u) => u.role === "admin" && u.status === "active").length;
  const activeCount = users.filter((u) => u.status === "active").length;
  const invitedCount = users.filter((u) => u.status === "invited").length;

  return (
    <main>
      <StatusBar
        title="Users"
        subtitle={`${users.length} total · ${activeCount} active · ${invitedCount} invited · ${adminCount} admin${adminCount === 1 ? "" : "s"}`}
      />
      <SettingsNav />

      <div className="mx-auto w-full max-w-[1200px] px-7 py-6 space-y-6">
        <InviteNotice notice={searchParams.notice} who={searchParams.who} />
        {/* Invite form */}
        <section
          className="elev-1 bg-bg-raised rounded-md p-5 dash-enter"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 mb-3">
            <MailPlus size={14} strokeWidth={1.5} className="text-accent-ink" />
            <h2 className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
              Invite a user
            </h2>
          </div>
          <p className="text-xs text-ink-faint mb-4 max-w-prose leading-relaxed">
            We email an invite to the address below; they sign in with that Google account.
            Invites expire after {INVITE_TTL_DAYS} days, resend to re-arm. Members can read
            everything; editors can also edit account pricing and the customisation surfaces
            (manual entries, aliases, SKU review, sandbox billing); admins can do everything,
            including vendor cost, usage sync, and managing users.
          </p>
          <form action={inviteAction} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_auto] gap-3 items-end">
            <Field label="Email">
              <input
                name="email"
                type="email"
                required
                placeholder="name@company.com"
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono tnum focus:outline-none focus:border-accent transition-colors duration-fast ease-expo"
              />
            </Field>
            <Field label="Name">
              <input
                name="display_name"
                type="text"
                required
                maxLength={120}
                placeholder="Full name"
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors duration-fast ease-expo"
              />
            </Field>
            <Field label="Role">
              <select
                name="role"
                defaultValue="member"
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors duration-fast ease-expo"
              >
                <option value="member">Member</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <button type="submit" className={buttonClass({ variant: "primary", size: "md" })}>
              Send invite
            </button>
          </form>
        </section>

        {/* Users table */}
        <section
          className="elev-1 bg-bg-raised rounded-md overflow-hidden dash-enter"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <table className="w-full text-sm">
            <thead className="bg-bg-sunken text-ink-muted text-xs uppercase tracking-wide">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Last login</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u, i) => {
                const expired = isInviteExpired(u);
                return (
                <tr
                  key={u.id}
                  className={`align-top row-enter transition-colors duration-fast ease-expo ${
                    u.status === "disabled" || expired
                      ? ROW_BAD
                      : u.status === "invited"
                      ? ROW_WARN
                      : "hover:bg-bg-sunken"
                  }`}
                  style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar emoji={u.emoji} name={u.display_name} email={u.email} />
                      <div className="min-w-0">
                        <div className="text-ink truncate">{u.display_name}</div>
                        {u.job_title && (
                          <div className="text-[11px] text-ink-muted truncate">{u.job_title}</div>
                        )}
                        <div className="text-[11px] font-mono text-ink-faint mt-0.5 truncate">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={u.status} expired={expired} />
                    {u.status === "invited" && u.invite_expires_at && (
                      <div className={`mt-1 text-[11px] ${expired ? "text-bad-ink" : "text-ink-faint"}`}>
                        Invite {expired ? "expired" : "expires"} {formatDateTime(u.invite_expires_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-muted">
                    {u.last_login_at ? (
                      formatDateTime(u.last_login_at)
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <RoleSelect userId={u.id} current={u.role} action={setRoleAction} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-3 justify-end items-center">
                      <EditUserButton
                        target={{
                          id: u.id,
                          email: u.email,
                          display_name: u.display_name,
                          emoji: u.emoji,
                          job_title: u.job_title,
                          role: u.role,
                        }}
                        isSelf={u.id === me.id}
                      />
                      {u.id === me.id ? (
                        <span
                          className="text-[11px] text-ink-faint"
                          title="You can't disable your own account."
                        >
                          You
                        </span>
                      ) : u.status === "invited" ? (
                        <>
                          <form action={resendInviteAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <button
                              type="submit"
                              className="text-xs text-ink-muted hover:text-accent-ink inline-flex items-center gap-1 transition-colors duration-fast ease-expo"
                              title={expired ? "Send a fresh invite email and re-arm the window" : "Send the invite email again and re-arm the window"}
                            >
                              <Send size={12} strokeWidth={1.5} /> Resend
                            </button>
                          </form>
                          <form action={cancelInviteAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <button
                              type="submit"
                              className="text-xs text-ink-muted hover:text-bad-ink inline-flex items-center gap-1 transition-colors duration-fast ease-expo"
                              title="Cancel this invitation"
                            >
                              <UserMinus size={12} strokeWidth={1.5} /> Cancel
                            </button>
                          </form>
                        </>
                      ) : (
                        <form action={setStatusAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={u.status === "disabled" ? "active" : "disabled"}
                          />
                          <button
                            type="submit"
                            className="text-xs text-ink-muted hover:text-ink inline-flex items-center gap-1 transition-colors duration-fast ease-expo"
                          >
                            {u.status === "disabled" ? (
                              <>
                                <ShieldCheck size={12} strokeWidth={1.5} /> Reactivate
                              </>
                            ) : (
                              <>
                                <UserMinus size={12} strokeWidth={1.5} /> Disable
                              </>
                            )}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-ink-muted">
                    <UserCog size={28} strokeWidth={1.5} className="mx-auto text-ink-faint mb-2" />
                    No users yet. Invite the first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <p className="text-xs text-ink-faint max-w-prose">
          All role and status changes are recorded in the audit log. The system blocks demoting or
          disabling the last active admin.
        </p>
      </div>
    </main>
  );
}

function UserAvatar({ emoji, name, email }: { emoji: string | null; name: string; email: string }) {
  if (emoji) {
    return (
      <span
        aria-hidden
        className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg border border-border text-[16px] leading-none select-none"
      >
        {emoji}
      </span>
    );
  }
  const initials =
    (name || email)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";
  return (
    <span
      aria-hidden
      className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent text-white text-[11px] font-semibold select-none"
    >
      {initials}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function StatusPill({
  status,
  expired,
}: {
  status: "active" | "invited" | "disabled";
  expired?: boolean;
}) {
  const cfg =
    status === "invited" && expired
      ? { bg: "bg-bad-bg", text: "text-bad-ink", label: "Expired" }
      : {
          active: { bg: "bg-ok-bg", text: "text-ok-ink", label: "Active" },
          invited: { bg: "bg-warn-bg", text: "text-warn-ink", label: "Invited" },
          disabled: { bg: "bg-bad-bg", text: "text-bad-ink", label: "Disabled" },
        }[status];
  return (
    <span className={`inline-flex items-center text-[11px] font-medium uppercase tracking-wide rounded px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

/** Post-action banner: confirms the invite email outcome. Auto-dismiss isn't
 *  needed; the notice clears on the next navigation. */
function InviteNotice({ notice, who }: { notice?: string; who?: string }) {
  if (!notice) return null;
  const email = who ? decodeURIComponent(who) : "the user";

  const cfg: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; msg: string }> = {
    sent: {
      bg: "bg-success-bg",
      border: "border-success",
      text: "text-success-ink",
      icon: <CheckCircle2 size={16} strokeWidth={1.5} />,
      msg: `Invite emailed to ${email}.`,
    },
    skipped: {
      bg: "bg-warn-bg",
      border: "border-warn",
      text: "text-warn-ink",
      icon: <AlertTriangle size={16} strokeWidth={1.5} />,
      msg: `${email} was invited, but email isn't configured, so no message was sent. Share the sign-in link manually, or set GMAIL_SENDER.`,
    },
    failed: {
      bg: "bg-bad-bg",
      border: "border-bad",
      text: "text-bad-ink",
      icon: <AlertTriangle size={16} strokeWidth={1.5} />,
      msg: `${email} was invited, but the email failed to send. Check the email credentials and resend.`,
    },
  };
  const c = cfg[notice];
  if (!c) return null;

  return (
    <div
      className={`flex items-start gap-2 rounded-md border ${c.border} ${c.bg} ${c.text} p-3 text-sm dash-enter`}
      role="status"
    >
      <span className="mt-0.5 shrink-0">{c.icon}</span>
      <span className="leading-relaxed">{c.msg}</span>
    </div>
  );
}

