"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { vendorTabs } from "@/lib/nav-model";

// The tab strip on one vendor's pages. Same shape as AccountTabs, because a
// vendor is the same kind of thing as an account: an entity you open and then
// read several views of. The destinations come from nav-model so the vendor
// section has one source like the rest of the nav.
//
// The query string is carried across, so switching tabs keeps the window you
// were looking at instead of resetting to the default period.

export function VendorTabs({ vendor, query }: { vendor: string; query?: string }) {
  const pathname = usePathname();
  const tabs = vendorTabs(vendor);
  const base = tabs[0].href;
  const suffix = query ? `?${query}` : "";

  return (
    <nav className="flex items-center gap-1 rounded-lg border border-border bg-bg-sunken p-1 w-fit">
      {tabs.map((tab) => {
        // The first tab's href is a prefix of every sibling, so it matches
        // exactly; the rest match by prefix.
        const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={`${tab.href}${suffix}`}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded px-3 py-1.5 text-sm font-medium transition-colors duration-fast ease-expo",
              active
                ? "bg-accent text-bg-raised shadow-bevel"
                : "text-ink-muted hover:text-ink hover:bg-bg-raised",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
