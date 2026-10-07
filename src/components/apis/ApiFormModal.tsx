"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

export type ApiOption = {
  product_code: string;
  name: string;
  category: string | null;
  vendor_type: string | null;
};

type VendorType = "InHouse" | "Vendor" | "Stitched" | "Journey" | "";

/** Product lines offered as category suggestions. Any other text is still accepted. */
const CATEGORIES = ["Models", "Agents", "Media", "Voice", "Messaging", "Data", "Compute"];

export type ApiFormInitial = {
  product_code?: string;
  name?: string;
  category?: string | null;
  unit?: string | null;
  vendor_type?: string | null;
  default_vendor?: string | null;
  log_aliases?: string[];
  is_active?: number;
};

/**
 * Create/edit form for a SKU catalog entry, rendered as a modal.
 * Create POSTs /api/apis (optionally resolving a raw usage name in the same
 * call); edit PATCHes /api/apis/[code] — including product-code renames.
 */
export function ApiFormModal({
  mode,
  initial = {},
  existingCodes,
  resolveRawName,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: ApiFormInitial;
  /** Account-side fast path for duplicate codes on create; server re-checks. */
  existingCodes?: Set<string>;
  /** Create-only: raw log name to map to the new API (updates usage rows). */
  resolveRawName?: string;
  onCancel: () => void;
  onSaved: (api: ApiOption) => void;
}) {
  const originalCode = initial.product_code ?? "";
  const [productCode, setProductCode] = useState(originalCode);
  const [name, setName] = useState(initial.name ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [unit, setUnit] = useState(initial.unit ?? "");
  const [vendorType, setVendorType] = useState<VendorType>((initial.vendor_type as VendorType) ?? "");
  const [defaultVendor, setDefaultVendor] = useState(initial.default_vendor ?? "");
  const [aliasesText, setAliasesText] = useState((initial.log_aliases ?? []).join(", "));
  const [isActive, setIsActive] = useState((initial.is_active ?? 1) === 1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Render into <body> so the fixed overlay is anchored to the viewport, not a
  // transformed ancestor (e.g. AliasResolver's `.row-enter` rows keep a
  // `translateY(0)` transform, which would otherwise be the containing block).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function submit() {
    setError(null);
    const code = productCode.trim().toUpperCase();
    if (!code) return setError("SKU code is required.");
    if (mode === "create" && existingCodes?.has(code)) return setError(`${code} already exists.`);
    if (!name.trim()) return setError("Name is required.");
    if (!unit.trim()) return setError("Billing unit is required.");

    const payload = {
      product_code: code,
      name: name.trim(),
      category: category.trim() || null,
      unit: unit.trim(),
      vendor_type: vendorType || null,
      default_vendor: defaultVendor.trim() || null,
      log_aliases: aliasesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    startTransition(async () => {
      const res = await fetch(
        mode === "create" ? "/api/apis" : `/api/apis/${encodeURIComponent(originalCode)}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            mode === "create"
              ? { ...payload, ...(resolveRawName ? { resolve_raw_name: resolveRawName } : {}) }
              : { ...payload, is_active: isActive ? 1 : 0 }
          ),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? `Server returned ${res.status}`);
        return;
      }
      onSaved({
        product_code: data.product_code ?? code,
        name: data.name ?? payload.name,
        category: payload.category,
        vendor_type: payload.vendor_type,
      });
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-overlay)" }}
    >
      <div className="bg-bg-raised border border-border rounded-md p-6 max-w-lg w-full shadow-mid">
        <h3 className="font-serif text-xl text-ink mb-1" style={{ fontWeight: 600 }}>
          {mode === "create" ? "Create new SKU" : `Edit SKU ${originalCode}`}
        </h3>
        <p className="text-sm text-ink-muted mb-4">
          {mode === "create" ? (
            resolveRawName ? (
              <>
                Adds it to the catalog and maps the raw log name{" "}
                <span className="font-mono text-ink">{resolveRawName}</span> to it.
              </>
            ) : (
              "Add it to the catalog so the entry can reference it. Set pricing for this account afterwards in the pricing editor."
            )
          ) : (
            "Changes apply everywhere this SKU appears. Renaming the SKU code moves its pricing, usage and statement history to the new code."
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="SKU code" required>
            <input
              type="text"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="ATL-PRO-IN"
              className="w-full bg-bg text-ink border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </Field>
          <Field label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Atlas Pro · input tokens"
              className="w-full bg-bg text-ink border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </Field>
          <Field label="Category">
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Models"
              list="sku-category-options"
              className="w-full bg-bg text-ink border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <datalist id="sku-category-options">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Billing unit" required>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="1M tokens"
              className="w-full bg-bg text-ink border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </Field>
          <Field label="Vendor type">
            <select
              value={vendorType}
              onChange={(e) => setVendorType(e.target.value as VendorType)}
              className="w-full bg-bg text-ink border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">—</option>
              <option value="InHouse">InHouse</option>
              <option value="Vendor">Vendor</option>
              <option value="Stitched">Stitched</option>
              <option value="Journey">Journey</option>
            </select>
          </Field>
          <Field label="Default vendor">
            <input
              type="text"
              value={defaultVendor}
              onChange={(e) => setDefaultVendor(e.target.value)}
              placeholder="InHouse"
              className="w-full bg-bg text-ink border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </Field>
          <Field label="Log aliases (comma separated)" className="md:col-span-2">
            <input
              type="text"
              value={aliasesText}
              onChange={(e) => setAliasesText(e.target.value)}
              placeholder="atlas-pro-input, Atlas Pro Input"
              className="w-full bg-bg text-ink border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </Field>
          {mode === "edit" && (
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              Active — appears in dropdowns and reports
            </label>
          )}
        </div>

        {error && (
          <div className="rounded border border-bad bg-bad-bg text-bad-ink px-3 py-2 text-sm mt-4">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={pending}>
            {mode === "create" ? "Create SKU" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-ink-muted">
        {label}
        {required && <span className="text-bad ml-0.5">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
