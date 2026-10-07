"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import type { CostBasis, RateStatus } from "@/lib/repos/vendor-cost";
import { useSettleAfterSave } from "./useSettleAfterSave";

const OPTIONS: { value: CostBasis; label: string; hint: string }[] = [
  {
    value: "vendor",
    label: "A vendor bills us",
    hint: "The four rates on this row are what they charge.",
  },
  {
    value: "in_house",
    label: "In-house — no vendor bill",
    hint: "We serve this call ourselves. No invoice exists for it, so the cost is $0 by decision.",
  },
  {
    value: "components",
    label: "Counted on its components",
    hint: "A stitched or journey product. Its cost is real but sits on the SKUs it calls, which are costed on their own rows.",
  },
];

export const BASIS_LABEL: Record<CostBasis, string> = {
  vendor: "vendor",
  in_house: "in-house",
  components: "components",
};

type SaveState =
  | { k: "idle" }
  | { k: "saving" }
  | { k: "saved" }
  | { k: "error"; msg: string; suggested?: string };

/**
 * What kind of cost knowledge this pair has — and the control that sets it.
 *
 * The rate status (unrated / estimated / quoted / contracted) cannot express
 * that no vendor bills a pair at all. Without a basis, an in-house API at ₹0
 * cost reads the same as an API nobody has found a rate for. A basis of `in_house` or `components` makes the ₹0 a decision, and the
 * pair stops appearing on the unrated worklist.
 *
 * Changing the basis is a cost change like any other: a pair already marked
 * in-house has costed its elapsed days ₹0, so moving it back to `vendor` is
 * refused with the same 409 the rate editor gets, and needs a forward date.
 */
export function CostBasisCell({
  vendor_name,
  api_code,
  api_name,
  basis,
  status,
  hasRate,
  effectiveFrom,
  editable,
}: {
  vendor_name: string;
  api_code: string;
  api_name: string;
  /** Null when the pair has no rate row yet — treated as "vendor". */
  basis: CostBasis | null;
  status: RateStatus | null;
  /** True when a successful-hit rate exists on this row. */
  hasRate: boolean;
  effectiveFrom: string | null;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current: CostBasis = basis ?? "vendor";

  const display =
    current !== "vendor" ? (
      <span
        className="text-ink-muted"
        title={OPTIONS.find((o) => o.value === current)!.hint}
      >
        {BASIS_LABEL[current]}
      </span>
    ) : hasRate ? (
      <span>{status ?? "—"}</span>
    ) : (
      <span className="text-ink-faint" title="No rate, and no decision that one is unnecessary">
        unrated
      </span>
    );

  if (!editable) return <span className="whitespace-nowrap">{display}</span>;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex items-center px-1.5 py-1 rounded border whitespace-nowrap transition-colors duration-fast ease-expo ${
          open ? "border-accent bg-bg-raised" : "border-transparent hover:border-border"
        }`}
        title={`Set where ${api_code}'s cost comes from`}
      >
        {display}
      </button>
      {open && (
        <BasisPopover
          anchor={triggerRef.current}
          onClose={() => setOpen(false)}
          vendor_name={vendor_name}
          api_code={api_code}
          api_name={api_name}
          current={current}
          effectiveFrom={effectiveFrom}
        />
      )}
    </>
  );
}

function BasisPopover({
  anchor,
  onClose,
  vendor_name,
  api_code,
  api_name,
  current,
  effectiveFrom,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  vendor_name: string;
  api_code: string;
  api_name: string;
  current: CostBasis;
  effectiveFrom: string | null;
}) {
  const settle = useSettleAfterSave();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [choice, setChoice] = useState<CostBasis>(current);
  const [date, setDate] = useState(effectiveFrom ?? new Date().toISOString().slice(0, 10));
  const [save, setSave] = useState<SaveState>({ k: "idle" });

  // Anchored to the trigger's rect and portalled to the body: the rate table is
  // `overflow-hidden`, which clips an absolutely-positioned panel (Combobox
  // solves the same problem the same way).
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const width = 320;
    setPos({
      top: r.bottom + window.scrollY + 6,
      left: Math.min(r.left + window.scrollX, window.innerWidth - width - 16),
    });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && !anchor?.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [anchor, onClose]);

  async function submit() {
    setSave({ k: "saving" });
    try {
      const res = await fetch("/api/vendor-cost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendor_name,
          api_code,
          cost_basis: choice,
          effective_from: date,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSave({ k: "error", msg: json?.error ?? `Save failed (${res.status})`, suggested: json?.suggested });
        return;
      }
      setSave({ k: "saved" });
      settle(onClose);
    } catch (e) {
      setSave({ k: "error", msg: e instanceof Error ? e.message : "Save failed" });
    }
  }

  if (!pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Cost basis for ${api_name}`}
      className="fixed z-50 w-[320px] elev-1 bg-bg-raised rounded-md p-4 text-sm"
      style={{ top: pos.top - window.scrollY, left: pos.left - window.scrollX }}
    >
      <div className="text-xs text-ink-faint mb-1">{api_code}</div>
      <div className="text-ink mb-3" style={{ fontWeight: 500 }}>
        Where does this cost come from?
      </div>

      <div className="space-y-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex gap-2 items-start cursor-pointer rounded p-2 -m-1 hover:bg-bg-sunken"
          >
            <input
              type="radio"
              name="cost-basis"
              className="mt-[3px]"
              checked={choice === o.value}
              onChange={() => setChoice(o.value)}
            />
            <span className="min-w-0">
              <span className="block text-ink text-[13px]">{o.label}</span>
              <span className="block text-ink-muted text-[11px] leading-snug mt-[2px]">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <label className="block mt-3">
        <span className="block text-[11px] uppercase tracking-wide text-ink-faint mb-1">
          Effective from
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full elev-1 bg-bg rounded px-2 py-1.5 text-sm font-mono tnum"
        />
      </label>

      {save.k === "error" && (
        <div className="mt-3 text-[12px] text-bad-ink flex gap-1.5 items-start">
          <AlertTriangle size={13} strokeWidth={1.5} className="mt-[2px] shrink-0" />
          <span>
            {save.msg}
            {save.suggested && (
              <button
                type="button"
                onClick={() => {
                  setDate(save.suggested!);
                  setSave({ k: "idle" });
                }}
                className="ml-1 underline"
              >
                Use {save.suggested}
              </button>
            )}
          </span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-4">
        <button type="button" onClick={onClose} className="text-xs text-ink-muted px-2 py-1">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={save.k === "saving" || save.k === "saved" || choice === current}
          className="text-xs px-3 py-1.5 rounded bg-accent text-accent-ink disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {save.k === "saving" && <Loader2 size={12} className="animate-spin" />}
          {save.k === "saved" && <Check size={12} />}
          {save.k === "saved" ? "Saved" : "Save"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
