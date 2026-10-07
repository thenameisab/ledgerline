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

export const metadata: Metadata = { title: "Server actions" };

export default function ServerActionsPage() {
  return (
    <DocPage
      crumbs={[{ href: "/help/api", label: "API reference" }]}
      title="Server actions"
      lede='Every "use server" function the UI invokes directly — no HTTP route, no fetch. Each action runs guardAction() first, writes the database, records an audit entry, and revalidates the pages it changed.'
    >
      <p>
        Server actions are Ledgerline&apos;s second mutation surface, next to the{" "}
        <a href="/help/api/endpoints">HTTP endpoints</a>. They are plain async functions exported
        from <FilePath>actions.ts</FilePath> files; Next.js handles transport, and same-origin
        enforcement comes from the framework&apos;s built-in server-action protection rather than{" "}
        <code>assertSameOrigin()</code>. Every action begins with{" "}
        <code>guardAction(action)</code> from <FilePath>src/lib/access.ts</FilePath> and returns the
        guard failure to the caller instead of throwing:
      </p>
      <CodeBlock
        lang="ts"
        title="Guard failure shape (shared by all actions)"
        code={`{ ok: false, error: "Sign in required." | "Admin only.",
  code: "unauthenticated" | "forbidden" }`}
      />

      {/* ─── Account pricing ────────────────────────────────────────────── */}
      <H2 id="pricing-actions">Account pricing</H2>

      <H3 id="save-pricing-batch">savePricingBatch</H3>
      <Endpoint method="ACTION" path="savePricingBatch(accountId, slug, changes[])">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Lives in <FilePath>src/app/accounts/[slug]/pricing/actions.ts</FilePath>. Guard:{" "}
        <code>pricing.edit</code>. Saves a whole pricing-table edit session in one call — each
        element of <code>changes</code> is validated independently, so one bad row never blocks the
        rest. Each change:
      </p>
      <ParamTable
        rows={[
          { name: "api_code", type: "string", required: true, desc: "API product code the price applies to." },
          { name: "price_successful", type: "number", required: true, desc: "Non-negative. Per successful hit." },
          { name: "price_successful_no_data", type: "number", required: true, desc: "Non-negative. Per successful-no-data hit." },
          { name: "price_failed", type: "number", required: true, desc: "Non-negative. Per failed hit." },
          { name: "price_in_progress", type: "number", required: true, desc: "Non-negative. Per in-progress hit." },
          { name: "pricing_model", type: '"flat" | "tier" | "slab"', desc: <>Defaults to <code>flat</code>. <code>tier</code> is graduated (each bracket prices only the hits inside it). <code>slab</code> is whole-volume (the bracket the period total lands in prices every hit). Both volume models store the four flat prices as 0 and write a bracket set instead.</> },
          { name: "slabs", type: "SlabTier[]", desc: <>Required for <code>tier</code> and <code>slab</code>: brackets <code>{`{ min_hits, max_hits|null, price_* }`}</code>. Validated on the server (start at 0, contiguous, one open top bracket, non-negative).</> },
          { name: "is_new", type: "boolean", desc: "True for a brand-new pricing row (the add-API flow) rather than an edit of the latest row." },
          { name: "effective_from", type: "string", desc: <>YYYY-MM-DD, only honored when <code>is_new</code>; defaults to today. Duplicate (account, api, effective_from) rows are rejected per-row.</> },
        ]}
      />
      <CodeBlock
        lang="ts"
        title="Result"
        code={`{
  ok: boolean,                    // true only when every change saved
  errors: Record<string, string>, // keyed by api_code ("_" for a guard failure)
  saved: string[]                 // api_codes that were written
}`}
      />
      <p>
        Edits follow the same billing-lock rules as <code>POST /api/pricing</code>: an unbilled
        pair is updated in place; a pair already on a finalized invoice is{" "}
        <em>superseded</em> with a new row effective today (re-using today&apos;s row if one exists),
        leaving history intact.
      </p>
      <p>
        <strong>Side effects:</strong> inserts/updates <code>pricing</code> (and atomically
        replaces the row&apos;s <code>pricing_slab</code> brackets when the model is{" "}
        <code>tier</code> or <code>slab</code>); records audit action <code>pricing.update</code> per saved change, or{" "}
        <code>pricing.supersede</code> when the pair was billed (the after-snapshot carries{" "}
        <code>reason: &quot;pair_is_billed&quot;</code>); revalidates{" "}
        <FilePath>/accounts/[slug]/pricing</FilePath> and <FilePath>/accounts/[slug]</FilePath>.
      </p>
      <Callout variant="info" title="Volume pricing is computed per period">
        A <code>tier</code> or <code>slab</code> row earns nothing in the per-day revenue view (its
        flat columns are 0). Its revenue is computed at the period level in{" "}
        <code>deriveStatement</code> and the dashboard helpers. See{" "}
        <a href="/help/math#slabs">the volume pricing math</a>.
      </Callout>

      {/* ─── Stitched bundles ──────────────────────────────────────────── */}
      <H2 id="bundle-actions">Stitched bundles</H2>
      <p>
        All three bundle actions live in{" "}
        <FilePath>src/app/accounts/[slug]/pricing/bundle-actions.ts</FilePath>, guard{" "}
        <code>pricing.edit</code>, return <code>{`{ ok: boolean, error?: string }`}</code>, and
        revalidate <FilePath>/accounts/[slug]/pricing</FilePath> and{" "}
        <FilePath>/accounts/[slug]</FilePath> on success.
      </p>

      <H3 id="create-bundle">createBundle</H3>
      <Endpoint method="ACTION" path="createBundle(accountId, slug, input)">
        <RoleChip role="editor" />
      </Endpoint>
      <ParamTable
        rows={[
          { name: "name", type: "string", required: true, desc: "Trimmed, 1–80 chars. Unique per account (duplicate name → error)." },
          { name: "member_codes", type: "string[]", required: true, desc: "At least 2 API product codes. An API can belong to only one stitch per account — conflicts list the offending codes." },
          { name: "anchor_api_code", type: "string", required: true, desc: "The API whose hits carry the bundle price. Must be one of member_codes." },
          { name: "price_successful", type: "number", required: true, desc: "Non-negative bundle rate per successful anchor hit." },
          { name: "price_successful_no_data", type: "number", required: true, desc: "Non-negative." },
          { name: "price_failed", type: "number", required: true, desc: "Non-negative." },
          { name: "price_in_progress", type: "number", required: true, desc: "Non-negative." },
          { name: "effective_from", type: "string", required: true, desc: "YYYY-MM-DD. Usage before this date keeps billing at individual API pricing." },
        ]}
      />
      <p>
        <strong>Side effects:</strong> one transaction inserts the <code>api_bundles</code> row,
        one <code>api_bundle_members</code> row per member, and the first{" "}
        <code>bundle_pricing</code> row. Records audit action <code>bundle.create</code> with the
        full member list and rates.
      </p>

      <H3 id="save-bundle-price">saveBundlePrice</H3>
      <Endpoint method="ACTION" path="saveBundlePrice(accountId, slug, bundleId, input)">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Re-prices an existing stitch. <code>input</code> is the four non-negative price tiers
        (same fields as above, no <code>effective_from</code>). The billing lock keys off the{" "}
        <em>anchor</em> API: if the (account, anchor) pair is on a finalized invoice, the latest{" "}
        <code>bundle_pricing</code> row is locked and a supersede row is written with{" "}
        <code>effective_from</code> = today; otherwise the latest row is updated in place.
      </p>
      <p>
        <strong>Side effects:</strong> writes <code>bundle_pricing</code>; records audit action{" "}
        <code>bundle.price_update</code>, or <code>bundle.price_supersede</code> when the anchor
        was billed (after-snapshot carries <code>reason: &quot;anchor_is_billed&quot;</code>).
      </p>

      <H3 id="delete-bundle">deleteBundle</H3>
      <Endpoint method="ACTION" path="deleteBundle(accountId, slug, bundleId)">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Removes a stitch entirely. Refused with an error when the anchor API has been billed on a
        finalized invoice — issued history must keep resolving the bundle.
      </p>
      <p>
        <strong>Side effects:</strong> deletes the <code>api_bundles</code> row;{" "}
        <code>api_bundle_members</code> and <code>bundle_pricing</code> follow via{" "}
        <code>ON DELETE CASCADE</code>. Member APIs immediately fall back to their individual{" "}
        <code>pricing</code> rows. Records audit action <code>bundle.delete</code> with the member
        list as the before-snapshot.
      </p>

      {/* ─── Invoices ──────────────────────────────────────────────────── */}
      <H2 id="invoice-actions">Invoice lifecycle</H2>
      <p>
        The four invoice actions live in{" "}
        <FilePath>src/app/accounts/[slug]/invoices/[period]/actions.ts</FilePath>, guard{" "}
        <code>pricing.edit</code>, and delegate to the statements repo
        (<FilePath>src/lib/repos/statements.ts</FilePath>). Repo failures surface as{" "}
        <code>StatementError</code>, whose <code>code</code> is forwarded to the caller:
      </p>
      <CodeBlock
        lang="ts"
        title="Result shapes"
        code={`// finalizeInvoice / issueInvoice
{ ok: true, number: "LL-2026-0042" }
| { ok: false, error: string,
    code?: "not_found" | "already_final" | "not_final" | "no_lines"
         | "already_issued" | "invalid" | "locked" }

// addInvoiceAdjustment / removeInvoiceAdjustment
{ ok: true } | { ok: false, error: string, code?: /* same union */ }`}
      />
      <p>
        All four revalidate <FilePath>/accounts/[slug]/invoices</FilePath> and{" "}
        <FilePath>/accounts/[slug]/invoices/[period]</FilePath>.
      </p>

      <H3 id="finalize-invoice">finalizeInvoice</H3>
      <Endpoint method="ACTION" path="finalizeInvoice(accountId, accountSlug, periodId)">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Snapshots the period&apos;s live revenue (from <code>usage_daily_with_revenue</code>) into{" "}
        <code>statements</code> + <code>statement_lines</code> and moves the statement to{" "}
        <code>status=&apos;final&apos;</code>. A real invoice number is allocated atomically from{" "}
        <code>invoice_sequence</code> (one counter per year, format{" "}
        <code>LL-YYYY-NNNN</code>), replacing the provisional draft number. Fails with{" "}
        <code>no_lines</code> when the period has no billable activity and{" "}
        <code>already_final</code> when it was finalized before. Records audit action{" "}
        <code>invoice.finalize</code>.
      </p>

      <H3 id="issue-invoice">issueInvoice</H3>
      <Endpoint method="ACTION" path="issueInvoice(accountId, accountSlug, periodId)">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Moves a finalized statement to <code>status=&apos;issued&apos;</code> — the point of no return.
        Adjustments lock, and pricing edits on the billed pairs can only supersede going forward.
        Fails with <code>not_final</code> when the statement is still a draft and{" "}
        <code>already_issued</code> on a repeat call. Records audit action{" "}
        <code>invoice.issue</code>.
      </p>

      <H3 id="add-adjustment">addInvoiceAdjustment</H3>
      <Endpoint method="ACTION" path="addInvoiceAdjustment(accountId, accountSlug, periodId, input)">
        <RoleChip role="editor" />
      </Endpoint>
      <ParamTable
        rows={[
          { name: "label", type: "string", required: true, desc: "What the adjustment is — printed on the statement." },
          { name: "amount", type: "number", required: true, desc: "Signed, non-zero. Negative = credit, positive = extra charge." },
          { name: "notes", type: "string | null", desc: "Internal context; not customer-facing." },
        ]}
      />
      <p>
        Only valid in the window between finalize and issue: a draft fails with{" "}
        <code>not_final</code>, an issued statement with <code>locked</code>, a zero amount or
        blank label with <code>invalid</code>. <strong>Side effects:</strong> inserts into{" "}
        <code>statement_adjustments</code>; records audit action{" "}
        <code>invoice.adjustment.add</code>.
      </p>

      <H3 id="remove-adjustment">removeInvoiceAdjustment</H3>
      <Endpoint method="ACTION" path="removeInvoiceAdjustment(accountId, accountSlug, periodId, adjustmentId)">
        <RoleChip role="editor" />
      </Endpoint>
      <p>
        Deletes one adjustment by id, under the same window: <code>not_found</code> when it does
        not exist, <code>locked</code> once the statement is issued.{" "}
        <strong>Side effects:</strong> deletes from <code>statement_adjustments</code>; records
        audit action <code>invoice.adjustment.remove</code> with the before-snapshot.
      </p>

      {/* ─── Settings ──────────────────────────────────────────────────── */}
      <H2 id="settings-actions">Settings</H2>

      <H3 id="set-sandbox-preference">setSandboxPreference</H3>
      <Endpoint method="ACTION" path="setSandboxPreference(enabled)">
        <RoleChip role="admin" />
      </Endpoint>
      <p>
        Lives in <FilePath>src/app/admin/sandbox/actions.ts</FilePath>. Guard:{" "}
        <code>vendor_pricing.edit</code>. Toggles whether sandbox usage is included in dashboard,
        account-list and invoice numbers. It is the app-wide default, stored in{" "}
        <code>app_settings</code>; per-(account, API) rules override it.
      </p>
      <ParamTable
        rows={[
          { name: "enabled", type: "boolean", required: true, desc: "True to include sandbox accounts in revenue views." },
        ]}
      />
      <p>
        <strong>Side effects:</strong> upserts the include-sandbox row in <code>app_settings</code>{" "}
        (<code>&quot;1&quot;</code> or <code>&quot;0&quot;</code>, with <code>updated_by</code> set to
        the admin&apos;s email), clears the settings and revenue caches, and revalidates{" "}
        <FilePath>/</FilePath>, <FilePath>/accounts</FilePath>, and{" "}
        <FilePath>/admin/sandbox</FilePath>. Returns <code>{`{ ok: true }`}</code>. The change
        applies to every user.
      </p>

      <H2 id="other-actions">Other server actions</H2>
      <p>
        These actions follow the same pattern: guard first, then write, then revalidate. The
        guard is the action in the second column.
      </p>
      <ParamTable
        nameHeader="Action"
        rows={[
          { name: "saveSandboxRule", type: "sandbox_billing.edit", desc: <><FilePath>src/app/admin/sandbox/actions.ts</FilePath>. Sets how many sandbox hits an (account, API) pair bills: <code>none</code>, <code>all</code>, or a <code>cap</code>.</> },
          { name: "saveAccountProfile", type: "account.update", desc: <><FilePath>src/app/accounts/[slug]/profile/actions.ts</FilePath>. Saves the account profile fields.</> },
          { name: "dismissHistoricalLeak / restoreHistoricalLeak", type: "pricing.edit", desc: <><FilePath>src/app/accounts/[slug]/leak-actions.ts</FilePath>. Adds or removes a <code>leak_dismissals</code> row. Audit actions <code>leak.dismiss</code> and <code>leak.restore</code>.</> },
          { name: "acknowledgeAlertAction / acknowledgeAlertsAction / snoozeAlertAction / restoreAlertAction", type: "alert.act", desc: <><FilePath>src/app/alerts/actions.ts</FilePath>. Acknowledge one or many alerts, snooze an alert for a number of days, or restore it.</> },
          { name: "dismissReconDelta / restoreReconDelta", type: "vendor_pricing.edit", desc: <><FilePath>src/app/vendors/reconciliation/actions.ts</FilePath>. Accepts or restores one month&apos;s reconciliation delta in <code>vendor_recon_dismissals</code>.</> },
          { name: "saveRoundupRecipients / sendRoundupTest / sendRoundupNow", type: "user.manage", desc: <><FilePath>src/app/admin/settings/actions.ts</FilePath>. Recipient lists and sends for the revenue roundups. Sends are skipped in the demo because no mail credentials are set.</> },
          { name: "saveProductUpdateRecipients / sendProductUpdateTest / sendProductUpdateNow", type: "user.manage", desc: "Same file. Recipient list and sends for the weekly product update." },
          { name: "saveAlertSettings / saveAlertRecipients / sendAlertEmailTest", type: "user.manage", desc: <><FilePath>src/app/admin/settings/alerts/actions.ts</FilePath>. Alert thresholds, recipient groups, and a test email.</> },
        ]}
      />

      <Callout variant="info" title="Why these are actions and not routes">
        These mutations are only ever triggered from Ledgerline&apos;s own React forms, so they use the
        server-action channel and skip the JSON envelope. Anything that an external script might
        reasonably call (catalog, pricing, sync) is an HTTP route instead — see{" "}
        <a href="/help/api/endpoints">Endpoints</a>.
      </Callout>

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
