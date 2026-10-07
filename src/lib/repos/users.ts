import getSql from "../db";
import { recordAudit } from "./audit";

export type Role = "admin" | "editor" | "member";
export type UserStatus = "active" | "invited" | "disabled";

export type UserRow = {
  id: number;
  email: string;
  google_sub: string | null;
  display_name: string;
  role: Role;
  status: UserStatus;
  invited_by: number | null;
  created_at: string;
  last_login_at: string | null;
  invite_expires_at: string | null;
  emoji: string | null;
  job_title: string | null;
};

/** How long a pending invite stays valid before it must be resent. */
export const INVITE_TTL_DAYS = 2;

/** True when a row is a pending invite whose window has elapsed. */
export function isInviteExpired(user: Pick<UserRow, "status" | "invite_expires_at">): boolean {
  if (user.status !== "invited" || !user.invite_expires_at) return false;
  return new Date(user.invite_expires_at).getTime() < Date.now();
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const sql = getSql();
  const [row] = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  return row as UserRow | undefined;
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  const sql = getSql();
  const [row] = await sql`SELECT * FROM users WHERE id = ${id}`;
  return row as UserRow | undefined;
}

export async function listUsers(): Promise<UserRow[]> {
  const sql = getSql();
  return sql`SELECT * FROM users ORDER BY status DESC, display_name` as unknown as Promise<UserRow[]>;
}

export async function inviteUser(input: {
  email: string;
  display_name: string;
  role: Role;
  invited_by: number | null;
}): Promise<UserRow> {
  const sql = getSql();
  const [row] = await sql`
    INSERT INTO users (email, display_name, role, status, invited_by, invite_expires_at)
    VALUES (
      ${input.email.toLowerCase()}, ${input.display_name}, ${input.role}, 'invited',
      ${input.invited_by}, NOW() + make_interval(days => ${INVITE_TTL_DAYS})
    )
    ON CONFLICT (email) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      role = EXCLUDED.role,
      invited_by = EXCLUDED.invited_by,
      -- Re-inviting re-arms the expiry window. An already-active account is
      -- left active (never downgraded to invited); anything else becomes a
      -- fresh pending invite.
      status = CASE WHEN users.status = 'active' THEN users.status ELSE 'invited' END,
      invite_expires_at = NOW() + make_interval(days => ${INVITE_TTL_DAYS})
    RETURNING *
  `;
  return row as UserRow;
}

/** Re-arm a pending or cancelled invite's window. Never resurrects an active
 *  group into the invited state. Returns null if the row can't be resent. */
export async function resendInvite(id: number): Promise<UserRow | null> {
  const sql = getSql();
  const [row] = await sql`
    UPDATE users
    SET status = 'invited',
        invite_expires_at = NOW() + make_interval(days => ${INVITE_TTL_DAYS})
    WHERE id = ${id} AND status IN ('invited', 'disabled')
    RETURNING *
  `;
  return (row as UserRow) ?? null;
}

/** Thrown when an existing user's google_sub is already bound to a
 *  different Google account than the one trying to sign in. The signIn
 *  callback treats this as a hard reject. */
export class GoogleSubMismatchError extends Error {
  constructor(public email: string) {
    super(`google_sub mismatch for ${email}`);
  }
}

export async function activateUserOnLogin(input: {
  email: string;
  google_sub: string;
  display_name: string;
}): Promise<UserRow | null> {
  const existing = await findUserByEmail(input.email);
  if (!existing) return null;
  if (existing.status === "disabled") return null;
  // A pending invite past its window is treated like no invite at all —
  // sign-in is refused until an admin resends, which re-arms the clock.
  if (isInviteExpired(existing)) return null;

  // Once a user has bound a Google identity, we never re-bind silently —
  // a different sub for the same email means either a different person or
  // a group takeover attempt. Reject the login and let an admin
  // reset the row out of band.
  if (existing.google_sub && existing.google_sub !== input.google_sub) {
    throw new GoogleSubMismatchError(input.email);
  }

  const sql = getSql();
  await sql`
    UPDATE users
    SET google_sub = COALESCE(google_sub, ${input.google_sub}),
        display_name = CASE WHEN status = 'invited' THEN ${input.display_name} ELSE display_name END,
        status = CASE WHEN status = 'invited' THEN 'active' ELSE status END,
        last_login_at = NOW()
    WHERE email = ${input.email.toLowerCase()}
  `;

  const updated = await findUserByEmail(input.email);
  if (!updated) return null;

  if (existing.status === "invited" && updated.status === "active") {
    await recordAudit({
      user_id: updated.id,
      action: "user.activated",
      entity_type: "user",
      entity_id: String(updated.id),
      before: { status: existing.status, google_sub: existing.google_sub },
      after: { status: updated.status, google_sub: updated.google_sub },
    });
  }

  return updated;
}

/** Update a user's editable profile fields. `emoji` / `job_title` of null
 *  clear them. Returns the updated row, or null if no such user. */
export async function updateUserProfile(
  id: number,
  input: { display_name: string; emoji: string | null; job_title: string | null }
): Promise<UserRow | null> {
  const sql = getSql();
  const [row] = await sql`
    UPDATE users
    SET display_name = ${input.display_name},
        emoji = ${input.emoji},
        job_title = ${input.job_title}
    WHERE id = ${id}
    RETURNING *
  `;
  return (row as UserRow) ?? null;
}

export async function setUserRole(id: number, role: Role): Promise<void> {
  const sql = getSql();
  await sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
}

export async function setUserStatus(id: number, status: UserStatus): Promise<void> {
  const sql = getSql();
  await sql`UPDATE users SET status = ${status} WHERE id = ${id}`;
}

export async function countAdmins(): Promise<number> {
  const sql = getSql();
  const [row] = await sql`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'`;
  return Number(row.n);
}
