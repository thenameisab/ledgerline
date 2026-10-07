// Filtered destinations ("views") the palette can jump to.
//
// Every list page in Ledgerline already accepts filter params — /accounts?bucket=,
// /apis?filter=, /admin/manual-entries?status=, /admin/audit?user= — but until
// now the palette could only
// reach the *unfiltered* page. So "leaking accounts" or "pending entries" were
// two navigations away from a box that already knew what you meant.
//
// A view is just a label + a href. No new SQL, no new state: the target page
// does the filtering it always did. Two kinds:
//   - static   a fixed filter worth naming ("Accounts with revenue leak")
//   - derived  built from a parsed operator (month:june → accounts in June),
//              so the grammar and the views compose
//
// Roles mirror the target route's guard, same rule as cmd/actions.ts.

import {
  AlertTriangle,
  History,
  TrendingUp,
  TrendingDown,
  MoonStar,
  Clock,
  FileEdit,
  CheckCircle2,
  Ban,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/components/cmd/actions";
import type { ParsedQuery } from "@/lib/cmd/query";
import { resolveMonth } from "@/lib/cmd/terms";

export type CmdView = {
  id: string;
  label: string;
  /** Extra words that should match this view; the label is matched too. */
  keywords: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[];
};

const EDITS: Role[] = ["admin", "editor"];
const ADMIN: Role[] = ["admin"];
// Views whose numbers come from vendor cost. Kept in step with canViewCost()
// in lib/access.ts — a palette entry that lands on a page with an empty column
// is worse than no entry.
const COST: Role[] = ["admin", "editor"];

// ── Static views ─────────────────────────────────────────────────────────────

const LIST_VIEWS: CmdView[] = [
  {
    id: "view-leak",
    label: "Accounts with revenue leak",
    keywords: "leak leaking unpriced money at risk urgent losing",
    href: "/accounts?bucket=leak",
    icon: AlertTriangle,
  },
  {
    id: "view-historical",
    label: "Accounts with historical unpriced hits",
    keywords: "historical backdated was unpriced fixed since dismissible",
    href: "/accounts?bucket=historical",
    icon: History,
  },
  {
    id: "view-apis-high-volume",
    label: "High-volume APIs",
    keywords: "busiest most used top traffic hits volume",
    href: "/skus?filter=high-volume",
    icon: TrendingUp,
  },
  {
    // The page computes this from cost — see COST above.
    id: "view-apis-low-margin",
    label: "Low-margin APIs",
    keywords: "thin margin unprofitable cost expensive",
    href: "/skus?filter=low-margin",
    icon: TrendingDown,
    roles: COST,
  },
  {
    id: "view-apis-inactive",
    label: "Inactive APIs",
    keywords: "unused dormant zero traffic no hits dead",
    href: "/skus?filter=inactive",
    icon: MoonStar,
  },
];

const ENTRY_VIEWS: CmdView[] = [
  {
    id: "view-entries-pending",
    label: "Manual entries awaiting approval",
    keywords: "pending approval review queue waiting unapproved",
    href: "/admin/manual-entries?status=pending_approval",
    icon: Clock,
    roles: EDITS,
  },
  {
    id: "view-entries-draft",
    label: "Draft manual entries",
    keywords: "draft unfinished wip incomplete",
    href: "/admin/manual-entries?status=draft",
    icon: FileEdit,
    roles: EDITS,
  },
  {
    id: "view-entries-approved",
    label: "Approved manual entries",
    keywords: "approved signed off done",
    href: "/admin/manual-entries?status=approved",
    icon: CheckCircle2,
    roles: EDITS,
  },
  {
    id: "view-entries-void",
    label: "Void manual entries",
    keywords: "void cancelled voided discarded",
    href: "/admin/manual-entries?status=void",
    icon: Ban,
    roles: EDITS,
  },
];

export const ALL_VIEWS: CmdView[] = [
  ...LIST_VIEWS,
  ...ENTRY_VIEWS,
];

// ── Derived views ────────────────────────────────────────────────────────────

/**
 * Views implied by the operators in a query: `month:` re-ranges the accounts
 * list to that billing period, and `user:` opens the audit trail for that user.
 */
export function derivedViews(parsed: ParsedQuery): CmdView[] {
  const out: CmdView[] = [];
  const { filters } = parsed;

  if (filters.month) {
    const m = resolveMonth(filters.month);
    if (m) {
      // A month means "bill that period", so it re-ranges the accounts list.
      out.push({
        id: `view-accounts-${m.month}`,
        label: `Accounts in ${m.label}`,
        keywords: `period billing month ${m.month}`,
        href: `/accounts?month=${m.month}`,
        icon: Users,
      });
    }
  }

  if (filters.user) {
    out.push({
      id: `view-audit-${filters.user}`,
      label: `Audit trail for “${filters.user}”`,
      keywords: `audit who changed by ${filters.user}`,
      href: `/admin/audit?user=${encodeURIComponent(filters.user)}`,
      icon: ScrollText,
      roles: ADMIN,
    });
  }

  return out;
}

/**
 * Static views matching the free text, plus every derived view. Scoped to the
 * role so a view whose target route would redirect never shows.
 *
 * `status:` is matched against the static views' keywords rather than handled
 * separately, so "status:pending" surfaces the pending manual entries.
 */
export function matchViews(
  parsed: ParsedQuery,
  opts: { role: Role; fuzzy: (views: CmdView[], q: string) => CmdView[] }
): CmdView[] {
  const { role, fuzzy } = opts;
  const visible = (v: CmdView) => !v.roles || v.roles.includes(role);

  const derived = derivedViews(parsed).filter(visible);

  // Free text (or a status/type operator) matches the static set.
  const term = [parsed.text, parsed.filters.status, parsed.filters.type]
    .filter(Boolean)
    .join(" ")
    .trim();
  const statics = term ? fuzzy(ALL_VIEWS.filter(visible), term) : [];

  // Derived first — an explicit operator is a stronger signal than a word match.
  const seen = new Set(derived.map((v) => v.id));
  return [...derived, ...statics.filter((v) => !seen.has(v.id))].slice(0, 6);
}
