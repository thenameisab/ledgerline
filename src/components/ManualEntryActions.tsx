"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RollingText, SUCCESS_ROLL } from "@/components/ui/RollingText";

export function ManualEntryActions({
  id,
  status,
  canApprove,
}: {
  id: number;
  status: "draft" | "pending_approval" | "approved";
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [showVoid, setShowVoid] = useState(false);
  // Holds the success beat so its label can flash green before the page
  // refreshes and the buttons change.
  const [justDid, setJustDid] = useState<null | "submit" | "approve">(null);

  function call(action: "submit" | "approve" | "void", extra: Record<string, unknown> = {}) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/manual-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, id, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? `Server returned ${res.status}`);
        return;
      }
      if (action === "void") {
        router.refresh();
        return;
      }
      setJustDid(action);
      setTimeout(() => router.refresh(), 700);
    });
  }

  return (
    <div className="rounded-md border border-border bg-bg-raised p-5 space-y-3">
      <h2 className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
        Actions
      </h2>

      {error && (
        <div className="rounded border border-bad bg-bad-bg text-bad-ink px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === "draft" && (
          <Button
            variant="primary"
            size="sm"
            disabled={pending || justDid !== null}
            onClick={() => call("submit")}
          >
            <RollingText
              text={justDid === "submit" ? "Submitted" : "Submit for approval"}
              options={{
                direction: "up",
                color: justDid === "submit" ? SUCCESS_ROLL : undefined,
              }}
            />
          </Button>
        )}
        {(status === "draft" || status === "pending_approval") && canApprove && (
          <Button
            variant="primary"
            size="sm"
            disabled={pending || justDid !== null}
            onClick={() => call("approve")}
          >
            <RollingText
              text={justDid === "approve" ? "Posted" : "Approve & post"}
              options={{
                direction: "up",
                color: justDid === "approve" ? SUCCESS_ROLL : undefined,
              }}
            />
          </Button>
        )}
        {!showVoid && (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => setShowVoid(true)}
          >
            Void entry
          </Button>
        )}
      </div>

      {showVoid && (
        <div className="rounded border border-border bg-bg p-3 space-y-2">
          <label className="block text-xs text-ink-muted">
            Void reason
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Duplicate of TICKET-1234 / corrected via TH-2026-0042"
              className="mt-1 w-full bg-bg-raised text-ink border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setShowVoid(false);
                setVoidReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending || !voidReason.trim()}
              onClick={() => call("void", { reason: voidReason.trim() })}
            >
              Confirm void
            </Button>
          </div>
          <div className="text-xs text-ink-faint">
            Voiding deletes the materialised usage rows. Revenue and KPIs revert
            immediately. The entry stays in the audit trail.
          </div>
        </div>
      )}
    </div>
  );
}
