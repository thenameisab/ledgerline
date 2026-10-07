"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Command } from "cmdk";
import { ChevronDown, Check } from "lucide-react";
import { fuzzyFilter } from "@/lib/fuzzy";

type MultiComboboxProps<T> = {
  options: T[];
  /** Currently selected option values. */
  values: string[];
  onChange: (values: string[]) => void;
  getValue: (opt: T) => string;
  getLabel: (opt: T) => string;
  /** Fields fuzzy search matches against. */
  keys: (keyof T & string)[];
  /** Trigger label when nothing is selected. */
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** Extra trigger classes (e.g. width). */
  className?: string;
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
 * Multi-select sibling of Combobox: same portalled cmdk panel and fuzzy
 * search, but selecting an option toggles it and keeps the panel open, so
 * several picks are one open-search-click-click flow. The trigger summarises
 * the selection ("3 selected"); render the chosen items outside (chips) if
 * they need to be individually removable.
 */
export function MultiCombobox<T>({
  options,
  values,
  onChange,
  getValue,
  getLabel,
  keys,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled = false,
  className = "",
}: MultiComboboxProps<T>) {
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

  const filtered = useMemo(() => fuzzyFilter(options, query, keys), [options, query, keys]);
  const selectedSet = useMemo(() => new Set(values), [values]);

  const triggerLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (() => {
            const opt = options.find((o) => getValue(o) === values[0]);
            return opt ? getLabel(opt) : "1 selected";
          })()
        : `${values.length} selected`;

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

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = 0;
  }, [query, open]);

  const toggle = (v: string) => {
    onChange(selectedSet.has(v) ? values.filter((x) => x !== v) : [...values, v]);
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
        <span className={`truncate text-left ${values.length ? "text-ink" : "text-ink-faint"}`}>
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
              {filtered.map((o) => {
                const v = getValue(o);
                const isSel = selectedSet.has(v);
                return (
                  <Command.Item
                    key={v}
                    value={v}
                    // Toggle in place — don't close, so several picks chain.
                    onSelect={() => toggle(v)}
                    className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors duration-fast ease-expo data-[selected=true]:bg-bg-sunken ${
                      isSel ? "text-accent-ink" : "text-ink"
                    }`}
                  >
                    <span
                      className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-sm border transition-colors duration-fast ease-expo ${
                        isSel ? "border-accent bg-accent" : "border-border bg-bg-raised"
                      }`}
                      aria-hidden
                    >
                      {isSel && <Check size={10} strokeWidth={2.5} className="text-bg-raised" />}
                    </span>
                    <span className="flex-1 truncate">{getLabel(o)}</span>
                  </Command.Item>
                );
              })}
            </Command.List>
          </Command>,
          document.body
        )}
    </div>
  );
}
