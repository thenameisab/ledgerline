// In-app notifications backing the header bell + inbox.
// read_at NULL = unread. Fanned out by the account-operation flow (an editor's
// request notifies admins; an admin's decision notifies the requester).

import getSql from "../db";

export type Notification = {
  id: number;
  user_id: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export async function createNotification(n: {
  userId: number;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO notifications (user_id, kind, title, body, link, entity_type, entity_id)
    VALUES (${n.userId}, ${n.kind}, ${n.title}, ${n.body ?? null}, ${n.link ?? null},
            ${n.entityType ?? null}, ${n.entityId ?? null})
  `;
}

/** Fan a notification out to several users in one round-trip. */
export async function createNotifications(
  userIds: number[],
  n: { kind: string; title: string; body?: string; link?: string; entityType?: string; entityId?: string }
): Promise<void> {
  if (userIds.length === 0) return;
  const sql = getSql();
  const rows = userIds.map((uid) => ({
    user_id: uid,
    kind: n.kind,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    entity_type: n.entityType ?? null,
    entity_id: n.entityId ?? null,
  }));
  await sql`INSERT INTO notifications ${sql(rows, "user_id", "kind", "title", "body", "link", "entity_type", "entity_id")}`;
}

export async function listNotifications(userId: number, limit = 30): Promise<Notification[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM notifications WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows as unknown as Notification[];
}

export async function unreadCount(userId: number): Promise<number> {
  const sql = getSql();
  const [r] = await sql`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = ${userId} AND read_at IS NULL`;
  return Number(r.n);
}

export async function markRead(userId: number, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const sql = getSql();
  await sql`UPDATE notifications SET read_at = NOW() WHERE user_id = ${userId} AND id = ANY(${ids}) AND read_at IS NULL`;
}

export async function markAllRead(userId: number): Promise<void> {
  const sql = getSql();
  await sql`UPDATE notifications SET read_at = NOW() WHERE user_id = ${userId} AND read_at IS NULL`;
}

/** All active admins — the fan-out audience for editor-initiated requests. */
export async function adminUserIds(): Promise<number[]> {
  const sql = getSql();
  const rows = await sql`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`;
  return (rows as any[]).map((r) => Number(r.id));
}
