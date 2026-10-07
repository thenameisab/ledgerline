import { AiReveal } from "@/components/ui/AiReveal";
import { Glyph } from "@/components/ui/Glyph";

/**
 * The briefing — prose the system composed from the period's numbers. Because
 * it's derived rather than displayed, it arrives through AiReveal and is marked
 * with the glyph in AI green. A stored figure would never earn either.
 */
export function BriefingPanel({
  text,
  source = "deterministic",
}: {
  text: string;
  source?: "deterministic" | "llm";
}) {
  return (
    <AiReveal>
      <section className="bg-bg-raised border border-border rounded-lg px-6 py-5">
        <div className="flex items-center gap-2 mb-2">
          <Glyph size={12} tone="ai" />
          <span className="text-[11px] uppercase tracking-widest text-ink-faint">
            Briefing
            {source === "llm" && <span className="ml-2 font-mono text-[9px]">AI-composed</span>}
          </span>
        </div>
        <p className="font-display text-lg text-ink leading-relaxed max-w-prose" style={{ fontWeight: 400 }}>
          {text}
        </p>
      </section>
    </AiReveal>
  );
}
