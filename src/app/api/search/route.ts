import { NextResponse } from "next/server";
import { getIncludeSandbox } from "@/lib/repos/settings";
import { getSessionUser } from "@/lib/access";
import { rateLimit } from "@/lib/http";
import { searchEntities } from "@/lib/repos/search";
import { parseQuery } from "@/lib/cmd/query";

const EMPTY = { accounts: [], invoices: [], groups: [], apis: [], manualEntries: [], vendors: [], audit: [], docs: [], periods: [], people: [] };

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json(EMPTY, { status: 401 });

  // Fired per palette keystroke (debounced account-side); the budget only
  // bites runaway loops, not humans typing. Shares the `search:` key with the
  // legacy per-entity endpoints so the combined stream stays bounded.
  const limited = rateLimit(`search:${user.id}`, { limit: 60, windowMs: 10_000 });
  if (limited) return limited;

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json(EMPTY);

  // Parsed once here and handed down, so the client's chip row and the server's
  // corpus scoping can never disagree about what the query meant.
  const parsed = parseQuery(q);
  if (!parsed.text && !parsed.hasOperators) return NextResponse.json(EMPTY);

  const includeSandbox = await getIncludeSandbox();
  const results = await searchEntities(q, {
    includeSandbox,
    isAdmin: user.role === "admin",
    parsed,
  });
  return NextResponse.json(results);
}
