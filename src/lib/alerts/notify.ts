// Bell notifications for new alerts. The audience is every active admin and
// editor, the roles that can open /alerts.
//
// One notification per evaluated usage date carries the day's counts, so a
// normal day adds one line to the bell, not one per alert. Each critical alert
// also gets its own notification, because those are the ones to act on today.

import getSql from "../db";
import { createNotifications } from "../repos/notifications";
import type { AlertSeverity } from "./config";
import type { AlertDraft } from "./rules";
import { formatDate } from "../format";

const ORDER: AlertSeverity[] = ["critical", "high", "medium", "info"];

async function alertAudience(): Promise<number[]> {
  const sql = getSql();
  const rows = await sql`SELECT id FROM users WHERE role IN ('admin', 'editor') AND status = 'active'`;
  return (rows as any[]).map((r) => Number(r.id));
}

export async function notifyNewAlerts(dataDate: string, alerts: (AlertDraft & { id: number | null })[]): Promise<void> {
  const created = alerts.filter((a) => a.id != null);
  if (!created.length) return;
  const users = await alertAudience();
  if (!users.length) return;

  const counts = ORDER.map((s) => [s, created.filter((a) => a.severity === s).length] as const).filter(([, n]) => n > 0);
  await createNotifications(users, {
    kind: "alert.digest",
    title: `${created.length} new alert${created.length === 1 ? "" : "s"} for ${formatDate(dataDate)}`,
    body: counts.map(([s, n]) => `${n} ${s}`).join(", "),
    link: "/alerts",
    entityType: "alert_date",
    entityId: dataDate,
  });
  for (const a of created) {
    if (a.severity !== "critical") continue;
    await createNotifications(users, {
      kind: "alert.critical",
      title: a.title,
      body: a.body,
      link: `/alerts?id=${a.id}`,
      entityType: "alert",
      entityId: String(a.id),
    });
  }
}
