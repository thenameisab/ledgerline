"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Combine, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { createBundle } from "./bundle-actions";

const PRICE_FIELDS = [
  { key: "price_successful", label: "S" },
  { key: "price_successful_no_data", label: "ND" },
  { key: "price_failed", label: "F" },
  { key: "price_in_progress", label: "IP" },
] as const;

type PriceKey = (typeof PRICE_FIELDS)[number]["key"];

export function StitchModal({
  accountId,
  slug,
  candidates,
}: {
  accountId: number;
  slug: string;
  candidates: { api_code: string; api_name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string>("");
  const [prices, setPrices] = useState<Record<PriceKey, string>>({
    price_successful: "",
    price_successful_no_data: "",
    price_failed: "",
    price_in_progress: "",
  });
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setSelected(new Set());
    setAnchor("");
    setPrices({
      price_successful: "",
      price_successful_no_data: "",
      price_failed: "",
      price_in_progress: "",
    });
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setError(null);
  }

  function toggle(code: string) {
    const next = new Set(selected);
    if (next.has(code)) {
      next.delete(code);
      if (anchor === code) setAnchor("");
    } else {
      next.add(code);
      // First selected API is the likely entry point of the stitched chain
      if (!anchor) setAnchor(code);
    }
    setSelected(next);
  }

  function submit() {
    if (!name.trim()) return setError("Give the stitch a name.");
    if (selected.size < 2) return setError("Pick at least two SKUs to stitch.");
    if (!anchor || !selected.has(anchor))
      return setError("Pick which SKU's usage the stitch bills on.");
    const parsed = Object.fromEntries(
      PRICE_FIELDS.map((f) => [f.key, prices[f.key] === "" ? 0 : parseFloat(prices[f.key])])
    ) as Record<PriceKey, number>;
    if (Object.values(parsed).some((v) => !Number.isFinite(v) || v < 0))
      return setError("Prices must be zero or positive numbers.");
    if (Object.values(parsed).every((v) => v === 0))
      return setError("Set a price — a stitch with all-zero prices still earns nothing.");

    setError(null);
    startTransition(async () => {
      const result = await createBundle(accountId, slug, {
        name: name.trim(),
        member_codes: Array.from(selected),
        anchor_api_code: anchor,
        ...parsed,
        effective_from: effectiveFrom,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not create the stitch.");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Combine size={14} strokeWidth={1.75} />}
        >
          Stitch SKUs
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content
          aria-describedby="stitch-modal-desc"
          className={[
            "fixed z-50 left-1/2 top-[12vh] -translate-x-1/2",
            "w-full max-w-[520px] bg-bg-raised rounded-lg border border-border shadow-high",
            "p-6 focus:outline-none max-h-[76vh] overflow-y-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-150",
          ].join(" ")}
        >
          <div className="flex items-center justify-between mb-2">
            <Dialog.Title className="text-lg font-semibold text-ink">
              Stitch SKUs
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

          <Dialog.Description id="stitch-modal-desc" className="text-xs text-ink-muted mb-5">
            Usage still logs units per SKU, but the account is billed once per unit of the
            anchor SKU at the agreed price. The other stitched SKUs bill $0 and stop
            counting as revenue leak.
          </Dialog.Description>

          <div className="space-y-4">
            <div>
              <label htmlFor="stitch-name" className="block text-sm font-medium text-ink mb-1.5">
                Name <span className="text-bad" aria-hidden>*</span>
              </label>
              <input
                id="stitch-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Atlas Pro tokens"
                autoComplete="off"
                className="w-full rounded border border-border bg-bg px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-ink mb-1.5">
                SKUs to stitch <span className="text-bad" aria-hidden>*</span>
              </span>
              <p className="text-[11px] text-ink-faint mb-2">
                Select at least two, then mark the anchor — the SKU whose unit count equals
                one stitched call (usually the entry point).
              </p>
              <div className="rounded border border-border divide-y divide-border max-h-56 overflow-y-auto">
                {candidates.map((c) => {
                  const checked = selected.has(c.api_code);
                  return (
                    <div
                      key={c.api_code}
                      className={`flex items-center gap-2.5 px-2.5 py-2 ${checked ? "bg-accent-bg/40" : ""}`}
                    >
                      <input
                        type="checkbox"
                        id={`stitch-${c.api_code}`}
                        checked={checked}
                        onChange={() => toggle(c.api_code)}
                        className="accent-[var(--color-accent)]"
                      />
                      <label
                        htmlFor={`stitch-${c.api_code}`}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <TruncateTooltip as="span" text={c.api_name} className="block text-sm text-ink" />
                        <span className="block text-[11px] font-mono text-ink-faint">
                          {c.api_code}
                        </span>
                      </label>
                      {checked && (
                        <label className="flex items-center gap-1 text-[11px] text-ink-muted cursor-pointer shrink-0">
                          <input
                            type="radio"
                            name="stitch-anchor"
                            checked={anchor === c.api_code}
                            onChange={() => setAnchor(c.api_code)}
                            className="accent-[var(--color-accent)]"
                          />
                          anchor
                        </label>
                      )}
                    </div>
                  );
                })}
                {candidates.length === 0 && (
                  <p className="px-2.5 py-3 text-sm text-ink-muted">
                    No SKUs available to stitch.
                  </p>
                )}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-ink mb-1.5">
                Agreed price ($/stitched call)
              </span>
              <div className="flex items-end gap-2">
                {PRICE_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="block text-[11px] uppercase tracking-wide text-ink-faint mb-1">
                      {f.label}
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded border border-border bg-bg w-[84px] text-sm focus-within:border-accent">
                      <span className="text-ink-faint text-xs shrink-0">$</span>
                      <input
                        value={prices[f.key]}
                        placeholder="0"
                        onChange={(e) =>
                          setPrices((p) => ({ ...p, [f.key]: e.target.value }))
                        }
                        className="flex-1 min-w-0 bg-transparent font-mono text-sm text-right tnum focus:outline-none placeholder:text-ink-faint"
                      />
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-ink-faint mt-1.5">
                Applied to the anchor SKU’s successful / no-data / failed / in-progress units.
              </p>
            </div>

            <div>
              <label htmlFor="stitch-from" className="block text-sm font-medium text-ink mb-1.5">
                Effective from
              </label>
              <input
                id="stitch-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="rounded border border-border bg-bg px-2 py-1.5 text-xs font-mono text-ink focus:border-accent focus:outline-none"
              />
              <p className="text-[11px] text-ink-faint mt-1.5">
                Usage before this date keeps individual pricing; finalized invoices are
                never affected.
              </p>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-bad-ink">
                <AlertCircle size={13} strokeWidth={1.75} className="shrink-0" />
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm" disabled={isPending}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button variant="primary" size="sm" onClick={submit} disabled={isPending}>
                {isPending ? "Stitching…" : "Create stitch"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
