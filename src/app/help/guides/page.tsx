import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { DocPage } from "@/components/help/DocPage";
import { RoleChip } from "@/components/help/doc";
import { guides } from "@/lib/help/guides";

export const metadata: Metadata = { title: "How-to guides" };

export default function GuidesIndex() {
  const groups = new Map<string, typeof guides>();
  for (const g of guides) {
    const list = groups.get(g.meta.group) ?? [];
    list.push(g);
    groups.set(g.meta.group, list);
  }

  return (
    <DocPage
      title="How-to guides"
      lede="Task-oriented walkthroughs for everything you can do in Ledgerline. Each guide lists the exact buttons, fields, and screens involved."
      toc={false}
    >
      {groups.size === 0 && <p>Guides are being written — check back shortly.</p>}
      {Array.from(groups, ([group, items]) => (
        <section key={group} className="not-prose mt-8 first:mt-0">
          <h2 className="text-[11px] font-medium uppercase tracking-widest text-ink-faint mb-3">
            {group}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {items.map((g) => (
              <li key={g.meta.slug}>
                <Link
                  href={`/help/guides/${g.meta.slug}`}
                  className="group block h-full rounded-lg border border-border bg-bg-raised p-4 transition-colors duration-fast ease-expo hover:border-accent/40 hover:bg-accent-bg/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink leading-snug">{g.meta.title}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">{g.meta.summary}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <RoleChip role={g.meta.role} />
                    {g.meta.minutes != null && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                        <Clock size={11} aria-hidden /> ~{g.meta.minutes} min
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </DocPage>
  );
}
