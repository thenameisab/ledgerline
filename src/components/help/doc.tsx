import type { ReactNode } from "react";
import Link from "next/link";
import {
  Info,
  Lightbulb,
  TriangleAlert,
  ShieldAlert,
  Link as LinkIcon,
} from "lucide-react";
import { CopyButton } from "./CopyButton";
import { Lightbox } from "./Lightbox";

/* -----------------------------------------------------------------------------
   Doc primitives — the authoring vocabulary for everything under /help.
   All server components except the small account islands they embed
   (CopyButton, Lightbox). Plain <p>/<ul>/<table> inside <Prose> are styled
   by .help-prose in src/styles/help.css.
----------------------------------------------------------------------------- */

/** Long-form article wrapper. Styles bare HTML tags via help.css. */
export function Prose({ children }: { children: ReactNode }) {
  return <div className="help-prose">{children}</div>;
}

/** Serif intro paragraph under a page title. */
export function Lede({ children }: { children: ReactNode }) {
  return (
    <p className="font-serif text-lg text-ink-muted leading-relaxed mt-3 mb-8 max-w-2xl">
      {children}
    </p>
  );
}

function AnchorHeading({
  id,
  level,
  children,
}: {
  id: string;
  level: 2 | 3;
  children: ReactNode;
}) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag id={id} className="group scroll-mt-24 flex items-baseline gap-2">
      <span>{children}</span>
      <a
        href={`#${id}`}
        aria-label="Link to this section"
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-fast text-ink-faint hover:text-accent"
      >
        <LinkIcon size={level === 2 ? 14 : 12} aria-hidden />
      </a>
    </Tag>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return <AnchorHeading id={id} level={2}>{children}</AnchorHeading>;
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return <AnchorHeading id={id} level={3}>{children}</AnchorHeading>;
}

/* ── Callouts ──────────────────────────────────────────────────────────── */

const CALLOUT = {
  info: { icon: Info, box: "bg-info-bg text-info-ink", label: "Note" },
  tip: { icon: Lightbulb, box: "bg-success-bg text-success-ink", label: "Tip" },
  warn: { icon: TriangleAlert, box: "bg-warn-bg text-warn-ink", label: "Careful" },
  danger: { icon: ShieldAlert, box: "bg-bad-bg text-bad-ink", label: "Irreversible" },
} as const;

export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: keyof typeof CALLOUT;
  title?: string;
  children: ReactNode;
}) {
  const v = CALLOUT[variant];
  const Icon = v.icon;
  return (
    <aside className={`not-prose my-5 rounded-lg px-4 py-3.5 ${v.box}`}>
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Icon size={14} strokeWidth={2} aria-hidden />
        {title ?? v.label}
      </div>
      <div className="mt-1.5 text-sm leading-relaxed [&_code]:font-mono [&_code]:text-[0.85em]">
        {children}
      </div>
    </aside>
  );
}

/* ── Keyboard keys ─────────────────────────────────────────────────────── */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-bg-raised px-1.5 py-0.5 font-mono text-[11px] text-ink-muted align-middle">
      {children}
    </kbd>
  );
}

/* ── Inline file path / identifier chip ────────────────────────────────── */

export function FilePath({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-bg-sunken border border-border px-1.5 py-0.5 font-mono text-[0.8em] text-ink-muted whitespace-nowrap">
      {children}
    </code>
  );
}

/* ── Numbered steps ────────────────────────────────────────────────────── */

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="help-steps not-prose my-5 space-y-0">{children}</ol>;
}

export function Step({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <li className="help-step relative pl-10 pb-6 last:pb-1">
      <div className="text-sm font-medium text-ink leading-snug pt-0.5">{title}</div>
      {children != null && (
        <div className="mt-1.5 text-sm text-ink-muted leading-relaxed [&_code]:font-mono [&_code]:text-[0.85em] space-y-2">
          {children}
        </div>
      )}
    </li>
  );
}

/* ── Screenshot figure with lightbox ───────────────────────────────────── */

export function Figure({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <figure className="not-prose my-6">
      <div className="rounded-xl border border-border bg-bg-sunken p-1.5 elev-1">
        <Lightbox src={src} alt={alt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} loading="lazy" className="w-full rounded-md outline outline-1 -outline-offset-1 outline-black/10" />
        </Lightbox>
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-ink-faint">{caption}</figcaption>
      )}
    </figure>
  );
}

/* ── Code block ────────────────────────────────────────────────────────── */

export function CodeBlock({
  code,
  title,
  lang,
}: {
  code: string;
  title?: string;
  lang?: string;
}) {
  const trimmed = code.replace(/^\n+|\s+$/g, "");
  return (
    <div className="not-prose my-5 rounded-lg border border-border bg-bg-sunken overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="font-mono text-[11px] text-ink-faint truncate">
          {title ?? lang ?? "code"}
        </span>
        <CopyButton text={trimmed} />
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[12.5px] leading-relaxed font-mono text-ink">
        <code>{trimmed}</code>
      </pre>
    </div>
  );
}

/* ── API endpoint primitives ───────────────────────────────────────────── */

const METHOD_COLOR: Record<string, string> = {
  GET: "bg-ok-bg text-ok-ink",
  POST: "bg-success-bg text-success-ink",
  PATCH: "bg-warn-bg text-warn-ink",
  PUT: "bg-warn-bg text-warn-ink",
  DELETE: "bg-bad-bg text-bad-ink",
  ACTION: "bg-accent-bg text-accent-ink",
  CRON: "bg-info-bg text-info-ink",
};

export function Endpoint({
  method,
  path,
  children,
}: {
  method: keyof typeof METHOD_COLOR | string;
  path: string;
  children?: ReactNode;
}) {
  return (
    <div className="not-prose my-4 flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] tracking-wide ${METHOD_COLOR[method] ?? "bg-bg-sunken text-ink-muted"}`}
      >
        {method}
      </span>
      <code className="font-mono text-[13px] text-ink">{path}</code>
      {children}
    </div>
  );
}

/** Small role chip: who can call/use this. */
export function RoleChip({ role }: { role: "admin" | "editor" | "all" | "public" | "cron" }) {
  const map = {
    admin: { label: "Admin only", cls: "bg-warn-bg text-warn-ink" },
    editor: { label: "Admin or editor", cls: "bg-warn-bg text-warn-ink" },
    all: { label: "Any signed-in user", cls: "bg-ok-bg text-ok-ink" },
    public: { label: "Public", cls: "bg-success-bg text-success-ink" },
    cron: { label: "Cron secret", cls: "bg-info-bg text-info-ink" },
  } as const;
  const v = map[role];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${v.cls}`}>
      {v.label}
    </span>
  );
}

/* ── Parameter / field table ───────────────────────────────────────────── */

export type ParamRow = {
  name: string;
  type: string;
  required?: boolean;
  desc: ReactNode;
};

export function ParamTable({ rows, nameHeader = "Field" }: { rows: ParamRow[]; nameHeader?: string }) {
  return (
    <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-sunken text-left">
            <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-ink-faint">{nameHeader}</th>
            <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-ink-faint">Type</th>
            <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-ink-faint">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border last:border-b-0 align-top">
              <td className="px-3 py-2 whitespace-nowrap">
                <code className="font-mono text-[12.5px] text-ink">{r.name}</code>
                {r.required && <span className="ml-1.5 text-[10px] text-bad align-middle">required</span>}
              </td>
              <td className="px-3 py-2 whitespace-nowrap font-mono text-[12px] text-ink-faint">{r.type}</td>
              <td className="px-3 py-2 text-ink-muted leading-relaxed">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Cross-links ───────────────────────────────────────────────────────── */

/** "Open in Ledgerline" chip linking docs to the live screen they describe. */
export function OpenInApp({ href, label }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="not-prose inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-raised px-2.5 py-1 text-[12px] font-medium text-accent-ink hover:bg-accent-bg transition-colors duration-fast ease-expo"
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
      {label ?? `Open ${href} in Ledgerline`}
    </Link>
  );
}

/** Footer block linking related docs pages. */
export function Related({ links }: { links: { href: string; label: string }[] }) {
  if (!links.length) return null;
  return (
    <nav aria-label="Related docs" className="not-prose mt-10 border-t border-border pt-5">
      <p className="text-[11px] font-medium uppercase tracking-widest text-ink-faint mb-2.5">Related</p>
      <ul className="flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="inline-flex rounded-md border border-border bg-bg-raised px-2.5 py-1.5 text-[13px] text-ink-muted hover:text-ink hover:bg-bg-sunken transition-colors duration-fast ease-expo"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
