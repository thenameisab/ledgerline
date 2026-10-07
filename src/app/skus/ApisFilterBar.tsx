"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { FilterPill } from "@/components/ui/FilterPill";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "high-volume", label: "High volume" },
  // "Low margin" only considers APIs whose cost is actually known. "Cost
  // unknown" is the complement, and at today's rate coverage it is where
  // almost every API lives — so the two chips together say "here is what the
  // margin number can see, and here is what it cannot".
  { value: "low-margin", label: "Low margin", costOnly: true },
  { value: "cost-unknown", label: "Cost unknown", costOnly: true },
  { value: "inactive", label: "Inactive" },
];

export function ApisFilterBar({
  active,
  showCost = false,
}: {
  active: { filter?: string; q?: string; sort?: string };
  /** The cost-derived chips are hidden from roles that cannot see cost. */
  showCost?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setFilter(f: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (f === "all") params.delete("filter");
    else params.set("filter", f);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    router.replace(pathname);
  }

  const activeFilter = active.filter ?? "all";
  const hasAny = !!active.filter || !!active.sort;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div role="tablist" className="inline-flex items-center gap-1.5">
        {FILTERS.filter((f) => showCost || !f.costOnly).map((f) => (
          <FilterPill
            key={f.value}
            label={f.label}
            active={activeFilter === f.value}
            onClick={() => setFilter(f.value)}
          />
        ))}
      </div>

      {hasAny && (
        <button
          onClick={clearAll}
          className="text-xs text-ink-muted hover:text-ink inline-flex items-center gap-1"
        >
          <X size={12} strokeWidth={1.5} /> Clear
        </button>
      )}
    </div>
  );
}
