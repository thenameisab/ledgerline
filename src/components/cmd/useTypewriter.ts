"use client";

// Typewriter for the "Ask Me" placeholder: types a phrase out, holds, deletes,
// moves to the next. Driven into the input's `placeholder` attribute rather than
// an overlay, so the caret, IME, and real typing all behave normally — and the
// browser hides it the moment the user types a character.
//
// Honours prefers-reduced-motion by showing the first phrase statically. Stops
// dead when `active` is false: no timers running behind a closed palette.

import { useEffect, useRef, useState } from "react";

const TYPE_MS = 45; // per character
const DELETE_MS = 22; // faster out than in — deleting shouldn't hold attention
const HOLD_MS = 1600; // fully typed, before deleting
const GAP_MS = 260; // fully deleted, before the next phrase

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useTypewriter(phrases: string[], active: boolean): string {
  const [text, setText] = useState("");
  // Timer id kept in a ref so the cleanup can cancel a pending step; the state
  // machine itself lives in the closure chain rather than in React state, which
  // keeps it to one re-render per character.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active || phrases.length === 0) {
      setText("");
      return;
    }

    if (prefersReducedMotion()) {
      setText(phrases[0]);
      return;
    }

    let phrase = 0;
    let chars = 0;
    let deleting = false;
    let cancelled = false;

    const step = () => {
      if (cancelled) return;
      const current = phrases[phrase % phrases.length];

      if (!deleting) {
        chars++;
        setText(current.slice(0, chars));
        if (chars >= current.length) {
          deleting = true;
          timer.current = setTimeout(step, HOLD_MS);
          return;
        }
        timer.current = setTimeout(step, TYPE_MS);
        return;
      }

      chars--;
      setText(current.slice(0, Math.max(chars, 0)));
      if (chars <= 0) {
        deleting = false;
        phrase++;
        timer.current = setTimeout(step, GAP_MS);
        return;
      }
      timer.current = setTimeout(step, DELETE_MS);
    };

    timer.current = setTimeout(step, TYPE_MS);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // `phrases` is a fresh array each render at the call site, so it's joined
    // into a stable key — otherwise the effect would restart every render and
    // the animation would never advance past its first character.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, phrases.join("|")]);

  return text;
}
