"use client";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { shortcutMap, type Role } from "@/lib/nav-model";

// ⌘1–⌘4 mirror the sidebar's Main section. The destinations are derived from the same nav model the sidebar and the palette
// render, so a shortcut can't point somewhere the nav no longer shows.

export function KeyboardShortcuts({ role }: { role?: Role }) {
  const router = useRouter();
  // Memoised: a fresh object each render would re-subscribe the listener.
  const dest = useMemo(() => shortcutMap(role), [role]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when focus is in a text input (except Escape)
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      const meta = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") return; // handled per-modal

      if (isInput) return;

      if (meta && e.key === "k") return; // handled by CommandPalette
      if (meta && e.key === "[") { e.preventDefault(); router.back(); return; }
      if (meta && e.key === "]") { e.preventDefault(); router.forward(); return; }

      const target = meta && dest[e.key];
      if (target) { e.preventDefault(); router.push(target); }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router, dest]);

  return null;
}
