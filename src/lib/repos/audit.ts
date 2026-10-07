import getSql from "../db";

export type AuditAction =
  | "pricing.update"
  | "pricing.supersede"
  | "pricing.delete"
  | "leak.dismiss"
  | "leak.restore"
  | "bundle.create"
  | "bundle.price_update"
  | "bundle.price_supersede"
  | "bundle.delete"
  | "vendor_pricing.update"
  | "vendor_pricing.supersede"
  | "vendor_commitment.update"
  | "vendor_commitment.supersede"
  | "vendor.update"
  | "alias.resolve"
  | "catalog.accept_code"
  | "catalog.override"
  | "catalog.ack_drift"
  | "user.invite"
  | "user.invite_resend"
  | "user.invite_cancel"
  | "user.role_change"
  | "user.status_change"
  | "user.profile_update"
  | "user.activated"
  | "invoice.finalize"
  | "invoice.issue"
  | "invoice.adjustment.add"
  | "invoice.adjustment.remove"
  | "manual_entry.create"
  | "manual_entry.submit"
  | "manual_entry.approve"
  | "manual_entry.void"
  | "api.create"
  | "api.update"
  | "account.create"
  | "account.update"
  | "account.merge"
  | "account.delete"
  | "account.op.request"
  | "account.op.approve"
  | "account.op.reject"
  | "account.op.reverse"
  | "account.op.purge"
  | "group.create"
  | "group.update"
  | "group.delete"
  | "vendor_recon.dismiss"
  | "vendor_recon.restore"
  | "sync.backfill"
  | "sync.refresh"
  | "alerts.config.update";

export async function recordAudit(input: {
  user_id: number;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, before_json, after_json)
    VALUES (
      ${input.user_id},
      ${input.action},
      ${input.entity_type},
      ${input.entity_id},
      ${input.before == null ? null : JSON.stringify(input.before)},
      ${input.after == null ? null : JSON.stringify(input.after)}
    )
  `;
}

export type AuditEntry = {
  id: number;
  user_id: number;
  user_email: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
};

export async function recentAudit(limit = 50): Promise<AuditEntry[]> {
  const sql = getSql();
  return sql`
    SELECT a.*, u.email AS user_email
    FROM audit_log a JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT ${limit}
  ` as unknown as Promise<AuditEntry[]>;
}

export type AuditListEntry = AuditEntry & {
  user_name: string;
  user_emoji: string | null;
};

export async function listAudit(opts: {
  userId?: number;
  action?: string;
  entityType?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AuditListEntry[]; total: number }> {
  const sql = getSql();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 50;
  const userCond = opts.userId ? sql`AND a.user_id = ${opts.userId}` : sql``;
  const actionCond = opts.action ? sql`AND a.action = ${opts.action}` : sql``;
  const entityCond = opts.entityType ? sql`AND a.entity_type = ${opts.entityType}` : sql``;

  const rows = await sql`
    SELECT a.*, u.email AS user_email, u.display_name AS user_name, u.emoji AS user_emoji
    FROM audit_log a JOIN users u ON u.id = a.user_id
    WHERE TRUE ${userCond} ${actionCond} ${entityCond}
    ORDER BY a.created_at DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `;
  const [cnt] = await sql`
    SELECT COUNT(*) AS n FROM audit_log a
    WHERE TRUE ${userCond} ${actionCond} ${entityCond}
  `;
  return { rows: rows as unknown as AuditListEntry[], total: Number(cnt.n) };
}

/** Distinct values present in the log — drives the filter dropdowns. */
export async function listAuditFacets(): Promise<{ actions: string[]; entityTypes: string[] }> {
  const sql = getSql();
  const [actions, entityTypes] = await Promise.all([
    sql`SELECT DISTINCT action FROM audit_log ORDER BY action`,
    sql`SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type`,
  ]);
  return {
    actions: (actions as any[]).map((r) => r.action),
    entityTypes: (entityTypes as any[]).map((r) => r.entity_type),
  };
}
