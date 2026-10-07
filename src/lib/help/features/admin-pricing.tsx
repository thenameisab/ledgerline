import type { FeatureMeta } from "../types";
import { H2, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "admin-pricing",
  title: "Price-pairs view",
  summary:
    "Every account × SKU price pair in one admin table — the fastest way to audit the whole price book and spot gaps.",
  group: "Pricing",
  role: "admin",
  routes: ["/admin/pricing"],
};

export default function Body() {
  return (
    <>
      <p>
        The per-account pricing page is where you edit one account&rsquo;s rates. The price-pairs view
        at <code>/admin/pricing</code> is the opposite lens: every priced <strong>account × SKU</strong>{" "}
        pair across the book on a single screen, so you can audit coverage without clicking through
        accounts one at a time.
      </p>

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>One row per (account, SKU) pair</strong> — with its rates and pricing model
          (flat, tiered, or whole-volume).
        </li>
        <li>
          <strong>Full SKU names</strong> — the column uses the available width and reveals long
          names on hover, so nothing is silently clipped.
        </li>
      </ul>

      <H2 id="what-its-for">What it&rsquo;s for</H2>
      <p>
        Use it to answer &ldquo;who is priced for what?&rdquo; at a glance — to find pairs missing a
        rate, to sanity-check a bulk pricing change, or to compare how the same SKU is priced across
        accounts.
      </p>

      <Related
        links={[
          { href: "/help/features/account-pricing", label: "Account pricing" },
          { href: "/help/features/unpriced-traffic", label: "Unpriced traffic" },
          { href: "/help/guides/set-account-pricing", label: "Set or edit account pricing" },
        ]}
      />
    </>
  );
}
