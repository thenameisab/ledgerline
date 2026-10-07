"use client";
import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SidebarCollapsedContext } from "./SidebarContext";

const COOKIE = "sb-collapsed";

function writeCookie(value: boolean) {
  document.cookie = `${COOKIE}=${value ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
}

export function SidebarShell({
  children,
  initialCollapsed = false,
}: {
  children: React.ReactNode;
  initialCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCookie(next);
      return next;
    });
  }, []);

  return (
    <SidebarCollapsedContext.Provider value={{ collapsed, toggle }}>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-bg-raised border border-border text-ink-muted hover:bg-bg-sunken hover:text-ink transition-colors duration-fast ease-expo"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="primary-nav"
      >
        <Menu size={16} strokeWidth={1.5} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-30"
          style={{ backgroundColor: "var(--color-overlay)" }}
        />
      )}

      {/* Sidebar container */}
      <div
        id="primary-nav"
        data-collapsed={collapsed ? "true" : "false"}
        className={[
          "group/nav",
          "fixed md:relative md:h-full md:shrink-0",
          "inset-y-0 left-0 z-40",
          "transform transition-[transform,width] duration-base ease-expo",
          "md:transform-none",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-14" : "md:w-56",
          "flex flex-col",
        ].join(" ")}
      >
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="md:hidden absolute top-3 right-2 z-50 inline-flex items-center justify-center w-7 h-7 rounded-md text-ink-muted hover:text-ink hover:bg-bg-sunken transition-colors duration-fast ease-expo"
          aria-label="Close navigation"
        >
          <X size={15} strokeWidth={1.5} />
        </button>

        {children}
      </div>
    </SidebarCollapsedContext.Provider>
  );
}
