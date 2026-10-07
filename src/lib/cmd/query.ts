// Command palette query grammar.
//
// One parser for the whole palette, shared by the client (which renders the
// operator chips and decides what to show) and the server (which scopes each
// corpus). Keeping it in one place means "what does this query mean" has
// one answer.
//
// The grammar is deliberately small — operators people already know from GitHub
// and Linear, nothing invented:
//
//   plain text            fuzzy/token match, as before
//   field:value           scope to a field    → account:acme  status:pending
//   is:value              alias for status:   → is:pending
//   @name                 alias for account:  → @acme
//   #CODE                 alias for api:      → #KY1001
//   -word                 exclude a term      → acme -sandbox
//   >verb                 action mode         (unchanged)
//   ?question             ask mode            (unchanged)
//
// A quoted value keeps its spaces: account:"northwind finance". Everything else is
// whitespace-delimited.

export type CmdMode = "search" | "action" | "ask";

export const FILTER_FIELDS = [
  "account",
  "api",
  "group",
  "status",
  "month",
  "user",
  "type",
] as const;

export type FilterField = (typeof FILTER_FIELDS)[number];
export type CmdFilters = Partial<Record<FilterField, string>>;

// Field aliases. The left side is what someone types; the right is canonical.
// `is:` and `in:` read naturally inline ("is:pending", "in:june") and cost
// nothing to support.
const FIELD_ALIASES: Record<string, FilterField> = {
  account: "account",
  acct: "account",
  client: "account",
  api: "api",
  code: "api",
  group: "group",
  parent: "group",
  status: "status",
  is: "status",
  state: "status",
  month: "month",
  period: "month",
  in: "month",
  user: "user",
  by: "user",
  who: "user",
  type: "type",
  only: "type",
};

export type ParsedQuery = {
  raw: string;
  mode: CmdMode;
  /** Free text with every operator stripped — what the fuzzy matchers see. */
  text: string;
  filters: CmdFilters;
  /** Bare `-term` exclusions, applied to free-text matching. */
  excludes: string[];
  /** True when at least one operator was recognised (drives the chip row). */
  hasOperators: boolean;
};

// Splits on whitespace but keeps "quoted phrases" together, including when the
// quote follows a field prefix (account:"northwind finance" — the common case, since
// that's the whole reason to quote). Returns tokens with quotes removed, so the
// field:value split downstream works the same either way.
function tokenize(s: string): string[] {
  const out: string[] = [];
  const re = /([^\s:"]+:)?"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[2] !== undefined) out.push(`${m[1] ?? ""}${m[2]}`);
    else out.push(m[3]);
  }
  return out;
}

// A query is a question when it's explicitly marked ("?"), opens with a
// question word, or carries a metric/intent signal ("revenue", "hits",
// "unpriced", "using"…). Action mode (">") always wins. Plain entity names
// (no signal) stay as search so jumping isn't hijacked.
//
// Runs on the free text only, so `type:invoice` doesn't read as a question just
// because it mentions an entity we happen to bill.
export function isAskText(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t) return false;
  if (t.startsWith("?") || t.endsWith("?")) return true;
  if (/^(how |what'?s? |which |why |who |top \d)/.test(t)) return true;
  if (/\b(revenue|bill|billed|billing|margin|hits|usage|unpriced|using|uses|consume|apis? used|accounts? using)\b/.test(t)) return true;
  return false;
}

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();

  // Action mode short-circuits: everything after ">" is a verb, not a query.
  if (trimmed.startsWith(">")) {
    return {
      raw,
      mode: "action",
      text: trimmed.slice(1).trim(),
      filters: {},
      excludes: [],
      hasOperators: false,
    };
  }

  const filters: CmdFilters = {};
  const excludes: string[] = [];
  const free: string[] = [];

  for (const token of tokenize(trimmed)) {
    // field:value — first writer wins, so a later duplicate can't silently
    // override what the user already narrowed to.
    const colon = token.indexOf(":");
    if (colon > 0) {
      const field = FIELD_ALIASES[token.slice(0, colon).toLowerCase()];
      const value = token.slice(colon + 1).trim();
      if (field && value) {
        if (filters[field] === undefined) filters[field] = value;
        continue;
      }
    }

    // @account / #api sigils. A bare "@" or "#" is just text.
    if (token.length > 1 && (token[0] === "@" || token[0] === "#")) {
      const field: FilterField = token[0] === "@" ? "account" : "api";
      if (filters[field] === undefined) filters[field] = token.slice(1);
      continue;
    }

    // -exclude. Guarded on length so a lone "-" and negative numbers don't
    // become exclusions.
    if (token.length > 1 && token[0] === "-" && !/^-\d/.test(token)) {
      excludes.push(token.slice(1).toLowerCase());
      continue;
    }

    free.push(token);
  }

  // A leading "?" is an ask marker, not part of the term.
  let text = free.join(" ");
  const askMarked = text.startsWith("?") || trimmed.startsWith("?");
  if (text.startsWith("?")) text = text.slice(1).trim();

  const hasOperators = Object.keys(filters).length > 0 || excludes.length > 0;

  // Operators mean "narrow a list", not "answer a number" — so a query that
  // uses them stays in search even if it also mentions a metric word. Without
  // this, `status:pending revenue` would flip to ask and drop the filter.
  const mode: CmdMode = askMarked || (!hasOperators && isAskText(text)) ? "ask" : "search";

  return { raw, mode, text, filters, excludes, hasOperators };
}

/** Human label for a filter chip. */
export function filterLabel(field: FilterField, value: string): string {
  return `${field}:${value}`;
}

/**
 * Drop one operator from a raw query string — powers the chip's dismiss.
 * Re-parsing the remainder is the caller's job.
 */
export function removeFilter(raw: string, field: FilterField): string {
  return tokenize(raw.trim())
    .filter((token) => {
      const colon = token.indexOf(":");
      if (colon > 0 && FIELD_ALIASES[token.slice(0, colon).toLowerCase()] === field) return false;
      if (token.length > 1 && token[0] === "@" && field === "account") return false;
      if (token.length > 1 && token[0] === "#" && field === "api") return false;
      return true;
    })
    .join(" ");
}

/** Case-insensitive "does this row survive the -exclusions" test. */
export function passesExcludes(haystack: string, excludes: string[]): boolean {
  if (!excludes.length) return true;
  const h = haystack.toLowerCase();
  return !excludes.some((x) => h.includes(x));
}
