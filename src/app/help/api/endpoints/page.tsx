import type { Metadata } from "next";
import { DocPage } from "@/components/help/DocPage";
import {
  H2,
  H3,
  Endpoint,
  RoleChip,
  ParamTable,
  CodeBlock,
  Callout,
  FilePath,
  Related,
} from "@/components/help/doc";

export const metadata: Metadata = { title: "Endpoints" };

export default function EndpointsPage() {
  return (
    <DocPage
      crumbs={[{ href: "/help/api", label: "API reference" }]}
      title="Endpoints"
      lede="Every HTTP route handler under /api — request schemas as validated by zod, response shapes, status codes, and the database writes and audit entries each call produces."
    >
      <p>
        All mutating routes enforce same-origin (<code>assertSameOrigin</code>) and the role policy
        (<code>guardAction</code>) before any work — see the{" "}
        <a href="/help/api#conventions">response conventions</a> for the shared error envelope.
        Route files live under <FilePath>src/app/api/</FilePath>.
      </p>

      {/* ─── Catalog ───────────────────────────────────────────────────── */}
      <H2 id="catalog">Catalog</H2>

      <H3 id="create-api">Create an API</H3>
      <Endpoint method="POST" path="/api/apis">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Adds an API to the catalog. The product code is normalized to uppercase, and the code +
        name are stored as implicit log aliases so importer matching works immediately.
      </p>
      <ParamTable
        rows={[
          { name: "product_code", type: "string", required: true, desc: "1–32 chars, letters/digits/underscore only. Stored uppercase." },
          { name: "name", type: "string", required: true, desc: "1–200 chars. Must not collide with another API's name or alias." },
          { name: "category", type: "string | null", desc: "Max 200 chars. Defaults to null." },
          { name: "entity_type", type: "enum | null", desc: <><code>Business</code>, <code>Individual</code>, or <code>Both</code>.</> },
          { name: "vendor_type", type: "enum | null", desc: <><code>InHouse</code>, <code>Vendor</code>, <code>Stitched</code>, or <code>Journey</code>.</> },
          { name: "default_vendor", type: "string | null", desc: "Max 100 chars." },
          { name: "log_aliases", type: "string[]", desc: "Extra raw log names that resolve to this API. Default []." },
          { name: "resolve_raw_name", type: "string", desc: "When set, quarantined usage rows with this raw API name are re-mapped to the new API in the same call (the aliases-screen “create as new API” path)." },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Responses"
        code={`// 200
{ "ok": true, "product_code": "PAN_ADV", "name": "PAN Advanced" }

// 409 — code taken, or name/alias already identifies another API
{ "ok": false, "error": "Alias \\"PAN Adv\\" already belongs to PAN_BASIC – PAN Basic." }

// 400 invalid body · 401 unauthenticated · 403 forbidden
{ "ok": false, "error": "..." }`}
      />
      <p>
        <strong>Side effects:</strong> inserts into <code>apis</code>; optionally re-points{" "}
        <code>usage_daily.api_code</code> for rows matching <code>resolve_raw_name</code>; records
        audit action <code>api.create</code>.
      </p>

      <H3 id="update-api">Update or rename an API</H3>
      <Endpoint method="PATCH" path="/api/apis/[code]">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Updates metadata for the API whose current product code is <code>[code]</code>. Accepts the
        same fields as create (no <code>resolve_raw_name</code>), plus:
      </p>
      <ParamTable
        rows={[
          { name: "product_code", type: "string", required: true, desc: "New code. If it differs from [code], the API is renamed." },
          { name: "is_active", type: "0 | 1", desc: "Soft-deactivate flag. Default 1." },
        ]}
      />
      <p>
        <strong>Renames are transactional:</strong> <code>product_code</code> is the primary key
        referenced by <code>pricing</code>, <code>vendor_pricing</code>, <code>usage_daily</code>,
        and <code>statement_lines</code> with no <code>ON UPDATE CASCADE</code>, so a rename inserts
        the new row, re-points all four child tables, and deletes the old row inside one
        transaction.
      </p>
      <CodeBlock
        lang="json"
        title="Responses"
        code={`// 200
{ "ok": true, "product_code": "PAN_ADV", "name": "PAN Advanced" }

// 404 API not found · 409 new code taken or name/alias conflict
{ "ok": false, "error": "..." }`}
      />
      <p>
        <strong>Side effects:</strong> updates (or rename-moves) the <code>apis</code> row; records
        audit action <code>api.update</code> with full before/after snapshots.
      </p>

      <H3 id="create-account">Create an account</H3>
      <Endpoint method="POST" path="/api/accounts">
        <RoleChip role="editor" />
      </Endpoint>
      <ParamTable
        rows={[
          { name: "display_name", type: "string", required: true, desc: "1–200 chars, unique across accounts." },
          { name: "billing_entity", type: "string | null", desc: "Max 500 chars. Legal entity printed on statements." },
          { name: "account_id", type: "number | null", desc: "Positive integer; optional parent group." },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Responses"
        code={`// 200
{ "ok": true, "id": 42, "slug": "acme-finance" }

// 409 duplicate name · 422 validation
{ "ok": false, "fieldErrors": { "display_name": "An account with this name already exists." } }`}
      />
      <p>
        <strong>Side effects:</strong> inserts into <code>accounts</code> with{" "}
        <code>status=&apos;active&apos;</code>, <code>is_sandbox=0</code>, and a URL-safe slug generated from
        the display name; records audit action <code>account.create</code>.
      </p>

      <H3 id="resolve-alias">Resolve a log alias</H3>
      <Endpoint method="POST" path="/api/aliases">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Maps an unmapped raw name from the usage logs to a catalog entity. The body is a
        discriminated union on <code>kind</code>:
      </p>
      <ParamTable
        rows={[
          { name: "kind", type: '"account" | "api"', required: true, desc: "Which catalog the raw name belongs to." },
          { name: "raw_name", type: "string", required: true, desc: "The raw log name to map (min 1 char)." },
          { name: "target_id", type: "number", desc: <>Required when <code>kind=&quot;account&quot;</code>: the account id.</> },
          { name: "target_code", type: "string", desc: <>Required when <code>kind=&quot;api&quot;</code>: the API product code.</> },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Responses"
        code={`// 200
{ "ok": true }

// 404 target account/api not found
{ "ok": false, "error": "account not found" }`}
      />
      <p>
        <strong>Side effects:</strong> appends <code>raw_name</code> to the target&apos;s{" "}
        <code>log_aliases</code> JSON array, then retroactively heals quarantine — every{" "}
        <code>usage_daily</code> row with that raw name and a NULL id gets its{" "}
        <code>client_id</code> / <code>api_code</code> set. Records audit action{" "}
        <code>alias.resolve</code>.
      </p>

      <H3 id="api-review">Resolve the API review queue</H3>
      <Endpoint method="POST" path="/api/api-review">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Clears entries from <a href="/help/api/database#api-code-overrides">/admin/api-review</a> —
        the queue of usage rows whose Product Code didn&apos;t match an active catalog code, plus
        name-drift flags. The body is a discriminated union on <code>action</code>:
      </p>
      <ParamTable
        rows={[
          { name: "action", type: '"accept-code" | "override" | "acknowledge-drift"', required: true, desc: "Which resolution to apply." },
          { name: "code", type: "string", desc: <>Required for <code>accept-code</code> and <code>acknowledge-drift</code>: the API product code.</> },
          { name: "name", type: "string", desc: <>Required for <code>accept-code</code>: the display name for the newly created (or reactivated) API.</> },
          { name: "raw_api_name", type: "string", desc: <>Required for <code>override</code> and <code>acknowledge-drift</code>: the raw API name from the quarantined / drifting rows.</> },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Responses"
        code={`// 200 — resolved (backfilled count where applicable)
{ "ok": true, "backfilled": 312 }

// 404 — code not found (acknowledge-drift)
{ "ok": false, "error": "API not found" }

// 400 invalid body / unknown action · 401 unauthenticated · 403 forbidden
{ "ok": false, "error": "..." }`}
      />
      <p>
        <strong>Side effects</strong> by action:
      </p>
      <ul>
        <li>
          <code>accept-code</code> — inserts the <code>apis</code> row (or flips{" "}
          <code>is_active</code> back to 1 if it exists inactive), then backfills{" "}
          <code>usage_daily.api_code</code> for the quarantined rows whose{" "}
          <code>raw_api_code</code> equals <code>code</code>. Records audit action{" "}
          <code>catalog.accept_code</code>.
        </li>
        <li>
          <code>override</code> — upserts an <a href="/help/api/database#api-code-overrides">
          <code>api_code_overrides</code></a> row (<code>raw_api_name</code> →{" "}
          <code>code</code>) and backfills matching NULL-<code>api_code</code> usage rows. Records
          audit action <code>catalog.override</code>.
        </li>
        <li>
          <code>acknowledge-drift</code> — appends <code>raw_api_name</code> to that code&apos;s{" "}
          <code>apis.log_aliases</code> to silence the drift flag (no backfill). Records audit
          action <code>catalog.ack_drift</code>.
        </li>
      </ul>

      {/* ─── Pricing ───────────────────────────────────────────────────── */}
      <H2 id="pricing">Pricing</H2>

      <H3 id="set-pricing">Set account pricing</H3>
      <Endpoint method="POST" path="/api/pricing">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Sets or updates the four-tier price for a (account, API) pair. Omitted tiers keep their
        existing values (or 0 for a new pair).
      </p>
      <ParamTable
        rows={[
          { name: "client_id", type: "number", required: true, desc: "Positive integer." },
          { name: "api_code", type: "string", required: true, desc: "API product code." },
          { name: "price_successful", type: "number", desc: "Non-negative. Per successful hit." },
          { name: "price_successful_no_data", type: "number", desc: "Non-negative. Per successful-no-data hit." },
          { name: "price_failed", type: "number", desc: "Non-negative. Per failed hit." },
          { name: "price_in_progress", type: "number", desc: "Non-negative. Per in-progress hit." },
        ]}
      />
      <p>
        The read-check-write runs in one transaction with <code>FOR UPDATE</code> on the latest
        pricing row, so concurrent edits and invoice finalization serialize correctly. The outcome
        depends on billing state:
      </p>
      <ul>
        <li><strong>No existing row</strong> — inserts a row with <code>effective_from</code> = today.</li>
        <li><strong>Existing row, pair not billed</strong> — updates the row in place.</li>
        <li>
          <strong>Existing row, pair billed</strong> on a finalized statement — the history is
          locked, so a <em>supersede</em> row is written with <code>effective_from</code> = today
          (re-using today&apos;s row if one already exists). Identical prices are a no-op.
        </li>
      </ul>
      <CodeBlock
        lang="json"
        title="Response (200)"
        code={`{
  "ok": true,
  "price_successful": 4.5,
  "price_successful_no_data": 2,
  "price_failed": 0,
  "price_in_progress": 0,
  "billed": true,
  "superseded": true
}`}
      />
      <p>
        <strong>Side effects:</strong> writes <code>pricing</code>; records audit action{" "}
        <code>pricing.update</code> or <code>pricing.supersede</code>; revalidates the account
        profile page.
      </p>

      <H3 id="delete-pricing">Delete account pricing</H3>
      <Endpoint method="DELETE" path="/api/pricing?client_id=…&api_code=…">
        <RoleChip role="editor" />
      </Endpoint>
      <ParamTable
        nameHeader="Query param"
        rows={[
          { name: "client_id", type: "number", required: true, desc: "Coerced positive integer." },
          { name: "api_code", type: "string", required: true, desc: "API product code." },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Responses"
        code={`// 200
{ "ok": true }

// 409 — pair appears on a finalized invoice
{ "ok": false, "error": "this (account, api) pair has been billed on a finalized invoice — pricing history is locked" }`}
      />
      <p>
        <strong>Side effects:</strong> deletes <em>all</em> pricing rows for the pair; records
        audit action <code>pricing.delete</code> with the before snapshot.
      </p>

      <H3 id="vendor-cost">Set vendor cost</H3>
      <Endpoint method="POST" path="/api/vendor-cost">
        <RoleChip role="admin" />
      </Endpoint>
      <p>
        Sets the four-tier <em>cost</em> rate for a (vendor, API) pair — the cost side of margin
        math. Omitted tiers keep existing values.
      </p>
      <ParamTable
        rows={[
          { name: "vendor_name", type: "string", required: true, desc: "Vendor display name (free text, matched against usage rows)." },
          { name: "api_code", type: "string", required: true, desc: "API product code." },
          { name: "cost_successful", type: "number | null", desc: "Non-negative, or null to mark the rate unknown." },
          { name: "cost_successful_no_data", type: "number | null", desc: "Non-negative, or null to mark the rate unknown." },
          { name: "cost_failed", type: "number | null", desc: "Non-negative, or null to mark the rate unknown." },
          { name: "cost_in_progress", type: "number | null", desc: "Non-negative, or null to mark the rate unknown." },
          { name: "status", type: "string", desc: "estimated | quoted | contracted. Never inferred from a value edit — omit it and the row keeps its current status." },
          { name: "source", type: "string | null", desc: "Where the rate came from: a document name or a note." },
          { name: "effective_from", type: "string (YYYY-MM-DD)", desc: "The day this rate starts applying. Defaults to today." },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Response (200)"
        code={`{ "ok": true, "cost_successful": 1.2, "cost_successful_no_data": 0.6,
  "cost_failed": 0, "cost_in_progress": null,
  "status": "quoted", "source": "Quantal MSA 2026-04" }`}
      />
      <p>
        <strong>Side effects:</strong> writes the rate effective on <code>effective_from</code>{" "}
        (default today), reading and writing inside one transaction with{" "}
        <code>FOR UPDATE</code> so a concurrent edit to the same pair cannot land between the
        history check and the write. If a row already exists on that date it is updated;
        otherwise a new dated row is inserted. Records audit action{" "}
        <code>vendor_pricing.update</code>, or <code>vendor_pricing.supersede</code> when a new
        dated row is created.
      </p>
      <p>
        <strong>Refuses with 409</strong> (<code>code: "history_locked"</code>) when the requested
        date would change the cost of days already elapsed — the response carries{" "}
        <code>suggested_effective_from</code>. One exception: a row whose four costs are all{" "}
        <code>null</code> has never priced anything, so filling it in for the first time applies
        from its own date and prices the history rather than superseding itself.
      </p>

      {/* ─── Manual entries ────────────────────────────────────────────── */}
      <H2 id="manual-entries">Manual entries</H2>
      <Endpoint method="POST" path="/api/manual-entries">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        One endpoint, five operations, discriminated by an <code>action</code> field in the body.
        Admins and editors can preview, create, submit, void, and approve — members get a 403 on
        every action. Entries earn revenue only once approved.
      </p>

      <H3 id="me-preview">action: "preview"</H3>
      <ParamTable
        rows={[
          { name: "action", type: '"preview"', required: true, desc: "—" },
          { name: "client_id", type: "number", required: true, desc: "Positive integer." },
          { name: "effective_date", type: "string", required: true, desc: "YYYY-MM-DD; the business date the usage lands on." },
          { name: "lines", type: "Line[]", required: true, desc: "At least one line; shape below." },
        ]}
      />
      <p>Each line:</p>
      <ParamTable
        rows={[
          { name: "api_code", type: "string", required: true, desc: "API product code." },
          { name: "hits_via", type: "enum", desc: <><code>Bulk</code> (default), <code>Integration</code>, or <code>Console</code>.</> },
          { name: "vendor", type: "string | null", desc: "Vendor attribution for cost math." },
          { name: "successful", type: "number", desc: "Non-negative integer, default 0." },
          { name: "successful_no_data", type: "number", desc: "Non-negative integer, default 0." },
          { name: "failed", type: "number", desc: "Non-negative integer, default 0." },
          { name: "in_progress", type: "number", desc: "Non-negative integer, default 0." },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Response (200)"
        code={`{ "ok": true, "lines": [/* per-line revenue + has_pricing */],
  "total": 61250, "requires_approval": true, "threshold": 50000 }`}
      />

      <H3 id="me-create">action: "create"</H3>
      <ParamTable
        rows={[
          { name: "action", type: '"create"', required: true, desc: "—" },
          { name: "client_id", type: "number", required: true, desc: "Positive integer." },
          { name: "effective_date", type: "string", required: true, desc: "YYYY-MM-DD." },
          { name: "reason", type: "string", required: true, desc: "1–500 chars; why this entry exists." },
          { name: "reference", type: "string | null", desc: "Max 200 chars; external ticket/PO reference." },
          { name: "lines", type: "Line[]", required: true, desc: "Same line shape as preview." },
          { name: "submit", type: "boolean", desc: "Default false. When true, the entry is submitted immediately — and auto-approved if the creator is an admin and the total is at or below the approval threshold." },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Response (200)"
        code={`{ "ok": true, "id": 17, "total": 61250, "requires_approval": true }`}
      />

      <H3 id="me-transitions">action: "submit" | "approve" | "void"</H3>
      <ParamTable
        rows={[
          { name: "action", type: "string", required: true, desc: <><code>submit</code>, <code>approve</code> (admin or editor), or <code>void</code>.</> },
          { name: "id", type: "number", required: true, desc: "Manual entry id." },
          { name: "reason", type: "string", desc: "Void reason, max 500 chars (void only)." },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Responses"
        code={`// 200
{ "ok": true }

// 409 — void refused: entry sits inside a finalized invoice
{ "ok": false, "error": "this entry falls inside a finalized invoice (LL-2026-0042); add an adjustment instead of voiding" }

// 400 unknown action
{ "ok": false, "error": "unknown action" }`}
      />
      <p>
        <strong>Side effects:</strong> writes <code>manual_entries</code> and mirror rows in{" "}
        <code>usage_daily</code> (<code>source=&apos;manual&apos;</code>). The revenue view ignores those rows
        until the entry is approved; voiding nulls the back-pointer so they drop out again. Audit
        actions: <code>manual_entry.create</code>, <code>manual_entry.submit</code>,{" "}
        <code>manual_entry.approve</code>, <code>manual_entry.void</code>.
      </p>
      <Callout variant="info" title="Approval threshold">
        Entries whose previewed revenue exceeds <code>MANUAL_ENTRY_APPROVAL_THRESHOLD</code>{" "}
        (default 50,000) always require an explicit approval by an admin or editor, even when
        created by an admin with <code>submit: true</code>.
      </Callout>

      {/* ─── Sync ──────────────────────────────────────────────────────── */}
      <H2 id="sync">Sync</H2>

      <H3 id="sync-backfill">Backfill a date range</H3>
      <Endpoint method="POST" path="/api/sync/backfill">
        <RoleChip role="admin" />
      </Endpoint>
      <p>
        Pulls a range of business dates from the usage source, one pull and one transaction per
        day. In the demo the pull is simulated (<code>MOCK_INTEGRATIONS=true</code>). The range is
        capped at <strong>31 days</strong> to stay inside the 300-second function limit. Split a
        longer range into several calls.
      </p>
      <ParamTable
        rows={[
          { name: "from", type: "string", required: true, desc: "YYYY-MM-DD, inclusive." },
          { name: "to", type: "string", required: true, desc: "YYYY-MM-DD, inclusive. Must be on or after from, and on or before yesterday (India Standard Time, the business-date zone the code uses)." },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Responses"
        code={`// 200 (ok:false if any date errored)
{ "ok": true, "results": [
  { "date": "2026-06-01", "status": "success", "rows": 412, "hits": 90211 },
  { "date": "2026-06-02", "status": "error", "rows": 0, "hits": 0, "error": "METABASE_USERNAME / METABASE_PASSWORD not configured" }
] }

// 400 — bad range
{ "ok": false, "error": "range too large (45 days, max 31) — split it into smaller ranges" }`}
      />
      <p>
        <strong>Side effects:</strong> per date, deletes that date&apos;s <code>source=&apos;log&apos;</code> rows
        and inserts the fresh pull (idempotent); writes a <code>sync_runs</code> row per date;
        records audit action <code>sync.backfill</code> with day count, failures, and total hits.
      </p>

      <H3 id="sync-refresh">Refresh now</H3>
      <Endpoint method="POST" path="/api/sync/refresh">
        <RoleChip role="admin" />
      </Endpoint>
      <p>
        &quot;Refresh now&quot;: pulls <strong>today and the two prior days</strong>, including
        today&apos;s partial data, and returns a before and after diff. The body is empty. When{" "}
        <code>MOCK_INTEGRATIONS=true</code>, as in the demo, it then runs the vendor-side pull for
        the last 10 days and the alert check. Alert emails are not sent from this route.
      </p>
      <CodeBlock
        lang="json"
        title="Response (200)"
        code={`{
  "ok": true,
  "diff": {
    "from": "2026-06-10", "to": "2026-06-12",
    "dates": [
      { "date": "2026-06-12", "status": "success",
        "hits_before": 0, "hits_after": 41200,
        "rows_before": 0, "rows_after": 230 }
    ],
    "movers": [
      { "account": "Acme Finance", "hits_before": 1200, "hits_after": 4100, "delta": 2900 }
    ],
    "hits_before": 178000, "hits_after": 219200,
    "unmapped_clients": [], "unmapped_apis": ["KYC Lite v2"]
  }
}`}
      />
      <p>
        <strong>Side effects:</strong> same delete-and-reinsert per date as the cron; writes{" "}
        <code>sync_runs</code> rows; in the demo, also writes <code>vendor_usage_daily</code> and{" "}
        <code>alerts</code>; records audit action <code>sync.refresh</code> with the hit deltas.
      </p>

      {/* ─── Invoices ──────────────────────────────────────────────────── */}
      <H2 id="invoices">Invoices</H2>

      <H3 id="invoice-pdf">Download statement PDF</H3>
      <Endpoint method="GET" path="/api/invoices/[account]/[period]/pdf">
        <RoleChip role="all" />
      </Endpoint>
      <ParamTable
        nameHeader="Param"
        rows={[
          { name: "account", type: "number (path)", required: true, desc: "Account id." },
          { name: "period", type: "number (path)", required: true, desc: "Billing period id." },
          { name: "variant", type: '"internal" | "customer"', desc: "Default internal. The internal variant shows vendor cost and margin, so it needs the admin or editor role (403 for a member). Any signed-in user can get the customer variant." },
          { name: "disposition", type: '"inline" | "attachment"', desc: "Default inline." },
        ]}
      />
      <p>
        Returns <code>application/pdf</code> bytes with a <code>Content-Disposition</code> filename.
        Errors: 401 unauthenticated, 403 member requesting the internal variant, 404{" "}
        <code>{`{ "ok": false, "error": "statement not found" }`}</code>, 500 render failure.
        Rate-limited to 10 renders per user per minute.
      </p>

      <H3 id="invoice-csv">Download statement CSV</H3>
      <Endpoint method="GET" path="/api/invoices/[account]/[period]/csv">
        <RoleChip role="all" />
      </Endpoint>
      <p>
        Same params and access rules as the PDF (default <code>disposition</code> is{" "}
        <code>attachment</code>). Returns <code>text/csv</code>: a commented metadata block, line
        items, an adjustments block, and a totals block. The internal variant adds{" "}
        <code>vendor_cost</code>, <code>margin</code>, <code>margin_pct</code>, and{" "}
        <code>is_estimated</code> columns that the customer variant omits. Rate-limited to 20
        exports per user per minute.
      </p>

      {/* ─── Search ────────────────────────────────────────────────────── */}
      <H2 id="search">Search</H2>

      <H3 id="search-accounts">Search accounts</H3>
      <Endpoint method="GET" path="/api/search/accounts?q=…">
        <RoleChip role="all" />
      </Endpoint>
      <p>
        Command-palette typeahead over account display names (<code>ILIKE</code> substring match).
        Returns a bare array — empty for a blank query, and <code>[]</code> with status 401 when
        unauthenticated. Max 8 results.
      </p>
      <CodeBlock
        lang="json"
        title="Response (200)"
        code={`[ { "id": 42, "slug": "acme-finance", "name": "Acme Finance", "status": "active" } ]`}
      />

      <H3 id="search-apis">Search APIs</H3>
      <Endpoint method="GET" path="/api/search/apis?q=…">
        <RoleChip role="all" />
      </Endpoint>
      <p>
        Same contract over active APIs, matching name or product code. Max 6 results; only{" "}
        <code>is_active = 1</code> rows. Shares the 60-requests-per-10-seconds budget with account
        search (one <code>search:&#123;userId&#125;</code> bucket).
      </p>
      <CodeBlock
        lang="json"
        title="Response (200)"
        code={`[ { "id": "PAN_ADV", "name": "PAN Advanced", "code": "PAN_ADV", "category": "KYC" } ]`}
      />

      {/* ─── Profile ───────────────────────────────────────────────────── */}
      <H2 id="profile">Profile</H2>
      <Endpoint method="PATCH" path="/api/profile">
        <RoleChip role="all" />
      </Endpoint>
      <p>
        Updates a user profile. Omitting <code>userId</code> edits your own profile; providing it
        edits another user, which requires admin. Role changes are admin-only — a non-admin&apos;s{" "}
        <code>role</code> field is silently ignored.
      </p>
      <ParamTable
        rows={[
          { name: "userId", type: "number", desc: "Target user id. Omit to edit yourself; admin-only otherwise." },
          { name: "display_name", type: "string", required: true, desc: "Trimmed, 1–120 chars." },
          { name: "emoji", type: "string | null", desc: "Must be in the curated emoji set; null clears it (initials fallback)." },
          { name: "job_title", type: "string | null", desc: "Trimmed to 120 chars; blank or null clears it." },
          { name: "role", type: '"admin" | "editor" | "member"', desc: "Admin-only. Demoting the last active admin is refused (422)." },
        ]}
      />
      <CodeBlock
        lang="json"
        title="Responses"
        code={`// 200
{ "ok": true, "user": { "id": 3, "display_name": "Priya N", "emoji": "🦊",
  "job_title": "Finance Ops", "role": "member" } }

// 422
{ "ok": false, "fieldErrors": { "role": "Cannot demote the last active admin." } }

// 403 non-admin editing someone else · 404 user not found
{ "ok": false, "error": "..." }`}
      />
      <p>
        <strong>Side effects:</strong> updates <code>users</code>; records audit action{" "}
        <code>user.profile_update</code>, plus <code>user.role_change</code> when the role changed.
      </p>

      {/* ─── Accounts, groups, operations ─────────────────────────────── */}
      <H2 id="accounts-groups">Accounts, groups, and account operations</H2>
      <p>
        These routes back the account list, account profiles, groups, and the merge and delete
        flow. Each mutating route checks same-origin and the listed action.
      </p>
      <ParamTable
        nameHeader="Route"
        rows={[
          { name: "PATCH /api/accounts/[id]", type: "account.update", desc: <>Body <code>{`{ account_id: number | null }`}</code>. Moves the account into a group, or clears the group with null.</> },
          { name: "GET /api/accounts/[id]/merge?target_id=…", type: "account.merge", desc: "Preview of a merge into the target account." },
          { name: "POST /api/accounts/[id]/merge", type: "account.merge", desc: <>Body <code>target_id</code>, optional <code>resolutions</code>, <code>note</code>, <code>revert_statement_ids</code>. An editor&apos;s request is stored as pending for an admin to approve.</> },
          { name: "GET /api/accounts/[id]/delete", type: "account.delete", desc: "Preview of a delete." },
          { name: "POST /api/accounts/[id]/delete", type: "account.delete", desc: <>Body optional <code>reason</code>, <code>revert_statement_ids</code>. Same approval rule as merge.</> },
          { name: "POST /api/account-operations/[opId]/decide", type: "account.op.approve", desc: <>Body <code>{`{ action: "approve" | "reject" }`}</code> plus optional <code>resolutions</code> and <code>revert_statement_ids</code>. An admin cannot approve their own request (403). 409 when already decided.</> },
          { name: "POST /api/account-operations/[opId]/reverse", type: "account.op.approve", desc: <>Undoes an executed merge or delete inside its undo window (<code>ACCOUNT_OP_UNDO_DAYS</code>, default 30).</> },
          { name: "GET /api/accounts/logo/fetch?domain=…", type: "account.update", desc: <>Fetches a logo from logo.dev and returns it as a data URI. 503 when <code>LOGODEV_PUBLISHABLE_KEY</code> is unset.</> },
          { name: "GET /api/account-logo/[slug]", type: "session", desc: <>Returns the stored logo as image bytes from <code>clients.logo_data_url</code>. 404 when there is none.</> },
          { name: "POST /api/groups", type: "group.create", desc: <>Body <code>{`{ name }`}</code>, 1–200 chars. 409 on a duplicate name.</> },
          { name: "PATCH /api/groups/[id]", type: "group.update", desc: <>Body <code>{`{ name }`}</code>. Renames the group.</> },
          { name: "DELETE /api/groups/[id]", type: "group.delete", desc: <>Deletes the group. With <code>?merge_into=[id]</code>, moves its accounts into that group first.</> },
        ]}
      />

      {/* ─── Vendors ───────────────────────────────────────────────────── */}
      <H2 id="vendors">Vendors</H2>
      <ParamTable
        nameHeader="Route"
        rows={[
          { name: "POST /api/vendor", type: "vendor_pricing.edit", desc: <>Edits a vendor registry entry. Body <code>vendor_id</code> plus any of <code>canonical_name</code>, <code>status</code> (active | inactive), <code>charges_sandbox</code>, <code>add_alias</code>, <code>remove_alias</code>. A rename keeps the old spelling as an alias.</> },
          { name: "POST /api/vendor-commitment", type: "vendor_pricing.edit", desc: <>Sets a vendor&apos;s monthly minimum. Body <code>vendor_name</code>, <code>monthly_minimum</code> (number or null to end it), optional <code>status</code>, <code>source</code>, <code>effective_from</code>. The date is snapped to the first of a month.</> },
        ]}
      />

      {/* ─── Palette, hover, notifications ─────────────────────────────── */}
      <H2 id="palette">Palette, hover cards, and notifications</H2>
      <p>All of these need a signed-in user and are read-only, except the notifications PATCH.</p>
      <ParamTable
        nameHeader="Route"
        rows={[
          { name: "GET /api/search?q=…", type: "session", desc: "Grouped palette search across accounts, invoices, groups, APIs, manual entries, vendors, and audit entries. Uses the search rate-limit bucket." },
          { name: "GET /api/ask?q=…", type: "session", desc: <>Answers revenue, hits, unpriced, variance, and relation questions from deterministic templates. Also accepts a structured form (<code>metric</code>, <code>entityType</code>, <code>topN</code>). 30 requests per 10 s.</> },
          { name: "GET /api/cmd/options?slot=…", type: "session", desc: "Picker options (accounts, groups, APIs) for the palette's ask cues. Names and codes only. 400 for an unknown slot." },
          { name: "GET /api/context?path=…&period=…", type: "session", desc: "Resolves the entity behind the current page so the palette can offer actions for that page." },
          { name: "GET /api/hover/account/[slug]", type: "session", desc: "Data for the account hover card." },
          { name: "GET /api/hover/api/[code]", type: "session", desc: "Data for the API hover card. Margin is included only for admins and editors." },
          { name: "GET /api/notifications", type: "session", desc: <>Returns <code>{`{ ok, items, unread }`}</code> for the current user.</> },
          { name: "PATCH /api/notifications", type: "session", desc: <>Body <code>{`{ action: "mark_read", ids }`}</code> or <code>{`{ action: "mark_all_read" }`}</code>.</> },
        ]}
      />

      {/* ─── Auth ──────────────────────────────────────────────────────── */}
      <H2 id="auth">Auth</H2>
      <Endpoint method="GET" path="/api/auth/[...nextauth]">
        <RoleChip role="public" />
      </Endpoint>
      <Endpoint method="POST" path="/api/auth/[...nextauth]">
        <RoleChip role="public" />
      </Endpoint>
      <p>
        NextAuth&apos;s catch-all handlers (sign-in, callback, sign-out, session). The only
        provider is the demo Credentials provider (id <code>demo</code>), which signs in an active
        seeded user by email. Sessions are JWTs. See{" "}
        <a href="/help/api/integrations#nextauth">Integrations: sign-in</a>.
      </p>

      {/* ─── Scheduled routes ──────────────────────────────────────────── */}
      <H2 id="cron">Scheduled routes</H2>
      <p>
        These routes accept only <code>Authorization: Bearer &lt;CRON_SECRET&gt;</code> and return
        401 otherwise. The middleware lets <code>/api/cron</code> through without a session.{" "}
        <FilePath>vercel.json</FilePath> declares no crons, so in the demo nothing calls the{" "}
        <code>/api/cron/*</code> routes on a schedule. You can call them by hand.
      </p>

      <H3 id="cron-usage-sync">Usage sync</H3>
      <Endpoint method="GET" path="/api/cron/usage-sync">
        <RoleChip role="cron" />
      </Endpoint>
      <p>Each run, inside <code>maxDuration = 300</code>:</p>
      <ul>
        <li>Re-pulls the trailing <strong>3 closed days</strong> (yesterday and the 2 days before it).</li>
        <li>Re-pulls older dates since <code>SYNC_EPOCH</code> that have no successful <code>sync_runs</code> row with data, up to 60 per run. In this build, <code>SYNC_EPOCH</code> is the first day of the month two months before today, to match the seed data.</li>
        <li>With <code>?mode=retry</code>, skips the trailing re-pull and pulls only dates that are still missing.</li>
      </ul>
      <CodeBlock
        lang="json"
        title="Responses"
        code={`// 200 — all dates synced (500 with ok:false if any failed)
{ "ok": true, "synced": [
  { "date": "2026-06-11", "status": "success", "rows": 431, "hits": 95012,
    "unmapped_clients": 0, "unmapped_apis": 1 }
] }

// 401 — missing or wrong bearer token
{ "ok": false, "error": "unauthorized" }`}
      />
      <p>
        <strong>Side effects:</strong> per date, replaces <code>source=&apos;log&apos;</code> rows in{" "}
        <code>usage_daily</code> and writes a <code>sync_runs</code> row. No audit entry, because
        the route has no user.
      </p>

      <H3 id="cron-other">Other scheduled routes</H3>
      <ParamTable
        nameHeader="Route"
        rows={[
          { name: "GET /api/cron/vendor-recon-sync", type: "cron", desc: "Pulls the vendor side for the last 10 days into vendor_usage_daily." },
          { name: "GET /api/cron/alerts", type: "cron", desc: <>Evaluates alert rules for synced dates, then sends alert emails. <code>?dry=1&amp;from=…&amp;to=…</code> returns what each date would open. <code>?dry=daily</code> and <code>?dry=critical</code> return email HTML.</> },
          { name: "GET /api/cron/roundup-daily | roundup-weekly | roundup-monthly", type: "cron", desc: <>Revenue roundup emails. <code>?dry=1</code> returns the HTML and sends nothing.</> },
          { name: "GET /api/cron/product-update-weekly", type: "cron", desc: <>Weekly API usage email. <code>?dry=1</code> returns the HTML. Skipped when the recipient list is empty.</> },
          { name: "GET /api/cron/purge-account-ops", type: "cron", desc: "Makes executed merges and deletes permanent once their undo window has passed." },
          { name: "POST /api/cache/revalidate", type: "cron", desc: <>Calls <code>revalidateRevenue()</code> to clear every cached revenue read. The nightly reset job calls it after it reseeds the database.</> },
        ]}
      />
      <p>
        One more unauthenticated route exists: <code>GET /api/warm</code> runs{" "}
        <code>SELECT 1</code> during a weekday working window (09:00–19:00 India Standard Time) so
        an outside pinger can keep the database awake. Outside that window it returns without a
        query.
      </p>

      <Related
        links={[
          { href: "/help/api", label: "API reference" },
          { href: "/help/api/actions", label: "Server actions" },
          { href: "/help/api/integrations", label: "Integrations" },
          { href: "/help/api/database", label: "Database schema" },
        ]}
      />
    </DocPage>
  );
}
