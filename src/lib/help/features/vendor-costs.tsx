import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "vendor-costs",
  title: "Vendor costs",
  summary:
    "What each upstream vendor charges per unit of usage — the cost side of every margin number, with an explicit difference between a rate we know, a rate of zero, and a rate nobody has told us.",
  group: "Admin",
  role: "admin",
  routes: ["/vendors"],
};

export default function Body() {
  return (
    <>
      <p>
        Revenue is only half the ledger. Every unit of usage also costs something from the upstream
        vendor that serves it, and margin — on the dashboard, on account profiles, on internal
        invoices — is revenue minus exactly these numbers. The rate card is where those rates
        live. Its main job is to be honest about which of them are real.
      </p>

      <Callout variant="warn" title="Most rates are not known yet">
        The table used to hold a placeholder for every vendor crossed with every SKU — over a thousand rows,
        none of them confirmed, most for pairs that never carried a single unit. Margin was
        arithmetic on invented numbers. Those rows are gone. What remains is one row per
        (vendor, SKU) pair that traffic has actually been seen on, and almost all of them are
        still empty. A cost of $0 on an unrated SKU is not a saving; it is a gap.
      </Callout>

      <Figure
        src="/help/shots/admin-vendor-cost.png"
        alt="Vendor costs overview with total spend and a grid of vendor cards"
        caption="The overview: total spend, and how much of it is actually known."
      />

      <H2 id="registry">One vendor, one name</H2>
      <p>
        Each vendor page opens with the vendor itself: its name, whether we still send it work,
        and every other spelling that means it. A vendor used to be free text, matched between
        tables by the three of them spelling it the same way. That held until a vendor was
        renamed upstream — the new name matched nothing, arrived as a second vendor with no
        rates, and its cost quietly fell to zero with nothing to report it.
      </p>
      <p>
        So rename a vendor here rather than letting a new spelling arrive on its own. The rename
        moves one row: the rate card, the monthly minimum and months of usage all follow, and the
        old spelling stays behind as an alias so traffic still arriving under it lands on the
        same vendor. Links saved under the old name redirect. If both spellings are already
        arriving, add the second one to the alias list and they merge from that point on.
      </p>
      <p>
        <strong>Inactive</strong> marks a vendor we no longer send work to. Nothing is deleted:
        its rates, its history and its page stay exactly as they are — its name is on months of
        usage, and removing it would take that with it.
      </p>

      <H2 id="sandbox">Sandbox usage</H2>
      <p>
        Ledgerline does not bill a customer for sandbox usage. Whether the <em>vendor</em>
        bills <em>us</em> for that usage is a separate question, and one only the contract answers. Until
        it is answered the product charges sandbox traffic at the vendor&rsquo;s full rate, because
        overstating cost is the safer error — sandbox was 5.1% of August&rsquo;s units, and
        assuming it is free would flatter every margin figure by that much.
      </p>
      <p>
        Each vendor page carries the answer. Set <strong>does not charge</strong> only from the
        agreement. When you do, that vendor&rsquo;s sandbox units stop carrying cost everywhere at
        once — the dashboard, account margin, the rate card, the monthly minimum — and they stop
        counting toward a volume bracket, because they are not on the invoice the brackets
        describe. They also stop appearing as unrated work: a unit a vendor has told us it does
        not charge for is a decided zero, not a missing rate.
      </p>
      <p>
        This one is <strong>not effective-dated</strong>, unlike a rate or a minimum. It is not a
        price that changed on a date; it is a fact about the contract that we either knew or did
        not, so recording it corrects every period at once.
      </p>

      <H2 id="three-states">Unknown, not charged, and a rate</H2>
      <p>
        Every cost cell is in one of three states, and the first two used to look identical:
      </p>
      <ul>
        <li>
          <strong>&mdash;</strong> the rate is <em>unknown</em>. Nobody has told us. Units on this
          outcome contribute nothing to cost, which makes margin look better than it is.
        </li>
        <li>
          <strong>not charged</strong> a confirmed zero. The vendor has told us it does not bill
          this outcome — most do not bill failures. This is a fact, not a gap.
        </li>
        <li>
          <strong>$ a number</strong> the rate itself.
        </li>
      </ul>

      <H2 id="status">Status is set, never inferred</H2>
      <p>
        Alongside the numbers, each rate carries a status and a source:
      </p>
      <ul>
        <li>
          <strong>estimated</strong> — a guess, with nothing behind it.
        </li>
        <li>
          <strong>quoted</strong> — a price the vendor gave us.
        </li>
        <li>
          <strong>contracted</strong> — a rate in a signed agreement.
        </li>
      </ul>
      <p>
        Moving to quoted or contracted requires a <strong>source</strong>: a document name, an
        email, or a note saying where the number came from. Typing a number does not change the
        status — the old screen marked all four outcomes &ldquo;confirmed&rdquo; the moment you
        typed into any one of them, so the product reported confidence it had never been given.
      </p>

      <Figure
        src="/help/shots/admin-vendor-detail.png"
        alt="Vendor rate card with per-SKU outcome costs, effective dates and statuses"
        caption="The rate card: unpriced traffic first, because that is the work to do."
      />

      <H2 id="what-you-can-do">Editing a rate</H2>
      <p>
        Click any cost to open its editor. It asks for four things, and saving is an explicit
        action — clicking away cancels, so a half-typed number is never written.
      </p>
      <ul>
        <li>
          <strong>The rate</strong> — an amount, or <em>Not charged</em>, or <em>Unknown</em> to
          clear it back to a gap.
        </li>
        <li>
          <strong>Effective from</strong> — the day this rate starts applying.
        </li>
        <li>
          <strong>Status and source</strong> — as above.
        </li>
      </ul>

      <Callout variant="info" title="A rate change cannot rewrite a past cost">
        Editing a rate that has already costed elapsed days does not change those days. The editor
        writes a <em>new</em> dated row instead, defaulting to the first of next month, and days
        already counted keep the rate they were costed at. Account pricing follows the same rule.
        <br />
        <br />
        There is one exception, and it is deliberate. A pair whose rate has never been set has not
        costed anything — its cells are all &ldquo;unknown&rdquo;. Filling it in for the first time
        is not a revision; it supplies the rate that was always in force, so it applies from the
        row&rsquo;s own start date and prices the history. Every change after that is dated
        forward.
      </Callout>

      <H2 id="confidence">Coverage is shown, not implied</H2>
      <p>
        Each vendor card carries a confidence bar: the share of its units priced by a contracted
        rate, a quoted rate, an estimate, or no rate at all. A single chip could not say this —
        the old one appeared only when <em>every</em> SKU was estimated, so a vendor with one
        confirmed rate and thirty placeholders read as confirmed. Internal invoice exports carry
        the same signal per line (the CSV&rsquo;s <code>is_estimated</code> column is true for any
        line whose rate is not contracted).
      </p>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>SKU with no rate</strong> — cost is treated as zero, which <em>overstates</em>{" "}
          margin. These rows are banded to the top of the rate card with their unit counts, so the
          size of the gap is visible.
        </li>
        <li>
          <strong>Vendor with no traffic this period</strong> — still opens, and its rates can
          still be set. A rate should be enterable before the first unit of usage arrives, not after.
        </li>
        <li>
          <strong>Selling below cost</strong> — when a known cost exceeds the charged price, the
          pair surfaces in the dashboard&rsquo;s &ldquo;Margin watch&rdquo; risk row.
        </li>
        <li>
          <strong>Sandbox traffic</strong> — carries vendor cost today, because whether a vendor
          bills sandbox usage is a contract fact we do not yet record per vendor. Sandbox units
          therefore depress margin slightly.
        </li>
        <li>
          <strong>Who can see this</strong> — the rate card is admin-only. Editors see the margin
          it produces, on the dashboard, the SKUs list, an account and a draft invoice, but never a
          vendor&apos;s per-unit rate. Members see revenue and no margin at all.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/vendor-reconciliation", label: "Vendor reconciliation" },
          { href: "/help/features/money-at-risk", label: "Money at risk" },
          { href: "/help/features/invoice-exports", label: "PDF & CSV exports" },
          { href: "/help/math", label: "Margin math" },
        ]}
      />
    </>
  );
}
