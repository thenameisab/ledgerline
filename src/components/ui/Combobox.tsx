"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Command } from "cmdk";
import { ChevronDown, Check } from "lucide-react";
import { fuzzyFilter } from "@/lib/fuzzy";

export type ComboboxSentinel = { value: string; label: string };

type ComboboxProps<T> = {
  options: T[];
  /** Currently selected option value, or "" when nothing is selected. */
  value: string;
  onChange: (value: string) => void;
  /** Stable value emitted for an option (e.g. product_code or String(id)). */
  getValue: (opt: T) => string;
  /** Primary label shown in the list and trigger. */
  getLabel: (opt: T) => string;
  /** Fields fuzzy search matches against. */
  keys: (keyof T & string)[];
  placeholder?: string;
  /** Shown in the list and trigger when value is "". */
  emptyLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** Extra trigger classes (e.g. width). */
  className?: string;
  /** Optional trailing action row (e.g. "+ Create new API…"). */
  sentinel?: ComboboxSentinel;
  /** When set, renders a leading row that clears the selection back to "". */
  noneLabel?: string;
};

type PanelCoords = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxListHeight: number;
};

const PANEL_MAX = 320;
const MIN_BELOW = 220; // flip up if less room than this below the trigger

/**
 * Searchable single-select dropdown with fuzzy ranking. Replaces native
 * <select> on the large/dynamic pickers (APIs, accounts) so the user can type a
 * product code, name, or any part of either to narrow the list.
 *
 * The open panel renders in a portal with fixed positioning anchored to the
 * trigger — this is deliberate: the pickers live inside tables and cards with
 * `overflow-hidden`, which would otherwise clip an absolutely-positioned panel
 * (it rendered as an invisible sliver in the Alias Resolver). Filtering is the
 * shared fuzzy ranker via shouldFilter={false}; keyboard nav comes from cmdk.
 */
export function Combobox<T>({
  options,
  value,
  onChange,
  getValue,
  getLabel,
  keys,
  placeholder = "Select…",
  emptyLabel,
  searchPlaceholder = "Search…",
  disabled = false,
  className = "",
  sentinel,
  noneLabel,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => setMounted(true), []);

  const selected = useMemo(
    () => options.find((o) => getValue(o) === value),
    [options, value, getValue]
  );
  const triggerLabel = selected ? getLabel(selected) : emptyLabel ?? placeholder;

  const filtered = useMemo(() => fuzzyFilter(options, query, keys), [options, query, keys]);

  // Position the portalled panel against the trigger's viewport rect, flipping
  // above when there isn't room below. Recomputed on scroll/resize so it tracks.
  const reposition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const placeAbove = spaceBelow < MIN_BELOW && spaceAbove > spaceBelow;
    const avail = (placeAbove ? spaceAbove : spaceBelow) - 12;
    const maxPanel = Math.max(140, Math.min(PANEL_MAX, avail));
    setCoords({
      left: r.left,
      width: r.width,
      top: placeAbove ? undefined : r.bottom + 4,
      bottom: placeAbove ? window.innerHeight - r.top + 4 : undefined,
      maxListHeight: maxPanel - 40, // leave room for the search input row
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    reposition();
    requestAnimationFrame(() => inputRef.current?.focus());
    const onMove = () => reposition();
    // capture: true so scrolls in any ancestor (table, card) reposition us.
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the list scrolled to the top as the query changes, so the best match
  // is visible rather than a stale scroll offset hiding the first rows.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = 0;
  }, [query, open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={[
          "w-full inline-flex items-center justify-between gap-2 rounded border border-border bg-bg-raised px-2.5 py-1.5 text-sm text-ink",
          "transition-colors duration-fast ease-expo focus:outline-none focus:ring-2 focus:ring-accent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        ].join(" ")}
      >
        <span className={`truncate text-left ${selected ? "text-ink" : "text-ink-faint"}`}>
          {triggerLabel}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={1.75}
          className={`shrink-0 text-ink-faint transition-transform duration-fast ease-expo ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        mounted &&
        coords &&
        createPortal(
          <Command
            ref={panelRef}
            id={listId}
            shouldFilter={false}
            // pointer-events-auto: when this picker lives inside a modal (Radix
            // Dialog locks `pointer-events: none` on the body), the portalled
            // panel would otherwise be unclickable — clicks fell through and
            // only collapsed the panel. No-op outside a modal.
            className="pointer-events-auto fixed z-[60] overflow-hidden rounded-lg border border-border bg-bg-raised shadow-high"
            style={{
              left: coords.left,
              width: coords.width,
              minWidth: 240,
              top: coords.top,
              bottom: coords.bottom,
            }}
          >
            <div className="border-b border-border px-2.5">
              <Command.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                placeholder={searchPlaceholder}
                className="h-9 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            </div>
            <Command.List
              ref={listRef}
              className="overflow-y-auto overscroll-contain p-1"
              style={{ maxHeight: coords.maxListHeight }}
            >
              <Command.Empty className="py-6 text-center text-xs text-ink-faint">
                No matches
              </Command.Empty>
              {noneLabel && !query && (
                <Command.Item
                  value="__none__"
                  onSelect={() => choose("")}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors duration-fast ease-expo data-[selected=true]:bg-bg-sunken ${
                    value === "" ? "text-accent-ink" : "text-ink-faint"
                  }`}
                >
                  <span className="flex-1 truncate">{noneLabel}</span>
                  {value === "" && <Check size={13} strokeWidth={1.75} className="shrink-0 text-accent-ink" />}
                </Command.Item>
              )}
              {filtered.map((o) => {
                const v = getValue(o);
                const isSel = v === value;
                return (
                  <Command.Item
                    key={v}
                    value={v}
                    onSelect={() => choose(v)}
                    className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors duration-fast ease-expo data-[selected=true]:bg-bg-sunken ${
                      isSel ? "text-accent-ink" : "text-ink"
                    }`}
                  >
                    <span className="flex-1 truncate">{getLabel(o)}</span>
                    {isSel && <Check size={13} strokeWidth={1.75} className="shrink-0 text-accent-ink" />}
                  </Command.Item>
                );
              })}
              {sentinel && (
                <Command.Item
                  value={`__sentinel__${sentinel.value}`}
                  onSelect={() => choose(sentinel.value)}
                  className="mt-1 flex cursor-pointer items-center gap-2 rounded border-t border-border px-2 py-1.5 text-sm text-accent-ink data-[selected=true]:bg-bg-sunken"
                >
                  {sentinel.label}
                </Command.Item>
              )}
            </Command.List>
          </Command>,
          document.body
        )}
    </div>
  );
}
