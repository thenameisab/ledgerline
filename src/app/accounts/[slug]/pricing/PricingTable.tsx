"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Plus,
  Lock,
  ChevronLeft,
  Unlink,
  CornerDownRight,
  Layers,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { RollingText, SUCCESS_ROLL } from "@/components/ui/RollingText";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { formatNumber, formatPrice } from "@/lib/format";
import type { PricingRow, SlabTier, PricingContext } from "@/lib/repos/pricing";
import type { VolumeModel } from "@/lib/pricing/slabs";
import type { AccountBundle } from "@/lib/repos/bundles";
import { savePricingBatch, type PricingChange } from "./actions";
import { saveBundlePrice, deleteBundle } from "./bundle-actions";
import { StitchModal } from "./StitchModal";
import { SlabModal } from "./SlabModal";
import { PricingSummary } from "./PricingSummary";

type PendingEdit = {
  pricing_model: "flat" | "slab" | "tier";
  price_successful: number;
  price_successful_no_data: number;
  price_failed: number;
  price_in_progress: number;
  slabs: SlabTier[];
  effective_from: string;
};

function baselineOf(row: PricingRow): PendingEdit {
  return {
    pricing_model: row.pricing_model,
    price_successful: row.price_successful,
    price_successful_no_data: row.price_successful_no_data,
    price_failed: row.price_failed,
    price_in_progress: row.price_in_progress,
    slabs: row.slabs,
    effective_from: row.effective_from,
  };
}

function sameAsRow(e: PendingEdit, row: PricingRow): boolean {
  return (
    e.pricing_model === row.pricing_model &&
    e.price_successful === row.price_successful &&
    e.price_successful_no_data === row.price_successful_no_data &&
    e.price_failed === row.price_failed &&
    e.price_in_progress === row.price_in_progress &&
    e.effective_from === row.effective_from &&
    JSON.stringify(e.slabs) === JSON.stringify(row.slabs)
  );
}

// Bundles are always flat-priced (slabs apply at the individual-API level).
type BundlePriceEdit = {
  price_successful: number;
  price_successful_no_data: number;
  price_failed: number;
  price_in_progress: number;
};

type AddRow = {
  api_code: string;
  price_successful: string;
  price_successful_no_data: string;
  price_failed: string;
  price_in_progress: string;
  effective_from: string;
};

const COL_COUNT = 7;

export function PricingTable({
  accountId,
  slug,
  accountName,
  rows,
  bundles,
  availableApis,
  context,
}: {
  accountId: number;
  slug: string;
  accountName: string;
  rows: PricingRow[];
  bundles: AccountBundle[];
  availableApis: { product_code: string; name: string; unit: string }[];
  context: PricingContext;
}) {
  const router = useRouter();
  const [staged, setStaged] = useState<Map<string, PendingEdit>>(new Map());
  const [stagedBundles, setStagedBundles] = useState<Map<number, BundlePriceEdit>>(new Map());
  const [addRow, setAddRow] = useState<AddRow | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [unstitchConfirm, setUnstitchConfirm] = useState<number | null>(null);
  const [slabModalFor, setSlabModalFor] = useState<string | null>(null);

  const dirtyCount = staged.size + stagedBundles.size + (addRow ? 1 : 0);

  // Stage an edit, or drop it from the staged set if it now matches the row.
  function stageEdit(apiCode: string, row: PricingRow, next: PendingEdit) {
    const m = new Map(staged);
    if (sameAsRow(next, row)) m.delete(apiCode);
    else m.set(apiCode, next);
    setStaged(m);
  }

  function currentEdit(apiCode: string, row: PricingRow): PendingEdit {
    return staged.get(apiCode) ?? baselineOf(row);
  }

  function setField(apiCode: string, row: PricingRow, field: keyof PendingEdit, value: number) {
    const next = { ...currentEdit(apiCode, row), [field]: value };
    stageEdit(apiCode, row, next);
  }

  function setEffectiveFrom(apiCode: string, row: PricingRow, value: string) {
    const next = { ...currentEdit(apiCode, row), effective_from: value };
    stageEdit(apiCode, row, next);
  }

  // Flip a row to volume pricing with the chosen model (opens the editor).
  function applyTiers(apiCode: string, row: PricingRow, model: VolumeModel, slabs: SlabTier[]) {
    stageEdit(apiCode, row, {
      ...currentEdit(apiCode, row),
      pricing_model: model,
      price_successful: 0,
      price_successful_no_data: 0,
      price_failed: 0,
      price_in_progress: 0,
      slabs,
    });
  }

  function switchToFlat(apiCode: string, row: PricingRow) {
    stageEdit(apiCode, row, {
      ...currentEdit(apiCode, row),
      pricing_model: "flat",
      slabs: [],
    });
  }

  function revertRow(apiCode: string) {
    const m = new Map(staged);
    m.delete(apiCode);
    setStaged(m);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[apiCode];
      return next;
    });
  }

  function setBundleField(bundle: AccountBundle, field: keyof BundlePriceEdit, value: number) {
    const current = stagedBundles.get(bundle.id) ?? {
      price_successful: bundle.price_successful,
      price_successful_no_data: bundle.price_successful_no_data,
      price_failed: bundle.price_failed,
      price_in_progress: bundle.price_in_progress,
    };
    const next = { ...current, [field]: value };
    const unchanged =
      next.price_successful === bundle.price_successful &&
      next.price_successful_no_data === bundle.price_successful_no_data &&
      next.price_failed === bundle.price_failed &&
      next.price_in_progress === bundle.price_in_progress;

    const m = new Map(stagedBundles);
    if (unchanged) {
      m.delete(bundle.id);
    } else {
      m.set(bundle.id, next);
    }
    setStagedBundles(m);
  }

  function revertBundle(bundleId: number) {
    const m = new Map(stagedBundles);
    m.delete(bundleId);
    setStagedBundles(m);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`bundle:${bundleId}`];
      return next;
    });
  }

  function handleUnstitch(bundleId: number) {
    setUnstitchConfirm(null);
    startTransition(async () => {
      const result = await deleteBundle(accountId, slug, bundleId);
      if (!result.ok) {
        setErrors((prev) => ({
          ...prev,
          [`bundle:${bundleId}`]: result.error ?? "Unstitch failed.",
        }));
        return;
      }
      revertBundle(bundleId);
      router.refresh();
    });
  }

  function openAddRow() {
    setAddRow({
      api_code: "",
      price_successful: "",
      price_successful_no_data: "",
      price_failed: "",
      price_in_progress: "",
      effective_from: new Date().toISOString().slice(0, 10),
    });
  }

  function handleDiscard() {
    if (dirtyCount > 1 && !discardConfirm) {
      setDiscardConfirm(true);
      return;
    }
    setStaged(new Map());
    setStagedBundles(new Map());
    setAddRow(null);
    setErrors({});
    setDiscardConfirm(false);
  }

  function handleSave() {
    setDiscardConfirm(false);

    if (addRow !== null && !addRow.api_code) {
      setErrors((prev) => ({ ...prev, __new__: "Select a SKU before saving." }));
      return;
    }

    const changes: PricingChange[] = [
      ...Array.from(staged.entries()).map(([api_code, edit]) => {
        // Unpriced rows have no pricing record yet — saving one inserts a row
        // effective from the pair's first usage so existing traffic is covered.
        const row = rows.find((r) => r.api_code === api_code);
        const isUnpriced = !!row?.unpriced;
        return {
          api_code,
          ...edit,
          is_new: isUnpriced,
          // Unpriced rows insert from first usage; priced rows carry the
          // (possibly re-dated) effective_from the user edited.
          ...(isUnpriced && row?.first_used ? { effective_from: row.first_used } : {}),
        };
      }),
      ...(addRow
        ? [
            {
              api_code: addRow.api_code,
              price_successful: parseFloat(addRow.price_successful) || 0,
              price_successful_no_data: parseFloat(addRow.price_successful_no_data) || 0,
              price_failed: parseFloat(addRow.price_failed) || 0,
              price_in_progress: parseFloat(addRow.price_in_progress) || 0,
              effective_from: addRow.effective_from,
              is_new: true,
            },
          ]
        : []),
    ];

    startTransition(async () => {
      const nextErrors: Record<string, string> = {};

      if (changes.length > 0) {
        const result = await savePricingBatch(accountId, slug, changes);

        const m = new Map(staged);
        for (const code of result.saved) m.delete(code);
        setStaged(m);

        if (addRow && result.saved.includes(addRow.api_code)) {
          setAddRow(null);
        }
        Object.assign(nextErrors, result.errors ?? {});
      }

      if (stagedBundles.size > 0) {
        const mb = new Map(stagedBundles);
        for (const [bundleId, edit] of Array.from(stagedBundles.entries())) {
          const result = await saveBundlePrice(accountId, slug, bundleId, edit);
          if (result.ok) {
            mb.delete(bundleId);
          } else {
            nextErrors[`bundle:${bundleId}`] = result.error ?? "Save failed.";
          }
        }
        setStagedBundles(mb);
      }

      setErrors(nextErrors);
      if (Object.keys(nextErrors).length === 0) {
        // Keep the bar mounted through the flash, then let it fall away.
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      }
      router.refresh();
    });
  }

  function jumpToLeak() {
    document
      .getElementById("pricing-band-leak")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Sort rows into status bands so trouble reads first (DESIGN.md §0.5).
  const leakRows = rows.filter((r) => r.unpriced);
  const pricedRows = rows.filter((r) => !r.unpriced);

  return (
    <div>
      {/* Page header row */}
      <div
        className="flex items-center justify-between mb-4 dash-enter"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <Link
          href={`/accounts/${slug}`}
          className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors duration-fast ease-expo"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          {accountName}
        </Link>
        <div className="flex items-center gap-2">
          {rows.length >= 2 && (
            <StitchModal
              accountId={accountId}
              slug={slug}
              candidates={rows.map((r) => ({ api_code: r.api_code, api_name: r.api_name }))}
            />
          )}
          {availableApis.length > 0 && !addRow && (
            <Button
              variant="secondary"
              size="sm"
              onClick={openAddRow}
              leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            >
              Add SKU
            </Button>
          )}
        </div>
      </div>

      {/* Synthesis landmark */}
      <PricingSummary
        pricedCount={pricedRows.length}
        unpricedCount={leakRows.length}
        bundledCount={bundles.length}
        totalRevenue={context.totalRevenue}
        windowDays={context.windowDays}
        latestDate={context.latestDate}
        onJumpToLeak={jumpToLeak}
      />

      {/* Table */}
      <div
        className="bg-bg-raised border border-border rounded-lg overflow-hidden dash-enter"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 720, tableLayout: "fixed" }}>
            <colgroup>
              <col />
              <col style={{ width: 96 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 128 }} />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead className="bg-bg-sunken text-ink-faint text-[11px] uppercase tracking-wide">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-3 py-3 font-medium text-right">S ($/unit)</th>
                <th className="px-3 py-3 font-medium text-right">ND ($/unit)</th>
                <th className="px-3 py-3 font-medium text-right">F ($/unit)</th>
                <th className="px-3 py-3 font-medium text-right">IP ($/unit)</th>
                <th className="px-3 py-3 font-medium">Effective from</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Add row — always first */}
              {addRow && (
                <AddApiRow
                  addRow={addRow}
                  onChange={setAddRow}
                  onCancel={() => {
                    setAddRow(null);
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.__new__;
                      return next;
                    });
                  }}
                  availableApis={availableApis}
                  error={errors.__new__}
                />
              )}

              {/* Empty state */}
              {rows.length === 0 && bundles.length === 0 && !addRow && (
                <tr>
                  <td colSpan={COL_COUNT} className="px-4 py-12 text-center text-ink-muted text-sm">
                    No pricing configured for this account.{" "}
                    <button
                      onClick={openAddRow}
                      className="text-accent underline underline-offset-2 hover:text-accent-ink"
                    >
                      Add the first SKU
                    </button>
                  </td>
                </tr>
              )}

              {/* ── Leak band ── unpriced pairs read first (most urgent) */}
              {leakRows.length > 0 && (
                <BandHeader
                  id="pricing-band-leak"
                  label="Unpriced — earning nothing"
                  count={leakRows.length}
                  tone="bad"
                />
              )}
              {leakRows.map((row, i) => (
                <PriceRow
                  key={row.api_code}
                  row={row}
                  index={i}
                  current={currentEdit(row.api_code, row)}
                  isDirty={staged.has(row.api_code)}
                  errorMsg={errors[row.api_code]}
                  onField={(f, v) => setField(row.api_code, row, f, v)}
                  onEffectiveFrom={(v) => setEffectiveFrom(row.api_code, row, v)}
                  onRevert={() => revertRow(row.api_code)}
                  onOpenSlab={() => setSlabModalFor(row.api_code)}
                  onSwitchToFlat={() => switchToFlat(row.api_code, row)}
                />
              ))}

              {/* ── Priced band ── */}
              {pricedRows.length > 0 && leakRows.length > 0 && (
                <BandHeader label="Priced" count={pricedRows.length} />
              )}
              {pricedRows.map((row, i) => (
                <PriceRow
                  key={row.api_code}
                  row={row}
                  index={leakRows.length + i}
                  current={currentEdit(row.api_code, row)}
                  isDirty={staged.has(row.api_code)}
                  errorMsg={errors[row.api_code]}
                  onField={(f, v) => setField(row.api_code, row, f, v)}
                  onEffectiveFrom={(v) => setEffectiveFrom(row.api_code, row, v)}
                  onRevert={() => revertRow(row.api_code)}
                  onOpenSlab={() => setSlabModalFor(row.api_code)}
                  onSwitchToFlat={() => switchToFlat(row.api_code, row)}
                />
              ))}

              {/* ── Stitched band ── members read as one product */}
              {bundles.length > 0 && (
                <BandHeader label="Stitched bundles" count={bundles.length} />
              )}
              {bundles.map((bundle) => {
                const isDirty = stagedBundles.has(bundle.id);
                const errKey = `bundle:${bundle.id}`;
                const hasError = !!errors[errKey];
                const current = stagedBundles.get(bundle.id) ?? {
                  price_successful: bundle.price_successful,
                  price_successful_no_data: bundle.price_successful_no_data,
                  price_failed: bundle.price_failed,
                  price_in_progress: bundle.price_in_progress,
                };
                return (
                  <BundleRows
                    key={`bundle-${bundle.id}`}
                    bundle={bundle}
                    current={current}
                    isDirty={isDirty}
                    error={hasError ? errors[errKey] : undefined}
                    confirming={unstitchConfirm === bundle.id}
                    onField={(f, v) => setBundleField(bundle, f, v)}
                    onRevert={() => revertBundle(bundle.id)}
                    onUnstitch={() => setUnstitchConfirm(bundle.id)}
                    onUnstitchConfirm={() => handleUnstitch(bundle.id)}
                    onUnstitchCancel={() => setUnstitchConfirm(null)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky save bar */}
      {(dirtyCount > 0 || saved) && (
        <div className="sticky bottom-0 mt-px border-t border-border bg-bg-raised save-bar-enter">
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-sm text-ink-muted">
              {dirtyCount === 0
                ? "All changes saved"
                : dirtyCount === 1
                ? "1 unsaved change"
                : `${dirtyCount} unsaved changes`}
            </span>
            <div className="flex items-center gap-2">
              {discardConfirm ? (
                <>
                  <span className="text-sm text-ink-muted mr-1">
                    Discard all {dirtyCount} changes?
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setDiscardConfirm(false)}>
                    Keep editing
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setStaged(new Map());
                      setStagedBundles(new Map());
                      setAddRow(null);
                      setErrors({});
                      setDiscardConfirm(false);
                    }}
                  >
                    Discard
                  </Button>
                </>
              ) : (
                <>
                  {dirtyCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={isPending}>
                      Discard
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSave}
                    disabled={isPending || dirtyCount === 0}
                  >
                    <RollingText
                      text={
                        isPending
                          ? "Saving…"
                          : dirtyCount === 0
                          ? "Saved"
                          : dirtyCount === 1
                          ? "Save change"
                          : `Save ${dirtyCount} changes`
                      }
                      options={{
                        direction: "up",
                        color: dirtyCount === 0 && saved ? SUCCESS_ROLL : undefined,
                      }}
                    />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {slabModalFor &&
        (() => {
          const row = rows.find((r) => r.api_code === slabModalFor);
          if (!row) return null;
          const cur = currentEdit(row.api_code, row);
          return (
            <SlabModal
              open
              onOpenChange={(o) => {
                if (!o) setSlabModalFor(null);
              }}
              apiName={row.api_name}
              apiCode={row.api_code}
              unit={row.unit}
              initialModel={cur.pricing_model !== "flat" ? cur.pricing_model : "slab"}
              initialSlabs={cur.pricing_model !== "flat" ? cur.slabs : row.slabs}
              onSave={(model, slabs) => applyTiers(row.api_code, row, model, slabs)}
            />
          );
        })()}
    </div>
  );
}

// ─── BandHeader ────────────────────────────────────────────────────────────
// A quiet separator between status bands. Not a data row — carries the group
// name + count so the eye can skip whole sections.

function BandHeader({
  id,
  label,
  count,
  tone,
}: {
  id?: string;
  label: string;
  count: number;
  tone?: "bad";
}) {
  return (
    <tr id={id} className="bg-bg-sunken/70">
      <td
        colSpan={COL_COUNT}
        className="px-4 py-1.5 text-[11px] uppercase tracking-wider font-mono"
      >
        <span className={tone === "bad" ? "text-bad-ink" : "text-ink-faint"}>{label}</span>
        <span className="text-ink-faint ml-1.5">{count}</span>
      </td>
    </tr>
  );
}

// ─── PriceRow ──────────────────────────────────────────────────────────────

function PriceRow({
  row,
  index,
  current,
  isDirty,
  errorMsg,
  onField,
  onEffectiveFrom,
  onRevert,
  onOpenSlab,
  onSwitchToFlat,
}: {
  row: PricingRow;
  index: number;
  current: PendingEdit;
  isDirty: boolean;
  errorMsg?: string;
  onField: (field: keyof PendingEdit, value: number) => void;
  onEffectiveFrom: (value: string) => void;
  onRevert: () => void;
  onOpenSlab: () => void;
  onSwitchToFlat: () => void;
}) {
  const hasError = !!errorMsg;
  const isVolume = current.pricing_model !== "flat";
  const volumeLabel = current.pricing_model === "slab" ? "slab" : "tiered";

  const rowTone = hasError
    ? "bg-bad-bg"
    : isDirty
    ? "bg-accent-bg"
    : row.unpriced
    ? "bg-bad-bg"
    : "";

  return (
    <tr
      className={`row-enter ${rowTone}`}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <td className="px-4 py-3">
        <TruncateTooltip as="div" text={row.api_name} className="text-sm text-ink" />
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[11px] text-ink-faint font-mono">{row.api_code}</span>
          <span className="text-[11px] text-ink-faint">per {row.unit}</span>
          {row.unpriced && !isDirty && (
            <span
              title={`${formatNumber(row.usage_hits ?? 0)} units since ${row.first_used} earn nothing until priced`}
              className="inline-flex items-center text-[11px] text-bad-ink px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-bad"
            >
              unpriced
            </span>
          )}
          {isDirty && !hasError && (
            <span className="inline-flex items-center text-[11px] text-accent-ink bg-accent-bg px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-accent/30">
              edited
            </span>
          )}
          {row.billed && (
            <span
              title="Billed on a finalized invoice — edits will insert a new row effective today"
              className="inline-flex items-center gap-0.5 text-[11px] text-ink-faint bg-bg-sunken px-1 py-0.5 rounded font-mono uppercase tracking-wider"
            >
              <Lock size={9} strokeWidth={1.75} />
              billed
            </span>
          )}
          {isVolume ? (
            <button
              onClick={onSwitchToFlat}
              title="Switch back to a single flat rate"
              className="inline-flex items-center gap-0.5 text-[11px] text-ink-faint hover:text-ink px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-border transition-colors"
            >
              use flat
            </button>
          ) : (
            <button
              onClick={onOpenSlab}
              title="Switch to volume pricing (tiered or slab)"
              className="inline-flex items-center gap-0.5 text-[11px] text-ink-faint hover:text-accent-ink px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-border transition-colors"
            >
              <Layers size={9} strokeWidth={1.75} />
              volume
            </button>
          )}
        </div>
        {hasError && <div className="text-[11px] text-bad-ink mt-1">{errorMsg}</div>}
      </td>

      {isVolume ? (
        <td colSpan={4} className="px-3 py-3">
          <button
            onClick={onOpenSlab}
            className="inline-flex items-center gap-2 text-left rounded border border-accent/30 bg-accent-bg/40 px-2.5 py-1.5 hover:bg-accent-bg transition-colors group"
          >
            <Layers size={13} strokeWidth={1.75} className="text-accent-ink shrink-0" />
            <span className="text-xs text-ink">
              {volumeLabel} · {current.slabs.length} bracket
              {current.slabs.length === 1 ? "" : "s"}
              <span className="text-ink-faint font-mono ml-2">
                {current.slabs.map((s) => formatPrice(s.price_successful)).join(" → ")}
              </span>
            </span>
            <Pencil
              size={11}
              strokeWidth={1.75}
              className="text-ink-faint group-hover:text-accent-ink shrink-0"
            />
          </button>
        </td>
      ) : (
        <>
          <td className="px-3 py-3">
            <PriceInput
              value={current.price_successful}
              onChange={(v) => onField("price_successful", v)}
            />
          </td>
          <td className="px-3 py-3">
            <PriceInput
              value={current.price_successful_no_data}
              onChange={(v) => onField("price_successful_no_data", v)}
            />
          </td>
          <td className="px-3 py-3">
            <PriceInput
              value={current.price_failed}
              onChange={(v) => onField("price_failed", v)}
            />
          </td>
          <td className="px-3 py-3">
            <PriceInput
              value={current.price_in_progress}
              onChange={(v) => onField("price_in_progress", v)}
            />
          </td>
        </>
      )}

      <td className="px-3 py-3 font-mono text-xs text-ink-muted">
        {row.unpriced ? (
          isDirty ? (
            <span
              className="text-ink-faint italic"
              title="Applies from the first recorded usage so the traffic already logged gets billed"
            >
              → {row.first_used}
            </span>
          ) : (
            <span className="text-ink-faint">—</span>
          )
        ) : (
          <DateInput
            value={current.effective_from}
            onChange={onEffectiveFrom}
            title={
              row.billed
                ? "Billed pair — re-dating applies retroactively and changes the finalized invoice"
                : undefined
            }
          />
        )}
      </td>

      <td className="px-2 py-3">
        {isDirty && (
          <button
            onClick={onRevert}
            title="Revert this row"
            className="p-1 rounded hover:bg-bg-sunken text-ink-faint hover:text-ink transition-colors duration-fast ease-expo"
          >
            <X size={13} strokeWidth={1.75} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── BundleRows ──────────────────────────────────────────────────────────────
// A stitched bundle renders as a header row (name + editable bundle price)
// followed by one row per member SKU. Only the anchor's usage bills — at the
// bundle rate; other members show as included at $0.

function BundleRows({
  bundle,
  current,
  isDirty,
  error,
  confirming,
  onField,
  onRevert,
  onUnstitch,
  onUnstitchConfirm,
  onUnstitchCancel,
}: {
  bundle: AccountBundle;
  current: BundlePriceEdit;
  isDirty: boolean;
  error?: string;
  confirming: boolean;
  onField: (field: keyof BundlePriceEdit, value: number) => void;
  onRevert: () => void;
  onUnstitch: () => void;
  onUnstitchConfirm: () => void;
  onUnstitchCancel: () => void;
}) {
  return (
    <>
      <tr className={error ? "bg-bad-bg" : isDirty ? "bg-accent-bg" : "bg-bg-sunken/60"}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Unlink size={12} strokeWidth={1.75} className="text-accent-ink shrink-0" aria-hidden />
            <TruncateTooltip as="div" text={bundle.name} className="text-sm text-ink font-medium" />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="inline-flex items-center text-[11px] text-accent-ink bg-accent-bg px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-accent/30">
              stitched · {bundle.members.length} SKUs
            </span>
            {isDirty && !error && (
              <span className="inline-flex items-center text-[11px] text-accent-ink bg-accent-bg px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-accent/30">
                edited
              </span>
            )}
            {bundle.billed && (
              <span
                title="Billed on a finalized invoice — price edits insert a new row effective today; unstitching is locked"
                className="inline-flex items-center gap-0.5 text-[11px] text-ink-faint bg-bg-sunken px-1 py-0.5 rounded font-mono uppercase tracking-wider"
              >
                <Lock size={9} strokeWidth={1.75} />
                billed
              </span>
            )}
            {confirming && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
                Unstitch {bundle.members.length} SKUs?
                <button
                  onClick={onUnstitchConfirm}
                  className="text-bad-ink underline underline-offset-2 hover:text-bad"
                >
                  Unstitch
                </button>
                <button onClick={onUnstitchCancel} className="underline underline-offset-2">
                  Keep
                </button>
              </span>
            )}
          </div>
          {error && <div className="text-[11px] text-bad-ink mt-1">{error}</div>}
        </td>

        <td className="px-3 py-3">
          <PriceInput
            value={current.price_successful}
            onChange={(v) => onField("price_successful", v)}
          />
        </td>
        <td className="px-3 py-3">
          <PriceInput
            value={current.price_successful_no_data}
            onChange={(v) => onField("price_successful_no_data", v)}
          />
        </td>
        <td className="px-3 py-3">
          <PriceInput
            value={current.price_failed}
            onChange={(v) => onField("price_failed", v)}
          />
        </td>
        <td className="px-3 py-3">
          <PriceInput
            value={current.price_in_progress}
            onChange={(v) => onField("price_in_progress", v)}
          />
        </td>

        <td className="px-3 py-3 font-mono text-xs text-ink-muted">
          {isDirty && bundle.billed ? (
            <span className="text-ink-faint italic">→ today</span>
          ) : (
            bundle.effective_from
          )}
        </td>

        <td className="px-2 py-3">
          {isDirty ? (
            <button
              onClick={onRevert}
              title="Revert this stitch"
              className="p-1 rounded hover:bg-bg-sunken text-ink-faint hover:text-ink transition-colors duration-fast ease-expo"
            >
              <X size={13} strokeWidth={1.75} />
            </button>
          ) : (
            !bundle.billed &&
            !confirming && (
              <button
                onClick={onUnstitch}
                title="Unstitch — members go back to individual pricing"
                className="p-1 rounded hover:bg-bg-sunken text-ink-faint hover:text-bad-ink transition-colors duration-fast ease-expo"
              >
                <Unlink size={13} strokeWidth={1.75} />
              </button>
            )
          )}
        </td>
      </tr>

      {bundle.members.map((m) => {
        const isAnchor = m.api_code === bundle.anchor_api_code;
        return (
          <tr key={`bundle-${bundle.id}-${m.api_code}`} className="bg-bg-sunken/25">
            <td className="px-4 py-2">
              <div className="flex items-center gap-2 pl-4">
                <CornerDownRight
                  size={11}
                  strokeWidth={1.75}
                  className="text-ink-faint shrink-0"
                  aria-hidden
                />
                <div className="min-w-0">
                  <TruncateTooltip as="div" text={m.api_name} className="text-[13px] text-ink-muted" />
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-ink-faint font-mono">{m.api_code}</span>
                    {isAnchor ? (
                      <span
                        title="Bills the stitch: each unit of this SKU counts as one stitched call at the agreed price"
                        className="inline-flex items-center text-[11px] text-accent-ink px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-accent/30"
                      >
                        anchor
                      </span>
                    ) : (
                      <span
                        title="Included in the stitched price — its own usage bills $0"
                        className="inline-flex items-center text-[11px] text-ink-faint px-1 py-0.5 rounded font-mono uppercase tracking-wider border border-border"
                      >
                        included
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </td>
            <td colSpan={4} className="px-3 py-2 text-right">
              <span
                className="text-[11px] text-ink-faint font-mono"
                title={
                  isAnchor ? "Billed at the stitch price above" : "Covered by the stitch — bills $0"
                }
              >
                {isAnchor ? "bills stitch price" : "$0 · in stitch"}
              </span>
            </td>
            <td className="px-3 py-2" />
            <td className="px-2 py-2" />
          </tr>
        );
      })}
    </>
  );
}

// ─── PriceInput ──────────────────────────────────────────────────────────────

function PriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const fmt = value === 0 ? "" : String(value);
  const [local, setLocal] = useState(fmt);
  // Sync when value prop changes externally (e.g. row revert)
  const [synced, setSynced] = useState(fmt);
  if (synced !== fmt) {
    setSynced(fmt);
    setLocal(fmt);
  }

  function commit() {
    const n = local === "" ? 0 : parseFloat(local);
    if (!Number.isFinite(n) || n < 0) {
      setLocal(fmt);
      return;
    }
    onChange(n);
    setLocal(n === 0 ? "" : String(n));
  }

  return (
    <label className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded border border-border bg-bg w-[78px] text-sm transition-colors duration-fast ease-expo focus-within:border-accent focus-within:bg-bg-raised">
      <span className="text-ink-faint text-xs shrink-0">$</span>
      <input
        value={local}
        placeholder="0"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setLocal(fmt);
        }}
        className="flex-1 min-w-0 bg-transparent font-mono text-sm text-right tnum focus:outline-none placeholder:text-ink-faint"
      />
    </label>
  );
}

// ─── DateInput ───────────────────────────────────────────────────────────────

function DateInput({
  value,
  onChange,
  title,
}: {
  value: string;
  onChange: (v: string) => void;
  title?: string;
}) {
  return (
    <input
      type="date"
      value={value ? value.slice(0, 10) : ""}
      title={title}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-border bg-bg px-2 py-1 text-xs font-mono text-ink w-[124px] transition-colors duration-fast ease-expo focus:border-accent focus:bg-bg-raised focus:outline-none"
    />
  );
}

// ─── AddApiRow ───────────────────────────────────────────────────────────────

function AddApiRow({
  addRow,
  onChange,
  onCancel,
  availableApis,
  error,
}: {
  addRow: AddRow;
  onChange: (r: AddRow) => void;
  onCancel: () => void;
  availableApis: { product_code: string; name: string; unit: string }[];
  error?: string;
}) {
  return (
    <tr className="bg-accent-bg">
      <td className="px-4 py-3">
        <Combobox
          options={availableApis}
          value={addRow.api_code}
          onChange={(v) => onChange({ ...addRow, api_code: v })}
          getValue={(a) => a.product_code}
          getLabel={(a) => `${a.product_code} – ${a.name}`}
          keys={["product_code", "name"]}
          emptyLabel="Select SKU…"
          searchPlaceholder="Search code or name…"
        />
        {addRow.api_code && (
          <div className="text-[11px] text-ink-faint mt-1">
            Prices are per {availableApis.find((a) => a.product_code === addRow.api_code)?.unit ?? "unit"}
          </div>
        )}
        {error && <div className="text-[11px] text-bad-ink mt-1">{error}</div>}
      </td>

      <td className="px-3 py-3">
        <PriceInput
          value={parseFloat(addRow.price_successful) || 0}
          onChange={(v) => onChange({ ...addRow, price_successful: v === 0 ? "" : String(v) })}
        />
      </td>
      <td className="px-3 py-3">
        <PriceInput
          value={parseFloat(addRow.price_successful_no_data) || 0}
          onChange={(v) =>
            onChange({ ...addRow, price_successful_no_data: v === 0 ? "" : String(v) })
          }
        />
      </td>
      <td className="px-3 py-3">
        <PriceInput
          value={parseFloat(addRow.price_failed) || 0}
          onChange={(v) => onChange({ ...addRow, price_failed: v === 0 ? "" : String(v) })}
        />
      </td>
      <td className="px-3 py-3">
        <PriceInput
          value={parseFloat(addRow.price_in_progress) || 0}
          onChange={(v) => onChange({ ...addRow, price_in_progress: v === 0 ? "" : String(v) })}
        />
      </td>

      <td className="px-3 py-3">
        <input
          type="date"
          value={addRow.effective_from}
          onChange={(e) => onChange({ ...addRow, effective_from: e.target.value })}
          className="rounded border border-border bg-bg px-2 py-1.5 text-xs font-mono text-ink w-[124px] focus:border-accent focus:outline-none"
        />
      </td>

      <td className="px-2 py-3">
        <button
          onClick={onCancel}
          title="Cancel"
          className="p-1 rounded hover:bg-bg-sunken text-ink-faint hover:text-ink transition-colors duration-fast ease-expo"
        >
          <X size={13} strokeWidth={1.75} />
        </button>
      </td>
    </tr>
  );
}
