import { NextResponse } from "next/server";
import getSql from "@/lib/db";
import { generateSlug } from "@/lib/slug";
import { getSessionUser } from "@/lib/access";
import { rateLimit } from "@/lib/http";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  // Fired per palette keystroke (debounced account-side); the budget only
  // bites runaway loops, not humans typing.
  const limited = rateLimit(`search:${user.id}`, { limit: 60, windowMs: 10_000 });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  const sql = getSql();
  const rows = await sql<{ id: number; display_name: string; status: string }[]>`
    SELECT id, display_name, status
    FROM clients
    WHERE display_name ILIKE ${"%" + q + "%"} AND deleted_at IS NULL
    ORDER BY display_name
    LIMIT 8
  `;

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      slug: generateSlug(r.display_name),
      name: r.display_name,
      status: r.status,
    }))
  );
}
