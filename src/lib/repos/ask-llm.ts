// Optional LLM fallback for "ask a number" (Phase 5b).
//
// When template parsing can't read a question, and ASK_LLM_ENABLED=true with
// an OPENAI_API_KEY set, we ask OpenAI to translate the question into a
// validated AskSpec — never SQL. The spec runs through the same answerSpec()
// handlers as the deterministic path, so the model can't reach the database
// or invent a metric. Off by default; degrades to the "I can answer…" message.

import type { AskSpec, AskMetric, AskEntityType } from "./ask";

export function askLlmEnabled(): boolean {
  return process.env.ASK_LLM_ENABLED === "true" && !!process.env.OPENAI_API_KEY;
}

const SPEC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["metric", "entityType", "entityName", "topN", "period"],
  properties: {
    metric: { type: "string", enum: ["revenue", "hits", "unpriced"] },
    entityType: { type: "string", enum: ["account", "group", "all"] },
    entityName: { type: ["string", "null"] },
    topN: { type: ["integer", "null"] },
    period: { type: ["string", "null"] },
  },
} as const;

function validate(raw: unknown): AskSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const metric = o.metric as AskMetric;
  const entityType = o.entityType as AskEntityType;
  if (!["revenue", "hits", "unpriced"].includes(metric)) return null;
  if (!["account", "group", "all"].includes(entityType)) return null;
  return {
    metric,
    entityType,
    entityName: typeof o.entityName === "string" && o.entityName.trim() ? o.entityName : undefined,
    topN: typeof o.topN === "number" && o.topN > 0 ? Math.min(o.topN, 20) : undefined,
    period: typeof o.period === "string" ? o.period : undefined,
  };
}

export async function specFromLlm(
  question: string,
  catalog: { accounts: string[]; groups: string[] }
): Promise<AskSpec | null> {
  if (!askLlmEnabled()) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.ASK_LLM_MODEL ?? "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Translate a billing question into a JSON query spec. metric is revenue, hits, or unpriced; use hits for questions about units, usage or volume. entityType is account, group, or all. entityName must be exactly one of the provided names, or null. topN is a positive integer for ranked lists, else null. period is a phrase like 'May 2026', 'last month', or null for this month. Never invent values.",
          },
          {
            role: "user",
            content: `Question: ${question}\nAccounts: ${catalog.accounts.join(", ")}\nGroups: ${catalog.groups.join(", ")}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "ask_spec", strict: true, schema: SPEC_SCHEMA },
        },
      }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return validate(JSON.parse(content));
  } catch {
    return null;
  }
}
