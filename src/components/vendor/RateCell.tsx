"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import type { RateStatus } from "@/lib/repos/vendor-cost";
import { formatPrice } from "@/lib/format";
import { useSettleAfterSave } from "./useSettleAfterSave";

export type CostField =
  | "cost_successful"
  | "cost_successful_no_data"
  | "cost_failed"
  | "cost_in_progress";

const FIELD_LABEL: Record<CostField, string> = {
  cost_successful: "Successful",
  cost_successful_no_data: "No data",
  cost_failed: "Failed",
  cost_in_progress: "In progress",
};

const STATUSES: { value: RateStatus; label: string; hint: string }[] = [
  { value: "estimated", label: "Estimated", hint: "A guess. No document behind it." },
  { value: "quoted", label: "Quoted", hint: "A price the vendor gave us." },
  { value: "contracted", label: "Contracted", hint: "A rate in a signed agreement." },
];

/** First of next month — a rate change applies forward, not to days already counted. */
function firstOfNextMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const next = new Date(Date.UTC(m === 11 ? y + 1 : y, (m + 1) % 12, 1));
  return next.toISOString().slice(0, 10);
}

type ValueMode = "amount" | "zero" | "unknown";
type SaveState =
  | { k: "idle" }
  | { k: "saving" }
  | { k: "saved" }
  | { k: "error"; msg: string; suggested?: string };

/**
 * One outcome's vendor rate: what it is, and the editor that changes it.
 *
 * Three display states, kept visually distinct:
 *   - unknown        an em dash. Nobody has told us this rate.
 *   - not charged    a confirmed zero. The vendor does not bill this outcome.
 *   - an amount      the rate.
 *
 * Editing opens a popover rather than typing in place. A rate is not just a
 * number: it starts on a date, it has a status, and confirming it needs a
 * source. Typing into a bare cell could not express any of that.
 *
 * The panel is portalled and anchored to the cell rect, the same approach
 * Combobox uses and for the same reason: these cells sit in tables with
 * `overflow-hidden`, which clips an absolutely-positioned panel.
 */
export function RateCell({
  vendor_name,
  api_code,
  api_name,
  field,
  value,
  status,
  source,
  effectiveFrom,
  neverPriced,
  editable,
}: {
  vendor_name: string;
  api_code: string;
  api_name: string;
  field: CostField;
  value: number | null;
  status: RateStatus | null;
  source: string | null;
  /** Effective date of the rate in force, or null when the pair has no row. */
  effectiveFrom: string | null;
  /** True when no outcome on this row has a cost yet. */
  neverPriced: boolean;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const display =
    value == null ? (
      <span className="text-ink-faint" title="Rate unknown — nobody has told us this one">
        —
      </span>
    ) : value === 0 ? (
      <span className="text-ink-muted text-xs" title="Confirmed: the vendor does not charge for this outcome">
        not charged
      </span>
    ) : (
      <span className="tnum">{formatPrice(value)}</span>
    );

  if (!editable) {
    return (
      <span className="inline-flex items-center justify-end px-1.5 py-1 text-sm font-mono whitespace-nowrap min-w-[7ch]">
        {display}
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex items-center justify-end px-1.5 py-1 rounded border text-sm font-mono whitespace-nowrap min-w-[7ch] transition-colors duration-fast ease-expo ${
          open ? "border-accent bg-bg-raised" : "border-transparent hover:border-border"
        }`}
        title={`Edit the ${FIELD_LABEL[field].toLowerCase()} rate for ${api_code}`}
      >
        {display}
      </button>
      {open && (
        <RateEditPopover
          anchor={triggerRef.current}
          onClose={() => setOpen(false)}
          vendor_name={vendor_name}
          api_code={api_code}
          api_name={api_name}
          field={field}
          value={value}
          status={status}
          source={source}
          effectiveFrom={effectiveFrom}
          neverPriced={neverPriced}
        />
      )}
    </>
  );
}

const PANEL_W = 300;

function RateEditPopover({
  anchor,
  onClose,
  vendor_name,
  api_code,
  api_name,
  field,
  value,
  status,
  source,
  effectiveFrom,
  neverPriced,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  vendor_name: string;
  api_code: string;
  api_name: string;
  field: CostField;
  value: number | null;
  status: RateStatus | null;
  source: string | null;
  effectiveFrom: string | null;
  neverPriced: boolean;
}) {
  const settle = useSettleAfterSave();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  const [mode, setMode] = useState<ValueMode>(value == null ? "unknown" : value === 0 ? "zero" : "amount");
  const [amount, setAmount] = useState(value != null && value !== 0 ? String(value) : "");
  // A rate nobody has set yet is not a change — it is the rate that was always
  // in force, so it takes effect from the row's own start date and prices the
  // history. Changing a rate that already costed days applies forward instead.
  const [date, setDate] = useState(
    neverPriced && effectiveFrom ? effectiveFrom : firstOfNextMonth(),
  );
  const [st, setSt] = useState<RateStatus>(status ?? "estimated");
  const [src, setSrc] = useState(source ?? "");
  const [save, setSave] = useState<SaveState>({ k: "idle" });

  const reposition = () => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const placeAbove = spaceBelow < 320 && r.top > spaceBelow;
    setCoords({
      left: Math.max(12, Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 12)),
      top: placeAbove ? undefined : r.bottom + 4,
      bottom: placeAbove ? window.innerHeight - r.top + 4 : undefined,
    });
  };

  useLayoutEffect(() => {
    reposition();
    requestAnimationFrame(() => inputRef.current?.focus());
    const onMove = () => reposition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchor?.contains(t) || panelRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  const needsSource = st !== "estimated" && src.trim() === "";
  const parsed = mode === "amount" ? Number(amount) : mode === "zero" ? 0 : null;
  const badAmount = mode === "amount" && (!Number.isFinite(parsed as number) || (parsed as number) < 0);
  const canSave =
    save.k !== "saving" &&
    save.k !== "saved" &&
    !needsSource &&
    !badAmount &&
    !(mode === "amount" && amount.trim() === "");

  const submit = async (overrideDate?: string) => {
    const effective = overrideDate ?? date;
    setSave({ k: "saving" });
    try {
      const res = await fetch("/api/vendor-cost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendor_name,
          api_code,
          [field]: parsed,
          status: st,
          source: src.trim() === "" ? null : src.trim(),
          effective_from: effective,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setSave({
          k: "error",
          msg: data?.error ?? `Save failed (${res.status}).`,
          suggested: data?.suggested_effective_from,
        });
        return;
      }
      setSave({ k: "saved" });
      settle(onClose);
    } catch {
      setSave({ k: "error", msg: "Could not reach the server. Check your connection and retry." });
    }
  };

  if (!coords) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${FIELD_LABEL[field]} rate for ${api_code}`}
      className="fixed z-50 bg-bg-raised elev-1 rounded-md p-3 popover-in"
      style={{ left: coords.left, top: coords.top, bottom: coords.bottom, width: PANEL_W }}
    >
      <div className="text-xs text-ink-muted mb-2">
        <span className="font-mono text-ink">{api_code}</span> · {FIELD_LABEL[field]}
        <div className="text-[10px] text-ink-faint truncate" title={api_name}>
          {api_name}
        </div>
      </div>

      <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">Rate</label>
      <div className="flex items-center gap-1.5 mb-2">
        <label
          className={`flex-1 inline-flex items-center gap-1 px-2 py-1 rounded border text-sm ${
            mode === "amount" ? "border-accent bg-bg" : "border-border bg-bg"
          }`}
        >
          <span className="text-ink-faint text-xs">₹</span>
          <input
            ref={inputRef}
            value={amount}
            inputMode="decimal"
            placeholder="0.0000"
            onFocus={() => setMode("amount")}
            onChange={(e) => {
              setAmount(e.target.value);
              setMode("amount");
              if (save.k === "error") setSave({ k: "idle" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) submit();
            }}
            className="w-full bg-transparent font-mono text-sm tnum focus:outline-none placeholder:text-ink-faint"
          />
        </label>
      </div>
      <div className="flex gap-1.5 mb-3">
        <ModeButton active={mode === "zero"} onClick={() => setMode("zero")} title="The vendor confirmed it does not charge for this outcome">
          Not charged
        </ModeButton>
        <ModeButton active={mode === "unknown"} onClick={() => setMode("unknown")} title="Clear the rate back to unknown">
          Unknown
        </ModeButton>
      </div>

      <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
        Effective from
      </label>
      <input
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          if (save.k === "error") setSave({ k: "idle" });
        }}
        className="w-full px-2 py-1 mb-1 rounded border border-border bg-bg font-mono text-sm tnum focus:outline-none focus:border-accent"
      />
      <div className="text-[10px] text-ink-faint mb-3">
        {neverPriced
          ? "First rate for this pair — applies to all usage from this date."
          : "A new rate starts on this date. Past days keep the rate they were costed at."}
      </div>

      <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">Status</label>
      <div className="flex gap-1 mb-2" role="group" aria-label="Rate status">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            title={s.hint}
            aria-pressed={st === s.value}
            onClick={() => setSt(s.value)}
            className={`flex-1 px-1.5 py-1 rounded border text-[11px] transition-colors duration-fast ease-expo ${
              st === s.value
                ? "border-ink-muted bg-bg-sunken text-ink"
                : "border-border text-ink-muted hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
        Source {st !== "estimated" && <span className="text-warn-ink">required</span>}
      </label>
      <input
        value={src}
        placeholder="Agreement, email, or a note"
        onChange={(e) => setSrc(e.target.value)}
        className="w-full px-2 py-1 rounded border border-border bg-bg text-sm focus:outline-none focus:border-accent"
      />
      {needsSource && (
        <div className="text-[10px] text-warn-ink mt-1">
          A quoted or contracted rate needs a source, so the next reader knows where it came from.
        </div>
      )}

      {save.k === "error" && (
        <div className="mt-3 p-2 rounded bg-bad-bg text-bad-ink text-[11px] leading-snug">
          <div className="flex items-start gap-1.5">
            <AlertTriangle size={12} strokeWidth={1.5} className="shrink-0 mt-0.5" />
            <div>
              <div>{save.msg}</div>
              <div className="flex gap-2 mt-1.5">
                <button type="button" onClick={() => submit()} className="underline">
                  Retry
                </button>
                {save.suggested && (
                  <button
                    type="button"
                    onClick={() => {
                      setDate(save.suggested!);
                      submit(save.suggested);
                    }}
                    className="underline"
                  >
                    Use {save.suggested}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-ink-muted hover:text-ink px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => submit()}
          disabled={!canSave}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-accent text-bg disabled:opacity-40 active:scale-[0.97] transition-transform duration-fast ease-expo"
        >
          {save.k === "saving" && <Loader2 size={12} strokeWidth={2} className="animate-spin" />}
          {save.k === "saved" && <Check size={12} strokeWidth={2} />}
          {save.k === "saving" ? "Saving…" : save.k === "saved" ? "Saved" : "Save"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function ModeButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`flex-1 px-1.5 py-1 rounded border text-[11px] transition-colors duration-fast ease-expo ${
        active ? "border-ink-muted bg-bg-sunken text-ink" : "border-border text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
