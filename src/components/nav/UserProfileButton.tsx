"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { LogOut, Settings, ChevronsUpDown, UserPen } from "lucide-react";
import { useSidebarCollapsed } from "./SidebarContext";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type Props = {
  userId: number;
  name: string;
  email: string;
  role: "admin" | "editor" | "member";
  emoji: string | null;
  jobTitle: string | null;
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
};

export function UserProfileButton({ userId, name, email, role, emoji, jobTitle, isAdmin, signOutAction }: Props) {
  const collapsed = useSidebarCollapsed();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  const initials =
    (name || email)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";

  const openMenu = useCallback(() => {
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      setMenuPos({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.left,
        width: Math.max(rect.width, 180),
      });
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
        return;
      }
      // Only close on presses OUTSIDE the trigger/menu. Closing on an inside
      // mousedown unmounts the item before its `click` fires, so menu items
      // (Profile, Admin settings, Sign out) dead-click.
      if (e.target instanceof Node && rootRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const avatarEl = emoji ? (
    <div
      aria-hidden
      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-bg-sunken border border-border text-[15px] leading-none select-none"
    >
      {emoji}
    </div>
  ) : (
    <div
      aria-hidden
      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-[11px] font-semibold select-none"
    >
      {initials}
    </div>
  );

  const profileModal = (
    <ProfileModal
      open={profileOpen}
      onOpenChange={setProfileOpen}
      target={{ id: userId, email, display_name: name || email, emoji, job_title: jobTitle, role }}
      isSelf
    />
  );

  if (collapsed) {
    return (
      <>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label={`${name || email} — open profile`}
              className="w-[40px] h-[40px] mx-auto flex items-center justify-center rounded-lg hover:bg-bg-sunken transition-colors duration-fast ease-expo"
            >
              {avatarEl}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              sideOffset={10}
              className="z-50 rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-bg-raised shadow-mid select-none"
            >
              {name || email}
              <span className="block text-[10px] opacity-60 font-normal mt-0.5">{role}</span>
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        {profileModal}
      </>
    );
  }

  return (
    <div ref={rootRef}>
      <button
        type="button"
        onClick={open ? () => setOpen(false) : openMenu}
        aria-expanded={open}
        aria-haspopup="menu"
        className={[
          "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left",
          "hover:bg-bg-sunken transition-colors duration-fast ease-expo",
          open ? "bg-bg-sunken" : "",
        ].join(" ")}
      >
        {avatarEl}
        <div className="flex-1 min-w-0">
          {name && name !== email ? (
            <>
              <div className="text-[13px] font-medium text-ink truncate leading-tight">
                {name}
              </div>
              <div className="text-[11px] text-ink-faint truncate leading-tight mt-0.5">
                {email}
              </div>
            </>
          ) : (
            <>
              <div className="text-[13px] font-medium text-ink truncate leading-tight">
                {email}
              </div>
              <div className="text-[11px] text-ink-faint truncate leading-tight mt-0.5 capitalize">
                {role}
              </div>
            </>
          )}
        </div>
        <ChevronsUpDown
          size={13}
          strokeWidth={1.75}
          className="shrink-0 text-ink-faint"
          aria-hidden
        />
      </button>

      {/* Position-fixed dropdown — renders above the trigger, unaffected by overflow:hidden */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label="Account menu"
            className="fixed z-[70] rounded-xl border border-border bg-bg-raised shadow-high py-1.5 overflow-hidden"
            style={{
              bottom: menuPos.bottom,
              left: menuPos.left,
              width: menuPos.width,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* User identity header */}
            <div className="px-3 pt-1 pb-2.5 border-b border-border">
              <div className="text-[13px] font-semibold text-ink truncate">{name || email}</div>
              {name && name !== email && (
                <div className="text-[11px] text-ink-faint truncate mt-0.5">{email}</div>
              )}
              {(!name || name === email) && (
                <div className="text-[11px] text-ink-faint truncate mt-0.5 capitalize">{role}</div>
              )}
            </div>

            <div className="py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-ink hover:bg-bg-sunken transition-colors duration-fast ease-expo"
              >
                <UserPen size={13} strokeWidth={1.5} className="text-ink-faint" />
                Profile
              </button>
              {isAdmin && (
                <Link
                  href="/admin/settings"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-ink hover:bg-bg-sunken transition-colors duration-fast ease-expo"
                >
                  <Settings size={13} strokeWidth={1.5} className="text-ink-faint" />
                  Settings
                </Link>
              )}
            </div>

            <div className="border-t border-border">
              <ThemeToggle />
            </div>

            <div className="border-t border-border pt-1">
              <form action={signOutAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-bad hover:bg-bad-bg transition-colors duration-fast ease-expo"
                >
                  <LogOut size={13} strokeWidth={1.5} />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
      {profileModal}
    </div>
  );
}
