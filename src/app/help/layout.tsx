import "katex/dist/katex.min.css";
import "@/styles/help.css";
import type { Metadata } from "next";
import { HelpNav, type HelpNavSection } from "@/components/help/HelpNav";
import { guides } from "@/lib/help/guides";
import { features } from "@/lib/help/features";
import { apiNav } from "@/lib/help/api-nav";

export const metadata: Metadata = {
  title: { default: "Help & docs", template: "%s · Ledgerline docs" },
};

/** Group registry items by meta.group, preserving first-appearance order. */
function groupBy<T extends { meta: { group: string; slug: string; title: string } }>(
  items: T[],
  base: string
) {
  const groups = new Map<string, { href: string; label: string }[]>();
  for (const m of items) {
    const list = groups.get(m.meta.group) ?? [];
    list.push({ href: `${base}/${m.meta.slug}`, label: m.meta.title });
    groups.set(m.meta.group, list);
  }
  return Array.from(groups, ([group, items]) => ({ group, items }));
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const sections: HelpNavSection[] = [
    { href: "/help", label: "Overview", icon: "BookOpen" },
    { href: "/help/built-with-claude-code", label: "Built with Claude Code", icon: "Bot" },
    { href: "/help/changelog", label: "Changelog", icon: "History" },
    { href: "/help/guides", label: "How-to guides", icon: "Compass", children: groupBy(guides, "/help/guides") },
    { href: "/help/api", label: "API reference", icon: "Braces", children: apiNav.length ? [{ group: "", items: apiNav }] : undefined },
    { href: "/help/architecture", label: "Architecture", icon: "Boxes" },
    { href: "/help/math", label: "Mathematics", icon: "Sigma" },
    { href: "/help/features", label: "Features", icon: "Sparkles", children: groupBy(features, "/help/features") },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden lg:block w-60 shrink-0 border-r border-border bg-bg sticky top-0 max-h-screen overflow-y-auto self-start px-3 py-6">
        <p className="px-2.5 pb-3 text-[11px] font-medium uppercase tracking-widest text-ink-faint">
          Help &amp; docs
        </p>
        <HelpNav sections={sections} />
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
