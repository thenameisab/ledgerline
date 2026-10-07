import { requireRole } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import {
  listPendingAccountOperations,
  previewAccountMerge,
  previewAccountDelete,
  type MergePreview,
  type DeletePreview,
} from "@/lib/repos/account-merge";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  await requireRole("admin");

  const pending = await listPendingAccountOperations();
  // Server-render each request with a fresh preview — the admin decides on
  // current data, not the snapshot the editor saw when filing.
  const cards = await Promise.all(
    pending.map(async (op) => {
      let merge: MergePreview | null = null;
      let del: DeletePreview | null = null;
      if (op.kind === "merge" && op.target_client_id) {
        merge = await previewAccountMerge(op.source_client_id, op.target_client_id);
      } else if (op.kind === "delete") {
        del = await previewAccountDelete(op.source_client_id);
      }
      return { op, merge, del };
    })
  );

  return (
    <main>
      <StatusBar
        title="Approvals"
        subtitle="Editor-requested account merges and deletes awaiting an admin decision"
      />
      <div className="mx-auto w-full max-w-[900px] px-7 py-6 space-y-4">
        {cards.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-raised p-10 text-center">
            <ShieldCheck size={28} strokeWidth={1.5} className="mx-auto text-ink-faint" aria-hidden />
            <p className="mt-3 text-sm text-ink-muted">Nothing waiting for approval.</p>
            <p className="mt-1 text-xs text-ink-faint">
              Editor requests to merge or delete an account will appear here.
            </p>
          </div>
        ) : (
          cards.map(({ op, merge, del }) => (
            <ApprovalCard
              key={op.id}
              op={{
                id: op.id,
                kind: op.kind,
                source_name: op.source_name,
                target_name: op.target_name,
                requester_name: op.requester_name,
                requester_email: op.requester_email,
                requested_at: op.requested_at,
                note: op.note,
                resolutions: (op.payload?.resolutions ?? {}) as Record<string, "target" | "source">,
              }}
              mergePreview={merge}
              deletePreview={del}
            />
          ))
        )}
      </div>
    </main>
  );
}
