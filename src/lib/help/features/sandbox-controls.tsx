import type { FeatureMeta } from "../types";
import { H2, Callout, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "sandbox-controls",
  title: "Sandbox controls",
  summary:
    "One app-wide sandbox switch, effective-dated per-(account, SKU) classification, and capped sandbox billing — the three levers over test traffic.",
  group: "Sandbox",
  role: "admin",
  routes: ["/admin"],
};

export default function Body() {
  return (
    <>
      <p>
        Sandbox traffic is test usage that stays out of billable revenue by default. Ledgerline models it
        at three levels of detail. An account that has both live and test usage can mark only the
        test part as sandbox.
      </p>

      <H2 id="app-wide-toggle">App-wide toggle</H2>
      <p>
        A single, database-backed setting decides whether sandbox traffic is counted across the whole
        app. Every surface reads the same value, and page subtitles state the active lens
        (&ldquo;sandbox included&rdquo; / &ldquo;excluded&rdquo;). This replaced per-page checkboxes
        that could disagree with one another.
      </p>

      <H2 id="classification">Per-(account, SKU) classification</H2>
      <p>
        A classification marks a specific account-and-SKU pair as sandbox from an effective date. It
        overrides the account-level default for that pair only. With no rules present, the effective
        sandbox flag is identical to the plain account flag — rules refine, they never rewrite.
      </p>

      <H2 id="capped-billing">Capped billing</H2>
      <p>
        A sandbox billing rule bills sandbox usage for a pair up to a cap: units below the cap stay
        free, units above it earn revenue at the account&rsquo;s rate. This is how a &ldquo;free test
        allowance, then billed&rdquo; contract is set up without marking the whole pair as live
        usage.
      </p>

      <Callout variant="tip">
        The toggle answers &ldquo;show me test traffic or not,&rdquo; classification answers
        &ldquo;which usage is test,&rdquo; and capped billing answers &ldquo;when does test usage
        become revenue.&rdquo;
      </Callout>

      <Related
        links={[
          { href: "/help/guides/manage-sandbox-traffic", label: "Classify & bill sandbox traffic" },
          { href: "/help/features/unpriced-traffic", label: "Unpriced traffic" },
          { href: "/help/features/account-pricing", label: "Account pricing" },
        ]}
      />
    </>
  );
}
