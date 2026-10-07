import type { Metadata } from "next";
import { DocPage } from "@/components/help/DocPage";
import {
  H2,
  ParamTable,
  CodeBlock,
  Callout,
  FilePath,
  Related,
} from "@/components/help/doc";

export const metadata: Metadata = { title: "Environment" };

export default function EnvironmentPage() {
  return (
    <DocPage
      crumbs={[{ href: "/help/api", label: "API reference" }]}
      title="Environment"
      lede="The environment variables Ledgerline reads, what each one controls, its default, and whether the public demo sets it. Auth values are read in src/lib/config.ts. The others are read where they are used."
    >
      <p>
        <FilePath>src/lib/config.ts</FilePath> does not throw when a credential is missing. The
        one exception is the <code>AUTH_BYPASS</code> check below. When a variable is unset, only
        the feature that needs it stops working. For example, a usage pull fails and records an
        error in <code>sync_runs</code>, or an email send is skipped. Locally, values come from{" "}
        <FilePath>.env.local</FilePath> (copy <FilePath>.env.local.example</FilePath>). On the
        hosted demo, values are set in the Vercel project settings.
      </p>

      <H2 id="database">Database</H2>
      <ParamTable
        nameHeader="Variable"
        rows={[
          {
            name: "DATABASE_URL",
            type: "required",
            desc: <>Postgres connection string. <FilePath>src/lib/db.ts</FilePath> and the scripts in <FilePath>scripts/</FilePath> connect with it. TLS is turned on when the URL contains <code>sslmode=require</code> or a <code>neon.tech</code> host. Locally, <code>npm run dev</code> sets it to the embedded Postgres. The demo points it at a Neon database.</>,
          },
          {
            name: "LOCAL_PG_PORT",
            type: "optional",
            desc: <>Port for the embedded Postgres that <FilePath>scripts/local.ts</FilePath> starts. Default <code>54329</code>. Local only.</>,
          },
        ]}
      />

      <H2 id="auth">Authentication</H2>
      <ParamTable
        nameHeader="Variable"
        rows={[
          {
            name: "AUTH_SECRET",
            type: "required",
            desc: <>Signs the NextAuth JWT session cookie. When unset, a fixed development value from <FilePath>src/lib/config.ts</FilePath> is used. Set a real secret on any deployed copy, or sessions can be forged.</>,
          },
          {
            name: "AUTH_URL",
            type: "optional",
            desc: <>Public base URL. Used to build absolute links: the login link on <FilePath>src/app/admin/users/page.tsx</FilePath> and the links in account merge and delete emails. Default <code>http://localhost:3000</code>. NextAuth infers the host itself (<code>trustHost: true</code>), so sign-in works without it.</>,
          },
          {
            name: "AUTH_DEMO_ADMIN_EMAIL",
            type: "optional",
            desc: <>The <code>users</code> row that <code>AUTH_BYPASS</code> signs in as. Default <code>admin@ledgerline.local</code>. Read only when the bypass is on.</>,
          },
          {
            name: "AUTH_BYPASS",
            type: "optional",
            desc: <>Local development only. The exact string <code>true</code> skips the login screen and treats every request as the demo admin. Any other value means off. Off in the demo.</>,
          },
          {
            name: "AUTH_ALLOWED_EMAIL_DOMAIN",
            type: "optional",
            desc: <>Email domain that digest recipient lists must use. Saving a roundup, product-update, or alert recipient outside this domain fails. Default <code>ledgerline.local</code>. Sign-in does not check it.</>,
          },
        ]}
      />
      <Callout variant="danger" title="AUTH_BYPASS is refused in a deployed build">
        <FilePath>src/lib/config.ts</FilePath> throws at module load when{" "}
        <code>AUTH_BYPASS=true</code> and <code>NODE_ENV</code> is the value that{" "}
        <code>next build</code> and <code>next start</code> set. The app then fails to start.{" "}
        <FilePath>src/middleware.ts</FilePath> also ignores the flag in that mode.
        <CodeBlock
          lang="ts"
          title="src/lib/config.ts"
          code={`if (authBypassEnabled && process.env.NODE_ENV === "production") {
  throw new Error(
    "AUTH_BYPASS=true is not permitted with NODE_ENV=production. " +
      "Remove the bypass flag or run a non-production build."
  );
}`}
        />
      </Callout>

      <H2 id="integrations">Integrations and scheduled routes</H2>
      <ParamTable
        nameHeader="Variable"
        rows={[
          {
            name: "MOCK_INTEGRATIONS",
            type: "optional",
            desc: <>The exact string <code>true</code> turns on the simulated usage pull and vendor-side pull. Usage is generated from the account and SKU pairs already in <code>usage_daily</code>, and the vendor side is derived from local usage. No external service is called. Set to <code>true</code> in the demo and in <FilePath>.env.local.example</FilePath>. <FilePath>scripts/seed-mock.ts</FilePath> also sets it for its own run.</>,
          },
          {
            name: "METABASE_URL",
            type: "optional",
            desc: <>Base URL of a real usage source. Default <code>https://metabase.example.com</code>. Not used in the demo.</>,
          },
          {
            name: "METABASE_USERNAME / METABASE_PASSWORD",
            type: "optional",
            desc: <>Login for a real usage source. Unset in the demo. When <code>MOCK_INTEGRATIONS</code> is off and these are unset, every pull fails with <code>METABASE_USERNAME / METABASE_PASSWORD not configured</code>, and the error is recorded in <code>sync_runs</code>.</>,
          },
          {
            name: "METABASE_USAGE_CARD_ID / METABASE_USAGE_DATE_PARAM_ID",
            type: "optional",
            desc: <>The saved usage question and its date parameter, read by <FilePath>src/lib/metabase.ts</FilePath>. No default (empty). Not used in the demo.</>,
          },
          {
            name: "METABASE_VENDOR_DATABASE_ID",
            type: "optional",
            desc: <>The source database id for the vendor-side native query, read by <FilePath>src/lib/metabase-vendor.ts</FilePath>. Default <code>0</code>. Not used in the demo.</>,
          },
          {
            name: "CRON_SECRET",
            type: "required for scheduled routes",
            desc: <>Bearer token checked by every <code>/api/cron/*</code> route and by <code>POST /api/cache/revalidate</code>. No default. When unset, these routes return 401 to every caller. The demo sets it, and the nightly reset job sends it to clear the revenue cache. Locally, <FilePath>.env.local.example</FilePath> sets <code>local-dev-cron-secret</code> so you can call the routes by hand.</>,
          },
          {
            name: "LOGODEV_PUBLISHABLE_KEY",
            type: "optional",
            desc: <>logo.dev publishable key. Used by <code>GET /api/accounts/logo/fetch</code> and by the account logos in digest emails. When unset, the fetch route returns 503 and emails show initials instead of logos.</>,
          },
        ]}
      />

      <H2 id="email">Email</H2>
      <p>
        <FilePath>src/lib/email.ts</FilePath> sends mail through Nodemailer. It reads a sender
        address, an SMTP login, and one credential: an SMTP app password, or an OAuth refresh
        token used with an OAuth client id and secret (read in{" "}
        <FilePath>src/lib/config.ts</FilePath>). The variable names are in those two files.{" "}
        <strong>None of these are set in the demo.</strong> Every send returns{" "}
        <code>{`{ ok: false, skipped: true }`}</code> and logs a warning. Invites, approvals, and
        digest runs still succeed. To see an email, use the <code>?dry=1</code> preview on the
        cron routes. See <a href="/help/api/integrations#email">Integrations: email</a>.
      </p>

      <H2 id="llm">Ask mode (LLM)</H2>
      <ParamTable
        nameHeader="Variable"
        rows={[
          {
            name: "ASK_LLM_ENABLED",
            type: "optional",
            desc: <>The exact string <code>true</code>, together with <code>OPENAI_API_KEY</code>, lets the palette&apos;s ask mode fall back to an LLM when no deterministic template matches. Off in the demo.</>,
          },
          {
            name: "OPENAI_API_KEY",
            type: "optional",
            desc: <>API key for that fallback (<FilePath>src/lib/repos/ask-llm.ts</FilePath>). Unset in the demo.</>,
          },
          {
            name: "ASK_LLM_MODEL",
            type: "optional",
            desc: <>Model id for the fallback. Default <code>gpt-4o-mini</code>.</>,
          },
          {
            name: "BRIEFING_LLM_ENABLED / BRIEFING_MODEL",
            type: "optional",
            desc: <>Read into <code>config.briefing</code> in <FilePath>src/lib/config.ts</FilePath>, but no code reads that value. The dashboard briefing always uses the deterministic composer in <FilePath>src/lib/briefing.ts</FilePath>.</>,
          },
        ]}
      />

      <H2 id="behavior">Behavior tuning</H2>
      <ParamTable
        nameHeader="Variable"
        rows={[
          {
            name: "MANUAL_ENTRY_APPROVAL_THRESHOLD",
            type: "optional",
            desc: <>Revenue total above which a manual entry always needs explicit approval, even when an admin creates it with <code>submit: true</code>. Default <code>500</code>. A non-numeric value falls back to the default.</>,
          },
          {
            name: "ACCOUNT_OP_UNDO_DAYS",
            type: "optional",
            desc: <>Days an account merge or delete stays reversible before <code>/api/cron/purge-account-ops</code> makes it permanent. Default <code>30</code>.</>,
          },
          {
            name: "NODE_ENV",
            type: "set by Next.js",
            desc: <>Not set by hand. Ledgerline reads it only for the <code>AUTH_BYPASS</code> refusal.</>,
          },
          {
            name: "BASE_URL",
            type: "optional",
            desc: <>Used only by <FilePath>scripts/capture-help-shots.ts</FilePath>, which takes the help screenshots. Default <code>http://localhost:3001</code>.</>,
          },
        ]}
      />

      <Callout variant="warn" title="Required and optional">
        &quot;Required&quot; means the feature needs the variable to work. It does not mean the
        process needs it to start. The app cannot do anything without{" "}
        <code>DATABASE_URL</code>. Without the other variables, the related feature fails in a
        visible way: an errored sync run, a skipped email, or a 401 from a scheduled route.
      </Callout>

      <Related
        links={[
          { href: "/help/api", label: "API reference" },
          { href: "/help/api/endpoints", label: "Endpoints" },
          { href: "/help/api/actions", label: "Server actions" },
          { href: "/help/api/integrations", label: "Integrations" },
        ]}
      />
    </DocPage>
  );
}
