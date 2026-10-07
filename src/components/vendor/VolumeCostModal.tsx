"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, Trash2, AlertCircle, AlertTriangle, Check, Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TierLadder } from "@/components/pricing/TierLadder";
import { validateSlabs, type VolumeModel } from "@/lib/pricing/slabs";
import type { RateStatus, VendorSlabTier } from "@/lib/repos/vendor-cost";
import { useSettleAfterSave } from "./useSettleAfterSave";

// A vendor rate that changes with volume.
//
// The bracket editor is the client-side SlabModal's, deliberately: the same
// string-typed rows, the same derived `minOf` (which is why a gap or an overlap
// cannot be expressed here at all), the same add/remove semantics, and the same
// `validateSlabs` on submit. A ladder typed against a vendor contract and one
// typed against a client contract are the same object, so they get the same
// editor and the same rules.
//
// What is added is everything a vendor rate carries that a client price does
// not: it starts on a date, it has a status, and confirming it needs a source.
// Those are the three fields RateCell collects for a flat rate, on the same
// terms, so switching a pair to volume pricing is as dated and as attributable
// as typing a number into one of its cells.

const COST_FIELDS = [
  { key: "cost_successful", label: "Successful" },
  { key: "cost_successful_no_data", label: "No data" },
  { key: "cost_failed", label: "Failed" },
  { key: "cost_in_progress", label: "In progress" },
] as const;

type CostKey = (typeof COST_FIELDS)[number]["key"];

const STATUSES: { value: RateStatus; label: string; hint: string }[] = [
  { value: "estimated", label: "Estimated", hint: "A guess. No document behind it." },
  { value: "quoted", label: "Quoted", hint: "A price the vendor gave us." },
  { value: "contracted", label: "Contracted", hint: "A rate in a signed agreement." },
];

/** Editor row: the cap is a string so it can be typed freely ("" on the top bracket). */
type EditTier = { capStr: string } & Record<CostKey, string>;

const EMPTY: EditTier = {
  capStr: "",
  cost_successful: "",
  cost_successful_no_data: "",
  cost_failed: "",
  cost_in_progress: "",
};

function toEdit(t: VendorSlabTier): EditTier {
  const n = (v: number | null) => (v == null || v === 0 ? "" : String(v));
  return {
    capStr: t.max_hits == null ? "" : String(t.max_hits),
    cost_successful: n(t.cost_successful),
    cost_successful_no_data: n(t.cost_successful_no_data),
    cost_failed: n(t.cost_failed),
    cost_in_progress: n(t.cost_in_progress),
  };
}

/** First of next month — a rate change applies forward, not to days already counted. */
function firstOfNextMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return new Date(Date.UTC(m === 11 ? y + 1 : y, (m + 1) % 12, 1)).toISOString().slice(0, 10);
}

type SaveState =
  | { k: "idle" }
  | { k: "saving" }
  | { k: "saved" }
  | { k: "error"; msg: string; suggested?: string };

export function VolumeCostModal({
  open,
  onOpenChange,
  vendorName,
  apiCode,
  apiName,
  initialModel,
  initialSlabs,
  status,
  source,
  effectiveFrom,
  neverPriced,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vendorName: string;
  apiCode: string;
  apiName: string;
  /** "flat" when the pair has no ladder yet; the editor then opens on Slab. */
  initialModel: "flat" | "slab" | "tier";
  initialSlabs: VendorSlabTier[];
  status: RateStatus | null;
  source: string | null;
  /** Effective date of the rate in force, or null when the pair has no row. */
  effectiveFrom: string | null;
  /** True when no outcome on this row has a cost yet and it has no ladder. */
  neverPriced: boolean;
}) {
  const settle = useSettleAfterSave();
  const wasVolume = initialModel !== "flat";

  const [tiers, setTiers] = useState<EditTier[]>(() =>
    initialSlabs.length > 0 ? initialSlabs.map(toEdit) : [{ ...EMPTY }]
  );
  const [model, setModel] = useState<VolumeModel>(wasVolume ? (initialModel as VolumeModel) : "slab");
  // A rate nobody has set yet is not a change — it is the rate that was always
  // in force, so it takes effect from the row's own start date and prices the
  // history. Changing a rate that already costed days applies forward instead.
  const [date, setDate] = useState(
    neverPriced && effectiveFrom ? effectiveFrom : firstOfNextMonth()
  );
  const [st, setSt] = useState<RateStatus>(status ?? "estimated");
  const [src, setSrc] = useState(source ?? "");
  const [error, setError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ k: "idle" });

  // Reset each time the dialog opens for a (possibly different) row.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (open && openedFor !== apiCode) {
    setOpenedFor(apiCode);
    setTiers(initialSlabs.length > 0 ? initialSlabs.map(toEdit) : [{ ...EMPTY }]);
    setModel(wasVolume ? (initialModel as VolumeModel) : "slab");
    setDate(neverPriced && effectiveFrom ? effectiveFrom : firstOfNextMonth());
    setSt(status ?? "estimated");
    setSrc(source ?? "");
    setError(null);
    setSave({ k: "idle" });
  }
  if (!open && openedFor !== null) setOpenedFor(null);

  // The start of bracket i is the parsed cap of bracket i-1 (0 for the first),
  // so a gap or an overlap cannot be expressed.
  function minOf(i: number): number {
    if (i === 0) return 0;
    const prev = parseInt(tiers[i - 1].capStr, 10);
    return Number.isFinite(prev) ? prev : 0;
  }

  function setTier(i: number, patch: Partial<EditTier>) {
    setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setTiers((ts) => {
      const last = ts[ts.length - 1];
      // The previously open bracket needs a cap; seed it just above its start
      // so it is valid-shaped, and carry its costs into the new open bracket.
      const prevMin = ts.length === 1 ? 0 : parseInt(ts[ts.length - 2].capStr, 10) || 0;
      const seededCap = last.capStr === "" ? String(prevMin + 10000) : last.capStr;
      const closed = { ...last, capStr: seededCap };
      const next: EditTier = {
        ...EMPTY,
        cost_successful: last.cost_successful,
        cost_successful_no_data: last.cost_successful_no_data,
        cost_failed: last.cost_failed,
        cost_in_progress: last.cost_in_progress,
      };
      return [...ts.slice(0, -1), closed, next];
    });
  }

  function removeTier(i: number) {
    setTiers((ts) => {
      if (ts.length === 1) return ts;
      const next = ts.filter((_, j) => j !== i);
      // The new last bracket is always open-ended.
      next[next.length - 1] = { ...next[next.length - 1], capStr: "" };
      return next;
    });
  }

  function build(): VendorSlabTier[] {
    return tiers.map((t, i) => ({
      min_hits: minOf(i),
      max_hits: i === tiers.length - 1 ? null : parseInt(t.capStr, 10),
      // An empty box is 0, not unknown: a bracket set is entered from a rate
      // sheet in one sitting, so a blank column means "this outcome is not
      // charged in this bracket" the way it does on the client side.
      cost_successful: parseFloat(t.cost_successful) || 0,
      cost_successful_no_data: parseFloat(t.cost_successful_no_data) || 0,
      cost_failed: parseFloat(t.cost_failed) || 0,
      cost_in_progress: parseFloat(t.cost_in_progress) || 0,
    }));
  }

  const needsSource = st !== "estimated" && src.trim() === "";

  async function post(body: Record<string, unknown>, overrideDate?: string) {
    setSave({ k: "saving" });
    try {
      const res = await fetch("/api/vendor-cost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendor_name: vendorName,
          api_code: apiCode,
          status: st,
          source: src.trim() === "" ? null : src.trim(),
          effective_from: overrideDate ?? date,
          ...body,
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
      settle(() => onOpenChange(false));
    } catch {
      setSave({ k: "error", msg: "Could not reach the server. Check your connection and retry." });
    }
  }

  function submit(overrideDate?: string) {
    const built = build();
    const err = validateSlabs(
      built.map((b) => ({
        min_hits: b.min_hits,
        max_hits: b.max_hits,
        price_successful: b.cost_successful ?? 0,
        price_successful_no_data: b.cost_successful_no_data ?? 0,
        price_failed: b.cost_failed ?? 0,
        price_in_progress: b.cost_in_progress ?? 0,
      }))
    );
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    void post({ pricing_model: model, slabs: built }, overrideDate);
  }

  /** Drop the ladder and go back to four flat rates, on the same dated terms. */
  function revertToFlat() {
    setError(null);
    void post({ pricing_model: "flat" });
  }

  const canSave = save.k !== "saving" && save.k !== "saved" && !needsSource;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content
          aria-describedby="vendor-volume-desc"
          className={[
            "fixed z-50 left-1/2 top-[6vh] -translate-x-1/2",
            "w-full max-w-[680px] bg-bg-raised rounded-lg border border-border shadow-high",
            "p-6 focus:outline-none max-h-[88vh] overflow-y-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-150",
          ].join(" ")}
        >
          <div className="flex items-center justify-between mb-2">
            <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Layers size={16} strokeWidth={1.75} className="text-accent-ink" />
              Volume cost
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded p-1 text-ink-faint hover:text-ink hover:bg-bg-sunken transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description id="vendor-volume-desc" className="text-xs text-ink-muted mb-3">
            {vendorName} · <span className="text-ink">{apiName}</span>{" "}
            <span className="font-mono text-ink-faint">{apiCode}</span>
          </Dialog.Description>

          <div className="inline-flex rounded border border-border bg-bg-sunken p-0.5 mb-3">
            {(
              [
                { key: "slab", label: "Slab" },
                { key: "tier", label: "Tiered" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                onClick={() => setModel(m.key)}
                className={[
                  "px-3 py-1 text-xs rounded transition-colors",
                  model === m.key
                    ? "bg-bg-raised text-ink shadow-low border border-border"
                    : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-ink-faint mb-5">
            {model === "slab" ? (
              <>
                <span className="text-ink-muted">Slab (whole-volume):</span> the month bills
                at the single bracket its total hits land in. A month of 45,000 hits with
                brackets 0&ndash;40k @ &#8377;15 and 40k+ @ &#8377;13 costs all 45,000 &times;
                &#8377;13.
              </>
            ) : (
              <>
                <span className="text-ink-muted">Tiered (graduated):</span> costs are
                graduated on the month&rsquo;s total hits, like tax brackets. The same 45,000
                hits cost 40,000 &times; &#8377;15 + 5,000 &times; &#8377;13.
              </>
            )}{" "}
            Brackets reset every calendar month, and count{" "}
            <span className="text-ink-muted">every account&rsquo;s</span> hits on this API
            from {vendorName} — that is the volume {vendorName} invoices.
          </p>

          <div className="mb-4">
            <TierLadder
              model={model}
              brackets={tiers.map((t, i) => ({
                min: minOf(i),
                cap: i === tiers.length - 1 ? null : parseInt(t.capStr, 10) || 0,
                price: parseFloat(t.cost_successful) || 0,
              }))}
              onCapChange={(i, cap) => setTier(i, { capStr: String(cap) })}
            />
          </div>

          <div className="rounded border border-border overflow-hidden">
            <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "32%" }} />
                <col />
                <col />
                <col />
                <col />
                <col style={{ width: 36 }} />
              </colgroup>
              <thead className="bg-bg-sunken text-ink-faint text-[10px] uppercase tracking-wide">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Hits range</th>
                  {COST_FIELDS.map((f) => (
                    <th key={f.key} className="px-2 py-2 font-medium text-right">
                      {f.label}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tiers.map((t, i) => {
                  const isLast = i === tiers.length - 1;
                  const min = minOf(i);
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2 align-middle">
                        {isLast ? (
                          <span className="text-xs font-mono text-ink-muted">
                            {min.toLocaleString("en-IN")}+ &nbsp;and above
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-mono text-ink-muted">
                            <span className="shrink-0">{min.toLocaleString("en-IN")}</span>
                            <span className="text-ink-faint shrink-0">&ndash;</span>
                            <input
                              value={t.capStr}
                              inputMode="numeric"
                              placeholder="cap"
                              onChange={(e) =>
                                setTier(i, { capStr: e.target.value.replace(/[^0-9]/g, "") })
                              }
                              className="w-full min-w-0 rounded border border-border bg-bg px-1.5 py-1 text-right tnum focus:border-accent focus:outline-none"
                            />
                          </span>
                        )}
                      </td>
                      {COST_FIELDS.map((f) => (
                        <td key={f.key} className="px-2 py-2">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded border border-border bg-bg w-full text-sm focus-within:border-accent">
                            <span className="text-ink-faint text-xs shrink-0">&#8377;</span>
                            <input
                              value={t[f.key]}
                              placeholder="0"
                              onChange={(e) =>
                                setTier(i, { [f.key]: e.target.value } as Partial<EditTier>)
                              }
                              className="flex-1 min-w-0 bg-transparent font-mono text-sm text-right tnum focus:outline-none placeholder:text-ink-faint"
                            />
                          </span>
                        </td>
                      ))}
                      <td className="px-1 py-2 text-center">
                        {tiers.length > 1 && (
                          <button
                            onClick={() => removeTier(i)}
                            title="Remove bracket"
                            className="p-1 rounded hover:bg-bg-sunken text-ink-faint hover:text-bad-ink transition-colors"
                          >
                            <Trash2 size={13} strokeWidth={1.75} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={addTier}
            className="mt-3 inline-flex items-center gap-1 text-xs text-accent-ink hover:underline underline-offset-2"
          >
            <Plus size={13} strokeWidth={1.75} /> Add bracket
          </button>

          <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-border">
            <div>
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
                className="w-full px-2 py-1 rounded border border-border bg-bg font-mono text-sm tnum focus:outline-none focus:border-accent"
              />
              <div className="text-[10px] text-ink-faint mt-1">
                {neverPriced
                  ? "First rate for this pair — applies to all usage from this date."
                  : "A new rate starts on this date. Past days keep the cost they were billed at."}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
                Status
              </label>
              <div className="flex gap-1" role="group" aria-label="Rate status">
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
            </div>
          </div>

          <label className="block text-[10px] uppercase tracking-wide text-ink-faint mt-4 mb-1">
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
              A quoted or contracted rate needs a source, so the next reader knows where it
              came from.
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-bad-ink mt-3">
              <AlertCircle size={13} strokeWidth={1.75} className="shrink-0" />
              {error}
            </p>
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

          <div className="flex items-center justify-between gap-2 pt-5">
            <div>
              {wasVolume && (
                <button
                  type="button"
                  onClick={revertToFlat}
                  disabled={save.k === "saving"}
                  className="text-xs text-ink-muted hover:text-ink underline underline-offset-2 disabled:opacity-40"
                  title="Drop the brackets and go back to four flat rates, from the date above"
                >
                  Use flat rates instead
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button variant="primary" size="sm" onClick={() => submit()} disabled={!canSave}>
                {save.k === "saving" && (
                  <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                )}
                {save.k === "saved" && <Check size={12} strokeWidth={2} />}
                {save.k === "saving"
                  ? "Saving…"
                  : save.k === "saved"
                    ? "Saved"
                    : `Save ${model === "tier" ? "tiers" : "slabs"}`}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
