// Signed URLs for the roundup chart images. The image route is fetched by
// the email client's image proxy with no session cookie, so the URL itself is the credential:
// an HMAC over (kind, type, today) keyed on CRON_SECRET. No revenue data ever
// rides in the query string — the route recomputes the snapshot from the date.

import { createHmac } from "crypto";

export type ChartType = "concentration" | "quadrant";
import type { RoundupKind } from "./repos/settings";

function secret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

export function signChart(kind: RoundupKind, type: ChartType, today: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(`${kind}:${type}:${today}`).digest("hex").slice(0, 32);
}

export function verifyChartSig(
  kind: RoundupKind,
  type: ChartType,
  today: string,
  sig: string
): boolean {
  const expected = signChart(kind, type, today);
  if (!expected) return false;
  // Constant-length compare (both hex, same length) — cheap timing-safe-ish.
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/** Absolute chart image URLs for the email, or null when unsignable (no secret). */
export function roundupChartUrls(
  kind: RoundupKind,
  today: string,
  baseUrl: string
): { concentration: string; quadrant: string } | null {
  const cSig = signChart(kind, "concentration", today);
  const qSig = signChart(kind, "quadrant", today);
  if (!cSig || !qSig) return null;
  const url = (type: ChartType, sig: string) =>
    `${baseUrl}/api/roundup/chart?kind=${kind}&type=${type}&today=${today}&sig=${sig}`;
  return {
    concentration: url("concentration", cSig),
    quadrant: url("quadrant", qSig),
  };
}
