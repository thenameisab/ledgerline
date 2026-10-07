import Link from "next/link";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";

export type TopRow = {
  key: string;
  name: string;
  sub?: string;
  value: number;
  display: string;
  href: string;
};

// Ranked horizontal bars, sorted descending, value labelled in text (not
// color-position alone). Bars grow from the left on entrance.
export function TopList({
  title,
  rows,
  emptyLabel = "No traffic in this period.",
  footer,
}: {
  title: string;
  rows: TopRow[];
  emptyLabel?: string;
  /** A short note under the list, e.g. rows left out. */
  footer?: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;

  return (
    <div>
      <h2 className="font-serif text-base text-ink mb-3" style={{ fontWeight: 600 }}>
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted py-4">{emptyLabel}</p>
      ) : (
        <ol className="flex flex-col gap-[10px]">
          {rows.map((r, i) => (
            <li key={r.key}>
              <Link
                href={r.href}
                className="group lift-row block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div className="min-w-0 flex items-baseline gap-2">
                    <TruncateTooltip
                      as="span"
                      text={r.name}
                      className="text-[13px] text-ink group-hover:text-accent-ink transition-colors duration-fast ease-expo"
                    />
                    {r.sub && <span className="text-[11px] font-mono text-ink-faint shrink-0">{r.sub}</span>}
                  </div>
                  <span className="text-[13px] font-mono tnum text-ink-muted shrink-0">{r.display}</span>
                </div>
                <div className="h-[10px] rounded bg-bg-sunken overflow-hidden">
                  <div
                    className="h-full rounded bg-accent group-hover:bg-accent-ink transition-colors duration-fast ease-expo bar-grow"
                    style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, "--i": i } as React.CSSProperties}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {footer && <p className="mt-3 text-[11px] font-mono text-ink-faint">{footer}</p>}
    </div>
  );
}
