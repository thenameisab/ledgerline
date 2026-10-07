"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Root as TooltipRoot,
  Trigger as TooltipTrigger,
  Portal as TooltipPortal,
  Content as TooltipContent,
} from "@radix-ui/react-tooltip";
import { useSidebarCollapsed } from "./SidebarContext";
import { ICONS, type IconName } from "@/lib/nav-model";

export { ICONS };

export function SideNavItem({
  href,
  label,
  icon,
  shortcut,
  badge,
  activePaths,
  excludePaths,
}: {
  href: string;
  label: string;
  icon: IconName;
  shortcut?: string;
  badge?: number;
  /** Extra route prefixes that should light this row — a single nav entry
   *  standing in for a tabbed section (Settings) is active on all its tabs. */
  activePaths?: string[];
  /**
   * Sub-paths that belong to a SIBLING row, not this one. A parent row lights
   * on everything beneath it, which is right for a vendor's own pages and
   * wrong for a sibling section that happens to live under the same prefix.
   */
  excludePaths?: string[];
}) {
  const path = usePathname();
  const collapsed = useSidebarCollapsed();
  const active =
    href === "/"
      ? path === "/"
      : (excludePaths?.some((p) => path.startsWith(p)) ?? false)
        ? false
        : path.startsWith(href) || (activePaths?.some((p) => path.startsWith(p)) ?? false);
  const Icon = ICONS[icon];

  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={[
        "group/item relative flex items-center gap-3 rounded-md text-[13px] font-medium",
        "transition-colors duration-fast ease-expo cursor-pointer",
        collapsed
          ? "justify-center w-[40px] h-[40px] mx-auto px-0"
          : "px-2.5 py-2 w-full",
        active
          ? "bg-accent-bg text-accent-ink"
          // The rail is white now, so hover has to step *down* to register.
          : "text-ink-muted hover:bg-bg-sunken hover:text-ink",
      ].join(" ")}
    >
      <Icon
        size={15}
        strokeWidth={active ? 2 : 1.75}
        className="shrink-0"
        aria-hidden
      />
      {collapsed && badge != null && badge > 0 && (
        // Icon-only rail: the number doesn't fit, so open work shows as a dot.
        <span
          className="absolute top-1.5 right-1.5 h-[6px] w-[6px] rounded-full bg-accent"
          aria-hidden
        />
      )}
      {!collapsed && (
        <>
          <span className="flex-1 truncate leading-none">{label}</span>
          {badge != null && badge > 0 && (
            <span
              className={[
                "shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1",
                "rounded-full text-[10px] font-semibold leading-none tabular-nums",
                active ? "bg-accent text-white" : "bg-accent-bg text-accent-ink",
              ].join(" ")}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
          {shortcut && !(badge != null && badge > 0) && (
            <kbd
              className={[
                "shrink-0 text-[10px] font-mono leading-none px-1 py-0.5 rounded border",
                "opacity-0 group-hover/item:opacity-100 transition-opacity duration-fast ease-expo",
                active ? "border-accent/30 text-accent-ink/70" : "border-border text-ink-faint",
              ].join(" ")}
            >
              {shortcut}
            </kbd>
          )}
        </>
      )}
    </Link>
  );

  if (!collapsed) {
    return <li>{link}</li>;
  }

  return (
    <li>
      <TooltipRoot>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="z-50 rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-bg-raised shadow-mid select-none"
          >
            {label}
            {badge != null && badge > 0 && (
              <span className="ml-2 opacity-60">{badge > 99 ? "99+" : badge} open</span>
            )}
            {shortcut && <span className="ml-2 opacity-60">{shortcut}</span>}
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </li>
  );
}
