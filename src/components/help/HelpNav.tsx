"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  History,
  Compass,
  Braces,
  Boxes,
  Sigma,
  Sparkles,
  Bot,
  type LucideIcon,
} from "lucide-react";

export type HelpNavChild = { href: string; label: string };
export type HelpNavSection = {
  href: string;
  label: string;
  icon: string;
  children?: { group: string; items: HelpNavChild[] }[];
};

const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  History,
  Compass,
  Braces,
  Boxes,
  Sigma,
  Sparkles,
  Bot,
};

/**
 * Docs sidebar. Top-level sections always visible; the active section
 * expands to show its grouped children (guides, features, API groups).
 */
export function HelpNav({ sections }: { sections: HelpNavSection[] }) {
  const path = usePathname();

  return (
    <nav aria-label="Documentation" className="text-[13px]">
      <ul className="space-y-0.5">
        {sections.map((s) => {
          const active = s.href === "/help" ? path === "/help" : path.startsWith(s.href);
          const Icon = ICONS[s.icon] ?? BookOpen;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium",
                  "transition-colors duration-fast ease-expo",
                  active
                    ? "bg-accent-bg text-accent-ink"
                    : "text-ink-muted hover:bg-bg-raised hover:text-ink",
                ].join(" ")}
              >
                <Icon size={14} strokeWidth={active ? 2 : 1.75} aria-hidden className="shrink-0" />
                <span className="truncate">{s.label}</span>
              </Link>

              {active && s.children && s.children.length > 0 && (
                <div className="mt-1 mb-2 ml-[13px] border-l border-border pl-3 space-y-2.5">
                  {s.children.map((g) => (
                    <div key={g.group}>
                      {g.group && (
                        <p className="px-1.5 pb-1 text-[11px] font-medium uppercase tracking-widest text-ink-faint">
                          {g.group}
                        </p>
                      )}
                      <ul className="space-y-px">
                        {g.items.map((c) => {
                          const childActive = path === c.href;
                          return (
                            <li key={c.href}>
                              <Link
                                href={c.href}
                                aria-current={childActive ? "page" : undefined}
                                className={[
                                  "block rounded px-1.5 py-1 leading-snug truncate",
                                  "transition-colors duration-fast ease-expo",
                                  childActive
                                    ? "text-accent-ink bg-accent-bg/60 font-medium"
                                    : "text-ink-faint hover:text-ink",
                                ].join(" ")}
                                title={c.label}
                              >
                                {c.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
