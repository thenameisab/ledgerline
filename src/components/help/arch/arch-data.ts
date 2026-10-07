/* -----------------------------------------------------------------------------
   Deterministic geometry + content for the Ledgerline architecture diagram.
   Everything is laid out on a fixed 900×576 coordinate grid so the SVG edge
   overlay can attach to exact node anchor points.
----------------------------------------------------------------------------- */

export type LaneId = "browser" | "edge" | "server" | "db" | "ext";
export type Side = "left" | "right" | "top" | "bottom";

export type ArchLane = {
  id: LaneId;
  label: string;
  sub: string;
  x: number;
  /** "r,g,b" — tint used for the node drop shadow glow. */
  glow: string;
};

export type ArchNode = {
  id: string;
  lane: LaneId;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  subMono?: boolean;
  chips?: string[];
  desc: string;
  files: string[];
};

export type ArchEdge = {
  id: string;
  from: string;
  to: string;
  fromSide: Side;
  toSide: Side;
  fromDy?: number;
  toDy?: number;
  fromDx?: number;
  toDx?: number;
  /** Bezier control-point reach. Defaults to distance-based. */
  k?: number;
};

export type FlowStep = {
  edges: { id: string; rev?: boolean }[];
  text: string;
};

export type Flow = {
  id: string;
  label: string;
  color: string;
  steps: FlowStep[];
};

export const ARCH_W = 900;
export const ARCH_H = 576;
export const LANE_W = 156;

export const LANES: ArchLane[] = [
  { id: "browser", label: "Browser", sub: "React 18", x: 20, glow: "117,170,255" },
  { id: "edge", label: "Edge", sub: "Access + middleware", x: 198, glow: "162,139,255" },
  { id: "server", label: "Server", sub: "Node serverless", x: 376, glow: "63,212,138" },
  { id: "db", label: "Database", sub: "Neon Postgres", x: 554, glow: "79,182,232" },
  { id: "ext", label: "External", sub: "Services", x: 732, glow: "240,122,184" },
];

export const NODES: ArchNode[] = [
  /* ── Browser ─────────────────────────────────────────────────────────── */
  {
    id: "ui",
    lane: "browser",
    x: 20, y: 64, w: LANE_W, h: 64,
    title: "React UI",
    sub: "RSC + account islands",
    desc:
      "Server-rendered pages hydrated with account islands — tables, filter bars, modals and wizards. framer-motion handles list transitions, nextjs-toploader paints navigation progress, and the Shell injects the sidebar for authenticated routes.",
    files: ["src/app/**/page.tsx", "src/components/Shell.tsx", "src/components/nav/SideNav.tsx"],
  },
  {
    id: "cmdk",
    lane: "browser",
    x: 20, y: 152, w: LANE_W, h: 56,
    title: "Command palette",
    sub: "⌘K · search · act · ask",
    desc:
      "⌘K opens a cmdk palette with three auto-detected modes. Search: debounced (180 ms) /api/search across accounts, invoices, groups, SKUs, manual entries, vendors and audit, with inline metadata. Act: run/jump to verbs (Refresh runs inline). Ask: /api/ask answers revenue/hits/unpriced, variance and relations inline — deterministic templates, optional LLM fallback off by default. /api/context scopes 'on this page' actions; recents persist in localStorage.",
    files: [
      "src/components/cmd/CommandPalette.tsx",
      "src/app/api/search/route.ts",
      "src/app/api/ask/route.ts",
      "src/app/api/context/route.ts",
    ],
  },
  {
    id: "charts",
    lane: "browser",
    x: 20, y: 232, w: LANE_W, h: 56,
    title: "Charts",
    sub: "recharts",
    desc:
      "recharts draws the dashboard — area revenue trends, call-status bars, activity heatmap and sparklines. All data arrives pre-aggregated from the server; the browser never queries the database directly.",
    files: [
      "src/components/RevenueChart.tsx",
      "src/components/charts/ApiStatusChart.tsx",
      "src/components/ActivityHeatmap.tsx",
    ],
  },
  {
    id: "toasts",
    lane: "browser",
    x: 20, y: 312, w: LANE_W, h: 56,
    title: "Toasts",
    sub: "sonner",
    desc:
      "sonner toasts (bottom-right) confirm server-action results — pricing saved, invoice finalized, invite sent — and surface error states when a guard or validation fails.",
    files: ["src/app/layout.tsx"],
  },

  /* ── Edge ────────────────────────────────────────────────────────────── */
  {
    id: "middleware",
    lane: "edge",
    x: 198, y: 64, w: LANE_W, h: 96,
    title: "middleware.ts",
    sub: "cookie probe · x-pathname",
    subMono: true,
    desc:
      "On the public demo, Cloudflare Access sits in front of the app: a visitor enters an email and a one-time code first. Then the Next.js middleware runs. It only checks that a session cookie exists (real authorization happens on the server in lib/access.ts), forwards x-pathname to the Shell, and lets /login, /api/auth, /api/cron and /api/warm through without a session.",
    files: ["src/middleware.ts"],
  },

  /* ── Server ──────────────────────────────────────────────────────────── */
  {
    id: "rsc",
    lane: "server",
    x: 376, y: 64, w: LANE_W, h: 52,
    title: "RSC pages",
    sub: "App Router",
    desc:
      "React Server Components fetch data at request time through the repo layer. The Shell guards the session before any page renders; pages await repo calls directly — no account-side fetch waterfall.",
    files: ["src/app/page.tsx", "src/app/accounts/[slug]/page.tsx", "src/components/Shell.tsx"],
  },
  {
    id: "routes",
    lane: "server",
    x: 376, y: 140, w: LANE_W, h: 52,
    title: "API routes",
    sub: "route handlers",
    desc:
      "Route handlers for reads, exports and integrations: palette search, ask and context, pricing, vendor cost, invoice PDF and CSV, the /api/cron/* routes, the refresh and backfill endpoints, the cache revalidate route, and the /api/warm ping.",
    files: ["src/app/api/**/route.ts", "src/app/api/cron/usage-sync/route.ts"],
  },
  {
    id: "actions",
    lane: "server",
    x: 376, y: 216, w: LANE_W, h: 52,
    title: "Server actions",
    sub: "“use server”",
    desc:
      "Many mutations are server actions: savePricingBatch, bundle create, update and delete, invoice finalize and issue, alert and reconciliation actions, and settings. Every action runs guardAction() for the role check, writes through the repos, and revalidates the affected paths so the UI refreshes.",
    files: [
      "src/app/accounts/[slug]/pricing/actions.ts",
      "src/app/accounts/[slug]/invoices/[period]/actions.ts",
      "src/app/admin/settings/actions.ts",
    ],
  },
  {
    id: "repos",
    lane: "server",
    x: 376, y: 296, w: LANE_W, h: 60,
    title: "Repos",
    sub: "lib/repos/* · postgres.js",
    subMono: true,
    desc:
      "The only SQL surface. Typed repo modules per domain (accounts, pricing, bundles, slab-revenue, statements, usage, users, audit, sync-runs) over a postgres.js pool — max 3 connections, cached on globalThis for warm lambdas, dates returned as ISO strings. Volume pricing (tiered or slab), which the per-day view can't price, is recomputed here at the period level.",
    files: ["src/lib/repos/*", "src/lib/db.ts"],
  },
  {
    id: "pdf",
    lane: "server",
    x: 376, y: 380, w: LANE_W, h: 52,
    title: "PDF renderer",
    sub: "@react-pdf",
    subMono: true,
    desc:
      "@react-pdf/renderer builds the statement as React components with self-hosted fonts. Two variants: internal (margin columns visible) and customer (clean, Ledgerline-branded). Rendered to a buffer and rate-limited to 10 PDFs per user per minute.",
    files: ["src/lib/pdf/StatementPdf.tsx", "src/app/api/invoices/[account]/[period]/pdf/route.ts"],
  },
  {
    id: "nextauth",
    lane: "server",
    x: 376, y: 456, w: LANE_W, h: 52,
    title: "NextAuth v5",
    sub: "Credentials (demo) · JWT",
    desc:
      "NextAuth v5 with JWT sessions. In this portfolio build sign-in is a dev-only Credentials provider that matches a seeded user by email (one-click Admin/Member); jwt() enriches the token with the user id and role from the users table; lib/access.ts layers requireSession, requireRole and guardAction on top.",
    files: ["src/auth.ts", "src/lib/access.ts", "src/app/api/auth/[...nextauth]/route.ts"],
  },

  /* ── Database ────────────────────────────────────────────────────────── */
  {
    id: "neon",
    lane: "db",
    x: 554, y: 64, w: LANE_W, h: 232,
    title: "Neon Postgres",
    sub: "table domains",
    chips: ["identity", "catalog", "pricing", "usage", "billing", "audit · sync"],
    desc:
      "Neon Postgres in the same region as the Vercel functions (an embedded Postgres when run locally). Pricing is temporal: the latest effective_from on or before the usage date wins. A re-sync of a date replaces that date's log rows, so it gives the same result. Invoice numbers come from a per-year invoice_sequence row incremented with an upsert. A nightly job reseeds the demo data.",
    files: ["migrations/0001_baseline.sql", "src/lib/db.ts", "scripts/seed-mock.ts"],
  },
  {
    id: "view",
    lane: "db",
    x: 554, y: 324, w: LANE_W, h: 64,
    title: "Revenue view",
    sub: "usage_daily_with_revenue",
    subMono: true,
    desc:
      "Derived view joining usage_daily to temporal pricing and vendor pricing — bundle-aware effective prices, unapproved manual entries filtered out. Returns revenue, vendor cost and margin per row; every KPI, chart and statement reads from it.",
    files: ["migrations/0001_baseline.sql (view definition)", "src/lib/repos/usage.ts"],
  },

  /* ── External ────────────────────────────────────────────────────────── */
  {
    id: "metabase",
    lane: "ext",
    x: 732, y: 64, w: LANE_W, h: 52,
    title: "Usage source",
    sub: "simulated in the demo",
    desc:
      "Where daily usage comes from. In the demo MOCK_INTEGRATIONS=true, so lib/usage-sync.ts generates each day's usage from the existing account and SKU pairs, and lib/metabase-vendor.ts derives the vendor side from local usage. No external call is made. With mocking off, lib/metabase.ts queries a Metabase instance one date at a time.",
    files: ["src/lib/usage-sync.ts", "src/lib/metabase.ts", "src/lib/metabase-vendor.ts"],
  },
  {
    id: "cron",
    lane: "ext",
    x: 732, y: 140, w: LANE_W, h: 52,
    title: "Nightly reset",
    sub: "reseed · revalidate",
    desc:
      "vercel.json declares no crons. A scheduled job outside the app reseeds the demo database each night and then calls POST /api/cache/revalidate with the CRON_SECRET bearer token to clear the cached revenue reads. The /api/cron/* routes accept the same token and can be called by hand.",
    files: ["src/app/api/cache/revalidate/route.ts", "src/app/api/cron/*/route.ts"],
  },
  {
    id: "email",
    lane: "ext",
    x: 732, y: 216, w: LANE_W, h: 52,
    title: "Email",
    sub: "Nodemailer · not sent in demo",
    desc:
      "Nodemailer sends invites, account-operation emails, revenue roundups, product updates and alert emails. The demo sets no mail credentials, so every send is skipped and logged. The cron routes return the email HTML with ?dry=1.",
    files: ["src/lib/email.ts", "src/lib/emails/"],
  },
  {
    id: "vercel",
    lane: "ext",
    x: 732, y: 292, w: LANE_W, h: 52,
    title: "Vercel",
    sub: "hosting · serverless",
    desc:
      "Hosts the app on the Hobby plan: middleware, serverless functions for RSC pages, routes and actions, and the environment variables. Cloudflare Access is in front of the public URL.",
    files: ["vercel.json"],
  },
];

export const EDGES: ArchEdge[] = [
  /* browser → edge */
  { id: "ui-mw", from: "ui", to: "middleware", fromSide: "right", toSide: "left", toDy: -16, k: 16 },
  /* edge → server fan-out */
  { id: "mw-rsc", from: "middleware", to: "rsc", fromSide: "right", toSide: "left", fromDy: -22, k: 14 },
  { id: "mw-routes", from: "middleware", to: "routes", fromSide: "right", toSide: "left", fromDy: 8, toDy: -12, k: 18 },
  { id: "mw-actions", from: "middleware", to: "actions", fromSide: "right", toSide: "left", fromDy: 30, toDy: -12, k: 22 },
  { id: "mw-auth", from: "middleware", to: "nextauth", fromSide: "bottom", toSide: "left", fromDx: -4, k: 90 },
  /* server intra-lane → repos hub */
  { id: "rsc-repos", from: "rsc", to: "repos", fromSide: "left", toSide: "left", fromDy: 16, toDy: -18, k: 20 },
  { id: "routes-repos", from: "routes", to: "repos", fromSide: "left", toSide: "left", fromDy: 16, toDy: -6, k: 15 },
  { id: "actions-repos", from: "actions", to: "repos", fromSide: "left", toSide: "left", fromDy: 16, toDy: 6, k: 11 },
  { id: "routes-pdf", from: "routes", to: "pdf", fromSide: "right", toSide: "right", fromDy: 20, toDy: -12, k: 17 },
  /* server → database */
  { id: "repos-neon", from: "repos", to: "neon", fromSide: "right", toSide: "left", fromDy: -8, toDy: 60, k: 30 },
  { id: "repos-view", from: "repos", to: "view", fromSide: "right", toSide: "left", fromDy: 14, k: 24 },
  { id: "routes-neon", from: "routes", to: "neon", fromSide: "right", toSide: "left", fromDy: 4, toDy: -60, k: 34 },
  { id: "auth-neon", from: "nextauth", to: "neon", fromSide: "right", toSide: "left", toDy: 100, k: 50 },
  { id: "neon-view", from: "neon", to: "view", fromSide: "bottom", toSide: "top", k: 12 },
  /* server ↔ external */
  { id: "routes-mb", from: "routes", to: "metabase", fromSide: "right", toSide: "left", fromDy: -16, k: 80 },
  { id: "cron-routes", from: "cron", to: "routes", fromSide: "left", toSide: "right", toDy: -4, k: 60 },
  { id: "actions-email", from: "actions", to: "email", fromSide: "right", toSide: "left", fromDy: 8, k: 80 },
  /* browser intra-lane */
  { id: "ui-charts", from: "ui", to: "charts", fromSide: "left", toSide: "left", fromDy: 18, toDy: -12, k: 14 },
  { id: "ui-toasts", from: "ui", to: "toasts", fromSide: "left", toSide: "left", fromDy: -2, k: 20 },
  { id: "cmdk-routes", from: "cmdk", to: "routes", fromSide: "right", toSide: "left", k: 60 },
];

export const FLOWS: Flow[] = [
  {
    id: "pageload",
    label: "Page load",
    color: "#75AAFF",
    steps: [
      {
        edges: [{ id: "ui-mw" }],
        text: "You open / — the edge middleware probes the session cookie and forwards x-pathname downstream.",
      },
      {
        edges: [{ id: "mw-rsc" }],
        text: "The dashboard renders as a React Server Component, guarded by getSessionUser().",
      },
      {
        edges: [{ id: "rsc-repos" }],
        text: "The page awaits getKpis, getDailySeries and getRiskSummary from lib/repos.",
      },
      {
        edges: [{ id: "repos-view" }, { id: "neon-view" }],
        text: "Repos aggregate over usage_daily_with_revenue — usage joined to temporal pricing at query time.",
      },
      {
        edges: [{ id: "mw-rsc", rev: true }, { id: "ui-mw", rev: true }],
        text: "Rendered HTML streams back through the edge and hydrates in the browser.",
      },
      {
        edges: [{ id: "ui-charts" }],
        text: "recharts paints the KPI tiles, area charts and movers from the server-fetched data.",
      },
    ],
  },
  {
    id: "signin",
    label: "Sign-in",
    color: "#A28BFF",
    steps: [
      {
        edges: [{ id: "ui-mw" }],
        text: "From /login you click “Enter as Admin” (or Member) — the form POSTs to NextAuth’s demo Credentials provider.",
      },
      {
        edges: [{ id: "mw-auth" }],
        text: "The Credentials authorize() callback runs on NextAuth at /api/auth/callback/demo.",
      },
      {
        edges: [{ id: "auth-neon" }],
        text: "authorize() looks up the seeded user by email and only admits an active users row.",
      },
      {
        edges: [{ id: "auth-neon", rev: true }],
        text: "jwt() enriches the token with the user’s id and role straight from the users table.",
      },
      {
        edges: [{ id: "mw-auth", rev: true }, { id: "ui-mw", rev: true }],
        text: "An httpOnly JWT session cookie is set and you’re redirected to the dashboard.",
      },
    ],
  },
  {
    id: "sync",
    label: "Usage refresh",
    color: "#4FE19E",
    steps: [
      {
        edges: [{ id: "ui-mw" }, { id: "mw-routes" }],
        text: "An admin clicks Refresh now, which posts to /api/sync/refresh.",
      },
      {
        edges: [{ id: "routes-mb" }],
        text: "syncDate() gets one day of usage per date. In the demo the pull is simulated from existing usage.",
      },
      {
        edges: [{ id: "routes-mb", rev: true }],
        text: "Accounts resolve by name and log_aliases, SKUs by SKU code. Unmapped rows are kept with a NULL id and counted.",
      },
      {
        edges: [{ id: "routes-neon" }],
        text: "One transaction deletes the day’s source='log' rows and re-inserts in chunks of 500; sync_runs records the outcome.",
      },
      {
        edges: [{ id: "neon-view" }],
        text: "usage_daily_with_revenue picks the fresh rows up instantly — there is no rebuild step.",
      },
    ],
  },
  {
    id: "pricing",
    label: "Pricing edit",
    color: "#E3B341",
    steps: [
      {
        edges: [{ id: "ui-mw" }, { id: "mw-actions" }],
        text: "An admin or editor saves prices on /accounts/[slug]/pricing. The form calls the savePricingBatch server action.",
      },
      {
        edges: [{ id: "actions-repos" }],
        text: "guardAction('pricing.edit') checks the role before any write happens.",
      },
      {
        edges: [{ id: "repos-neon" }],
        text: "New pricing rows insert with today’s effective_from; recordAudit() logs before/after JSON to audit_log.",
      },
      {
        edges: [{ id: "neon-view" }],
        text: "The revenue view now resolves the latest price ≤ each usage date — history stays intact, finalized statements untouched.",
      },
      {
        edges: [{ id: "mw-actions", rev: true }, { id: "ui-mw", rev: true }, { id: "ui-toasts" }],
        text: "revalidatePath() refreshes the cached pages and a toast confirms the save.",
      },
    ],
  },
  {
    id: "invoicepdf",
    label: "Invoice PDF",
    color: "#F07AB8",
    steps: [
      {
        edges: [{ id: "ui-mw" }, { id: "mw-routes" }],
        text: "“Download PDF” calls /api/invoices/[account]/[period]/pdf — rate-limited to 10 per user per minute.",
      },
      {
        edges: [{ id: "routes-repos" }],
        text: "deriveStatement() recomputes line items, totals and adjustments fresh — prices as of render time.",
      },
      {
        edges: [{ id: "repos-view" }],
        text: "Per-SKU sums, bundle-aware prices and credit notes come back as StatementData.",
      },
      {
        edges: [{ id: "routes-pdf" }],
        text: "@react-pdf renders the Ledgerline-branded StatementPdf to a buffer with self-hosted fonts.",
      },
      {
        edges: [{ id: "mw-routes", rev: true }, { id: "ui-mw", rev: true }],
        text: "The binary streams back with an inline or attachment Content-Disposition.",
      },
    ],
  },
];
