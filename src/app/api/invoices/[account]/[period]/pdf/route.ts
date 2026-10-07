import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";
import { getSessionUser, canViewCost } from "@/lib/access";
import { rateLimit } from "@/lib/http";
import { deriveStatement } from "@/lib/repos/statements";
import { InternalStatementPdf, CustomerStatementPdf } from "@/lib/pdf/StatementPdf";
import { slugify } from "@/lib/format";

const ParamsSchema = z.object({
  account: z.coerce.number().int().positive(),
  period: z.coerce.number().int().positive(),
});

const QuerySchema = z.object({
  variant: z.enum(["internal", "customer"]).default("internal"),
  disposition: z.enum(["inline", "attachment"]).default("inline"),
});

export async function GET(
  req: Request,
  { params }: { params: { account: string; period: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // PDF rendering is the most CPU-expensive thing an authenticated user can
  // trigger; budget it per user.
  const limited = rateLimit(`pdf:${user.id}`, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const parsedParams = ParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: parsedParams.error.message }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({
    variant: searchParams.get("variant") ?? undefined,
    disposition: searchParams.get("disposition") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ ok: false, error: parsedQuery.error.message }, { status: 400 });
  }

  // The internal variant carries vendor cost + margin. Same gate as every other
  // margin surface, so the boundary moves in one place. Members get
  // the customer variant, with cost and margin stripped.
  if (parsedQuery.data.variant === "internal" && !canViewCost(user.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const data = await deriveStatement(parsedParams.data.account, parsedParams.data.period);
  if (!data) {
    return NextResponse.json({ ok: false, error: "statement not found" }, { status: 404 });
  }

  let buf: Buffer;
  try {
    const Doc =
      parsedQuery.data.variant === "customer"
        ? CustomerStatementPdf({ data })
        : InternalStatementPdf({ data });
    buf = await renderToBuffer(Doc);
  } catch (err) {
    console.error("[pdf/route] renderToBuffer failed:", err);
    return NextResponse.json(
      { ok: false, error: "PDF render failed", detail: String(err) },
      { status: 500 }
    );
  }

  const variantTag = parsedQuery.data.variant === "customer" ? "customer" : "internal";
  const filename = `ledgerline-invoice-${data.header.number}-${slugify(data.header.account.display_name)}-${variantTag}.pdf`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${parsedQuery.data.disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
