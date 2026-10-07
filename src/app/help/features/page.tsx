import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/help/DocPage";
import { RoleChip } from "@/components/help/doc";
import { features } from "@/lib/help/features";

export const metadata: Metadata = { title: "Features" };

export default function FeaturesIndex() {
  const groups = new Map<string, typeof features>();
  for (const f of features) {
    const list = groups.get(f.meta.group) ?? [];
    list.push(f);
    groups.set(f.meta.group, list);
  }

  return (
    <DocPage
      title="Features"
      lede="Every feature in Ledgerline, documented: what it shows, what you can do with it, who can use it, and how it behaves at the edges."
      toc={false}
    >
      {groups.size === 0 && <p>Feature docs are being written — check back shortly.</p>}
      {Array.from(groups, ([group, items]) => (
        <section key={group} className="not-prose mt-8 first:mt-0">
          <h2 className="text-[11px] font-medium uppercase tracking-widest text-ink-faint mb-3">
            {group}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {items.map((f) => (
              <li key={f.meta.slug}>
                <Link
                  href={`/help/features/${f.meta.slug}`}
                  className="group block h-full rounded-lg border border-border bg-bg-raised p-4 transition-colors duration-fast ease-expo hover:border-accent/40 hover:bg-accent-bg/30"
                >
                  <span className="text-sm font-medium text-ink leading-snug">{f.meta.title}</span>
                  <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">{f.meta.summary}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <RoleChip role={f.meta.role} />
                    {f.meta.routes?.[0] && (
                      <code className="font-mono text-[11px] text-ink-faint">{f.meta.routes[0]}</code>
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
