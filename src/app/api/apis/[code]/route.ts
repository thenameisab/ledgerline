import { NextResponse } from "next/server";
import { z } from "zod";
import getSql from "@/lib/db";
import { guardAction } from "@/lib/access";
import { assertSameOrigin } from "@/lib/http";
import { recordAudit } from "@/lib/repos/audit";
import { findApiConflicts, parseAliases } from "@/lib/repos/apis";
import { revalidateRevenue } from "@/lib/cache";

const ApiUpdateSchema = z.object({
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
  is_active: z.union([z.literal(0), z.literal(1)]).optional().default(1),
});

export async function PATCH(req: Request, { params }: { params: { code: string } }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("api.update");
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.code === "unauthenticated" ? 401 : 403 }
    );
  }

  const parsed = ApiUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;
  const sql = getSql();

  const [existing] = await sql`SELECT * FROM apis WHERE product_code = ${params.code}`;
  if (!existing) {
    return NextResponse.json({ ok: false, error: "API not found" }, { status: 404 });
  }

  const newCode = body.product_code.toUpperCase();
  const renaming = newCode !== params.code;

  if (renaming) {
    const [taken] = await sql`SELECT product_code FROM apis WHERE product_code = ${newCode}`;
    if (taken) {
      return NextResponse.json(
        { ok: false, error: `Product code ${newCode} is already taken by another API.` },
        { status: 409 }
      );
    }
  }

  // Keep code + name as implicit aliases so importer matching keeps working.
  const aliases = Array.from(new Set([newCode, body.name, ...body.log_aliases]));

  const conflicts = await findApiConflicts({
    name: body.name,
    aliases,
    excludeCode: params.code,
  });
  if (conflicts.length > 0) {
    const c = conflicts[0];
    return NextResponse.json(
      {
        ok: false,
        error:
          c.kind === "name"
            ? `Name "${c.value}" is already used by ${c.product_code} – ${c.name}.`
            : `Alias "${c.value}" already belongs to ${c.product_code} – ${c.name}.`,
      },
      { status: 409 }
    );
  }

  if (renaming) {
    // product_code is the PK and is referenced by pricing, vendor_pricing and
    // usage_daily (no ON UPDATE CASCADE), so a rename moves the children
    // inside one transaction: insert new row, repoint children, drop old row.
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO apis (product_code, name, log_aliases, category, entity_type, vendor_type, default_vendor, is_active)
        VALUES (${newCode}, ${body.name}, ${JSON.stringify(aliases)}, ${body.category}, ${body.entity_type}, ${body.vendor_type}, ${body.default_vendor}, ${body.is_active})
      `;
      await tx`UPDATE pricing SET api_code = ${newCode} WHERE api_code = ${params.code}`;
      await tx`UPDATE vendor_pricing SET api_code = ${newCode} WHERE api_code = ${params.code}`;
      await tx`UPDATE usage_daily SET api_code = ${newCode} WHERE api_code = ${params.code}`;
      await tx`UPDATE statement_lines SET api_code = ${newCode} WHERE api_code = ${params.code}`;
      await tx`DELETE FROM apis WHERE product_code = ${params.code}`;
    });
  } else {
    await sql`
      UPDATE apis SET
        name = ${body.name},
        log_aliases = ${JSON.stringify(aliases)},
        category = ${body.category},
        entity_type = ${body.entity_type},
        vendor_type = ${body.vendor_type},
        default_vendor = ${body.default_vendor},
        is_active = ${body.is_active}
      WHERE product_code = ${params.code}
    `;
  }

  await recordAudit({
    user_id: guard.user.id,
    action: "api.update",
    entity_type: "api",
    entity_id: newCode,
    before: {
      product_code: existing.product_code,
      name: existing.name,
      category: existing.category,
      entity_type: existing.entity_type,
      vendor_type: existing.vendor_type,
      default_vendor: existing.default_vendor,
      log_aliases: parseAliases(existing.log_aliases),
      is_active: existing.is_active,
    },
    after: { ...body, product_code: newCode, log_aliases: aliases },
  });

  revalidateRevenue();
  return NextResponse.json({ ok: true, product_code: newCode, name: body.name });
}
