"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertCircle, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { RollingText } from "@/components/ui/RollingText";
import { PROFILE_EMOJIS } from "@/lib/emoji";

export type ProfileTarget = {
  id: number;
  email: string;
  display_name: string;
  emoji: string | null;
  job_title: string | null;
  role: "admin" | "editor" | "member";
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ProfileTarget;
  /** When true, the role selector is shown and editable (admin editing a row). */
  canEditRole?: boolean;
  /** True when the signed-in user is editing their own profile. */
  isSelf?: boolean;
};

function initials(name: string, email: string): string {
  return (
    (name || email)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function ProfileModal({ open, onOpenChange, target, canEditRole = false, isSelf = false }: Props) {
  const router = useRouter();
  const [name, setName] = useState(target.display_name);
  const [jobTitle, setJobTitle] = useState(target.job_title ?? "");
  const [emoji, setEmoji] = useState<string | null>(target.emoji);
  const [role, setRole] = useState<"admin" | "editor" | "member">(target.role);
  const [errors, setErrors] = useState<{ display_name?: string; role?: string }>({});
  const [loading, setLoading] = useState(false);

  // Re-sync local state whenever the modal opens (target may differ per row).
  useEffect(() => {
    if (open) {
      setName(target.display_name);
      setJobTitle(target.job_title ?? "");
      setEmoji(target.emoji);
      setRole(target.role);
      setErrors({});
    }
  }, [open, target.display_name, target.job_title, target.emoji, target.role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ display_name: "Name is required." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: isSelf ? undefined : target.id,
          display_name: name.trim(),
          job_title: jobTitle.trim() || null,
          emoji,
          role: canEditRole ? role : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        else setErrors({ display_name: data.error ?? "Something went wrong." });
        return;
      }
      toast.success(isSelf ? "Profile updated" : `Updated ${data.user.display_name}`);
      router.refresh();
      onOpenChange(false);
    } catch {
      setErrors({ display_name: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content
          aria-describedby="profile-modal-desc"
          className={[
            "fixed z-50 left-1/2 top-[14vh] -translate-x-1/2",
            "w-full max-w-[460px] bg-bg-raised rounded-lg border border-border shadow-high",
            "p-6 focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150",
          ].join(" ")}
        >
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                aria-hidden
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full bg-bg-sunken border border-border select-none"
              >
                {emoji ? (
                  <span className="text-[22px] leading-none">{emoji}</span>
                ) : (
                  <span className="text-sm font-semibold text-accent">
                    {initials(name, target.email)}
                  </span>
                )}
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-ink leading-tight">
                  {isSelf ? "Your profile" : "Edit profile"}
                </Dialog.Title>
                <div className="text-[12px] font-mono text-ink-faint mt-0.5">{target.email}</div>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded p-1 text-ink-faint hover:text-ink hover:bg-bg-sunken transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description id="profile-modal-desc" className="sr-only">
            Update name, avatar emoji{canEditRole ? ", and role" : ""}.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label htmlFor="pm-name" className="block text-sm font-medium text-ink mb-1.5">
                  Name <span className="text-bad" aria-hidden>*</span>
                </label>
                <input
                  id="pm-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.display_name) setErrors((x) => ({ ...x, display_name: undefined }));
                  }}
                  maxLength={120}
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

              {/* Job title */}
              <div>
                <label htmlFor="pm-job-title" className="block text-sm font-medium text-ink mb-1.5">
                  Job title
                </label>
                <input
                  id="pm-job-title"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="e.g. Finance Lead"
                  className={inputClass(false)}
                />
              </div>

              {/* Emoji picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-sm font-medium text-ink">Avatar emoji</span>
                  {emoji && (
                    <button
                      type="button"
                      onClick={() => setEmoji(null)}
                      className="text-[11px] text-ink-faint hover:text-ink transition-colors"
                    >
                      Clear (use initials)
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                  {PROFILE_EMOJIS.map((em) => {
                    const selected = em === emoji;
                    return (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setEmoji(em)}
                        aria-pressed={selected}
                        aria-label={`Choose ${em}`}
                        className={[
                          "relative aspect-square rounded-md flex items-center justify-center text-[18px]",
                          "transition-colors duration-fast ease-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          selected ? "bg-accent-bg ring-1 ring-accent" : "hover:bg-bg-sunken",
                        ].join(" ")}
                      >
                        {em}
                        {selected && (
                          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-accent text-white">
                            <Check size={9} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Role */}
              <div>
                <label htmlFor="pm-role" className="block text-sm font-medium text-ink mb-1.5">
                  Role
                </label>
                {canEditRole ? (
                  <>
                    <select
                      id="pm-role"
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value as "admin" | "editor" | "member");
                        if (errors.role) setErrors((x) => ({ ...x, role: undefined }));
                      }}
                      className={[inputClass(!!errors.role), "cursor-pointer appearance-none"].join(" ")}
                    >
                      <option value="member">Member</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    {errors.role && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-bad">
                        <AlertCircle size={12} className="shrink-0" />
                        {errors.role}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center text-xs font-medium uppercase tracking-wide rounded px-2 py-0.5 bg-bg-sunken text-ink-muted capitalize">
                      {target.role}
                    </span>
                    <span className="text-[11px] text-ink-faint">Only an admin can change your role.</span>
                  </div>
                )}
              </div>
            </div>

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
                <RollingText text={loading ? "Saving…" : "Save changes"} options={{ direction: "up" }} />
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
