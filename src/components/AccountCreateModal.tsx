"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { RollingText } from "@/components/ui/RollingText";

type Group = { id: number; name: string };

type Fields = {
  display_name: string;
  billing_entity: string;
  account_id: string;
};

const EMPTY: Fields = { display_name: "", billing_entity: "", account_id: "" };
const CREATE_GROUP_SENTINEL = "__create_new_group__";

export function AccountCreateModal({
  groups,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  initialName,
  resolveRawName,
  onSaved,
}: {
  groups: Group[];
  /** Controlled open state. When provided, the modal hides its own trigger. */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  hideTrigger?: boolean;
  /** Pre-fills the display name (e.g. the raw log name being resolved). */
  initialName?: string;
  /** When set, the created account adopts this raw log name and absorbs its unmapped usage. */
  resolveRawName?: string;
  /** Called after a successful create — the caller handles its own refresh. */
  onSaved?: (created: { id: number; slug: string }) => void;
}) {
  const router = useRouter();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;

  // Let the command palette deep-link "Create account" here via ?new=1.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!isControlled && searchParams?.get("new") === "1") setInternalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [loading, setLoading] = useState(false);

  // Local group list so an inline-created group appears and stays selected.
  const [groupList, setGroupList] = useState<Group[]>(groups);
  const [groupMode, setGroupMode] = useState<"pick" | "create">("pick");
  const [newGroupName, setNewGroupName] = useState("");
  const [groupError, setGroupError] = useState<string | undefined>();
  const [groupSaving, setGroupSaving] = useState(false);

  // Seed the form when the modal opens (covers both controlled & uncontrolled).
  useEffect(() => {
    if (open) {
      setFields({ ...EMPTY, display_name: initialName ?? "" });
      setErrors({});
      setGroupMode("pick");
      setNewGroupName("");
      setGroupError(undefined);
      setGroupList(groups);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function setOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  function set(key: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function onGroupSelect(value: string) {
    if (value === CREATE_GROUP_SENTINEL) {
      setGroupMode("create");
      setGroupError(undefined);
      return;
    }
    set("account_id", value);
  }

  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name) {
      setGroupError("Group name is required.");
      return;
    }
    setGroupSaving(true);
    setGroupError(undefined);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setGroupError(data.fieldErrors?.name ?? data.error ?? "Couldn't create group.");
        return;
      }
      const created: Group = { id: data.id, name: data.name };
      setGroupList((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      set("account_id", String(created.id));
      setGroupMode("pick");
      setNewGroupName("");
    } catch {
      setGroupError("Network error. Please try again.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const accountErrors: Partial<Record<keyof Fields, string>> = {};
    if (!fields.display_name.trim()) accountErrors.display_name = "Display name is required.";
    if (Object.keys(accountErrors).length) {
      setErrors(accountErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: fields.display_name.trim(),
          billing_entity: fields.billing_entity.trim() || null,
          account_id: fields.account_id ? Number(fields.account_id) : null,
          ...(resolveRawName ? { resolve_raw_name: resolveRawName } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
        } else {
          setErrors({ display_name: data.error ?? "Something went wrong." });
        }
        return;
      }

      toast.success("Account created", { description: data.slug });
      setOpen(false);
      if (onSaved) onSaved({ id: data.id, slug: data.slug });
      else router.refresh();
    } catch {
      setErrors({ display_name: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <Dialog.Trigger asChild>
          <Button variant="primary" size="sm" leadingIcon={<Plus />}>
            New account
          </Button>
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />

        <Dialog.Content
          aria-describedby="account-modal-desc"
          className={[
            "fixed z-50 left-1/2 top-[20vh] -translate-x-1/2",
            "w-full max-w-[480px] bg-bg-raised rounded-lg border border-border shadow-high",
            "p-6 focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-150",
          ].join(" ")}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-ink">
              New account
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded p-1 text-ink-faint hover:text-ink hover:bg-bg-sunken transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description id="account-modal-desc" className="sr-only">
            Create a new account. Display name is required; legal entity name and group are optional.
          </Dialog.Description>

          {resolveRawName && (
            <p className="mb-4 rounded border border-border bg-bg-sunken px-3 py-2 text-xs text-ink-muted leading-normal">
              Creating this account will map the raw log name{" "}
              <span className="font-mono text-ink">{resolveRawName}</span> to it and attribute its
              unmapped usage.
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {/* Display name */}
              <div>
                <label htmlFor="ccm-display-name" className="block text-sm font-medium text-ink mb-1.5">
                  Display name <span className="text-bad" aria-hidden>*</span>
                </label>
                <input
                  id="ccm-display-name"
                  type="text"
                  value={fields.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                  placeholder="Acme Corp"
                  autoFocus
                  autoComplete="off"
                  className={inputClass(!!errors.display_name)}
                />
                {errors.display_name && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-bad">
                    <AlertCircle size={12} className="shrink-0" />
                    {errors.display_name}
                  </p>
                )}
              </div>

              {/* Legal entity name */}
              <div>
                <label htmlFor="ccm-billing-entity" className="block text-sm font-medium text-ink mb-1.5">
                  Legal entity name
                </label>
                <input
                  id="ccm-billing-entity"
                  type="text"
                  value={fields.billing_entity}
                  onChange={(e) => set("billing_entity", e.target.value)}
                  placeholder="Acme Financial Services Pvt. Ltd."
                  autoComplete="off"
                  className={inputClass(false)}
                />
              </div>

              {/* Group */}
              <div>
                <label htmlFor="ccm-group" className="block text-sm font-medium text-ink mb-1.5">
                  Group
                </label>
                {groupMode === "pick" ? (
                  <Combobox
                    options={groupList}
                    value={fields.account_id}
                    onChange={onGroupSelect}
                    getValue={(a) => String(a.id)}
                    getLabel={(a) => a.name}
                    keys={["name"]}
                    emptyLabel="(None)"
                    noneLabel="(None)"
                    searchPlaceholder="Search groups…"
                    className="py-2"
                    sentinel={{ value: CREATE_GROUP_SENTINEL, label: "+ Create new group…" }}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => {
                          setNewGroupName(e.target.value);
                          if (groupError) setGroupError(undefined);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreateGroup();
                          }
                        }}
                        placeholder="New group / group name"
                        autoFocus
                        autoComplete="off"
                        className={inputClass(!!groupError)}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        type="button"
                        onClick={handleCreateGroup}
                        disabled={groupSaving}
                        leadingIcon={groupSaving ? <Loader2 className="animate-spin" /> : undefined}
                      >
                        Add
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        disabled={groupSaving}
                        onClick={() => {
                          setGroupMode("pick");
                          setNewGroupName("");
                          setGroupError(undefined);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    {groupError && (
                      <p className="flex items-center gap-1 text-xs text-bad">
                        <AlertCircle size={12} className="shrink-0" />
                        {groupError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
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
                <RollingText text={loading ? "Creating…" : "Create account"} options={{ direction: "up" }} />
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function inputClass(hasError: boolean) {
  return [
    "w-full rounded border bg-bg px-3 py-2 text-sm text-ink",
    "placeholder:text-ink-faint",
    "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-raised",
    "transition-colors",
    hasError ? "border-bad" : "border-border",
  ].join(" ");
}
