"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertTriangle, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { RollingText } from "@/components/ui/RollingText";
import { ApiFormModal } from "@/components/apis/ApiFormModal";
import { formatMoney, formatNumber } from "@/lib/format";

type AccountOpt = { id: number; display_name: string; is_sandbox: number };
type ApiOpt = { product_code: string; name: string; category: string | null; vendor_type: string | null };

type LineState = {
  api_code: string;
  api_name: string;
  hits_via: "Bulk" | "Integration" | "Console";
  vendor: string;
  successful: number;
  successful_no_data: number;
  failed: number;
  in_progress: number;
};

const NEW_API_SENTINEL = "__new_api__";

function emptyLine(): LineState {
  return {
    api_code: "",
    api_name: "",
    hits_via: "Bulk",
    vendor: "",
    successful: 0,
    successful_no_data: 0,
    failed: 0,
    in_progress: 0,
  };
}

export function ManualEntryWizard({
  accounts,
  apis: apisProp,
  vendors,
  approvalThreshold,
  lockedAccountId,
  returnTo,
}: {
  accounts: AccountOpt[];
  apis: ApiOpt[];
  vendors: string[];
  approvalThreshold: number;
  /** When set, the account picker becomes read-only and the wizard is scoped to this id. */
  lockedAccountId?: number;
  /** Where to navigate on successful save. Defaults to the entry detail page. */
  returnTo?: string;
}) {
  const router = useRouter();
  const [apis, setApis] = useState(apisProp);
  const [accountId, setAccountId] = useState<number | "">(lockedAccountId ?? "");
  const [effectiveDate, setEffectiveDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);
  const [showApiCreate, setShowApiCreate] = useState<number | null>(null);
  const [pricedPairs, setPricedPairs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apiByCode = useMemo(() => new Map(apis.map((a) => [a.product_code, a])), [apis]);

  const previewLines = useMemo(() => {
    return lines.map((l) => {
      const pricing = pricedPairs.has(`${accountId}:${l.api_code}`)
        ? { has_pricing: true }
        : { has_pricing: false };
      return { ...l, ...pricing, hits: l.successful + l.successful_no_data + l.failed + l.in_progress };
    });
  }, [lines, pricedPairs, accountId]);

  // Preview totals come from the server so the same temporal pricing join is
  // authoritative. We refresh on a debounce or on explicit "Preview" click.
  const [serverPreview, setServerPreview] = useState<{
    total: number;
    requires_approval: boolean;
    threshold: number;
    lines: Array<{ api_code: string; revenue: number; has_pricing: boolean }>;
  } | null>(null);

  // Use refs so the debounced effect always sees the latest values without
  // re-binding handlers (the prior onBlur path captured stale closure state).
  const latest = useRef({ accountId, effectiveDate, lines });
  latest.current = { accountId, effectiveDate, lines };

  async function refreshPreview() {
    const { accountId: cid, effectiveDate: dt, lines: ls } = latest.current;
    if (!cid || !ls.some((l) => l.api_code)) {
      setServerPreview(null);
      return;
    }
    const res = await fetch("/api/manual-entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "preview",
        client_id: cid,
        effective_date: dt,
        lines: ls.filter((l) => l.api_code).map((l) => ({
          api_code: l.api_code,
          hits_via: l.hits_via,
          vendor: l.vendor || null,
          successful: l.successful,
          successful_no_data: l.successful_no_data,
          failed: l.failed,
          in_progress: l.in_progress,
        })),
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok) return;
    setServerPreview({
      total: data.total,
      requires_approval: data.requires_approval,
      threshold: data.threshold,
      lines: data.lines,
    });
    setPricedPairs(
      new Set(
        data.lines
          .filter((l: { has_pricing: boolean }) => l.has_pricing)
          .map((l: { api_code: string }) => `${cid}:${l.api_code}`)
      )
    );
  }

  // Debounced auto-refresh whenever any input changes. The ref-based reader
  // in refreshPreview() means we always send the latest values.
  useEffect(() => {
    const t = setTimeout(() => {
      refreshPreview();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, effectiveDate, lines]);

  function updateLine(idx: number, patch: Partial<LineState>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, emptyLine()]);
  }

  function removeLine(idx: number) {
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, i) => i !== idx)));
  }

  function onApiSelect(idx: number, code: string) {
    if (code === NEW_API_SENTINEL) {
      setShowApiCreate(idx);
      return;
    }
    const api = apiByCode.get(code);
    updateLine(idx, {
      api_code: code,
      api_name: api?.name ?? code,
    });
  }

  function onApiCreated(idx: number, api: ApiOpt) {
    setApis((prev) => [...prev, api].sort((a, b) => a.name.localeCompare(b.name)));
    updateLine(idx, { api_code: api.product_code, api_name: api.name });
    setShowApiCreate(null);
  }

  async function submitForm(opts: { submit: boolean }) {
    setError(null);
    setSuccess(null);
    if (!accountId) return setError("Pick an account.");
    if (!reason.trim()) return setError("Reason is required so the entry is traceable.");
    const validLines = lines.filter((l) => l.api_code);
    if (validLines.length === 0) return setError("Add at least one SKU line with units.");
    if (validLines.some((l) => l.successful + l.successful_no_data + l.failed + l.in_progress === 0)) {
      return setError("Each line needs at least one non-zero unit count.");
    }

    startTransition(async () => {
      const res = await fetch("/api/manual-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          client_id: accountId,
          effective_date: effectiveDate,
          reason: reason.trim(),
          reference: reference.trim() || null,
          submit: opts.submit,
          lines: validLines.map((l) => ({
            api_code: l.api_code,
            hits_via: l.hits_via,
            vendor: l.vendor || null,
            successful: l.successful,
            successful_no_data: l.successful_no_data,
            failed: l.failed,
            in_progress: l.in_progress,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? `Server returned ${res.status}`);
        return;
      }
      setSuccess(
        opts.submit
          ? data.requires_approval
            ? "Submitted for approval."
            : "Posted and approved."
          : "Saved as draft."
      );
      router.push(returnTo ?? `/admin/manual-entries/${data.id}`);
      router.refresh();
    });
  }

  const total = serverPreview?.total ?? 0;
  const requiresApproval = serverPreview?.requires_approval ?? false;
  const unpriced = previewLines.filter((l) => l.api_code && !l.has_pricing);

  return (
    <div className="space-y-6">
      {/* ---------- 1. Header ---------- */}
      <section
        className="rounded-md border border-border bg-bg-raised p-5 dash-enter"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <SectionHeader index={1} title="Entry details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Account" required>
            {lockedAccountId !== undefined ? (
              <div className="w-full bg-bg-sunken text-ink border border-border rounded px-3 py-2 text-sm flex items-center justify-between">
                <span>
                  {accounts.find((c) => c.id === lockedAccountId)?.display_name ?? "—"}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-ink-faint font-mono">
                  scoped
                </span>
              </div>
            ) : (
              <Combobox
                options={accounts}
                value={accountId === "" ? "" : String(accountId)}
                onChange={(v) => {
                  setAccountId(v ? Number(v) : "");
                  refreshPreview();
                }}
                getValue={(c) => String(c.id)}
                getLabel={(c) => `${c.display_name}${c.is_sandbox ? " (sandbox)" : ""}`}
                keys={["display_name"]}
                emptyLabel="Select account…"
                searchPlaceholder="Search accounts…"
                className="py-2"
              />
            )}
          </Field>

          <Field label="Effective date" required>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              onBlur={refreshPreview}
              className="w-full bg-bg text-ink border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </Field>

          <Field label="Reason" required className="md:col-span-2">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Offline batch transcription run for Q2 backfill"
              className="w-full bg-bg text-ink border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </Field>

          <Field label="Reference" className="md:col-span-2">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ticket #4521 · email subject · contract clause"
              className="w-full bg-bg text-ink border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </Field>
        </div>
      </section>

      {/* ---------- 2. Lines ---------- */}
      <section
        className="rounded-md border border-border bg-bg-raised p-5 dash-enter"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <div className="flex items-center justify-between">
          <SectionHeader index={2} title="Usage lines" />
          <Button variant="ghost" size="sm" onClick={addLine}>
            <Plus size={12} strokeWidth={1.5} /> Add line
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="rounded border border-border bg-bg p-3">
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-12 md:col-span-4">
                  <label className="text-[11px] uppercase tracking-wider text-ink-faint">SKU</label>
                  <div className="mt-1">
                    <Combobox
                      options={apis}
                      value={line.api_code}
                      onChange={(v) => {
                        onApiSelect(idx, v);
                        refreshPreview();
                      }}
                      getValue={(a) => a.product_code}
                      getLabel={(a) => `${a.product_code} – ${a.name}`}
                      keys={["product_code", "name", "category"]}
                      emptyLabel="Select SKU…"
                      searchPlaceholder="Search code, name, category…"
                      sentinel={{ value: NEW_API_SENTINEL, label: "+ Create new SKU…" }}
                    />
                  </div>
                </div>

                <div className="col-span-6 md:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-ink-faint">Channel</label>
                  <select
                    value={line.hits_via}
                    onChange={(e) =>
                      updateLine(idx, { hits_via: e.target.value as LineState["hits_via"] })
                    }
                    className="w-full mt-1 bg-bg-raised text-ink border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="Bulk">Bulk</option>
                    <option value="Integration">Integration</option>
                    <option value="Console">Console</option>
                  </select>
                </div>

                <div className="col-span-6 md:col-span-3">
                  <label className="text-[11px] uppercase tracking-wider text-ink-faint">Vendor</label>
                  <input
                    list={`vendors-${idx}`}
                    value={line.vendor}
                    onChange={(e) => updateLine(idx, { vendor: e.target.value })}
                    placeholder="InHouse / Cumulus Cloud / …"
                    className="w-full mt-1 bg-bg-raised text-ink border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <datalist id={`vendors-${idx}`}>
                    {vendors.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>

                <div className="col-span-12 md:col-span-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    className="text-ink-faint hover:text-bad-ink"
                    title="Remove line"
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                    Remove
                  </Button>
                </div>

                <HitField
                  label="Successful"
                  value={line.successful}
                  onChange={(n) => updateLine(idx, { successful: n })}
                  onBlur={refreshPreview}
                />
                <HitField
                  label="No data"
                  value={line.successful_no_data}
                  onChange={(n) => updateLine(idx, { successful_no_data: n })}
                  onBlur={refreshPreview}
                />
                <HitField
                  label="Failed"
                  value={line.failed}
                  onChange={(n) => updateLine(idx, { failed: n })}
                  onBlur={refreshPreview}
                />
                <HitField
                  label="In progress"
                  value={line.in_progress}
                  onChange={(n) => updateLine(idx, { in_progress: n })}
                  onBlur={refreshPreview}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 3. Preview ---------- */}
      <section
        className="rounded-md border border-border bg-bg-raised p-5 dash-enter"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <div className="flex items-center justify-between">
          <SectionHeader index={3} title="Preview" />
          <Button variant="ghost" size="sm" onClick={refreshPreview}>
            <Sparkles size={12} strokeWidth={1.5} /> Refresh
          </Button>
        </div>

        {serverPreview ? (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-border bg-bg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg-sunken text-ink-muted">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">SKU</th>
                    <th className="text-right font-medium px-3 py-2 tnum">Units</th>
                    <th className="text-right font-medium px-3 py-2 tnum">Revenue</th>
                    <th className="text-left font-medium px-3 py-2">Pricing</th>
                  </tr>
                </thead>
                <tbody>
                  {serverPreview.lines.map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 text-ink font-mono">{l.api_code}</td>
                      <td className="px-3 py-2 text-right tnum text-ink-muted">
                        {formatNumber(
                          lines.find((x) => x.api_code === l.api_code)?.successful ?? 0
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tnum text-ink">
                        {formatMoney(l.revenue, { precision: 2 })}
                      </td>
                      <td className="px-3 py-2">
                        {l.has_pricing ? (
                          <span className="text-xs text-ok-ink">Rate found</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-warn-ink">
                            <AlertTriangle size={11} strokeWidth={1.5} />
                            No pricing — revenue will be 0
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-ink-muted flex items-baseline gap-2">
                Total{" "}
                <span className="font-serif tnum text-ink text-2xl leading-none" style={{ fontWeight: 600 }}>
                  <RollingText
                    text={formatMoney(total, { precision: 2 })}
                    options={{ direction: "up" }}
                    colorOnChange="rise-good"
                    signValue={total}
                  />
                </span>
                {requiresApproval && (
                  <span className="ml-3 inline-flex items-center gap-1 text-xs text-warn-ink">
                    <AlertTriangle size={11} strokeWidth={1.5} />
                    Exceeds {formatMoney(serverPreview.threshold, { compact: true })} — admin approval required
                  </span>
                )}
              </div>
            </div>

            {unpriced.length > 0 && (
              <div className="text-xs text-warn-ink bg-warn-bg rounded px-3 py-2">
                {unpriced.length} {unpriced.length === 1 ? "line has" : "lines have"} no
                pricing for this account. The entry will save and the dashboard alert
                panel will surface the unpriced pair — set rates in the pricing editor.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 text-sm text-ink-faint">
            Pick an account and a SKU, then enter unit counts. The preview appears here.
          </div>
        )}
      </section>

      {/* ---------- Errors / actions ---------- */}
      {error && (
        <div className="rounded border border-bad bg-bad-bg text-bad-ink px-4 py-2 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-ok bg-ok-bg text-ok-ink px-4 py-2 text-sm">
          {success}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pb-8">
        <Button variant="secondary" disabled={pending} onClick={() => submitForm({ submit: false })}>
          Save draft
        </Button>
        <Button variant="primary" disabled={pending} onClick={() => submitForm({ submit: true })}>
          {requiresApproval ? "Submit for approval" : "Approve & post"}
        </Button>
      </div>

      {/* ---------- Inline Create-API sub-form ---------- */}
      {showApiCreate !== null && (
        <ApiFormModal
          mode="create"
          existingCodes={new Set(apis.map((a) => a.product_code))}
          onCancel={() => setShowApiCreate(null)}
          onSaved={(api) => onApiCreated(showApiCreate, api)}
        />
      )}
    </div>
  );
}

function SectionHeader({ index, title }: { index: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent-bg text-accent-ink text-[11px] font-mono">
        {index}
      </span>
      <h2 className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
        {title}
      </h2>
    </div>
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

function HitField({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  onBlur: () => void;
}) {
  return (
    <div className="col-span-6 md:col-span-3">
      <label className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</label>
      <input
        type="number"
        min={0}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onBlur={onBlur}
        placeholder="0"
        className="w-full mt-1 bg-bg-raised text-ink border border-border rounded px-2 py-1.5 text-sm font-mono tnum focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}

