import { NextResponse, type NextRequest } from "next/server";
import { DEMO_ACCESS_COOKIE } from "@/lib/demo-access";

// Lightweight session-cookie probe. We deliberately do NOT import the full
// NextAuth instance here — it won't run on the Edge runtime middleware uses.
// Instead: presence of a session cookie + bypass flag is the gate.
//
// ⚠️ THIS IS NOT A SECURITY BOUNDARY. The probe checks only that a cookie
// with the right *name* exists — `curl -H 'Cookie: authjs.session-token=x'`
// sails past it. Its only job is UX: bounce obviously-signed-out browsers
// to /login before a page flashes. Real authentication/authorization happens
// server-side on every data access (getSessionUser / requireSession /
// requireRole in lib/access.ts, which verify the JWT). Never add a check
// here and treat a route as protected because of it.

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Forward the pathname downstream so server components (Shell) can read it
  // via `headers().get('x-pathname')` and opt routes out of chrome.
  const forwardedHeaders = new Headers(req.headers);
  forwardedHeaders.set("x-pathname", pathname);
  const pass = () => NextResponse.next({ request: { headers: forwardedHeaders } });

  // Public surfaces. /api/cron and /api/cache carry no session cookie; those
  // routes check a CRON_SECRET bearer token themselves. "/" is the landing
  // page and /api/demo-access is its form.
  if (
    pathname === "/" ||
    pathname === "/api/demo-access" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/cache") ||
    pathname.startsWith("/help/shots/") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/api/roundup") ||
    pathname.startsWith("/api/warm") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/brand")
  ) {
    return pass();
  }

  // Bypass for local dev — opt in via env. Refused in production: a leaked
  // AUTH_BYPASS=true in a deployed environment would expose every admin
  // surface. config.ts throws at module load for the same reason; this is
  // belt-and-suspenders for the Edge runtime path.
  if (process.env.AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production") {
    return pass();
  }

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.get(name));
  if (hasSession) return pass();

  // Signed out. Visitors who have not used the landing-page form go back to
  // it; the others go to sign-in.
  const hasDemoAccess = req.cookies.get(DEMO_ACCESS_COOKIE)?.value === "1";
  if (!hasDemoAccess) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/#access", req.url));
  }
  if (pathname !== "/login") {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return pass();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
