"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { settingsTabs, ICONS, type Role } from "@/lib/nav-model";

// Sub-navigation for the Settings section. The sidebar has one Settings entry;
// these tabs are how you move between the surfaces inside it. Each tab keeps
// its own route, so old links and palette entries still land correctly — the
// strip is navigation, not a client-side tab widget.
//
// Same shape as AccountTabs so the two sub-navs read as one pattern.
export function SettingsTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = settingsTabs(role);
  // Longest matching href wins: /admin/settings/alerts is the Alerts tab, not Emails.
  const activeHref = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label="Settings sections"
      className="flex items-center gap-1 rounded-lg border border-border bg-bg-sunken p-1 w-fit max-w-full overflow-x-auto"
    >
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        const Icon = ICONS[tab.icon];
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex shrink-0 items-center gap-2 rounded px-3 py-1.5 text-sm font-medium",
              "transition-colors duration-fast ease-expo",
              active
                ? "bg-accent text-bg-raised shadow-bevel"
                : "text-ink-muted hover:text-ink hover:bg-bg-raised",
            ].join(" ")}
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
