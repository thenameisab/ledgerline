"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ProfileModal, type ProfileTarget } from "./ProfileModal";

/** Admin-side "Edit" affordance for a user row. Opens the shared ProfileModal
 *  with role editing enabled; the API still enforces the last-admin guard. */
export function EditUserButton({ target, isSelf }: { target: ProfileTarget; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ink-muted hover:text-accent-ink inline-flex items-center gap-1 transition-colors duration-fast ease-expo"
        title="Edit this user's profile"
      >
        <Pencil size={12} strokeWidth={1.5} /> Edit
      </button>
      <ProfileModal
        open={open}
        onOpenChange={setOpen}
        target={target}
        canEditRole
        isSelf={isSelf}
      />
    </>
  );
}
