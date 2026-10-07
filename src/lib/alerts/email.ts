// Alert emails: the send path for the alerts cron, the Settings → Alerts test
// buttons, and the cron's dry previews.
//
// Recipients: one list per alert group, in app_settings under
// alertRecipientsKey(group). An empty list turns that group's emails off.
// Settings are read with direct SQL, not the cached settings helper, so this
// code also runs outside Next.
//
// No double sends: before an email goes out, its row is claimed with an
// UPDATE ... WHERE emailed_at IS NULL (alerts.emailed_at for the instant
// email, alert_runs.emailed_at for the daily email). A second cron run or a
// retry finds the row claimed and sends nothing. If every send fails, the claim
// is released so a later call can try again. If some sends succeed and some
// fail, the failures are recorded in email_result and are not retried.

import getSql from "../db";
import { sendEmail } from "../email";
import { yesterdayIST } from "../repos/periods";
import { ALERT_GROUPS, ALERT_RULES, alertRecipientsKey, type AlertGroup } from "./config";
import { syncMissingDraft, type RunSummary } from "./run";
import { buildCriticalAlertEmail, buildDailyAlertEmail, type AlertEmailItem } from "../emails/alert-email";

const appUrl = () => process.env.AUTH_URL ?? "http://localhost:3000";

export type EmailOutcome = { sent: string[]; failed: { to: string; error: string }[] };

type Built = { subject: string; html: string; text: string };

const groupOf = (a: AlertEmailItem) => ALERT_RULES[a.rule].group;

export async function loadAlertRecipients(): Promise<Record<AlertGroup, string[]>> {
  const sql = getSql();
  const keys = ALERT_GROUPS.map((g) => alertRecipientsKey(g.id));
  const rows = await sql`SELECT key, value FROM app_settings WHERE key = ANY(${keys})`;
  const out = Object.fromEntries(ALERT_GROUPS.map((g) => [g.id, [] as string[]])) as Record<AlertGroup, string[]>;
  for (const g of ALERT_GROUPS) {
    const row = rows.find((r: any) => r.key === alertRecipientsKey(g.id));
    if (!row) continue;
    try {
      const list = JSON.parse(row.value as string);
      if (Array.isArray(list)) out[g.id] = list.filter((e): e is string => typeof e === "string");
    } catch {
      // A value that is not JSON counts as an empty list.
    }
  }
  return out;
}

async function loadItems(where: any): Promise<AlertEmailItem[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT a.id, a.rule, a.severity, a.data_date::text AS data_date, a.title, a.body,
           c.display_name AS account_name, a.api_code, a.vendor, a.emailed_at
    FROM alerts a
    LEFT JOIN clients c ON c.id = a.client_id
    WHERE ${where}
    ORDER BY a.id`;
  return rows
    .filter((r: any) => r.rule in ALERT_RULES)
    .map((r: any) => ({
      id: Number(r.id),
      rule: r.rule,
      severity: r.severity,
      dataDate: r.data_date,
      title: r.title,
      body: r.body,
      accountName: r.account_name,
      apiCode: r.api_code,
      vendor: r.vendor,
      emailedAt: r.emailed_at,
    }));
}

async function sendToAll(recipients: string[], email: Built): Promise<EmailOutcome> {
  const out: EmailOutcome = { sent: [], failed: [] };
  for (const to of recipients) {
    const res = await sendEmail({ to, ...email });
    if (res.ok) out.sent.push(to);
    else out.failed.push({ to, error: res.error ?? (res.skipped ? "email not configured" : "unknown") });
  }
  return out;
}

// ── Instant critical email ───────────────────────────────────────────────────

export type CriticalEmailResult = { id: number; skipped?: "no recipients" | "already sent"; sent?: number; failed?: number };

/** Sends the instant email for each critical alert in `ids` that has not been emailed yet. */
export async function sendCriticalAlertEmails(ids: number[]): Promise<CriticalEmailResult[]> {
  if (!ids.length) return [];
  const sql = getSql();
  const lists = await loadAlertRecipients();
  const items = await loadItems(sql`a.id = ANY(${ids}) AND a.severity = 'critical'`);
  const results: CriticalEmailResult[] = [];
  for (const a of items) {
    const id = a.id!;
    const recipients = lists[groupOf(a)];
    if (!recipients.length) {
      results.push({ id, skipped: "no recipients" });
      continue;
    }
    const claimed = await sql`UPDATE alerts SET emailed_at = NOW() WHERE id = ${id} AND emailed_at IS NULL RETURNING id`;
    if (!claimed.length) {
      results.push({ id, skipped: "already sent" });
      continue;
    }
    const outcome = await sendToAll(recipients, buildCriticalAlertEmail({ alert: a, appUrl: appUrl() }));
    await sql`
      UPDATE alerts
      SET email_result = ${sql.json(outcome)},
          emailed_at = CASE WHEN ${outcome.sent.length > 0}::boolean THEN emailed_at ELSE NULL END
      WHERE id = ${id}`;
    results.push({ id, sent: outcome.sent.length, failed: outcome.failed.length });
  }
  return results;
}

// ── Daily email ──────────────────────────────────────────────────────────────

export type DailyEmailResult = {
  date: string;
  skipped?: "no recipients" | "no alerts" | "already sent or not evaluated";
  sent?: string[];
  failed?: { to: string; error: string }[];
  /** Recipients whose groups had no alerts for the date. */
  nothingFor?: string[];
};

/** Each recipient and the groups they are on. */
function recipientGroups(lists: Record<AlertGroup, string[]>): Map<string, AlertGroup[]> {
  const map = new Map<string, AlertGroup[]>();
  for (const g of ALERT_GROUPS) for (const to of lists[g.id]) map.set(to, [...(map.get(to) ?? []), g.id]);
  return map;
}

/**
 * Sends the daily email for one evaluated usage date: one email per recipient,
 * with the alerts for the date in the groups they are on. A recipient with no
 * alerts gets no email.
 */
export async function sendDailyAlertEmail(date: string): Promise<DailyEmailResult> {
  const sql = getSql();
  const byRecipient = recipientGroups(await loadAlertRecipients());
  if (!byRecipient.size) return { date, skipped: "no recipients" };
  const items = await loadItems(sql`a.data_date = ${date}`);
  if (!items.length) return { date, skipped: "no alerts" };

  const claimed = await sql`
    UPDATE alert_runs SET emailed_at = NOW()
    WHERE data_date = ${date} AND status = 'success' AND emailed_at IS NULL
    RETURNING data_date`;
  if (!claimed.length) return { date, skipped: "already sent or not evaluated" };

  const outcome: EmailOutcome = { sent: [], failed: [] };
  const nothingFor: string[] = [];
  for (const [to, groups] of byRecipient) {
    const mine = items.filter((a) => groups.includes(groupOf(a)));
    if (!mine.length) {
      nothingFor.push(to);
      continue;
    }
    const res = await sendToAll([to], buildDailyAlertEmail({ date, alerts: mine, groups, appUrl: appUrl() }));
    outcome.sent.push(...res.sent);
    outcome.failed.push(...res.failed);
  }
  const attempted = outcome.sent.length + outcome.failed.length > 0;
  await sql`
    UPDATE alert_runs
    SET email_result = ${sql.json({ ...outcome, nothingFor })},
        emailed_at = CASE WHEN ${outcome.sent.length > 0 || !attempted}::boolean THEN emailed_at ELSE NULL END
    WHERE data_date = ${date}`;
  return { date, ...outcome, nothingFor };
}

// ── After a cron run ─────────────────────────────────────────────────────────

export type AlertEmailSummary = {
  critical: CriticalEmailResult[];
  daily: DailyEmailResult[];
  errors: string[];
};

/**
 * Sends the emails for one alerts run, date by date in order: the instant
 * emails for the date's new critical alerts, then the date's daily email.
 * Then the instant email for F1, if the run opened it. An error is recorded
 * and does not stop the other emails or fail the run.
 */
export async function sendAlertEmails(summary: RunSummary): Promise<AlertEmailSummary> {
  const out: AlertEmailSummary = { critical: [], daily: [], errors: [] };
  const attempt = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e: any) {
      const msg = `${label}: ${String(e?.message ?? e)}`;
      console.error("[alerts] email failed:", msg);
      out.errors.push(msg);
    }
  };
  for (const e of summary.evaluated) {
    await attempt(`critical ${e.date}`, async () => void out.critical.push(...(await sendCriticalAlertEmails(e.ids))));
    await attempt(`daily ${e.date}`, async () => void out.daily.push(await sendDailyAlertEmail(e.date)));
  }
  const f1 = summary.f1Id;
  if (f1 != null) await attempt("critical F1", async () => void out.critical.push(...(await sendCriticalAlertEmails([f1]))));
  return out;
}

// ── Previews and tests (write nothing) ───────────────────────────────────────

const ALL_GROUPS = ALERT_GROUPS.map((g) => g.id);

/** The daily email for a date as a recipient on `groups` would get it. null when there is nothing to send. */
export async function renderDailyAlertEmail(date: string, groups: AlertGroup[] = ALL_GROUPS, test = false): Promise<Built | null> {
  const sql = getSql();
  const items = (await loadItems(sql`a.data_date = ${date}`)).filter((a) => groups.includes(groupOf(a)));
  if (!items.length) return null;
  return buildDailyAlertEmail({ date, alerts: items, groups, appUrl: appUrl(), test });
}

/**
 * The instant email for critical alert `id`, else for the first critical
 * alert on `date`. When there is no such alert, a sample F1 ("usage not
 * synced") for `date`, which is not saved.
 */
export async function renderCriticalAlertEmail(opts: { date: string; id?: number; test?: boolean }): Promise<Built & { sample: boolean }> {
  const sql = getSql();
  const [found] =
    opts.id != null
      ? await loadItems(sql`a.id = ${opts.id} AND a.severity = 'critical'`)
      : await loadItems(sql`a.data_date = ${opts.date} AND a.severity = 'critical'`);
  const alert: AlertEmailItem = found ?? { ...(await sampleF1(opts.date)) };
  return { ...buildCriticalAlertEmail({ alert, appUrl: appUrl(), test: opts.test }), sample: !found };
}

async function sampleF1(date: string): Promise<AlertEmailItem> {
  const d = await syncMissingDraft(date);
  return {
    id: null,
    rule: d.rule,
    severity: d.severity,
    dataDate: d.dataDate,
    title: `Sample: ${d.title}`,
    body: d.body,
    accountName: null,
    apiCode: null,
    vendor: null,
    emailedAt: null,
  };
}

/**
 * "Send me a test" on Settings → Alerts. Sends to `to` only and writes nothing.
 * Daily: the latest usage date that has alerts, for every group.
 * Critical: the latest critical alert, or a sample F1 for yesterday when there is none.
 */
export async function sendAlertTestEmail(kind: "daily" | "critical", to: string): Promise<{ ok: true; subject: string } | { ok: false; error: string }> {
  const sql = getSql();
  let email: Built | null;
  if (kind === "daily") {
    const [{ d }] = await sql`SELECT MAX(data_date)::text AS d FROM alerts`;
    if (!d) return { ok: false, error: "No alerts are recorded yet, so there is nothing to put in a daily email." };
    email = await renderDailyAlertEmail(d, ALL_GROUPS, true);
  } else {
    const [row] = await sql`SELECT id FROM alerts WHERE severity = 'critical' ORDER BY id DESC LIMIT 1`;
    email = await renderCriticalAlertEmail({ date: yesterdayIST(), id: row ? Number(row.id) : undefined, test: true });
  }
  if (!email) return { ok: false, error: "No alerts to send." };
  const res = await sendEmail({ to, subject: email.subject, html: email.html, text: email.text });
  if (!res.ok) return { ok: false, error: res.error ?? (res.skipped ? "Email is not configured on this server." : "The send failed.") };
  return { ok: true, subject: email.subject };
}
