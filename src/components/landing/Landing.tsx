"use client";

import "./landing.css";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowDown } from "lucide-react";
import { Glyph } from "@/components/ui/Glyph";
import { AccessForm } from "./AccessForm";
import { Desk } from "./Desk";
import { HeroSnippet } from "./HeroSnippet";
import { Reveal } from "./ui";
import { PricingSnippet } from "./snippets/PricingSnippet";
import { InvoiceSnippet } from "./snippets/InvoiceSnippet";
import { MarginSnippet } from "./snippets/MarginSnippet";
import { AlertsSnippet } from "./snippets/AlertsSnippet";
import { PaletteSnippet } from "./snippets/PaletteSnippet";
import { RolesSnippet } from "./snippets/RolesSnippet";

type Section = {
  id: string;
  /** Paper colour of the tag pinned to the snippet card. */
  paper: "azure" | "sage" | "cream" | "lilac" | "mustard" | "blue" | "terra";
  tag: string;
  title: string;
  lede: string;
  facts: [string, string][];
  Snippet: () => JSX.Element;
};

const SECTIONS: Section[] = [
  {
    id: "live",
    paper: "azure",
    tag: "Dashboard",
    title: "Revenue as it arrives",
    lede: "Usage is priced as it syncs, whatever the unit. The dashboard shows month-to-date revenue, margin and the money at risk across every SKU, and every figure links to the rows behind it.",
    facts: [
      ["Updates", "Each usage sync"],
      ["Benchmarks", "Last month, same day"],
      ["Risk", "Unpriced and unmapped usage"],
    ],
    Snippet: HeroSnippet,
  },
  {
    id: "pricing",
    paper: "sage",
    tag: "Pricing",
    title: "Price every account and SKU",
    lede: "Set flat, tiered, slab or bundle prices per account and SKU, in the SKU's own unit, each with an effective-from date. Change a price and every figure that depends on it updates.",
    facts: [
      ["Models", "Flat · tier · slab · bundle"],
      ["Units", "Tokens, minutes, GPU-hours"],
      ["History", "Effective-from on every row"],
      ["Money", "Exact decimals"],
    ],
    Snippet: PricingSnippet,
  },
  {
    id: "invoices",
    paper: "cream",
    tag: "Invoices",
    title: "From usage to invoice",
    lede: "Usage, approved manual entries and sandbox rules roll up into one draft invoice per account, with a line for each SKU in its own unit. Usage with no price is left out and flagged. Finalize the draft to lock its lines and give it a number.",
    facts: [
      ["Lifecycle", "Draft → final → issued"],
      ["Exports", "PDF and CSV"],
      ["Corrections", "Adjustments, not edits"],
    ],
    Snippet: InvoiceSnippet,
  },
  {
    id: "margin",
    paper: "lilac",
    tag: "Vendors",
    title: "Margin, and how sure you are of it",
    lede: "Vendor rates turn usage into cost: GPU-hours from your cloud, messages from your carrier, calls to a model you resell. Each margin figure states how much of the usage has a confirmed rate. Reconciliation compares your counts with the vendor's, day by day.",
    facts: [
      ["Cost", "Per vendor, SKU and day"],
      ["Coverage", "Confirmed · estimated · unknown"],
      ["Gaps", "Dismiss with a reason"],
    ],
    Snippet: MarginSnippet,
  },
  {
    id: "alerts",
    paper: "mustard",
    tag: "Alerts",
    title: "See what changed today",
    lede: "A daily check runs after the usage sync. It flags volume drops, failure spikes, new SKUs and unpriced usage for each account, and it also reports good news.",
    facts: [
      ["Rules", "Volume · failures · revenue"],
      ["Baseline", "Four weeks, same weekday"],
      ["Delivery", "In-app and email"],
    ],
    Snippet: AlertsSnippet,
  },
  {
    id: "palette",
    paper: "blue",
    tag: "⌘K",
    title: "Find anything, or ask for a number",
    lede: "Press ⌘K to search accounts, SKUs and invoices. Narrow results with field:value, run an action with >, or ask for revenue, margin or unpriced usage for any account and month.",
    facts: [
      ["Search", "Accounts · SKUs · invoices"],
      ["Filters", "@account #SKU status: month:"],
      ["Answers", "Same numbers as the dashboard"],
    ],
    Snippet: PaletteSnippet,
  },
  {
    id: "roles",
    paper: "terra",
    tag: "Access",
    title: "Roles and approvals",
    lede: "Admins, editors and members see and change different things. Members never see cost. Large manual entries and account merges wait for an admin to approve them.",
    facts: [
      ["Roles", "Admin · editor · member"],
      ["Approvals", "Merges, deletes, large entries"],
      ["Audit", "Every change is logged"],
    ],
    Snippet: RolesSnippet,
  },
];

/* ── Who it is for ─────────────────────────────────────────────────────── */

type Buyer = {
  title: string;
  lede: string;
  paper: Section["paper"];
  rows: [code: string, name: string, price: string, unit: string][];
};

// Real rows from the demo catalog, so the page and the demo agree.
const BUYERS: Buyer[] = [
  {
    title: "AI model labs",
    lede: "Price each model by token type: input, output, cached and reasoning tokens, with batch and realtime rates.",
    paper: "lilac",
    rows: [
      ["ATL-PRO-IN", "Atlas Pro · input", "$3.00", "1M tokens"],
      ["ATL-PRO-OUT", "Atlas Pro · output", "$15.00", "1M tokens"],
      ["ATL-PRO-CACHE", "Atlas Pro · cached", "$0.30", "1M tokens"],
      ["ATL-FLASH-IN", "Atlas Flash · input", "$0.15", "1M tokens"],
    ],
  },
  {
    title: "API providers",
    lede: "Sell one API in many variants, by country, channel or quality, each with its own price and carrier cost.",
    paper: "sage",
    rows: [
      ["MSG-SMS-US", "SMS · United States", "$0.0079", "message"],
      ["MSG-SMS-UK", "SMS · United Kingdom", "$0.04", "message"],
      ["MSG-WA-UTIL", "WhatsApp · utility", "$0.0085", "message"],
      ["MSG-VOICE-OUT", "Outbound call", "$0.014", "minute"],
    ],
  },
  {
    title: "Multi-product companies",
    lede: "Bill compute, storage, media and agent tools to the same customer on one invoice, each in its own unit.",
    paper: "mustard",
    rows: [
      ["GPU-H100", "H100 GPU · on-demand", "$2.49", "GPU-hour"],
      ["DAT-VECTOR", "Vector storage", "$0.10", "GB-day"],
      ["PRM-VID-1080", "Prism Video · 1080p", "$0.25", "second"],
      ["AGT-SEARCH", "Web search tool", "$10.00", "1K calls"],
    ],
  },
];

const CATALOG_FACTS: [string, string][] = [
  ["SKUs in the demo", "43"],
  ["Units of measure", "19"],
  ["Product lines", "7"],
  ["Invoices per account", "1 a month"],
];

function Audience() {
  return (
    <section
      id="who"
      aria-labelledby="who-title"
      className="scroll-mt-[var(--ll-header-h)] px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="mx-auto max-w-[76rem]">
        <Reveal>
          <div className="max-w-[40rem]">
            <h2
              id="who-title"
              className="font-display text-[clamp(1.75rem,3vw,2.375rem)] font-medium leading-[1.08] tracking-display text-ink"
            >
              For catalogs with many SKUs
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
              Usage-based billing gets hard when one customer buys twenty SKUs, and each SKU has its own unit,
              price and vendor cost. Ledgerline keeps every SKU in one catalog and prices each one on its own
              terms, at the level of a single account and a single day.
            </p>
          </div>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {BUYERS.map((b, i) => (
            <Reveal key={b.title} index={i} className="relative pt-3">
              <span
                className="ll-artifact absolute left-5 top-0 z-10 rotate-[-2deg] rounded-[3px] px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em]"
                style={{ background: `var(--a-${b.paper})`, color: `var(--a-${b.paper}-ink)` }}
                aria-hidden
              >
                {b.title}
              </span>
              <div className="ll-card flex h-full flex-col rounded-md p-5 pt-7">
                <h3 className="text-[15px] font-medium text-ink">{b.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{b.lede}</p>
<dl className="mt-4 text-[12px]" aria-label={`Example SKUs for ${b.title.toLowerCase()}`}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-border pb-1.5 font-mono text-[10.5px] uppercase tracking-widest text-ink-faint">
                    <span aria-hidden>SKU</span>
                    <span aria-hidden className="text-right">Price</span>
                  </div>
                  {b.rows.map(([code, name, price, unit]) => (
                    <div
                      key={code}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-border py-1.5 last:border-b-0"
                    >
                      <dt className="min-w-0">
                        <div className="truncate text-ink" title={name}>
                          {name}
                        </div>
                        <div className="truncate font-mono text-[10.5px] text-ink-faint" title={code}>
                          {code}
                        </div>
                      </dt>
                      <dd className="text-right font-mono tabular-nums text-ink">
                        {price}
                        <div className="text-[10.5px] text-ink-faint">per {unit}</div>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal index={3}>
          <dl className="mt-8 grid grid-cols-2 border-y border-dashed border-border-strong font-mono text-[12px] sm:grid-cols-4">
            {CATALOG_FACTS.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 px-1 py-3 sm:px-3">
                <dt className="uppercase tracking-[0.08em] text-ink-faint">{k}</dt>
                <dd className="text-[15px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function useScrolled(px = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > px);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [px]);
  return scrolled;
}

const btnPrimary =
  "ll-press inline-flex items-center gap-2 rounded bg-accent font-medium text-bg-raised shadow-bevel outline-none hover:bg-accent-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
const btnQuiet =
  "ll-press inline-flex items-center gap-2 rounded border border-border-strong bg-bg-raised text-ink outline-none hover:bg-bg-sunken focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

export function Landing({ hasAccess }: { hasAccess: boolean }) {
  const scrolled = useScrolled();
  const demoHref = hasAccess ? "/login" : "#access";

  return (
    <div className="ll-landing">
      <header
        className={`fixed inset-x-0 top-0 z-50 h-[var(--ll-header-h)] transition-[background-color,border-color] duration-fast ${
          scrolled ? "ll-glass border-b border-border" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-full max-w-[76rem] items-center justify-between gap-3 px-4 sm:px-6">
          <a
            href="#top"
            className="flex items-center gap-2.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-accent text-bg-raised shadow-bevel">
              <Glyph size={17} />
            </span>
            <span className="text-[15px] font-semibold tracking-display text-ink">Ledgerline</span>
          </a>
          <nav className="flex items-center gap-1.5" aria-label="Page">
            <a
              href="#who"
              className="ll-press hidden h-[34px] items-center rounded px-3 text-[13px] text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent sm:inline-flex"
            >
              Who it is for
            </a>
            <a
              href="#live"
              className="ll-press hidden h-[34px] items-center rounded px-3 text-[13px] text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent sm:inline-flex"
            >
              Product
            </a>
            <a href={demoHref} className={`${btnPrimary} h-[34px] px-3.5 text-[13px]`}>
              Open the demo <ArrowRight size={14} aria-hidden />
            </a>
          </nav>
        </div>
      </header>

      <main>
        <Desk>
          <div className="mx-auto max-w-[34rem]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-raised px-2.5 py-1 font-mono text-[11px] text-ink-faint shadow-low">
              <span className="ll-pulse inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              Live demo · fictional data
            </span>
            <h1
              id="hero-title"
              className="mt-5 font-display text-[clamp(2.5rem,6vw,4.25rem)] font-medium leading-[1.0] tracking-hero text-ink"
            >
              {"Bill every SKU to the unit.".split(" ").map((w, i, all) => (
                <span key={i} className="ll-rise" style={{ "--i": i } as React.CSSProperties}>
                  {w}
                  {i < all.length - 1 ? " " : ""}
                </span>
              ))}
            </h1>
            <p className="mx-auto mt-4 max-w-[32rem] text-[15px] leading-relaxed text-ink-muted">
              Ledgerline is billing for companies that sell many products, APIs or models on usage. It
              prices every token, minute, message and GPU-hour per account, every day, and turns them into
              invoices and margin. Month-end close does not need a week in a spreadsheet.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <a href={demoHref} className={`${btnPrimary} h-[42px] px-4 text-[14px]`}>
                {hasAccess ? "Open the demo" : "Get demo access"} <ArrowRight size={15} aria-hidden />
              </a>
              <a href="#who" className={`${btnQuiet} h-[42px] px-4 text-[14px]`}>
                See how it works <ArrowDown size={15} aria-hidden />
              </a>
            </div>
          </div>
        </Desk>

        <Audience />

        {SECTIONS.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-title`}
            className="scroll-mt-[var(--ll-header-h)] px-4 py-12 sm:px-6 sm:py-16"
          >
            <div className="mx-auto grid max-w-[76rem] grid-cols-1 gap-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-12">
              <Reveal>
                <div className="lg:sticky lg:top-[calc(var(--ll-header-h)+32px)]">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full border border-border-strong bg-bg-raised px-1.5 font-mono text-[11px] tabular-nums text-ink-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 border-t border-dashed border-border-strong" aria-hidden />
                  </div>
                  <h2
                    id={`${s.id}-title`}
                    className="mt-4 font-display text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-[1.1] tracking-display text-ink"
                  >
                    {s.title}
                  </h2>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{s.lede}</p>
                  <dl className="mt-5 font-mono text-[12px]">
                    {s.facts.map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-baseline justify-between gap-3 border-t border-dashed border-border-strong py-2 last:border-b"
                      >
                        <dt className="uppercase tracking-[0.08em] text-ink-faint">{k}</dt>
                        <dd className="text-right text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Reveal>
              <Reveal index={1} className="relative pt-3">
                <span
                  className="ll-artifact absolute left-5 top-0 z-10 rotate-[-2deg] rounded-[3px] px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em]"
                  style={{ background: `var(--a-${s.paper})`, color: `var(--a-${s.paper}-ink)` }}
                  aria-hidden
                >
                  {s.tag}
                </span>
                <s.Snippet />
              </Reveal>
            </div>
          </section>
        ))}

        <section
          id="access"
          aria-labelledby="access-title"
          className="scroll-mt-[var(--ll-header-h)] px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16"
        >
          <div className="mx-auto grid max-w-[76rem] grid-cols-1 gap-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-12">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-[26px] items-center justify-center rounded-full bg-accent px-2.5 font-mono text-[11px] text-bg-raised">
                  Demo
                </span>
                <span className="h-px flex-1 border-t border-dashed border-border-strong" aria-hidden />
              </div>
              <h2
                id="access-title"
                className="mt-4 font-display text-[clamp(1.75rem,3vw,2.375rem)] font-medium leading-[1.08] tracking-display text-ink"
              >
                Open the demo
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
                Fill in the form to open the demo. You enter as an admin or a member of a fictional
                company. You can change anything; the data resets every night.
              </p>
              <dl className="mt-5 font-mono text-[12px]">
                {[
                  ["Data", "~3 months, 43 SKUs, 15 accounts"],
                  ["Access", "Every page, admin included"],
                  ["Email", "Nothing is sent"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-3 border-t border-dashed border-border-strong py-2 last:border-b"
                  >
                    <dt className="uppercase tracking-[0.08em] text-ink-faint">{k}</dt>
                    <dd className="text-right text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative pt-3">
              <span
                className="ll-artifact absolute left-5 top-0 z-10 rotate-[-2deg] rounded-[3px] px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em]"
                style={{ background: "var(--a-azure)", color: "var(--a-azure-ink)" }}
                aria-hidden
              >
                Request access
              </span>
              <div className="ll-card rounded-md p-5 pt-7 sm:p-7 sm:pt-8">
                <AccessForm hasAccess={hasAccess} />
                <p className="mt-4 border-t border-dashed border-border-strong pt-3 text-[12px] leading-relaxed text-ink-faint">
                  Tally stores your answers. They are used only to see who is interested and, if you ask,
                  to contact you. To have your answers removed, get in touch through{" "}
                  <a
                    href="https://adityagaur.xyz"
                    className="text-ink-muted underline underline-offset-2 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    adityagaur.xyz
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-dashed border-border-strong px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[76rem] flex-wrap items-center justify-between gap-3 text-[12px] text-ink-faint">
          <span className="flex items-center gap-2">
            <Glyph size={14} />
            Ledgerline · fictional data, reset nightly
          </span>
          <span>
            Built by{" "}
            <a
              href="https://adityagaur.xyz"
              className="text-ink-muted underline-offset-2 outline-none hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-accent"
            >
              Aditya Gaur
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
