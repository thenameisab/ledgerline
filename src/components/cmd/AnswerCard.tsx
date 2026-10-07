"use client";

// Inline answer for "ask a number". The figure is the one place the palette
// uses display type — it's the landmark, per the design system.
//
// This is a derived answer, not a stored one, so it arrives through AiReveal:
// the gradient ring traces its edge, the content wipes in diagonally, and a
// green wash clears. The surface itself is tinted with the AI accent rather
// than azure — the palette's other rows are navigation, this one is an answer.
//
// An answer can carry three things, and the palette's panel grows to fit
// whichever arrive (see answerShape in CommandPalette):
//   value    always — the figure
//   series   a daily line, when the metric has one (revenue; never hits)
//   rows     a breakdown, rendered as a real table once it's worth one
//
// The chart is hand-rolled SVG for the same reason Sparkline is: it's a
// read-only glance inside a 220ms-resizing panel, and a charting library's
// mount cost is the one thing that would make the resize stutter.

import type { AskResult } from "@/lib/repos/ask";
import { formatINR } from "@/lib/format";
import { AiReveal } from "@/components/ui/AiReveal";

function AnswerChart({ points, label }: { points: number[]; label: string }) {
  const w = 720;
  const h = 96;
  const pad = 2;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;

  const xy = (v: number, i: number) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - pad * 2) - pad;
    return [x, y] as const;
  };

  const line = points.map((v, i) => xy(v, i).join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const peakIdx = points.indexOf(max);
  const [px, py] = xy(max, peakIdx);

  return (
    <figure className="mt-3 border-t border-border pt-3">
      <figcaption className="flex items-baseline justify-between text-[10px] font-mono uppercase tracking-widest text-ink-faint">
        <span>{label}</span>
        <span className="tabular-nums normal-case tracking-normal">
          peak {formatINR(max, { compact: true })}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="mt-2 h-24 w-full overflow-visible"
        role="img"
        aria-label={`${label}. Peak ${formatINR(max, { compact: true })}.`}
      >
        <defs>
          <linearGradient id="cmd-answer-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-ai-emerald)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-ai-emerald)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#cmd-answer-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-ai-emerald)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.length > 1 && (
          <circle cx={px} cy={py} r="2.5" fill="var(--color-ai-emerald)" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </figure>
  );
}

function AnswerTable({
  rows,
  onNavigate,
}: {
  rows: NonNullable<Extract<AskResult, { ok: true }>["rows"]>;
  onNavigate: (href: string) => void;
}) {
  const hasSub = rows.some((r) => r.sub);
  return (
    <div className="mt-3 overflow-x-auto border-t border-border pt-1">
      <table className="w-full text-xs">
        <tbody>
          {rows.map((r, i) => {
            const clickable = Boolean(r.href);
            return (
              <tr
                key={i}
                onClick={() => r.href && onNavigate(r.href)}
                className={`border-b border-border/60 last:border-0 ${
                  clickable ? "cursor-pointer hover:bg-bg-sunken" : ""
                } transition-colors duration-instant`}
              >
                <td className="max-w-0 truncate py-1.5 pr-3 text-ink" title={r.label}>
                  {r.label}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 text-right font-mono tabular-nums text-ink">
                  {r.value}
                </td>
                {hasSub && (
                  <td className="whitespace-nowrap py-1.5 text-right font-mono tabular-nums text-ink-faint">
                    {r.sub}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AnswerCard({
  result,
  onNavigate,
}: {
  result: AskResult;
  onNavigate: (href: string) => void;
}) {
  if (!result.ok) {
    // Never render an invisible empty div — e.g. a rate-limit body carries
    // `error`, not `message`, so message can be undefined at runtime.
    const msg =
      result.message ||
      "I can answer revenue, hits, and unpriced questions — try “revenue for Acme in May”.";
    return <div className="mx-1 mb-1 px-3 py-4 text-center text-xs text-ink-muted">{msg}</div>;
  }

  return (
    <AiReveal className="mx-1 mb-1" radius="12px">
    <div className="rounded-md border border-border bg-ai-bg p-4">
      <div className="font-display text-3xl leading-none text-ink">{result.value}</div>
      <div className="mt-2 text-xs text-ink-muted">{result.label}</div>

      {result.series && result.series.points.length > 1 && (
        <AnswerChart points={result.series.points} label={result.series.label} />
      )}

      {result.rows && result.rows.length > 0 && (
        <AnswerTable rows={result.rows} onNavigate={onNavigate} />
      )}

      <div className="mt-3 flex items-center gap-3 border-t border-border pt-2 text-[10px]">
        {result.drilldown && (
          <button
            type="button"
            onClick={() => onNavigate(result.drilldown!.href)}
            className="text-ai-ink hover:underline"
          >
            {result.drilldown.label} →
          </button>
        )}
        <span className="font-mono text-ink-faint">{result.assumptions}</span>
      </div>
    </div>
    </AiReveal>
  );
}
