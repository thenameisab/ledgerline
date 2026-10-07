import { NextResponse } from "next/server";
import { getIncludeSandbox } from "@/lib/repos/settings";
import { getSessionUser } from "@/lib/access";
import { rateLimit } from "@/lib/http";
import getSql from "@/lib/db";
import { answerQuestion, answerSpec } from "@/lib/repos/ask";
import { askLlmEnabled, specFromLlm } from "@/lib/repos/ask-llm";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });

  const limited = rateLimit(`ask:${user.id}`, { limit: 30, windowMs: 10_000 });
  if (limited) return limited;

  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim() ?? "";

  const includeSandbox = await getIncludeSandbox();

  // Structured path — the "Ask Me" cues know the intent exactly, so they send it
  // as a spec instead of a sentence. answerQuestion's stripNoise() removes
  // common words ("total", "all", "by"), which can mangle an exact account name
  // the user picked from a list; this skips that entirely. Same handlers, same
  // reads — only the parsing step is bypassed.
  const metric = sp.get("metric");
  if (metric === "revenue" || metric === "hits" || metric === "unpriced") {
    const entityType = sp.get("entityType");
    const topNRaw = Number(sp.get("topN"));
    return NextResponse.json(
      await answerSpec(
        {
          metric,
          entityType: entityType === "group" || entityType === "all" ? entityType : "account",
          entityName: sp.get("entity")?.trim() || undefined,
          topN: Number.isFinite(topNRaw) && topNRaw > 0 ? Math.min(topNRaw, 50) : undefined,
          period: sp.get("period")?.trim() || undefined,
        },
        { includeSandbox }
      )
    );
  }

  if (q.length < 2) return NextResponse.json({ ok: false, message: "" });

  // Layer 1 — deterministic templates.
  let result = await answerQuestion(q, { includeSandbox });

  // Layer 2 — optional LLM fallback (off unless ASK_LLM_ENABLED + key).
  if (!result.ok && askLlmEnabled()) {
    const sql = getSql();
    const [accounts, groups] = await Promise.all([
      sql<{ display_name: string }[]>`SELECT display_name FROM clients WHERE deleted_at IS NULL ORDER BY display_name LIMIT 500`,
      sql<{ name: string }[]>`SELECT name FROM accounts ORDER BY name LIMIT 200`,
    ]);
    const spec = await specFromLlm(q, {
      accounts: accounts.map((c) => c.display_name),
      groups: groups.map((a) => a.name),
    });
    if (spec) result = await answerSpec(spec, { includeSandbox });
  }

  return NextResponse.json(result);
}
