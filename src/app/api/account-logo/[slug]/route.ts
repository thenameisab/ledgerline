import { NextResponse } from "next/server";
import getSql from "@/lib/db";

// Serve an account's stored logo as raw image bytes, decoded from the base64
// data-URI in clients.logo_data_url. Lists reference this by slug via <img>, so
// the (large) data-URI never ships in their JSON payload or cached reads.
// Auth is enforced by middleware; any signed-in user may view an account logo.
// (Lives under /api/account-logo, not /api/accounts, because the latter already
// has an [id] dynamic segment — Next forbids mixing [id] and [slug].)
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const sql = getSql();
  const [row] = await sql`
    SELECT logo_data_url FROM clients WHERE slug = ${params.slug}
  `;
  const dataUrl: string | null = (row as any)?.logo_data_url ?? null;
  const m = dataUrl?.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!m) return new NextResponse(null, { status: 404 });

  const buf = Buffer.from(m[2], "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": m[1],
      // Logos change rarely; a short private cache keeps lists snappy without
      // making edits take long to show.
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(buf.byteLength),
    },
  });
}
