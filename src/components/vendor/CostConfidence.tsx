"use client";
import * as React from "react";
import * as HoverCard from "@radix-ui/react-hover-card";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ConfidenceBar } from "./ConfidenceBar";
import { formatNumber } from "@/lib/format";
import {
  type CostConfidence as Confidence,
  confirmedShare,
  formatShare,
  isLowConfidence,
  LOW_CONFIDENCE_PCT,
} from "@/lib/vendor-confidence";

/**
 * The coverage figure that sits beside a margin number.
 *
 * A margin percentage says nothing about its own inputs. When few APIs have a
 * rate, the margin is close to 100% by arithmetic, not measurement. This states the share of the period's hits
 * whose cost is actually known, right next to the figure it qualifies, and the
 * hover breaks it into the four provenance states with a link to the surface
 * that fixes each.
 *
 * Reuses `ConfidenceBar` for the stacked bar — same segments, same order, same
 * colours as the vendor list and the rate card, so one visual means one thing
 * everywhere. Only the caption and the hover are added here.
 */
export function CostConfidence({
  confidence,
  fixHref = "/vendors",
  align = "start",
  side = "bottom",
  className,
}: {
  confidence: Confidence;
  /** Where the "fix this" links point. Vendor-scoped surfaces pass that vendor's rate card. */
  fixHref?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  const { hits } = confidence;
  const share = confirmedShare(confidence);
  const low = isLowConfidence(confidence);

  const rows = [
    {
      key: "not_billed",
      label: "Not billed",
      n: confidence.not_billed,
      dot: "bg-ok",
      note: "In-house, or costed on a stitched product's components. Cost is $0 by decision",
      fix: null as string | null,
    },
    {
      key: "contracted",
      label: "Contracted",
      n: confidence.contracted,
      dot: "bg-ok-ink",
      note: "In a signed document",
      fix: null,
    },
    {
      key: "quoted",
      label: "Quoted",
      n: confidence.quoted,
      dot: "bg-accent",
      note: "The vendor told us this number",
      fix: null,
    },
    {
      key: "estimated",
      label: "Estimated",
      n: confidence.estimated,
      dot: "bg-warn-ink",
      note: "A rate we filled in ourselves",
      fix: "Confirm the rate",
    },
    {
      key: "unknown",
      label: "No rate",
      n: confidence.unknown,
      dot: "bg-border",
      note: "Costed as $0. The margin above is overstated by this much traffic",
      fix: "Set a rate",
    },
  ];

  const caption =
    hits === 0
      ? "No traffic this period"
      : `Cost confirmed on ${formatShare(share)} of units`;

  return (
    <HoverCard.Root openDelay={180} closeDelay={120}>
      <div className={className}>
        <ConfidenceBar confidence={confidence} showLabel={false} />
        <HoverCard.Trigger asChild>
          {/* A button, not a bare span: the breakdown has to be reachable by
              keyboard, and Radix opens HoverCard content on focus. */}
          <button
            type="button"
            className="mt-1 text-[10px] text-ink-faint tnum underline decoration-dotted decoration-from-font underline-offset-2 hover:text-ink-muted focus-visible:text-ink-muted text-left"
          >
            {caption}
          </button>
        </HoverCard.Trigger>
      </div>
      <HoverCard.Portal>
        <HoverCard.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          style={{ width: 320, transformOrigin: "var(--radix-hover-card-content-transform-origin)" }}
          className="hovercard-content z-50 rounded-lg border border-border bg-bg-raised shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs uppercase tracking-widest text-ink-muted">Cost confidence</div>
            <div className="text-sm text-ink mt-[2px] tnum">
              {hits === 0 ? "No traffic this period" : `${formatNumber(hits)} units`}
            </div>
          </div>
          <div className="px-4 py-3 space-y-[10px]">
            {rows.map((r) => {
              const pct = hits > 0 ? (r.n / hits) * 100 : 0;
              return (
                <div key={r.key}>
                  <div className="flex items-baseline gap-2">
                    <span className={`w-[8px] h-[8px] rounded-sm shrink-0 ${r.dot}`} aria-hidden="true" />
                    <span className="text-xs text-ink flex-1">{r.label}</span>
                    <span className="font-mono text-xs text-ink-muted tnum">{formatNumber(r.n)}</span>
                    <span className="font-mono text-xs text-ink tnum w-[46px] text-right">
                      {formatShare(pct)}
                    </span>
                  </div>
                  <div className="pl-[16px] text-[11px] text-ink-faint leading-snug">
                    {r.note}
                    {r.fix && r.n > 0 && (
                      <>
                        {" · "}
                        <Link
                          href={fixHref}
                          className="text-accent-ink inline-flex items-center gap-[2px] hover:underline"
                        >
                          {r.fix}
                          <ArrowRight size={10} strokeWidth={1.75} />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-[10px] bg-bg-sunken border-t border-border text-[11px] text-ink-faint leading-snug">
            Confirmed means contracted, quoted, or not billed at all — a rate someone outside this
            building gave us, or a pair with no vendor invoice behind it.
            {low && ` Below ${LOW_CONFIDENCE_PCT}% confirmed, margin is shown muted rather than as a health colour.`}
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
