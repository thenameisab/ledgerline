/**
 * The glyph — the atomic motif of the design language.
 *
 * An angular "L" whose foot ends in a diagonal cut. The shape is simple enough
 * to read at favicon size and as a loading state.
 *
 * Two tones:
 *   - `tone="brand"` (default) — inherits `currentColor`, so it takes the ink or
 *     azure of whatever it sits in. This is chrome.
 *   - `tone="ai"` — filled with the AI gradient. Reserved for the thinking state
 *     and other moments where the system is working for you (see AiReveal).
 */
export function Glyph({
  size = 20,
  tone = "brand",
  className,
  title,
}: {
  size?: number;
  tone?: "brand" | "ai";
  className?: string;
  /** Give the mark an accessible name; omit it when it's decorative. */
  title?: string;
}) {
  // Each rendered instance needs its own gradient id, or a second glyph on the
  // page would reference the first one's (already-removed) def.
  const gradientId = `glyph-ai-${size}-${tone}`;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {tone === "ai" && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--color-ai-mint)" />
            <stop offset="0.34" stopColor="var(--color-ai-spring)" />
            <stop offset="0.67" stopColor="var(--color-ai-aqua)" />
            <stop offset="1" stopColor="var(--color-ai-emerald)" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M8 4 H14 V22 H27 L23 28 H8 Z"
        fill={tone === "ai" ? `url(#${gradientId})` : "currentColor"}
      />
    </svg>
  );
}
