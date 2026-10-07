"use client";

import "slot-text/style.css";
import { useLayoutEffect, useRef } from "react";
import {
  animateSlotText,
  buildSlotText,
  clearSlotText,
  type SlotOptions,
} from "slot-text";

const TINT_GOOD = "var(--color-success)";
const TINT_BAD = "var(--color-bad)";

/**
 * The tint for a roll that lands on a success. Green, from the AI accent
 * family — the system finished a job for you, which is the same grammar as the
 * gradient ring and the shimmer.
 *
 * This replaces the rainbow `chromatic()` roll: a rainbow is a celebration with
 * no meaning attached, and the palette can't afford a colour that means nothing.
 */
export const SUCCESS_ROLL = "var(--color-ai-emerald)";

/** Whether a rise in the value reads as good (revenue) or bad (cost, risk). */
type ChangeTone = "rise-good" | "rise-bad";

/**
 * SSR-safe text-roll label. Renders the plain text on the server (and on the
 * first account paint) so there's no blank flash, then hands the element over to
 * slot-text: the first mount builds the slot structure in place, and every
 * later `text` change rolls from the old value to the new one.
 *
 * Drop-in for a changing label or number — a button state, a live metric. If
 * `text` is unchanged between renders the roll does not fire, so values that
 * stay put stay still (safe under polling / router.refresh).
 *
 * Color:
 *  - Pass `options.color` (e.g. `SUCCESS_ROLL`) for a fixed roll-in tint.
 *  - Or pass `colorOnChange` to tint each roll by the *direction* of the
 *    change — green when the value moves the good way, red the bad way. The
 *    comparison uses `signValue` when given (robust against compact "₹1.2L"
 *    formatting), else the first number parsed out of `text`.
 *
 * `animateOnMount` rolls the text in from empty on first paint — for labels
 * that appear on a success moment (a confirmation pill) rather than changing
 * an existing value. Pair with `options.color: SUCCESS_ROLL` for the flash.
 */
export function RollingText({
  text,
  className,
  options,
  colorOnChange,
  signValue,
  animateOnMount = false,
}: {
  text: string;
  className?: string;
  options?: SlotOptions;
  colorOnChange?: ChangeTone;
  signValue?: number;
  animateOnMount?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Frozen so React never re-touches innerHTML after mount — slot-text owns the
  // DOM from then on. Also the SSR / pre-hydration content. When rolling in on
  // mount we start empty so there's no pre-roll flash of the final text.
  const initialHtml = useRef(animateOnMount ? "" : escapeHtml(text)).current;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // What the last roll landed on, so a roll only fires on a real text change
  // and the tint can be picked from the direction of the numeric change.
  const prevText = useRef(text);
  const prevValue = useRef(signValue ?? parseLeadingNumber(text));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Build whenever the element isn't currently a slot — covers first mount and
    // React's dev mount→cleanup→mount cycle, where clearSlotText empties it.
    if (!el.classList.contains("slot-text")) {
      if (animateOnMount && text.length > 0) {
        // Seed blank same-length cells so slot-text has real .char-slots to roll
        // from. Building with "" makes zero cells, which animateSlotText treats
        // as a first run and paints without rolling — no motion, no tint.
        buildSlotText(el, " ".repeat(text.length));
        animateSlotText(el, text, optionsRef.current);
      } else {
        buildSlotText(el, text);
      }
      prevText.current = text;
      prevValue.current = signValue ?? parseLeadingNumber(text);
      return;
    }
    // Only the displayed string changing should roll — a `signValue`-only
    // change (e.g. compact rounding lands on the same label) must not flash.
    if (text === prevText.current) return;

    const next = signValue ?? parseLeadingNumber(text);
    let opts = optionsRef.current;
    if (colorOnChange && Number.isFinite(next) && Number.isFinite(prevValue.current) && next !== prevValue.current) {
      const rose = next > prevValue.current;
      const good = colorOnChange === "rise-good" ? rose : !rose;
      opts = { ...opts, color: good ? TINT_GOOD : TINT_BAD };
    }
    prevText.current = text;
    prevValue.current = next;
    animateSlotText(el, text, opts);
  }, [text, signValue, colorOnChange, animateOnMount]);

  useLayoutEffect(() => {
    return () => {
      if (ref.current) clearSlotText(ref.current);
    };
  }, []);

  return (
    <span
      ref={ref}
      className={className}
      dangerouslySetInnerHTML={{ __html: initialHtml }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** First signed number in a label — "₹14.74L · 94%" → 14.74. NaN if none. */
function parseLeadingNumber(s: string): number {
  const m = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}
