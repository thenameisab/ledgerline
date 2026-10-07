"use client";

// One pending account-operation request on /admin/approvals. Shows the fresh
// preview (revenue, row counts, collisions, blocking invoices), lets the admin
// adjust the pricing resolutions the requester proposed, resolve invoice
// blockers inline, then approve (executes) or reject.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Trash2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { RollingText } from "@/components/ui/RollingText";
import { formatINR, formatDateTime } from "@/lib/format";
import {
  RowCountsSummary,
  BlockingStatementsPanel,
  CollisionsPanel,
  type PricingCollision,
  type BlockingStatement,
} from "@/components/accounts/AccountDangerControls";

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

export function ApprovalCard({
  op,
  mergePreview,
  deletePreview,
}: {
  op: {
    id: number;
    kind: "merge" | "delete";
    source_name: string;
    target_name: string | null;
    requester_name: string;
    requester_email: string;
    requested_at: string;
    note: string | null;
    resolutions: Record<string, "target" | "source">;
  };
  mergePreview: MergePreview | null;
  deletePreview: DeletePreview | null;
}) {
  const router = useRouter();
  const [resolutions, setResolutions] = useState(op.resolutions);
  const [reverts, setReverts] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | undefined>();
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  const preview = mergePreview ?? deletePreview;
  const blockers = preview?.blockingStatements ?? [];
  const unresolved = blockers.filter((s) => !reverts.has(s.id));

  async function decide(action: "approve" | "reject") {
    setActing(action);
    setError(undefined);
    try {
      const res = await fetch(`/api/account-operations/${op.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "approve"
            ? { action, resolutions, revert_statement_ids: Array.from(reverts) }
            : { action }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't apply the decision.");
        return;
      }
      toast.success(action === "approve" ? "Request approved and applied" : "Request declined", {
        description: `${op.requester_name} has been notified.`,
      });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActing(null);
    }
  }

  const title =
    op.kind === "merge" ? (
      <>
        Merge <span className="font-semibold">{op.source_name}</span> into{" "}
        <span className="font-semibold">{op.target_name}</span>
      </>
    ) : (
      <>
        Delete <span className="font-semibold">{op.source_name}</span>
      </>
    );

  return (
    <article className="rounded-lg border border-border bg-bg-raised p-5">
      <header className="flex items-start gap-3">
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg-sunken text-ink-muted">
          {op.kind === "merge" ? <GitMerge size={15} /> : <Trash2 size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm text-ink leading-snug">{title}</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            Requested by {op.requester_name} ({op.requester_email}) · {formatDateTime(op.requested_at)}
          </p>
          {op.note && <p className="mt-1 text-xs text-ink-muted italic">“{op.note}”</p>}
        </div>
      </header>

      {!preview ? (
        <p className="mt-3 text-xs text-bad">
          Preview unavailable — the account may have been deleted or merged since this was filed. Reject the request.
        </p>
      ) : (
        <div className="mt-3">
          <div className="rounded-lg border border-border bg-bg p-3">
            <p className="text-xs text-ink leading-relaxed">
              {mergePreview ? (
                <>
                  Moves <span className="font-medium tabular-nums">{formatINR(mergePreview.revenueMoved)}</span> of revenue.
                </>
              ) : (
                <>
                  All-time revenue:{" "}
                  <span className="font-medium tabular-nums">{formatINR(deletePreview!.revenue)}</span>
                </>
              )}
            </p>
            <div className="mt-1.5">
              <RowCountsSummary counts={preview.rowCounts} />
            </div>
          </div>

          {mergePreview && (
            <CollisionsPanel
              collisions={mergePreview.pricingCollisions}
              sourceName={mergePreview.source.display_name}
              targetName={mergePreview.target.display_name}
              resolutions={resolutions}
              setResolutions={setResolutions}
            />
          )}

          <BlockingStatementsPanel
            statements={blockers}
            canResolve
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
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-1 text-xs text-bad">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </p>
      )}

      <footer className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
        <Button variant="secondary" size="sm" onClick={() => decide("reject")} disabled={acting !== null}>
          <RollingText text={acting === "reject" ? "Declining…" : "Decline"} options={{ direction: "up" }} />
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => decide("approve")}
          disabled={acting !== null || !preview || unresolved.length > 0}
          leadingIcon={acting === "approve" ? <Loader2 className="animate-spin" /> : undefined}
        >
          <RollingText text={acting === "approve" ? "Applying…" : "Approve & apply"} options={{ direction: "up" }} />
        </Button>
      </footer>
    </article>
  );
}
