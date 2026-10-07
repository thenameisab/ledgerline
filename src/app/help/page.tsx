import Link from "next/link";
import {
  History,
  Compass,
  Braces,
  Boxes,
  Sigma,
  Sparkles,
  Bot,
  ArrowUpRight,
} from "lucide-react";
import { guides } from "@/lib/help/guides";
import { features } from "@/lib/help/features";

const SECTIONS = [
  {
    href: "/help/built-with-claude-code",
    icon: Bot,
    title: "Built with Claude Code",
    desc: "How this product was designed, built, and hardened with an AI agent — the workflow, the guardrails, and a worked example.",
  },
  {
    href: "/help/changelog",
    icon: History,
    title: "Changelog",
    desc: "Build-by-build release notes — every change that landed on main, with the engineering record behind it.",
  },
  {
    href: "/help/guides",
    icon: Compass,
    title: "How-to guides",
    desc: "Step-by-step instructions for everything you can do in Ledgerline, from importing usage to issuing an invoice.",
  },
  {
    href: "/help/api",
    icon: Braces,
    title: "API reference",
    desc: "Every internal endpoint and server action, plus the integrations Ledgerline is connected to.",
  },
  {
    href: "/help/architecture",
    icon: Boxes,
    title: "Architecture",
    desc: "An interactive, animated map of the whole system — browser to database to external services.",
  },
  {
    href: "/help/math",
    icon: Sigma,
    title: "Mathematics",
    desc: "Every formula Ledgerline computes: money, pricing, bundles, margins, pacing, and risk — with worked examples.",
  },
  {
    href: "/help/features",
    icon: Sparkles,
    title: "Features",
    desc: "A page for every feature in the product — what it does, who can use it, and how it behaves at the edges.",
  },
];

export default function HelpHome() {
  const counts: Record<string, string | null> = {
    "/help/guides": guides.length ? `${guides.length} guides` : null,
    "/help/features": features.length ? `${features.length} features` : null,
  };

  return (
    <div className="mx-auto w-full max-w-[82rem] px-6 md:px-10 py-10 md:py-16">
      <p className="text-[11px] font-medium uppercase tracking-widest text-ink-faint">
        Ledgerline documentation
      </p>
      <h1 className="mt-2 font-serif text-5xl text-ink leading-tight" style={{ fontWeight: 600 }}>
        Everything about Ledgerline,
        <br />
        in one place.
      </h1>
      <p className="mt-4 max-w-xl font-serif text-lg text-ink-muted leading-relaxed">
        How the billing dashboard works, how to use it, what changed in each
        build, and the mathematics underneath every number on screen.
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-xl border border-border bg-bg-raised p-5 transition-colors duration-fast ease-expo hover:border-accent/40 hover:bg-accent-bg/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-accent-bg text-accent-ink">
                  <Icon size={15} strokeWidth={1.75} aria-hidden />
                </div>
                <ArrowUpRight
                  size={14}
                  aria-hidden
                  className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity duration-fast"
                />
              </div>
              <h2 className="mt-3.5 font-serif text-lg text-ink leading-tight" style={{ fontWeight: 600 }}>
                {s.title}
                {counts[s.href] && (
                  <span className="ml-2 align-middle font-sans text-[11px] font-medium text-ink-faint">
                    {counts[s.href]}
                  </span>
                )}
              </h2>
              <p className="mt-1.5 text-[13px] text-ink-muted leading-relaxed">{s.desc}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 rounded-xl border border-border bg-bg-sunken px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-ink-muted">
        <span className="font-medium text-ink">Shortcuts</span>
        <span>
          <kbd className="rounded border border-border bg-bg-raised px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd>
          <span className="ml-2">search anything</span>
        </span>
        <span>
          <kbd className="rounded border border-border bg-bg-raised px-1.5 py-0.5 font-mono text-[11px]">⌘1–3</kbd>
          <span className="ml-2">jump between Dashboard, Accounts, APIs</span>
        </span>
        <Link href="/dashboard" className="ml-auto text-accent-ink hover:underline underline-offset-4">
          Back to the dashboard →
        </Link>
      </div>
    </div>
  );
}
