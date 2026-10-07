// HTTP-level guards for API route handlers.
//
// All mutating routes (POST/DELETE/PUT/PATCH) must call assertSameOrigin
// before doing any work. Browsers attach our session cookie automatically
// to same-origin requests — so a logged-in user visiting a malicious page
// would, without this check, allow that page to POST as them via fetch.
// SameSite=Lax blocks the most common cross-site form post but does NOT
// block a same-site XSS pivot, nor a JSON fetch from a non-browser
// account that scraped a cookie.
//
// Implementation: compare the request's Origin (preferred) or Referer
// header to the host we're actually serving from. Same-origin requests
// always send one of these. If neither header is present, refuse.

import { NextResponse } from "next/server";

/**
 * Returns null if the request looks same-origin (safe to proceed), or a
 * NextResponse error the route should return immediately.
 *
 *   const csrf = assertSameOrigin(req);
 *   if (csrf) return csrf;
 */
export function assertSameOrigin(req: Request): NextResponse | null {
  // The Host header tells us what hostname the browser thinks it's
  // talking to — this is the one we must match.
  const host = req.headers.get("host");
  if (!host) {
    return NextResponse.json(
      { ok: false, error: "missing Host header" },
      { status: 400 }
    );
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const source = origin ?? referer;
  if (!source) {
    return NextResponse.json(
      { ok: false, error: "missing Origin/Referer — refusing cross-site request" },
      { status: 403 }
    );
  }

  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    return NextResponse.json(
      { ok: false, error: "malformed Origin/Referer" },
      { status: 400 }
    );
  }

  if (sourceHost !== host) {
    return NextResponse.json(
      { ok: false, error: "cross-site request refused" },
      { status: 403 }
    );
  }
  return null;
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
//
// Fixed-window counter, in process memory. On serverless this is per-instance
// state — a determined abuser hitting N instances gets N× the budget. That's
// acceptable for the threat here (an *authenticated* user hammering CPU-heavy
// PDF renders or chatty search endpoints), and it costs no new dependency or
// network hop. Revisit with a shared store (Upstash/Redis) only if instance
// counts grow enough to make the multiplier meaningless.

type WindowState = { count: number; resetAt: number };
const windows = new Map<string, WindowState>();

// Cap the map so a long-lived instance can't grow unbounded; entries are
// also dropped lazily once their window has passed.
const MAX_WINDOW_ENTRIES = 10_000;

/**
 * Returns null if the caller is within budget, or a 429 NextResponse the
 * route should return immediately (mirrors assertSameOrigin's contract).
 *
 *   const limited = rateLimit(`pdf:${user.id}`, { limit: 10, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): NextResponse | null {
  const now = Date.now();

  const state = windows.get(key);
  if (!state || now >= state.resetAt) {
    if (windows.size >= MAX_WINDOW_ENTRIES) {
      for (const [k, s] of windows) {
        if (now >= s.resetAt) windows.delete(k);
      }
      // Still full after pruning live entries? Refuse new keys rather than
      // evicting active counters (which would reset someone's budget).
      if (windows.size >= MAX_WINDOW_ENTRIES) {
        return NextResponse.json(
          { ok: false, error: "rate limiter at capacity, try again shortly" },
          { status: 429, headers: { "Retry-After": "5" } }
        );
      }
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  state.count += 1;
  if (state.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((state.resetAt - now) / 1000));
    return NextResponse.json(
      { ok: false, error: "rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }
  return null;
}
