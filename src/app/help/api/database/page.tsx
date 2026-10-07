import type { Metadata } from "next";
import { DocPage } from "@/components/help/DocPage";
import {
  H2,
  H3,
  ParamTable,
  CodeBlock,
  Callout,
  FilePath,
  Related,
} from "@/components/help/doc";

export const metadata: Metadata = { title: "Database schema" };

export default function DatabaseSchemaPage() {
  return (
    <DocPage
      crumbs={[{ href: "/help/api", label: "API reference" }]}
      title="Database schema"
      lede="The tables in the Ledgerline database, grouped by domain, and the usage_daily_with_revenue view that turns raw usage into revenue and margin numbers."
    >
      <p>
        The full schema is one file, <FilePath>migrations/0001_baseline.sql</FilePath>.{" "}
        <FilePath>scripts/db-setup.ts</FilePath> applies every file in{" "}
        <FilePath>migrations/</FilePath> that is not yet recorded in{" "}
        <code>schema_migrations</code>. <code>npm run dev</code> runs it before seeding. A new
        schema change is a new numbered file in the same folder. Conventions: ids are{" "}
        <code>bigint</code> with a sequence, money is <code>NUMERIC(14,4)</code>, dates are{" "}
        <code>DATE</code> (read back as ISO strings, see{" "}
        <a href="/help/api/integrations#neon">Postgres</a>), timestamps are{" "}
        <code>TIMESTAMPTZ</code>, and most flags are <code>INTEGER</code> 0/1.
      </p>

      {/* ─── Identity ──────────────────────────────────────────────────── */}
      <H2 id="identity">Identity</H2>

      <H3 id="users">users</H3>
      <p>Everyone who can sign in. Sign-in never creates a row. The demo seeds the users.</p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "User id, referenced by every created_by/approved_by column." },
          { name: "email", type: "text", desc: "Unique, stored lowercase. Sign-in looks the user up by this." },
          { name: "google_sub", type: "text | null", desc: "Unique. An external identity id. The demo Credentials sign-in does not use it." },
          { name: "display_name", type: "text", desc: "Shown in the UI and audit log." },
          { name: "role", type: "text", desc: <>CHECK <code>admin</code> | <code>editor</code> | <code>member</code>.</> },
          { name: "status", type: "text", desc: <>CHECK <code>active</code> | <code>invited</code> | <code>disabled</code>; default <code>invited</code>.</> },
          { name: "invited_by", type: "bigint | null", desc: "FK → users.id." },
          { name: "created_at", type: "timestamptz", desc: "Default NOW()." },
          { name: "last_login_at", type: "timestamptz | null", desc: "Stamped on each successful sign-in." },
          { name: "invite_expires_at", type: "timestamptz | null", desc: "Expiry of a pending invite." },
          { name: "emoji", type: "text | null", desc: "Avatar emoji from the curated set; null falls back to initials." },
          { name: "job_title", type: "text | null", desc: "Free-text title shown on the profile." },
        ]}
      />
      <p>
        Indexes: <code>idx_users_email</code>, <code>idx_users_google_sub</code>.
      </p>

      <H3 id="schema-migrations">schema_migrations</H3>
      <p>
        Bookkeeping for <FilePath>scripts/db-setup.ts</FilePath> and{" "}
        <FilePath>scripts/migrate.ts</FilePath>. The script creates this table, so it is not in
        the baseline file.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "version", type: "text PK", desc: <>The numeric prefix of the migration file (for example <code>0001</code>).</> },
          { name: "name", type: "text", desc: "The rest of the filename." },
          { name: "applied_at", type: "timestamptz", desc: "Default NOW()." },
        ]}
      />

      {/* ─── Catalog ───────────────────────────────────────────────────── */}
      <H2 id="catalog">Catalog</H2>
      <p>
        Naming note: the table names differ from the UI names. <strong>Accounts</strong> are
        stored in the <code>clients</code> table and <strong>groups</strong> are stored in the{" "}
        <code>accounts</code> table. Columns use the table names (<code>client_id</code>,{" "}
        <code>account_id</code>). Headings below use the table names.
      </p>

      <H3 id="accounts">accounts <span className="text-ink-muted font-normal">(groups)</span></H3>
      <p>Optional parent grouping above accounts (one group, many billing accounts).</p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Group id." },
          { name: "name", type: "text", desc: "Unique." },
          { name: "created_at", type: "timestamptz", desc: "Default NOW()." },
        ]}
      />

      <H3 id="clients">clients <span className="text-ink-muted font-normal">(accounts)</span></H3>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Account id." },
          { name: "account_id", type: "bigint | null", desc: "FK → accounts.id (the group), ON DELETE SET NULL." },
          { name: "display_name", type: "text", desc: "Unique. The canonical name everywhere in the UI." },
          { name: "slug", type: "text | null", desc: "Unique URL-safe slug generated from display_name; routes use it (/accounts/[slug])." },
          { name: "log_aliases", type: "text (JSON)", desc: "JSON array of raw log names that resolve to this account. Default []." },
          { name: "billing_entity", type: "text | null", desc: "Legal entity printed on statements." },
          { name: "gstin", type: "text | null", desc: "Tax id for statements." },
          { name: "client_code", type: "text | null", desc: "Short account code. Unique when set." },
          { name: "website / cs_owner / sales_owner", type: "text | null", desc: "Profile fields." },
          { name: "logo_data_url", type: "text | null", desc: "Logo stored as a base64 data URI. Served by /api/account-logo/[slug]." },
          { name: "msa_url / msa_start_date / msa_end_date", type: "text / date | null", desc: "Contract link and dates." },
          { name: "status", type: "text", desc: <>CHECK <code>active</code> | <code>paused</code> | <code>sandbox</code>; default <code>active</code>.</> },
          { name: "is_sandbox", type: "integer", desc: "0/1, default 0. Sandbox accounts can be excluded from revenue views through the sandbox setting." },
          { name: "deleted_at / deleted_by / deleted_reason", type: "… | null", desc: "Soft delete, set by an executed delete or merge." },
          { name: "merged_into", type: "bigint | null", desc: "FK → clients.id. The target of an executed merge." },
          { name: "created_at", type: "timestamptz", desc: "Default NOW()." },
        ]}
      />
      <p>
        Indexes: <code>idx_clients_account</code> on <code>account_id</code>,{" "}
        <code>idx_clients_deleted_at</code>, and the partial unique index{" "}
        <code>clients_client_code_key</code>.
      </p>

      <H3 id="apis">apis</H3>
      <p>The SKU catalog. The SKU code is the primary key — renames re-point every child table transactionally (see <a href="/help/api/endpoints#update-api">PATCH /api/apis/[code]</a>).</p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "product_code", type: "text PK", desc: "Uppercase code, 1–32 chars." },
          { name: "name", type: "text", desc: "Display name; must not collide with another SKU's name or alias." },
          { name: "log_aliases", type: "text (JSON)", desc: "JSON array of raw log names. Default []." },
          { name: "category", type: "text | null", desc: "Free-text product line (Models, Messaging, …)." },
          { name: "unit", type: "text", desc: "What one billed unit is: 1M tokens, minute, message, GPU-hour. Default call." },
          { name: "entity_type", type: "text | null", desc: "Legacy column. The app no longer writes it." },
          { name: "vendor_type", type: "text | null", desc: <><code>InHouse</code> | <code>Vendor</code> | <code>Stitched</code> | <code>Journey</code>.</> },
          { name: "default_vendor", type: "text | null", desc: "Vendor stamped on synced usage rows for cost attribution." },
          { name: "is_active", type: "integer", desc: "0/1, default 1. Inactive SKUs drop out of search and pickers." },
        ]}
      />

      {/* ─── Pricing ───────────────────────────────────────────────────── */}
      <H2 id="pricing">Pricing</H2>

      <H3 id="pricing-table">pricing</H3>
      <p>
        Account sell rates, four tiers per row, with full temporal history — an (account, SKU) pair
        accumulates rows over time and the view picks the latest row whose{" "}
        <code>effective_from</code> is on or before the usage date.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Row id." },
          { name: "client_id", type: "bigint", desc: "FK → clients.id, ON DELETE CASCADE." },
          { name: "api_code", type: "text", desc: "FK → apis.product_code, ON DELETE CASCADE." },
          { name: "price_successful", type: "numeric(14,4)", desc: "Per successful unit. Default 0." },
          { name: "price_successful_no_data", type: "numeric(14,4)", desc: "Per successful-no-data unit. Default 0." },
          { name: "price_failed", type: "numeric(14,4)", desc: "Per failed unit. Default 0." },
          { name: "price_in_progress", type: "numeric(14,4)", desc: "Per in-progress unit. Default 0." },
          { name: "pricing_model", type: "text", desc: <>CHECK <code>flat</code> | <code>tier</code> | <code>slab</code>; default <code>flat</code>. <code>tier</code> (graduated) and <code>slab</code> (whole-volume) ignore the four price_* columns and read brackets from <code>pricing_slab</code>.</> },
          { name: "effective_from", type: "date", desc: "Default 2026-01-01. New rows from the UI default to today. Billed pairs supersede at today." },
          { name: "created_at", type: "timestamptz", desc: "Default NOW()." },
        ]}
      />
      <p>
        Constraints: UNIQUE <code>(client_id, api_code, effective_from)</code>. Indexes:{" "}
        <code>idx_pricing_client</code>, <code>idx_pricing_api</code>, and{" "}
        <code>idx_pricing_pair_date</code> on (client_id, api_code, effective_from) — the one the
        view&apos;s temporal lookup rides.
      </p>

      <H3 id="vendors">vendors / vendor_aliases</H3>
      <p>
        The vendor registry. One <code>vendors</code> row per real vendor (<code>id</code>,{" "}
        <code>canonical_name</code>, <code>status</code> active | inactive,{" "}
        <code>charges_sandbox</code> boolean, default true), and
        one <code>vendor_aliases</code> row per spelling that means it — including its own
        canonical name, so resolving a name is one lookup on one table. Unique indexes are
        case-insensitive: <code>uq_vendors_canonical_name</code> on lower(canonical_name),
        <code>uq_vendor_aliases_alias</code> on lower(alias). Renaming a vendor updates
        <code>canonical_name</code> and leaves the old spelling behind as an alias, so incoming
        usage still resolves to the same vendor.
      </p>

      <H3 id="vendor-pricing">vendor_pricing</H3>
      <p>Cost rates per (vendor, SKU) pair — the cost side of margin math. Same temporal model, no billing lock (costs are internal).</p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Row id." },
          { name: "vendor_id", type: "bigint", desc: "FK → vendors.id." },
          { name: "api_code", type: "text", desc: "FK → apis.product_code, ON DELETE CASCADE." },
          { name: "cost_successful", type: "numeric(14,4) | null", desc: "Nullable, no default. NULL = rate unknown; 0 = confirmed not charged." },
          { name: "cost_successful_no_data", type: "numeric(14,4) | null", desc: "Nullable, no default." },
          { name: "cost_failed", type: "numeric(14,4) | null", desc: "Nullable, no default." },
          { name: "cost_in_progress", type: "numeric(14,4) | null", desc: "Nullable, no default." },
          { name: "effective_from", type: "date", desc: "Default 2026-01-01." },
          { name: "status", type: "text", desc: "estimated | quoted | contracted (CHECK), default estimated." },
          { name: "source", type: "text | null", desc: "Document name or note behind the rate." },
          { name: "cost_basis", type: "text", desc: <>CHECK <code>vendor</code> | <code>in_house</code> | <code>components</code>; default <code>vendor</code>. Any value other than <code>vendor</code> makes the view cost the row at 0.</> },
          { name: "pricing_model", type: "text", desc: <>CHECK <code>flat</code> | <code>tier</code> | <code>slab</code>; default <code>flat</code>. Volume models read brackets from <code>vendor_pricing_slab</code>.</> },
        ]}
      />
      <p>
        Constraints: UNIQUE <code>(vendor_id, api_code, effective_from)</code>. Index:{" "}
        <code>idx_vendor_pricing_pair</code> (vendor_id, api_code).
      </p>

      <H3 id="vendor-usage-daily">vendor_usage_daily</H3>
      <p>
        What each vendor says it served, per day per SKU — the outside record computed cost is
        checked against. With a real source it comes from the upstream table{" "}
        <code>vendor_usage_report</code>. In the demo it is simulated from local usage. It is
        written by <code>npm run vendor-sync</code>, <code>/api/cron/vendor-recon-sync</code>, and
        Refresh now.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Row id." },
          { name: "date", type: "date", desc: "The vendor's report_date." },
          { name: "vendor", type: "text", desc: "Canonical spelling, resolved through the vendor registry at sync time so it matches usage_daily.vendor." },
          { name: "api_code", type: "text | null", desc: "FK → apis.product_code, ON DELETE SET NULL. NULL when the vendor-reported name matches nothing in the catalog — the source carries no SKU code, so the match runs on apis.name + log_aliases." },
          { name: "raw_api_name", type: "text", desc: "vendor_usage_report.type_label: the display name the catalog match runs on." },
          { name: "raw_api_slug", type: "text", desc: "vendor_usage_report.api_name: the endpoint slug. Neither name nor slug is unique alone." },
          { name: "successful", type: "bigint", desc: "Vendor-side count." },
          { name: "successful_no_data", type: "bigint", desc: "Vendor-side count." },
          { name: "failed", type: "bigint", desc: "Vendor-side count." },
          { name: "synced_at", type: "timestamptz", desc: "Last time this row was restated." },
        ]}
      />
      <p>
        <strong>There is no in_progress column</strong>, because the source has none. Every
        reconciliation therefore excludes in-progress units on our side too, or the delta would be
        an artifact of the schema rather than a finding. Constraints: UNIQUE{" "}
        <code>(date, vendor, raw_api_name, raw_api_slug)</code>. The real-source query takes MAX
        per key, so exact duplicate rows in the source collapse to one. Indexes:{" "}
        <code>idx_vendor_usage_daily_window</code> (date, vendor) and{" "}
        <code>idx_vendor_usage_daily_api</code> (api_code, date).
      </p>

      <H3 id="vendor-recon-dismissals">vendor_recon_dismissals</H3>
      <p>
        One accepted reconciliation delta. Unlike <code>leak_dismissals</code>, which suppresses a
        pair permanently, a row here covers <em>one month</em>: a delta is a fact about a period,
        and a permanent dismissal would hide the month the gap changes shape.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Row id." },
          { name: "vendor", type: "text", desc: "Vendor the delta belongs to." },
          { name: "api_code", type: "text | null", desc: "FK → apis.product_code, ON DELETE CASCADE. NULL together with raw_api_name means an unmatched vendor-side name." },
          { name: "raw_api_name", type: "text | null", desc: "Set only when api_code is null." },
          { name: "period_month", type: "date", desc: "First day of the month accepted." },
          { name: "dismissed_by", type: "bigint | null", desc: "FK → users.id." },
          { name: "reason", type: "text | null", desc: "Optional note." },
          { name: "created_at", type: "timestamptz", desc: "When it was accepted." },
        ]}
      />
      <p>
        Unique index <code>idx_vendor_recon_dismissals_item</code> on{" "}
        <code>(vendor, COALESCE(api_code, &apos;&apos;), COALESCE(raw_api_name, &apos;&apos;), period_month)</code>{" "}
        — the COALESCE is load-bearing, since Postgres treats NULLs as distinct in a plain UNIQUE
        constraint and an unmatched item could otherwise be accepted twice.
      </p>

      <H3 id="api-bundles">api_bundles</H3>
      <p>
        Stitched SKU groups: several catalog SKUs billed to one account as a single product. The
        anchor SKU&apos;s units carry the bundle price; other members bill at 0.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Bundle id." },
          { name: "client_id", type: "bigint", desc: "FK → clients.id, ON DELETE CASCADE. Bundles are per-account." },
          { name: "name", type: "text", desc: "Stitch name; appears as the line label on invoices." },
          { name: "anchor_api_code", type: "text", desc: "FK → apis.product_code. The member whose units are billed." },
          { name: "created_at", type: "timestamptz", desc: "Default NOW()." },
        ]}
      />
      <p>Constraint: UNIQUE <code>(client_id, name)</code>.</p>

      <H3 id="api-bundle-members">api_bundle_members</H3>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "bundle_id", type: "bigint", desc: "FK → api_bundles.id, ON DELETE CASCADE." },
          { name: "client_id", type: "bigint", desc: "FK → clients.id, ON DELETE CASCADE. Denormalized for the unique constraint below." },
          { name: "api_code", type: "text", desc: "FK → apis.product_code, ON DELETE CASCADE." },
        ]}
      />
      <p>
        Constraints: PRIMARY KEY <code>(bundle_id, api_code)</code> and UNIQUE{" "}
        <code>(client_id, api_code)</code> — a SKU can belong to at most one stitch per account,
        which is what lets the revenue view join membership without ambiguity. Index:{" "}
        <code>idx_bundle_members_client</code> (client_id, api_code).
      </p>

      <H3 id="bundle-pricing">bundle_pricing</H3>
      <p>Temporal price history per bundle, mirroring the pricing table&apos;s model.</p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Row id." },
          { name: "bundle_id", type: "bigint", desc: "FK → api_bundles.id, ON DELETE CASCADE." },
          { name: "price_successful", type: "numeric(14,4)", desc: "Bundle rate per successful anchor unit. Default 0." },
          { name: "price_successful_no_data", type: "numeric(14,4)", desc: "Default 0." },
          { name: "price_failed", type: "numeric(14,4)", desc: "Default 0." },
          { name: "price_in_progress", type: "numeric(14,4)", desc: "Default 0." },
          { name: "effective_from", type: "date", desc: "Usage before the bundle's earliest row bills at individual SKU pricing." },
          { name: "created_at", type: "timestamptz", desc: "Default NOW()." },
        ]}
      />
      <p>Constraint: UNIQUE <code>(bundle_id, effective_from)</code>.</p>

      <H3 id="pricing-slab">pricing_slab</H3>
      <p>
        Volume brackets for a <code>pricing</code> row whose <code>pricing_model</code> is{" "}
        <code>tier</code> or <code>slab</code>. Brackets apply to the period&rsquo;s total units (see{" "}
        <a href="/help/math#slabs">the volume pricing math</a>). Each bracket prices the four
        outcomes separately. <code>vendor_pricing_slab</code> has the same shape for vendor
        costs, keyed by <code>vendor_pricing_id</code>.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Row id." },
          { name: "pricing_id", type: "bigint", desc: "FK → pricing.id, ON DELETE CASCADE. The slab set is versioned with its parent pricing row." },
          { name: "min_hits", type: "integer", desc: "Exclusive lower bound (the previous tier's cap); 0 for the first tier." },
          { name: "max_hits", type: "integer | null", desc: "Inclusive upper cap; NULL marks the single open-ended top tier." },
          { name: "price_successful", type: "numeric(14,4)", desc: "Per successful unit in this tier. Default 0." },
          { name: "price_successful_no_data", type: "numeric(14,4)", desc: "Default 0." },
          { name: "price_failed", type: "numeric(14,4)", desc: "Default 0." },
          { name: "price_in_progress", type: "numeric(14,4)", desc: "Default 0." },
        ]}
      />
      <p>
        Constraints: UNIQUE <code>(pricing_id, min_hits)</code> and CHECK{" "}
        <code>max_hits IS NULL OR max_hits &gt; min_hits</code>. Index:{" "}
        <code>idx_pricing_slab_pricing</code> (pricing_id).
      </p>

      {/* ─── Usage ─────────────────────────────────────────────────────── */}
      <H2 id="usage">Usage</H2>

      <H3 id="usage-daily">usage_daily</H3>
      <p>
        The fact table: one row per (date, account, SKU, <code>hits_via</code>) with unit counts by outcome.
        Rows come from the usage sync (<code>source=&apos;log&apos;</code>), rows loaded with{" "}
        <code>source=&apos;import&apos;</code>, and manual entries (<code>&apos;manual&apos;</code>).
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Row id (exposed as usage_id in the view)." },
          { name: "date", type: "date", desc: "Business date (IST)." },
          { name: "client_id", type: "bigint | null", desc: "FK → clients.id, ON DELETE SET NULL. NULL = quarantined (unmapped raw name)." },
          { name: "api_code", type: "text | null", desc: "FK → apis.product_code, ON DELETE SET NULL. NULL = quarantined." },
          { name: "raw_client_name", type: "text", desc: "Name exactly as the log reported it; alias resolution heals quarantine by this." },
          { name: "raw_api_name", type: "text", desc: "Raw SKU name from the log." },
          { name: "raw_api_code", type: "text | null", desc: "SKU code as the log reported it. Kept when api_code is NULL so /admin/sku-review can show it." },
          { name: "hits_via", type: "text | null", desc: "Integration, Console, or Bulk." },
          { name: "vendor", type: "text | null", desc: "The vendor name exactly as the source reported it, kept beside the key like raw_client_name is." },
          { name: "vendor_id", type: "bigint | null", desc: "FK → vendors.id. Resolved on write through the registry. vendor_pricing joins on it." },
          { name: "successful", type: "integer", desc: "Unit count, default 0." },
          { name: "successful_no_data", type: "integer", desc: "Default 0." },
          { name: "failed", type: "integer", desc: "Default 0." },
          { name: "in_progress", type: "integer", desc: "Default 0." },
          { name: "source", type: "text", desc: <>CHECK <code>log</code> | <code>manual</code> | <code>import</code>; default <code>log</code>.</> },
          { name: "manual_entry_id", type: "bigint | null", desc: "FK → manual_entries.id, ON DELETE SET NULL. Back-pointer for manual rows; voiding nulls it." },
        ]}
      />
      <p>
        Indexes: <code>idx_usage_date</code>, <code>idx_usage_client</code>,{" "}
        <code>idx_usage_api</code>, <code>idx_usage_date_client</code>,{" "}
        <code>idx_usage_date_api</code>, <code>idx_usage_manual_entry</code>,{" "}
        <code>idx_usage_vendor_id</code>. Plus the partial
        unique index <code>uq_usage_daily_log_row</code> on{" "}
        <code>(date, raw_client_name, raw_api_name, COALESCE(hits_via, &apos;&apos;), COALESCE(vendor, &apos;&apos;))</code> WHERE{" "}
        <code>source = &apos;log&apos;</code> — a guard against concurrent double-runs of the sync
        (the main guard is the per-date delete and insert transaction; the index is partial so
        import rows cannot violate it).
      </p>

      <H3 id="manual-entries">manual_entries</H3>
      <p>
        Header records for off-stream usage (manual corrections, bulk CSV imports). Lines live as{" "}
        <code>usage_daily</code> rows pointing back via <code>manual_entry_id</code>; revenue is
        earned only at <code>status=&apos;approved&apos;</code>.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Entry id." },
          { name: "client_id", type: "bigint", desc: "FK → clients.id, ON DELETE CASCADE." },
          { name: "effective_date", type: "date", desc: "Business date the usage lands on." },
          { name: "reason", type: "text", desc: "Why the entry exists (required, 1–500 chars)." },
          { name: "reference", type: "text | null", desc: "External ticket/PO reference." },
          { name: "attachment_path", type: "text | null", desc: "Optional supporting document." },
          { name: "source", type: "text", desc: <>CHECK <code>manual</code> | <code>import</code>; default <code>manual</code>.</> },
          { name: "import_hash", type: "text | null", desc: "Unique. Idempotency key for CSV imports — re-importing the same file is a no-op." },
          { name: "status", type: "text", desc: <>CHECK <code>draft</code> | <code>pending_approval</code> | <code>approved</code> | <code>void</code>; default <code>draft</code>.</> },
          { name: "total_revenue", type: "numeric(14,4)", desc: "Revenue snapshot taken at approval time. Default 0." },
          { name: "created_by", type: "bigint", desc: "FK → users.id." },
          { name: "created_at", type: "timestamptz", desc: "Default NOW()." },
          { name: "approved_by / approved_at", type: "bigint / timestamptz | null", desc: "Set on approval." },
          { name: "voided_by / voided_at / void_reason", type: "… | null", desc: "Set on void; voiding also nulls the usage_daily back-pointers." },
        ]}
      />
      <p>
        Indexes: <code>idx_manual_entries_client</code>, <code>idx_manual_entries_status</code>,{" "}
        <code>idx_manual_entries_date</code>.
      </p>

      {/* ─── Billing ───────────────────────────────────────────────────── */}
      <H2 id="billing">Billing</H2>

      <H3 id="billing-periods">billing_periods</H3>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Period id (the [period] route param)." },
          { name: "label", type: "text", desc: 'Human label, e.g. "May 2026".' },
          { name: "start_date / end_date", type: "date", desc: "Inclusive bounds. UNIQUE together." },
          { name: "status", type: "text", desc: <>CHECK <code>open</code> | <code>closed</code>; default <code>open</code>.</> },
          { name: "closed_at / closed_by", type: "timestamptz / bigint | null", desc: "Set when the period closes; closed_by FK → users.id." },
          { name: "created_at", type: "timestamptz", desc: "Default NOW()." },
        ]}
      />

      <H3 id="statements">statements</H3>
      <p>
        Invoice headers — immutable snapshots taken at finalize time, one per (account, period).
        Status walks <code>draft → final → issued</code> and never back.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Statement id." },
          { name: "client_id", type: "bigint", desc: "FK → clients.id, ON DELETE CASCADE." },
          { name: "period_id", type: "bigint", desc: "FK → billing_periods.id, ON DELETE CASCADE." },
          { name: "number", type: "text", desc: <>Unique, public-facing. Drafts get a provisional <code>LL-DRAFT-…</code> number; finalize allocates the real <code>LL-YYYY-NNNN</code> from invoice_sequence.</> },
          { name: "status", type: "text", desc: <>CHECK <code>draft</code> | <code>final</code> | <code>issued</code>; default <code>draft</code>.</> },
          { name: "total_revenue / total_vendor_cost / total_margin", type: "numeric(14,4)", desc: "Snapshot totals. Default 0." },
          { name: "total_hits", type: "bigint", desc: "Default 0." },
          { name: "generated_at / generated_by", type: "timestamptz / bigint | null", desc: "Set at finalize." },
          { name: "issued_at / issued_by", type: "timestamptz / bigint | null", desc: "Set at issue." },
          { name: "notes", type: "text | null", desc: "Internal notes." },
          { name: "created_at", type: "timestamptz", desc: "Default NOW()." },
          { name: "cost_hits / cost_contracted / cost_quoted / cost_estimated / cost_not_billed / cost_unknown", type: "integer | null", desc: "Unit counts by vendor-cost confidence, snapshotted at finalize." },
        ]}
      />
      <p>
        Constraints: UNIQUE <code>number</code>, UNIQUE <code>(client_id, period_id)</code>.
        Indexes: <code>idx_statements_client</code>, <code>idx_statements_period</code>,{" "}
        <code>idx_statements_status</code> (client_id, status) — the one{" "}
        <code>isBilledPair()</code> and the billing lock ride.
      </p>

      <H3 id="statement-lines">statement_lines</H3>
      <p>
        Per-SKU snapshot lines: unit counts, the unit prices in force, and computed revenue/cost/
        margin — frozen so later pricing edits can never rewrite an issued invoice.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Line id." },
          { name: "statement_id", type: "bigint", desc: "FK → statements.id, ON DELETE CASCADE." },
          { name: "api_code", type: "text", desc: "Plain text, not an FK — survives catalog deletions. For a bundle line, the anchor SKU's code." },
          { name: "api_name", type: "text", desc: "Snapshot of the display name; for a bundle line, the stitch name." },
          { name: "successful / successful_no_data / failed / in_progress", type: "bigint", desc: "Unit counts. Default 0." },
          { name: "price_successful / …_no_data / …_failed / …_in_progress", type: "numeric(14,4)", desc: "Unit prices in force at finalize. Default 0." },
          { name: "vendor_cost / revenue / margin", type: "numeric(14,4)", desc: "Computed line totals. Default 0." },
          { name: "is_bundle", type: "integer", desc: "0/1, default 0. 1 = this line is a stitched bundle rolled up to one row." },
          { name: "vendor_estimated", type: "boolean", desc: "Default false. True when the line's vendor cost uses an estimated rate." },
        ]}
      />
      <p>
        Indexes: <code>idx_statement_lines_statement</code>,{" "}
        <code>idx_statement_lines_pair</code> (statement_id, api_code).
      </p>

      <H3 id="statement-adjustments">statement_adjustments</H3>
      <p>Signed credits/charges added between finalize and issue.</p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Adjustment id." },
          { name: "statement_id", type: "bigint", desc: "FK → statements.id, ON DELETE CASCADE." },
          { name: "label", type: "text", desc: "Printed on the statement." },
          { name: "amount", type: "numeric(14,4)", desc: "Signed; negative = credit." },
          { name: "notes", type: "text | null", desc: "Internal context." },
          { name: "created_at / created_by", type: "timestamptz / bigint", desc: "created_by FK → users.id." },
        ]}
      />
      <p>Index: <code>idx_statement_adjustments_statement</code>.</p>

      <H3 id="invoice-sequence">invoice_sequence</H3>
      <p>The yearly invoice-number counter, bumped atomically at finalize with an upsert.</p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "year", type: "integer PK", desc: "Calendar year." },
          { name: "last_seq", type: "integer", desc: <>Default 0. <code>last_seq + 1</code> becomes the NNNN in <code>LL-YYYY-NNNN</code>.</> },
        ]}
      />

      {/* ─── Ops ───────────────────────────────────────────────────────── */}
      <H2 id="ops">Ops</H2>

      <H3 id="audit-log">audit_log</H3>
      <p>
        Every mutation a user performs, with before/after JSON snapshots. Renders at /admin/audit.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Entry id." },
          { name: "user_id", type: "bigint", desc: "FK → users.id. NOT NULL, so the scheduled routes, which have no user, log to sync_runs instead." },
          { name: "action", type: "text", desc: <>Dotted action name, e.g. <code>pricing.supersede</code>, <code>invoice.issue</code>, <code>bundle.create</code>.</> },
          { name: "entity_type / entity_id", type: "text", desc: "What was touched; entity_id is text so composite keys like accountId:apiCode fit." },
          { name: "before_json / after_json", type: "text | null", desc: "JSON snapshots; null on create (before) and delete (after)." },
          { name: "created_at", type: "timestamptz", desc: "Default NOW()." },
        ]}
      />
      <p>
        Indexes: <code>idx_audit_entity</code> (entity_type, entity_id),{" "}
        <code>idx_audit_user</code> (user_id, created_at).
      </p>

      <H3 id="sync-runs">sync_runs</H3>
      <p>
        One row per (sync run, business date). Powers the /admin/sync run history and system
        status view, and the cron&apos;s gap self-heal.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "id", type: "bigserial PK", desc: "Run id." },
          { name: "trigger", type: "text", desc: <>CHECK <code>cron</code> | <code>manual</code> | <code>backfill</code>.</> },
          { name: "target_date", type: "date", desc: "The business date synced." },
          { name: "status", type: "text", desc: <>CHECK <code>running</code> | <code>success</code> | <code>error</code>; default <code>running</code>.</> },
          { name: "rows_fetched / rows_inserted / rows_deleted", type: "integer | null", desc: "Counts from the pull and the delete and insert." },
          { name: "unmapped_clients / unmapped_apis", type: "integer | null", desc: "Quarantine counts — distinct raw names that didn't resolve." },
          { name: "total_hits", type: "bigint | null", desc: "Sum of all four unit counts inserted." },
          { name: "error", type: "text | null", desc: "Failure message, truncated to 2,000 chars." },
          { name: "started_at / finished_at", type: "timestamptz", desc: "started_at default NOW(); finished_at null while running." },
        ]}
      />
      <p>Index: <code>idx_sync_runs_date</code> (target_date, started_at DESC).</p>

      {/* ─── Other tables ──────────────────────────────────────────────── */}
      <H2 id="other-tables">Other tables</H2>

      <H3 id="api-code-overrides">api_code_overrides</H3>
      <p>
        Admin-curated mapping from a raw SKU name to a catalog code, used by the usage sync when a
        row&apos;s SKU code is blank or unknown. Written by the SKU review queue.
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "raw_api_name", type: "text PK", desc: "Raw SKU name as the log reports it." },
          { name: "api_code", type: "text", desc: "FK → apis.product_code, ON DELETE CASCADE." },
          { name: "note", type: "text | null", desc: "Optional note." },
          { name: "created_by / created_at", type: "bigint | null / timestamptz", desc: "created_by FK → users.id." },
        ]}
      />

      <H3 id="other-table-list">Remaining tables</H3>
      <ParamTable
        nameHeader="Table"
        rows={[
          { name: "app_settings", type: "key text PK", desc: "Key and value pairs: the app-wide sandbox default, digest recipient lists, alert settings. updated_by holds the actor's email." },
          { name: "leak_dismissals", type: "UNIQUE (client_id, api_code)", desc: "Historical leaks marked as expected. A row hides the pair from leak surfaces." },
          { name: "sandbox_classifications", type: "UNIQUE (client_id, api_code, effective_from)", desc: "Effective-dated per-pair sandbox flag. The view uses it for effective_is_sandbox." },
          { name: "sandbox_billing_rules", type: "id PK", desc: "Effective-dated number of billable sandbox units per account (api_code NULL) or per (account, SKU). NULL billable_hits means bill all." },
          { name: "vendor_commitments", type: "UNIQUE (vendor_id, effective_from)", desc: "A vendor's monthly minimum, effective-dated, with status estimated | quoted | contracted." },
          { name: "client_operations", type: "id PK", desc: "Account merge and delete requests: kind merge | delete, status pending | rejected | executed | reversed | purged, and the reverse_deadline that ends the undo window." },
          { name: "client_slugs", type: "slug PK", desc: "Every slug an account has had, so old URLs redirect after a rename. is_current marks the live one." },
          { name: "notifications", type: "id PK", desc: "In-app notifications per user, with read_at." },
          { name: "alerts", type: "id PK", desc: "Usage alerts: rule, severity critical | high | medium | info, status open | closed, dedupe_key (unique while open), metrics JSON, acknowledge and snooze fields." },
          { name: "alert_runs", type: "data_date PK", desc: "One row per evaluated usage date, with counts and the email result." },
        ]}
      />

      {/* ─── View ──────────────────────────────────────────────────────── */}
      <H2 id="revenue-view">The usage_daily_with_revenue view</H2>
      <p>
        Every revenue, cost, and margin number in Ledgerline — dashboard, account pages, invoice
        derivation, leak reports — comes from this one view. It wraps{" "}
        <code>usage_daily</code> and resolves three things per row: the effective sell price, the
        effective vendor cost, and whether a stitched bundle overrides individual pricing.
      </p>

      <H3 id="view-temporal">Temporal pricing with LATERAL joins</H3>
      <p>
        Each pricing join picks exactly one row: the latest <code>effective_from</code> on or
        before the usage date. The same pattern repeats for <code>pricing</code>,{" "}
        <code>bundle_pricing</code>, <code>vendor_pricing</code>, and{" "}
        <code>sandbox_classifications</code>:
      </p>
      <CodeBlock
        lang="sql"
        title="One price row per usage row, as of the usage date"
        code={`LEFT JOIN LATERAL (
  SELECT p2.* FROM pricing p2
  WHERE p2.client_id = u.client_id
    AND p2.api_code  = u.api_code
    AND p2.effective_from <= u.date
  ORDER BY p2.effective_from DESC
  LIMIT 1
) p ON true`}
      />
      <p>
        This is what makes price changes retroactivity-safe: superseding a billed pair with a
        today-dated row changes future revenue without touching any historical day.
      </p>

      <H3 id="view-bundles">Bundle-aware CASE: anchor vs member</H3>
      <p>
        Membership joins through <code>api_bundle_members</code> on (client_id, api_code). When a
        bundle price row applies to the usage date (<code>bundle_applied = 1</code>), a CASE
        decides the effective unit price:
      </p>
      <CodeBlock
        lang="sql"
        title="Effective successful price (p_s); the other three tiers mirror it"
        code={`CASE WHEN bp.id IS NOT NULL
     THEN CASE WHEN b.anchor_api_code = u.api_code
               THEN COALESCE(bp.price_successful, 0)  -- anchor: bundle rate
               ELSE 0 END                             -- member: bills 0
     ELSE COALESCE(p.price_successful, 0) END         -- no bundle: own pricing`}
      />
      <p>
        The anchor bills at the bundle rate, every other member bills at 0, and usage dated before
        the bundle&apos;s earliest <code>effective_from</code> falls back to individual pricing. The
        view also exposes <code>bundle_id</code>, <code>bundle_name</code>,{" "}
        <code>bundle_anchor</code> (1 when this row is the billing anchor), and{" "}
        <code>bundle_applied</code> so leak/unpriced queries can exclude bundled pairs.
      </p>

      <H3 id="view-slab">Volume-priced pairs and p_model</H3>
      <p>
        A pricing row with <code>pricing_model</code> <code>tier</code> or <code>slab</code> keeps
        its flat <code>price_*</code> columns at 0, so the view emits 0 revenue for it. Volume
        pricing depends on the period&rsquo;s total units and cannot be resolved one day at a time.{" "}
        <code>deriveStatement</code> and <FilePath>src/lib/repos/slab-revenue.ts</FilePath>{" "}
        compute that revenue at the period level (see{" "}
        <a href="/help/math#slabs">the volume pricing math</a>). The view exposes{" "}
        <code>p_model</code>, the matched pricing row&apos;s model (NULL becomes{" "}
        <code>flat</code>), so leak and unpriced queries can leave volume-priced pairs out.
      </p>

      <H3 id="view-manual">Approved-manual-entry filtering</H3>
      <CodeBlock
        lang="sql"
        title="The view's only WHERE clause"
        code={`WHERE u.manual_entry_id IS NULL OR me.status = 'approved'`}
      />
      <p>
        Log and import rows always count; rows belonging to a manual entry are invisible to all
        revenue math until the entry is approved, and drop out again when it is voided (voiding
        nulls the back-pointer). Revenue and vendor cost are then plain sums —{" "}
        <code>units × effective rate</code> across the four outcome tiers — emitted alongside the
        mapped <code>client_name</code> / <code>api_name</code>, <code>account_id</code>,{" "}
        <code>is_sandbox</code>, <code>effective_is_sandbox</code>, <code>vendor_billable</code>,{" "}
        <code>vendor_cost_status</code>, <code>vendor_cost_basis</code>,{" "}
        <code>vendor_cost_model</code>, and <code>vendor_cost_known</code> columns.
      </p>

      <Callout variant="info" title="Where the view is defined">
        The view definition is in <FilePath>migrations/0001_baseline.sql</FilePath>. To change it,
        add a migration that drops and re-creates the whole view.
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
