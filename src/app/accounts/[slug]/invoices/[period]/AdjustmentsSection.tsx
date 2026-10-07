"use client";
import { useState, useTransition } from "react";
import { Plus, X, Loader2, Minus } from "lucide-react";
import type { StatementAdjustment } from "@/lib/repos/statements";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { addInvoiceAdjustment, removeInvoiceAdjustment } from "./actions";

type Variant = "internal" | "customer";

export function AdjustmentsSection({
  accountId,
  accountSlug,
  periodId,
  adjustments,
  status,
  canEdit,
  variant = "internal",
}: {
  accountId: number;
  accountSlug: string;
  periodId: number;
  adjustments: StatementAdjustment[];
  status: "draft" | "final" | "issued";
  canEdit: boolean;
  variant?: Variant;
}) {
  if (status === "draft") return null;

  const editable = canEdit && status === "final";
  const subtotal = adjustments.reduce((s, a) => s + a.amount, 0);

  if (!editable && adjustments.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="text-xs uppercase tracking-wider text-ink-muted mb-2 flex items-center justify-between">
        <span>Credits & adjustments</span>
        {adjustments.length > 0 && (
          <span className="font-mono tnum text-ink-faint">
            {adjustments.length} item{adjustments.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {adjustments.length === 0 ? (
        <div className="text-xs text-ink-faint italic">No adjustments on this invoice.</div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          {adjustments.map((adj, i) => (
            <AdjustmentRow
              key={adj.id}
              adj={adj}
              accountId={accountId}
              accountSlug={accountSlug}
              periodId={periodId}
              variant={variant}
              editable={editable}
              isLast={i === adjustments.length - 1}
            />
          ))}
          <div className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 bg-bg-sunken border-t border-border">
            <div className="col-span-9 text-xs uppercase tracking-wider text-ink-muted" style={{ fontWeight: 500 }}>
              Adjustments subtotal
            </div>
            <div
              className={`col-span-3 text-right font-mono tnum text-sm ${
                subtotal < 0 ? "text-bad-ink" : subtotal > 0 ? "text-warn-ink" : "text-ink"
              }`}
              style={{ fontWeight: 500 }}
            >
              {formatMoney(subtotal, { precision: 2 })}
            </div>
          </div>
        </div>
      )}

      {editable && <AddForm accountId={accountId} accountSlug={accountSlug} periodId={periodId} />}
    </div>
  );
}

function AdjustmentRow({
  adj,
  accountId,
  accountSlug,
  periodId,
  variant,
  editable,
  isLast,
}: {
  adj: StatementAdjustment;
  accountId: number;
  accountSlug: string;
  periodId: number;
  variant: Variant;
  editable: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCredit = adj.amount < 0;

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const res = await removeInvoiceAdjustment(accountId, accountSlug, periodId, adj.id);
      if (!res.ok) setError(res.error ?? "Remove failed");
    });
  };

  return (
    <div
      className={`grid grid-cols-12 gap-2 items-start px-3 py-2.5 ${
        isLast ? "" : "border-b border-border"
      }`}
    >
      <div className="col-span-7 min-w-0">
        <div className="text-sm text-ink flex items-center gap-1.5">
          {isCredit ? (
            <Minus size={11} strokeWidth={1.75} className="text-bad-ink shrink-0" />
          ) : (
            <Plus size={11} strokeWidth={1.75} className="text-warn-ink shrink-0" />
          )}
          {adj.label}
        </div>
        {adj.notes && <div className="text-xs text-ink-faint mt-0.5">{adj.notes}</div>}
        {variant === "internal" && (
          <div className="text-[11px] font-mono text-ink-faint mt-0.5 uppercase tracking-wider">
            {adj.created_by_email ?? "user"} · {formatStamp(adj.created_at)}
          </div>
        )}
        {error && <div className="text-[10px] text-bad-ink mt-0.5">{error}</div>}
      </div>
      <div
        className={`col-span-4 text-right font-mono tnum text-sm ${
          isCredit ? "text-bad-ink" : "text-warn-ink"
        }`}
        style={{ fontWeight: 500 }}
      >
        {formatMoney(adj.amount, { precision: 2 })}
      </div>
      <div className="col-span-1 text-right">
        {editable && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={remove}
            disabled={pending}
            aria-label={`Remove ${adj.label}`}
            leadingIcon={
              pending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <X size={12} strokeWidth={1.75} />
              )
            }
          />
        )}
      </div>
    </div>
  );
}

function AddForm({
  accountId,
  accountSlug,
  periodId,
}: {
  accountId: number;
  accountSlug: string;
  periodId: number;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [sign, setSign] = useState<"credit" | "charge">("credit");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setLabel(""); setAmount(""); setNotes(""); setSign("credit"); setError(null);
  };

  if (!open) {
    return (
      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          leadingIcon={<Plus size={12} strokeWidth={1.75} />}
        >
          Add credit or adjustment
        </Button>
      </div>
    );
  }

  const submit = () => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a positive amount; the sign comes from the toggle."); return;
    }
    if (!label.trim()) { setError("Label is required."); return; }
    const signed = sign === "credit" ? -Math.abs(n) : Math.abs(n);
    startTransition(async () => {
      const res = await addInvoiceAdjustment(accountId, accountSlug, periodId, {
        label: label.trim(),
        amount: signed,
        notes: notes.trim() || null,
      });
      if (!res.ok) setError(res.error ?? "Add failed");
      else { reset(); setOpen(false); }
    });
  };

  return (
    <div className="mt-3 border border-border rounded-md p-4 bg-bg-sunken">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-ink-muted" style={{ fontWeight: 500 }}>
          New adjustment
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); reset(); }}
          className="text-ink-faint hover:text-ink"
          aria-label="Cancel"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-7">
          <label className="block text-[11px] uppercase tracking-wider text-ink-faint mb-1">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="April overbilling correction"
            className="w-full bg-bg-raised border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent transition-colors duration-fast ease-expo"
            autoFocus
          />
        </div>
        <div className="col-span-5">
          <label className="block text-[11px] uppercase tracking-wider text-ink-faint mb-1">Amount (₹)</label>
          <div className="flex">
            <div className="inline-flex rounded-l overflow-hidden border border-r-0 border-border">
              <button
                type="button"
                onClick={() => setSign("credit")}
                className={`px-2 text-xs ${sign === "credit" ? "bg-bad-bg text-bad-ink" : "bg-bg-raised text-ink-muted hover:text-ink"}`}
                title="Credit (reduces total)"
              >
                <Minus size={12} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setSign("charge")}
                className={`px-2 text-xs border-l border-border ${sign === "charge" ? "bg-warn-bg text-warn-ink" : "bg-bg-raised text-ink-muted hover:text-ink"}`}
                title="Late charge (adds to total)"
              >
                <Plus size={12} strokeWidth={2} />
              </button>
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="4500.00"
              inputMode="decimal"
              className="flex-1 bg-bg-raised border border-border rounded-r px-2.5 py-1.5 text-sm font-mono tnum focus:outline-none focus:border-accent transition-colors duration-fast ease-expo"
            />
          </div>
        </div>
        <div className="col-span-12">
          <label className="block text-[11px] uppercase tracking-wider text-ink-faint mb-1">Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal context for finance"
            className="w-full bg-bg-raised border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent transition-colors duration-fast ease-expo"
          />
        </div>
      </div>

      {error && <div className="mt-3 text-xs text-bad-ink bg-bad-bg rounded px-2 py-1">{error}</div>}

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={submit}
          disabled={pending}
          leadingIcon={pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={1.75} />}
        >
          Add adjustment
        </Button>
      </div>
    </div>
  );
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}
