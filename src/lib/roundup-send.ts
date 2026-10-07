// Shared send path for the three roundup crons and the admin "send me a test"
// action: resolve recipients → build snapshot → render → send one email per
// recipient. Kept out of the route files so the settings test-send action can
// reuse it verbatim.

import { buildRoundupData } from "./roundup";
import { buildRoundupEmail } from "./emails/roundup-email";
import { roundupChartUrls } from "./roundup-image";
import { getRoundupRecipients, type RoundupKind } from "./repos/settings";
import { sendEmail } from "./email";
import { todayIST, shiftISO } from "./repos/periods";
import { isDateCovered } from "./repos/sync-runs";

const appUrl = () => process.env.AUTH_URL ?? "http://localhost:3000";

export type RoundupSendResult = {
  kind: RoundupKind;
  skipped?: true; // no recipients configured
  blocked?: true; // data not ready — roundup withheld
  missingDate?: string;
  subject?: string;
  sent?: string[];
  failed?: { to: string; error: string }[];
};

/** Send one roundup to its configured list (or an explicit recipient override). */
export async function sendRoundup(
  kind: RoundupKind,
  overrideRecipients?: string[]
): Promise<RoundupSendResult> {
  const recipients = overrideRecipients ?? (await getRoundupRecipients(kind));
  if (recipients.length === 0) return { kind, skipped: true };

  const today = todayIST();
  const data = await buildRoundupData(kind, today);
  const charts = roundupChartUrls(kind, today, appUrl());
  const { subject, html, text } = buildRoundupEmail(data, appUrl(), charts);

  const sent: string[] = [];
  const failed: { to: string; error: string }[] = [];
  for (const to of recipients) {
    const res = await sendEmail({ to, subject, html, text });
    if (res.ok) sent.push(to);
    else failed.push({ to, error: res.error ?? (res.skipped ? "email not configured" : "unknown") });
  }
  return { kind, subject, sent, failed };
}

/**
 * Daily roundup with a data-readiness gate. The daily cron runs ~45 min after
 * the usage sync; if yesterday never landed (sync failed, or Metabase hadn't
 * populated the day), a digest would report a misleading $0. So the roundup is
 * withheld. The roundup does not send its own warning: if the date has still
 * not synced by 17:20 IST, the alerts cron raises F1 ("usage not synced") and
 * emails the "Data and operations" alert list. Weekly/monthly cover
 * already-synced finished periods and need no gate.
 */
export async function sendDailyRoundup(): Promise<RoundupSendResult> {
  const yesterday = shiftISO(todayIST(), -1);
  if (await isDateCovered(yesterday)) return sendRoundup("daily");
  return { kind: "daily", blocked: true, missingDate: yesterday };
}

/** Render without sending — the cron routes' ?dry=1 debug mode.
 *  todayOverride lets a dry run rebuild any historical send. */
export async function renderRoundup(
  kind: RoundupKind,
  todayOverride?: string
): Promise<{ subject: string; html: string }> {
  const today = todayOverride ?? todayIST();
  const data = await buildRoundupData(kind, today);
  const charts = roundupChartUrls(kind, today, appUrl());
  const { subject, html } = buildRoundupEmail(data, appUrl(), charts);
  return { subject, html };
}
