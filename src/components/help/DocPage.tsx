import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { OnThisPage } from "./OnThisPage";
import { Lede, Prose } from "./doc";

/**
 * Standard docs page chrome: breadcrumb → serif title → lede across the top,
 * an optional full-width `hero` (used for the architecture diagram), then the
 * article (.help-prose) beside a sticky right rail (on-this-page + optional
 * per-page slot). Prose keeps a readable measure; the hero and wide blocks get
 * the full width.
 */
export function DocPage({
  crumbs,
  title,
  lede,
  meta,
  hero,
  children,
  rail,
  toc = true,
}: {
  /** Trail under "Help & docs", e.g. [{href:"/help/guides", label:"How-to guides"}] */
  crumbs?: { href: string; label: string }[];
  title: string;
  lede?: ReactNode;
  /** Chips row rendered between title and lede (role, time, routes…). */
  meta?: ReactNode;
  /** Full-width element rendered under the header, above the article/rail. */
  hero?: ReactNode;
  children: ReactNode;
  /** Extra right-rail content rendered under "On this page". */
  rail?: ReactNode;
  toc?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[82rem] px-6 md:px-10 py-8 md:py-12">
      <header>
        <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-[12px] text-ink-faint">
          <Link href="/help" className="hover:text-ink transition-colors duration-fast">
            Help &amp; docs
          </Link>
          {crumbs?.map((c) => (
            <span key={c.href} className="flex items-center gap-1">
              <ChevronRight size={11} aria-hidden />
              <Link href={c.href} className="hover:text-ink transition-colors duration-fast">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>

        <h1 className="mt-3 font-serif text-4xl text-ink leading-tight" style={{ fontWeight: 600 }}>
          {title}
        </h1>
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        {lede && <div className="max-w-[52rem]"><Lede>{lede}</Lede></div>}
      </header>

      {hero && <div className="mt-7">{hero}</div>}

      <div className="mt-2 flex gap-10 xl:gap-[3.5rem]">
        <div className="flex-1 min-w-0">
          <article>
            <Prose>{children}</Prose>
          </article>
        </div>

        {toc && (
          <aside className="hidden xl:block w-[15.5rem] shrink-0">
            <div className="sticky top-8 space-y-6">
              <OnThisPage />
              {rail}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * A titled block for the right rail (e.g. "Related", "At a glance"). Keeps rail
 * content visually consistent with the on-this-page nav above it.
 */
export function RailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-4">
      <p className="text-[11px] font-medium uppercase tracking-widest text-ink-faint pb-2.5">
        {title}
      </p>
      {children}
    </section>
  );
}

/** A vertical list of related doc links for the rail. */
export function RailLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <ul className="space-y-1.5 text-[12.5px]">
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="group inline-flex items-center gap-1.5 text-ink-muted hover:text-accent-ink transition-colors duration-fast"
          >
            <span className="h-1 w-1 rounded-full bg-ink-faint group-hover:bg-accent transition-colors duration-fast" aria-hidden />
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
