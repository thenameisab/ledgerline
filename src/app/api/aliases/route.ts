import { NextResponse } from "next/server";
import { z } from "zod";
import getSql from "@/lib/db";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { recordAudit } from "@/lib/repos/audit";
import { revalidateRevenue } from "@/lib/cache";

const AliasSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("account"),
    raw_name: z.string().min(1),
    target_id: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("api"),
    raw_name: z.string().min(1),
    target_code: z.string().min(1),
  }),
]);

function parseAliasArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("alias.resolve");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }
  const user = guard.user;

  const parsed = AliasSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;
  const sql = getSql();

  if (body.kind === "account") {
    const [row] = await sql`SELECT log_aliases FROM clients WHERE id = ${body.target_id}`;
    if (!row) return NextResponse.json({ ok: false, error: "account not found" }, { status: 404 });
    const aliases = parseAliasArray((row as any).log_aliases);
    if (!aliases.includes(body.raw_name)) aliases.push(body.raw_name);
    await sql`UPDATE clients SET log_aliases = ${JSON.stringify(aliases)} WHERE id = ${body.target_id}`;
    await sql`UPDATE usage_daily SET client_id = ${body.target_id} WHERE raw_client_name = ${body.raw_name} AND client_id IS NULL`;
    await recordAudit({
      user_id: user.id,
      action: "alias.resolve",
      entity_type: "account",
      entity_id: String(body.target_id),
      after: { raw_name: body.raw_name },
    });
    revalidateRevenue();
    return NextResponse.json({ ok: true });
  }

  const [row] = await sql`SELECT log_aliases FROM apis WHERE product_code = ${body.target_code}`;
  if (!row) return NextResponse.json({ ok: false, error: "api not found" }, { status: 404 });
  const aliases = parseAliasArray((row as any).log_aliases);
  if (!aliases.includes(body.raw_name)) aliases.push(body.raw_name);
  await sql`UPDATE apis SET log_aliases = ${JSON.stringify(aliases)} WHERE product_code = ${body.target_code}`;
  await sql`UPDATE usage_daily SET api_code = ${body.target_code} WHERE raw_api_name = ${body.raw_name} AND api_code IS NULL`;
  await recordAudit({
    user_id: user.id,
    action: "alias.resolve",
    entity_type: "api",
    entity_id: String(body.target_code),
    after: { raw_name: body.raw_name },
  });
  revalidateRevenue();
  return NextResponse.json({ ok: true });
}
