"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, Trash2, AlertCircle, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { validateSlabs, type VolumeModel } from "@/lib/pricing/slabs";
import type { SlabTier } from "@/lib/repos/pricing";
import { TierLadder } from "@/components/pricing/TierLadder";

const PRICE_FIELDS = [
  { key: "price_successful", label: "S" },
  { key: "price_successful_no_data", label: "ND" },
  { key: "price_failed", label: "F" },
  { key: "price_in_progress", label: "IP" },
] as const;

type PriceKey = (typeof PRICE_FIELDS)[number]["key"];

// Editor row: cap is a string for free typing ("" on the open top tier).
type EditTier = { capStr: string } & Record<PriceKey, string>;

function toEdit(t: SlabTier): EditTier {
  return {
    capStr: t.max_hits == null ? "" : String(t.max_hits),
    price_successful: t.price_successful ? String(t.price_successful) : "",
    price_successful_no_data: t.price_successful_no_data ? String(t.price_successful_no_data) : "",
    price_failed: t.price_failed ? String(t.price_failed) : "",
    price_in_progress: t.price_in_progress ? String(t.price_in_progress) : "",
  };
}

const EMPTY: EditTier = {
  capStr: "",
  price_successful: "",
  price_successful_no_data: "",
  price_failed: "",
  price_in_progress: "",
};

export function SlabModal({
  open,
  onOpenChange,
  apiName,
  apiCode,
  initialModel,
  initialSlabs,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  apiName: string;
  apiCode: string;
  initialModel: VolumeModel;
  initialSlabs: SlabTier[];
  onSave: (model: VolumeModel, slabs: SlabTier[]) => void;
}) {
  const [tiers, setTiers] = useState<EditTier[]>(() =>
    initialSlabs.length > 0 ? initialSlabs.map(toEdit) : [{ ...EMPTY }]
  );
  const [model, setModel] = useState<VolumeModel>(initialModel);
  const [error, setError] = useState<string | null>(null);

  // Reset editor state each time the dialog opens for a (possibly different) row.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (open && openedFor !== apiCode) {
    setOpenedFor(apiCode);
    setTiers(initialSlabs.length > 0 ? initialSlabs.map(toEdit) : [{ ...EMPTY }]);
    setModel(initialModel);
    setError(null);
  }
  if (!open && openedFor !== null) setOpenedFor(null);

  // min of tier i = parsed cap of tier i-1 (0 for the first).
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
      // The previously open tier needs a cap; seed it just above its start so
      // it's valid-shaped, and carry its prices into the new open tier.
      const prevMin = ts.length === 1 ? 0 : parseInt(ts[ts.length - 2].capStr, 10) || 0;
      const seededCap = last.capStr === "" ? String(prevMin + 10000) : last.capStr;
      const closed = { ...last, capStr: seededCap };
      const next: EditTier = {
        ...EMPTY,
        price_successful: last.price_successful,
        price_successful_no_data: last.price_successful_no_data,
        price_failed: last.price_failed,
        price_in_progress: last.price_in_progress,
      };
      return [...ts.slice(0, -1), closed, next];
    });
  }

  function removeTier(i: number) {
    setTiers((ts) => {
      if (ts.length === 1) return ts;
      const next = ts.filter((_, j) => j !== i);
      // The new last tier is always open-ended.
      next[next.length - 1] = { ...next[next.length - 1], capStr: "" };
      return next;
    });
  }

  function build(): SlabTier[] {
    return tiers.map((t, i) => ({
      min_hits: minOf(i),
      max_hits: i === tiers.length - 1 ? null : parseInt(t.capStr, 10),
      price_successful: parseFloat(t.price_successful) || 0,
      price_successful_no_data: parseFloat(t.price_successful_no_data) || 0,
      price_failed: parseFloat(t.price_failed) || 0,
      price_in_progress: parseFloat(t.price_in_progress) || 0,
    }));
  }

  function submit() {
    const built = build();
    const err = validateSlabs(built);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSave(model, built);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content
          aria-describedby="slab-modal-desc"
          className={[
            "fixed z-50 left-1/2 top-[10vh] -translate-x-1/2",
            "w-full max-w-[640px] bg-bg-raised rounded-lg border border-border shadow-high",
            "p-6 focus:outline-none max-h-[80vh] overflow-y-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-150",
          ].join(" ")}
        >
          <div className="flex items-center justify-between mb-2">
            <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Layers size={16} strokeWidth={1.75} className="text-accent-ink" />
              Volume pricing
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

          <Dialog.Description id="slab-modal-desc" className="text-xs text-ink-muted mb-3">
            <span className="text-ink">{apiName}</span>{" "}
            <span className="font-mono text-ink-faint">{apiCode}</span>
          </Dialog.Description>

          {/* Model selector — Slab (whole-volume) is the default. */}
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
                <span className="text-ink-muted">Slab (whole-volume):</span> the whole
                period bills at the single bracket its total hits land in. A month of
                45,000 hits with brackets 0–40k @ ₹15 and 40k+ @ ₹13 bills all 45,000 ×
                ₹13. Crossing a threshold re-prices the entire volume.
              </>
            ) : (
              <>
                <span className="text-ink-muted">Tiered (graduated):</span> rates are
                graduated on the period’s total hits — like tax brackets. The same 45,000
                hits bill 40,000 × ₹15 + 5,000 × ₹13.
              </>
            )}{" "}
            Each bracket can price the four outcomes (S / ND / F / IP) separately; leave a
            column at 0 if it isn’t billed.
          </p>

          {/* Visual ladder — drag the boundaries; the curve shows the charge shape. */}
          <div className="mb-4">
            <TierLadder
              model={model}
              brackets={tiers.map((t, i) => ({
                min: minOf(i),
                cap: i === tiers.length - 1 ? null : parseInt(t.capStr, 10) || 0,
                price: parseFloat(t.price_successful) || 0,
              }))}
              onCapChange={(i, cap) => setTier(i, { capStr: String(cap) })}
            />
          </div>

          <div className="rounded border border-border overflow-hidden">
            <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "34%" }} />
                <col />
                <col />
                <col />
                <col />
                <col style={{ width: 36 }} />
              </colgroup>
              <thead className="bg-bg-sunken text-ink-faint text-[11px] uppercase tracking-wide">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Hits range</th>
                  {PRICE_FIELDS.map((f) => (
                    <th key={f.key} className="px-2 py-2 font-medium text-right">
                      {f.label} ₹
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
                            <span className="text-ink-faint shrink-0">–</span>
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
                      {PRICE_FIELDS.map((f) => (
                        <td key={f.key} className="px-2 py-2">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded border border-border bg-bg w-full text-sm focus-within:border-accent">
                            <span className="text-ink-faint text-xs shrink-0">₹</span>
                            <input
                              value={t[f.key]}
                              placeholder="0"
                              onChange={(e) => setTier(i, { [f.key]: e.target.value } as Partial<EditTier>)}
                              className="flex-1 min-w-0 bg-transparent font-mono text-sm text-right tnum focus:outline-none placeholder:text-ink-faint"
                            />
                          </span>
                        </td>
                      ))}
                      <td className="px-1 py-2 text-center">
                        {tiers.length > 1 && (
                          <button
                            onClick={() => removeTier(i)}
                            title="Remove tier"
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
            <Plus size={13} strokeWidth={1.75} /> Add tier
          </button>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-bad-ink mt-3">
              <AlertCircle size={13} strokeWidth={1.75} className="shrink-0" />
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-5">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button variant="primary" size="sm" onClick={submit}>
              Apply {model === "tier" ? "tiers" : "slabs"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
