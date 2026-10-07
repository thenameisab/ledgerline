"use client";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortHeader({
  column,
  label,
  align = "left",
  param = "sort",
}: {
  column: string;
  label: string;
  align?: "left" | "right";
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param);
  const [activeCol, dir] = current ? current.split(".") : [null, null];
  const isActive = activeCol === column;

  function onClick() {
    const params = new URLSearchParams(searchParams.toString());
    if (!isActive) {
      // Numeric metrics most useful descending first; alpha defaults asc.
      params.set(param, `${column}.desc`);
    } else if (dir === "desc") {
      params.set(param, `${column}.asc`);
    } else {
      params.delete(param);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  const Icon = !isActive ? ArrowUpDown : dir === "desc" ? ArrowDown : ArrowUp;
  const ariaSort = !isActive ? undefined : dir === "desc" ? "descending" : "ascending";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-sort={ariaSort}
      aria-pressed={isActive}
      className={`group inline-flex items-center gap-1 text-xs uppercase tracking-wide font-medium transition-colors duration-fast ease-expo ${
        isActive ? "text-accent-ink" : "text-ink-muted hover:text-ink"
      } ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      <span>{label}</span>
      <Icon
        size={11}
        strokeWidth={isActive ? 2 : 1.5}
        className={
          isActive
            ? "text-accent-ink"
            : "text-ink-faint opacity-30 group-hover:opacity-100 transition-opacity duration-fast ease-expo"
        }
      />
    </button>
  );
}

