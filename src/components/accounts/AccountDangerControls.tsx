"use client";

// Merge / Delete controls on the account page. Mirrors GroupManageControls
// but with the account-op semantics: a preview step (revenue moved, row counts,
// pricing collisions, blocking finalized invoices), per-row collision
// resolution, inline invoice revert, and role-branched behavior — admins
// execute immediately (reversible for the undo window), editors file a
// request that admins approve from /admin/approvals.

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { GitMerge, Trash2, X, AlertCircle, Loader2, AlertTriangle, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { RollingText } from "@/components/ui/RollingText";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";

type MergeTarget = { id: number; display_name: string };

export type PricingCollision = {
  api_code: string;
  effective_from: string;
  source_price_successful: number;
  target_price_successful: number;
};

export type BlockingStatement = {
  id: number;
  number: string;
  status: string;
  period_label: string;
  total_revenue: number;
};

type MergePreview = {
  source: { id: number; display_name: string };
  target: { id: number; display_name: string };
  revenueMoved: number;
  rowCounts: Record<string, number>;
  pricingCollisions: PricingCollision[];
  blockingStatements: BlockingStatement[];
  aliasesFolded: string[];
};

type DeletePreview = {
  account: { id: number; display_name: string };
  rowCounts: Record<string, number>;
  revenue: number;
  blockingStatements: BlockingStatement[];
};

const dialogContentClass = [
  "fixed z-50 left-1/2 top-[14vh] -translate-x-1/2",
  "w-full max-w-[520px] bg-bg-raised rounded-lg border border-border shadow-high",
  "p-6 focus:outline-none max-h-[76vh] overflow-y-auto",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "duration-150",
].join(" ");

const overlayClass =
  "fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150";

const TABLE_LABELS: Record<string, string> = {
  pricing: "pricing rows",
  sandbox_classifications: "sandbox rules",
  statements: "invoices",
  leak_dismissals: "leak dismissals",
  sandbox_billing_rules: "sandbox billing rules",
  manual_entries: "manual entries",
  usage_daily: "usage rows",
};

export function RowCountsSummary({ counts }: { counts: Record<string, number> }) {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${formatNumber(n)} ${TABLE_LABELS[t] ?? t}`);
  if (parts.length === 0) return <p className="text-xs text-ink-faint">No linked records.</p>;
  return <p className="text-xs text-ink-muted leading-relaxed">{parts.join(" · ")}</p>;
}

/** Finalized-invoice blocker with the inline resolver (admins tick to revert). */
export function BlockingStatementsPanel({
  statements,
  canResolve,
  reverts,
  onToggle,
}: {
  statements: BlockingStatement[];
  canResolve: boolean;
  reverts: Set<number>;
  onToggle: (id: number) => void;
}) {
  if (statements.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-warn bg-warn-bg p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-warn-ink mb-2">
        <FileWarning size={13} className="shrink-0" />
        {statements.length === 1 ? "A finalized invoice blocks this" : `${statements.length} finalized invoices block this`}
      </p>
      <ul className="space-y-1.5">
        {statements.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-xs text-ink">
            {canResolve && (
              <input
                type="checkbox"
                checked={reverts.has(s.id)}
                onChange={() => onToggle(s.id)}
                className="accent-[var(--accent,teal)]"
                aria-label={`Revert ${s.number} to draft`}
              />
            )}
            <span className="font-mono">{s.number}</span>
            <span className="text-ink-faint">{s.period_label}</span>
            <span className="ml-auto tabular-nums">{formatMoney(s.total_revenue)}</span>
            <span className="rounded bg-bg px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-ink-muted">{s.status}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-warn-ink/90">
        {canResolve
          ? "Tick an invoice to revert it to draft as part of this operation. Unticked invoices keep blocking."
          : "An admin will resolve these when reviewing your request."}
      </p>
    </div>
  );
}

/** Per-row keep-target / keep-source chooser for pricing collisions. */
export function CollisionsPanel({
  collisions,
  sourceName,
  targetName,
  resolutions,
  setResolutions,
}: {
  collisions: PricingCollision[];
  sourceName: string;
  targetName: string;
  resolutions: Record<string, "target" | "source">;
  setResolutions: (r: Record<string, "target" | "source">) => void;
}) {
  if (collisions.length === 0) return null;
  const keyOf = (c: PricingCollision) => `${c.api_code}|${c.effective_from}`;
  const setAll = (v: "target" | "source") => {
    const next: Record<string, "target" | "source"> = {};
    for (const c of collisions) next[keyOf(c)] = v;
    setResolutions(next);
  };
  return (
    <div className="mt-4 rounded-lg border border-border bg-bg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-ink">
          {collisions.length} pricing collision{collisions.length === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2 text-[11px]">
          <button type="button" className="text-accent hover:underline" onClick={() => setAll("target")}>
            Keep all {targetName}
          </button>
          <button type="button" className="text-accent hover:underline" onClick={() => setAll("source")}>
            Keep all {sourceName}
          </button>
        </div>
      </div>
      <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {collisions.map((c) => {
          const k = keyOf(c);
          const v = resolutions[k] ?? "target";
          return (
            <li key={k} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-ink">{c.api_code}</span>
                <span className="text-ink-faint">from {formatDate(c.effective_from)}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <label
                  className={`flex items-center gap-1.5 rounded border px-2 py-1 cursor-pointer ${
                    v === "target" ? "border-accent bg-accent/5" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name={k}
                    checked={v === "target"}
                    onChange={() => setResolutions({ ...resolutions, [k]: "target" })}
                  />
                  <span className="truncate">
                    {targetName}: <span className="tabular-nums">{formatMoney(c.target_price_successful)}</span>
                  </span>
                </label>
                <label
                  className={`flex items-center gap-1.5 rounded border px-2 py-1 cursor-pointer ${
                    v === "source" ? "border-accent bg-accent/5" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name={k}
                    checked={v === "source"}
                    onChange={() => setResolutions({ ...resolutions, [k]: "source" })}
                  />
                  <span className="truncate">
                    {sourceName}: <span className="tabular-nums">{formatMoney(c.source_price_successful)}</span>
                  </span>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-ink-faint">
        Both accounts price these APIs from the same date. Pick which price survives — nothing is dropped silently.
      </p>
    </div>
  );
}

export function AccountDangerControls({
  accountId,
  accountName,
  isAdmin,
  mergeTargets,
}: {
  accountId: number;
  accountName: string;
  isAdmin: boolean;
  mergeTargets: MergeTarget[];
}) {
  return (
    <div className="flex items-center gap-2">
      <MergeDialog accountId={accountId} accountName={accountName} isAdmin={isAdmin} mergeTargets={mergeTargets} />
      <DeleteDialog accountId={accountId} accountName={accountName} isAdmin={isAdmin} />
    </div>
  );
}

function MergeDialog({
  accountId,
  accountName,
  isAdmin,
  mergeTargets,
}: {
  accountId: number;
  accountName: string;
  isAdmin: boolean;
  mergeTargets: MergeTarget[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, "target" | "source">>({});
  const [reverts, setReverts] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  function reset() {
    setTarget("");
    setPreview(null);
    setResolutions({});
    setReverts(new Set());
    setError(undefined);
  }

  async function pickTarget(v: string) {
    setTarget(v);
    setPreview(null);
    setResolutions({});
    setReverts(new Set());
    setError(undefined);
    if (!v) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/merge?target_id=${v}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't load preview.");
        return;
      }
      setPreview(data.preview);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPreviewLoading(false);
    }
  }

  const unresolvedBlockers = preview ? preview.blockingStatements.filter((s) => !reverts.has(s.id)) : [];
  const canSubmit =
    !!preview && !loading && (isAdmin ? unresolvedBlockers.length === 0 : true);

  async function submit() {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_id: preview.target.id,
          resolutions,
          revert_statement_ids: Array.from(reverts),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't merge.");
        return;
      }
      if (data.pending) {
        toast.success("Merge request sent", { description: "Admins have been notified for approval." });
        setOpen(false);
      } else {
        toast.success("Accounts merged", {
          description: `${accountName} merged into ${preview.target.display_name}. Undo available for a limited window.`,
        });
        router.push("/accounts");
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const cta = isAdmin ? "Merge" : "Request merge";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(n) => {
        if (!n) reset();
        setOpen(n);
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm" leadingIcon={<GitMerge />} disabled={mergeTargets.length === 0}>
          {isAdmin ? "Merge into…" : "Request merge…"}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content aria-describedby="account-merge-desc" className={dialogContentClass}>
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-ink">Merge “{accountName}”</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded p-1 text-ink-faint hover:text-ink hover:bg-bg-sunken transition-colors" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description id="account-merge-desc" className="text-sm text-ink-muted mb-4 leading-normal">
            Every record moves to the target, and this account&apos;s name and aliases fold into it so future syncs land there.{" "}
            {isAdmin ? "Reversible from the account page for a limited window." : "Your request goes to an admin for approval."}
          </Dialog.Description>

          <Combobox
            options={mergeTargets}
            value={target}
            onChange={pickTarget}
            getValue={(c) => String(c.id)}
            getLabel={(c) => c.display_name}
            keys={["display_name"]}
            emptyLabel="Choose target account…"
            searchPlaceholder="Search accounts…"
          />

          {previewLoading && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
              <Loader2 size={12} className="animate-spin" /> Loading preview…
            </p>
          )}

          {preview && (
            <div className="mt-4 rounded-lg border border-border bg-bg p-3">
              <p className="text-xs text-ink leading-relaxed">
                Moves <span className="font-medium tabular-nums">{formatMoney(preview.revenueMoved)}</span> of revenue into{" "}
                <span className="font-medium">{preview.target.display_name}</span>.
              </p>
              <div className="mt-1.5">
                <RowCountsSummary counts={preview.rowCounts} />
              </div>
              {preview.aliasesFolded.length > 0 && (
                <p className="mt-1.5 text-[11px] text-ink-faint leading-snug">
                  Folded as aliases: {preview.aliasesFolded.join(", ")}
                </p>
              )}
            </div>
          )}

          {preview && (
            <CollisionsPanel
              collisions={preview.pricingCollisions}
              sourceName={preview.source.display_name}
              targetName={preview.target.display_name}
              resolutions={resolutions}
              setResolutions={setResolutions}
            />
          )}

          {preview && (
            <BlockingStatementsPanel
              statements={preview.blockingStatements}
              canResolve={isAdmin}
              reverts={reverts}
              onToggle={(id) =>
                setReverts((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            />
          )}

          {error && (
            <p className="mt-3 flex items-center gap-1 text-xs text-bad">
              <AlertCircle size={12} className="shrink-0" />
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-border">
            <Dialog.Close asChild>
              <Button variant="secondary" size="sm" type="button" disabled={loading}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              leadingIcon={loading ? <Loader2 className="animate-spin" /> : undefined}
            >
              <RollingText text={loading ? "Working…" : cta} options={{ direction: "up" }} />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteDialog({ accountId, accountName, isAdmin }: { accountId: number; accountName: string; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [reason, setReason] = useState("");
  const [reverts, setReverts] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setPreview(null);
      setReason("");
      setReverts(new Set());
      setError(undefined);
      return;
    }
    try {
      const res = await fetch(`/api/accounts/${accountId}/delete`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) setPreview(data.preview);
      else setError(data.error ?? "Couldn't load preview.");
    } catch {
      setError("Network error. Please try again.");
    }
  }

  const unresolvedBlockers = preview ? preview.blockingStatements.filter((s) => !reverts.has(s.id)) : [];
  const canSubmit = !!preview && !loading && (isAdmin ? unresolvedBlockers.length === 0 : true);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined, revert_statement_ids: Array.from(reverts) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't delete.");
        return;
      }
      if (data.pending) {
        toast.success("Delete request sent", { description: "Admins have been notified for approval." });
        setOpen(false);
      } else {
        toast.success("Account deleted", { description: "Undo available for a limited window." });
        router.push("/accounts");
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="destructive" size="sm" leadingIcon={<Trash2 />}>
          {isAdmin ? "Delete" : "Request delete"}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content aria-describedby="account-delete-desc" className={dialogContentClass}>
          <div className="flex items-start gap-3 mb-4">
            <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-bad-bg text-bad-ink">
              <AlertTriangle size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-ink">Delete “{accountName}”?</Dialog.Title>
              <Dialog.Description id="account-delete-desc" className="text-sm text-ink-muted mt-1 leading-normal">
                The account is hidden everywhere but kept intact —{" "}
                {isAdmin ? "an admin can undo this for a limited window before it becomes permanent." : "your request goes to an admin for approval."}
              </Dialog.Description>
            </div>
          </div>

          {preview && (
            <div className="rounded-lg border border-border bg-bg p-3">
              <p className="text-xs text-ink leading-relaxed">
                All-time revenue: <span className="font-medium tabular-nums">{formatMoney(preview.revenue)}</span>
              </p>
              <div className="mt-1.5">
                <RowCountsSummary counts={preview.rowCounts} />
              </div>
            </div>
          )}

          {preview && (
            <BlockingStatementsPanel
              statements={preview.blockingStatements}
              canResolve={isAdmin}
              reverts={reverts}
              onToggle={(id) =>
                setReverts((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            />
          )}

          <div className="mt-4">
            <label className="block text-xs font-medium text-ink-muted mb-1" htmlFor="delete-reason">
              Reason <span className="text-ink-faint font-normal">(optional)</span>
            </label>
            <input
              id="delete-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoComplete="off"
              placeholder="e.g. duplicate created by sync"
              className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-raised transition-colors"
            />
          </div>

          {error && (
            <p className="mt-3 flex items-center gap-1 text-xs text-bad">
              <AlertCircle size={12} className="shrink-0" />
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
            <Dialog.Close asChild>
              <Button variant="secondary" size="sm" type="button" disabled={loading}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="destructive"
              size="sm"
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              leadingIcon={loading ? <Loader2 className="animate-spin" /> : undefined}
            >
              <RollingText
                text={loading ? "Working…" : isAdmin ? "Delete account" : "Request delete"}
                options={{ direction: "up" }}
              />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
