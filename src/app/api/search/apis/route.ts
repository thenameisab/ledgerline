import { NextResponse } from "next/server";
import getSql from "@/lib/db";
import { getSessionUser } from "@/lib/access";
import { rateLimit } from "@/lib/http";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  // Same budget as search/accounts — both fire from the palette and share
  // the per-user key, so the combined stream stays bounded.
  const limited = rateLimit(`search:${user.id}`, { limit: 60, windowMs: 10_000 });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  const sql = getSql();
  const rows = await sql<{ product_code: string; name: string; category: string | null }[]>`
    SELECT product_code, name, category
    FROM apis
    WHERE (name ILIKE ${"%" + q + "%"} OR product_code ILIKE ${"%" + q + "%"})
      AND is_active = 1
    ORDER BY name
    LIMIT 6
  `;

  return NextResponse.json(
    rows.map((r) => ({
      id: r.product_code,
      name: r.name,
      code: r.product_code,
      category: r.category,
    }))
  );
}
