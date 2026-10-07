// "Ask Me" cues — guided question templates for the command palette.
//
// The palette can answer a lot, but only if you already know how to phrase it.
// A cue is a half-written question with typed holes: pick "Revenue for …", then
// pick the account from a real list, then optionally a month. You never have to
// guess the wording, and the values on offer are the ones that actually exist.
//
// Every cue resolves to an ask, answered by lib/repos/ask.ts. Metric cues
// resolve to a *structured spec* rather than a sentence — ask's stripNoise()
// strips common words ("total", "all", "by"), so round-tripping an exact
// account name through prose can mangle it. We know the intent precisely here,
// so we send it precisely. Relation cues send prose.

import {
  Coins,
  Activity,
  AlertTriangle,
  Trophy,
  Zap,
  Users,
  GitCompareArrows,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/components/cmd/actions";

/** What a hole in a cue accepts. */
export type SlotKind = "account" | "group" | "api" | "month" | "topn";

export type Slot = {
  kind: SlotKind;
  /** Shown in the hole before it's filled: "an account", "a month". */
  label: string;
  /** Skippable with Enter — the ask layer's own default applies (MTD). */
  optional?: boolean;
};

export type SlotOption = {
  /** What gets sent — an exact account name, an API product code, a YYYY-MM. */
  value: string;
  label: string;
  /** Secondary text on the row (an API code, "last month"). */
  sub?: string;
};

/** Structured ask parameters — the query-string shape /api/ask accepts. */
export type AskSpecParams = {
  metric: "revenue" | "hits" | "unpriced";
  entityType: "account" | "group" | "all";
  entityName?: string;
  topN?: number;
  period?: string;
};

/** A resolved cue: either a structured ask or a prose ask. */
export type CueResolution =
  | { kind: "ask-spec"; spec: AskSpecParams; echo: string }
  | { kind: "ask-text"; text: string };

export type CmdCue = {
  id: string;
  icon: LucideIcon;
  /** Words before the first hole: "Revenue for". */
  lead: string;
  slots: Slot[];
  /** Words between holes — joiners[0] sits between slot 0 and slot 1. */
  joiners?: string[];
  /** Words after the last hole, e.g. "change vs last month?" */
  tail?: string;
  roles?: Role[];
  /** Values arrive in slot order; an unfilled optional slot is null. */
  build: (values: (SlotOption | null)[]) => CueResolution;
};

// ── Static slot option sources ───────────────────────────────────────────────
//
// account / group / api come from the server (see /api/cmd/options); these
// two are known at build time, so they cost no round-trip.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The last `count` months, newest first, as YYYY-MM. `now` is injectable so the
 * list is testable without freezing the clock.
 */
export function monthOptions(count = 15, now = new Date()): SlotOption[] {
  const out: SlotOption[] = [];
  let y = now.getFullYear();
  let m = now.getMonth();
  for (let i = 0; i < count; i++) {
    out.push({
      value: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${MONTH_NAMES[m]} ${y}`,
      sub: i === 0 ? "this month" : i === 1 ? "last month" : undefined,
    });
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
}

const TOPN_OPTIONS: SlotOption[] = [
  { value: "5", label: "Top 5" },
  { value: "10", label: "Top 10" },
  { value: "20", label: "Top 20" },
];

/** Options for the slot kinds that need no server round-trip. */
export function staticSlotOptions(kind: SlotKind): SlotOption[] | null {
  if (kind === "month") return monthOptions();
  if (kind === "topn") return TOPN_OPTIONS;
  return null; // account / group / api are fetched
}

// ── Cues ────────────────────────────────────────────────────────────────────

export const ALL_CUES: CmdCue[] = [
  {
    id: "cue-revenue-account",
    icon: Coins,
    lead: "Revenue for",
    slots: [
      { kind: "account", label: "an account" },
      { kind: "month", label: "a month", optional: true },
    ],
    joiners: ["in"],
    build: ([account, month]) => ({
      kind: "ask-spec",
      spec: {
        metric: "revenue",
        entityType: "account",
        entityName: account?.value,
        period: month?.value,
      },
      echo: `Revenue for ${account?.label}${month ? ` in ${month.label}` : ""}`,
    }),
  },
  {
    id: "cue-revenue-month",
    icon: Coins,
    lead: "Total revenue in",
    slots: [{ kind: "month", label: "a month" }],
    build: ([month]) => ({
      kind: "ask-spec",
      spec: { metric: "revenue", entityType: "all", period: month?.value },
      echo: `Total revenue in ${month?.label}`,
    }),
  },
  {
    id: "cue-hits-account",
    icon: Activity,
    lead: "Hits for",
    slots: [
      { kind: "account", label: "an account" },
      { kind: "month", label: "a month", optional: true },
    ],
    joiners: ["in"],
    build: ([account, month]) => ({
      kind: "ask-spec",
      spec: { metric: "hits", entityType: "account", entityName: account?.value, period: month?.value },
      echo: `Hits for ${account?.label}${month ? ` in ${month.label}` : ""}`,
    }),
  },
  {
    id: "cue-revenue-group",
    icon: Building2,
    lead: "Revenue for group",
    slots: [
      { kind: "group", label: "a group" },
      { kind: "month", label: "a month", optional: true },
    ],
    joiners: ["in"],
    build: ([group, month]) => ({
      kind: "ask-spec",
      spec: { metric: "revenue", entityType: "group", entityName: group?.value, period: month?.value },
      echo: `Revenue for group ${group?.label}${month ? ` in ${month.label}` : ""}`,
    }),
  },
  {
    id: "cue-top-accounts",
    icon: Trophy,
    lead: "",
    slots: [
      { kind: "topn", label: "how many" },
      { kind: "month", label: "a month", optional: true },
    ],
    joiners: ["accounts by revenue in"],
    tail: "",
    build: ([topn, month]) => ({
      kind: "ask-spec",
      spec: { metric: "revenue", entityType: "all", topN: Number(topn?.value ?? 5), period: month?.value },
      echo: `Top ${topn?.value ?? 5} accounts by revenue${month ? ` in ${month.label}` : ""}`,
    }),
  },
  {
    id: "cue-unpriced",
    icon: AlertTriangle,
    lead: "What traffic is unpriced right now?",
    slots: [],
    build: () => ({
      kind: "ask-spec",
      spec: { metric: "unpriced", entityType: "all" },
      echo: "Unpriced traffic",
    }),
  },
  {
    // Relations take prose: they're separate handlers, not an AskSpec. The API
    // slot passes the product *code*, which no noise-stripper can mangle.
    id: "cue-accounts-using",
    icon: Users,
    lead: "Accounts using",
    slots: [{ kind: "api", label: "an API" }],
    build: ([api]) => ({ kind: "ask-text", text: `accounts using ${api?.value}` }),
  },
  {
    id: "cue-apis-used-by",
    icon: Zap,
    lead: "APIs used by",
    slots: [{ kind: "account", label: "an account" }],
    build: ([account]) => ({ kind: "ask-text", text: `apis used by ${account?.value}` }),
  },
  {
    id: "cue-variance",
    icon: GitCompareArrows,
    lead: "Why did",
    slots: [{ kind: "account", label: "an account" }],
    tail: "change vs last month?",
    build: ([account]) => ({
      kind: "ask-text",
      text: `why did ${account?.value} change vs last month`,
    }),
  },
];

export function cuesFor(role: Role): CmdCue[] {
  return ALL_CUES.filter((c) => !c.roles || c.roles.includes(role));
}

/** The cue rendered as a sentence, with filled values substituted in. */
export function cuePreview(cue: CmdCue, values: (SlotOption | null)[]): string {
  const parts: string[] = [];
  if (cue.lead) parts.push(cue.lead);
  cue.slots.forEach((slot, i) => {
    const v = values[i];
    parts.push(v ? v.label : `${slot.label}…`);
    const joiner = cue.joiners?.[i];
    if (joiner && (i + 1 < cue.slots.length)) parts.push(joiner);
  });
  if (cue.tail) parts.push(cue.tail);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Example questions for the animated placeholder. Drawn from the cues so the
 * teaser can never advertise a question the palette can't take.
 */
export function placeholderExamples(): string[] {
  return [
    "Revenue for Acme in May…",
    "Accounts using KY1001…",
    "Top 5 accounts by revenue…",
    "What traffic is unpriced right now?",
  ];
}
