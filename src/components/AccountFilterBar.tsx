"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { X, ChevronDown, ArrowDown, ArrowUp, ArrowDownUp } from "lucide-react";
import { STATUS_BUCKETS as STATUS_CHIPS } from "@/lib/account-buckets";
import { FilterPill } from "./ui/FilterPill";
import { DateRangePicker } from "./ui/DateRangePicker";
import { fuzzyFilter } from "@/lib/fuzzy";

// Sort options reflect only fields we can compute exactly (no per-account margin
// — that requires vendor allocation we don't have yet).
const SORTS: { key: string; label: string; dir: "asc" | "desc" | null }[] = [
  { key: "revenue.desc", label: "Revenue", dir: "desc" },
  { key: "revenue.asc", label: "Revenue", dir: "asc" },
  { key: "hits.desc", label: "Units", dir: "desc" },
  { key: "hits.asc", label: "Units", dir: "asc" },
  { key: "apis_used.desc", label: "SKUs used", dir: "desc" },
  { key: "display_name.asc", label: "Name A→Z", dir: null },
];

export function AccountFilterBar({
  groups,
  active,
  from,
  to,
}: {
  groups: { id: number; name: string }[];
  active: { bucket?: string; group?: string; q?: string; sort?: string; from?: string; to?: string };
  // Server-resolved window (URL params > cookie > default). The picker shows
  // this, not a raw mtdRange fallback, so its label matches the page's data.
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");

  const updateParam = (key: string, value: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (value == null || value === "") sp.delete(key);
    else sp.set(key, value);
    router.replace(`${pathname}?${sp.toString()}`);
  };

  const clearAll = () => {
    router.replace(pathname);
  };

  const activeBucket = active.bucket ?? "all";
  const hasAny = !!active.bucket || !!active.group || !!active.sort || !!active.from || !!active.to;
  const selectedGroup = groups.find((a) => String(a.id) === active.group);
  const currentSort = SORTS.find((s) => s.key === (active.sort ?? "revenue.desc")) ?? SORTS[0];

  // close popovers on outside click
  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setGroupOpen(false);
      }
    };
    if (groupOpen) document.addEventListener("mousedown", onDoc);
    else setGroupQuery("");
    return () => document.removeEventListener("mousedown", onDoc);
  }, [groupOpen]);

  const filteredGroups = fuzzyFilter(groups, groupQuery, ["name"]);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <DateRangePicker from={from} to={to} />

      {/* Status filter chips — canonical FilterPill */}
      <div role="tablist" className="inline-flex items-center gap-1.5">
        {STATUS_CHIPS.map((c) => (
          <FilterPill
            key={c.key}
            label={c.label}
            active={activeBucket === c.key}
            onClick={() => updateParam("bucket", c.key === "all" ? null : c.key)}
          />
        ))}
      </div>

      {/* Group facet */}
      <div ref={groupRef} className="relative">
        <button
          onClick={() => setGroupOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={groupOpen}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors duration-fast ease-expo ${
            selectedGroup
              ? "bg-accent-bg text-accent-ink border-accent"
              : "bg-bg-raised text-ink-muted hover:text-ink border-border"
          }`}
        >
          {selectedGroup ? `Group: ${selectedGroup.name}` : "Group"}
          <ChevronDown
            size={11}
            strokeWidth={1.75}
            className={`transition-transform duration-fast ease-expo ${
              groupOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {groupOpen && (
          <div
            role="listbox"
            className="absolute top-full mt-1 left-0 z-10 bg-bg-raised border border-border rounded-lg min-w-[220px] py-1 origin-top-left"
          >
            <div className="px-2 pb-1 mb-1 border-b border-border">
              <input
                autoFocus
                value={groupQuery}
                onChange={(e) => setGroupQuery(e.target.value)}
                placeholder="Search groups…"
                className="w-full bg-transparent text-xs text-ink outline-none py-1 placeholder:text-ink-faint"
              />
            </div>
            <button
              role="option"
              aria-selected={!selectedGroup}
              onClick={() => {
                updateParam("group", null);
                setGroupOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors duration-fast ease-expo ${
                !selectedGroup ? "bg-accent-bg text-accent-ink" : "text-ink hover:bg-bg-sunken"
              }`}
            >
              All groups
            </button>
            {filteredGroups.map((a) => (
              <button
                key={a.id}
                role="option"
                aria-selected={String(a.id) === active.group}
                onClick={() => {
                  updateParam("group", String(a.id));
                  setGroupOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors duration-fast ease-expo ${
                  String(a.id) === active.group ? "bg-accent-bg text-accent-ink" : "text-ink hover:bg-bg-sunken"
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort dropdown — single chevron affordance, native select wrapped so it inherits the chip styling */}
      <div className="relative inline-block">
        <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint">
          {currentSort.dir === "asc" ? (
            <ArrowUp size={11} strokeWidth={1.75} />
          ) : currentSort.dir === "desc" ? (
            <ArrowDown size={11} strokeWidth={1.75} />
          ) : (
            <ArrowDownUp size={11} strokeWidth={1.75} />
          )}
        </div>
        <select
          value={active.sort ?? "revenue.desc"}
          onChange={(e) =>
            updateParam("sort", e.target.value === "revenue.desc" ? null : e.target.value)
          }
          className="appearance-none bg-bg-raised border border-border rounded-md pl-7 pr-7 py-1.5 text-xs text-ink-muted hover:text-ink focus:outline-none focus:border-accent transition-colors duration-fast ease-expo"
          aria-label="Sort accounts"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort by {s.label.toLowerCase()}
              {s.dir === "asc" ? " (low to high)" : s.dir === "desc" ? " (high to low)" : ""}
            </option>
          ))}
        </select>
        <ChevronDown
          size={11}
          strokeWidth={1.75}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint"
        />
      </div>

      {hasAny && (
        <button
          onClick={clearAll}
          className="text-xs text-ink-muted hover:text-ink inline-flex items-center gap-1 transition-colors duration-fast ease-expo"
        >
          <X size={12} strokeWidth={1.5} /> Clear
        </button>
      )}
    </div>
  );
}

