"use client";

// Banner shown on a soft-deleted (or merged-away) account's pages. States the
// undo deadline and, for admins, offers the one-click undo that reverses the
// whole operation (reverseAccountOperation replays the journal).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { formatDateLong } from "@/lib/format";

export function DeletedAccountBanner({
  opId,
  kind,
  mergedIntoName,
  deadline,
  canUndo,
}: {
  opId: number | null;
  kind: "merge" | "delete" | null;
  mergedIntoName: string | null;
  deadline: string | null;
  canUndo: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function undo() {
    if (!opId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/account-operations/${opId}/reverse`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error("Couldn't undo", { description: data.error });
        return;
      }
      toast.success(kind === "merge" ? "Merge undone" : "Delete undone", {
        description: "All records restored.",
      });
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const what =
    kind === "merge"
      ? `This account was merged${mergedIntoName ? ` into ${mergedIntoName}` : ""}`
      : "This account was deleted";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-7 pt-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-bad/40 bg-bad-bg px-4 py-3">
        <Trash2 size={16} className="shrink-0 text-bad-ink" aria-hidden />
        <p className="flex-1 min-w-[200px] text-sm text-bad-ink leading-snug">
          {what}.{" "}
          {deadline
            ? `It can be restored until ${formatDateLong(deadline)}, after which this becomes permanent.`
            : "The undo window has closed."}
          {!canUndo && deadline ? " Ask an admin to undo it." : ""}
        </p>
        {canUndo && opId && deadline && (
          <Button
            variant="secondary"
            size="sm"
            onClick={undo}
            disabled={loading}
            leadingIcon={loading ? <Loader2 className="animate-spin" /> : <Undo2 />}
          >
            {loading ? "Restoring…" : "Undo"}
          </Button>
        )}
      </div>
    </div>
  );
}
