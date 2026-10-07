import type { Metadata } from "next";
import { DocPage } from "@/components/help/DocPage";
import {
  H2,
  H3,
  ParamTable,
  CodeBlock,
  Callout,
  FilePath,
  Figure,
  Related,
} from "@/components/help/doc";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <DocPage
      crumbs={[{ href: "/help/api", label: "API reference" }]}
      title="Integrations"
      lede="The outside systems Ledgerline can talk to, and what each one does in the public demo. In the demo, the usage pull and the vendor-side pull are simulated, email does not send, and storage is Neon Postgres."
    >
      <Callout variant="info" title="What runs in the demo">
        The demo sets <code>MOCK_INTEGRATIONS=true</code>. The usage pull and the vendor-side pull
        generate data from the local database and call no external service. No mail credentials
        are set, so email sends are skipped. <FilePath>vercel.json</FilePath> declares no crons.
        A nightly job outside the app reseeds the database and clears the revenue cache. See{" "}
        <a href="/help/api/environment">Environment</a> for the variables.
      </Callout>

      {/* ─── Usage sync ────────────────────────────────────────────────── */}
      <H2 id="metabase">Usage sync</H2>
      <p>
        Usage lands in <code>usage_daily</code> through one sync engine,{" "}
        <FilePath>src/lib/usage-sync.ts</FilePath>. The code names the upstream source Metabase.
        The HTTP client for a real Metabase instance is in{" "}
        <FilePath>src/lib/metabase.ts</FilePath>.
      </p>

      <H3 id="metabase-mock">Simulated pull (demo)</H3>
      <p>
        When <code>MOCK_INTEGRATIONS=true</code>, <code>syncDate()</code> calls{" "}
        <code>mockUsageForDate()</code> instead of the HTTP client. It reads the account and SKU
        pairs that already have <code>source=&apos;log&apos;</code> rows, and for each pair it
        generates unit counts near that pair&apos;s average. The variation is seeded by the date,
        so a re-run of the same date gives the same numbers. Today&apos;s partial day comes out
        lower. Every step after the pull runs the same way as with a real source.
      </p>

      <H3 id="metabase-auth">Real source: session auth</H3>
      <p>
        With mocking off, <FilePath>src/lib/metabase.ts</FilePath> logs in with{" "}
        <code>METABASE_USERNAME</code> / <code>METABASE_PASSWORD</code> at{" "}
        <code>POST /api/session</code> and sends the session id on each query as the{" "}
        <code>X-Metabase-Session</code> header. The client:
      </p>
      <ul>
        <li>caches the session id on <code>globalThis</code>, so a cold start logs in again and nothing is stored;</li>
        <li>on a <strong>401</strong>, drops the session, logs in again, and retries the query once;</li>
        <li>retries once on a network failure or a 5xx;</li>
        <li>times out after 30 s for login and 120 s per query.</li>
      </ul>
      <p>
        The source query returns one row per (account, SKU, <code>hits_via</code>) for one date. The rows have
        no date column, so the sync queries one date at a time and tags each row with that date.
      </p>
      <CodeBlock
        lang="ts"
        title="Row shape the sync expects (MetabaseUsageRow)"
        code={`{
  "Client name"?: string, "Account name"?: string,
  "API Name": string, "Hits via": string, "Product Code": string,
  "Vendor"?: string, "Grand Total": number,
  "Successful": number, "Successful-No data": number,
  "In-progress": number, "Failed": number
}`}
      />

      <H3 id="metabase-flow">Per-date sync flow</H3>
      <p>Each business date runs through <code>syncDate()</code>:</p>
      <ol>
        <li>Insert a <code>sync_runs</code> row with <code>status=&apos;running&apos;</code>, so the run is visible if it stops part way.</li>
        <li>Get the rows for the date (simulated or real). Drop the &quot;ALL CLIENTS TOTAL / ALL APIs&quot; checksum row if it is present.</li>
        <li>Resolve catalog ids. <strong>Accounts</strong> match by <code>display_name</code> and <code>log_aliases</code>. <strong>SKUs</strong> match by <code>Product Code</code> (the SKU code) only: a row maps when its code is an active catalog code (<code>apis.is_active=1</code>). When the code is blank or unknown, the only fallback is an <code>api_code_overrides</code> entry (raw SKU name to code).</li>
        <li>Store unmatched rows with a NULL id. They are never auto-created. An unmatched account appears on /admin/aliases. An unmatched SKU keeps its raw code in <code>raw_api_code</code> and appears on /admin/sku-review.</li>
        <li>Group rows by (account, SKU, <code>hits_via</code>) so duplicate rows add up instead of breaking the unique index.</li>
        <li>In one transaction, delete the date&apos;s <code>source=&apos;log&apos;</code> rows and insert the new rows in chunks of 500. Running a date again gives the same result.</li>
        <li>Finish the <code>sync_runs</code> row with row counts, unmapped counts, and total units. On failure, set <code>status=&apos;error&apos;</code> with the message cut to 2,000 characters. An error on one date does not stop the next date.</li>
      </ol>

      <H3 id="metabase-triggers">Triggers</H3>
      <ul>
        <li>
          <a href="/help/api/endpoints#sync-refresh">Refresh now</a> (<code>POST /api/sync/refresh</code>, admin):
          pulls today and the two days before it and returns a before and after diff. In the
          demo it also runs the vendor-side pull and the alert check.
        </li>
        <li>
          <a href="/help/api/endpoints#sync-backfill">Backfill</a> (<code>POST /api/sync/backfill</code>, admin):
          pulls an explicit date range of up to 31 days.
        </li>
        <li>
          <code>GET /api/cron/usage-sync</code> (bearer <code>CRON_SECRET</code>): re-pulls the
          last 3 closed days and up to 60 older dates that have no successful run with data. No
          scheduler calls it in the demo. You can call it by hand.
        </li>
      </ul>
      <p>
        Run history for all triggers is stored in <code>sync_runs</code> and shown at /admin/sync.
      </p>
      <Figure
        src="/help/shots/admin-sync.png"
        alt="The admin sync screen showing per-date sync runs with status, rows, and units"
        caption="/admin/sync lists every sync_runs row: trigger, date, rows, units, and errors."
      />

      {/* ─── Vendor-side pull ──────────────────────────────────────────── */}
      <H2 id="vendor-pull">Vendor-side usage pull</H2>
      <p>
        Vendor reconciliation compares Ledgerline&apos;s usage with what each vendor reports.{" "}
        <FilePath>src/lib/vendor-recon-sync.ts</FilePath> writes the vendor side into{" "}
        <code>vendor_usage_daily</code>. With <code>MOCK_INTEGRATIONS=true</code>,{" "}
        <FilePath>src/lib/metabase-vendor.ts</FilePath> builds the vendor rows from local{" "}
        <code>usage_daily</code>. Most (vendor, SKU) pairs match. About one pair in six reports
        8–30% more successful units, and one vendor reports a SKU name that the catalog does not
        have, so the reconciliation screen has deltas to show. With mocking off, the module runs a
        native query against the source database. The pull runs from{" "}
        <code>/api/cron/vendor-recon-sync</code>, from <code>npm run vendor-sync</code>, and, in
        the demo, from Refresh now.
      </p>

      {/* ─── Email ─────────────────────────────────────────────────────── */}
      <H2 id="email">Email</H2>
      <p>
        Outbound email goes through Nodemailer in <FilePath>src/lib/email.ts</FilePath>. The app
        builds these emails: user invites, account merge and delete requests and decisions, the
        daily, weekly, and monthly revenue roundups, the weekly product update, and alert emails.
        Templates are in <FilePath>src/lib/emails/</FilePath>.
      </p>
      <Callout variant="info" title="Emails render but do not send in the demo">
        No sender or mail credential is set in the demo. <code>sendEmail()</code> returns{" "}
        <code>{`{ ok: false, skipped: true }`}</code> and logs a warning. It does not throw, so an
        invite or an approval still succeeds. To see an email, call a cron route with a dry-run
        parameter and the <code>CRON_SECRET</code> bearer token. The route returns the HTML and
        sends nothing.
      </Callout>
      <CodeBlock
        lang="bash"
        title="Preview emails locally"
        code={`curl -H "Authorization: Bearer local-dev-cron-secret" \\
  "http://localhost:3000/api/cron/roundup-daily?dry=1"

curl -H "Authorization: Bearer local-dev-cron-secret" \\
  "http://localhost:3000/api/cron/alerts?dry=daily"`}
      />

      {/* ─── Auth ──────────────────────────────────────────────────────── */}
      <H2 id="nextauth">Sign-in (NextAuth)</H2>
      <p>
        On the public demo, Cloudflare Access is in front of the app. A visitor enters an email
        address and a one-time code before any request reaches Ledgerline. After that, the app
        has its own sign-in.
      </p>
      <p>
        Sign-in is NextAuth v5 in <FilePath>src/auth.ts</FilePath>, mounted at{" "}
        <code>/api/auth</code>. The only provider is a Credentials provider with id{" "}
        <code>demo</code>. It takes an email and no password. The login page has two buttons,
        &quot;Enter as Admin&quot; and &quot;Enter as Member&quot;, which sign in as the seeded
        users <code>admin@ledgerline.local</code> and <code>analyst@ledgerline.local</code>.
        Sessions are JWTs in a cookie. There is no session table. The secret is{" "}
        <code>AUTH_SECRET</code>.
      </p>
      <ol>
        <li>
          <strong>authorize</strong> looks up the email in <code>users</code> and accepts it only
          when the row exists and has <code>status=&apos;active&apos;</code>.
        </li>
        <li>
          <strong>jwt</strong> looks up the user by email again and stores <code>uid</code> and{" "}
          <code>role</code> in the token.
        </li>
        <li>
          <strong>session</strong> copies <code>uid</code> and <code>role</code> onto{" "}
          <code>session.user</code>. <code>getSessionUser()</code> and{" "}
          <code>guardAction()</code> read these values.
        </li>
      </ol>
      <p>
        For local development, <code>AUTH_BYPASS=true</code> skips the login screen and treats
        every request as the demo admin (<code>AUTH_DEMO_ADMIN_EMAIL</code>). See{" "}
        <a href="/help/api/environment#auth">Environment</a>.
      </p>

      {/* ─── Postgres ──────────────────────────────────────────────────── */}
      <H2 id="neon">Postgres</H2>
      <p>
        Storage is Postgres through the <code>postgres</code> (postgres.js v3) driver in{" "}
        <FilePath>src/lib/db.ts</FilePath>. Locally it is an embedded Postgres on port 54329. The
        hosted demo uses a Neon database in the same region as the Vercel functions.
      </p>
      <ParamTable
        nameHeader="Setting"
        rows={[
          { name: "ssl", type: '"require" | false', desc: <><code>require</code> when <code>DATABASE_URL</code> contains <code>sslmode=require</code> or a <code>neon.tech</code> host. Off for the local embedded Postgres.</> },
          { name: "prepare", type: "false", desc: "Server-side prepared statements are off, so the driver works through a transaction-mode connection pooler." },
          { name: "max", type: "3", desc: "Connections per instance. Each serverless instance holds its own pool." },
          { name: "idle_timeout", type: "20 s", desc: "Idle connections close quickly." },
          { name: "connect_timeout", type: "10 s", desc: "Connection attempts fail fast." },
          { name: "types", type: "custom", desc: <>OIDs 1082/1083/1114/1184 (DATE, TIME, TIMESTAMP, TIMESTAMPTZ) parse as <strong>ISO strings</strong>, not JS Dates. The codebase compares and serializes dates as strings.</> },
        ]}
      />
      <p>
        The pool is a <code>globalThis</code> singleton keyed by a <code>Symbol.for</code>, so dev
        hot reloads and warm serverless instances reuse one pool. The module does not import{" "}
        <code>&quot;server-only&quot;</code>, so the scripts in <FilePath>scripts/</FilePath> can
        import it.
      </p>

      {/* ─── Vercel ────────────────────────────────────────────────────── */}
      <H2 id="vercel">Vercel hosting and scheduled routes</H2>
      <p>
        The demo runs on Vercel as a Next.js App Router app. <FilePath>vercel.json</FilePath> sets
        the build command and declares no crons. The <code>/api/cron/*</code> routes still exist.
        Each one checks <code>Authorization: Bearer &lt;CRON_SECRET&gt;</code> and nothing else,
        and the middleware lets <code>/api/cron</code> through without a session. You can call
        them by hand. The sync routes export <code>maxDuration = 300</code>, which is why
        backfill is capped at 31 days.
      </p>
      <p>
        A nightly job outside this repository reseeds the demo database and then calls{" "}
        <code>POST /api/cache/revalidate</code> with the <code>CRON_SECRET</code> bearer token.
        That route calls <code>revalidateRevenue()</code>, which clears every cached revenue read.
      </p>

      <Related
        links={[
          { href: "/help/api", label: "API reference" },
          { href: "/help/api/endpoints", label: "Endpoints" },
          { href: "/help/api/database", label: "Database schema" },
          { href: "/help/api/environment", label: "Environment" },
        ]}
      />
    </DocPage>
  );
}
