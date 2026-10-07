"use client";

import { useState } from "react";
import { Layers, Pencil } from "lucide-react";
import { VolumeCostModal } from "./VolumeCostModal";
import { formatPrice } from "@/lib/format";
import type { RateStatus, VendorSlabTier } from "@/lib/repos/vendor-cost";

/**
 * The volume-pricing affordance on a rate card row.
 *
 * Two shapes, because a pair is in one of two states:
 *   chip     the pair is on flat rates. A quiet way in, beside the API name,
 *            the same place the account pricing table puts its own.
 *   summary  the pair prices by brackets. Its four flat cost cells would all
 *            read ₹0 and invite someone to type over a ladder, so they are
 *            replaced by one cell that states the ladder and opens the editor.
 */
export function VolumeCostCell({
  variant,
  vendorName,
  apiCode,
  apiName,
  model,
  slabs,
  status,
  source,
  effectiveFrom,
  neverPriced,
  editable,
}: {
  variant: "chip" | "summary";
  vendorName: string;
  apiCode: string;
  apiName: string;
  model: "flat" | "slab" | "tier";
  slabs: VendorSlabTier[];
  status: RateStatus | null;
  source: string | null;
  effectiveFrom: string | null;
  neverPriced: boolean;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);

  const modal = (
    <VolumeCostModal
      open={open}
      onOpenChange={setOpen}
      vendorName={vendorName}
      apiCode={apiCode}
      apiName={apiName}
      initialModel={model}
      initialSlabs={slabs}
      status={status}
      source={source}
      effectiveFrom={effectiveFrom}
      neverPriced={neverPriced}
    />
  );

  if (variant === "chip") {
    if (!editable) return null;
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          title="Price this pair by volume — brackets on the month's total units"
          className="inline-flex items-center gap-0.5 text-[10px] text-ink-faint hover:text-accent-ink px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-border transition-colors"
        >
          <Layers size={9} strokeWidth={1.75} />
          volume
        </button>
        {modal}
      </>
    );
  }

  const label = model === "tier" ? "Tiered (graduated)" : "Slab (whole-volume)";
  const ladder = slabs.map((s) => formatPrice(s.cost_successful ?? 0)).join(" → ");
  const body = (
    <span className="text-xs text-ink">
      {label} &middot; {slabs.length} bracket{slabs.length === 1 ? "" : "s"}
      {ladder && <span className="text-ink-faint font-mono ml-2">{ladder}</span>}
    </span>
  );

  if (!editable) {
    return (
      <span className="inline-flex items-center gap-2 rounded border border-border px-2.5 py-1.5">
        <Layers size={13} strokeWidth={1.75} className="text-ink-faint shrink-0" />
        {body}
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-left rounded border border-accent/30 bg-accent-bg/40 px-2.5 py-1.5 hover:bg-accent-bg transition-colors group"
      >
        <Layers size={13} strokeWidth={1.75} className="text-accent-ink shrink-0" />
        {body}
        <Pencil
          size={11}
          strokeWidth={1.75}
          className="text-ink-faint group-hover:text-accent-ink shrink-0"
        />
      </button>
      {modal}
    </>
  );
}
