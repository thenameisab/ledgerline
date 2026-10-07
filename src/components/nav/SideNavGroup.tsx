"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useSidebarCollapsed } from "./SidebarContext";
import { ICONS } from "./SideNavItem";

// Collapsible nav group ("Configuration", "Customisation"). Opens itself when
// the current route is inside it. When the sidebar is icon-collapsed the
// header hides and children render flat — each child keeps its own tooltip.
export function SideNavGroup({
  label,
  icon,
  basePaths,
  children,
}: {
  label: string;
  icon: keyof typeof ICONS;
  basePaths: string[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const collapsed = useSidebarCollapsed();
  const childActive = basePaths.some((p) => path.startsWith(p));
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? childActive;
  const Icon = ICONS[icon];

  if (collapsed) {
    return <>{children}</>;
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        className={[
          "group/item flex items-center gap-3 rounded-md text-[13px] font-medium w-full px-2.5 py-2",
          "transition-colors duration-fast ease-expo cursor-pointer",
          // The rail is white, so hover steps *down* to the sunken surface.
          childActive && !open
            ? "text-accent-ink hover:bg-bg-sunken"
            : "text-ink-muted hover:bg-bg-sunken hover:text-ink",
        ].join(" ")}
      >
        <Icon size={15} strokeWidth={childActive ? 2 : 1.75} className="shrink-0" aria-hidden />
        <span className="flex-1 truncate leading-none text-left">{label}</span>
        <ChevronRight
          size={13}
          strokeWidth={1.75}
          className={`shrink-0 text-ink-faint transition-transform duration-fast ease-expo ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden
        />
      </button>
      {open && (
        <ul className="ml-[1.35rem] mt-1 pl-1.5 border-l border-border space-y-1">
          {children}
        </ul>
      )}
    </li>
  );
}
