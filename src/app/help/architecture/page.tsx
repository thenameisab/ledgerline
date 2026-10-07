import type { Metadata } from "next";
import { DocPage, RailCard, RailLinks } from "@/components/help/DocPage";
import {
  Callout,
  CodeBlock,
  FilePath,
  H2,
} from "@/components/help/doc";
import { ArchitectureDiagram } from "@/components/help/arch/ArchitectureDiagram";

export const metadata: Metadata = { title: "Architecture" };

export default function ArchitecturePage() {
  return (
    <DocPage
      title="Architecture"
      rail={
        <RailCard title="Related">
          <RailLinks
            links={[
              { href: "/help/api", label: "API reference" },
              { href: "/help/math", label: "Mathematics" },
              { href: "/help/guides", label: "How-to guides" },
              { href: "/help/built-with-claude-code", label: "Built with Claude Code" },
            ]}
          />
        </RailCard>
      }
      lede={
        <>
          How a request moves through Ledgerline: from the browser, through
          Cloudflare Access and the Next.js middleware, to the server code on
          Vercel and the Neon Postgres database. In the public demo the usage
          source is simulated and email does not send. Select a flow in the
          diagram to trace it step by step.
        </>
      }
      hero={<ArchitectureDiagram />}
    >
      <H2 id="layers">Layers</H2>
      <p>
        Ledgerline is one Next.js 14 application (App Router, React 18) with
        one Postgres database. There is no separate API service and no queue.
        Revenue reads are cached with the Next.js data cache. The diagram has
        five lanes:
      </p>
      <table>
        <thead>
          <tr>
            <th>Lane</th>
            <th>What runs there</th>
            <th>Key code</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Browser</strong>
            </td>
            <td>
              Server-rendered pages with client components: tables, filter
              bars, modals, the ⌘K command palette, recharts charts, sonner
              toasts.
            </td>
            <td>
              <FilePath>src/components/</FilePath>
            </td>
          </tr>
          <tr>
            <td>
              <strong>Edge</strong>
            </td>
            <td>
              Cloudflare Access in front of the public URL, then one Next.js
              middleware that checks for a session cookie and forwards the
              pathname. The middleware is not a security boundary.
            </td>
            <td>
              <FilePath>src/middleware.ts</FilePath>
            </td>
          </tr>
          <tr>
            <td>
              <strong>Server</strong>
            </td>
            <td>
              RSC pages, API route handlers, server actions, NextAuth, the repo
              layer, and the PDF renderer. All run as Vercel serverless
              functions.
            </td>
            <td>
              <FilePath>src/app/</FilePath>, <FilePath>src/lib/</FilePath>
            </td>
          </tr>
          <tr>
            <td>
              <strong>Database</strong>
            </td>
            <td>
              Neon Postgres: the tables in the baseline schema and the{" "}
              <code>usage_daily_with_revenue</code> view that revenue numbers
              come from.
            </td>
            <td>
              <FilePath>migrations/0001_baseline.sql</FilePath>
            </td>
          </tr>
          <tr>
            <td>
              <strong>External</strong>
            </td>
            <td>
              The usage source (simulated in the demo), the nightly reset job,
              email (not sent in the demo), and Vercel hosting.
            </td>
            <td>
              <FilePath>src/lib/usage-sync.ts</FilePath>,{" "}
              <FilePath>src/lib/email.ts</FilePath>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Two rules keep the layers separate. The browser never talks to the
        database; every read and write goes through a page, a route, or a
        server action. Most SQL is in <FilePath>src/lib/repos/*</FilePath>.
      </p>

      <H2 id="request-lifecycle">Request lifecycle</H2>
      <p>
        A dashboard load is one round trip. Pages are React Server Components
        that await repo calls directly:
      </p>
      <CodeBlock
        title="GET / — dashboard load"
        code={`
GET /
 └─ Cloudflare Access        email + one-time code (public demo only)
    └─ middleware.ts         cookie probe · x-pathname header
       └─ Shell (RSC)        getSessionUser() → users row, status check
          └─ app/page.tsx    await getKpis · getDailySeries · getRiskSummary
             └─ lib/repos/usage.ts
                └─ SELECT … FROM usage_daily_with_revenue (cached by tag)
 ← streamed HTML → hydration → recharts render
`}
      />
      <p>
        A change goes the other way. A form calls a{" "}
        <code>&quot;use server&quot;</code> action or posts to a route. The
        code calls <code>guardAction()</code> for the role check, writes
        through a repo, records an audit entry, clears the revenue cache when
        a revenue input changed, and calls <code>revalidatePath()</code> so the
        affected pages render again. The browser shows the result as a toast.
      </p>

      <H2 id="authentication">Authentication</H2>
      <p>
        The public demo has two sign-in steps. First, Cloudflare Access asks
        for an email address and a one-time code. Second, the app&apos;s login
        page offers &quot;Enter as Admin&quot; and &quot;Enter as
        Member&quot;. Both buttons use a NextAuth v5 Credentials provider in{" "}
        <FilePath>src/auth.ts</FilePath> that signs in a seeded, active user by
        email, with no password. Sessions are <strong>JWTs</strong>; there is
        no session table. The <code>jwt()</code> callback adds the user&apos;s
        id and role from the <code>users</code> table, and{" "}
        <code>session()</code> copies them onto the session object.
      </p>
      <p>
        Authorization is in <FilePath>src/lib/access.ts</FilePath>:
      </p>
      <ul>
        <li>
          <code>getSessionUser()</code> resolves the JWT to a user row and
          checks <code>status = active</code>.
        </li>
        <li>
          <code>requireSession()</code> and <code>requireRole(role)</code> are
          redirect guards for pages.
        </li>
        <li>
          <code>guardAction(action)</code> is the gate for actions and routes.
          It returns <code>{"{ok, user}"}</code> or a typed error.
        </li>
        <li>
          <code>can(role, action)</code> is the policy. Admins can do every
          action. Editors can edit pricing, manual entries, the catalog,
          accounts, groups, sandbox rules, and alerts. Members have read
          access only.
        </li>
      </ul>
      <Callout variant="warn" title="The middleware is not a security boundary">
        <FilePath>src/middleware.ts</FilePath> only checks that a session
        cookie <em>exists</em>. It does not validate it. Every page, route, and
        action authenticates again on the server through{" "}
        <code>lib/access.ts</code>. The <code>AUTH_BYPASS</code> flag is for
        local development only, and the app refuses to start with it in a
        built deployment.
      </Callout>

      <H2 id="data-layer">Data layer</H2>
      <p>
        <FilePath>src/lib/db.ts</FilePath> exposes one postgres.js pool: at
        most 3 connections, cached on <code>globalThis</code> for warm
        serverless instances, with TLS when the URL asks for it. Dates and
        timestamps come back as ISO strings, not JS <code>Date</code>{" "}
        objects. Typed repo modules in <FilePath>src/lib/repos/*</FilePath>{" "}
        sit above the pool, one per domain.
      </p>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Main tables</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Identity</td>
            <td>
              <code>users</code>, <code>notifications</code>
            </td>
            <td>Users, roles, and in-app notifications.</td>
          </tr>
          <tr>
            <td>Catalog</td>
            <td>
              <code>clients</code> (accounts), <code>accounts</code> (groups),{" "}
              <code>apis</code>, <code>api_bundles</code>,{" "}
              <code>api_bundle_members</code>
            </td>
            <td>Accounts, groups, the API catalog, and stitched bundles.</td>
          </tr>
          <tr>
            <td>Pricing</td>
            <td>
              <code>pricing</code>, <code>pricing_slab</code>,{" "}
              <code>bundle_pricing</code>, <code>vendor_pricing</code>,{" "}
              <code>vendors</code>
            </td>
            <td>
              Temporal price and cost history: the latest{" "}
              <code>effective_from</code> on or before the usage date wins.{" "}
              <code>pricing_slab</code> holds the brackets for tier and slab
              rows.
            </td>
          </tr>
          <tr>
            <td>Usage</td>
            <td>
              <code>usage_daily</code>, <code>manual_entries</code>,{" "}
              <code>vendor_usage_daily</code>
            </td>
            <td>
              Daily hits from the usage sync (<code>source=&apos;log&apos;</code>),
              manual entries, and the vendor side for reconciliation.
            </td>
          </tr>
          <tr>
            <td>Billing</td>
            <td>
              <code>billing_periods</code>, <code>statements</code>,{" "}
              <code>statement_lines</code>, <code>statement_adjustments</code>,{" "}
              <code>invoice_sequence</code>
            </td>
            <td>Periods, finalized snapshots, line items, adjustments.</td>
          </tr>
          <tr>
            <td>Operations</td>
            <td>
              <code>audit_log</code>, <code>sync_runs</code>,{" "}
              <code>alerts</code>, <code>app_settings</code>
            </td>
            <td>
              Who changed what, sync run history, usage alerts, and app
              settings.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        The <code>usage_daily_with_revenue</code> view joins usage to the
        account price and vendor cost in force on each date, applies bundle
        prices, and leaves out unapproved manual entries. It returns revenue
        and vendor cost per row. KPIs, charts, account summaries, and
        statement derivation read from it, so per-day pricing logic is in one
        place. Volume pricing (tier and slab) depends on a whole
        period&rsquo;s hits, so the view returns 0 for those rows and{" "}
        <code>deriveStatement</code> and{" "}
        <code>lib/repos/slab-revenue.ts</code> compute it per period. See the{" "}
        <a href="/help/api/database">database schema</a> for every table.
      </p>

      <H2 id="daily-usage-sync">Usage sync</H2>
      <p>
        In the demo, <code>MOCK_INTEGRATIONS=true</code>. The usage pull
        generates each day&apos;s usage from the account and API pairs already
        in the database and calls no external service. An admin runs it with
        Refresh now (<code>POST /api/sync/refresh</code>) or a backfill (
        <code>POST /api/sync/backfill</code>, up to 31 days). The route{" "}
        <code>GET /api/cron/usage-sync</code> runs the same engine for the
        last 3 days and missing older dates, but no scheduler calls it in the
        demo. For each date, the engine:
      </p>
      <ol>
        <li>
          Gets the rows for the date. With mocking off,{" "}
          <FilePath>src/lib/metabase.ts</FilePath> queries a Metabase
          instance.
        </li>
        <li>
          Resolves accounts by <code>display_name</code> and{" "}
          <code>log_aliases</code>, and APIs by <strong>product code</strong>{" "}
          only, with <code>api_code_overrides</code> as the only fallback.
          Unresolved rows keep a NULL id and appear on{" "}
          <FilePath>/admin/aliases</FilePath> or{" "}
          <FilePath>/admin/api-review</FilePath>.
        </li>
        <li>
          In one transaction, deletes that date&apos;s{" "}
          <code>source=&apos;log&apos;</code> rows and inserts the new rows in
          chunks of 500. A re-run gives the same result.
        </li>
        <li>
          Records the outcome in <code>sync_runs</code>, shown on{" "}
          <FilePath>/admin/sync</FilePath>, and clears the revenue cache.
        </li>
      </ol>
      <p>
        In the demo, Refresh now also runs the vendor-side pull and the alert
        check, because there is no scheduler to run them.
      </p>

      <H2 id="invoice-pipeline">Invoice pipeline</H2>
      <p>Statements move through three states:</p>
      <ol>
        <li>
          <strong>Draft</strong>: <code>deriveStatement()</code> computes the
          statement from the revenue view on each request, so the draft
          follows current pricing and usage.
        </li>
        <li>
          <strong>Final</strong>: a transaction copies the lines into{" "}
          <code>statements</code> and <code>statement_lines</code> and takes
          the next number from the per-year <code>invoice_sequence</code> row
          with an atomic upsert.
        </li>
        <li>
          <strong>Issued</strong>: the statement is locked,{" "}
          <code>issued_at</code> is set, and the action is audited.
          Adjustments can be added between finalize and issue.
        </li>
      </ol>
      <Callout variant="info" title="Snapshots do not change">
        A pricing edit changes draft statements only. A finalized statement is
        a stored copy, so later pricing edits do not change an issued
        invoice.
      </Callout>
      <p>
        Exports are computed on request.{" "}
        <code>GET /api/invoices/[account]/[period]/pdf</code> renders{" "}
        <FilePath>src/lib/pdf/StatementPdf.tsx</FilePath> with
        @react-pdf/renderer in two variants. The internal variant shows vendor
        cost and margin and needs the admin or editor role. The customer
        variant leaves them out. PDF rendering is limited to 10 per user per
        minute. A CSV route exports the same lines with the same variant rule.
      </p>

      <H2 id="runtime-boundaries">Runtime boundaries</H2>
      <ul>
        <li>
          <strong>Middleware</strong>: only{" "}
          <FilePath>src/middleware.ts</FilePath>. No database access. It lets{" "}
          <code>/login</code>, <code>/api/auth/*</code>,{" "}
          <code>/api/cron/*</code>, and <code>/api/warm</code> through
          without a session.
        </li>
        <li>
          <strong>Node serverless</strong>: RSC pages, route handlers, and
          server actions. They share one connection pool per warm instance.
        </li>
        <li>
          <strong>Browser</strong>: client components only. All reads and
          writes go through the server.
        </li>
        <li>
          <strong>Scheduled routes</strong>: no session. They accept only the{" "}
          <code>CRON_SECRET</code> bearer token and run for at most 300
          seconds.
        </li>
      </ul>

      <H2 id="deployment">Deployment</H2>
      <p>
        The public demo runs on Vercel (Hobby) with a Neon Postgres database
        in the same region. Cloudflare Access protects the public URL.{" "}
        <FilePath>vercel.json</FilePath> sets the build command and declares
        no crons. Secrets are Vercel environment variables. Locally they are
        in <FilePath>.env.local</FilePath>.
      </p>
      <p>
        A nightly job outside this repository reseeds the demo database with
        fictional data and then calls <code>POST /api/cache/revalidate</code>{" "}
        with the <code>CRON_SECRET</code> bearer token, which clears the cached
        revenue reads.
      </p>
      <p>
        Locally, <code>npm run dev</code> starts an embedded Postgres on port
        54329 (change it with <code>LOCAL_PG_PORT</code>), runs{" "}
        <FilePath>scripts/db-setup.ts</FilePath> to apply{" "}
        <FilePath>migrations/*.sql</FilePath>, seeds fictional data with{" "}
        <FilePath>scripts/seed-mock.ts</FilePath> when the database is empty,
        and starts Next.js. The schema is one file,{" "}
        <FilePath>migrations/0001_baseline.sql</FilePath>. Applied files are
        recorded in <code>schema_migrations</code>.
      </p>
      <CodeBlock
        title="environment used by the demo"
        code={`
DATABASE_URL          Postgres connection string (Neon in the demo)
AUTH_SECRET           NextAuth JWT secret
CRON_SECRET           bearer token for /api/cron/* and /api/cache/revalidate
MOCK_INTEGRATIONS     true: simulated usage and vendor-side pulls
`}
      />
      <p>
        Mail, LLM, and real usage-source variables are not set in the demo. See{" "}
        <a href="/help/api/environment">Environment</a> for the full list.
      </p>
    </DocPage>
  );
}
