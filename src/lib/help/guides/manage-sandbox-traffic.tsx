import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "manage-sandbox-traffic",
  title: "Classify and bill sandbox traffic",
  summary:
    "Turn sandbox on or off app-wide, mark a specific account or SKU as sandbox, and bill sandbox usage up to a per-pair cap.",
  group: "Sandbox",
  role: "admin",
  minutes: 4,
};

export default function Body() {
  return (
    <>
      <p>
        Sandbox is test traffic that normally stays out of billable revenue. Ledgerline gives you three
        levers over it: a single app-wide switch, a per-(account, SKU) classification for the mixed
        cases, and a billing cap for when sandbox usage should start earning revenue past a free
        allowance.
      </p>

      <H2 id="app-wide">Turn sandbox on or off everywhere</H2>
      <p>
        The include-sandbox setting is a single, database-backed switch — flip it once and every
        surface (dashboard, accounts, groups, SKUs, invoices) agrees. There is no longer a per-page
        checkbox to keep in sync.
      </p>
      <Steps>
        <Step title="Open the sandbox toggle">
          It lives in the global filter bar alongside the date range. Its state persists across
          pages and sessions.
        </Step>
        <Step title="Read the subtitle to confirm">
          Page subtitles state whether sandbox is <em>included</em> or <em>excluded</em> for the
          current view, so you always know which lens you&rsquo;re looking through.
        </Step>
      </Steps>

      <H2 id="per-pair">Mark one account or SKU as sandbox</H2>
      <p>
        Some accounts bill most of their SKUs but run one in test, or an account is sandbox until a
        go-live date. A per-(account, SKU) classification is effective-dated, so it applies only from
        the day you set.
      </p>
      <Callout variant="tip">
        With zero classification rules, behaviour is identical to the plain account-level flag —
        adding rules only ever refines it, never rewrites history before the effective date.
      </Callout>

      <H2 id="capped-billing">Bill sandbox usage up to a cap</H2>
      <p>
        When a contract says &ldquo;the first N sandbox units are free, then we bill them,&rdquo; set a
        per-(account, SKU) sandbox billing rule with a cap. Usage below the cap stays free; usage above
        it becomes revenue at the account&rsquo;s rate, instead of disappearing as leak.
      </p>
      <Steps>
        <Step title="Open the admin sandbox-billing view">
          Choose the date range you want to price — the view scopes to that window.
        </Step>
        <Step title="Set the cap for the pair">
          Below the cap, sandbox units are free; above it, they bill like ordinary usage.
        </Step>
      </Steps>

      <Callout variant="warn">
        Sandbox billing rules and classifications interact — a pair that is billed by a cap is, by
        definition, revenue. Review the account&rsquo;s SKU breakdown after setting a rule to confirm
        the numbers read the way you expect.
      </Callout>

      <Related
        links={[
          { href: "/help/features/sandbox-controls", label: "Sandbox controls" },
          { href: "/help/guides/filter-by-date-range", label: "Filter by date range & sandbox" },
          { href: "/help/guides/set-account-pricing", label: "Set or edit account pricing" },
        ]}
      />
    </>
  );
}
