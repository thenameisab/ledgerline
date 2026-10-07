import { NextResponse } from "next/server";
import { z } from "zod";
import getSql from "@/lib/db";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { recordAudit } from "@/lib/repos/audit";
import { parseAliases } from "@/lib/repos/apis";
import { revalidateRevenue } from "@/lib/cache";

// Actions for the code-only API review page (/admin/sku-review):
//  - accept-code: take an unknown/retired Product Code into the catalog (create
//    or reactivate), then backfill its quarantined usage rows.
//  - override: an explicit raw-name → code exception (for blank-code rows),
//    durably consulted by the matcher, plus backfill of existing NULL rows.
//  - acknowledge-drift: record a raw name as a known alias so it stops flagging.
const Schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept-code"),
    code: z.string().min(1),
    name: z.string().min(1),
  }),
  z.object({
    action: z.literal("override"),
    raw_api_name: z.string().min(1),
    code: z.string().min(1),
  }),
  z.object({
    action: z.literal("acknowledge-drift"),
    code: z.string().min(1),
    raw_api_name: z.string().min(1),
  }),
]);

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("alias.resolve");
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.code === "unauthenticated" ? 401 : 403 }
    );
  }
  const user = guard.user;

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;
  const sql = getSql();

  if (body.action === "accept-code") {
    // Create the code if new, or reactivate it if it exists; then claim its rows.
    await sql`
      INSERT INTO apis (product_code, name, log_aliases, is_active)
      VALUES (${body.code}, ${body.name}, ${JSON.stringify([body.code, body.name])}, 1)
      ON CONFLICT (product_code) DO UPDATE SET is_active = 1`;
    await sql`
      UPDATE usage_daily SET api_code = ${body.code}
      WHERE raw_api_code = ${body.code} AND api_code IS NULL`;
    await recordAudit({
      user_id: user.id, action: "catalog.accept_code", entity_type: "api",
      entity_id: body.code, after: { name: body.name },
    });
    revalidateRevenue();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "override") {
    const [api] = await sql`SELECT 1 FROM apis WHERE product_code = ${body.code} AND is_active = 1`;
    if (!api) return NextResponse.json({ ok: false, error: "target code not found or inactive" }, { status: 404 });
    await sql`
      INSERT INTO api_code_overrides (raw_api_name, api_code, created_by)
      VALUES (${body.raw_api_name}, ${body.code}, ${user.id})
      ON CONFLICT (raw_api_name) DO UPDATE SET api_code = EXCLUDED.api_code, created_by = EXCLUDED.created_by`;
    await sql`
      UPDATE usage_daily SET api_code = ${body.code}
      WHERE raw_api_name = ${body.raw_api_name} AND api_code IS NULL`;
    await recordAudit({
      user_id: user.id, action: "catalog.override", entity_type: "api",
      entity_id: body.code, after: { raw_api_name: body.raw_api_name },
    });
    revalidateRevenue();
    return NextResponse.json({ ok: true });
  }

  // acknowledge-drift: append the raw name to the code's known aliases.
  const [row] = await sql`SELECT log_aliases FROM apis WHERE product_code = ${body.code}`;
  if (!row) return NextResponse.json({ ok: false, error: "api not found" }, { status: 404 });
  const aliases = parseAliases((row as any).log_aliases);
  if (!aliases.includes(body.raw_api_name)) aliases.push(body.raw_api_name);
  await sql`UPDATE apis SET log_aliases = ${JSON.stringify(aliases)} WHERE product_code = ${body.code}`;
  await recordAudit({
    user_id: user.id, action: "catalog.ack_drift", entity_type: "api",
    entity_id: body.code, after: { raw_api_name: body.raw_api_name },
  });
  revalidateRevenue();
  return NextResponse.json({ ok: true });
}
