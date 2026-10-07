import { NextResponse } from "next/server";
import { guardAction } from "@/lib/access";

// Fetch a domain's logo from logo.dev and return it as a base64 data-URI, so
// it can be stored inline on the account (same shape as a manual upload).
// Publishable key (pk_) authorizes the image endpoint.
export async function GET(req: Request) {
  const guard = await guardAction("account.update");
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.code === "unauthenticated" ? 401 : 403 }
    );
  }

  const pub = process.env.LOGODEV_PUBLISHABLE_KEY;
  if (!pub) {
    return NextResponse.json(
      { ok: false, error: "logo.dev publishable key not configured." },
      { status: 503 }
    );
  }

  const domain = new URL(req.url).searchParams.get("domain")?.trim().toLowerCase();
  // Keep it a plain hostname — no scheme, no path, no query.
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ ok: false, error: "Invalid domain." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://img.logo.dev/${encodeURIComponent(domain)}?token=${pub}&size=256&format=png`
    );
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "No logo found for that domain." },
        { status: 404 }
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // Cap to keep the inline data-URI (and the DB row) small.
    if (buf.byteLength > 300_000) {
      return NextResponse.json(
        { ok: false, error: "Logo is too large." },
        { status: 413 }
      );
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
    return NextResponse.json({ ok: true, data_url: dataUrl });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Couldn't reach logo.dev." },
      { status: 502 }
    );
  }
}
