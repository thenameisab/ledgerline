import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { pdf } from "./tokens";
import { registerPdfFonts } from "./fonts";
import { formatMoney, formatPrice, formatPercent, formatNumber, formatDateLong } from "../format";
import type { StatementData, StatementLine, StatementAdjustment } from "../repos/statements";
import { confirmedShare, formatShare } from "../vendor-confidence";

registerPdfFonts();

export type StatementVariant = "internal" | "customer";

// ─────────────────────────────────────────────────────────────────────────────
// Stylesheet — every visual decision lives here so a reader can audit it
// against DESIGN.md without hopping between files.

const s = StyleSheet.create({
  page: {
    backgroundColor: pdf.color.bg,
    paddingTop:    pdf.page.margin.top,
    paddingBottom: pdf.page.margin.bottom + 24, // room for footer
    paddingLeft:   pdf.page.margin.left,
    paddingRight:  pdf.page.margin.right,
    fontFamily:    "Inter",
    fontSize:      pdf.text.sm,
    color:         pdf.color.ink,
  },

  // ── Header strip
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "flex-end",
    paddingBottom:  pdf.space[5],
    borderBottomWidth: pdf.hairline,
    borderBottomColor: pdf.color.border,
  },
  brandRow: { flexDirection: "row", alignItems: "baseline" },
  brand: {
    fontFamily: "Display",
    fontWeight: 600,
    fontSize:   pdf.text["2xl"],
    color:      pdf.color.ink,
    letterSpacing: -0.3,
  },
  brandTag: {
    marginLeft: pdf.space[3],
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  headerMeta: { alignItems: "flex-end" },
  headerKicker: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerNumber: {
    fontFamily: "JetBrainsMono",
    fontWeight: 500,
    fontSize:   pdf.text.md,
    color:      pdf.color.ink,
  },

  // ── Bill-to + Period block
  billRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    marginTop:      pdf.space[7],
    marginBottom:   pdf.space[6],
  },
  billCol: { width: "48%" },
  blockLabel: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: pdf.space[2],
  },
  accountName: {
    fontFamily: "Display",
    fontWeight: 600,
    fontSize:   pdf.text.xl,
    color:      pdf.color.ink,
    marginBottom: 2,
  },
  metaLine: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize:   pdf.text.sm,
    color:      pdf.color.inkMuted,
    marginTop:  1,
  },
  metaMono: {
    fontFamily: "JetBrainsMono",
    fontWeight: 400,
    fontSize:   pdf.text.sm,
    color:      pdf.color.inkMuted,
    marginTop:  1,
  },
  periodDate: {
    fontFamily: "Display",
    fontWeight: 600,
    fontSize:   pdf.text.lg,
    color:      pdf.color.ink,
  },

  // ── Status chip (tinted-bg, no border, no shadow)
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: pdf.space[3],
    paddingVertical:   pdf.space[1],
    borderRadius: 3,
    marginTop: pdf.space[3],
  },
  chipText: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   pdf.text.xs,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // ── Totals strip (KPI cells) — borderless, hairline dividers
  totalsStrip: {
    flexDirection: "row",
    backgroundColor: pdf.color.bgSunken,
    borderRadius: 2,
    paddingVertical:   pdf.space[5],
    paddingHorizontal: pdf.space[5],
    marginBottom: pdf.space[7],
  },
  totalsCell: { flex: 1, paddingHorizontal: pdf.space[3] },
  totalsCellDivider: { borderLeftWidth: pdf.hairline, borderLeftColor: pdf.color.border },
  totalsLabel: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: pdf.space[2],
  },
  totalsValue: {
    // Inter, not Display: TASA Orbiter has no ₹ glyph (see fonts.ts).
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize:   pdf.text["2xl"],
    color:      pdf.color.ink,
  },
  totalsSubvalue: {
    fontFamily: "JetBrainsMono",
    fontWeight: 400,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkMuted,
    marginTop: 2,
  },
  // Sits in the gap the totals strip already leaves below itself. Full width
  // rather than a fourth line inside the Margin cell, which is flex:1 and
  // would wrap a sentence to three lines.
  coverageNote: {
    fontSize:  pdf.text.xs,
    color:     pdf.color.inkMuted,
    marginTop: -pdf.space[5],
    marginBottom: pdf.space[6],
  },

  // ── Lines table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: pdf.color.bgSunken,
    paddingVertical:   pdf.space[3],
    paddingHorizontal: pdf.space[3],
    borderBottomWidth: pdf.hairline,
    borderBottomColor: pdf.color.border,
  },
  th: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical:   pdf.space[3],
    paddingHorizontal: pdf.space[3],
    borderBottomWidth: pdf.hairline,
    borderBottomColor: pdf.color.border,
  },
  td: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize:   pdf.text.sm,
    color:      pdf.color.ink,
  },
  tdMono: {
    fontFamily: "JetBrainsMono",
    fontWeight: 400,
    fontSize:   pdf.text.sm,
    color:      pdf.color.ink,
  },
  tdMuted: { color: pdf.color.inkMuted },
  apiName: { color: pdf.color.ink, marginBottom: 1 },
  apiCode: {
    fontFamily: "JetBrainsMono",
    fontWeight: 400,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkMuted,
  },

  // Row tinted when margin is bad (negative). Honors DESIGN §5: full-row tint,
  // never a left-stripe accent.
  rowBad: { backgroundColor: pdf.color.badBg },

  // Subtle "est." chip used when a row's vendor cost is estimated.
  estChip: {
    alignSelf: "flex-start",
    paddingHorizontal: pdf.space[2],
    paddingVertical:   0.5,
    borderRadius: 2,
    backgroundColor: pdf.color.warnBg,
    marginLeft: pdf.space[2],
  },
  estChipText: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   6,
    color:      pdf.color.warnInk,
    letterSpacing: 0.4,
  },

  // Totals row at the bottom of the table — no border, just a thicker hairline above
  totalsRow: {
    flexDirection: "row",
    paddingVertical:   pdf.space[4],
    paddingHorizontal: pdf.space[3],
    borderTopWidth: 1,
    borderTopColor: pdf.color.ink,
    marginTop: 2,
  },
  totalsLabelCell: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   pdf.text.sm,
    color:      pdf.color.inkMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  totalsValueCell: {
    fontFamily: "JetBrainsMono",
    fontWeight: 500,
    fontSize:   pdf.text.md,
    color:      pdf.color.ink,
  },
  // The internal table fits six columns into the width the customer table
  // gives four, so its totals read at the body's size rather than a step up.
  // At md a 12-character rupee total is wider than the column holding it and
  // prints over its neighbour. The weight and the rule
  // above mark the row, not the point size.
  totalsValueInternal: { fontSize: pdf.text.sm },

  // ── Footer
  footer: {
    position: "absolute",
    bottom:   pdf.page.margin.bottom - 6,
    left:     pdf.page.margin.left,
    right:    pdf.page.margin.right,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: pdf.hairline,
    borderTopColor: pdf.color.border,
    paddingTop: pdf.space[3],
  },
  footerText: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkFaint,
  },
  footerMono: {
    fontFamily: "JetBrainsMono",
    fontWeight: 400,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkFaint,
  },

  // ── Adjustments section (credit notes & late charges on finalized invoices)
  adjustmentsSection: {
    marginTop: pdf.space[4],
  },
  adjustmentsHeader: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: pdf.space[2],
  },
  adjustmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical:   pdf.space[2],
    paddingHorizontal: pdf.space[3],
    borderBottomWidth: pdf.hairline,
    borderBottomColor: pdf.color.border,
  },
  adjustmentLabel: {
    flex: 1,
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize:   pdf.text.sm,
    color:      pdf.color.ink,
  },
  adjustmentNotes: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkFaint,
    marginTop: 2,
  },
  adjustmentMeta: {
    fontFamily: "JetBrainsMono",
    fontWeight: 400,
    fontSize:   pdf.text.xs,
    color:      pdf.color.inkFaint,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  adjustmentAmount: {
    fontFamily: "JetBrainsMono",
    fontWeight: 500,
    fontSize:   pdf.text.sm,
    textAlign: "right",
    minWidth: 90,
  },
  adjustmentAmountCredit: { color: pdf.color.badInk },
  adjustmentAmountCharge: { color: pdf.color.warnInk },
  adjustmentSubtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical:   pdf.space[2],
    paddingHorizontal: pdf.space[3],
    backgroundColor: pdf.color.bgSunken,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical:   pdf.space[4],
    paddingHorizontal: pdf.space[3],
    marginTop: pdf.space[3],
    borderTopWidth: 1,
    borderTopColor: pdf.color.ink,
  },
  grandTotalLabel: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   pdf.text.sm,
    color:      pdf.color.inkMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  grandTotalValue: {
    // Inter, not Display: TASA Orbiter has no ₹ glyph (see fonts.ts).
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize:   pdf.text.lg,
    color:      pdf.color.ink,
  },

  // ── Customer-only thank-you note
  thankYou: {
    marginTop: pdf.space[7],
    paddingTop: pdf.space[5],
    borderTopWidth: pdf.hairline,
    borderTopColor: pdf.color.border,
  },
  thankYouTitle: {
    fontFamily: "Display",
    fontWeight: 600,
    fontSize:   pdf.text.lg,
    color:      pdf.color.ink,
    marginBottom: pdf.space[2],
  },
  thankYouBody: {
    fontFamily: "Inter",
    fontWeight: 400,
    fontSize:   pdf.text.sm,
    color:      pdf.color.inkMuted,
    lineHeight: 1.5,
  },

  // ── Demo watermark on drafts — diagonal, very faint
  draftBanner: {
    position: "absolute",
    top:    pdf.page.margin.top - 14,
    right:  pdf.page.margin.right,
    backgroundColor: pdf.color.warnBg,
    paddingHorizontal: pdf.space[3],
    paddingVertical:   pdf.space[1],
    borderRadius: 2,
  },
  draftBannerText: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize:   pdf.text.xs,
    color:      pdf.color.warnInk,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits

function StatusChip({ status }: { status: "draft" | "final" | "issued" }) {
  const palette = {
    draft:  { bg: pdf.color.warnBg,    fg: pdf.color.warnInk },
    final:  { bg: pdf.color.okBg,      fg: pdf.color.okInk },
    issued: { bg: pdf.color.successBg, fg: pdf.color.successInk },
  }[status];
  return (
    <View style={[s.chip, { backgroundColor: palette.bg }]}>
      <Text style={[s.chipText, { color: palette.fg }]}>{status}</Text>
    </View>
  );
}

function PdfHeader({ data }: { data: StatementData }) {
  return (
    <View style={s.header}>
      <View style={s.brandRow}>
        <Text style={s.brand}>Ledgerline</Text>
        <Text style={s.brandTag}>Billing</Text>
      </View>
      <View style={s.headerMeta}>
        <Text style={s.headerKicker}>Invoice</Text>
        <Text style={s.headerNumber}>{data.header.number}</Text>
      </View>
    </View>
  );
}

function BillToPeriod({ data }: { data: StatementData }) {
  return (
    <View style={s.billRow}>
      <View style={s.billCol}>
        <Text style={s.blockLabel}>Bill to</Text>
        <Text style={s.accountName}>
          {data.header.account.billing_entity ?? data.header.account.display_name}
        </Text>
        {data.header.account.billing_entity &&
          data.header.account.billing_entity !== data.header.account.display_name && (
            <Text style={s.metaLine}>{data.header.account.display_name}</Text>
          )}
        {data.header.account.group_name && (
          <Text style={s.metaLine}>Group · {data.header.account.group_name}</Text>
        )}
        {data.header.account.gstin && (
          <Text style={s.metaMono}>GSTIN {data.header.account.gstin}</Text>
        )}
      </View>
      <View style={[s.billCol, { alignItems: "flex-end" }]}>
        <Text style={s.blockLabel}>Period</Text>
        <Text style={s.periodDate}>
          {formatDateLong(data.header.period.start_date)} —{" "}
          {formatDateLong(data.header.period.end_date)}
        </Text>
        <Text style={s.metaLine}>{data.header.period.label}</Text>
        <StatusChip status={data.header.status} />
      </View>
    </View>
  );
}

function TotalsStripInternal({ data }: { data: StatementData }) {
  return (
    <View style={s.totalsStrip}>
      <View style={s.totalsCell}>
        <Text style={s.totalsLabel}>Revenue</Text>
        <Text style={s.totalsValue}>{formatMoney(data.totals.revenue)}</Text>
        <Text style={s.totalsSubvalue}>{formatNumber(data.totals.hits)} hits</Text>
      </View>
      <View style={[s.totalsCell, s.totalsCellDivider]}>
        <Text style={s.totalsLabel}>Vendor cost</Text>
        <Text style={s.totalsValue}>{formatMoney(data.totals.vendor_cost)}</Text>
        <Text style={s.totalsSubvalue}>{data.totals.lines} APIs billed</Text>
      </View>
      <View style={[s.totalsCell, s.totalsCellDivider]}>
        <Text style={s.totalsLabel}>Margin</Text>
        <Text style={s.totalsValue}>{formatMoney(data.totals.margin)}</Text>
        <Text style={s.totalsSubvalue}>{formatPercent(data.totals.margin_pct, 1)} of revenue</Text>
      </View>
    </View>
  );
}

function TotalsStripCustomer({ data }: { data: StatementData }) {
  const asp = data.totals.hits > 0 ? data.totals.revenue / data.totals.hits : 0;
  return (
    <View style={s.totalsStrip}>
      <View style={s.totalsCell}>
        <Text style={s.totalsLabel}>Total due</Text>
        <Text style={s.totalsValue}>{formatMoney(data.totals.revenue)}</Text>
        <Text style={s.totalsSubvalue}>Excl. taxes</Text>
      </View>
      <View style={[s.totalsCell, s.totalsCellDivider]}>
        <Text style={s.totalsLabel}>API calls</Text>
        <Text style={s.totalsValue}>{formatNumber(data.totals.hits)}</Text>
        <Text style={s.totalsSubvalue}>{data.totals.lines} APIs</Text>
      </View>
      <View style={[s.totalsCell, s.totalsCellDivider]}>
        <Text style={s.totalsLabel}>Avg per call</Text>
        <Text style={s.totalsValue}>{formatPrice(asp)}</Text>
        <Text style={s.totalsSubvalue}>Blended</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lines tables. Internal has 6 columns, customer has 4.

/**
 * What the margin above is measured against.
 *
 * The per-line "Est." chip says which lines were priced by a guess; this says
 * how much of the period they add up to. Internal only — a customer invoice
 * carries no cost to qualify. Frozen with the invoice on a finalized one, so
 * it describes the rates in force when it was cut.
 */
function CoverageNote({ data }: { data: StatementData }) {
  const c = data.cost_confidence;
  if (!c || c.hits === 0) return null;
  const share = confirmedShare(c);
  return (
    <Text style={s.coverageNote}>
      {share <= 0
        ? `Vendor cost is confirmed on none of this period's ${formatNumber(c.hits)} hits — the margin above is arithmetic, not a measurement.`
        : `Vendor cost is confirmed on ${formatShare(share)} of this period's ${formatNumber(c.hits)} hits. The rest is estimated or has no rate on file.`}
    </Text>
  );
}

function InternalLines({ lines }: { lines: StatementLine[] }) {
  return (
    <View>
      <View style={s.tableHeader}>
        <Text style={[s.th, { flex: 2.4 }]}>API</Text>
        <Text style={[s.th, { flex: 1.0, textAlign: "right" }]}>Hits</Text>
        <Text style={[s.th, { flex: 1.2, textAlign: "right" }]}>Unit price</Text>
        <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>Subtotal</Text>
        <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>Vendor cost</Text>
        <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>Margin</Text>
      </View>
      {lines.map((l) => {
        const isBad = l.margin < 0;
        const unitPrice = l.successful > 0 ? l.revenue / l.successful : 0;
        return (
          <View key={`${l.api_code}:${l.is_bundle ? "stitch" : "api"}`} style={isBad ? [s.tableRow, s.rowBad] : s.tableRow} wrap={false}>
            <View style={{ flex: 2.4, paddingRight: pdf.space[3] }}>
              <Text style={[s.td, s.apiName]}>{l.api_name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={s.apiCode}>{l.is_bundle ? "Stitched product" : l.api_code}</Text>
                {l.vendor_estimated && l.vendor_cost > 0 && (
                  <View style={s.estChip}>
                    <Text style={s.estChipText}>Est.</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={[s.tdMono, { flex: 1.0, textAlign: "right" }]}>{formatNumber(l.hits)}</Text>
            <Text style={[s.tdMono, { flex: 1.2, textAlign: "right" }]}>{formatPrice(unitPrice)}</Text>
            <Text style={[s.tdMono, { flex: 1.6, textAlign: "right" }]}>{formatMoney(l.revenue, { precision: 2 })}</Text>
            <Text style={[s.tdMono, { flex: 1.6, textAlign: "right" }]}>{formatMoney(l.vendor_cost, { precision: 2 })}</Text>
            <Text style={[s.tdMono, { flex: 1.6, textAlign: "right" }]}>{formatMoney(l.margin, { precision: 2 })}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CustomerLines({ lines }: { lines: StatementLine[] }) {
  return (
    <View>
      <View style={s.tableHeader}>
        <Text style={[s.th, { flex: 3.4 }]}>API</Text>
        <Text style={[s.th, { flex: 1.2, textAlign: "right" }]}>Calls</Text>
        <Text style={[s.th, { flex: 1.4, textAlign: "right" }]}>Unit price</Text>
        <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>Subtotal</Text>
      </View>
      {lines.map((l) => {
        const unitPrice = l.successful > 0 ? l.revenue / l.successful : 0;
        return (
          <View key={`${l.api_code}:${l.is_bundle ? "stitch" : "api"}`} style={s.tableRow} wrap={false}>
            <View style={{ flex: 3.4, paddingRight: pdf.space[3] }}>
              <Text style={[s.td, s.apiName]}>{l.api_name}</Text>
              <Text style={s.apiCode}>{l.is_bundle ? "Stitched product" : l.api_code}</Text>
            </View>
            <Text style={[s.tdMono, { flex: 1.2, textAlign: "right" }]}>{formatNumber(l.hits)}</Text>
            <Text style={[s.tdMono, { flex: 1.4, textAlign: "right" }]}>{formatPrice(unitPrice)}</Text>
            <Text style={[s.tdMono, { flex: 1.6, textAlign: "right" }]}>{formatMoney(l.revenue, { precision: 2 })}</Text>
          </View>
        );
      })}
    </View>
  );
}

function InternalTotalsRow({
  totals,
  hasAdjustments,
}: {
  totals: StatementData["totals"];
  hasAdjustments: boolean;
}) {
  return (
    // Column widths track InternalLines exactly; a totals figure is the widest
    // number in its column, so the two cannot be allowed to drift.
    <View style={s.totalsRow}>
      <Text style={[s.totalsLabelCell, { flex: 2.4 }]}>{hasAdjustments ? "Subtotal" : "Totals"}</Text>
      <Text style={[s.totalsValueCell, s.totalsValueInternal, { flex: 1.0, textAlign: "right" }]}>
        {formatNumber(totals.hits)}
      </Text>
      <View style={{ flex: 1.2 }} />
      <Text style={[s.totalsValueCell, s.totalsValueInternal, { flex: 1.6, textAlign: "right" }]}>
        {formatMoney(totals.revenue, { precision: 2 })}
      </Text>
      <Text style={[s.totalsValueCell, s.totalsValueInternal, { flex: 1.6, textAlign: "right" }]}>
        {formatMoney(totals.vendor_cost, { precision: 2 })}
      </Text>
      <Text style={[s.totalsValueCell, s.totalsValueInternal, { flex: 1.6, textAlign: "right" }]}>
        {formatMoney(totals.margin, { precision: 2 })}
      </Text>
    </View>
  );
}

function CustomerTotalsRow({
  totals,
  hasAdjustments,
}: {
  totals: StatementData["totals"];
  hasAdjustments: boolean;
}) {
  return (
    <View style={s.totalsRow}>
      <Text style={[s.totalsLabelCell, { flex: 3.4 }]}>
        {hasAdjustments ? "Subtotal" : "Total payable"}
      </Text>
      <Text style={[s.totalsValueCell, { flex: 1.2, textAlign: "right" }]}>
        {formatNumber(totals.hits)}
      </Text>
      <View style={{ flex: 1.4 }} />
      <Text style={[s.totalsValueCell, { flex: 1.6, textAlign: "right" }]}>
        {formatMoney(totals.revenue, { precision: 2 })}
      </Text>
    </View>
  );
}

function AdjustmentsBlock({
  adjustments,
  variant,
  subtotal,
}: {
  adjustments: StatementAdjustment[];
  variant: StatementVariant;
  subtotal: number;
}) {
  if (adjustments.length === 0) return null;
  return (
    <View style={s.adjustmentsSection}>
      <Text style={s.adjustmentsHeader}>Credits & adjustments</Text>
      <View>
        {adjustments.map((adj) => {
          const isCredit = adj.amount < 0;
          return (
            <View key={adj.id} style={s.adjustmentRow}>
              <View style={{ flex: 1, paddingRight: pdf.space[3] }}>
                <Text style={s.adjustmentLabel}>
                  {isCredit ? "Credit · " : "Charge · "}
                  {adj.label}
                </Text>
                {adj.notes && <Text style={s.adjustmentNotes}>{adj.notes}</Text>}
                {variant === "internal" && (
                  <Text style={s.adjustmentMeta}>
                    {(adj.created_by_email ?? "user")} · {formatStamp(adj.created_at)}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  s.adjustmentAmount,
                  isCredit ? s.adjustmentAmountCredit : s.adjustmentAmountCharge,
                ]}
              >
                {formatMoney(adj.amount, { precision: 2 })}
              </Text>
            </View>
          );
        })}
        <View style={s.adjustmentSubtotalRow}>
          <Text style={[s.adjustmentLabel, { color: pdf.color.inkMuted, textTransform: "uppercase", letterSpacing: 0.4, fontSize: pdf.text.xs }]}>
            Adjustments subtotal
          </Text>
          <Text
            style={[
              s.adjustmentAmount,
              subtotal < 0 ? s.adjustmentAmountCredit : s.adjustmentAmountCharge,
            ]}
          >
            {formatMoney(subtotal, { precision: 2 })}
          </Text>
        </View>
      </View>
    </View>
  );
}

function GrandTotalRow({ total }: { total: number }) {
  return (
    <View style={s.grandTotalRow}>
      <Text style={s.grandTotalLabel}>Grand total</Text>
      <Text style={s.grandTotalValue}>{formatMoney(total, { precision: 2 })}</Text>
    </View>
  );
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}

function ThankYou({ data }: { data: StatementData }) {
  return (
    <View style={s.thankYou}>
      <Text style={s.thankYouTitle}>Thank you for choosing Ledgerline.</Text>
      <Text style={s.thankYouBody}>
        This invoice covers API calls completed in the period above. Payments
        are due within 30 days of issue. For questions about line items or to
        reconcile against your usage logs, reply to billing@ledgerline.example with
        invoice number {data.header.number}.
      </Text>
    </View>
  );
}

function PdfFooter({ data, variant }: { data: StatementData; variant: StatementVariant }) {
  const gen = new Date(data.header.generated_at);
  const stamp =
    `${gen.toISOString().slice(0, 10)} ${gen.toISOString().slice(11, 16)} UTC`;
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>
        {variant === "internal" ? "Internal — for review " : "Ledgerline "}·{" "}
        Generated {stamp}
      </Text>
      <Text
        style={s.footerMono}
        render={({ pageNumber, totalPages }) =>
          `${data.header.number} · ${pageNumber}/${totalPages}`
        }
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports

export function InternalStatementPdf({ data }: { data: StatementData }) {
  return (
    <Document
      title={`Invoice ${data.header.number} — Internal`}
      author="Ledgerline Billing"
      subject={`${data.header.account.display_name} · ${data.header.period.label}`}
    >
      <Page size={pdf.page.size} style={s.page}>
        {data.header.status === "draft" && (
          <View style={s.draftBanner} fixed>
            <Text style={s.draftBannerText}>Draft · not for issue</Text>
          </View>
        )}
        <PdfHeader data={data} />
        <BillToPeriod data={data} />
        <TotalsStripInternal data={data} />
        <CoverageNote data={data} />
        <InternalLines lines={data.lines} />
        <InternalTotalsRow totals={data.totals} hasAdjustments={data.adjustments.length > 0} />
        <AdjustmentsBlock
          adjustments={data.adjustments}
          variant="internal"
          subtotal={data.totals.adjustments_total}
        />
        {data.adjustments.length > 0 && <GrandTotalRow total={data.totals.grand_total} />}
        <PdfFooter data={data} variant="internal" />
      </Page>
    </Document>
  );
}

export function CustomerStatementPdf({ data }: { data: StatementData }) {
  return (
    <Document
      title={`Invoice ${data.header.number}`}
      author="Ledgerline"
      subject={`${data.header.account.display_name} · ${data.header.period.label}`}
    >
      <Page size={pdf.page.size} style={s.page}>
        <PdfHeader data={data} />
        <BillToPeriod data={data} />
        <TotalsStripCustomer data={data} />
        <CustomerLines lines={data.lines} />
        <CustomerTotalsRow totals={data.totals} hasAdjustments={data.adjustments.length > 0} />
        <AdjustmentsBlock
          adjustments={data.adjustments}
          variant="customer"
          subtotal={data.totals.adjustments_total}
        />
        {data.adjustments.length > 0 && <GrandTotalRow total={data.totals.grand_total} />}
        <ThankYou data={data} />
        <PdfFooter data={data} variant="customer" />
      </Page>
    </Document>
  );
}
