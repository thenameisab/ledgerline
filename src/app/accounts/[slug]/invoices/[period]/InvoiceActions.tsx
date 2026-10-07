"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Send, Loader2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RollingText, SUCCESS_ROLL } from "@/components/ui/RollingText";
import { finalizeInvoice, issueInvoice, type InvoiceActionResult } from "./actions";

type Action = "finalize" | "issue";

export function InvoiceActions({
  accountId,
  accountSlug,
  periodId,
  status,
  hasLines,
  canAct,
  draftNumber,
  periodLabel,
}: {
  accountId: number;
  accountSlug: string;
  periodId: number;
  status: "draft" | "final" | "issued";
  hasLines: boolean;
  canAct: boolean;
  draftNumber: string;
  periodLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [success, setSuccess] = useState<{ action: Action; number: string } | null>(null);

  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(id);
  }, [success]);

  if (!canAct) return null;

  const run = (action: Action) => {
    setError(null);
    const fn = action === "finalize"
      ? () => finalizeInvoice(accountId, accountSlug, periodId)
      : () => issueInvoice(accountId, accountSlug, periodId);
    startTransition(async () => {
      const res: InvoiceActionResult = await fn();
      if (res.ok) {
        setConfirming(null);
        setSuccess({ action, number: res.number });
      } else {
        setError(res.error ?? "Something went wrong");
      }
    });
  };

  if (status === "issued") return null;

  const successPill = success && (
    <span className="inline-flex items-center gap-1.5 text-xs text-success-ink bg-success-bg rounded px-2 py-1 success-pulse">
      <CheckCircle2 size={12} strokeWidth={1.75} />
      <RollingText
        text={
          success.action === "finalize"
            ? `Finalized as ${success.number}`
            : `Issued ${success.number}`
        }
        animateOnMount
        options={{ direction: "up", color: SUCCESS_ROLL }}
      />
    </span>
  );

  return (
    <div className="flex items-center gap-3">
      {error && (
        <span className="text-xs text-bad-ink bg-bad-bg rounded px-2 py-1">{error}</span>
      )}
      {successPill}

      {status === "draft" && (
        <Button
          variant="primary"
          disabled={pending || !hasLines}
          onClick={() => setConfirming("finalize")}
          leadingIcon={<CheckCircle2 size={14} strokeWidth={1.75} />}
        >
          Finalize invoice
        </Button>
      )}

      {status === "final" && (
        <Button
          variant="primary"
          disabled={pending}
          onClick={() => setConfirming("issue")}
          leadingIcon={<Send size={14} strokeWidth={1.75} />}
        >
          Issue to customer
        </Button>
      )}

      {confirming && (
        <ConfirmDialog
          action={confirming}
          draftNumber={draftNumber}
          periodLabel={periodLabel}
          pending={pending}
          onCancel={() => {
            if (!pending) {
              setConfirming(null);
              setError(null);
            }
          }}
          onConfirm={() => run(confirming)}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  action,
  draftNumber,
  periodLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  action: Action;
  draftNumber: string;
  periodLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, pending]);

  const isFinalize = action === "finalize";
  const title = isFinalize ? "Finalize this invoice?" : "Issue invoice to customer?";
  const year = draftNumber.match(/-(\d{4})\d{2}-/)?.[1] ?? new Date().getFullYear().toString();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-overlay)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-confirm-title"
    >
      <div
        ref={ref}
        className="bg-bg-raised border border-border rounded-lg max-w-md w-full p-6"
        style={{ animation: "row-enter var(--motion-duration-base) var(--motion-ease-soft) both" }}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2
            id="invoice-confirm-title"
            className="font-serif text-xl text-ink"
            style={{ fontWeight: 600 }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            aria-label="Cancel"
            className="text-ink-faint hover:text-ink transition-colors duration-fast disabled:opacity-50"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <p className="text-sm text-ink-muted leading-normal mb-4">
          {isFinalize ? (
            <>
              The period <span className="text-ink">{periodLabel}</span> will be locked and snapshotted.
              Subsequent price changes won&apos;t affect this invoice.
            </>
          ) : (
            <>
              Marking the invoice as issued records the send to the customer. The numbers are
              already locked.
            </>
          )}
        </p>

        <dl className="bg-bg-sunken rounded px-4 py-3 mb-5 text-xs space-y-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="uppercase tracking-wider text-ink-faint">Period</dt>
            <dd className="text-ink">{periodLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="uppercase tracking-wider text-ink-faint">
              {isFinalize ? "Invoice number" : "Invoice"}
            </dt>
            <dd className="font-mono tnum text-ink inline-flex items-center gap-1.5">
              {isFinalize ? (
                <>
                  Next <span className="text-ink-muted">TH-{year}-</span>NNNN
                </>
              ) : (
                draftNumber
              )}
            </dd>
          </div>
          {isFinalize && (
            <div className="flex items-start justify-between gap-3 pt-2 border-t border-border">
              <dt className="uppercase tracking-wider text-ink-faint inline-flex items-center gap-1">
                <Lock size={10} strokeWidth={1.75} /> After this
              </dt>
              <dd className="text-ink-muted text-right max-w-[260px]">
                Numbers can no longer be edited by price changes. Adjustments are still possible.
              </dd>
            </div>
          )}
        </dl>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            ref={confirmBtnRef}
            variant={isFinalize ? "secondary" : "primary"}
            onClick={onConfirm}
            disabled={pending}
            leadingIcon={
              pending ? (
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              ) : isFinalize ? (
                <CheckCircle2 size={14} strokeWidth={1.75} />
              ) : (
                <Send size={14} strokeWidth={1.75} />
              )
            }
          >
            {isFinalize ? "Finalize" : "Issue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
