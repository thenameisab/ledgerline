import { NextResponse } from "next/server";
import { z } from "zod";
import getSql from "@/lib/db";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { recordAudit } from "@/lib/repos/audit";
import { findApiConflicts } from "@/lib/repos/apis";
import { revalidateRevenue } from "@/lib/cache";

const ApiCreateSchema = z.object({
  product_code: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_]+$/i, "letters, digits, underscore only"),
  name: z.string().min(1).max(200),
  category: z.string().max(200).nullable().optional().transform((v) => v ?? null),
  entity_type: z.enum(["Business", "Individual", "Both"]).nullable().optional().transform((v) => v ?? null),
  vendor_type: z.enum(["InHouse", "Vendor", "Stitched", "Journey"]).nullable().optional().transform((v) => v ?? null),
  default_vendor: z.string().max(100).nullable().optional().transform((v) => v ?? null),
  log_aliases: z.array(z.string().min(1)).optional().default([]),
  // When set, usage rows carrying this raw log name are mapped to the new
  // API in the same call (the aliases-screen "create as new API" path).
  resolve_raw_name: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("api.create");
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.code === "unauthenticated" ? 401 : 403 }
    );
  }

  const parsed = ApiCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;
  const sql = getSql();

  const code = body.product_code.toUpperCase();
  const [existing] = await sql`SELECT product_code FROM apis WHERE product_code = ${code}`;
  if (existing) {
    return NextResponse.json(
      { ok: false, error: `API ${code} already exists` },
      { status: 409 }
    );
  }

  const aliases = Array.from(
    new Set([code, body.name, ...body.log_aliases, ...(body.resolve_raw_name ? [body.resolve_raw_name] : [])])
  );

  // Duplicate detection: the name or an alias already identifying another API
  // would make importer resolution ambiguous — reject with the colliding API.
  const conflicts = await findApiConflicts({ name: body.name, aliases });
  if (conflicts.length > 0) {
    const c = conflicts[0];
    return NextResponse.json(
      {
        ok: false,
        error:
          c.kind === "name"
            ? `Name "${c.value}" is already used by ${c.product_code} – ${c.name}. Map it as an alias instead, or pick a distinct name.`
            : `Alias "${c.value}" already belongs to ${c.product_code} – ${c.name}.`,
      },
      { status: 409 }
    );
  }

  await sql`
    INSERT INTO apis (product_code, name, log_aliases, category, entity_type, vendor_type, default_vendor, is_active)
    VALUES (${code}, ${body.name}, ${JSON.stringify(aliases)}, ${body.category}, ${body.entity_type}, ${body.vendor_type}, ${body.default_vendor}, 1)
  `;

  if (body.resolve_raw_name) {
    await sql`
      UPDATE usage_daily SET api_code = ${code}
      WHERE raw_api_name = ${body.resolve_raw_name} AND api_code IS NULL
    `;
  }

  await recordAudit({
    user_id: guard.user.id,
    action: "api.create",
    entity_type: "api",
    entity_id: code,
    after: { ...body, product_code: code, log_aliases: aliases },
  });

  revalidateRevenue();
  return NextResponse.json({ ok: true, product_code: code, name: body.name });
}
