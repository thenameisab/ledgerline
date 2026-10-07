// Notification fan-out for the account merge/delete approval flow.
// In-app notifications are always written; email is a best-effort add-on that
// no-ops until email env is configured (see lib/email.ts) — a failed or
// skipped send never blocks the request/decision itself.

import "server-only";
import getSql from "@/lib/db";
import { createNotifications, createNotification, adminUserIds } from "@/lib/repos/notifications";
import { findUserById } from "@/lib/repos/users";
import { sendEmail } from "@/lib/email";
import { buildAccountOpRequestEmail, buildAccountOpDecisionEmail } from "@/lib/emails/account-op-email";

const verb = (kind: "merge" | "delete") => (kind === "merge" ? "merge" : "delete");

const appUrl = () => process.env.AUTH_URL ?? "http://localhost:3000";

async function adminEmails(): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`SELECT email FROM users WHERE role = 'admin' AND status = 'active'`;
  return (rows as any[]).map((r) => r.email as string);
}

/** An editor filed a request → notify every admin (in-app + best-effort email). */
export async function notifyAccountOpRequested(o: {
  opId: number;
  kind: "merge" | "delete";
  requesterName: string;
  sourceName: string;
  targetName: string | null;
}): Promise<void> {
  const admins = await adminUserIds();
  const detail = o.kind === "merge" ? `${o.sourceName} → ${o.targetName}` : o.sourceName;
  await createNotifications(admins, {
    kind: "account_op.requested",
    title: `Approval needed: ${verb(o.kind)} account`,
    body: `${o.requesterName} requested to ${verb(o.kind)} ${detail}.`,
    link: "/admin/approvals",
    entityType: "account_operation",
    entityId: String(o.opId),
  });

  try {
    const { subject, html, text } = buildAccountOpRequestEmail({
      kind: o.kind,
      requesterName: o.requesterName,
      sourceName: o.sourceName,
      targetName: o.targetName,
      approvalsUrl: `${appUrl()}/admin/approvals`,
    });
    for (const to of await adminEmails()) {
      await sendEmail({ to, subject, html, text });
    }
  } catch (err) {
    console.error("[notify] account-op request email failed:", err);
  }
}

/** An admin approved or rejected → notify the requester (in-app + best-effort email). */
export async function notifyAccountOpDecided(o: {
  opId: number;
  kind: "merge" | "delete";
  requesterId: number;
  approved: boolean;
  sourceName: string;
  targetName: string | null;
}): Promise<void> {
  const detail = o.kind === "merge" ? `${o.sourceName} → ${o.targetName}` : o.sourceName;
  await createNotification({
    userId: o.requesterId,
    kind: o.approved ? "account_op.approved" : "account_op.rejected",
    title: o.approved ? `Request approved: ${verb(o.kind)} account` : `Request declined: ${verb(o.kind)} account`,
    body: o.approved
      ? `Your request to ${verb(o.kind)} ${detail} was approved and applied.`
      : `Your request to ${verb(o.kind)} ${detail} was declined.`,
    entityType: "account_operation",
    entityId: String(o.opId),
  });

  try {
    const requester = await findUserById(o.requesterId);
    if (!requester) return;
    const { subject, html, text } = buildAccountOpDecisionEmail({
      kind: o.kind,
      approved: o.approved,
      sourceName: o.sourceName,
      targetName: o.targetName,
      appUrl: appUrl(),
    });
    await sendEmail({ to: requester.email, subject, html, text });
  } catch (err) {
    console.error("[notify] account-op decision email failed:", err);
  }
}
