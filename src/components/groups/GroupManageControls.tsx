"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, GitMerge, Trash2, X, AlertCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { RollingText } from "@/components/ui/RollingText";

type Group = { id: number; name: string };

const dialogContentClass = [
  "fixed z-50 left-1/2 top-[22vh] -translate-x-1/2",
  "w-full max-w-[440px] bg-bg-raised rounded-lg border border-border shadow-high",
  "p-6 focus:outline-none",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "duration-150",
].join(" ");

const overlayClass =
  "fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150";

export function GroupManageControls({
  groupId,
  groupName,
  memberCount,
  otherGroups,
}: {
  groupId: number;
  groupName: string;
  memberCount: number;
  otherGroups: Group[];
}) {
  return (
    <div className="flex items-center gap-2">
      <RenameDialog groupId={groupId} groupName={groupName} />
      <MergeDialog groupId={groupId} memberCount={memberCount} otherGroups={otherGroups} />
      <DeleteDialog groupId={groupId} groupName={groupName} memberCount={memberCount} />
    </div>
  );
}

function RenameDialog({ groupId, groupName }: { groupId: number; groupName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(groupName);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  function onOpenChange(next: boolean) {
    if (!next) {
      setName(groupName);
      setError(undefined);
    }
    setOpen(next);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.fieldErrors?.name ?? data.error ?? "Couldn't rename.");
        return;
      }
      toast.success("Group renamed", { description: data.name });
      router.refresh();
      setOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm" leadingIcon={<Pencil />}>
          Rename
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content aria-describedby="rename-desc" className={dialogContentClass}>
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-ink">Rename group</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded p-1 text-ink-faint hover:text-ink hover:bg-bg-sunken transition-colors" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description id="rename-desc" className="sr-only">Change this group's name.</Dialog.Description>
          <form onSubmit={save} noValidate>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(undefined);
              }}
              autoFocus
              autoComplete="off"
              className={[
                "w-full rounded border bg-bg px-3 py-2 text-sm text-ink",
                "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-raised transition-colors",
                error ? "border-bad" : "border-border",
              ].join(" ")}
            />
            {error && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-bad">
                <AlertCircle size={12} className="shrink-0" />
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-border">
              <Dialog.Close asChild>
                <Button variant="secondary" size="sm" type="button" disabled={loading}>Cancel</Button>
              </Dialog.Close>
              <Button variant="primary" size="sm" type="submit" disabled={loading} leadingIcon={loading ? <Loader2 className="animate-spin" /> : undefined}>
                <RollingText text={loading ? "Saving…" : "Save"} options={{ direction: "up" }} />
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MergeDialog({
  groupId,
  memberCount,
  otherGroups,
}: {
  groupId: number;
  memberCount: number;
  otherGroups: Group[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  function onOpenChange(next: boolean) {
    if (!next) {
      setTarget("");
      setError(undefined);
    }
    setOpen(next);
  }

  const targetName = otherGroups.find((a) => String(a.id) === target)?.name;

  async function merge() {
    if (!target) {
      setError("Choose a group to merge into.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}?merge_into=${target}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't merge.");
        return;
      }
      toast.success("Groups merged", { description: `Accounts moved into ${targetName}.` });
      router.push("/accounts/groups");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm" leadingIcon={<GitMerge />} disabled={otherGroups.length === 0}>
          Merge…
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content aria-describedby="merge-desc" className={dialogContentClass}>
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-ink">Merge group</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded p-1 text-ink-faint hover:text-ink hover:bg-bg-sunken transition-colors" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description id="merge-desc" className="text-sm text-ink-muted mb-4 leading-normal">
            Move {memberCount} account{memberCount === 1 ? "" : "s"} into the chosen group, then delete this one. This can't be undone.
          </Dialog.Description>
          <Combobox
            options={otherGroups}
            value={target}
            onChange={(v) => {
              setTarget(v);
              if (error) setError(undefined);
            }}
            getValue={(a) => String(a.id)}
            getLabel={(a) => a.name}
            keys={["name"]}
            emptyLabel="Choose target group…"
            searchPlaceholder="Search groups…"
          />
          {error && (
            <p className="mt-2 flex items-center gap-1 text-xs text-bad">
              <AlertCircle size={12} className="shrink-0" />
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-border">
            <Dialog.Close asChild>
              <Button variant="secondary" size="sm" type="button" disabled={loading}>Cancel</Button>
            </Dialog.Close>
            <Button variant="primary" size="sm" type="button" onClick={merge} disabled={loading || !target} leadingIcon={loading ? <Loader2 className="animate-spin" /> : undefined}>
              <RollingText text={loading ? "Merging…" : "Merge"} options={{ direction: "up" }} />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteDialog({
  groupId,
  groupName,
  memberCount,
}: {
  groupId: number;
  groupName: string;
  memberCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function del() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't delete.");
        return;
      }
      toast.success("Group deleted", {
        description: memberCount > 0 ? `${memberCount} account${memberCount === 1 ? "" : "s"} unassigned.` : undefined,
      });
      router.push("/accounts/groups");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(n) => { setOpen(n); if (!n) setError(undefined); }}>
      <Dialog.Trigger asChild>
        <Button variant="destructive" size="sm" leadingIcon={<Trash2 />}>
          Delete
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content aria-describedby="delete-desc" className={dialogContentClass}>
          <div className="flex items-start gap-3 mb-4">
            <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-bad-bg text-bad-ink">
              <AlertTriangle size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-ink">Delete “{groupName}”?</Dialog.Title>
              <Dialog.Description id="delete-desc" className="text-sm text-ink-muted mt-1 leading-normal">
                {memberCount > 0 ? (
                  <>Its {memberCount} account{memberCount === 1 ? "" : "s"} will be unassigned (moved to “Standalone accounts”), not deleted. To keep them grouped, use Merge instead.</>
                ) : (
                  <>This group has no accounts and will be removed.</>
                )}
              </Dialog.Description>
            </div>
          </div>
          {error && (
            <p className="mb-3 flex items-center gap-1 text-xs text-bad">
              <AlertCircle size={12} className="shrink-0" />
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Dialog.Close asChild>
              <Button variant="secondary" size="sm" type="button" disabled={loading}>Cancel</Button>
            </Dialog.Close>
            <Button variant="destructive" size="sm" type="button" onClick={del} disabled={loading} leadingIcon={loading ? <Loader2 className="animate-spin" /> : undefined}>
              <RollingText text={loading ? "Deleting…" : "Delete group"} options={{ direction: "up" }} />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
