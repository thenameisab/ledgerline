// The one nav model.
//
// SideNav, the command palette's destination list, its ⌘-shortcut hints and
// KeyboardShortcuts all read this file, so a rename or a role rule is applied
// once.
//
// The admin surfaces split by what a thing *is*:
//
//   Review    work queues. Each one has an open count and is done when the
//             count is zero. Editors own most of them.
//   Vendors   the supply side of the book: who serves our calls, what they
//             charge, and whether their numbers agree with ours. It was split
//             across a Settings tab and a Review queue, which put the two
//             halves of one subject in two places and called the rate card a
//             setting. A vendor is an entity with pages, like an account.
//   Settings  configuration that persists. One nav entry, one tabbed page,
//             admin only.
//
// Icons are named, not imported, because SideNav is a server component and a
// component reference can't cross into SideNavItem as a prop.

import {
  LayoutDashboard,
  Users,
  Boxes,
  Truck,
  Unlink,
  UserCog,
  FileEdit,
  Settings2,
  HelpCircle,
  ScrollText,
  RefreshCw,
  ListChecks,
  FlaskConical,
  ShieldCheck,
  CircleDollarSign,
  Mail,
  Scale,
  BellRing,
  type LucideIcon,
} from "lucide-react";

/** Restated from lib/repos/users so client components can import it too. */
export type Role = "admin" | "editor" | "member";

export const ICONS = {
  LayoutDashboard,
  Users,
  Boxes,
  Truck,
  Unlink,
  UserCog,
  FileEdit,
  Settings2,
  HelpCircle,
  ScrollText,
  RefreshCw,
  ListChecks,
  FlaskConical,
  ShieldCheck,
  CircleDollarSign,
  Mail,
  Scale,
  BellRing,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export type NavEntry = {
  label: string;
  href: string;
  icon: IconName;
  /** ⌘-number hint. Only the Main section carries these. */
  shortcut?: string;
  /** Roles that may open the target. Omit for "everyone". */
  roles?: Role[];
  /** Which count from getReviewCounts() renders as this row's badge. */
  count?: "aliases" | "apiReview" | "unpriced" | "approvals" | "alerts";
  /**
   * Sub-paths that belong to a sibling row. "Vendors" owns everything under
   * /vendors except the Reconciliation row's own page, which sits beside it.
   */
  excludePaths?: string[];
};

const EDITS: Role[] = ["admin", "editor"];
const ADMIN: Role[] = ["admin"];

// ── Main ─────────────────────────────────────────────────────────────────────

const MAIN: NavEntry[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", shortcut: "⌘1" },
  { label: "Accounts", href: "/accounts", icon: "Users", shortcut: "⌘2" },
  { label: "SKUs", href: "/skus", icon: "Boxes", shortcut: "⌘3" },
  { label: "Manual entries", href: "/admin/manual-entries", icon: "FileEdit", shortcut: "⌘4", roles: EDITS },
];

// ── Review ───────────────────────────────────────────────────────────────────
//
// Queues, in the order billing depends on them: a usage row needs a name, then
// a code, then a price; sandbox decides whether it bills at all; approvals
// gate the account edits an editor filed.
//
// Alerts comes first: it is the queue that says something changed today.

const REVIEW: NavEntry[] = [
  { label: "Alerts", href: "/alerts", icon: "BellRing", roles: EDITS, count: "alerts" },
  { label: "Aliases", href: "/admin/aliases", icon: "Unlink", roles: EDITS, count: "aliases" },
  { label: "SKU review", href: "/admin/sku-review", icon: "ListChecks", roles: EDITS, count: "apiReview" },
  { label: "Unpriced", href: "/admin/pricing", icon: "CircleDollarSign", roles: ADMIN, count: "unpriced" },
  { label: "Sandbox billing", href: "/admin/sandbox", icon: "FlaskConical", roles: EDITS },
  { label: "Approvals", href: "/admin/approvals", icon: "ShieldCheck", roles: ADMIN, count: "approvals" },
];

// ── Vendors ──────────────────────────────────────────────────────────────────
//
// Two rows for one subject. The list is the way in to a vendor's own pages —
// its rate card, its minimum, and its reconciliation — the way /accounts is
// the way in to an account's. Reconciliation keeps a row of its own because
// the per-vendor tab answers "what is wrong with this one" and the queue
// answers "which one do I look at first" across every vendor at once.
//
// Reconciliation carries no badge, for the reason it never did in Review: the
// open-item count is a systemic figure, not a to-do list. One attribution
// problem can produce many items, and a standing count would read as that many
// forgotten tasks.

const VENDORS: NavEntry[] = [
  {
    label: "Vendors",
    href: "/vendors",
    icon: "Truck",
    roles: ADMIN,
    excludePaths: ["/vendors/reconciliation"],
  },
  { label: "Reconciliation", href: "/vendors/reconciliation", icon: "Scale", roles: ADMIN },
];

// ── Settings ─────────────────────────────────────────────────────────────────
//
// One sidebar entry pointing at the first tab. The tabs keep their own routes
// so every existing link, palette entry and notification deep-link still
// lands where it did.

export const SETTINGS_ROOT = "/admin/settings";

export const SETTINGS_TABS: NavEntry[] = [
  { label: "Emails", href: "/admin/settings", icon: "Mail", roles: ADMIN },
  { label: "Alerts", href: "/admin/settings/alerts", icon: "BellRing", roles: ADMIN },
  { label: "Users", href: "/admin/users", icon: "UserCog", roles: ADMIN },
  { label: "Data & sync", href: "/admin/sync", icon: "RefreshCw", roles: ADMIN },
  { label: "Audit log", href: "/admin/audit", icon: "ScrollText", roles: ADMIN },
];

export const SETTINGS_ENTRY: NavEntry = {
  label: "Settings",
  href: SETTINGS_ROOT,
  icon: "Settings2",
  roles: ADMIN,
};

export const HELP_ENTRY: NavEntry = {
  label: "Help & docs",
  href: "/help",
  icon: "HelpCircle",
};

/** Reachable from the palette but not worth a sidebar row of its own. */
export const CHANGELOG_ENTRY: NavEntry = {
  label: "Changelog",
  href: "/help/changelog",
  icon: "ScrollText",
};

// ── Selectors ────────────────────────────────────────────────────────────────

function visible(entries: NavEntry[], role: Role | undefined): NavEntry[] {
  return entries.filter((e) => e.roles === undefined || (role !== undefined && e.roles.includes(role)));
}

export function mainNav(role?: Role): NavEntry[] {
  return visible(MAIN, role);
}

export function reviewNav(role?: Role): NavEntry[] {
  return visible(REVIEW, role);
}

export function vendorsNav(role?: Role): NavEntry[] {
  return visible(VENDORS, role);
}

/**
 * The tab strip on one vendor's pages. Built here rather than in the component
 * so the vendor section has one source like every other part of the nav.
 */
export function vendorTabs(vendor: string): { label: string; href: string }[] {
  const base = `/vendors/${encodeURIComponent(vendor)}`;
  return [
    { label: "Rate card", href: base },
    { label: "Reconciliation", href: `${base}/reconciliation` },
  ];
}

export function settingsTabs(role?: Role): NavEntry[] {
  return visible(SETTINGS_TABS, role);
}

/** True when the path is one of the Settings tabs (drives the sidebar's active state). */
export function isSettingsPath(path: string): boolean {
  return SETTINGS_TABS.some((t) => path.startsWith(t.href));
}

/** ⌘1–⌘4 → href. Derived so the hint can't outlive the route. */
export function shortcutMap(role?: Role): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of mainNav(role)) {
    if (e.shortcut) map[e.shortcut.replace("⌘", "")] = e.href;
  }
  return map;
}
