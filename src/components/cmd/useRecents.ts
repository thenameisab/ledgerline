"use client";

// Recently-opened entities for the command palette's empty state.
//
// Per-device only — stored in localStorage, no backend. Records the entity
// targets the user jumps to (accounts, invoices, groups, APIs, manual
// entries, vendors), deduped by href and ordered most-recent-first. Pages and
// admin nav are intentionally excluded — they already have ⌘-shortcuts.

import { useCallback, useEffect, useState } from "react";

export type RecentType =
  | "account"
  | "invoice"
  | "group"
  | "api"
  | "manual_entry"
  | "vendor";
export type RecentItem = { type: RecentType; href: string; label: string; sub?: string };

const KEY = "ledgerline.cmd.recents";
const CAP = 8;

const VALID_TYPES: ReadonlySet<string> = new Set<RecentType>([
  "account",
  "invoice",
  "group",
  "api",
  "manual_entry",
  "vendor",
]);

function read(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    // Drop entries with a type this build no longer knows — e.g. pre-rename
    // recents (type "client") whose icon lookup would render <undefined/> and
    // crash the palette.
    return arr.filter((r) => r && VALID_TYPES.has(r.type)).slice(0, CAP);
  } catch {
    return [];
  }
}

export function useRecents() {
  const [recents, setRecents] = useState<RecentItem[]>([]);

  // Load after mount — keeps SSR output empty so there's no hydration mismatch.
  useEffect(() => {
    setRecents(read());
  }, []);

  const record = useCallback((item: RecentItem) => {
    setRecents((prev) => {
      const next = [item, ...prev.filter((r) => r.href !== item.href)].slice(0, CAP);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable (private mode / quota) — recents stay in-memory */
      }
      return next;
    });
  }, []);

  return { recents, record };
}
