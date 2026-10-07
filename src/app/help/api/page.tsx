import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/help/DocPage";
import { H2, Callout, CodeBlock, ParamTable, FilePath, Related } from "@/components/help/doc";
import { apiNav } from "@/lib/help/api-nav";

export const metadata: Metadata = { title: "API reference" };

const SECTIONS: { href: string; label: string; desc: string }[] = [
  {
    href: "/help/api/endpoints",
    label: "Endpoints",
    desc: "Every HTTP route handler: request schemas, response shapes, status codes, and side effects.",
  },
  {
    href: "/help/api/actions",
    label: "Server actions",
    desc: 'Every "use server" function the UI calls directly — inputs, outputs, guards, and audit trail.',
  },
  {
    href: "/help/api/integrations",
    label: "Integrations",
    desc: "The usage sync and vendor-side pull (simulated in the demo), email, sign-in, Postgres, and the scheduled routes.",
  },
  {
    href: "/help/api/database",
    label: "Database schema",
    desc: "All tables grouped by domain, plus the usage_daily_with_revenue view that drives every revenue number.",
  },
  {
    href: "/help/api/environment",
    label: "Environment",
    desc: "Every environment variable Ledgerline reads, what it controls, and what happens when it is unset.",
  },
];

export default function ApiReferenceIndex() {
  return (
    <DocPage
      title="API reference"
      lede="Every internal endpoint and server action in Ledgerline, plus the external integrations it talks to. Ledgerline's API is internal: it serves the Ledgerline UI itself, not third-party consumers."
    >
      <H2 id="authentication">Authentication</H2>
      <p>
        Ledgerline uses NextAuth with a <strong>JWT session cookie</strong>. There is no API-key
        scheme. In the demo, sign-in is a Credentials provider: the login page signs you in as the
        seeded admin or member user. Every request resolves the session to a row in the{" "}
        <code>users</code> table, and the user must have <code>status = &apos;active&apos;</code>.
        Three auth tiers exist:
      </p>
      <ul>
        <li>
          <strong>Session</strong>: read routes (search, hover cards, invoice downloads) require
          any signed-in user through <code>getSessionUser()</code>.
        </li>
        <li>
          <strong>Guarded action</strong>: mutating routes call{" "}
          <code>guardAction(action)</code> from <FilePath>src/lib/access.ts</FilePath>, which checks
          the session and the role policy in one place.
        </li>
        <li>
          <strong>Cron secret</strong>: the <code>/api/cron/*</code> routes and{" "}
          <code>POST /api/cache/revalidate</code> accept only{" "}
          <code>Authorization: Bearer &lt;CRON_SECRET&gt;</code>. In the demo, no scheduler calls
          the cron routes. The nightly reset job calls the revalidate route.
        </li>
      </ul>

      <CodeBlock
        lang="ts"
        title="The guard pattern every mutating handler uses"
        code={`const guard = await guardAction("pricing.edit");
if (!guard.ok) {
  // guard = { ok: false, error, code: "unauthenticated" | "forbidden" }
  return NextResponse.json({ ok: false, error: guard.error },
    { status: guard.code === "unauthenticated" ? 401 : 403 });
}
// guard.user is the typed SessionUser`}
      />

      <H2 id="roles">Role matrix</H2>
      <p>
        Three roles exist: <code>admin</code>, <code>editor</code>, and <code>member</code>. The
        policy is the <code>can(role, action)</code> function in{" "}
        <FilePath>src/lib/access.ts</FilePath>. Admins can do every action. Editors can do the
        actions marked &quot;admin, editor&quot;. Members can do none of the actions below and
        have read access only.
      </p>
      <ParamTable
        nameHeader="Action"
        rows={[
          { name: "pricing.edit", type: "admin, editor", desc: "Account pricing, bundles, leak dismissals, invoice finalize, issue, and adjust." },
          { name: "manual_entry.edit / manual_entry.approve", type: "admin, editor", desc: "Preview, create, submit, void, and approve manual entries." },
          { name: "alias.resolve", type: "admin, editor", desc: "Map raw log names to catalog accounts and APIs, and clear the API review queue." },
          { name: "sandbox_billing.edit", type: "admin, editor", desc: "Per-account and per-API sandbox billing rules." },
          { name: "api.create / api.update", type: "admin, editor", desc: "Catalog changes." },
          { name: "account.create / account.update", type: "admin, editor", desc: "Create accounts, edit profiles, move an account to a group." },
          { name: "account.merge / account.delete", type: "admin, editor", desc: "Request a merge or delete. An admin must approve it." },
          { name: "group.create / group.update / group.delete", type: "admin, editor", desc: "Manage groups." },
          { name: "alert.act", type: "admin, editor", desc: "Acknowledge, snooze, and restore alerts." },
          { name: "account.op.approve", type: "admin", desc: "Approve, reject, or reverse an account merge or delete." },
          { name: "vendor_pricing.edit", type: "admin", desc: "Vendor cost rates, commitments, the vendor registry, reconciliation dismissals, and the app-wide sandbox default." },
          { name: "user.manage", type: "admin", desc: "Users, digest recipients, and alert settings." },
          { name: "edit_mode.toggle", type: "admin", desc: "UI edit mode." },
          { name: "sync.backfill / sync.refresh", type: "admin", desc: "Run a usage pull outside the scheduled route." },
        ]}
      />

      <H2 id="conventions">Response conventions</H2>
      <p>JSON handlers follow one envelope:</p>
      <CodeBlock
        lang="json"
        title="Success and error shapes"
        code={`// success
{ "ok": true, ...payload }

// error (most routes)
{ "ok": false, "error": "human-readable message" }

// form-style validation errors (account create, profile)
{ "ok": false, "fieldErrors": { "display_name": "Display name is required." } }`}
      />
      <ul>
        <li><strong>400</strong> — body failed zod validation (the <code>error</code> string is the zod message).</li>
        <li><strong>401</strong> — no active session (search routes return a bare <code>[]</code> instead).</li>
        <li><strong>403</strong> — session exists but the role policy or same-origin check refused it.</li>
        <li><strong>404</strong> — target entity not found.</li>
        <li><strong>409</strong> — conflict: duplicate name/code, or a billing lock (the pair is on a finalized invoice).</li>
        <li><strong>422</strong> — field-level validation failure, returned as <code>fieldErrors</code>.</li>
        <li><strong>429</strong> — rate limit exceeded; includes a <code>Retry-After</code> header.</li>
      </ul>
      <p>
        Exceptions to the envelope: <code>/api/search/accounts</code> and <code>/api/search/apis</code> return a plain JSON
        array, and the invoice PDF/CSV routes return file bytes.
      </p>

      <Callout variant="warn" title="CSRF: same-origin enforcement">
        Every mutating route (POST/PATCH/DELETE) except <code>POST /api/cache/revalidate</code>, which uses the bearer token, calls <code>assertSameOrigin()</code> from{" "}
        <FilePath>src/lib/http.ts</FilePath> before doing any work. The request&apos;s{" "}
        <code>Origin</code> (or <code>Referer</code>) host must match the <code>Host</code> header;
        requests with neither header are refused with 403. Non-browser callers must set an{" "}
        <code>Origin</code> header matching the deployment host.
      </Callout>

      <H2 id="rate-limits">Rate limits</H2>
      <p>
        Limits are fixed-window counters in process memory (per serverless instance), keyed per
        user. They exist to bound runaway loops and CPU-heavy renders, not to throttle humans.
      </p>
      <ParamTable
        nameHeader="Bucket"
        rows={[
          { name: "search:{userId}", type: "60 / 10 s", desc: <>Shared by <code>/api/search</code>, <code>/api/search/accounts</code>, and <code>/api/search/apis</code>.</> },
          { name: "ask:{userId}", type: "30 / 10 s", desc: <><code>/api/ask</code>, the palette&apos;s ask mode.</> },
          { name: "cmd-options:{userId}", type: "30 / 10 s", desc: <><code>/api/cmd/options</code>, the palette&apos;s slot pickers.</> },
          { name: "pdf:{userId}", type: "10 / 60 s", desc: "Invoice PDF rendering — the most CPU-expensive authenticated call." },
          { name: "csv:{userId}", type: "20 / 60 s", desc: "Invoice CSV export." },
        ]}
      />

      <H2 id="sections">Reference sections</H2>
      <section className="not-prose mt-4">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="group block h-full rounded-lg border border-border bg-bg-raised p-4 transition-colors duration-fast ease-expo hover:border-accent/40 hover:bg-accent-bg/30"
              >
                <span className="text-sm font-medium text-ink leading-snug">{s.label}</span>
                <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">{s.desc}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Related
        links={[
          ...apiNav.map((n) => ({ href: n.href, label: n.label })),
          { href: "/help/architecture", label: "Architecture" },
        ]}
      />
    </DocPage>
  );
}
