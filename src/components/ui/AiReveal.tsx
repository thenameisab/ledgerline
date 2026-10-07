/**
 * AiReveal — the entry animation for content the system produced for you.
 *
 * Three coordinated effects, all CSS, all on the compositor:
 *   1. A counter-rotating conic-gradient ring traces the content's border for
 *      one second, then fades out over three. The ring is the "the system is
 *      handing this to you" beat — it belongs to the AI accent family, never to
 *      the azure product chrome.
 *   2. A 135° diagonal mask reveals the content beneath it, so the answer
 *      arrives edge-first rather than fading in as a block.
 *   3. A faint green wash sweeps across once and clears.
 *
 * Wrap anything genuinely derived — an ask-a-number answer, a briefing, a
 * variance explanation, a hover summary. Ordinary content must not use it: the
 * grammar only means something while it stays rare.
 *
 * Under prefers-reduced-motion the ring and sweep don't run and the content is
 * simply present — the meaning is carried by the green tint, not the movement.
 */
export function AiReveal({
  children,
  className = "",
  /** Match the wrapped surface's radius so the ring traces its actual edge. */
  radius = "12px",
}: {
  children: React.ReactNode;
  className?: string;
  radius?: string;
}) {
  return (
    <div
      className={`ai-reveal ${className}`}
      style={{ ["--ai-reveal-radius" as string]: radius }}
    >
      <span className="ai-reveal-ring" aria-hidden />
      <span className="ai-reveal-wash" aria-hidden />
      <div className="ai-reveal-body">{children}</div>
    </div>
  );
}
