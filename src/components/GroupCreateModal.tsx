"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { RollingText } from "@/components/ui/RollingText";

export function GroupCreateModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  // Let the command palette deep-link "Create group" here via ?new=1.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("new") === "1") setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setError(undefined);
    }
    setOpen(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.fieldErrors?.name ?? data.error ?? "Something went wrong.");
        return;
      }
      toast.success("Group created", { description: data.name });
      router.refresh();
      setOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="primary" size="sm" leadingIcon={<Plus />}>
          New group
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />

        <Dialog.Content
          aria-describedby="group-modal-desc"
          className={[
            "fixed z-50 left-1/2 top-[22vh] -translate-x-1/2",
            "w-full max-w-[420px] bg-bg-raised rounded-lg border border-border shadow-high",
            "p-6 focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-150",
          ].join(" ")}
        >
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-ink">New group</Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded p-1 text-ink-faint hover:text-ink hover:bg-bg-sunken transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description id="group-modal-desc" className="sr-only">
            Create a new group that accounts can be filed under.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="acm-name" className="block text-sm font-medium text-ink mb-1.5">
              Group name <span className="text-bad" aria-hidden>*</span>
            </label>
            <input
              id="acm-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(undefined);
              }}
              placeholder="Acme Group"
              autoFocus
              autoComplete="off"
              className={[
                "w-full rounded border bg-bg px-3 py-2 text-sm text-ink",
                "placeholder:text-ink-faint",
                "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-raised",
                "transition-colors",
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
                <Button variant="secondary" size="sm" type="button" disabled={loading}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={loading}
                leadingIcon={loading ? <Loader2 className="animate-spin" /> : undefined}
              >
                <RollingText text={loading ? "Creating…" : "Create group"} options={{ direction: "up" }} />
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
