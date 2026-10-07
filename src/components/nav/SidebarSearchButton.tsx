"use client";
import { Search } from "lucide-react";
import { useSidebarCollapsed } from "./SidebarContext";
import {
  Root as TooltipRoot,
  Trigger as TooltipTrigger,
  Portal as TooltipPortal,
  Content as TooltipContent,
} from "@radix-ui/react-tooltip";

function trigger() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
  );
}

export function SidebarSearchButton() {
  const collapsed = useSidebarCollapsed();

  const btn = (
    <button
      type="button"
      onClick={trigger}
      aria-label="Open command palette (⌘K)"
      className={[
        "flex items-center gap-2 rounded-lg text-sm text-ink-faint",
        "border border-border bg-bg",
        "hover:bg-bg-sunken hover:text-ink hover:border-border",
        "transition-colors duration-fast ease-expo",
        collapsed
          ? "justify-center w-[40px] h-[40px] mx-auto border-0 bg-transparent hover:bg-bg-sunken"
          : "w-full px-2.5 py-2",
      ].join(" ")}
    >
      <Search size={13} strokeWidth={1.75} className="shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left text-[13px]">Search…</span>
          <kbd className="shrink-0 inline-flex items-center text-[10px] font-mono text-ink-faint border border-border rounded px-1 py-0.5 leading-none bg-bg-sunken">
            ⌘K
          </kbd>
        </>
      )}
    </button>
  );

  if (!collapsed) return btn;

  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          side="right"
          sideOffset={10}
          className="z-50 rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-bg-raised shadow-mid select-none"
        >
          Search <span className="ml-1 opacity-60">⌘K</span>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  );
}
