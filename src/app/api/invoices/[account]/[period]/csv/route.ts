import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, canViewCost } from "@/lib/access";
import { rateLimit } from "@/lib/http";
import { deriveStatement } from "@/lib/repos/statements";
import { slugify } from "@/lib/format";
import { confirmedHits, confirmedShare } from "@/lib/vendor-confidence";

const ParamsSchema = z.object({
  account: z.coerce.number().int().positive(),
  period: z.coerce.number().int().positive(),
});

const QuerySchema = z.object({
  variant: z.enum(["internal", "customer"]).default("internal"),
  disposition: z.enum(["inline", "attachment"]).default("attachment"),
});

// Columns for the internal variant:
const HEADERS_INTERNAL = [
  "api_code",
  "api_name",
  "hits",
  "successful",
  "successful_no_data",
  "failed",
  "in_progress",
  "price_successful",
  "price_successful_no_data",
  "price_failed",
  "price_in_progress",
  "revenue",
  "vendor_cost",
  "margin",
  "is_estimated",
];

const HEADERS_CUSTOMER = [
  "api_code",
  "api_name",
  "hits",
  "successful",
  "successful_no_data",
  "failed",
  "in_progress",
  "price_successful",
  "price_successful_no_data",
  "price_failed",
  "price_in_progress",
  "revenue",
];

const ADJUSTMENT_HEADERS_INTERNAL = [
  "label",
  "amount",
  "notes",
  "created_by",
  "created_at",
];

const ADJUSTMENT_HEADERS_CUSTOMER = ["label", "amount", "notes"];

function csvEscape(v: string | number | boolean | null | undefined): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : String(v);
  // RFC 4180: wrap in quotes if contains comma/quote/CR/LF, double up embedded quotes.
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: Array<string | number | boolean | null | undefined>): string {
  return cells.map(csvEscape).join(",");
}

export async function GET(
  req: Request,
  { params }: { params: { account: string; period: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // Statement derivation is several queries per call; cheaper than the PDF
  // render, so it gets a looser budget.
  const limited = rateLimit(`csv:${user.id}`, { limit: 20, windowMs: 60_000 });
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
    return NextResponse.json({ ok: false, error: "invoice not found" }, { status: 404 });
  }

  const isInternal = parsedQuery.data.variant === "internal";
  const lineHeaders = isInternal ? HEADERS_INTERNAL : HEADERS_CUSTOMER;
  const adjHeaders = isInternal ? ADJUSTMENT_HEADERS_INTERNAL : ADJUSTMENT_HEADERS_CUSTOMER;
  const r2 = (n: number) => Number.isFinite(n) ? Number(n.toFixed(2)) : 0;

  const lineRows = data.lines.map((l) =>
    isInternal
      ? csvRow([
          l.api_code,
          l.api_name,
          l.hits,
          l.successful,
          l.successful_no_data,
          l.failed,
          l.in_progress,
          r2(l.price_successful),
          r2(l.price_successful_no_data),
          r2(l.price_failed),
          r2(l.price_in_progress),
          r2(l.revenue),
          r2(l.vendor_cost),
          r2(l.margin),
          l.vendor_estimated ? "true" : "false",
        ])
      : csvRow([
          l.api_code,
          l.api_name,
          l.hits,
          l.successful,
          l.successful_no_data,
          l.failed,
          l.in_progress,
          r2(l.price_successful),
          r2(l.price_successful_no_data),
          r2(l.price_failed),
          r2(l.price_in_progress),
          r2(l.revenue),
        ])
  );

  const sections: string[] = [];

  // Metadata block — read at the top of the file so a finance user pasting
  // into Tally/QuickBooks immediately sees what this is.
  sections.push(
    [
      `# Ledgerline invoice ${data.header.number}`,
      `# Account: ${data.header.account.display_name}${data.header.account.billing_entity ? ` (${data.header.account.billing_entity})` : ""}`,
      `# Period: ${data.header.period.label} · ${data.header.period.start_date} to ${data.header.period.end_date}`,
      `# Status: ${data.header.status}`,
      `# Variant: ${parsedQuery.data.variant}`,
    ].join("\n")
  );

  // Line items block
  sections.push([csvRow(lineHeaders), ...lineRows].join("\n"));

  // Adjustments block, if any
  if (data.adjustments.length > 0) {
    const adjRows = data.adjustments.map((a) =>
      isInternal
        ? csvRow([a.label, r2(a.amount), a.notes ?? "", a.created_by_email ?? "", a.created_at])
        : csvRow([a.label, r2(a.amount), a.notes ?? ""])
    );
    sections.push(
      ["", "# Adjustments", csvRow(adjHeaders), ...adjRows].join("\n")
    );
  }

  // Totals block
  const totalsRows: string[] = [
    "",
    "# Totals",
    csvRow(["metric", "value"]),
    csvRow(["hits", data.totals.hits]),
    csvRow(["revenue", r2(data.totals.revenue)]),
  ];
  if (isInternal) {
    totalsRows.push(
      csvRow(["vendor_cost", r2(data.totals.vendor_cost)]),
      csvRow(["margin", r2(data.totals.margin)]),
      csvRow(["margin_pct", r2(data.totals.margin_pct)])
    );
    // How well that cost was measured. The per-line is_estimated column says
    // which lines were guesses; this says how much of the period they cover,
    // so a margin read off this file cannot be taken for a measurement it is
    // not. Frozen with the invoice on a finalized one.
    const c = data.cost_confidence;
    if (c) {
      totalsRows.push(
        csvRow(["cost_confirmed_hits", confirmedHits(c)]),
        csvRow(["cost_measured_hits", c.hits]),
        csvRow(["cost_confirmed_pct", r2(confirmedShare(c))])
      );
    }
  }
  if (data.adjustments.length > 0) {
    totalsRows.push(
      csvRow(["adjustments_total", r2(data.totals.adjustments_total)]),
      csvRow(["grand_total", r2(data.totals.grand_total)])
    );
  }
  sections.push(totalsRows.join("\n"));

  const body = sections.join("\n\n") + "\n";

  const variantTag = isInternal ? "internal" : "customer";
  const filename = `ledgerline-invoice-${data.header.number}-${slugify(
    data.header.account.display_name
  )}-${variantTag}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `${parsedQuery.data.disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
