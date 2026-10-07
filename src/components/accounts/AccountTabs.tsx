"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sub-navigation for an account. Overview is visible to everyone. Profile and
// Pricing are both open to admins and editors — so the two tabs are gated
// independently (each surface's page carries the matching guard and would
// otherwise redirect).
export function AccountTabs({
  slug,
  showProfile,
  showPricing,
}: {
  slug: string;
  showProfile: boolean;
  showPricing: boolean;
}) {
  const pathname = usePathname();
  const base = `/accounts/${slug}`;

  const tabs = [
    { label: "Overview", href: base, show: true },
    { label: "Profile", href: `${base}/profile`, show: showProfile },
    { label: "Pricing", href: `${base}/pricing`, show: showPricing },
  ].filter((t) => t.show);

  return (
    <nav className="flex items-center gap-1 rounded-lg border border-border bg-bg-sunken p-1 w-fit">
      {tabs.map((tab) => {
        const active =
          tab.href === base ? pathname === base : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded px-3 py-1.5 text-sm font-medium transition-colors duration-fast ease-expo",
              active
                ? "bg-accent text-bg-raised shadow-low"
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
