// Command palette actions — the verbs.
//
// Global (non-contextual) actions the palette can run or jump to. Two kinds:
//   - "nav"  navigates to the page/form that *is* the affordance (a real form
//            page, an admin tool, or a list page that auto-opens its create
//            modal via ?new=1). We only list complete affordances — never a
//            page where the user still has to hunt for the button.
//   - "exec" runs inline from the palette (handled by id in CommandPalette).
//
// `roles` mirrors the server permission policy in lib/access.ts: each entry
// lists the roles whose `can()` result is true for the action the target route
// guards on. It's a UX gate only — every target route/API enforces the real
// check — but it has to stay in sync, or the palette offers a verb that lands
// on a redirect. lib/access.ts is server-only, so the policy is restated here
// rather than imported.

import {
  RefreshCw,
  PlusCircle,
  CalendarPlus,
  UserPlus,
  DollarSign,
  Link2,
  ListChecks,
  Users,
  Building2,
  FlaskConical,
  ShieldCheck,
  ScrollText,
  Settings2,
  type LucideIcon,
} from "lucide-react";

export type Role = "admin" | "editor" | "member";

const ADMIN: Role[] = ["admin"];
// Mirrors EDITOR_ACTIONS in lib/access.ts — the Review queues an editor owns
// alongside admins.
const EDITS: Role[] = ["admin", "editor"];

export type CmdAction = {
  id: string;
  label: string;
  keywords?: string;
  icon: LucideIcon;
  roles: Role[];
  kind: "nav" | "exec";
  href?: string; // for kind: "nav"
};

export const ACTIONS: CmdAction[] = [
  // ── Inline exec ─────────────────────────────────────────────────────────
  {
    id: "refresh-usage",
    label: "Refresh usage data",
    keywords: "sync metabase pull update",
    icon: RefreshCw,
    roles: ADMIN,
    kind: "exec",
  },

  // ── Create flows (real form page or auto-opening modal) ─────────────────
  {
    id: "create-manual-entry",
    label: "Create manual entry",
    keywords: "add off-stream usage adjustment bulk",
    icon: PlusCircle,
    roles: EDITS,
    kind: "nav",
    href: "/admin/manual-entries/new",
  },
  {
    id: "create-account",
    label: "Create account",
    keywords: "add new customer client",
    icon: Users,
    roles: EDITS,
    kind: "nav",
    href: "/accounts?new=1",
  },
  {
    id: "create-group",
    label: "Create group",
    keywords: "add new group billing parent",
    icon: Building2,
    roles: EDITS,
    kind: "nav",
    href: "/accounts/groups?new=1",
  },

  // ── Review queues (admin + editor) ──────────────────────────────────────
  {
    id: "resolve-aliases",
    label: "Resolve aliases",
    keywords: "unmapped log names mapping",
    icon: Link2,
    roles: EDITS,
    kind: "nav",
    href: "/admin/aliases",
  },
  {
    id: "review-api-catalog",
    label: "Review API catalog",
    keywords: "api review codes drift accept",
    icon: ListChecks,
    roles: EDITS,
    kind: "nav",
    href: "/admin/sku-review",
  },
  {
    id: "price-unpriced-pairs",
    label: "Price unpriced APIs",
    keywords: "unpriced missing price gap leak zero rate account api pair",
    icon: DollarSign,
    roles: ADMIN,
    kind: "nav",
    href: "/admin/pricing?filter=unpriced",
  },
  {
    id: "sandbox-billing",
    label: "Set sandbox billing rules",
    keywords: "sandbox test uat cap free non-billable include exclude reports default",
    icon: FlaskConical,
    roles: EDITS,
    kind: "nav",
    href: "/admin/sandbox",
  },
  {
    id: "review-approvals",
    label: "Review approvals",
    keywords: "pending merge delete request maker checker reverse",
    icon: ShieldCheck,
    roles: ADMIN,
    kind: "nav",
    href: "/admin/approvals",
  },

  // ── Settings (admin only — the page is the tool) ────────────────────────
  {
    id: "backfill-usage",
    label: "Backfill usage",
    keywords: "sync import date range historical metabase",
    icon: CalendarPlus,
    roles: ADMIN,
    kind: "nav",
    href: "/admin/sync",
  },
  {
    id: "invite-user",
    label: "Invite user",
    keywords: "add team member admin role editor",
    icon: UserPlus,
    roles: ADMIN,
    kind: "nav",
    href: "/admin/users",
  },
  {
    id: "set-vendor-cost",
    label: "Set vendor cost",
    keywords: "vendor pricing cost margin",
    icon: DollarSign,
    roles: ADMIN,
    kind: "nav",
    href: "/vendors",
  },
  {
    id: "open-audit-log",
    label: "Open audit log",
    keywords: "audit history who changed trail",
    icon: ScrollText,
    roles: ADMIN,
    kind: "nav",
    href: "/admin/audit",
  },
  {
    id: "email-settings",
    label: "Manage email digests",
    keywords: "settings configuration roundup product update recipients email daily weekly monthly",
    icon: Settings2,
    roles: ADMIN,
    kind: "nav",
    href: "/admin/settings",
  },
];
