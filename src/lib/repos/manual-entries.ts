// Manual / bulk usage entries.

import getSql from "../db";
import type { Sql, TransactionSql } from "postgres";
import { recordAudit } from "./audit";
import { toMoney, sumMoney, toDbNumeric, toNumber } from "../money";
import { resolveVendors } from "@/lib/vendor-registry";

export type ManualEntryStatus = "draft" | "pending_approval" | "approved" | "void";
export type ManualEntrySource = "manual" | "import";

export type ManualEntryLineInput = {
  api_code: string;
  hits_via: "Bulk" | "Integration" | "Console";
  vendor: string | null;
  successful: number;
  successful_no_data: number;
  failed: number;
  in_progress: number;
};

export type ManualEntryInput = {
  client_id: number;
  effective_date: string;
  reason: string;
  reference: string | null;
  attachment_path: string | null;
  source: ManualEntrySource;
  import_hash: string | null;
  lines: ManualEntryLineInput[];
};

export type ManualEntrySummary = {
  id: number;
  client_id: number;
  client_name: string;
  effective_date: string;
  reason: string;
  reference: string | null;
  source: ManualEntrySource;
  status: ManualEntryStatus;
  total_revenue: number;
  total_hits: number;
  line_count: number;
  api_count: number;
  created_by: number;
  created_by_email: string | null;
  created_at: string;
  approved_by: number | null;
  approved_by_email: string | null;
  approved_at: string | null;
};

export type ManualEntryLine = ManualEntryLineInput & {
  api_name: string;
  hits: number;
  price_successful: number;
  price_successful_no_data: number;
  price_failed: number;
  price_in_progress: number;
  revenue: number;
  has_pricing: boolean;
};

export type ManualEntryDetail = ManualEntrySummary & {
  attachment_path: string | null;
  void_reason: string | null;
  voided_at: string | null;
  voided_by_email: string | null;
  lines: ManualEntryLine[];
};

export function approvalThreshold(): number {
  const raw = process.env.MANUAL_ENTRY_APPROVAL_THRESHOLD;
  if (!raw) return 50_000;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 50_000;
}

type PriceTuple = {
  price_successful: number;
  price_successful_no_data: number;
  price_failed: number;
  price_in_progress: number;
  has_pricing: boolean;
};

const ZERO_PRICE: PriceTuple = {
  price_successful: 0,
  price_successful_no_data: 0,
  price_failed: 0,
  price_in_progress: 0,
  has_pricing: false,
};

export async function previewLines(
  accountId: number,
  effectiveDate: string,
  lines: ManualEntryLineInput[],
  // Callers inside a transaction pass their tx handle so the pricing read
  // shares the transaction's snapshot (createManualEntry relies on this).
  db: Sql | TransactionSql = getSql()
): Promise<ManualEntryLine[]> {
  const sql = db;
  if (lines.length === 0) return [];

  const apiCodes = Array.from(new Set(lines.map((l) => l.api_code)));

  // Two batched lookups instead of 2N round-trips:
  //   1. api names for the distinct codes
  //   2. latest effective pricing per (account, api) on or before the date
  //
  // The pricing query uses DISTINCT ON to pick the most recent
  // effective_from per api_code in a single pass.
  const [apiRows, priceRows] = await Promise.all([
    sql`SELECT product_code, name FROM apis WHERE product_code = ANY(${apiCodes})`,
    sql`
      SELECT DISTINCT ON (api_code)
        api_code,
        price_successful, price_successful_no_data, price_failed, price_in_progress
      FROM pricing
      WHERE client_id = ${accountId}
        AND api_code = ANY(${apiCodes})
        AND effective_from <= ${effectiveDate}
      ORDER BY api_code, effective_from DESC
    `,
  ]);

  const apiNameByCode = new Map(
    (apiRows as any[]).map((r) => [r.product_code as string, r.name as string])
  );
  const priceByCode = new Map<string, PriceTuple>(
    (priceRows as any[]).map((r) => [
      r.api_code as string,
      {
        price_successful: toNumber(r.price_successful),
        price_successful_no_data: toNumber(r.price_successful_no_data),
        price_failed: toNumber(r.price_failed),
        price_in_progress: toNumber(r.price_in_progress),
        has_pricing: true,
      },
    ])
  );

  return lines.map((l) => {
    const pricing = priceByCode.get(l.api_code) ?? ZERO_PRICE;
    const revenue = toMoney(pricing.price_successful).times(l.successful)
      .plus(toMoney(pricing.price_successful_no_data).times(l.successful_no_data))
      .plus(toMoney(pricing.price_failed).times(l.failed))
      .plus(toMoney(pricing.price_in_progress).times(l.in_progress));
    return {
      ...l,
      api_name: apiNameByCode.get(l.api_code) ?? l.api_code,
      hits: l.successful + l.successful_no_data + l.failed + l.in_progress,
      ...pricing,
      revenue: toNumber(revenue),
    };
  });
}

function previewTotal(lines: ManualEntryLine[]): import("decimal.js-light").default {
  return sumMoney(lines.map((l) => l.revenue));
}

export async function listManualEntries(filters?: {
  status?: ManualEntryStatus;
  client_id?: number;
  range?: { from: string; to: string };
}): Promise<ManualEntrySummary[]> {
  const sql = getSql();

  // Tagged fragments keep every value a bound parameter — no sql.unsafe.
  // `WHERE TRUE` lets each optional filter compose as a plain `AND` clause.
  const statusFilter = filters?.status ? sql`AND m.status = ${filters.status}` : sql``;
  const accountFilter = filters?.client_id ? sql`AND m.client_id = ${filters.client_id}` : sql``;
  // Scope by effective_date, but never hide entries awaiting approval — an old
  // pending item still needs an admin decision regardless of the chosen window.
  const rangeFilter = filters?.range
    ? sql`AND ((m.effective_date >= ${filters.range.from} AND m.effective_date <= ${filters.range.to}) OR m.status = 'pending_approval')`
    : sql``;

  const rows = await sql`
    SELECT
      m.id, m.client_id, m.effective_date, m.reason, m.reference,
      m.source, m.status, m.total_revenue, m.created_at,
      m.created_by, m.approved_by, m.approved_at,
      c.display_name AS client_name,
      creator.email   AS created_by_email,
      approver.email  AS approved_by_email,
      COALESCE(line_stats.line_count, 0) AS line_count,
      COALESCE(line_stats.total_hits, 0) AS total_hits,
      COALESCE(line_stats.api_count, 0)  AS api_count
    FROM manual_entries m
    JOIN clients c ON c.id = m.client_id
    LEFT JOIN users creator  ON creator.id  = m.created_by
    LEFT JOIN users approver ON approver.id = m.approved_by
    LEFT JOIN (
      SELECT manual_entry_id,
             COUNT(*) AS line_count,
             COUNT(DISTINCT api_code) AS api_count,
             SUM(successful + successful_no_data + failed + in_progress) AS total_hits
      FROM usage_daily
      WHERE manual_entry_id IS NOT NULL
      GROUP BY manual_entry_id
    ) line_stats ON line_stats.manual_entry_id = m.id
    WHERE TRUE ${statusFilter} ${accountFilter} ${rangeFilter}
    ORDER BY m.created_at DESC`;

  return (rows as any[]).map((r) => ({
    ...r,
    total_revenue: toNumber(r.total_revenue),
    total_hits: Number(r.total_hits ?? 0),
    line_count: Number(r.line_count ?? 0),
    api_count: Number(r.api_count ?? 0),
  }));
}

export async function getManualEntry(id: number): Promise<ManualEntryDetail | null> {
  const sql = getSql();
  const [row] = await sql`
    SELECT m.*, c.display_name AS client_name,
           creator.email  AS created_by_email,
           approver.email AS approved_by_email,
           voider.email   AS voided_by_email
    FROM manual_entries m
    JOIN clients c ON c.id = m.client_id
    LEFT JOIN users creator  ON creator.id  = m.created_by
    LEFT JOIN users approver ON approver.id = m.approved_by
    LEFT JOIN users voider   ON voider.id   = m.voided_by
    WHERE m.id = ${id}
  `;
  if (!row) return null;

  const lineRows = await sql`
    SELECT u.api_code, u.hits_via, u.vendor,
           u.successful, u.successful_no_data, u.failed, u.in_progress,
           a.name AS api_name
    FROM usage_daily u
    LEFT JOIN apis a ON a.product_code = u.api_code
    WHERE u.manual_entry_id = ${id}
    ORDER BY u.id
  `;

  const lines = await previewLines(
    Number((row as any).client_id),
    (row as any).effective_date,
    (lineRows as any[]).map((l) => ({
      api_code: l.api_code,
      hits_via: (l.hits_via as ManualEntryLineInput["hits_via"]) ?? "Bulk",
      vendor: l.vendor ?? null,
      successful: Number(l.successful),
      successful_no_data: Number(l.successful_no_data),
      failed: Number(l.failed),
      in_progress: Number(l.in_progress),
    }))
  );

  const r = row as any;
  return {
    id: Number(r.id),
    client_id: Number(r.client_id),
    client_name: r.client_name,
    effective_date: r.effective_date,
    reason: r.reason,
    reference: r.reference,
    attachment_path: r.attachment_path,
    source: r.source,
    status: r.status,
    total_revenue: toNumber(r.total_revenue),
    total_hits: lines.reduce((s, l) => s + l.hits, 0),
    line_count: lines.length,
    api_count: new Set(lines.map((l) => l.api_code)).size,
    created_by: Number(r.created_by),
    created_by_email: r.created_by_email,
    created_at: r.created_at,
    approved_by: r.approved_by != null ? Number(r.approved_by) : null,
    approved_by_email: r.approved_by_email,
    approved_at: r.approved_at,
    voided_at: r.voided_at,
    voided_by_email: r.voided_by_email,
    void_reason: r.void_reason,
    lines,
  };
}

export async function createManualEntry(
  input: ManualEntryInput,
  userId: number
): Promise<{ id: number; preview_total: number }> {
  const sql = getSql();

  // Pricing read, total computation, and inserts all share one transaction
  // so the persisted total_revenue can't disagree with the usage rows it
  // covers (a pricing edit between preview and insert cannot slip through).
  const { id, total } = await sql.begin(async (sql) => {
    const preview = await previewLines(input.client_id, input.effective_date, input.lines, sql);
    const total = previewTotal(preview);

    const [accountRow] = await sql`SELECT display_name FROM clients WHERE id = ${input.client_id}`;
    if (!accountRow) throw new Error(`unknown client_id ${input.client_id}`);

    const apiCodes = Array.from(new Set(input.lines.map((l) => l.api_code)));
    const apiRows = await sql`SELECT product_code, name FROM apis WHERE product_code = ANY(${apiCodes})`;
    const apiNameByCode = new Map(
      (apiRows as any[]).map((r) => [r.product_code as string, r.name as string])
    );

    const [entryRow] = await sql`
      INSERT INTO manual_entries
        (client_id, effective_date, reason, reference, attachment_path,
         source, import_hash, status, total_revenue, created_by)
      VALUES (
        ${input.client_id}, ${input.effective_date}, ${input.reason},
        ${input.reference}, ${input.attachment_path},
        ${input.source}, ${input.import_hash}, 'draft', ${toDbNumeric(total)}, ${userId}
      )
      RETURNING id
    `;
    const entryId = Number(entryRow.id);

    // A manual entry can name a vendor the sync has never reported. It gets a
    // registry row like any other, inside this transaction so the vendor
    // and the usage that references it commit together.
    const vendors = await resolveVendors(sql, input.lines.map((l) => l.vendor));

    for (const l of input.lines) {
      const apiName = apiNameByCode.get(l.api_code) ?? l.api_code;
      await sql`
        INSERT INTO usage_daily
          (date, client_id, api_code,
           raw_client_name, raw_api_name,
           hits_via, vendor, vendor_id,
           successful, successful_no_data, failed, in_progress,
           source, manual_entry_id)
        VALUES (
          ${input.effective_date}, ${input.client_id}, ${l.api_code},
          ${(accountRow as any).display_name}, ${apiName},
          ${l.hits_via}, ${vendors.get(l.vendor)?.name ?? null},
          ${vendors.get(l.vendor)?.id ?? null},
          ${l.successful}, ${l.successful_no_data}, ${l.failed}, ${l.in_progress},
          ${input.source}, ${entryId}
        )
      `;
    }
    return { id: entryId, total };
  });

  await recordAudit({
    user_id: userId,
    action: "manual_entry.create",
    entity_type: "manual_entry",
    entity_id: String(id),
    after: { ...input, total_revenue: toNumber(total) },
  });
  return { id, preview_total: toNumber(total) };
}

export async function submitManualEntry(id: number, userId: number): Promise<void> {
  const sql = getSql();
  const [before] = await sql`SELECT status FROM manual_entries WHERE id = ${id}`;
  if (!before) throw new Error(`unknown manual_entry ${id}`);
  if (before.status !== "draft") {
    throw new Error(`cannot submit entry in status '${before.status}'`);
  }
  await sql`UPDATE manual_entries SET status = 'pending_approval' WHERE id = ${id}`;
  await recordAudit({
    user_id: userId,
    action: "manual_entry.submit",
    entity_type: "manual_entry",
    entity_id: String(id),
    before: { status: before.status },
    after: { status: "pending_approval" },
  });
}

export async function approveManualEntry(id: number, userId: number): Promise<void> {
  const sql = getSql();
  const [before] = await sql`SELECT status, total_revenue FROM manual_entries WHERE id = ${id}`;
  if (!before) throw new Error(`unknown manual_entry ${id}`);
  if (before.status === "approved" || before.status === "void") {
    throw new Error(`cannot approve entry in status '${before.status}'`);
  }
  await sql`
    UPDATE manual_entries
    SET status = 'approved', approved_by = ${userId}, approved_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
  await recordAudit({
    user_id: userId,
    action: "manual_entry.approve",
    entity_type: "manual_entry",
    entity_id: String(id),
    before: { status: before.status },
    after: { status: "approved", total_revenue: toNumber(before.total_revenue) },
  });
}

/** Thrown when a void would erase usage_daily rows that are already
 *  referenced by a finalized or issued statement. */
export class ManualEntryLockedError extends Error {
  constructor(public statementNumber: string) {
    super(`covered by finalized invoice ${statementNumber}`);
  }
}

export async function voidManualEntry(
  id: number,
  userId: number,
  reason: string
): Promise<void> {
  const sql = getSql();
  const [before] = await sql`
    SELECT status, total_revenue, client_id, effective_date FROM manual_entries WHERE id = ${id}
  `;
  if (!before) throw new Error(`unknown manual_entry ${id}`);
  if (before.status === "void") return;

  // If this entry's effective_date falls inside any finalized/issued
  // statement period for the same account, voiding would delete usage rows
  // that the statement was generated against — silently changing the
  // historical record behind a billed invoice. Refuse.
  const [locking] = await sql`
    SELECT s.number
    FROM statements s
    JOIN billing_periods bp ON bp.id = s.period_id
    WHERE s.client_id = ${before.client_id}
      AND s.status IN ('final', 'issued')
      AND ${before.effective_date}::date BETWEEN bp.start_date AND bp.end_date
    LIMIT 1
  `;
  if (locking) {
    throw new ManualEntryLockedError((locking as any).number);
  }

  await sql.begin(async (sql) => {
    await sql`DELETE FROM usage_daily WHERE manual_entry_id = ${id}`;
    await sql`
      UPDATE manual_entries
      SET status = 'void', voided_by = ${userId}, voided_at = NOW(), void_reason = ${reason}
      WHERE id = ${id}
    `;
  });

  await recordAudit({
    user_id: userId,
    action: "manual_entry.void",
    entity_type: "manual_entry",
    entity_id: String(id),
    before: { status: before.status, total_revenue: toNumber(before.total_revenue) },
    after: { status: "void", void_reason: reason },
  });
}

export async function findEntryByImportHash(hash: string): Promise<{ id: number } | null> {
  const sql = getSql();
  const [row] = await sql`SELECT id FROM manual_entries WHERE import_hash = ${hash}`;
  return row ? { id: Number((row as any).id) } : null;
}
