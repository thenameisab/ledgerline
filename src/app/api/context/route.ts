import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/access";
import getSql from "@/lib/db";
import { getAccountBySlug } from "@/lib/repos/accounts";

// Resolves the entity behind the current route so the command palette can
// offer scoped "on this page" actions with real ids (slug → account id, etc.).
// Read-only; mirrors what the page itself already shows the user.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "";
  const period = url.searchParams.get("period");
  const sql = getSql();

  let m: RegExpMatchArray | null;

  // /accounts/groups/{id}
  if ((m = path.match(/^\/accounts\/groups\/(\d+)/))) {
    const [a] = await sql<{ id: number; name: string }[]>`
      SELECT id, name FROM accounts WHERE id = ${Number(m[1])}
    `;
    return NextResponse.json(a ? { kind: "group", id: Number(a.id), name: a.name } : null);
  }

  // /accounts/{slug} and sub-routes (but not the groups list above)
  if ((m = path.match(/^\/accounts\/([^/]+)/)) && m[1] !== "groups") {
    const slug = m[1];
    const account = await getAccountBySlug(slug);
    if (!account) return NextResponse.json(null);
    const base = { accountId: Number(account.id), name: account.display_name, slug };

    if (path.includes("/invoices") && period) {
      const periodId = Number(period);
      const [info] = await sql<{ label: string; status: string | null }[]>`
        SELECT bp.label, s.status
        FROM billing_periods bp
        LEFT JOIN statements s ON s.period_id = bp.id AND s.client_id = ${base.accountId}
        WHERE bp.id = ${periodId}
      `;
      return NextResponse.json({
        kind: "invoice",
        ...base,
        periodId,
        periodLabel: info?.label ?? null,
        status: info?.status ?? "draft",
      });
    }
    return NextResponse.json({ kind: "account", ...base });
  }

  // /apis/{code}
  if ((m = path.match(/^\/apis\/([^/]+)/))) {
    const code = decodeURIComponent(m[1]);
    const [api] = await sql<{ product_code: string; name: string }[]>`
      SELECT product_code, name FROM apis WHERE product_code = ${code}
    `;
    return NextResponse.json(api ? { kind: "api", code: api.product_code, name: api.name } : null);
  }

  return NextResponse.json(null);
}
