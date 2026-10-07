import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "stitched-bundles",
  title: "Stitched SKU bundles",
  summary:
    "Combine several SKUs into one invoice line per account: the anchor SKU carries the bundle price, members ride along free, and invoices show a single line.",
  group: "Pricing",
  role: "admin",
  routes: ["/accounts"],
};

export default function Body() {
  return (
    <>
      <p>
        Some products are sold as one thing but metered as several SKUs — a realtime voice agent
        that uses speech-to-text (VOX-STT-RT) and the voice agent (VOX-AGENT) for each minute,
        priced as one per-minute product. Stitched bundles encode that: per account, a named group
        of SKUs where one member — the <strong>anchor</strong> —
        carries the bundle price and the rest bill at zero. The customer sees one line; the
        economics stay honest.
      </p>

      <Figure
        src="/help/shots/account-pricing.png"
        alt="Account pricing page with the stitched SKU bundles section"
        caption="Bundles live on the account&rsquo;s pricing page, beneath the per-SKU rows."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>A bundles section</strong> on the account pricing page: each bundle&rsquo;s name,
          its anchor SKU, its member SKUs, the four outcome prices, and the effective date.
        </li>
        <li>
          <strong>Member rows marked</strong> — SKUs that belong to a bundle are not individually
          editable in the main pricing table; their pricing is the bundle&rsquo;s.
        </li>
        <li>
          <strong>Stitched chips elsewhere</strong> — the SKU page&rsquo;s consumer table flags
          accounts that consume a SKU through a bundle, and invoices roll the whole bundle into a
          single line under the bundle&rsquo;s name.
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Create a bundle</strong> — pick the member SKUs, choose the anchor (the first
          SKU you select is suggested, as the likely entry point of the chain), name the bundle,
          set the four outcome prices, and pick an effective date.
        </li>
        <li>
          <strong>Reprice a bundle</strong> — edits write a new dated pricing row, same temporal
          semantics as ordinary account pricing.
        </li>
        <li>
          <strong>Unstitch</strong> — dissolve the bundle so members return to individual pricing
          — possible only while the anchor pair has never been billed.
        </li>
      </ul>

      <Callout variant="warn" title="Billing locks the stitch">
        Once the anchor pair appears on a finalized invoice, the bundle can no longer be
        unstitched, and price edits supersede rather than rewrite. Issued numbers stay exactly as
        issued.
      </Callout>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Per-account scope</strong> — a bundle belongs to one account. The same SKUs can be
          stitched differently (or not at all) for another account.
        </li>
        <li>
          <strong>Members must be distinct</strong> — a SKU can&rsquo;t appear twice in one
          bundle, and member SKUs drop out of the individually-priceable list.
        </li>
        <li>
          <strong>Never pre-seeded</strong> — bundles are only ever created deliberately by an
          admin; imports and syncs never create stitches.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/account-pricing", label: "Account pricing" },
          { href: "/help/features/invoices", label: "Invoices & statements" },
          { href: "/help/features/sku-page", label: "SKU page" },
        ]}
      />
    </>
  );
}
