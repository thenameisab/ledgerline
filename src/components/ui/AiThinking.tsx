import { Glyph } from "./Glyph";

/**
 * The thinking state — the glyph turning over a breathing field of the AI
 * accent stops. Use it in place of a spinner wherever the system is composing
 * something rather than merely loading: palette ask mode, a running sync.
 *
 * A spinner says "waiting". This says "working".
 */
export function AiThinking({
  size = 28,
  label,
  className = "",
}: {
  size?: number;
  /** Announced to screen readers; the visual is decorative. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`ai-thinking ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label ?? "Working"}
    >
      <span className="ai-thinking-glyph inline-flex text-ai-ink">
        <Glyph size={Math.round(size * 0.55)} />
      </span>
    </span>
  );
}
