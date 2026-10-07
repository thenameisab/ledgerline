// Usage alerts, invoked by a scheduled cron after each usage-sync attempt:
// 11:45, 13:20 and 17:20 IST. Each run evaluates the usage
// dates that have synced and have not been evaluated yet. The 17:20 run passes
// `final=1`: if yesterday has still not synced, it raises the F1 alert.
//
// Dry mode, for checking rules against history without writing anything:
//   GET ?dry=1&from=YYYY-MM-DD&to=YYYY-MM-DD
// returns per-rule counts and the alerts each date would have opened, starting
// from an empty state on `from`.
//
// After the run, the alert emails go out (lib/alerts/email.ts): the instant
// email for each new critical alert, then one daily email per evaluated date.
//
// Email previews, as HTML, without sending or writing anything:
//   GET ?dry=daily&date=YYYY-MM-DD[&groups=volume,failures]
//       the daily email for that date, as a recipient on those groups (default
//       all groups) would get it.
//   GET ?dry=critical&date=YYYY-MM-DD[&id=N]
//       the instant email for critical alert N, else for the first critical
//       alert on that date, else a sample "usage not synced" (F1) alert for
//       that date, which is not saved.
//
// Auth: `Authorization: Bearer <CRON_SECRET>`, as for every cron route.

import { NextResponse } from "next/server";
import { evaluateRange, runPendingAlerts } from "@/lib/alerts/run";
import { renderCriticalAlertEmail, renderDailyAlertEmail, sendAlertEmails } from "@/lib/alerts/email";
import { ALERT_GROUPS, type AlertGroup } from "@/lib/alerts/config";
import { yesterdayIST, shiftISO } from "@/lib/repos/periods";
import { SYNC_EPOCH } from "@/lib/repos/sync-runs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry");

  if (dry === "daily" || dry === "critical") {
    const date = url.searchParams.get("date") ?? yesterdayIST();
    if (!ISO.test(date)) return NextResponse.json({ ok: false, error: "date must be YYYY-MM-DD" }, { status: 400 });
    let email: { html: string } | null;
    if (dry === "daily") {
      const raw = url.searchParams.get("groups");
      const groups = raw ? (raw.split(",") as AlertGroup[]) : ALERT_GROUPS.map((g) => g.id);
      if (groups.some((g) => !ALERT_GROUPS.some((x) => x.id === g))) {
        return NextResponse.json({ ok: false, error: `groups must be from: ${ALERT_GROUPS.map((g) => g.id).join(", ")}` }, { status: 400 });
      }
      email = await renderDailyAlertEmail(date, groups);
      if (!email) return NextResponse.json({ ok: true, dry: true, date, message: "No alerts for this date in these groups, so no email would be sent." });
    } else {
      const idRaw = url.searchParams.get("id");
      const res = await renderCriticalAlertEmail({ date, id: idRaw ? Number(idRaw) : undefined });
      if (idRaw && res.sample) return NextResponse.json({ ok: false, error: `No critical alert with id ${idRaw}` }, { status: 404 });
      email = res;
    }
    return new NextResponse(email.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (dry === "1") {
    const to = url.searchParams.get("to") ?? yesterdayIST();
    const from = url.searchParams.get("from") ?? shiftISO(to, -6);
    if (!ISO.test(from) || !ISO.test(to) || from > to || from < SYNC_EPOCH) {
      return NextResponse.json({ ok: false, error: `from/to must be dates from ${SYNC_EPOCH}, from <= to` }, { status: 400 });
    }
    const days = await evaluateRange(from, to);
    const byRule: Record<string, number> = {};
    for (const d of days) for (const a of d.opened) byRule[a.rule] = (byRule[a.rule] ?? 0) + 1;
    return NextResponse.json({
      ok: true,
      dry: true,
      from,
      to,
      total: days.reduce((s, d) => s + d.opened.length, 0),
      byRule,
      days: days.map((d) => ({
        date: d.date,
        suppressed: d.suppressed,
        opened: d.opened.map((a) => ({ rule: a.rule, severity: a.severity, key: a.key, title: a.title, body: a.body })),
      })),
    });
  }

  const summary = await runPendingAlerts({ trigger: "cron", final: url.searchParams.get("final") === "1" });
  const emails = await sendAlertEmails(summary);
  return NextResponse.json({ ok: true, ...summary, emails });
}
