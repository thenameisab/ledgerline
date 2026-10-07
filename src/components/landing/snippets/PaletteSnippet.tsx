"use client";

// Landing snippet: an inline copy of the ⌘K command palette with a small
// hard-coded index and the same query grammar as the app (@account, #SKU,
// field:value, > for actions, metric words for answers).

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  CornerDownLeft,
  FilePlus,
  LayoutList,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { Kbd, Label, Num, Snippet, usd, useInView } from "@/components/landing/ui";

/* ---------- Data (fictional) ---------- */

type Status = "active" | "pending" | "leaking";

const STATUS: Record<Status, { text: string; dot: string }> = {
  active: { text: "Active", dot: "bg-ok" },
  pending: { text: "Pending approval", dot: "bg-warn" },
  leaking: { text: "Unpriced usage", dot: "bg-bad" },
};

type Account = { name: string; slug: string; sep: number; status: Status };

const ACCOUNTS: Account[] = [
  { name: "Copperleaf CRM", slug: "copperleaf-crm", sep: 180102, status: "active" },
  { name: "Copperleaf Support", slug: "copperleaf-support", sep: 64280, status: "pending" },
  { name: "Quillmark Studio", slug: "quillmark-studio", sep: 209743, status: "active" },
  { name: "Quillmark News", slug: "quillmark-news", sep: 58610, status: "leaking" },
  { name: "Quillmark Podcasts", slug: "quillmark-podcasts", sep: 21480, status: "active" },
  { name: "Harbor Freight", slug: "harbor-freight", sep: 96370, status: "active" },
  { name: "Brightline Clinics", slug: "brightline-clinics", sep: 71920, status: "pending" },
  { name: "Kestrel Store", slug: "kestrel-store", sep: 88450, status: "leaking" },
  { name: "Kestrel Ads", slug: "kestrel-ads", sep: 30260, status: "active" },
  { name: "Pinnacle Markets", slug: "pinnacle-markets", sep: 18740, status: "active" },
];

type Api = { code: string; name: string; units: number; unit: string };

const APIS: Api[] = [
  { code: "ATL-PRO-IN", name: "Atlas Pro · input tokens", units: 41_820, unit: "M tokens" },
  { code: "ATL-PRO-OUT", name: "Atlas Pro · output tokens", units: 8_460, unit: "M tokens" },
  { code: "ATL-FLASH-IN", name: "Atlas Flash · input tokens", units: 512_300, unit: "M tokens" },
  { code: "ATL-EMBED", name: "Atlas Embed v3", units: 884_100, unit: "M tokens" },
  { code: "PRM-VID-1080", name: "Prism Video · 1080p", units: 51_200, unit: "seconds" },
  { code: "VOX-AGENT", name: "Realtime voice agent", units: 318_400, unit: "minutes" },
  { code: "MSG-SMS-US", name: "SMS · United States", units: 1_862_000, unit: "messages" },
  { code: "GPU-H100", name: "H100 GPU · on-demand", units: 9_310, unit: "GPU-hours" },
];

const VIEWS = [
  { name: "Accounts leaking revenue", path: "/accounts?status=leaking" },
  { name: "Manual entries pending approval", path: "/review/manual-entries?status=pending" },
  { name: "SKUs with no traffic", path: "/skus?traffic=none" },
  { name: "Invoices in draft", path: "/invoices?status=draft" },
];

const ACTIONS = [
  { name: "Refresh usage data", icon: RefreshCw },
  { name: "Create account", icon: Plus },
  { name: "Add manual entry", icon: FilePlus },
  { name: "Invite user", icon: UserPlus },
];

type MonthKey = "aug" | "sep" | "oct";

const MONTHS: Record<MonthKey, { label: string; short: string; factor: number; param: string }> = {
  aug: { label: "Aug 2026", short: "Aug", factor: 0.94, param: "2026-08" },
  sep: { label: "Sep 2026", short: "Sep", factor: 1, param: "2026-09" },
  oct: { label: "Oct 2026 (MTD)", short: "MTD", factor: 0.231, param: "2026-10" },
};

const MONTH_ALIAS: Record<string, MonthKey> = {
  aug: "aug",
  august: "aug",
  sep: "sep",
  sept: "sep",
  september: "sep",
  oct: "oct",
  october: "oct",
};

const METRICS = ["revenue", "margin", "unpriced"] as const;
type Metric = (typeof METRICS)[number];
const STOP = ["in", "for", "of", "the", "on", "during", "what", "is", "was"];

// Words the trailing, still-being-typed token is ignored for, so a half-typed
// keyword ("rev", "se", "status:") does not empty the list for a moment.
const KEYWORDS = [...METRICS, ...STOP, ...Object.keys(MONTH_ALIAS), "account:", "sku:", "api:", "status:", "month:"];

const revenue = (a: Account, m: MonthKey) => Math.round(a.sep * MONTHS[m].factor);
const marginOf = (a: Account, m: MonthKey) => Math.round(revenue(a, m) * 0.54);
/** Revenue the unpriced usage would add at list price. */
const unpricedOf = (a: Account, m: MonthKey) =>
  a.status === "leaking" ? Math.round(revenue(a, m) * 0.031) : 0;

/** 30 daily points, deterministic per account+month, scaled to sum to `total`. */
function series(seedText: string, total: number): number[] {
  let seed = 0;
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const raw = Array.from({ length: 30 }, (_, i) => {
    const weekend = i % 7 >= 5 ? 0.4 : 0;
    return Math.max(0.1, 1 + 0.2 * Math.sin(i / 2.3) + rand() * 0.35 - weekend);
  });
  const sum = raw.reduce((s, v) => s + v, 0);
  return raw.map((v) => (v / sum) * total);
}

/* ---------- Query grammar ---------- */

type Field = "account" | "api" | "status" | "month";
type Op = { field: Field; value: string };

function toOp(tok: string): Op | null {
  if (tok.length > 1 && tok[0] === "@") return { field: "account", value: tok.slice(1).toLowerCase() };
  if (tok.length > 1 && tok[0] === "#") return { field: "api", value: tok.slice(1).toLowerCase() };
  const m = /^(account|sku|api|status|month):(.+)$/i.exec(tok);
  if (m) {
    const f = m[1].toLowerCase();
    return { field: (f === "sku" ? "api" : f) as Field, value: m[2].toLowerCase() };
  }
  return null;
}

/** Moves finished operator tokens out of the text and into chips. */
function absorb(text: string): { text: string; ops: Op[] } {
  if (/^\s*[>?]/.test(text)) return { text, ops: [] };
  const parts = text.trim() ? text.trim().split(/\s+/) : [];
  const ended = /\s$/.test(text);
  const ops: Op[] = [];
  const kept: string[] = [];
  parts.forEach((p, i) => {
    const complete = ended || i < parts.length - 1;
    const op = complete ? toOp(p) : null;
    if (op) ops.push(op);
    else kept.push(p);
  });
  if (!ops.length) return { text, ops };
  return { text: kept.join(" ") + (kept.length && ended ? " " : ""), ops };
}

const accountMatchesOp = (a: Account, v: string) =>
  a.slug.includes(v) || a.name.toLowerCase().includes(v);
const apiMatchesOp = (x: Api, v: string) =>
  x.code.toLowerCase().includes(v) || x.name.toLowerCase().includes(v);

function chipLabel(op: Op): string {
  if (op.field === "account") {
    const hits = ACCOUNTS.filter((a) => accountMatchesOp(a, op.value));
    return hits.length === 1 ? hits[0].name : op.value;
  }
  if (op.field === "api") {
    const hits = APIS.filter((x) => apiMatchesOp(x, op.value));
    return hits.length === 1 ? hits[0].code : op.value.toUpperCase();
  }
  if (op.field === "month") {
    const k = MONTH_ALIAS[op.value];
    return k ? MONTHS[k].short : op.value;
  }
  return op.value;
}

type Row =
  | { kind: "answer"; id: string; account: Account; metric: Metric; month: MonthKey; path: string }
  | { kind: "account"; id: string; account: Account; month: MonthKey; path: string }
  | { kind: "api"; id: string; api: Api; path: string }
  | { kind: "view"; id: string; name: string; path: string }
  | { kind: "action"; id: string; name: string; icon: typeof Plus };

type Group = { label: string; rows: Row[] };

function search(text: string, chips: Op[]): Group[] {
  const trimmed = text.trimStart();

  if (trimmed.startsWith(">")) {
    const toks = trimmed.slice(1).toLowerCase().split(/\s+/).filter(Boolean);
    const rows: Row[] = ACTIONS.filter((a) => toks.every((t) => a.name.toLowerCase().includes(t))).map(
      (a) => ({ kind: "action", id: `action-${a.name}`, name: a.name, icon: a.icon })
    );
    return rows.length ? [{ label: "Actions", rows }] : [];
  }

  // "?question" asks: same parsing as plain text, answers first.
  const body = trimmed.startsWith("?") ? trimmed.slice(1) : text;
  const typing = !/\s$/.test(body);
  const toks = body.trim() ? body.trim().split(/\s+/) : [];
  const ops: Op[] = [...chips];
  const words: string[] = [];
  toks.forEach((t, i) => {
    const op = toOp(t);
    if (op) ops.push(op);
    else {
      const w = t.toLowerCase();
      const last = typing && i === toks.length - 1;
      if (last && (/^[a-z]+:$/.test(w) || (KEYWORDS.some((k) => k.startsWith(w) && k !== w) && !MONTH_ALIAS[w])))
        return;
      words.push(w);
    }
  });

  const accOps = ops.filter((o) => o.field === "account");
  const apiOps = ops.filter((o) => o.field === "api");
  const statusOps = ops.filter((o) => o.field === "status");
  const monthOp = ops.filter((o) => o.field === "month").pop();

  const metric = words.find((w): w is Metric => (METRICS as readonly string[]).includes(w));
  const monthWord = words.find((w) => MONTH_ALIAS[w]);
  const month: MonthKey = (monthOp && MONTH_ALIAS[monthOp.value]) || (monthWord && MONTH_ALIAS[monthWord]) || "oct";
  const core = words.filter(
    (w) => !(METRICS as readonly string[]).includes(w) && !STOP.includes(w) && !MONTH_ALIAS[w]
  );
  const wide = words.filter((w) => !STOP.includes(w));

  const accScope = accOps.length > 0 || statusOps.length > 0;
  const apiScope = apiOps.length > 0;
  const anyScope = accScope || apiScope;

  const accounts =
    !anyScope || accScope
      ? ACCOUNTS.filter((a) => {
          const hay = `${a.name} ${a.slug} ${STATUS[a.status].text}`.toLowerCase();
          return (
            accOps.every((o) => accountMatchesOp(a, o.value)) &&
            statusOps.every((o) => a.status.startsWith(o.value) || STATUS[a.status].text.toLowerCase().includes(o.value)) &&
            core.every((t) => hay.includes(t))
          );
        })
      : [];

  const accountRows: Row[] = accounts.map((a) => ({
    kind: "account",
    id: `acc-${a.slug}`,
    account: a,
    month,
    path: `/accounts/${a.slug}`,
  }));

  if (metric && accounts.length === 1 && (accOps.length > 0 || core.length > 0)) {
    const a = accounts[0];
    const tab = metric === "unpriced" ? "usage" : "revenue";
    return [
      {
        label: "Answer",
        rows: [
          {
            kind: "answer",
            id: `answer-${a.slug}`,
            account: a,
            metric,
            month,
            path: `/accounts/${a.slug}/${tab}?month=${MONTHS[month].param}`,
          },
        ],
      },
      { label: "Accounts", rows: accountRows },
    ];
  }

  const apis =
    !anyScope || apiScope
      ? APIS.filter((x) => {
          const hay = `${x.code} ${x.name}`.toLowerCase();
          return apiOps.every((o) => apiMatchesOp(x, o.value)) && core.every((t) => hay.includes(t));
        })
      : [];
  const views = anyScope ? [] : VIEWS.filter((v) => wide.every((t) => v.name.toLowerCase().includes(t)));
  const actions = anyScope ? [] : ACTIONS.filter((a) => wide.every((t) => a.name.toLowerCase().includes(t)));

  const groups: Group[] = [
    { label: "Accounts", rows: accountRows },
    {
      label: "SKUs",
      rows: apis.map((x) => ({ kind: "api", id: `api-${x.code}`, api: x, path: `/skus/${x.code}` })),
    },
    {
      label: "Views",
      rows: views.map((v) => ({ kind: "view", id: `view-${v.name}`, name: v.name, path: v.path })),
    },
    {
      label: "Actions",
      rows: actions.map((a) => ({ kind: "action", id: `action-${a.name}`, name: a.name, icon: a.icon })),
    },
  ];
  return groups.filter((g) => g.rows.length > 0);
}

/* ---------- Autoplay script ---------- */

const SCRIPT = ["quillmark", "@quillmark-studio margin in sep", "#atl", ">refresh"];

/* ---------- Component ---------- */

export function PaletteSnippet() {
  const reduce = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const listId = useId();
  const [text, setText] = useState("");
  const [chips, setChips] = useState<Op[]>([]);
  const [active, setActive] = useState(0);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const textRef = useRef("");
  const stoppedRef = useRef(false);
  const keyNav = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => search(text, chips), [text, chips]);
  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const activeRow = rows[Math.min(active, rows.length - 1)];

  const reset = useCallback(() => {
    textRef.current = "";
    setText("");
    setChips([]);
    setActive(0);
    setConfirm(null);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, []);

  const change = useCallback((next: string) => {
    const r = absorb(next);
    if (r.ops.length) setChips((c) => [...c, ...r.ops]);
    textRef.current = r.text;
    setText(r.text);
    setActive(0);
    setConfirm(null);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, []);

  const removeChip = (i: number) => {
    setChips((c) => c.filter((_, j) => j !== i));
    setActive(0);
    setConfirm(null);
  };

  const open = (row: Row | undefined) => {
    if (!row) return;
    setConfirm(
      row.kind === "action" ? `Would run “${row.name}” in the demo` : `Would open ${row.path} in the demo`
    );
  };

  // Stop the self-demo for good on the first real interaction, and hand the
  // user an empty input.
  const stop = () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    setStopped(true);
    reset();
  };

  const playing = inView && !stopped && !reduce;

  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const done = () => cancelled || stoppedRef.current;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const waitVisible = async () => {
      while (!done() && document.hidden) await sleep(250);
    };
    (async () => {
      await sleep(500);
      while (!done()) {
        for (const q of SCRIPT) {
          if (done()) return;
          reset();
          for (const ch of q) {
            await waitVisible();
            await sleep(45);
            if (done()) return;
            change(textRef.current + ch);
          }
          await sleep(1600);
          await waitVisible();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playing, change, reset]);

  // Keep the keyboard-selected row visible. Instant, no smooth scroll.
  useEffect(() => {
    if (!keyNav.current) return;
    keyNav.current = false;
    const c = listRef.current;
    const el = c?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    if (!c || !el) return;
    if (el.offsetTop - 28 < c.scrollTop) c.scrollTop = Math.max(0, el.offsetTop - 28);
    else if (el.offsetTop + el.offsetHeight > c.scrollTop + c.clientHeight)
      c.scrollTop = el.offsetTop + el.offsetHeight - c.clientHeight + 6;
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!rows.length) return;
      keyNav.current = true;
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (Math.min(i, rows.length - 1) + d + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      open(activeRow);
    } else if (e.key === "Escape") {
      if (text || chips.length) {
        e.preventDefault();
        reset();
      }
    } else if (e.key === "Backspace" && text === "" && chips.length) {
      e.preventDefault();
      removeChip(chips.length - 1);
    }
  };

  let idx = -1;

  return (
    <div
      ref={ref}
      onPointerDownCapture={stop}
      onKeyDownCapture={stop}
      onFocusCapture={stop}
    >
      <Snippet path="⌘K · command palette">
        {/* Input row */}
        <div className="flex h-[48px] items-center gap-2 border-b border-border px-3">
          <Search size={15} className="shrink-0 text-ink-faint" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {chips.map((c, i) => (
              <span
                key={`${c.field}-${c.value}-${i}`}
                className="inline-flex h-[24px] shrink-0 items-center gap-1 rounded-sm border border-border bg-bg-sunken pl-1.5 font-mono text-[11px]"
              >
                <span className="text-ink-faint">{c.field}</span>
                <span className="max-w-[110px] truncate text-ink" title={chipLabel(c)}>
                  {chipLabel(c)}
                </span>
                <button
                  type="button"
                  onClick={() => removeChip(i)}
                  aria-label={`Remove filter ${c.field}: ${chipLabel(c)}`}
                  className="ll-press inline-flex h-[22px] w-[20px] items-center justify-center rounded-sm text-ink-faint outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            ))}
            <div className="relative min-w-[96px] flex-1">
              <input
                type="text"
                value={text}
                onChange={(e) => change(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label="Search the demo palette"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeRow ? `${listId}-${activeRow.id}` : undefined}
                placeholder={chips.length ? "" : "Search accounts, SKUs, invoices… or ask"}
                spellCheck={false}
                autoComplete="off"
                className="h-[30px] w-full rounded-sm bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              />
              {playing && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden whitespace-pre text-[13px] text-transparent"
                >
                  {text}
                  <span className="ll-caret" />
                </span>
              )}
            </div>
          </div>
          <span className="hidden sm:inline-flex">
            <Kbd>esc</Kbd>
          </span>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Results"
          className="relative h-[300px] overflow-y-auto overscroll-contain py-1"
        >
          {groups.length === 0 && (
            <div className="px-3 py-5 text-[13px] text-ink-muted">
              No matches. Try <span className="font-mono text-[12px]">@account</span>,{" "}
              <span className="font-mono text-[12px]">#SKU</span>,{" "}
              <span className="font-mono text-[12px]">status:pending</span> or{" "}
              <span className="font-mono text-[12px]">&gt;</span> for actions.
            </div>
          )}
          {groups.map((g) => (
            <div key={g.label} role="group" aria-label={g.label}>
              <Label className="px-3 pb-1 pt-2.5">{g.label}</Label>
              {g.rows.map((row) => {
                idx += 1;
                const i = idx;
                const on = activeRow?.id === row.id;
                const common = {
                  id: `${listId}-${row.id}`,
                  role: "option",
                  "aria-selected": on,
                  "data-idx": i,
                  onPointerMove: () => {
                    if (active !== i) setActive(i);
                  },
                  onClick: () => {
                    setActive(i);
                    open(row);
                  },
                } as const;
                if (row.kind === "answer") {
                  return (
                    <div key={row.id} {...common} className="cursor-pointer px-2 py-1">
                      <AnswerCard row={row} on={on} reduce={!!reduce} />
                    </div>
                  );
                }
                return (
                  <div
                    key={row.id}
                    {...common}
                    className={`mx-1.5 flex h-[36px] cursor-pointer items-center gap-2.5 rounded-sm px-2 text-[13px] ${
                      on ? "bg-bg-sunken text-ink" : "text-ink-muted"
                    }`}
                  >
                    <RowBody row={row} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Status line: confirmation or result count */}
        <div className="flex h-[32px] items-center gap-2 border-t border-border px-3 text-[12px]">
          <span aria-live="polite" className="flex min-w-0 items-center gap-1.5 text-ink">
            {confirm && (
              <>
                <CornerDownLeft size={13} className="shrink-0 text-accent" aria-hidden />
                <span className="truncate" title={confirm}>
                  {confirm}
                </span>
              </>
            )}
          </span>
          {!confirm && (
            <span className="tabular-nums text-ink-faint">
              {rows.length} {rows.length === 1 ? "result" : "results"}
            </span>
          )}
        </div>

        {/* Hints */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-bg px-3 py-2 text-[11.5px] text-ink-faint">
          <Hint keys={["↑", "↓"]} text="navigate" />
          <Hint keys={["↵"]} text="open" />
          <Hint keys={[":"]} text="filter" />
          <Hint keys={[">"]} text="actions" />
          <Hint keys={["?"]} text="ask" />
        </div>
      </Snippet>
    </div>
  );
}

function Hint({ keys, text }: { keys: string[]; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
      <span>{text}</span>
    </span>
  );
}

function RowBody({ row }: { row: Exclude<Row, { kind: "answer" }> }) {
  if (row.kind === "account") {
    const a = row.account;
    const s = STATUS[a.status];
    return (
      <>
        <Building2 size={14} className="shrink-0 text-ink-faint" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-ink" title={a.name}>
          {a.name}
        </span>
        <span aria-hidden className="hidden shrink-0 items-center gap-1.5 text-[12px] text-ink-muted sm:inline-flex">
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          {s.text}
        </span>
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full sm:hidden ${s.dot}`} title={s.text} />
        <span className="sr-only">{s.text}</span>
        <span className="w-[84px] shrink-0 text-right tabular-nums text-ink">{usd(revenue(a, row.month))}</span>
        <span className="w-[28px] shrink-0 font-mono text-[10.5px] text-ink-faint">{MONTHS[row.month].short}</span>
      </>
    );
  }
  if (row.kind === "api") {
    return (
      <>
        <span className="w-[92px] shrink-0 truncate font-mono text-[11px] text-ink-faint" title={row.api.code}>
          {row.api.code}
        </span>
        <span className="min-w-0 flex-1 truncate text-ink" title={row.api.name}>
          {row.api.name}
        </span>
        <span className="hidden shrink-0 tabular-nums text-[12px] text-ink-faint sm:inline">
          {row.api.units.toLocaleString("en-US")} {row.api.unit} MTD
        </span>
      </>
    );
  }
  if (row.kind === "view") {
    return (
      <>
        <LayoutList size={14} className="shrink-0 text-ink-faint" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-ink" title={row.name}>
          {row.name}
        </span>
        <span className="shrink-0 font-mono text-[10.5px] text-ink-faint">view</span>
      </>
    );
  }
  const Icon = row.icon;
  return (
    <>
      <Icon size={14} className="shrink-0 text-ink-faint" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-ink" title={row.name}>
        {row.name}
      </span>
      <span className="shrink-0 font-mono text-[10.5px] text-ink-faint">action</span>
    </>
  );
}

function AnswerCard({
  row,
  on,
  reduce,
}: {
  row: Extract<Row, { kind: "answer" }>;
  on: boolean;
  reduce: boolean;
}) {
  const { account: a, metric, month } = row;
  const value =
    metric === "revenue" ? revenue(a, month) : metric === "margin" ? marginOf(a, month) : unpricedOf(a, month);
  const fmt = usd;
  const points = series(`${a.slug}-${metric}-${month}`, Math.max(value, 1));
  const max = Math.max(...points);
  const min = Math.min(...points);
  const line = points
    .map((p, i) => `${((i / 29) * 118 + 1).toFixed(1)},${(30 - ((p - min) / (max - min || 1)) * 26 - 1).toFixed(1)}`)
    .join(" ");
  const summary = `${a.name} · ${metric} · ${MONTHS[month].label} · ${fmt(value)}`;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      className={`rounded border p-3 ${on ? "border-accent bg-bg" : "border-border bg-bg"}`}
    >
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
        <Sparkles size={12} className="shrink-0 text-accent" aria-hidden />
        <span className="truncate" title={`${a.name} · ${metric} · ${MONTHS[month].label}`}>
          {a.name} · {metric} · {MONTHS[month].label}
        </span>
      </div>
      <span className="sr-only">{summary}</span>
      <div className="mt-1.5 flex items-end justify-between gap-3" aria-hidden>
        <Num value={value} format={fmt} className="font-display text-[26px] leading-none tracking-display text-ink" />
        <svg viewBox="0 0 120 32" className="h-[32px] w-[96px] shrink-0 sm:w-[120px]" preserveAspectRatio="none">
          <polyline
            points={line}
            fill="none"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            className="stroke-accent"
          />
        </svg>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
        <Kbd>↵</Kbd>
        <span className="truncate" title={`Drill down to daily ${metric} for ${a.name}`}>
          Drill down to daily {metric} for {a.name}
        </span>
      </div>
    </motion.div>
  );
}
