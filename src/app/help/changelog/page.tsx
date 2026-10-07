import type { Metadata } from "next";
import { GitCommit, Wrench, Bug, Sparkles, Milestone } from "lucide-react";
import { DocPage } from "@/components/help/DocPage";
import { releases } from "@/lib/help/releases";

export const metadata: Metadata = { title: "Changelog" };

/** Horizontal jump-nav to the milestone builds — a way to navigate the product
 *  story without scrolling the full build timeline. */
function MilestoneRail({
  items,
}: {
  items: { build: number; date: string; label: string; title: string }[];
}) {
  if (!items.length) return null;
  return (
    <nav
      aria-label="Product milestones"
      className="not-prose mb-10 rounded-xl border border-border bg-bg-sunken/60 p-4"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-ink-faint">
        <Milestone size={12} aria-hidden /> Milestones
      </p>
      <ol className="mt-3 flex flex-wrap gap-2">
        {items.map((m) => (
          <li key={m.build}>
            <a
              href={`#build-${m.build}`}
              title={m.title}
              className="group inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-bg/50 px-2.5 py-1.5 transition-colors duration-fast ease-expo hover:border-accent/60 hover:bg-accent-bg"
            >
              <span className="inline-block w-2 h-2 rotate-45 rounded-[1px] bg-accent shrink-0" aria-hidden />
              <span className="text-[13px] font-medium text-accent-ink leading-none">{m.label}</span>
              <span className="font-mono text-[10px] text-ink-faint leading-none">B{m.build}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function ReleaseSection({
  icon: Icon,
  label,
  items,
}: {
  icon: typeof Sparkles;
  label: string;
  items: React.ReactNode[];
}) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-ink-faint">
        <Icon size={11} aria-hidden /> {label}
      </p>
      <ul className="mt-2 space-y-1.5 pl-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink-muted leading-relaxed">
            <span className="mt-[9px] inline-block w-1 h-1 rounded-full bg-ink-faint shrink-0" aria-hidden />
            <span className="[&_code]:font-mono [&_code]:text-[0.85em] [&_code]:bg-bg-sunken [&_code]:border [&_code]:border-border [&_code]:rounded [&_code]:px-1">
              {it}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ChangelogPage() {
  const sorted = [...releases].sort((a, b) => b.build - a.build);
  const latest = sorted[0];
  const milestones = sorted
    .filter((r) => r.milestone)
    .map((r) => ({
      build: r.build,
      date: r.date,
      label: r.milestoneLabel ?? r.title,
      title: r.title,
    }));

  return (
    <DocPage
      title="Changelog"
      lede={
        latest
          ? `Build-by-build release notes for Ledgerline. ${sorted.length} builds shipped — currently on Build ${latest.build} (${latest.date}).`
          : "Build-by-build release notes for Ledgerline."
      }
      toc={false}
    >
      {sorted.length === 0 && <p>Release notes are being compiled — check back shortly.</p>}

      <MilestoneRail items={milestones} />

      <div className="not-prose relative">
        {/* timeline spine */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />
        <ol className="space-y-10">
          {sorted.map((r) => (
            <li key={r.build} id={`build-${r.build}`} className="relative pl-9 scroll-mt-24">
              {r.milestone ? (
                <span
                  className="absolute left-0 top-1.5 inline-flex w-[15px] h-[15px] items-center justify-center rounded-[3px] rotate-45 bg-accent ring-4 ring-accent-bg"
                  aria-hidden
                />
              ) : (
                <span
                  className="absolute left-0 top-1.5 inline-flex w-[15px] h-[15px] items-center justify-center rounded-full border-2 border-accent bg-bg"
                  aria-hidden
                />
              )}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[11px] text-ink-faint uppercase tracking-widest">
                  Build {r.build}
                </span>
                {r.milestone && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-bg px-2 py-0.5 text-[11px] font-medium uppercase tracking-widest text-accent-ink not-italic">
                    <Milestone size={10} aria-hidden /> Milestone
                    {r.milestoneLabel ? <span className="normal-case tracking-normal">· {r.milestoneLabel}</span> : null}
                  </span>
                )}
                <time dateTime={r.date} className="font-mono text-[11px] text-ink-faint">
                  {r.date}
                </time>
                {r.pr != null && (
                  <span className="font-mono text-[11px] text-accent-ink">#{r.pr}</span>
                )}
                {r.shas?.length ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-faint">
                    <GitCommit size={11} aria-hidden />
                    {r.shas.join(", ")}
                  </span>
                ) : null}
                {r.diffstat && (
                  <span className="font-mono text-[11px] text-ink-faint">{r.diffstat}</span>
                )}
              </div>
              <h2 className="mt-1.5 font-serif text-xl text-ink leading-tight" style={{ fontWeight: 600 }}>
                {r.title}
              </h2>

              <ReleaseSection icon={Sparkles} label="Highlights" items={r.highlights} />
              <ReleaseSection icon={Wrench} label="Technical notes" items={r.technical ?? []} />
              <ReleaseSection icon={Bug} label="Fixes" items={r.fixes ?? []} />
            </li>
          ))}
        </ol>
      </div>
    </DocPage>
  );
}
