"use client";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSidebarCollapsed, useSidebarToggle } from "./SidebarContext";

export function SidebarCollapseToggle() {
  const collapsed = useSidebarCollapsed();
  const toggle = useSidebarToggle();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-pressed={collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={[
        "hidden md:inline-flex shrink-0 items-center justify-center",
        "w-7 h-7 rounded-md",
        "text-ink-faint hover:text-ink hover:bg-bg-sunken",
        "transition-colors duration-fast ease-expo",
      ].join(" ")}
    >
      {collapsed ? (
        <PanelLeftOpen size={14} strokeWidth={1.5} />
      ) : (
        <PanelLeftClose size={14} strokeWidth={1.5} />
      )}
    </button>
  );
}
