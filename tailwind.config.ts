import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // Gate every `hover:` utility behind `@media (hover: hover)`, so a hover
  // style does not stick to a tapped element on touch. On a mouse it changes
  // nothing.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      // Literal white, with the <alpha-value> hook so `text-white/70` works.
      // Only for content sitting on a deliberately dark surface — the login
      // flutes, a filled accent chip — where the theme's ink would vanish.
      // Everything on a normal surface uses the ink/bg tokens.
      white: "rgb(255 255 255 / <alpha-value>)",
      bg: "var(--color-bg)",
      "bg-raised": "var(--color-bg-raised)",
      "bg-sunken": "var(--color-bg-sunken)",
      ink: "var(--color-ink)",
      "ink-muted": "var(--color-ink-muted)",
      "ink-faint": "var(--color-ink-faint)",
      border: "var(--color-border)",
      "border-strong": "var(--color-border-strong)",
      accent: "var(--color-accent)",
      "accent-bg": "var(--color-accent-bg)",
      "accent-ink": "var(--color-accent-ink)",
      // AI accent family — intelligence surfaces only (see tokens.css).
      "ai-mint": "var(--color-ai-mint)",
      "ai-spring": "var(--color-ai-spring)",
      "ai-aqua": "var(--color-ai-aqua)",
      "ai-emerald": "var(--color-ai-emerald)",
      "ai-ink": "var(--color-ai-ink)",
      "ai-bg": "var(--color-ai-bg)",
      ok: "var(--color-ok)",
      "ok-bg": "var(--color-ok-bg)",
      "ok-bg-hover": "var(--color-ok-bg-hover)",
      "ok-ink": "var(--color-ok-ink)",
      warn: "var(--color-warn)",
      "warn-bg": "var(--color-warn-bg)",
      "warn-bg-hover": "var(--color-warn-bg-hover)",
      "warn-ink": "var(--color-warn-ink)",
      bad: "var(--color-bad)",
      "bad-bg": "var(--color-bad-bg)",
      "bad-bg-hover": "var(--color-bad-bg-hover)",
      "bad-ink": "var(--color-bad-ink)",
      info: "var(--color-info)",
      "info-bg": "var(--color-info-bg)",
      "info-bg-hover": "var(--color-info-bg-hover)",
      "info-ink": "var(--color-info-ink)",
      success: "var(--color-success)",
      "success-bg": "var(--color-success-bg)",
      "success-bg-hover": "var(--color-success-bg-hover)",
      "success-ink": "var(--color-success-ink)",
      muted: "var(--color-muted)",
      overlay: "var(--color-overlay)",
      "heat-0": "var(--color-heat-0)",
      "heat-1": "var(--color-heat-1)",
      "heat-2": "var(--color-heat-2)",
      "heat-3": "var(--color-heat-3)",
      "heat-4": "var(--color-heat-4)",
      "viz-1": "var(--color-viz-1)",
      "viz-2": "var(--color-viz-2)",
      "viz-3": "var(--color-viz-3)",
      "viz-4": "var(--color-viz-4)",
      "viz-5": "var(--color-viz-5)",
      "viz-6": "var(--color-viz-6)",
      "viz-7": "var(--color-viz-7)",
      "viz-8": "var(--color-viz-8)",
      "viz-9": "var(--color-viz-9)",
    },
    fontFamily: {
      display: "var(--font-display)",
      // Alias kept so the existing `font-serif` landmark call sites resolve to
      // display type. There is no serif in the system any more.
      serif: "var(--font-serif)",
      sans: "var(--font-sans)",
      mono: "var(--font-mono)",
    },
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1.5" }],
      sm: ["0.875rem", { lineHeight: "1.5" }],
      base: ["1rem", { lineHeight: "1.5" }],
      lg: ["1.125rem", { lineHeight: "1.4" }],
      xl: ["1.266rem", { lineHeight: "1.3" }],
      "2xl": ["1.424rem", { lineHeight: "1.25" }],
      "3xl": ["1.602rem", { lineHeight: "1.2" }],
      "4xl": ["1.802rem", { lineHeight: "1.2" }],
      "5xl": ["2.281rem", { lineHeight: "1.15" }],
      "6xl": ["2.887rem", { lineHeight: "1.1" }],
    },
    spacing: {
      px: "1px",
      0: "0",
      // Fractional steps. The original 8px-grid scale omitted these, so the
      // hundreds of `gap-2.5` / `px-3.5` / `h-1.5` call sites silently
      // resolved to 0 — collapsing paddings and hiding bars/dots app-wide
      // (the sidebar's cramped layout was this, not its markup).
      0.5: "2px",
      1: "0.25rem",
      1.5: "6px",
      2: "0.5rem",
      2.5: "10px",
      3: "0.75rem",
      3.5: "14px",
      4: "1rem",
      5: "1.5rem",
      6: "2rem",
      7: "2.5rem",
      8: "3rem",
      // Button heights (DESIGN.md §6.1: md 36px, lg 44px). Without these keys
      // Button's h-9/h-11 resolved to nothing and buttons collapsed to
      // content height.
      9: "36px",
      11: "44px",
      10: "4rem",
      12: "5rem",
      // Larger fixed widths/heights the layout relies on. These were also
      // missing from the scale, so `pl-14` (StatusBar's mobile gap for the
      // hamburger), `w-14`/`w-56` (collapsed/expanded sidebar) and the help
      // layout widths silently resolved to 0 — the mobile menu overlapped the
      // page title and the sidebar-collapse toggle did nothing.
      14: "3.5rem",
      16: "8rem",
      24: "12rem",
      32: "16rem",
      48: "24rem",
      52: "13rem",
      56: "14rem",
      60: "15rem",
      64: "32rem",
      full: "100%",
      half: "50%",
    },
    borderRadius: {
      none: "0",
      sm: "0.25rem",   /*  4px */
      DEFAULT: "0.5rem", /* 8px — controls */
      md: "0.75rem",   /* 12px — cards */
      // Cards asked for `rounded-lg` in a lot of places; 12px is the card
      // radius now, so lg and md land together rather than churning call sites.
      lg: "0.75rem",   /* 12px */
      xl: "1rem",      /* 16px — modals, trays */
      full: "9999px",
    },
    extend: {
      letterSpacing: {
        display: "var(--tracking-display)",
        hero: "var(--tracking-hero)",
        // Micro-labels (11px uppercase Inter medium) want more air than
        // Tailwind's default 0.1em — the caps need room to read as a label
        // rather than a word.
        widest: "0.14em",
      },
      boxShadow: {
        low: "var(--elevation-low)",
        mid: "var(--elevation-mid)",
        high: "var(--elevation-high)",
        bevel: "var(--bevel-solid)",
        "bevel-quiet": "var(--bevel-quiet)",
      },
      backgroundImage: {
        ai: "var(--gradient-ai)",
      },
      transitionTimingFunction: {
        entrance: "var(--motion-ease-entrance)",
        exit: "var(--motion-ease-exit)",
        standard: "var(--motion-ease-standard)",
        emphasized: "var(--motion-ease-emphasized)",
        overshoot: "var(--motion-ease-overshoot)",
        // Aliases kept for existing `ease-expo` / `ease-quint` call sites —
        // `ease` for state changes, `ease-soft` for reveals.
        expo: "var(--motion-ease)",
        quint: "var(--motion-ease-soft)",
        ease: "var(--motion-ease)",
        "ease-soft": "var(--motion-ease-soft)",
      },
      transitionDuration: {
        instant: "80ms",
        fast: "160ms",
        base: "280ms",
        slow: "480ms",
        gentle: "960ms",
      },
    },
  },
  plugins: [],
};

export default config;
