import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { config } from "@/lib/config";
import { findUserByEmail } from "@/lib/repos/users";
import type { Role } from "@/lib/repos/users";

export type Action =
  | "pricing.edit"
  | "vendor_pricing.edit"
  | "alias.resolve"
  | "user.manage"
  | "edit_mode.toggle"
  | "manual_entry.edit"
  | "manual_entry.approve"
  | "sandbox_billing.edit"
  | "api.create"
  | "api.update"
  | "account.create"
  | "account.update"
  | "account.merge"
  | "account.delete"
  | "account.op.approve"
  | "group.create"
  | "group.update"
  | "group.delete"
  | "sync.backfill"
  | "sync.refresh"
  | "alert.act";

// Actions reserved to privileged roles. A plain `member` can do none of these;
// `admin` can do all of them; `editor` can do only the subset in EDITOR_ACTIONS.
const ADMIN_ACTIONS: Action[] = [
  "pricing.edit",
  "vendor_pricing.edit",
  "alias.resolve",
  "user.manage",
  "edit_mode.toggle",
  "manual_entry.edit",
  "manual_entry.approve",
  "sandbox_billing.edit",
  "api.create",
  "api.update",
  "account.create",
  "account.update",
  "account.merge",
  "account.delete",
  "account.op.approve",
  "group.create",
  "group.update",
  "group.delete",
  "sync.backfill",
  "sync.refresh",
  "alert.act",
];

// The `editor` role is an admin-minus scoped to the data-hygiene / customisation
// work: edit account pricing, manage manual (bulk) entries end-to-end, resolve
// aliases / API review (both gated by `alias.resolve`), set sandbox billing
// rules, govern the API catalog, and manage account profiles and groups.
// It cannot touch the admin-reserved config surfaces (users, vendor cost, sync,
// audit). It *can* read derived margin (canViewCost) — but not the
// vendor rate card that produces it.
const EDITOR_ACTIONS: Action[] = [
  "pricing.edit",
  "manual_entry.edit",
  "manual_entry.approve",
  "alias.resolve",
  "sandbox_billing.edit",
  "api.create",
  "api.update",
  "account.create",
  "account.update",
  // Editors may *initiate* a merge/delete, but it lands as a pending request an
  // admin must approve. `account.op.approve` is intentionally admin-only (absent
  // here) — that is the enforced maker/checker gate.
  "account.merge",
  "account.delete",
  "group.create",
  "group.update",
  "group.delete",
  // Open /alerts, acknowledge and snooze. Threshold settings stay admin-only.
  "alert.act",
];

export function can(role: Role, action: Action): boolean {
  if (role === "admin") return true;
  if (role === "editor") return !ADMIN_ACTIONS.includes(action) || EDITOR_ACTIONS.includes(action);
  return !ADMIN_ACTIONS.includes(action);
}

// Guard helpers. Admins and editors may edit pricing and manual entries;
// members are read-only.
export function canEdit(role: Role): boolean {
  return role === "admin" || role === "editor";
}

export function canApprove(role: Role): boolean {
  return role === "admin" || role === "editor";
}

// Who may see margin and vendor cost. Read paths thread this through an
// `includeCost` flag (safe-default false) so the numbers never reach a
// member's page payload, not just the rendered UI.
//
// Editors are included. An editor sets the client price, so the editor needs
// to see cost to avoid the low-margin pricing that `margin_watch` flags. What
// this opens is the *derived* figure — margin on the dashboard, the APIs list,
// an account, a draft statement — never the rate card. `/vendors`
// and `vendor_pricing.edit` stay admin-only, so a vendor's contracted per-hit
// rate is still not an editor's to read.
//
// This is the only definition. API detail, both invoice pages and the
// internal PDF and CSV variants call it, so the boundary moves in one place. Action gates on those pages — finalize, issue, edit —
// are a different question and still test for admin directly.
export function canViewCost(role: Role): boolean {
  return role === "admin" || role === "editor";
}

export type SessionUser = {
  id: number;
  email: string;
  role: Role;
  name: string | null;
  emoji: string | null;
  job_title: string | null;
};

// Memoized per request: the layout (Shell) and the page both resolve the
// session user, and without this each call would re-run auth() + a users
// round-trip. React's cache() dedupes them to a single lookup per render.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (config.auth.bypassAuth) {
    const u = await findUserByEmail(config.auth.demoAdminEmail);
    if (u) return { id: u.id, email: u.email, role: u.role, name: u.display_name, emoji: u.emoji, job_title: u.job_title };
    return null;
  }
  const session = await auth();
  if (!session?.user?.email) return null;
  const u = await findUserByEmail(session.user.email);
  if (!u || u.status !== "active") return null;
  return { id: u.id, email: u.email, role: u.role, name: u.display_name, emoji: u.emoji, job_title: u.job_title };
});

export async function requireSession(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const u = await requireSession();
  if (role === "admin" && u.role !== "admin") redirect("/dashboard?denied=admin");
  return u;
}

/**
 * Page/layout gate keyed on a permission rather than a fixed role — so an
 * `editor` reaches pricing and manual-entry screens while a `member` is still
 * bounced. API-route mutations use `guardAction` (returns a result); this one
 * redirects, for use at the top of a server component.
 */
export async function requireCan(action: Action): Promise<SessionUser> {
  const u = await requireSession();
  if (!can(u.role, action)) redirect("/dashboard?denied=admin");
  return u;
}

/**
 * Guard for server actions / API routes that mutate state. Returns the
 * authorized user, or a `forbidden`-shaped error result the caller can
 * forward to the account. Centralizes the role + action check so the policy
 * lives in one file (`can()`), not scattered across handlers.
 *
 *   const guard = await guardAction("pricing.edit");
 *   if (!guard.ok) return guard;
 *   // guard.user is typed SessionUser
 */
export type GuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string; code: "unauthenticated" | "forbidden" };

export async function guardAction(action: Action): Promise<GuardResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "Sign in required.", code: "unauthenticated" };
  if (!can(u.role, action)) return { ok: false, error: "Admin only.", code: "forbidden" };
  return { ok: true, user: u };
}
