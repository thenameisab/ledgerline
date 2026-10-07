"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Users,
  Zap,
  ScrollText,
  DollarSign,
  PlusCircle,
  ArrowUpRight,
  FileText,
  Building2,
  Download,
  SlidersHorizontal,
  Loader2,
  BookOpen,
  UserCircle,
  CalendarRange,
  X,
  Sparkles,
  ChevronLeft,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { StatusChip } from "@/components/chips/StatusChip";
import { formatMoney, formatPercent, formatDateTime } from "@/lib/format";
import { fuzzyFilter } from "@/lib/fuzzy";
import { useRecents, type RecentType, type RecentItem } from "@/components/cmd/useRecents";
import { useCommandContext } from "@/components/cmd/useCommandContext";
import { ACTIONS, type CmdAction, type Role } from "@/components/cmd/actions";
import {
  ICONS,
  mainNav,
  reviewNav,
  vendorsNav,
  settingsTabs,
  HELP_ENTRY,
  CHANGELOG_ENTRY,
  type NavEntry,
  type IconName,
} from "@/lib/nav-model";
import { AnswerCard } from "@/components/cmd/AnswerCard";
import { AiThinking } from "@/components/ui/AiThinking";
import { parseQuery, removeFilter, FILTER_FIELDS, type FilterField } from "@/lib/cmd/query";
import { matchViews, type CmdView } from "@/lib/cmd/views";
import {
  cuePreview,
  placeholderExamples,
  type CueResolution,
  type AskSpecParams,
} from "@/lib/cmd/cues";
import { useAskMe } from "@/components/cmd/useAskMe";
import { useTypewriter } from "@/components/cmd/useTypewriter";
import type { SearchResults } from "@/lib/repos/search";
import type { AskResult } from "@/lib/repos/ask";
import type { StatementStatus } from "@/lib/repos/statements";
import type { ManualEntryStatus } from "@/lib/repos/manual-entries";

// Destinations come from lib/nav-model — the same file SideNav renders, so the
// palette can't offer a route the nav hides, print a ⌘ hint the nav doesn't
// have, or miss a rename. Icons arrive as names and resolve through ICONS.

function NavIcon({ name }: { name: IconName }) {
  const Icon = ICONS[name];
  return <Icon size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />;
}

const EMPTY_RESULTS: SearchResults = { accounts: [], invoices: [], groups: [], apis: [], manualEntries: [], vendors: [], audit: [], docs: [], periods: [], people: [] };

// ── Panel geometry ───────────────────────────────────────────────────────────
//
// The palette is a 560px list until an answer arrives that needs more than a
// list — a daily chart, or a breakdown long enough to deserve a real table. Then
// it grows in both axes and animates there, so the box tracks the shape of the
// content rather than making a table live inside a column meant for names.
type PanelShape = "list" | "wide";

const PANEL: Record<PanelShape, { maxWidth: string; listMaxHeight: string }> = {
  list: { maxWidth: "560px", listMaxHeight: "400px" },
  wide: { maxWidth: "880px", listMaxHeight: "min(70vh, 620px)" },
};

/** A chart, or a table worth the name, earns the wide panel. */
function answerShape(result: AskResult | null): PanelShape {
  if (!result?.ok) return "list";
  if (result.series && result.series.points.length > 1) return "wide";
  if (result.rows && result.rows.length >= 3) return "wide";
  return "list";
}

const INVOICE_STATUS: Record<StatementStatus, { label: string; dot: string }> = {
  draft:  { label: "draft",  dot: "bg-ink-faint" },
  final:  { label: "final",  dot: "bg-success" },
  issued: { label: "issued", dot: "bg-ok" },
};

const ENTRY_STATUS: Record<ManualEntryStatus, { label: string; dot: string }> = {
  draft:            { label: "draft",    dot: "bg-ink-faint" },
  pending_approval: { label: "pending",  dot: "bg-warn" },
  approved:         { label: "approved", dot: "bg-success" },
  void:             { label: "void",     dot: "bg-bad" },
};

const RECENT_ICON: Record<RecentType, typeof Users> = {
  account: Users,
  invoice: FileText,
  group: Building2,
  api: Zap,
  manual_entry: PlusCircle,
  vendor: DollarSign,
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Shared group heading style
const GROUP_HEADING =
  "[&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:px-3 " +
  "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase " +
  "[&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-ink-faint " +
  "[&_[cmdk-group-heading]]:select-none";

// Item base style
const ITEM_BASE =
  "relative flex items-center gap-3 px-3 min-h-[40px] rounded-md cursor-pointer " +
  "text-sm text-ink " +
  "transition-colors duration-[100ms] " +
  "aria-selected:bg-accent-bg aria-selected:text-accent-ink";

function Money({ value }: { value: number }) {
  return (
    <span className="shrink-0 font-mono text-[11px] text-ink-muted tabular-nums">
      {formatMoney(value, { compact: true })}
    </span>
  );
}

function StatusDot({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 180);

  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { recents, record } = useRecents();
  const context = useCommandContext(open);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  // ── Ask Me ────────────────────────────────────────────────────────────────
  // Declared up here because the results effect below has to know whether a
  // question is being built (in which case typing filters that step's values
  // and nothing should be fetched).

  // A structured spec from a finished cue, fetched in place of the prose ask.
  // Picking from a list means we already know the exact account name, and ask's
  // stripNoise() would chew common words out of it — so the spec goes straight
  // through. Any subsequent typing clears it back to prose parsing.
  const [cueSpec, setCueSpec] = useState<AskSpecParams | null>(null);

  // A finished cue asks a number. The hook resets itself once it has resolved,
  // so this doesn't have to.
  const runCue = useCallback((r: CueResolution) => {
    if (r.kind === "ask-text") {
      // Relations and variance are prose handlers, not specs.
      setQuery(`?${r.text}`);
      return;
    }
    setQuery(`?${r.echo}`);
    setCueSpec(r.spec);
  }, []);

  const askMe = useAskMe({ role, open, onResolve: runCue });
  const askMeOn = askMe.state.on;
  const typed = useTypewriter(
    useMemo(() => placeholderExamples(), []),
    askMeOn && !askMe.state.cue && !query
  );

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const inInput =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (document.activeElement as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (inInput) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Fetch results. Action mode (">") is verbs-only, no fetch. Ask mode ("?" /
  // a question) fetches the inline answer instead of entity search (a question
  // never matches entity names). Search sends the raw string — the server
  // re-parses it with the same grammar, so operators scope the query there too.
  useEffect(() => {
    const q = debouncedQuery;
    const p = parseQuery(q);
    // While Ask Me is building a question, typing filters that step's values —
    // it isn't an entity search, so nothing is fetched.
    if (askMeOn) {
      setResults(EMPTY_RESULTS);
      setAskResult(null);
      setLoading(false);
      return;
    }
    if (!open || q.length < 1 || p.mode === "action") {
      setResults(EMPTY_RESULTS);
      setAskResult(null);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    if (p.mode === "ask") {
      setResults(EMPTY_RESULTS);
      if (p.text.length < 2) {
        setAskResult(null);
        setLoading(false);
        return;
      }
      // A cue-built question carries its spec, so it skips prose parsing.
      const url = cueSpec
        ? `/api/ask?${new URLSearchParams({
            metric: cueSpec.metric,
            entityType: cueSpec.entityType,
            ...(cueSpec.entityName ? { entity: cueSpec.entityName } : {}),
            ...(cueSpec.topN ? { topN: String(cueSpec.topN) } : {}),
            ...(cueSpec.period ? { period: cueSpec.period } : {}),
          }).toString()}`
        : `/api/ask?q=${encodeURIComponent(p.text)}`;
      fetch(url, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: AskResult) => setAskResult(data))
        .catch((e) => {
          if (e?.name !== "AbortError") setAskResult({ ok: false, message: "Couldn't reach the answer service — try again." });
        })
        .finally(() => setLoading(false));
      return;
    }

    setAskResult(null);
    if (!p.text && !p.hasOperators) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: SearchResults) => setResults(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQuery, open, cueSpec, askMeOn]);

  // Clear a stale answer the instant the query changes so a mismatched card
  // never lingers during the debounce window.
  useEffect(() => {
    setAskResult(null);
  }, [query]);

  // Seed recents from where you are: opening the palette on an entity page
  // records it, so recents reflect browsing — not only palette selections.
  useEffect(() => {
    if (!open || !context) return;
    if (context.kind === "account") record({ type: "account", href: `/accounts/${context.slug}`, label: context.name });
    else if (context.kind === "group") record({ type: "group", href: `/accounts/groups/${context.id}`, label: context.name });
    else if (context.kind === "api") record({ type: "api", href: `/skus/${context.code}`, label: context.name, sub: context.code });
    else if (context.kind === "invoice")
      record({
        type: "invoice",
        href: `/accounts/${context.slug}/invoices?period=${context.periodId}`,
        label: context.periodLabel ? `${context.name} · ${context.periodLabel}` : context.name,
      });
  }, [open, context, record]);

  // Navigate to an entity and remember it for the empty-state Recents group.
  const goEntity = useCallback(
    (item: RecentItem) => {
      record(item);
      go(item.href);
    },
    [record, go]
  );

  // Run an action: nav jumps to its affordance; exec runs inline with a toast.
  const runAction = useCallback(
    async (a: CmdAction) => {
      if (a.kind === "nav") {
        go(a.href!);
        return;
      }
      if (a.id === "refresh-usage") {
        setRunningAction(a.id);
        try {
          const res = await fetch("/api/sync/refresh", { method: "POST" });
          const body = await res.json();
          if (!res.ok || !body.diff) {
            toast.error(body.error ?? "Refresh failed");
            return;
          }
          const delta = body.diff.hits_after - body.diff.hits_before;
          toast[body.ok ? "success" : "error"](
            body.ok
              ? delta === 0
                ? "Refreshed — no changes since the last pull"
                : `Refreshed — ${delta > 0 ? "+" : ""}${delta.toLocaleString("en-US")} units since the last pull`
              : "Refresh finished with errors — see the run log"
          );
          router.refresh();
          setOpen(false);
          setQuery("");
        } catch {
          toast.error("Refresh failed — network error");
        } finally {
          setRunningAction(null);
        }
      }
    },
    [go, router]
  );

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setQuery("");
      setCueSpec(null);
    }
  };

  const q = query.toLowerCase();
  const { accounts, invoices, groups, apis, manualEntries, vendors, audit, docs, periods, people } = results;

  // One parse drives everything below: mode, the operator chips, the corpus the
  // server will search, and which views are implied.
  const parsed = useMemo(() => parseQuery(query), [query]);

  // Action mode: a leading ">" filters to verbs only. Otherwise actions are
  // matched against the live query and shown alongside entity results.
  //
  // Every normal surface stands down while a question is being built — a
  // half-written cue and a list of accounts competing for the same Enter key
  // would be ambiguous.
  const askMode = parsed.mode === "ask" && !askMeOn;
  const actionMode = parsed.mode === "action" && !askMeOn;
  const actionQuery = actionMode ? parsed.text : query;
  const canDo = useCallback(
    (roles?: Role[]) => !roles || roles.includes(role),
    [role]
  );
  const availableActions = ACTIONS.filter((a) => canDo(a.roles));
  const matchedActions = fuzzyFilter(availableActions, actionQuery, ["label", "keywords"]);
  const showActions = !askMeOn && (actionMode || (!!query && matchedActions.length > 0));

  // Filtered destinations implied by the query — the payoff of the grammar.
  const views = useMemo(
    () =>
      actionMode || askMode || askMeOn
        ? []
        : matchViews(parsed, {
            role,
            fuzzy: (vs, term) => fuzzyFilter(vs, term, ["label", "keywords"]),
          }),
    [parsed, role, actionMode, askMode, askMeOn]
  );

  // Operator chips. Rendered above the list so what's scoping the search is
  // visible and dismissible, rather than buried in the input string.
  const chips = useMemo(
    () =>
      FILTER_FIELDS.filter((f) => parsed.filters[f]).map((f) => ({
        field: f as FilterField,
        value: parsed.filters[f]!,
      })),
    [parsed]
  );

  // The panel resizes for a chart or a table; nothing else changes its shape.
  //
  // Held across the debounce on purpose: the stale answer is cleared on every
  // keystroke, so deriving the shape straight from `askResult` would collapse
  // the panel and re-expand it for each character of "top 5 accounts". Instead
  // the shape only moves when a new answer lands, or when ask mode ends.
  const [shape, setShape] = useState<PanelShape>("list");
  useEffect(() => {
    if (!askMode) setShape("list");
    else if (askResult) setShape(answerShape(askResult));
  }, [askMode, askResult]);

  // Scoped "on this page" actions derived from the current route's entity.
  //
  // Every entry is a complete affordance the current role may actually reach:
  // pricing, the profile tab and the manual-entry wizard all guard on
  // `pricing.edit` / `account.update` / `manual_entry.edit`, so a member gets
  // the read-only subset (invoice exports, invoice list, ask shortcuts) rather
  // than a verb that redirects.
  const contextActions = useMemo<{ key: string; label: string; icon: LucideIcon; run: () => void }[]>(() => {
    if (!context || askMeOn) return [];
    const editor = role === "admin" || role === "editor";

    if (context.kind === "api") {
      return [
        {
          key: "ctx-accounts-using",
          label: "Accounts using this SKU",
          icon: Users,
          run: () => setQuery(`?accounts using ${context.code}`),
        },
      ];
    }

    if (context.kind !== "account" && context.kind !== "invoice") return [];
    const slug = context.slug;
    const acts: { key: string; label: string; icon: LucideIcon; run: () => void }[] = [];

    if (context.kind === "invoice") {
      const variant = role === "admin" ? "internal" : "customer";
      const base = `/api/invoices/${context.accountId}/${context.periodId}`;
      const openDoc = (href: string) => {
        window.open(href, "_blank", "noopener");
        setOpen(false);
        setQuery("");
      };
      acts.push(
        { key: "ctx-pdf", label: "Export invoice PDF", icon: Download, run: () => openDoc(`${base}/pdf?variant=${variant}&disposition=inline`) },
        { key: "ctx-csv", label: "Export invoice CSV", icon: Download, run: () => openDoc(`${base}/csv?variant=${variant}&disposition=attachment`) }
      );
    }

    if (editor) {
      acts.push(
        { key: "ctx-add", label: "Add manual entry", icon: PlusCircle, run: () => go(`/accounts/${slug}/manual-entry/new`) },
        { key: "ctx-pricing", label: "Edit pricing", icon: SlidersHorizontal, run: () => go(`/accounts/${slug}/pricing`) },
        { key: "ctx-profile", label: "Edit profile", icon: UserCircle, run: () => go(`/accounts/${slug}/profile`) }
      );
    }

    if (context.kind === "account") {
      acts.push({ key: "ctx-invoices", label: "View invoices", icon: FileText, run: () => go(`/accounts/${slug}/invoices`) });
      acts.push({
        key: "ctx-apis-used",
        label: "SKUs used by this account",
        icon: Zap,
        run: () => setQuery(`?skus used by ${context.name}`),
      });
    }

    return acts;
  }, [context, role, go, askMeOn]);

  const contextHeading =
    context &&
    (context.kind === "account" || context.kind === "invoice")
      ? `On this page · ${context.name}`
      : "On this page";

  // Don't list the page you're already on in Recents — "On this page" covers it.
  const currentHref =
    context?.kind === "account" ? `/accounts/${context.slug}`
    : context?.kind === "group" ? `/accounts/groups/${context.id}`
    : context?.kind === "api" ? `/skus/${context.code}`
    : context?.kind === "invoice" ? `/accounts/${context.slug}/invoices?period=${context.periodId}`
    : null;
  const visibleRecents = askMeOn ? [] : recents.filter((r) => r.href !== currentHref);

  // Destinations: same set the sidebar shows for this role.
  const filteredPages = askMeOn
    ? []
    : [...mainNav(role), HELP_ENTRY, CHANGELOG_ENTRY].filter(
        (p) => canDo(p.roles) && (!query || p.label.toLowerCase().includes(q))
      );

  // The Review queues and Settings tabs are browse affordances for the empty
  // state. With a query the Actions group covers the same routes as verbs with
  // searchable keywords, so listing them twice would only add noise.
  const browseOnly = (entries: NavEntry[]) => (query || askMeOn ? [] : entries);
  const review = browseOnly(reviewNav(role));
  const vendorNav = browseOnly(vendorsNav(role));
  const settings = browseOnly(settingsTabs(role));

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-[998] bg-overlay" />

        {/* Panel — animation driven by data-state from Radix */}
        <Dialog.Content
          aria-label="Command palette"
          data-shape={shape}
          className="
            cmd-panel
            fixed left-1/2 z-[999]
            w-[calc(100vw-2rem)]
            focus:outline-none
            transition-[max-width] duration-base ease-expo
            data-[state=open]:[animation:cmdk-in_var(--motion-duration-fast)_var(--motion-ease-entrance)_forwards]
            data-[state=closed]:[animation:cmdk-out_var(--motion-duration-instant)_var(--motion-ease-exit)_forwards]
          "
          style={{ top: "18vh", maxWidth: PANEL[shape].maxWidth }}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Command
            /* The palette floats over the page rather than replacing it, so it
               takes the same fluted-glass material as the notifications tray —
               you can still see the surface you invoked it from. `glass-tray`
               carries the blur, refraction, sheen, and the reduced-transparency
               fallback; the origin is overridden because this pane arrives from
               the centre, not the top-right. */
            className="glass-tray relative [transform-origin:center] rounded-[var(--radius-md)] overflow-hidden"
            shouldFilter={false}
          >
            {/* Input row */}
            <div className="flex items-center gap-3 px-4 border-b border-border">
              {askMe.state.on ? (
                <Sparkles size={16} strokeWidth={1.75} className="shrink-0 text-accent" />
              ) : (
                <svg
                  className="shrink-0 text-ink-muted"
                  width="16" height="16"
                  viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              )}

              {/* The question so far, as a chip. Clicking it steps back a slot. */}
              {askMe.state.on && askMe.state.cue && (
                <button
                  type="button"
                  onClick={askMe.back}
                  title="Back one step"
                  className="group flex shrink-0 items-center gap-1.5 rounded border border-accent/40 bg-accent-bg px-2 py-1 text-[11px] text-accent-ink transition-colors duration-instant hover:border-accent"
                >
                  <ChevronLeft size={10} strokeWidth={2} className="opacity-60 group-hover:opacity-100" />
                  {cuePreview(askMe.state.cue, askMe.state.values)}
                </button>
              )}
              <Command.Input
                value={query}
                onValueChange={(v) => {
                  setQuery(v);
                  // Typing over a cue-built question drops back to prose
                  // parsing — the spec no longer describes what's in the box.
                  if (cueSpec) setCueSpec(null);
                }}
                onKeyDown={(e) => {
                  // Tab opens Ask Me. Only from an empty box: with text in
                  // there it would discard what you typed, and Tab still has to
                  // reach the filter chips for keyboard users.
                  if (e.key === "Tab" && !e.shiftKey && !askMe.state.on && !query) {
                    e.preventDefault();
                    askMe.start();
                    return;
                  }
                  if (!askMe.state.on) return;
                  // Inside Ask Me, Escape steps back one level before it closes
                  // the palette — stopPropagation keeps Radix from hearing it.
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    askMe.back();
                    return;
                  }
                  // Backspace on an empty box steps back too, so correcting a
                  // wrong slot doesn't mean starting the question over.
                  if (e.key === "Backspace" && !query) {
                    e.preventDefault();
                    askMe.back();
                    return;
                  }
                  // Tab skips an optional slot (the ask layer's default applies).
                  if (e.key === "Tab" && !e.shiftKey && askMe.state.cue) {
                    const slot = askMe.state.cue.slots[askMe.state.slotIndex];
                    if (slot?.optional) {
                      e.preventDefault();
                      askMe.skipSlot();
                    }
                  }
                }}
                placeholder={
                  askMe.state.on
                    ? askMe.state.cue
                      ? `${askMe.state.cue.slots[askMe.state.slotIndex]?.label ?? ""} — type to filter`
                      : typed || "Ask me anything…"
                    : "Search accounts, invoices, SKUs, groups… or jump to a page"
                }
                className="flex-1 h-12 text-sm bg-transparent outline-none text-ink placeholder:text-ink-faint"
              />
              {loading ? (
                <Loader2 size={13} strokeWidth={1.75} className="shrink-0 text-ink-faint animate-spin" />
              ) : (
                <kbd className="shrink-0 text-[10px] text-ink-faint font-mono border border-border rounded px-1.5 py-0.5 leading-none">
                  esc
                </kbd>
              )}
            </div>

            {/* Operator chips — what's currently scoping the search. Clicking one
                removes just that operator and leaves the rest of the query. */}
            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
                {chips.map((c) => (
                  <button
                    key={c.field}
                    type="button"
                    onClick={() => setQuery(removeFilter(query, c.field))}
                    className="group inline-flex items-center gap-1 rounded border border-border bg-bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-muted transition-colors duration-instant hover:border-accent hover:text-accent-ink"
                    aria-label={`Remove ${c.field === "api" ? "sku" : c.field} filter`}
                  >
                    <span className="text-ink-faint group-hover:text-accent-ink">{c.field === "api" ? "sku" : c.field}:</span>
                    {c.value}
                    <X size={9} strokeWidth={2} className="opacity-50 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}

            <Command.List
              className="cmd-list overflow-y-auto overscroll-contain p-1.5 transition-[max-height] duration-base ease-expo"
              style={{ maxHeight: PANEL[shape].listMaxHeight }}
            >
              {/* ── Ask Me ──────────────────────────────────────────────────
                  Engaged: the cue list, or the current slot's real values. It
                  replaces the normal results entirely — a half-written question
                  and a list of accounts competing for the same Enter key would
                  be ambiguous. */}
              {askMe.state.on && !askMe.state.cue && (
                <Command.Group heading="Ask me" className={GROUP_HEADING}>
                  {askMe.state.cues.map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`cue-${c.id}`}
                      onSelect={() => askMe.pickCue(c)}
                      className={ITEM_BASE}
                    >
                      <c.icon size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <span className="flex-1">{cuePreview(c, [])}</span>
                      {c.slots.length > 0 && (
                        <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                          {c.slots.length} step{c.slots.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {askMe.state.on && askMe.state.cue && (
                <>
                  {askMe.state.loading && askMe.state.options.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-ink-faint">Loading…</div>
                  )}
                  {!askMe.state.loading && askMe.state.options.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-ink-faint">
                      Nothing available for this step.
                    </div>
                  )}
                  {askMe.state.options.length > 0 && (
                    <Command.Group
                      heading={`Pick ${askMe.state.cue.slots[askMe.state.slotIndex]?.label ?? "a value"}`}
                      className={GROUP_HEADING}
                    >
                      {askMe.state.cue.slots[askMe.state.slotIndex]?.optional && (
                        <Command.Item
                          value="slot-skip"
                          onSelect={askMe.skipSlot}
                          className={ITEM_BASE}
                        >
                          <CornerDownLeft size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                          <span className="flex-1 text-ink-muted">Skip — use this month</span>
                          <kbd className="shrink-0 rounded border border-border px-1 py-0.5 font-mono text-[10px] leading-none text-ink-faint">
                            tab
                          </kbd>
                        </Command.Item>
                      )}
                      {/* cmdk filters nothing for us (shouldFilter is off), so the
                          typed text narrows the slot list here. */}
                      {fuzzyFilter(askMe.state.options, query, ["label", "sub"])
                        .slice(0, 50)
                        .map((o) => (
                          <Command.Item
                            key={`slot-${o.value}`}
                            value={`slot-${o.value}`}
                            onSelect={() => askMe.pickValue(o)}
                            className={ITEM_BASE}
                          >
                            <TruncateTooltip text={o.label} className="flex-1 min-w-0" />
                            {o.sub && (
                              <span className="shrink-0 font-mono text-[10px] text-ink-faint">{o.sub}</span>
                            )}
                          </Command.Item>
                        ))}
                    </Command.Group>
                  )}
                </>
              )}

              {!askMode && !askMe.state.on && (
                <Command.Empty className="py-12 text-center text-xs text-ink-faint">
                  {actionMode
                    ? "No actions match."
                    : chips.length > 0
                      ? `Nothing matches those filters. Try removing one, or widen the term.`
                      : `No matches for “${query}” — try an account, invoice, SKU code, or status:pending.`}
                </Command.Empty>
              )}

              {/* Answer — inline "ask a number" result. Never blank in ask mode:
                  show a loading row, the answer, or a hint. */}
              {askMode &&
                (askResult ? (
                  <AnswerCard result={askResult} onNavigate={go} />
                ) : loading ? (
                  <div className="flex flex-col items-center gap-2.5 px-3 py-6">
                    <AiThinking size={30} label="Composing an answer" />
                    <span className="ai-shimmer text-xs">Thinking…</span>
                  </div>
                ) : (
                  <div className="px-3 py-6 text-center text-xs text-ink-faint">
                    Ask about revenue, units, or unpriced — e.g. “revenue for Copperleaf CRM in May”.
                  </div>
                ))}

              {/* On this page — scoped actions for the current route (empty-state) */}
              {!query && contextActions.length > 0 && (
                <Command.Group heading={contextHeading} className={GROUP_HEADING}>
                  {contextActions.map((a) => (
                    <Command.Item key={a.key} value={a.key} onSelect={a.run} className={ITEM_BASE}>
                      <a.icon size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <span className="flex-1">{a.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Recents — empty-state only */}
              {!query && visibleRecents.length > 0 && (
                <Command.Group heading="Recent" className={GROUP_HEADING}>
                  {visibleRecents.map((r) => {
                    const Icon = RECENT_ICON[r.type];
                    return (
                      <Command.Item
                        key={`recent-${r.href}`}
                        value={`recent-${r.href}`}
                        onSelect={() => goEntity(r)}
                        className={ITEM_BASE}
                      >
                        {r.type === "account" && r.href.startsWith("/accounts/") ? (
                          <AccountLogo
                            name={r.label}
                            slug={r.href.slice("/accounts/".length)}
                            size={18}
                          />
                        ) : (
                          <Icon size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                        )}
                        <TruncateTooltip text={r.label} className="flex-1 min-w-0" />
                        {r.sub && <span className="font-mono text-[10px] text-ink-faint shrink-0">{r.sub}</span>}
                        <ArrowUpRight size={11} strokeWidth={1.75} className="shrink-0 text-ink-faint opacity-60" />
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}

              {/* Views — filtered destinations. First, because "leaking
                  accounts" means the filtered list, not an account named that. */}
              {views.length > 0 && (
                <Command.Group heading="Views" className={GROUP_HEADING}>
                  {views.map((v: CmdView) => (
                    <Command.Item
                      key={v.id}
                      value={`view-${v.id}`}
                      onSelect={() => go(v.href)}
                      className={ITEM_BASE}
                    >
                      <v.icon size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <span className="flex-1">{v.label}</span>
                      <span className="shrink-0 font-mono text-[10px] text-ink-faint">filter</span>
                      <ArrowUpRight size={11} strokeWidth={1.75} className="shrink-0 text-ink-faint opacity-60" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Accounts */}
              {accounts.length > 0 && (
                <Command.Group heading="Accounts" className={GROUP_HEADING}>
                  {accounts.map((c) => (
                    <Command.Item
                      key={`account-${c.id}`}
                      value={`account-${c.id}`}
                      onSelect={() => goEntity({ type: "account", href: `/accounts/${c.slug}`, label: c.name })}
                      className={ITEM_BASE}
                    >
                      <AccountLogo name={c.name} slug={c.slug} hasLogo={c.has_logo} size={18} />
                      <span className="flex-1 min-w-0">
                        <TruncateTooltip text={c.name} className="min-w-0" />
                        {/* Matched a retired slug, not the current name — say so,
                            or the hit looks like a bug. */}
                        {c.matched_former_name && (
                          <span className="block truncate text-[10px] text-ink-faint">
                            formerly {c.matched_former_name}
                          </span>
                        )}
                      </span>
                      <Money value={c.revenue} />
                      {c.status_pill === "leak" && (
                        <StatusChip kind="leak" label={`${c.unpriced_pairs} unpriced`} />
                      )}
                      {c.status_pill === "historical" && (
                        <StatusChip kind="historical" label={`${c.unpriced_pairs} historical`} />
                      )}
                      {c.status_pill === "sandbox" && <StatusChip kind="sandbox" label="sandbox" />}
                      <ArrowUpRight size={11} strokeWidth={1.75} className="shrink-0 text-ink-faint opacity-60" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Invoices */}
              {invoices.length > 0 && (
                <Command.Group heading="Invoices" className={GROUP_HEADING}>
                  {invoices.map((inv) => (
                    <Command.Item
                      key={`invoice-${inv.account_slug}-${inv.period_id}`}
                      value={`invoice-${inv.account_slug}-${inv.period_id}`}
                      onSelect={() =>
                        goEntity({
                          type: "invoice",
                          href: `/accounts/${inv.account_slug}/invoices?period=${inv.period_id}`,
                          label: `${inv.client_name} · ${inv.period_label}`,
                        })
                      }
                      className={ITEM_BASE}
                    >
                      <FileText size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <TruncateTooltip
                        text={`${inv.client_name} · ${inv.period_label}`}
                        className="flex-1 min-w-0"
                      />
                      <Money value={inv.revenue} />
                      <span className="shrink-0 font-mono text-[11px] text-ink-faint tabular-nums">
                        {formatPercent(inv.margin_pct)}
                      </span>
                      <StatusDot dot={INVOICE_STATUS[inv.status].dot} label={INVOICE_STATUS[inv.status].label} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Billing periods — a month is somewhere you go, not just a word
                  that happens to appear in an invoice label. */}
              {periods.length > 0 && (
                <Command.Group heading="Billing periods" className={GROUP_HEADING}>
                  {periods.map((p) => (
                    <Command.Item
                      key={`period-${p.id}`}
                      value={`period-${p.id}`}
                      onSelect={() => go(`/dashboard?from=${p.start_date}&to=${p.end_date}`)}
                      className={ITEM_BASE}
                    >
                      <CalendarRange size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <span className="flex-1">{p.label}</span>
                      <span className="shrink-0 text-[11px] text-ink-faint">
                        {p.statement_count} invoice{p.statement_count === 1 ? "" : "s"}
                      </span>
                      {p.draft_count > 0 && (
                        <StatusDot dot="bg-ink-faint" label={`${p.draft_count} draft`} />
                      )}
                      <ArrowUpRight size={11} strokeWidth={1.75} className="shrink-0 text-ink-faint opacity-60" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* People — admin only (empty for everyone else) */}
              {people.length > 0 && (
                <Command.Group heading="People" className={GROUP_HEADING}>
                  {people.map((p) => (
                    <Command.Item
                      key={`person-${p.id}`}
                      value={`person-${p.id}`}
                      onSelect={() => go(`/admin/users?who=${p.id}`)}
                      className={ITEM_BASE}
                    >
                      {p.emoji ? (
                        <span className="w-[13px] shrink-0 text-center text-[13px] leading-none">{p.emoji}</span>
                      ) : (
                        <UserCircle size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      )}
                      <TruncateTooltip
                        text={p.job_title ? `${p.name} · ${p.job_title}` : p.name}
                        className="flex-1 min-w-0"
                      />
                      <span className="shrink-0 font-mono text-[10px] text-ink-faint">{p.role}</span>
                      <StatusDot
                        dot={p.status === "active" ? "bg-success" : p.status === "invited" ? "bg-warn" : "bg-ink-faint"}
                        label={p.status}
                      />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Groups */}
              {groups.length > 0 && (
                <Command.Group heading="Groups" className={GROUP_HEADING}>
                  {groups.map((a) => (
                    <Command.Item
                      key={`group-${a.id}`}
                      value={`group-${a.id}`}
                      onSelect={() => goEntity({ type: "group", href: `/accounts/groups/${a.id}`, label: a.name })}
                      className={ITEM_BASE}
                    >
                      <Building2 size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <TruncateTooltip text={a.name} className="flex-1 min-w-0" />
                      <span className="shrink-0 text-[11px] text-ink-faint">
                        {a.account_count} account{a.account_count === 1 ? "" : "s"}
                      </span>
                      <Money value={a.revenue} />
                      <ArrowUpRight size={11} strokeWidth={1.75} className="shrink-0 text-ink-faint opacity-60" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* SKUs */}
              {apis.length > 0 && (
                <Command.Group heading="SKUs" className={GROUP_HEADING}>
                  {apis.map((a) => (
                    <Command.Item
                      key={`api-${a.code}`}
                      value={`api-${a.code}`}
                      onSelect={() => goEntity({ type: "api", href: `/skus/${a.code}`, label: a.name, sub: a.code })}
                      className={ITEM_BASE}
                    >
                      <Zap size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <TruncateTooltip text={a.name} className="flex-1 min-w-0" />
                      <span className="font-mono text-[10px] text-ink-faint shrink-0">{a.code}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Manual entries */}
              {manualEntries.length > 0 && (
                <Command.Group heading="Manual entries" className={GROUP_HEADING}>
                  {manualEntries.map((m) => (
                    <Command.Item
                      key={`entry-${m.id}`}
                      value={`entry-${m.id}`}
                      onSelect={() =>
                        goEntity({
                          type: "manual_entry",
                          href: `/admin/manual-entries/${m.id}`,
                          label: `${m.client_name} · ${m.effective_date}`,
                        })
                      }
                      className={ITEM_BASE}
                    >
                      <PlusCircle size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <TruncateTooltip
                        text={`${m.client_name} · ${m.effective_date}`}
                        className="flex-1 min-w-0"
                      />
                      <Money value={m.revenue} />
                      <StatusDot dot={ENTRY_STATUS[m.status].dot} label={ENTRY_STATUS[m.status].label} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Vendor costs — the rate card, admin only (empty otherwise) */}
              {vendors.length > 0 && (
                <Command.Group heading="Vendors" className={GROUP_HEADING}>
                  {vendors.map((v) => (
                    <Command.Item
                      key={`vendor-${v.vendor_name}`}
                      value={`vendor-${v.vendor_name}`}
                      onSelect={() =>
                        goEntity({
                          type: "vendor",
                          href: `/vendors/${encodeURIComponent(v.vendor_name)}`,
                          label: v.vendor_name,
                        })
                      }
                      className={ITEM_BASE}
                    >
                      <DollarSign size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <TruncateTooltip text={v.vendor_name} className="flex-1 min-w-0" />
                      <span className="shrink-0 text-[11px] text-ink-faint">
                        {v.api_count} SKU{v.api_count === 1 ? "" : "s"}
                      </span>
                      <ArrowUpRight size={11} strokeWidth={1.75} className="shrink-0 text-ink-faint opacity-60" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Audit — admin only (empty for members) */}
              {audit.length > 0 && (
                <Command.Group heading="Audit" className={GROUP_HEADING}>
                  {audit.map((a) => (
                    <Command.Item
                      key={`audit-${a.id}`}
                      value={`audit-${a.id}`}
                      onSelect={() => go("/admin/audit")}
                      className={ITEM_BASE}
                    >
                      <ScrollText size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <span className="shrink-0 font-mono text-[11px] text-ink-muted">{a.action}</span>
                      <TruncateTooltip
                        text={`${a.entity_type}${a.entity_id ? ` · ${a.entity_id}` : ""}`}
                        className="flex-1 min-w-0 text-ink-faint"
                      />
                      <span className="shrink-0 text-[11px] text-ink-faint">{formatDateTime(a.created_at)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Actions — verbs (all in action mode; matched while searching) */}
              {showActions && (
                <Command.Group heading="Actions" className={GROUP_HEADING}>
                  {matchedActions.map((a) => (
                    <Command.Item
                      key={`action-${a.id}`}
                      value={`action-${a.id}`}
                      onSelect={() => runAction(a)}
                      className={ITEM_BASE}
                    >
                      {runningAction === a.id ? (
                        <Loader2 size={13} className="shrink-0 text-ink-faint animate-spin" />
                      ) : (
                        <a.icon size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      )}
                      <span className="flex-1">{a.label}</span>
                      {a.kind === "exec" && (
                        <span className="shrink-0 text-[10px] font-mono text-ink-faint">run</span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Help docs */}
              {docs.length > 0 && (
                <Command.Group heading="Help" className={GROUP_HEADING}>
                  {docs.map((d) => (
                    <Command.Item
                      key={`doc-${d.kind}-${d.slug}`}
                      value={`doc-${d.kind}-${d.slug}`}
                      onSelect={() => go(d.href)}
                      className={ITEM_BASE}
                    >
                      <BookOpen size={13} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
                      <TruncateTooltip text={d.title} className="flex-1 min-w-0" />
                      <span className="shrink-0 text-[11px] text-ink-faint">{d.group}</span>
                      <ArrowUpRight size={11} strokeWidth={1.75} className="shrink-0 text-ink-faint opacity-60" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Pages */}
              {filteredPages.length > 0 && (
                <Command.Group heading="Pages" className={GROUP_HEADING}>
                  {filteredPages.map((p) => (
                    <Command.Item
                      key={p.href}
                      value={`page-${p.href}`}
                      onSelect={() => go(p.href)}
                      className={ITEM_BASE}
                    >
                      <NavIcon name={p.icon} />
                      <span className="flex-1">{p.label}</span>
                      {p.shortcut && (
                        <kbd className="shrink-0 text-[10px] font-mono text-ink-faint border border-border rounded px-1.5 py-0.5 leading-none">
                          {p.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Review — the work queues (empty-state browse) */}
              {review.length > 0 && (
                <Command.Group heading="Review" className={GROUP_HEADING}>
                  {review.map((a) => (
                    <Command.Item
                      key={a.href}
                      value={`admin-${a.href}`}
                      onSelect={() => go(a.href)}
                      className={ITEM_BASE}
                    >
                      <NavIcon name={a.icon} />
                      <span className="flex-1">{a.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Vendors — the supply side (empty-state browse) */}
              {vendorNav.length > 0 && (
                <Command.Group heading="Vendors" className={GROUP_HEADING}>
                  {vendorNav.map((a) => (
                    <Command.Item
                      key={a.href}
                      value={`admin-${a.href}`}
                      onSelect={() => go(a.href)}
                      className={ITEM_BASE}
                    >
                      <NavIcon name={a.icon} />
                      <span className="flex-1">{a.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Settings — admin only, one entry per tab (empty-state browse) */}
              {settings.length > 0 && (
                <Command.Group heading="Settings" className={GROUP_HEADING}>
                  {settings.map((a) => (
                    <Command.Item
                      key={a.href}
                      value={`admin-${a.href}`}
                      onSelect={() => go(a.href)}
                      className={ITEM_BASE}
                    >
                      <NavIcon name={a.icon} />
                      <span className="flex-1">{a.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>

            {/* Footer hints — Ask Me has its own keyboard model, so it gets its
                own row rather than leaving stale hints on screen. */}
            {askMeOn ? (
              <div className="border-t border-border px-4 py-2 flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[10px] text-ink-faint font-mono">
                  <kbd className="border border-border rounded px-1 py-0.5 leading-none">↵</kbd>
                  pick
                </span>
                {askMe.state.cue?.slots[askMe.state.slotIndex]?.optional && (
                  <span className="flex items-center gap-1.5 text-[10px] text-ink-faint font-mono">
                    <kbd className="border border-border rounded px-1 py-0.5 leading-none">tab</kbd>
                    skip
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-[10px] text-ink-faint font-mono">
                  <kbd className="border border-border rounded px-1 py-0.5 leading-none">⌫</kbd>
                  back
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[10px] text-ink-faint font-mono">
                  <kbd className="border border-border rounded px-1 py-0.5 leading-none">esc</kbd>
                  {askMe.state.cue ? "back a step" : "leave ask me"}
                </span>
              </div>
            ) : (
            <div className="border-t border-border px-4 py-2 flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10px] text-ink-faint font-mono">
                <kbd className="border border-border rounded px-1 py-0.5 leading-none">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-ink-faint font-mono">
                <kbd className="border border-border rounded px-1 py-0.5 leading-none">↵</kbd>
                open
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-ink-faint font-mono">
                <kbd className="border border-border rounded px-1 py-0.5 leading-none">esc</kbd>
                close
              </span>
              <span className="ml-auto flex items-center gap-3 text-[10px] text-ink-faint font-mono">
                <span className="flex items-center gap-1.5">
                  <kbd className="border border-border rounded px-1 py-0.5 leading-none">:</kbd>
                  filter
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="border border-border rounded px-1 py-0.5 leading-none">&gt;</kbd>
                  actions
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="border border-border rounded px-1 py-0.5 leading-none">?</kbd>
                  ask
                </span>
                {/* Only advertised from an empty box, which is where it works. */}
                {!query && (
                  <span className="flex items-center gap-1.5">
                    <kbd className="border border-border rounded px-1 py-0.5 leading-none">tab</kbd>
                    ask me
                  </span>
                )}
              </span>
            </div>
            )}
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
