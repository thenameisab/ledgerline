// Billing artifacts — invoices (statements) and periods.

import type postgres from "postgres";
import getSql from "../db";
import { getAccount } from "./accounts";
import { recordAudit } from "./audit";
import { getEffectiveSlabSchedules } from "./pricing";
import { slabRevenueByPeriod } from "./slab-revenue";
import {
  anyVendorVolumePricing,
  vendorVolumeCostByApi,
  vendorVolumeCostByDate,
  vendorVolumeUnitCostsByApi,
  type UnitCostNumbers,
} from "./vendor-volume-cost";
import { resolveSandboxCaps, billedSandboxHits } from "./sandbox-billing";
import { computeVolumeRevenue } from "../pricing/slabs";
import { toMoney, sumMoney, toDbNumeric, toNumber, marginPct, ZERO } from "../money";
import { costConfidenceLive } from "./vendor-cost";
import type { CostConfidence } from "../vendor-confidence";

export type StatementStatus = "draft" | "final" | "issued";

export type BillingPeriod = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  status: "open" | "closed";
  closed_at: string | null;
  closed_by: number | null;
};

export type StatementLine = {
  api_code: string;
  api_name: string;
  successful: number;
  successful_no_data: number;
  failed: number;
  in_progress: number;
  hits: number;
  price_successful: number;
  price_successful_no_data: number;
  price_failed: number;
  price_in_progress: number;
  vendor_cost: number;
  revenue: number;
  margin: number;
  margin_pct: number;
  /**
   * True when any rate row behind this line is not `contracted` — including a
   * missing rate row. Drives the "Est." chip on internal exports.
   */
  vendor_estimated: boolean;
  /** Stitched-bundle line: api_name is the stitch name, api_code the anchor; hits are stitched calls. */
  is_bundle: boolean;
};

export type StatementHeader = {
  number: string;
  status: StatementStatus;
  generated_at: string;
  issued_at: string | null;
  account: {
    id: number;
    display_name: string;
    billing_entity: string | null;
    gstin: string | null;
    group_name: string | null;
  };
  period: BillingPeriod;
};

export type StatementTotals = {
  revenue: number;
  vendor_cost: number;
  margin: number;
  margin_pct: number;
  hits: number;
  lines: number;
  adjustments_total: number;
  grand_total: number;
};

export type StatementAdjustment = {
  id: number;
  label: string;
  amount: number;
  notes: string | null;
  created_at: string;
  created_by: number;
  created_by_email: string | null;
};

export type StatementData = {
  header: StatementHeader;
  lines: StatementLine[];
  adjustments: StatementAdjustment[];
  totals: StatementTotals;
  /**
   * How well the vendor cost on this invoice was measured.
   *
   * On a draft it is computed live, over the same rows the lines were. On a
   * finalized invoice it is the copy frozen at finalize: a
   * live figure beside a frozen cost would describe today's rates against a
   * number computed from the rates in force when it was cut.
   *
   * Null only on an invoice finalized before the snapshot column existed.
   */
  cost_confidence: CostConfidence | null;
};

// billing_periods.id is int8, which postgres.js hands back as a JS *string*.
// BillingPeriod.id is typed `number`, and callers key Maps on it via
// Number(period_id) while looking up with the raw value — a string/number
// mismatch silently misses. Coerce to a real number here so the type holds.
export async function listBillingPeriods(): Promise<BillingPeriod[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM billing_periods ORDER BY start_date DESC`;
  return (rows as any[]).map((r) => ({ ...r, id: Number(r.id) })) as BillingPeriod[];
}

export async function getBillingPeriod(id: number): Promise<BillingPeriod | undefined> {
  const sql = getSql();
  const [row] = await sql`SELECT * FROM billing_periods WHERE id = ${id}`;
  return row ? ({ ...row, id: Number(row.id) } as BillingPeriod) : undefined;
}

function draftStatementNumber(accountId: number, period: BillingPeriod): string {
  const [yyyy, mm] = period.start_date.split("-");
  return `LL-DRAFT-${yyyy}${mm}-${String(accountId).padStart(4, "0")}`;
}

async function allocateInvoiceNumber(
  sql: postgres.Sql | postgres.TransactionSql,
  period: BillingPeriod
): Promise<string> {
  // One round-trip, atomic. Takes the row-level lock from the UPDATE side
  // of the upsert, so two concurrent finalizers serialize on this row
  // instead of racing across three statements. RETURNING gives us the
  // post-increment value without a second SELECT.
  const year = Number(period.start_date.slice(0, 4));
  const [row] = await sql`
    INSERT INTO invoice_sequence (year, last_seq)
    VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE
      SET last_seq = invoice_sequence.last_seq + 1
    RETURNING last_seq
  `;
  return `LL-${year}-${String(row.last_seq).padStart(4, "0")}`;
}

export async function deriveStatement(
  accountId: number,
  periodId: number
): Promise<StatementData | null> {
  const sql = getSql();
  const [account, period] = await Promise.all([
    getAccount(accountId),
    getBillingPeriod(periodId),
  ]);
  if (!account || !period) return null;

  const [snapshot] = await sql`
    SELECT * FROM statements WHERE client_id = ${accountId} AND period_id = ${periodId}
  `;

  const headerCore = {
    account: {
      id: account.id,
      display_name: account.display_name,
      billing_entity: account.billing_entity ?? null,
      gstin: account.gstin ?? null,
      group_name: account.group_name ?? null,
    },
    period,
  };

  if (snapshot && snapshot.status !== "draft") {
    const snapLines = await sql`
      SELECT api_code, api_name, successful, successful_no_data, failed, in_progress,
             price_successful, price_successful_no_data, price_failed, price_in_progress,
             vendor_cost, revenue, margin, is_bundle, vendor_estimated
      FROM statement_lines WHERE statement_id = ${snapshot.id}
      ORDER BY revenue DESC, (successful + successful_no_data + failed + in_progress) DESC
    `;
    const lines: StatementLine[] = (snapLines as any[]).map((l) => ({
      api_code: l.api_code,
      api_name: l.api_name,
      successful: Number(l.successful),
      successful_no_data: Number(l.successful_no_data),
      failed: Number(l.failed),
      in_progress: Number(l.in_progress),
      hits: Number(l.successful) + Number(l.successful_no_data) + Number(l.failed) + Number(l.in_progress),
      price_successful: toNumber(l.price_successful),
      price_successful_no_data: toNumber(l.price_successful_no_data),
      price_failed: toNumber(l.price_failed),
      price_in_progress: toNumber(l.price_in_progress),
      vendor_cost: toNumber(l.vendor_cost),
      revenue: toNumber(l.revenue),
      margin: toNumber(l.margin),
      margin_pct: marginPct(l.margin, l.revenue),
      // Frozen at finalize, so a finalized invoice keeps its estimated flag.
      vendor_estimated: !!l.vendor_estimated,
      is_bundle: !!Number(l.is_bundle),
    }));
    const adjustments = await listStatementAdjustments(Number(snapshot.id));
    const adjustmentsTotal = sumMoney(adjustments.map((a) => a.amount));
    const snapRevenue = toMoney(snapshot.total_revenue);
    const snapMargin = toMoney(snapshot.total_margin);
    const totals: StatementTotals = {
      revenue: toNumber(snapRevenue),
      vendor_cost: toNumber(snapshot.total_vendor_cost),
      margin: toNumber(snapMargin),
      margin_pct: marginPct(snapMargin, snapRevenue),
      hits: Number(snapshot.total_hits ?? 0),
      lines: lines.length,
      adjustments_total: toNumber(adjustmentsTotal),
      grand_total: toNumber(snapRevenue.plus(adjustmentsTotal)),
    };
    return {
      header: {
        ...headerCore,
        number: snapshot.number,
        status: snapshot.status as StatementStatus,
        generated_at: snapshot.generated_at ?? new Date().toISOString(),
        issued_at: snapshot.issued_at ?? null,
      },
      lines,
      adjustments,
      totals,
      // The copy taken when this invoice was cut, not a fresh reading. Null
      // only for an invoice finalized before the snapshot columns existed.
      cost_confidence:
        snapshot.cost_hits == null
          ? null
          : {
              hits: Number(snapshot.cost_hits),
              contracted: Number(snapshot.cost_contracted ?? 0),
              quoted: Number(snapshot.cost_quoted ?? 0),
              estimated: Number(snapshot.cost_estimated ?? 0),
              not_billed: Number(snapshot.cost_not_billed ?? 0),
              unknown: Number(snapshot.cost_unknown ?? 0),
            },
    };
  }

  // Draft path: compute live from the view. Usage billed through a stitched
  // bundle collapses into ONE line keyed on the bundle: the line carries the
  // stitch name, the anchor's hit counts (those are the stitched calls the
  // price applies to) and the vendor cost of ALL members (the true delivery
  // cost). Member APIs never appear as their own ₹0 lines. Usage from before
  // the stitch's effective date (bundle_applied = 0) still groups per API —
  // it really was billed individually.
  // Production lines only. Sandbox hits are billed separately below, capped
  // per (account, api) via sandbox_billing_rules — see the merge step after the
  // line assembly.
  const rows = await sql`
    SELECT
      CASE WHEN v.bundle_applied = 1 THEN 'bundle:' || v.bundle_id::text
           ELSE 'api:' || v.api_code END AS line_key,
      MAX(CASE WHEN v.bundle_applied = 1 THEN v.bundle_name END) AS bundle_name,
      MAX(CASE WHEN v.bundle_applied = 1 AND v.bundle_anchor = 1 THEN v.api_code END) AS anchor_api_code,
      MAX(v.api_code) AS api_code,
      MAX(v.api_name) AS api_name,
      SUM(CASE WHEN v.bundle_applied = 0 OR v.bundle_anchor = 1 THEN v.successful ELSE 0 END)         AS successful,
      SUM(CASE WHEN v.bundle_applied = 0 OR v.bundle_anchor = 1 THEN v.successful_no_data ELSE 0 END) AS successful_no_data,
      SUM(CASE WHEN v.bundle_applied = 0 OR v.bundle_anchor = 1 THEN v.failed ELSE 0 END)             AS failed,
      SUM(CASE WHEN v.bundle_applied = 0 OR v.bundle_anchor = 1 THEN v.in_progress ELSE 0 END)        AS in_progress,
      SUM(v.revenue)            AS revenue,
      SUM(v.vendor_cost)        AS vendor_cost,
      MAX(v.p_s)   AS p_s,
      MAX(v.p_snd) AS p_snd,
      MAX(v.p_f)   AS p_f,
      MAX(v.p_ip)  AS p_ip,
      -- Same confirmed rule as lib/vendor-confidence: contracted or quoted is a
      -- rate the vendor gave us; anything else is ours or missing.
      MAX(CASE WHEN COALESCE(v.vendor_cost_status, 'unrated') NOT IN ('contracted', 'quoted') THEN 1 ELSE 0 END) AS vendor_estimated
    FROM usage_daily_with_revenue v
    WHERE v.client_id = ${accountId} AND v.date BETWEEN ${period.start_date} AND ${period.end_date}
      AND COALESCE(v.effective_is_sandbox, 0) = 0
    GROUP BY line_key
    HAVING (SUM(v.successful) + SUM(v.successful_no_data) + SUM(v.failed) + SUM(v.in_progress)) > 0
    ORDER BY revenue DESC,
             (SUM(v.successful) + SUM(v.successful_no_data) + SUM(v.failed) + SUM(v.in_progress)) DESC
  `;

  // Decimal-typed lines for exact aggregation. We expose `number` on the
  // StatementLine interface for UI compatibility, but totals are computed
  // by summing the *Decimal* revenue/vendor_cost/margin and only then
  // converted at the boundary — that's the value persisted on finalize.
  const decimalLines = (rows as any[]).map((r) => {
    const isBundle = r.bundle_name != null;
    const successful = Number(r.successful ?? 0);
    const successful_no_data = Number(r.successful_no_data ?? 0);
    const failed = Number(r.failed ?? 0);
    const in_progress = Number(r.in_progress ?? 0);
    const hits = successful + successful_no_data + failed + in_progress;
    const revenue = toMoney(r.revenue);
    const vendor_cost = toMoney(r.vendor_cost);
    const margin = revenue.minus(vendor_cost);
    return {
      // Bundle lines keep the anchor's api_code so isBilledPair locks the
      // stitch once invoiced; the displayed name is the stitch name.
      api_code: (isBundle ? r.anchor_api_code ?? r.api_code : r.api_code) as string,
      api_name: (isBundle ? r.bundle_name : r.api_name ?? r.api_code) as string,
      is_bundle: isBundle,
      successful,
      successful_no_data,
      failed,
      in_progress,
      hits,
      price_successful: toMoney(r.p_s),
      price_successful_no_data: toMoney(r.p_snd),
      price_failed: toMoney(r.p_f),
      price_in_progress: toMoney(r.p_ip),
      vendor_cost,
      revenue,
      margin,
      vendor_estimated: !!Number(r.vendor_estimated),
    };
  });

  // Volume-priced (slab/tier) vendor rates cost ₹0 in the per-day view: a
  // month's bracket cannot be resolved one day at a time, so those pairs keep
  // their flat cost columns at 0. Add the real cost back — the month's whole
  // volume across every account picks the bracket (that is what the vendor
  // invoices), and this account pays for the hits it sent at the resulting
  // blended rate. Bundled usage folds onto the bundle line, which already
  // carries its members' vendor cost. `vendorVolumeUnitCostsByApi` is kept for
  // the sandbox tail below, where only some of the hits are billed.
  const lineByKey = new Map<string, (typeof decimalLines)[number]>();
  (rows as any[]).forEach((r, i) => lineByKey.set(r.line_key as string, decimalLines[i]));
  let volumeUnitCost = new Map<string, UnitCostNumbers>();
  if (await anyVendorVolumePricing()) {
    const window = { from: period.start_date, to: period.end_date, clientId: accountId };
    const [volByApi, volUnit, memberRows] = await Promise.all([
      vendorVolumeCostByApi(window),
      vendorVolumeUnitCostsByApi({ ...window, includeSandbox: true }),
      sql`
        SELECT v.api_code,
               CASE WHEN v.bundle_applied = 1 THEN 'bundle:' || v.bundle_id::text
                    ELSE 'api:' || v.api_code END AS line_key
        FROM usage_daily_with_revenue v
        WHERE v.client_id = ${accountId}
          AND v.date BETWEEN ${period.start_date} AND ${period.end_date}
          AND COALESCE(v.effective_is_sandbox, 0) = 0
          AND v.vendor_cost_model IN ('slab', 'tier')
        GROUP BY 1, 2
      `,
    ]);
    volumeUnitCost = volUnit;
    const keyOfApi = new Map(
      (memberRows as any[]).map((r) => [r.api_code as string, r.line_key as string])
    );
    for (const [apiCode, cost] of volByApi) {
      const line = lineByKey.get(keyOfApi.get(apiCode) ?? `api:${apiCode}`);
      if (!line) continue;
      line.vendor_cost = line.vendor_cost.plus(toMoney(cost));
      line.margin = line.revenue.minus(line.vendor_cost);
    }
  }

  // Bill sandbox successful hits, capped per (account, api) via
  // sandbox_billing_rules (null = all, 0 = none, N = up to N). Added to the
  // matching production line, or a new line for sandbox-only APIs, BEFORE the
  // slab recompute so volume-priced APIs count billed sandbox toward volume.
  // Bundle-applied sandbox usage is out of scope (rare); only unbundled rows.
  const sbRows = await sql`
    SELECT v.api_code,
           SUM(v.successful) AS sandbox_successful,
           MAX(v.p_s) AS p_s, MAX(v.c_s) AS c_s, MAX(v.api_name) AS api_name,
           -- Same confirmed rule as lib/vendor-confidence.
           MAX(CASE WHEN COALESCE(v.vendor_cost_status, 'unrated') NOT IN ('contracted', 'quoted') THEN 1 ELSE 0 END) AS vendor_estimated,
           -- A vendor that does not charge for sandbox contributes no
           -- cost here. c_s is already 0 for such a row, but a volume-priced
           -- pair's cost comes from the blended rate below, which knows
           -- nothing about sandbox. MAX, not BOOL_AND: where two vendors serve
           -- one API and only one of them bills sandbox, charging is the
           -- safer error.
           MAX(CASE WHEN v.vendor_billable THEN 1 ELSE 0 END) AS vendor_billable
    FROM usage_daily_with_revenue v
    WHERE v.client_id = ${accountId} AND v.date BETWEEN ${period.start_date} AND ${period.end_date}
      AND COALESCE(v.effective_is_sandbox, 0) = 1
      AND v.api_code IS NOT NULL AND v.bundle_applied = 0
    GROUP BY v.api_code
    HAVING SUM(v.successful) > 0
  `;
  if ((sbRows as any[]).length > 0) {
    const capFor = await resolveSandboxCaps(accountId, period.end_date);
    const lineByApi = new Map(decimalLines.filter((l) => !l.is_bundle).map((l) => [l.api_code, l]));
    for (const r of sbRows as any[]) {
      const billed = billedSandboxHits(Number(r.sandbox_successful ?? 0), capFor(r.api_code));
      if (billed <= 0) continue;
      const p_s = toMoney(r.p_s);
      const addRevenue = p_s.times(billed);
      // c_s is 0 for a volume-priced pair — its cost is the month's blended
      // rate, which only the volume module knows. One of the two is always 0.
      const addCost = toMoney(r.c_s)
        .plus(
          Number(r.vendor_billable ?? 1) === 1
            ? toMoney(volumeUnitCost.get(r.api_code as string)?.successful ?? 0)
            : ZERO,
        )
        .times(billed);
      const existing = lineByApi.get(r.api_code as string);
      if (existing) {
        existing.successful += billed;
        existing.hits += billed;
        existing.revenue = existing.revenue.plus(addRevenue);
        existing.vendor_cost = existing.vendor_cost.plus(addCost);
        existing.margin = existing.revenue.minus(existing.vendor_cost);
      } else {
        const newLine = {
          api_code: r.api_code as string,
          api_name: (r.api_name ?? r.api_code) as string,
          is_bundle: false,
          successful: billed,
          successful_no_data: 0,
          failed: 0,
          in_progress: 0,
          hits: billed,
          price_successful: p_s,
          price_successful_no_data: ZERO,
          price_failed: ZERO,
          price_in_progress: ZERO,
          vendor_cost: addCost,
          revenue: addRevenue,
          margin: addRevenue.minus(addCost),
          vendor_estimated: !!Number(r.vendor_estimated),
        };
        decimalLines.push(newLine);
        lineByApi.set(newLine.api_code, newLine);
      }
    }
  }

  // Volume-priced (slab/tier) APIs price on the period's TOTAL hits, so the
  // per-day view can't compute them — it yields 0 (their flat columns are 0).
  // Recompute those lines here from the period's outcome totals. Bundles are
  // priced separately and are never volume-priced. Priced as of period end.
  const slabSchedules = await getEffectiveSlabSchedules(accountId, period.end_date);
  if (slabSchedules.size > 0) {
    for (const l of decimalLines) {
      if (l.is_bundle) continue;
      const schedule = slabSchedules.get(l.api_code);
      if (!schedule) continue;
      const { revenue, effective } = computeVolumeRevenue(
        schedule.model,
        {
          successful: l.successful,
          successful_no_data: l.successful_no_data,
          failed: l.failed,
          in_progress: l.in_progress,
        },
        schedule.slabs
      );
      l.revenue = revenue;
      l.margin = revenue.minus(l.vendor_cost);
      l.price_successful = effective.price_successful;
      l.price_successful_no_data = effective.price_successful_no_data;
      l.price_failed = effective.price_failed;
      l.price_in_progress = effective.price_in_progress;
    }
    // Revenue changed — restore the highest-revenue-first ordering the
    // snapshot path also uses, so draft and finalized invoices match.
    decimalLines.sort((a, b) => b.revenue.minus(a.revenue).toNumber() || b.hits - a.hits);
  }

  const totalRevenue = sumMoney(decimalLines.map((l) => l.revenue));
  const totalVendorCost = sumMoney(decimalLines.map((l) => l.vendor_cost));
  const totalMargin = totalRevenue.minus(totalVendorCost);
  const totalHits = decimalLines.reduce((s, l) => s + l.hits, 0);

  const lines: StatementLine[] = decimalLines.map((l) => ({
    api_code: l.api_code,
    api_name: l.api_name,
    is_bundle: l.is_bundle,
    successful: l.successful,
    successful_no_data: l.successful_no_data,
    failed: l.failed,
    in_progress: l.in_progress,
    hits: l.hits,
    price_successful: toNumber(l.price_successful),
    price_successful_no_data: toNumber(l.price_successful_no_data),
    price_failed: toNumber(l.price_failed),
    price_in_progress: toNumber(l.price_in_progress),
    vendor_cost: toNumber(l.vendor_cost),
    revenue: toNumber(l.revenue),
    margin: toNumber(l.margin),
    margin_pct: marginPct(l.margin, l.revenue),
    vendor_estimated: l.vendor_estimated,
  }));

  const totals: StatementTotals = {
    revenue: toNumber(totalRevenue),
    vendor_cost: toNumber(totalVendorCost),
    margin: toNumber(totalMargin),
    margin_pct: marginPct(totalMargin, totalRevenue),
    hits: totalHits,
    lines: lines.length,
    adjustments_total: 0,
    grand_total: toNumber(totalRevenue),
  };
  // Stash exact decimal totals on the result for finalizeStatement.
  (totals as any).__exact = { totalRevenue, totalVendorCost, totalMargin };
  (lines as any).__exact = decimalLines;

  // Measured over the production rows the lines were built from — the same
  // filter, so the coverage figure describes the cost it sits beside. The
  // capped sandbox tail is billed separately and is a rounding error against
  // a month's production traffic.
  const confidence = await costConfidenceLive({
    clientId: accountId,
    from: period.start_date,
    to: period.end_date,
    includeSandbox: false,
  });

  return {
    header: {
      ...headerCore,
      number: (snapshot as any)?.number ?? draftStatementNumber(accountId, period),
      status: ((snapshot as any)?.status ?? "draft") as StatementStatus,
      generated_at: (snapshot as any)?.generated_at ?? new Date().toISOString(),
      issued_at: (snapshot as any)?.issued_at ?? null,
    },
    lines,
    adjustments: [],
    totals,
    cost_confidence: confidence,
  };
}

// ─── Finalize / Issue / billed-pair lookup ────────────────────────────────────

export class StatementError extends Error {
  code:
    | "not_found"
    | "already_final"
    | "not_final"
    | "no_lines"
    | "already_issued"
    | "invalid"
    | "locked";
  constructor(message: string, code: StatementError["code"]) {
    super(message);
    this.code = code;
  }
}

export async function finalizeStatement(
  accountId: number,
  periodId: number,
  userId: number
): Promise<StatementData> {
  const sql = getSql();
  const draft = await deriveStatement(accountId, periodId);
  if (!draft) throw new StatementError("account or period not found", "not_found");
  if (draft.header.status !== "draft") {
    throw new StatementError("invoice is already finalized", "already_final");
  }
  if (draft.lines.length === 0) {
    throw new StatementError("no billable activity in this period", "no_lines");
  }

  // Exact Decimal totals stashed by deriveStatement's draft path. We write
  // these as fixed-precision strings to NUMERIC(14,4) so the persisted
  // invoice total is bit-exact with what the admin saw on screen.
  const exactTotals = (draft.totals as any).__exact as
    | { totalRevenue: ReturnType<typeof toMoney>; totalVendorCost: ReturnType<typeof toMoney>; totalMargin: ReturnType<typeof toMoney> }
    | undefined;
  const exactLines = (draft.lines as any).__exact as Array<{
    revenue: ReturnType<typeof toMoney>;
    vendor_cost: ReturnType<typeof toMoney>;
    margin: ReturnType<typeof toMoney>;
    price_successful: ReturnType<typeof toMoney>;
    price_successful_no_data: ReturnType<typeof toMoney>;
    price_failed: ReturnType<typeof toMoney>;
    price_in_progress: ReturnType<typeof toMoney>;
  }> | undefined;

  // Frozen with the cost, from the same read the draft showed. After this the
  // invoice states how well its cost was measured on the day it was cut, not
  // how well the rates happen to be known now.
  const c = draft.cost_confidence;

  await sql.begin(async (sql) => {
    const number = await allocateInvoiceNumber(sql, draft.header.period);
    const now = new Date().toISOString();
    const [stmtRow] = await sql`
      INSERT INTO statements (
        client_id, period_id, number, status,
        total_revenue, total_vendor_cost, total_margin, total_hits,
        cost_hits, cost_contracted, cost_quoted, cost_estimated,
        cost_not_billed, cost_unknown,
        generated_at, generated_by
      ) VALUES (
        ${accountId}, ${periodId}, ${number}, 'final',
        ${exactTotals ? toDbNumeric(exactTotals.totalRevenue) : toDbNumeric(draft.totals.revenue)},
        ${exactTotals ? toDbNumeric(exactTotals.totalVendorCost) : toDbNumeric(draft.totals.vendor_cost)},
        ${exactTotals ? toDbNumeric(exactTotals.totalMargin) : toDbNumeric(draft.totals.margin)},
        ${draft.totals.hits},
        ${c?.hits ?? null}, ${c?.contracted ?? null}, ${c?.quoted ?? null},
        ${c?.estimated ?? null}, ${c?.not_billed ?? null}, ${c?.unknown ?? null},
        ${now}, ${userId}
      ) RETURNING id
    `;
    const statementId = Number(stmtRow.id);
    for (let i = 0; i < draft.lines.length; i++) {
      const l = draft.lines[i];
      const e = exactLines?.[i];
      await sql`
        INSERT INTO statement_lines (
          statement_id, api_code, api_name, is_bundle,
          successful, successful_no_data, failed, in_progress,
          price_successful, price_successful_no_data, price_failed, price_in_progress,
          vendor_cost, revenue, margin, vendor_estimated
        ) VALUES (
          ${statementId}, ${l.api_code}, ${l.api_name}, ${l.is_bundle ? 1 : 0},
          ${l.successful}, ${l.successful_no_data}, ${l.failed}, ${l.in_progress},
          ${toDbNumeric(e?.price_successful ?? l.price_successful)},
          ${toDbNumeric(e?.price_successful_no_data ?? l.price_successful_no_data)},
          ${toDbNumeric(e?.price_failed ?? l.price_failed)},
          ${toDbNumeric(e?.price_in_progress ?? l.price_in_progress)},
          ${toDbNumeric(e?.vendor_cost ?? l.vendor_cost)},
          ${toDbNumeric(e?.revenue ?? l.revenue)},
          ${toDbNumeric(e?.margin ?? l.margin)},
          ${l.vendor_estimated}
        )
      `;
    }
    await recordAudit({
      user_id: userId,
      action: "invoice.finalize",
      entity_type: "invoice",
      entity_id: String(number),
      before: null,
      after: {
        client_id: accountId,
        period_id: periodId,
        number,
        totals: draft.totals,
        line_count: draft.lines.length,
      },
    });
  });

  const finalized = await deriveStatement(accountId, periodId);
  if (!finalized) throw new StatementError("post-finalize read failed", "not_found");
  return finalized;
}

export async function issueStatement(
  accountId: number,
  periodId: number,
  userId: number
): Promise<StatementData> {
  const sql = getSql();
  // Read + state-check + update all run under a row-level lock so two
  // concurrent Issue clicks can't both reach the UPDATE — the second one
  // will block on the lock, then see status='issued' and reject.
  const { existing, now } = await sql.begin(async (tx) => {
    const [existing] = await tx`
      SELECT id, number, status FROM statements
      WHERE client_id = ${accountId} AND period_id = ${periodId}
      FOR UPDATE
    `;
    if (!existing) throw new StatementError("invoice not finalized yet", "not_final");
    if (existing.status === "draft") {
      throw new StatementError("invoice must be finalized before issuing", "not_final");
    }
    if (existing.status === "issued") {
      throw new StatementError("invoice is already issued", "already_issued");
    }
    const now = new Date().toISOString();
    await tx`
      UPDATE statements SET status = 'issued', issued_at = ${now}, issued_by = ${userId}
      WHERE id = ${existing.id}
    `;
    return { existing, now };
  });

  await recordAudit({
    user_id: userId,
    action: "invoice.issue",
    entity_type: "invoice",
    entity_id: existing.number,
    before: { status: existing.status },
    after: { status: "issued", issued_at: now },
  });
  const issued = await deriveStatement(accountId, periodId);
  if (!issued) throw new StatementError("post-issue read failed", "not_found");
  return issued;
}

export async function isBilledPair(accountId: number, apiCode: string): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql`
    SELECT 1 FROM statement_lines sl
    JOIN statements s ON s.id = sl.statement_id
    WHERE s.client_id = ${accountId} AND sl.api_code = ${apiCode}
      AND s.status IN ('final','issued')
    LIMIT 1
  `;
  return !!row;
}

export type StatementSummary = {
  period: BillingPeriod;
  status: StatementStatus;
  totals: StatementTotals;
  hasSnapshot: boolean;
};

export async function listAccountStatements(accountId: number): Promise<StatementSummary[]> {
  const sql = getSql();
  const periods = await listBillingPeriods();
  if (periods.length === 0) return [];

  // Old code called deriveStatement (3+ queries) per period — ~3N round
  // trips. Now: one query for snapshots, one query for draft aggregates
  // grouped by period via a `usage_daily_with_revenue` × periods join.
  const periodIds = periods.map((p) => p.id);
  const slabByPeriod = await slabRevenueByPeriod(accountId, periods);

  // The mirror of slabByPeriod on the cost side: a volume-priced vendor rate is
  // ₹0 in the per-day view. Read per day over the whole span in one call and
  // bucket into periods, rather than one call per period.
  const spanFrom = periods.reduce((m, p) => (p.start_date < m ? p.start_date : m), periods[0].start_date);
  const spanTo = periods.reduce((m, p) => (p.end_date > m ? p.end_date : m), periods[0].end_date);
  const volumeByDate = await vendorVolumeCostByDate({
    clientId: accountId,
    from: spanFrom,
    to: spanTo,
  });
  const volumeByPeriod = new Map<number, number>();
  if (volumeByDate.size > 0) {
    for (const p of periods) {
      let total = 0;
      for (const [date, cost] of volumeByDate) {
        if (date >= p.start_date && date <= p.end_date) total += cost;
      }
      if (total > 0) volumeByPeriod.set(p.id, total);
    }
  }
  const [snapshotRows, draftRows, adjustmentRows] = await Promise.all([
    sql`
      SELECT period_id, id, number, status,
             total_revenue, total_vendor_cost, total_margin, total_hits
      FROM statements
      WHERE client_id = ${accountId} AND period_id = ANY(${periodIds})
    `,
    // Live draft aggregates for periods that have no snapshot yet (or whose
    // snapshot is still 'draft'). We compute everything; the assemble step
    // below picks snapshot or draft per period.
    sql`
      SELECT bp.id AS period_id,
             COALESCE(SUM(v.revenue), 0)     AS revenue,
             COALESCE(SUM(v.vendor_cost), 0) AS vendor_cost,
             COALESCE(SUM(v.successful + v.successful_no_data + v.failed + v.in_progress), 0) AS hits,
             COUNT(DISTINCT v.api_code)      AS lines
      FROM billing_periods bp
      LEFT JOIN usage_daily_with_revenue v
        ON v.client_id = ${accountId}
       AND v.date BETWEEN bp.start_date AND bp.end_date
       AND COALESCE(v.effective_is_sandbox, 0) = 0
      WHERE bp.id = ANY(${periodIds})
      GROUP BY bp.id
    `,
    sql`
      SELECT s.period_id, COALESCE(SUM(sa.amount), 0) AS adjustments_total
      FROM statements s
      LEFT JOIN statement_adjustments sa ON sa.statement_id = s.id
      WHERE s.client_id = ${accountId} AND s.period_id = ANY(${periodIds})
      GROUP BY s.period_id
    `,
  ]);

  const snapshotByPeriod = new Map<number, any>(
    (snapshotRows as any[]).map((r) => [Number(r.period_id), r])
  );
  const draftByPeriod = new Map<number, any>(
    (draftRows as any[]).map((r) => [Number(r.period_id), r])
  );
  const adjustmentsByPeriod = new Map<number, import("decimal.js-light").default>(
    (adjustmentRows as any[]).map((r) => [Number(r.period_id), toMoney(r.adjustments_total)])
  );

  // Billed sandbox per period, capped per (account, api) — mirrors deriveStatement
  // so the list total matches the opened draft. Slab sandbox reads ₹0 here (the
  // view prices it at 0); deriveStatement is authoritative for that rare case.
  const sbRows = await sql`
    SELECT bp.id AS period_id, v.api_code,
           SUM(v.successful) AS s, MAX(v.p_s) AS p_s, MAX(v.c_s) AS c_s
    FROM billing_periods bp
    JOIN usage_daily_with_revenue v
      ON v.client_id = ${accountId} AND v.date BETWEEN bp.start_date AND bp.end_date
    WHERE bp.id = ANY(${periodIds})
      AND COALESCE(v.effective_is_sandbox, 0) = 1
      AND v.api_code IS NOT NULL AND v.bundle_applied = 0
    GROUP BY bp.id, v.api_code
    HAVING SUM(v.successful) > 0
  `;
  const sandboxByPeriod = new Map<
    number,
    { revenue: import("decimal.js-light").default; vendor_cost: import("decimal.js-light").default; hits: number }
  >();
  if ((sbRows as any[]).length > 0) {
    const capByPeriod = new Map<number, (apiCode: string | null) => number | null>();
    for (const p of periods) capByPeriod.set(p.id, await resolveSandboxCaps(accountId, p.end_date));
    for (const r of sbRows as any[]) {
      const pid = Number(r.period_id);
      const billed = billedSandboxHits(Number(r.s ?? 0), capByPeriod.get(pid)!(r.api_code as string));
      if (billed <= 0) continue;
      const acc = sandboxByPeriod.get(pid) ?? { revenue: ZERO, vendor_cost: ZERO, hits: 0 };
      acc.revenue = acc.revenue.plus(toMoney(r.p_s).times(billed));
      acc.vendor_cost = acc.vendor_cost.plus(toMoney(r.c_s).times(billed));
      acc.hits += billed;
      sandboxByPeriod.set(pid, acc);
    }
  }

  return periods.map((period) => {
    const snap = snapshotByPeriod.get(period.id);
    const draft = draftByPeriod.get(period.id);
    const adjTotal = adjustmentsByPeriod.get(period.id) ?? ZERO;

    if (snap && snap.status !== "draft") {
      const revenue = toMoney(snap.total_revenue);
      const margin = toMoney(snap.total_margin);
      const totals: StatementTotals = {
        revenue: toNumber(revenue),
        vendor_cost: toNumber(snap.total_vendor_cost),
        margin: toNumber(margin),
        margin_pct: marginPct(margin, revenue),
        hits: Number(snap.total_hits ?? 0),
        lines: 0, // line count requires a snapshot lines read; not needed for the summary list
        adjustments_total: toNumber(adjTotal),
        grand_total: toNumber(revenue.plus(adjTotal)),
      };
      return {
        period,
        status: snap.status as StatementStatus,
        totals,
        hasSnapshot: true,
      };
    }

    // Slab APIs read as 0 in the per-day view; add their recomputed revenue.
    // Then add billed (capped) sandbox revenue/cost/hits for this period.
    const sb = sandboxByPeriod.get(period.id);
    const revenue = (draft ? toMoney(draft.revenue) : ZERO)
      .plus(toMoney(slabByPeriod.get(period.id) ?? 0))
      .plus(sb?.revenue ?? ZERO);
    const vendorCost = (draft ? toMoney(draft.vendor_cost) : ZERO)
      .plus(toMoney(volumeByPeriod.get(period.id) ?? 0))
      .plus(sb?.vendor_cost ?? ZERO);
    const margin = revenue.minus(vendorCost);
    const totals: StatementTotals = {
      revenue: toNumber(revenue),
      vendor_cost: toNumber(vendorCost),
      margin: toNumber(margin),
      margin_pct: marginPct(margin, revenue),
      hits: (draft ? Number(draft.hits ?? 0) : 0) + (sb?.hits ?? 0),
      lines: draft ? Number(draft.lines ?? 0) : 0,
      adjustments_total: 0,
      grand_total: toNumber(revenue),
    };
    return {
      period,
      status: "draft" as StatementStatus,
      totals,
      hasSnapshot: false,
    };
  });
}

// ─── Adjustments ──────────────────────────────────────────────────────────────

export async function listStatementAdjustments(statementId: number): Promise<StatementAdjustment[]> {
  const sql = getSql();
  return sql`
    SELECT sa.id, sa.label, sa.amount, sa.notes, sa.created_at, sa.created_by,
           u.email AS created_by_email
    FROM statement_adjustments sa
    LEFT JOIN users u ON u.id = sa.created_by
    WHERE sa.statement_id = ${statementId}
    ORDER BY sa.created_at ASC, sa.id ASC
  ` as unknown as Promise<StatementAdjustment[]>;
}

async function findInvoiceForAdjustment(
  accountId: number,
  periodId: number
): Promise<{ id: number; number: string; status: StatementStatus }> {
  const sql = getSql();
  const [row] = await sql`
    SELECT id, number, status FROM statements
    WHERE client_id = ${accountId} AND period_id = ${periodId}
  `;
  if (!row) throw new StatementError("invoice is still a draft — finalize first", "not_final");
  if (row.status === "draft") {
    throw new StatementError("adjustments require a finalized invoice", "not_final");
  }
  if (row.status === "issued") {
    throw new StatementError("invoice already issued — adjustments are locked", "locked");
  }
  return row as { id: number; number: string; status: StatementStatus };
}

export async function addStatementAdjustment(
  accountId: number,
  periodId: number,
  userId: number,
  input: { label: string; amount: number; notes?: string | null }
): Promise<StatementAdjustment> {
  const label = input.label.trim();
  if (!label) throw new StatementError("label is required", "invalid");
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new StatementError("amount must be a non-zero number", "invalid");
  }
  const invoice = await findInvoiceForAdjustment(accountId, periodId);
  const sql = getSql();
  const [row] = await sql`
    INSERT INTO statement_adjustments (statement_id, label, amount, notes, created_by)
    VALUES (${invoice.id}, ${label}, ${input.amount}, ${input.notes?.trim() || null}, ${userId})
    RETURNING id
  `;
  const id = Number(row.id);
  await recordAudit({
    user_id: userId,
    action: "invoice.adjustment.add",
    entity_type: "invoice_adjustment",
    entity_id: `${invoice.number}:${id}`,
    before: null,
    after: { label, amount: input.amount, notes: input.notes ?? null },
  });
  return {
    id,
    label,
    amount: input.amount,
    notes: input.notes?.trim() || null,
    created_at: new Date().toISOString(),
    created_by: userId,
    created_by_email: null,
  };
}

export async function removeStatementAdjustment(
  adjustmentId: number,
  userId: number
): Promise<void> {
  const sql = getSql();
  const [row] = await sql`
    SELECT sa.id, sa.label, sa.amount, sa.statement_id, s.number, s.status
    FROM statement_adjustments sa
    JOIN statements s ON s.id = sa.statement_id
    WHERE sa.id = ${adjustmentId}
  `;
  if (!row) throw new StatementError("adjustment not found", "not_found");
  if (row.status === "issued") {
    throw new StatementError("invoice already issued — adjustments are locked", "locked");
  }
  await sql`DELETE FROM statement_adjustments WHERE id = ${adjustmentId}`;
  await recordAudit({
    user_id: userId,
    action: "invoice.adjustment.remove",
    entity_type: "invoice_adjustment",
    entity_id: `${row.number}:${row.id}`,
    before: { label: row.label, amount: toNumber(row.amount) },
    after: null,
  });
}

/**
 * Un-finalize a statement back to draft — the inline resolver an account
 * merge/delete offers when a finalized/issued invoice blocks the operation.
 * The row and its UNIQUE invoice number are kept (the artifact isn't destroyed,
 * just unlocked); generated/issued stamps are cleared so it reads as a draft
 * again and stops counting as a legal block. It can be re-finalized later
 * (which re-uses the same statements row via the (client_id, period_id) key).
 * Accepts an optional transaction so a caller can revert inside its own tx.
 */
export async function revertStatementToDraft(
  statementId: number,
  userId: number,
  tx?: postgres.Sql
): Promise<void> {
  const sql = tx ?? getSql();
  const [row] = await sql`
    SELECT id, number, status FROM statements WHERE id = ${statementId}
  `;
  if (!row) throw new StatementError("statement not found", "not_found");
  if (row.status === "draft") return; // already unlocked
  await sql`
    UPDATE statements
    SET status = 'draft', generated_at = NULL, generated_by = NULL,
        issued_at = NULL, issued_by = NULL
    WHERE id = ${statementId}
  `;
  await recordAudit({
    user_id: userId,
    action: "invoice.finalize",
    entity_type: "invoice",
    entity_id: String(row.number),
    before: { status: row.status },
    after: { status: "draft", reverted: true },
  });
}
