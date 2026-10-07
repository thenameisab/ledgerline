// Called by the landing page after the visitor submits the Tally form.
// Tally stores the answers; this route only sets the access cookie that lets
// the visitor through to the demo sign-in.

import { NextResponse } from "next/server";
import { assertSameOrigin, rateLimit } from "@/lib/http";
import { DEMO_ACCESS_COOKIE, DEMO_ACCESS_MAX_AGE } from "@/lib/demo-access";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = rateLimit(`demo-access:${ip}`, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const res = NextResponse.json({ ok: true, next: "/login" });
  res.cookies.set(DEMO_ACCESS_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_ACCESS_MAX_AGE,
  });
  return res;
}
