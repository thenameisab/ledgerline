import type { Metadata } from "next";
import { DocPage } from "@/components/help/DocPage";
import { Math } from "@/components/help/Math";
import {
  H2,
  H3,
  Callout,
  CodeBlock,
  FilePath,
  ParamTable,
  Related,
} from "@/components/help/doc";

export const metadata: Metadata = { title: "Mathematics" };

// String.raw keeps LaTeX readable — no double-escaped backslashes.
const R = String.raw;

export default function MathPage() {
  return (
    <DocPage
      title="Mathematics"
      lede="Every formula behind every number Ledgerline shows — money arithmetic, pricing resolution, stitched bundles, graduated slab tiers, margins, invoices, pacing, risk estimation, the activity heatmap, and number formatting."
    >
      <p>
        Ledgerline computes money in three layers: Postgres stores and aggregates exact{" "}
        <code>NUMERIC(14,4)</code> values, the server does any further arithmetic on
        arbitrary-precision decimals, and plain JavaScript numbers appear only at the final
        display boundary. This page defines each formula precisely, names every symbol, and
        cites the source file that implements it.
      </p>

      {/* ────────────────────────────────────────────────────────── 1. Money */}
      <H2 id="money">Money representation</H2>
      <p>
        All money is USD ($). The database column type for every price, cost, revenue, and
        adjustment is <code>NUMERIC(14,4)</code> — up to 10 integer digits and exactly 4
        fractional digits. The <code>postgres</code> driver returns <code>NUMERIC</code> values
        as <em>strings</em> (they can exceed IEEE-754 precision), and{" "}
        <FilePath>src/lib/money.ts</FilePath> is the single boundary that parses them into{" "}
        <code>Decimal</code> values from <code>decimal.js-light</code>:
      </p>
      <CodeBlock
        title="src/lib/money.ts"
        lang="ts"
        code={`Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });`}
      />
      <p>
        Precision 28 significant digits gives multiplications ample headroom before the final
        round-on-write to 4 decimals. <code>ROUND_HALF_EVEN</code> is{" "}
        <strong>banker&rsquo;s rounding</strong>: a value exactly halfway between two
        representable results rounds to the one whose last digit is <em>even</em> (2.5 → 2,
        3.5 → 4). Always rounding halves up would bias every tie in the same direction, and
        summing thousands of usage rows would accumulate that bias into a real error in dollars;
        half-even ties break up and down equally often, so the expected error of a long sum is
        zero.
      </p>

      <H3 id="money-functions">Core functions</H3>
      <p>
        <code>toMoney</code> parses anything the driver or UI can hand over — string, number,
        Decimal, or <code>null</code> — into a Decimal, mapping every degenerate input to zero:
      </p>
      <Math
        display
        tex={R`\operatorname{toMoney}(v) =
\begin{cases}
0 & v \in \{\texttt{null},\ \texttt{""}\}\ \text{or}\ v\ \text{non-finite} \\
\operatorname{Decimal}(v) & \text{otherwise}
\end{cases}`}
      />
      <p>
        <code>sumMoney</code> folds a list of mixed-type values with exact decimal addition
        (an empty list yields 0):
      </p>
      <Math display tex={R`\operatorname{sumMoney}(v_1,\dots,v_n) = \sum_{i=1}^{n} \operatorname{toMoney}(v_i)`} />
      <p>
        <code>toDbNumeric</code> renders a Decimal as the fixed-4 string written back to{" "}
        <code>NUMERIC(14,4)</code> columns, rounding half-even at the fourth decimal:
      </p>
      <Math display tex={R`\operatorname{toDbNumeric}(m) = \operatorname{toMoney}(m).\texttt{toFixed}(4)`} />
      <p>
        <code>toNumber</code> converts to a plain JS <code>number</code> for UI serialization.
        This is safe for any <em>single</em> value the schema allows: <code>NUMERIC(14,4)</code>{" "}
        has at most 14 significant digits, inside the ~15.9-digit exact range of IEEE-754
        doubles. The hazard this module exists to prevent is doing <em>arithmetic</em> on those
        floats, not displaying them.
      </p>
      <p>
        <code>marginPct</code> expresses margin as a percentage of revenue, with the
        zero-revenue case defined away:
      </p>
      <Math
        display
        tex={R`\operatorname{marginPct}(m, r) =
\begin{cases}
0 & r = 0 \\[2pt]
\dfrac{m}{r} \times 100 & \text{otherwise}
\end{cases}`}
      />
      <CodeBlock
        title="src/lib/money.ts"
        lang="ts"
        code={`/** Margin percentage. Returns 0 when revenue is 0. */
export function marginPct(margin: Money | unknown, revenue: Money | unknown): number {
  const r = toMoney(revenue);
  if (r.isZero()) return 0;
  return toMoney(margin).div(r).times(100).toNumber();
}`}
      />
      <p>
        Example: margin $100 on revenue $500 gives{" "}
        <Math tex={R`(100/500)\times 100 = 20\%`} />. The division and multiplication happen in
        Decimal; conversion to <code>number</code> is the very last step.
      </p>
      <Callout variant="info" title="Edge cases">
        <code>toMoney(null)</code>, <code>toMoney(&quot;&quot;)</code>, and{" "}
        <code>toMoney(NaN)</code> all return 0; <code>sumMoney([])</code> returns 0;{" "}
        <code>marginPct(m, 0)</code> returns 0 rather than throwing on division by zero. SQL
        aggregates <code>COALESCE</code> missing prices and costs to 0 before any arithmetic.
      </Callout>

      {/* ──────────────────────────────────────────────────────── 2. Pricing */}
      <H2 id="pricing">Pricing</H2>
      <p>
        Every (account, SKU) pair carries four unit prices, one per usage outcome — a row in the{" "}
        <code>pricing</code> table:
      </p>
      <ParamTable
        nameHeader="Column"
        rows={[
          { name: "price_successful", type: "NUMERIC(14,4)", desc: <>$ per successful unit — the symbol <Math tex={R`p_s`} /> below.</> },
          { name: "price_successful_no_data", type: "NUMERIC(14,4)", desc: <>$ per unit that succeeded but returned no data — <Math tex={R`p_{\mathit{snd}}`} />.</> },
          { name: "price_failed", type: "NUMERIC(14,4)", desc: <>$ per failed unit (some contracts still bill these) — <Math tex={R`p_f`} />.</> },
          { name: "price_in_progress", type: "NUMERIC(14,4)", desc: <>$ per in-progress (async/deferred) unit — <Math tex={R`p_{\mathit{ip}}`} />.</> },
        ]}
      />

      <H3 id="pricing-temporal">Temporal resolution</H3>
      <p>
        Pricing rows are a history, keyed by <code>effective_from</code>. For a usage row dated{" "}
        <Math tex="D" />, the applicable pricing row is the one with the latest effective date
        not after <Math tex="D" />:
      </p>
      <Math
        display
        tex={R`e^{*}(D) = \max\{\, e_i : e_i \le D \,\}`}
      />
      <p>
        where <Math tex={R`e_1, e_2, \dots`} /> are the <code>effective_from</code> dates of the
        pair&rsquo;s pricing rows. Prices therefore form a <em>step function</em> of the usage
        date: a new row takes effect on its date and applies to all later usage until the next
        row begins. The lookup is a correlated subquery in the revenue view —{" "}
        <code>WHERE effective_from &lt;= u.date ORDER BY effective_from DESC LIMIT 1</code> —
        defined in <FilePath>migrations/0007_bundle_invoice_lines.sql</FilePath>.
      </p>
      <Callout variant="warn" title="No pricing row">
        If no pricing row exists with <Math tex={R`e_i \le D`} />, all four prices{" "}
        <code>COALESCE</code> to 0. The row earns $0 and the pair surfaces as a{" "}
        <strong>revenue leak</strong> (see <a href="#risk">Risk estimation</a>) until priced.
      </Callout>

      <H3 id="pricing-revenue">Per-row revenue</H3>
      <p>
        Each <code>usage_daily</code> row carries four unit counts:{" "}
        <Math tex="s" /> (successful), <Math tex={R`\mathit{snd}`} /> (successful, no data),{" "}
        <Math tex="f" /> (failed), and <Math tex={R`\mathit{ip}`} /> (in progress). The view{" "}
        <code>usage_daily_with_revenue</code> computes revenue per row, entirely in SQL{" "}
        <code>NUMERIC</code>:
      </p>
      <Math
        display
        tex={R`\text{revenue} = s \cdot p_s \;+\; \mathit{snd} \cdot p_{\mathit{snd}} \;+\; f \cdot p_f \;+\; \mathit{ip} \cdot p_{\mathit{ip}}`}
      />
      <p>
        The <Math tex={R`p_\bullet`} /> here are the view&rsquo;s <em>effective</em> prices
        (after bundle resolution, next section), so revenue is exactly units × price for every
        row with no special cases downstream.
      </p>

      <H3 id="pricing-supersede">Supersede vs. update</H3>
      <p>
        Editing a price behaves differently depending on whether the (account, SKU) pair has ever
        appeared on a finalized invoice (<code>isBilledPair</code>), implemented in{" "}
        <FilePath>src/app/api/pricing/route.ts</FilePath>:
      </p>
      <ul>
        <li>
          <strong>Not yet billed</strong> — the latest pricing row is <code>UPDATE</code>d in
          place. History doesn&rsquo;t matter yet, so there is nothing to preserve.
        </li>
        <li>
          <strong>Already billed</strong> — the existing row is immutable. A <em>new</em> row is
          written with <code>effective_from = today</code>, superseding the old price from today
          forward. Every invoice already derived keeps the price that produced it.
        </li>
        <li>
          <strong>No existing row</strong> — a fresh row is inserted with the chosen effective
          date.
        </li>
      </ul>
      <Callout variant="danger" title="Billed history is locked">
        Deleting pricing history for a billed pair is rejected outright — the API returns an
        error rather than orphaning the numbers behind an issued invoice.
      </Callout>

      {/* ──────────────────────────────────────────────────────── 3. Bundles */}
      <H2 id="bundles">Bundles (stitched SKUs)</H2>
      <p>
        A stitched product sells several catalog SKUs as one customer-facing product. For
        example, a realtime voice agent uses VOX-AGENT and VOX-STT-RT together. Usage records
        units for <em>each member</em>, but the account pays one agreed price per stitched unit. A
        bundle (<FilePath>migrations/0006_api_bundles.sql</FilePath>) names the member set and
        designates one <strong>anchor SKU</strong>. The anchor&rsquo;s unit counts equal the
        number of stitched units.
      </p>

      <H3 id="bundles-effective-price">Anchor pricing</H3>
      <p>
        For a usage row of account <Math tex="c" />, SKU <Math tex="a" />, date <Math tex="D" />,
        the effective price for each tier is:
      </p>
      <Math
        display
        tex={R`p_{\text{eff}} =
\begin{cases}
p^{\text{bundle}} & a \in \text{bundle} \;\wedge\; a = \text{anchor} \;\wedge\; \exists\, \text{bundle price with } e \le D \\
0 & a \in \text{bundle} \;\wedge\; a \ne \text{anchor} \;\wedge\; \exists\, \text{bundle price with } e \le D \\
p^{\text{individual}} & \text{otherwise}
\end{cases}`}
      />
      <p>
        Non-anchor members bill at exactly $0 — the bundle price on the anchor row already
        covers the whole stitched call, so zeroing the other members prevents double-billing.
        The view exposes <code>bundle_applied = 1</code> on rows where a bundle price was in
        effect, and <code>bundle_anchor = 1</code> on the anchor&rsquo;s rows. In SQL this is a
        pair of nested <code>CASE</code> expressions per tier:
      </p>
      <CodeBlock
        title="migrations/0007_bundle_invoice_lines.sql (per price tier)"
        lang="sql"
        code={`CASE WHEN bp.id IS NOT NULL
     THEN CASE WHEN b.anchor_api_code = u.api_code
               THEN COALESCE(bp.price_successful, 0) ELSE 0 END
     ELSE COALESCE(p.price_successful, 0) END AS p_s`}
      />

      <H3 id="bundles-temporal">Temporal bundle pricing</H3>
      <p>
        <code>bundle_pricing</code> has the same four tiers and the same step-function shape as
        individual pricing — the applicable row satisfies{" "}
        <Math tex={R`e^{*}(D) = \max\{ e_i : e_i \le D \}`} /> over the bundle&rsquo;s price
        history. Usage dated <em>before</em> the bundle&rsquo;s earliest{" "}
        <code>effective_from</code> has no applicable bundle row, so it falls through to
        individual <code>pricing</code> — creating a bundle never rewrites already-derived
        history, and a billing period that straddles the stitch date is split correctly:
        pre-stitch usage stays on per-SKU lines, post-stitch usage collapses into the bundle
        line.
      </p>
      <Callout variant="info" title="Leak detection and membership">
        Revenue-leak and unpriced-pair queries exclude any pair with{" "}
        <code>bundle_id IS NOT NULL</code> — membership alone, regardless of effective date —
        so bundle members never show up as &ldquo;unpriced&rdquo; even though their individual
        prices are absent. Once the bundle&rsquo;s anchor pair lands on a finalized invoice, the
        stitch is locked: members can&rsquo;t be removed, and price edits supersede rather than
        update (same rule as <a href="#pricing-supersede">individual pricing</a>).
      </Callout>

      {/* ──────────────────────────────────── 3b. Slab (volume-tier) pricing */}
      <H2 id="slabs">Slab pricing (graduated volume tiers)</H2>
      <p>
        A pricing row can switch from a flat per-unit rate to <strong>graduated volume tiers</strong>{" "}
        (<code>pricing.pricing_model = &apos;slab&apos;</code>). Tiers are marginal — like income-tax
        brackets — over the billing period&rsquo;s <em>total</em> units across all four outcomes.
        Each tier carries its own per-outcome price. The applicable tiers come from{" "}
        <code>pricing_slab</code> rows (<FilePath>migrations/0008_pricing_slabs.sql</FilePath>); the
        math lives in <FilePath>src/lib/pricing/slabs.ts</FilePath>.
      </p>

      <H3 id="slabs-bands">Bands and graduated allocation</H3>
      <p>
        Let the period&rsquo;s outcome unit counts be{" "}
        <Math tex={R`s,\ \mathit{snd},\ f,\ \mathit{ip}`} /> and the total{" "}
        <Math tex={R`T = s + \mathit{snd} + f + \mathit{ip}`} />. Tier <Math tex="i" /> spans units{" "}
        <Math tex={R`(\ell_i,\, h_i]`} /> (the first tier from 0; the top tier open-ended,{" "}
        <Math tex={R`h_i = \infty`} />). The volume that falls in tier <Math tex="i" /> is
      </p>
      <Math display tex={R`v_i = \max\!\big(0,\ \min(T,\, h_i) - \ell_i\big).`} />
      <p>
        Tiers are keyed on <strong>total</strong> volume, but each can price the four outcomes
        differently. Each tier&rsquo;s volume is split across outcomes in proportion to the
        period&rsquo;s mix, so the effective per-outcome unit price is the volume-weighted tier
        price, and revenue is the usual sum over outcomes:
      </p>
      <Math
        display
        tex={R`p^{\,\text{eff}}_{o} = \sum_i \frac{v_i}{T}\, p_{i,o}, \qquad
\text{revenue} = \sum_{o \in \{s,\,\mathit{snd},\,f,\,\mathit{ip}\}} o \cdot p^{\,\text{eff}}_{o}.`}
      />
      <p>
        This is order-independent and collapses to the obvious graduated calculation when only the
        successful price is set. Note that zero-priced outcomes still occupy band capacity, which
        slightly lowers the effective rate of the priced outcomes.
      </p>

      <H3 id="slabs-example">Worked example</H3>
      <p>
        MSG-SMS-US (SMS · United States, billed per message) with tiers 0&ndash;4,000,000 @
        $0.0079, 4,000,001&ndash;5,000,000 @ $0.0072, and 5,000,001+ @ $0.0065 (successful
        only). A period with 4,500,000 successful messages:
      </p>
      <Math
        display
        tex={R`\underbrace{4{,}000{,}000 \cdot 0.0079}_{\text{tier 1}} + \underbrace{500{,}000 \cdot 0.0072}_{\text{tier 2}} + \underbrace{0 \cdot 0.0065}_{\text{tier 3}} = 31{,}600 + 3{,}600 = \$35{,}200.`}
      />

      <H3 id="slabs-resolution">Why this is computed per period, not per day</H3>
      <p>
        A tier depends on the <em>whole</em> period&rsquo;s volume, so it cannot be resolved one day
        at a time. Slab rows therefore keep their flat <code>price_*</code> columns at 0 — the
        per-day <code>usage_daily_with_revenue</code> view yields $0 for them — and revenue is
        recomputed at the period level in <code>deriveStatement</code> (for invoices) and in{" "}
        <FilePath>src/lib/repos/slab-revenue.ts</FilePath> (for dashboard windows). Migration{" "}
        <code>0009_view_pricing_model.sql</code> exposes <code>p_model</code> on the view so
        leak/unpriced checks treat a slab pair as priced.
      </p>
      <CodeBlock
        title="src/lib/pricing/slabs.ts — graduated effective price per outcome"
        lang="ts"
        code={`for (const slab of sorted) {
  const cap = slab.max_hits ?? total;            // open top tier caps at the period total
  const tierVol = Math.max(0, Math.min(total, cap) - slab.min_hits);
  if (tierVol <= 0) continue;
  const share = new Decimal(tierVol).div(T);     // this tier's fraction of total volume
  eff_s = eff_s.plus(share.times(toMoney(slab.price_successful)));
  // …snd, f, ip likewise
}`}
      />
      <Callout variant="info" title="Bundles are never slab">
        Stitched bundles bill at the bundle rate on the anchor and never use slab tiers; the slab
        recompute applies only to non-bundle (<code>bundle_applied = 0</code>) usage.
      </Callout>

      {/* ──────────────────────────────────────────── 4. Vendor cost & margin */}
      <H2 id="vendor-cost">Vendor cost &amp; margin</H2>
      <p>
        Vendor costs mirror pricing exactly: a <code>vendor_pricing</code> row keyed on
        (vendor, SKU) holds four unit costs <Math tex={R`c_s, c_{\mathit{snd}}, c_f, c_{\mathit{ip}}`} />{" "}
        with the same <code>effective_from</code> step-function resolution. Per usage row:
      </p>
      <Math
        display
        tex={R`\text{vendor\_cost} = s \cdot c_s \;+\; \mathit{snd} \cdot c_{\mathit{snd}} \;+\; f \cdot c_f \;+\; \mathit{ip} \cdot c_{\mathit{ip}}`}
      />
      <p>Margin, at every level of aggregation, is the same subtraction and ratio:</p>
      <Math
        display
        tex={R`\text{margin} = \text{revenue} - \text{vendor\_cost}, \qquad
\text{margin\%} = \operatorname{marginPct}(\text{margin},\, \text{revenue})`}
      />
      <p>
        Every vendor cost row carries a <code>status</code> of <code>estimated</code>,{" "}
        <code>quoted</code> or <code>contracted</code>. This is purely an annotation — the
        numbers flow into totals unchanged — surfaced as an <em>Est.</em> chip on invoice lines
        (<FilePath>src/components/InvoiceReceipt.tsx</FilePath>) for any line whose rate is not
        yet <code>contracted</code>. A cost of <code>NULL</code> means the rate is unknown and
        contributes nothing; a cost of <code>0</code> means the vendor confirmed it does not
        charge for that outcome.
      </p>

      <H3 id="margin-watch">Margin-watch loss</H3>
      <p>
        The dashboard&rsquo;s margin watch finds priced pairs sold below vendor cost. Over the
        window, group by (account, SKU) and keep pairs where
      </p>
      <Math
        display
        tex={R`\sum \text{revenue} > 0 \;\;\wedge\;\; \sum \text{revenue} < \sum \text{vendor\_cost} \;\;\wedge\;\; \sum \text{units} > 0`}
      />
      <p>The booked loss across those pairs is the absolute net:</p>
      <Math
        display
        tex={R`\text{margin\_loss} = \left|\, \sum_{\text{pairs}} \big( \text{revenue} - \text{vendor\_cost} \big) \,\right|`}
      />
      <p>
        This is an <strong>actual</strong> figure — every dollar in it comes from real prices and
        real costs, unlike the estimated risk items below. Source:{" "}
        <FilePath>src/lib/repos/usage.ts</FilePath> (<code>getRiskSummary</code>).
      </p>
      <Callout variant="info" title="Why revenue > 0 is required">
        Pairs with zero revenue are excluded here because they belong to the{" "}
        <em>revenue leak</em> bucket instead — counting them in both places would double-report
        the same traffic.
      </Callout>

      {/* ───────────────────────────────────────────────────────── 5. Invoices */}
      <H2 id="invoices">Invoices</H2>
      <p>
        A draft statement for account <Math tex="c" /> over period{" "}
        <Math tex={R`[\,t_0, t_1\,]`} /> is derived live from the revenue view
        (<FilePath>src/lib/repos/statements.ts</FilePath>). Rows group into lines by{" "}
        <code>line_key</code>: bundle-applied usage groups per bundle (one line per stitch,
        carrying the anchor&rsquo;s unit counts and <em>all</em> members&rsquo; vendor cost);
        everything else groups per SKU.
      </p>

      <H3 id="invoice-lines">Line aggregation</H3>
      <Math
        display
        tex={R`\text{revenue}_{\ell} = \sum_{d = t_0}^{t_1} \text{revenue}(d, \ell), \qquad
\text{cost}_{\ell} = \sum_{d = t_0}^{t_1} \text{vendor\_cost}(d, \ell), \qquad
\text{margin}_{\ell} = \text{revenue}_{\ell} - \text{cost}_{\ell}`}
      />
      <p>
        Lines with zero total units are dropped (<code>HAVING &hellip; &gt; 0</code>). Line
        revenue and cost arrive from SQL as <code>NUMERIC</code> strings and are kept as
        Decimals throughout aggregation.
      </p>

      <H3 id="invoice-totals">Totals</H3>
      <Math
        display
        tex={R`\text{total\_revenue} = \sum_{\ell} \text{revenue}_{\ell}, \qquad
\text{total\_cost} = \sum_{\ell} \text{cost}_{\ell}`}
      />
      <Math
        display
        tex={R`\text{total\_margin} = \text{total\_revenue} - \text{total\_cost}, \qquad
\text{margin\%} = \operatorname{marginPct}(\text{total\_margin},\, \text{total\_revenue})`}
      />
      <p>
        Totals are computed by <code>sumMoney</code> over the <em>Decimal</em> line values and
        converted to <code>number</code> only at the response boundary; finalizing snapshots
        exactly these values into <code>statements</code> and <code>statement_lines</code>.
      </p>

      <H3 id="invoice-adjustments">Adjustments &amp; grand total</H3>
      <p>
        Adjustments are signed amounts — negative for credits, positive for late charges; zero
        is rejected — attachable only while the invoice status is <code>final</code>. Once
        issued, the invoice is locked.
      </p>
      <Math
        display
        tex={R`\text{grand\_total} = \text{total\_revenue} + \sum_{j} a_j`}
      />
      <p>
        where <Math tex={R`a_j`} /> are the adjustment amounts (summed with{" "}
        <code>sumMoney</code>).
      </p>

      <H3 id="invoice-unit-price">Unit price on the receipt</H3>
      <p>
        The receipt&rsquo;s &ldquo;Unit price&rdquo; column is a display-only back-calculation,
        not a stored price:
      </p>
      <Math
        display
        tex={R`\text{unitPrice}_{\ell} =
\begin{cases}
\dfrac{\text{revenue}_{\ell}}{s_{\ell}} & s_{\ell} > 0 \\[6pt]
0 & \text{otherwise}
\end{cases}`}
      />
      <p>
        where <Math tex={R`s_{\ell}`} /> counts only <em>successful</em> units
        (<FilePath>src/components/InvoiceReceipt.tsx</FilePath>).
      </p>
      <Callout variant="warn" title="Back-calculated, not configured">
        Because revenue can include paid <em>failed</em> or <em>no-data</em> units, and because a
        price change mid-period blends two rates, this quotient may differ from any single
        configured <code>price_successful</code>. It answers &ldquo;what did a successful unit
        effectively cost this period?&rdquo;, not &ldquo;what is the contracted rate?&rdquo;.
      </Callout>

      <H3 id="invoice-worked">Worked example</H3>
      <p>Account Kestrel Store, May 2026, two SKUs:</p>
      <ul>
        <li>
          MSG-SMS-US priced $0.0079 per successful message (other outcomes $0); vendor cost
          $0.0040 per message.
        </li>
        <li>DAT-GEOCODE priced $5.00 per 1K successful requests; vendor cost $2.00 per 1K requests.</li>
        <li>
          Usage: MSG-SMS-US — 50,000 successful messages on May&nbsp;1 + 25,000 on May&nbsp;3;
          DAT-GEOCODE — 100 units (100,000 requests) on May&nbsp;2.
        </li>
      </ul>
      <table>
        <thead>
          <tr><th>Line</th><th>Units</th><th>Revenue</th><th>Cost</th><th>Margin</th><th>Margin %</th></tr>
        </thead>
        <tbody>
          <tr><td>MSG-SMS-US</td><td>75,000 messages</td><td>75,000 × $0.0079 = $592.50</td><td>75,000 × $0.0040 = $300.00</td><td>$292.50</td><td>49.4%</td></tr>
          <tr><td>DAT-GEOCODE</td><td>100 × 1K requests</td><td>100 × $5.00 = $500.00</td><td>100 × $2.00 = $200.00</td><td>$300.00</td><td>60.0%</td></tr>
          <tr><td><strong>Totals</strong></td><td>—</td><td><strong>$1,092.50</strong></td><td>$500.00</td><td>$592.50</td><td>54.2%</td></tr>
        </tbody>
      </table>
      <p>
        The totals row leaves units blank because the two SKUs use different units. Total margin
        % is <Math tex={R`(592.50 / 1092.50) \times 100 = 54.2\%`} />. Add a $50 credit
        (adjustment <Math tex={R`a_1 = -50`} />) after finalizing:
      </p>
      <Math display tex={R`\text{grand\_total} = 1092.50 + (-50) = \$1{,}042.50`} />

      {/* ──────────────────────────────────────────── 6. Dashboard aggregations */}
      <H2 id="dashboard">Dashboard aggregations</H2>
      <p>
        All dashboard reads come from <code>usage_daily_with_revenue</code> over a window{" "}
        <Math tex={R`[\,t_0, t_1\,]`} /> (default: month-to-date in IST). Sandbox accounts are
        excluded unless the sandbox toggle is on. Throughout, a row&rsquo;s units are all four
        outcomes:
      </p>
      <Math display tex={R`h = s + \mathit{snd} + f + \mathit{ip}`} />

      <H3 id="kpis">Org KPIs</H3>
      <p>
        <FilePath>src/lib/repos/usage.ts</FilePath> (<code>getKpis</code>) sums across every
        date <Math tex="d" />, account <Math tex="c" />, and SKU <Math tex="a" /> in the window:
      </p>
      <Math
        display
        tex={R`\text{revenue} = \sum_{d,c,a} \text{revenue}(d,c,a), \qquad
\text{cost} = \sum_{d,c,a} \text{vendor\_cost}(d,c,a)`}
      />
      <Math
        display
        tex={R`\text{margin} = \text{revenue} - \text{cost}, \qquad
\text{margin\%} = \operatorname{marginPct}(\text{margin}, \text{revenue})`}
      />
      <Math
        display
        tex={R`\text{active\_accounts} = \big|\{\, c : \exists\ \text{usage row for } c \text{ in window} \,\}\big|, \qquad
\text{total\_units} = \sum_{d,c,a} h(d,c,a)`}
      />

      <H3 id="daily-series">Daily series</H3>
      <p>The trend chart groups the same sums by calendar date:</p>
      <Math
        display
        tex={R`\text{revenue}(d) = \sum_{c,a} \text{revenue}(d,c,a), \qquad
\text{margin}(d) = \text{revenue}(d) - \text{vendor\_cost}(d), \qquad
h(d) = \sum_{c,a} h(d,c,a)`}
      />

      <H3 id="mom-pacing">Month-over-month pacing</H3>
      <p>
        Comparing a partial current month against a full prior month head-to-head would always
        look like a collapse. The headline delta (<FilePath>src/app/page.tsx</FilePath>) scales
        the prior month down to the number of days the current window actually has data for.
        Let <Math tex="E" /> be the count of days in the window with data (the length of the
        daily series), <Math tex="N" /> the day count of the prior full month,{" "}
        <Math tex={R`R_{\text{mtd}}`} /> current-window revenue, and{" "}
        <Math tex={R`R_{\text{prior}}`} /> prior-month revenue:
      </p>
      <Math
        display
        tex={R`R_{\text{scaled}} = R_{\text{prior}} \cdot \frac{E}{N}`}
      />
      <Math
        display
        tex={R`\Delta = \frac{R_{\text{mtd}} - R_{\text{scaled}}}{R_{\text{scaled}}} \times 100`}
      />
      <p>
        <strong>Worked example.</strong> Prior month: $720,000 over <Math tex="N = 30" /> days
        ($24,000/day). Current month: $432,000 over <Math tex="E = 15" /> data days. Then{" "}
        <Math tex={R`R_{\text{scaled}} = 720000 \times 15/30 = 360{,}000`} /> and{" "}
        <Math tex={R`\Delta = (432000 - 360000)/360000 \times 100 = +20\%`} /> — pacing ahead.
      </p>
      <Callout variant="info" title="When the delta is null">
        If <Math tex={R`R_{\text{prior}} \le 0`} /> or <Math tex={R`E \le 0`} /> the delta is{" "}
        <code>null</code> (rendered as &ldquo;Compared with last month&rdquo; with no
        percentage) — there is no meaningful base rate to compare against. Note{" "}
        <Math tex="E" /> counts days that <em>carry data</em>, not calendar days elapsed, so a
        late-arriving import doesn&rsquo;t deflate the pace.
      </Callout>

      <H3 id="account-summaries">Account summaries &amp; unpriced pairs</H3>
      <p>
        Per account (<FilePath>src/lib/repos/accounts.ts</FilePath>): revenue, units, and{" "}
        <code>apis_used</code> (distinct SKUs with traffic) sum as above. A pair is{" "}
        <strong>unpriced</strong> when it has traffic, no effective price in any tier, and is
        not in a bundle:
      </p>
      <Math
        display
        tex={R`\text{unpriced}(c,a) \iff p_s = p_{\mathit{snd}} = p_f = p_{\mathit{ip}} = 0 \;\wedge\; \neg\,\text{bundled} \;\wedge\; h > 0`}
      />
      <Math
        display
        tex={R`\text{unpriced\_pairs}(c) = \big|\{\, a : \text{unpriced}(c,a) \,\}\big|, \qquad
\text{unpriced\_units}(c) = \sum_{a\,:\,\text{unpriced}} h`}
      />

      <H3 id="sku-summaries">SKU summaries &amp; average unit price</H3>
      <p>
        Per SKU (<FilePath>src/lib/repos/apis.ts</FilePath>), with{" "}
        <Math tex={R`s_{\text{units}}`} /> the sum of <em>successful</em> units only:
      </p>
      <Math
        display
        tex={R`\text{avg\_unit\_price} =
\begin{cases}
\dfrac{\text{revenue}}{s_{\text{units}}} & s_{\text{units}} > 0 \\[6pt]
0 & \text{otherwise}
\end{cases}`}
      />
      <p>
        The SKUs screen&rsquo;s <em>low-margin</em> filter (<FilePath>src/app/skus/page.tsx</FilePath>)
        keeps SKUs earning real revenue at under a 25% margin ratio:
      </p>
      <Math
        display
        tex={R`\text{low-margin}(a) \iff \text{revenue}(a) > 0 \;\wedge\; \frac{\text{margin}(a)}{\text{revenue}(a)} < 0.25`}
      />
      <p>
        Briefing copy (<FilePath>src/lib/briefing.ts</FilePath>) applies fixed thresholds to
        these aggregates: SKU concentration flagged when one SKU holds ≥ 60% of an account&rsquo;s
        revenue, account concentration when one account holds ≥ 50% of a SKU&rsquo;s revenue,
        price spread when <Math tex={R`p_{\max}/p_{\min} \ge 2`} /> over non-zero prices, and
        pace callouts when <Math tex={R`|\Delta| \ge 5\%`} />.
      </p>

      {/* ─────────────────────────────────────────────────── 7. Risk estimation */}
      <H2 id="risk">Risk estimation</H2>
      <p>
        The &ldquo;money at risk&rdquo; panel (<FilePath>src/lib/repos/usage.ts</FilePath>,{" "}
        <code>getRiskSummary</code>) quantifies three problems in dollars. Two are{" "}
        <em>estimates</em> priced at the org&rsquo;s average revenue per billable unit; one is an
        actual booked figure.
      </p>

      <H3 id="risk-rate">The estimation rate</H3>
      <p>
        Over priced, non-sandbox traffic in the window (rows with{" "}
        <Math tex={R`\text{revenue} > 0`} />):
      </p>
      <Math
        display
        tex={R`\text{rate} = \frac{\displaystyle\sum_{\text{rows}:\, \text{revenue} > 0} \text{revenue}}
{\displaystyle\sum_{\text{rows}:\, \text{revenue} > 0} h}`}
      />
      <Callout variant="info" title="No priced volume">
        If the window has no rows with positive revenue, the rate is 0 and both estimated risk
        items collapse to $0 — Ledgerline will not invent a rate.
      </Callout>

      <H3 id="risk-leak">Revenue leak (estimated)</H3>
      <p>
        Unpriced billable pairs — same predicate as{" "}
        <a href="#account-summaries">unpriced pairs</a>, restricted to mapped, non-sandbox
        traffic:
      </p>
      <Math
        display
        tex={R`\text{leak\_units} = \sum_{(c,a)\,:\,\text{unpriced}} h, \qquad
\text{leak\_amount} = \text{leak\_units} \times \text{rate}`}
      />

      <H3 id="risk-silent">Silent loss (estimated)</H3>
      <p>
        Usage rows whose raw account name or SKU code failed to resolve (<code>client_id IS NULL</code>{" "}
        or <code>api_code IS NULL</code>) are invisible to revenue entirely:
      </p>
      <Math
        display
        tex={R`\text{loss\_units} = \sum_{\text{rows unmapped}} h, \qquad
\text{loss\_amount} = \text{loss\_units} \times \text{rate}`}
      />

      <H3 id="risk-total">Margin watch &amp; totals</H3>
      <p>
        The third item is the <a href="#margin-watch">margin-watch loss</a> — actual, not
        estimated. The panel total is the plain sum:
      </p>
      <Math
        display
        tex={R`\text{total\_risk} = \text{leak\_amount} + \text{loss\_amount} + \text{margin\_loss}`}
      />
      <p>
        The total is marked estimated (shown with a <code>~</code> prefix) whenever any
        estimated component is positive. One modeled dollar in the sum makes the whole figure an
        estimate.
      </p>

      {/* ──────────────────────────────────────────────────── 8. Activity heatmap */}
      <H2 id="heatmap">Activity heatmap</H2>
      <p>
        The 90-day heatmap (<FilePath>src/components/ActivityHeatmap.tsx</FilePath>) tints each
        day by unit volume using quintile-style bucketing over the window&rsquo;s{" "}
        <em>positive</em> days. Let <Math tex={R`P = (P_0 \le P_1 \le \dots \le P_{n-1})`} /> be
        the sorted unit counts of in-window days with <Math tex={R`h > 0`} />. The quantile at
        fraction <Math tex="p" /> is the element at the floored index, clamped to the last
        element:
      </p>
      <Math
        display
        tex={R`q(p) =
\begin{cases}
0 & n = 0 \\
P_{\min(n-1,\; \lfloor n \cdot p \rfloor)} & \text{otherwise}
\end{cases}`}
      />
      <p>
        With cut points <Math tex={R`q_1 = q(0.25)`} />, <Math tex={R`q_2 = q(0.5)`} />,{" "}
        <Math tex={R`q_3 = q(0.75)`} />, a day with <Math tex="h" /> units lands in bucket:
      </p>
      <Math
        display
        tex={R`\operatorname{bucket}(h) =
\begin{cases}
0 & h \le 0 \\
1 & 0 < h \le q_1 \\
2 & q_1 < h \le q_2 \\
3 & q_2 < h \le q_3 \\
4 & h > q_3
\end{cases}`}
      />
      <CodeBlock
        title="src/components/ActivityHeatmap.tsx"
        lang="ts"
        code={`const positive = days.filter((d) => d.hits > 0).map((d) => d.hits).sort((a, b) => a - b);
const q = (p: number) =>
  positive.length === 0 ? 0 : positive[Math.min(positive.length - 1, Math.floor(positive.length * p))];
const q1 = q(0.25);
const q2 = q(0.5);
const q3 = q(0.75);

const bucket = (hits: number): 0 | 1 | 2 | 3 | 4 => {
  if (hits <= 0) return 0;
  if (hits <= q1) return 1;
  if (hits <= q2) return 2;
  if (hits <= q3) return 3;
  return 4;
};`}
      />
      <p>
        Buckets 0–4 map to CSS classes <code>fill-heat-0</code> … <code>fill-heat-4</code>{" "}
        (lightest to deepest accent).
      </p>
      <p>
        <strong>Worked example.</strong> Positive days sorted:{" "}
        <Math tex={R`P = (5, 10, 15, 20, 100)`} />, so <Math tex="n = 5" />. Then{" "}
        <Math tex={R`q_1 = P_{\lfloor 1.25 \rfloor} = P_1 = 10`} />,{" "}
        <Math tex={R`q_2 = P_{\lfloor 2.5 \rfloor} = P_2 = 15`} />,{" "}
        <Math tex={R`q_3 = P_{\lfloor 3.75 \rfloor} = P_3 = 20`} />. A day with 8 units falls in
        bucket 1 (<Math tex={R`0 < 8 \le 10`} />); a day with 25 units falls in bucket 4
        (<Math tex={R`25 > 20`} />). The single 100-unit outlier does not compress the
        scale, because cut points come from ranks, not from the maximum.
      </p>
      <Callout variant="info" title="Empty window">
        With no positive days, all quantiles are 0 and every cell takes bucket 0. The header
        stats are <Math tex={R`\text{totalHits} = \sum_{h_d > 0} h_d`} /> and{" "}
        <Math tex={R`\text{activeDays} = |\{ d : h_d > 0 \}|`} />, shown as
        &ldquo;X units · Y/90 active days&rdquo;.
      </Callout>

      {/* ──────────────────────────────────────────────────── 9. Number formatting */}
      <H2 id="formatting">Number formatting</H2>
      <p>
        <FilePath>src/lib/format.ts</FilePath> deliberately avoids{" "}
        <code>toLocaleString(&hellip;)</code> for numbers. Node&rsquo;s ICU build can group
        differently from the browser, which causes React hydration mismatches. All formatting is
        deterministic.
      </p>

      <H3 id="formatting-grouping">Digit grouping</H3>
      <p>
        Integers group in threes with commas (thousand, million, billion):
      </p>
      <CodeBlock
        title="src/lib/format.ts"
        lang="ts"
        code={`function formatInteger(n: number): string {
  const sign = n < 0 ? "-" : "";
  const s = Math.abs(Math.trunc(n)).toString();
  return sign + s.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");
}

function formatDecimal(n: number, precision: number): string {
  if (precision <= 0) return formatInteger(Math.round(n));
  const sign = n < 0 ? "-" : "";
  const fixed = Math.abs(n).toFixed(precision); // e.g. "1234567.89"
  const [intPart, decPart] = fixed.split(".");
  return sign + formatInteger(Number(intPart)) + "." + decPart;
}`}
      />
      <p>
        <strong>Worked example.</strong> 1234567 → <strong>1,234,567</strong>. With 2 decimals,
        1234567.891 → <code>toFixed(2)</code> = <code>1234567.89</code> → the integer part is
        grouped and the fraction re-attached → <strong>1,234,567.89</strong>.
      </p>

      <H3 id="formatting-compact">Compact K/M/B notation</H3>
      <p>
        <code>formatMoney</code> shows whole dollars by default ($12,480). With{" "}
        <code>compact: true</code> it is the piecewise function:
      </p>
      <Math
        display
        tex={R`\operatorname{formatMoney}(n) =
\begin{cases}
\$\,\big(n / 10^9\big)\ \text{B} & |n| \ge 10^9 \quad \text{(2 decimals)} \\[2pt]
\$\,\big(n / 10^6\big)\ \text{M} & 10^6 \le |n| < 10^9 \quad \text{(2 decimals)} \\[2pt]
\$\,\big(n / 10^3\big)\ \text{K} & 10^3 \le |n| < 10^6 \quad \text{(1 decimal)} \\[2pt]
\$\,n & |n| < 10^3
\end{cases}`}
      />
      <p>
        Examples: 1,240,000 → <strong>$1.24M</strong>; 740,000 → <strong>$740.0K</strong>;
        950 → <strong>$950</strong>. A negative amount puts the sign before the dollar sign:
        −1,200 → <strong>-$1,200</strong>. Non-finite input renders as an em dash (—) in every
        formatter.
      </p>

      <H3 id="formatting-price">Price precision</H3>
      <p>
        <code>formatPrice</code> shows unit prices with 2 decimals when the value is exact at 2,
        otherwise with 4 decimals, because many SKUs cost fractions of a cent. Zero shows as
        plain $0:
      </p>
      <Math
        display
        tex={R`\text{precision}(n) =
\begin{cases}
2 & n \times 100 \in \mathbb{Z} \\
4 & \text{otherwise}
\end{cases}`}
      />
      <p>
        So ATL-PRO-IN at $3 per 1M tokens shows as <strong>$3.00</strong>, while MSG-SMS-US at
        $0.0079 per message keeps all four decimals (<strong>$0.0079</strong>). Sub-cent
        contract rates are never rounded on screen.
      </p>

      <H3 id="formatting-percent">Percentages</H3>
      <Math display tex={R`\operatorname{formatPercent}(n, k{=}1) = \texttt{toFixed}(n, k) + \text{"\%"}`} />
      <p>
        One decimal by default; KPI headlines pass <Math tex="k=0" />. Integer counts use the
        same comma grouping via <code>formatNumber</code> (truncating any fraction first).
      </p>

      {/* ─────────────────────────────────────────────────── 10. Dates & timezones */}
      <H2 id="dates">Dates &amp; timezones</H2>
      <p>
        Every business date in Ledgerline — <code>usage_daily.date</code>, period boundaries,
        pricing <code>effective_from</code> — is an <strong>IST calendar date</strong>{" "}
        (Asia/Kolkata, UTC+05:30), regardless of where the server runs. The source data&rsquo;s
        report dates are IST days, so the whole pipeline stays in that calendar
        (<FilePath>src/lib/repos/periods.ts</FilePath>).
      </p>
      <ul>
        <li>
          <code>todayIST()</code> formats &ldquo;now&rdquo; through{" "}
          <code>Intl.DateTimeFormat(&quot;en-CA&quot;, {"{ timeZone: \"Asia/Kolkata\" }"})</code>,
          yielding the current ISO date in IST.
        </li>
        <li>
          <code>mtdRange()</code> — from the 1st of the current IST month to today. The default
          window everywhere.
        </li>
        <li>
          <code>prevMonthRange()</code> — the previous full IST calendar month (the pacing
          comparison base).
        </li>
        <li>
          <code>lastNDaysRange(n)</code> — the trailing <Math tex="n" /> days{" "}
          <em>ending yesterday</em>, because daily ingestion lands data through yesterday;
          every covered day actually has data. <code>lastWeekRange()</code> is the previous
          Monday–Sunday.
        </li>
      </ul>

      <H3 id="dates-display">Deterministic IST display</H3>
      <p>
        Timestamps render as &ldquo;12 May 2026, 14:48 IST&rdquo; without locale APIs (which
        vary across Node versions and would risk hydration drift). The conversion is a fixed
        offset added to the UTC epoch, after which UTC accessors read out IST wall-clock parts:
      </p>
      <Math
        display
        tex={R`t_{\text{IST}} = t_{\text{UTC}} + (5 \times 60 + 30) \times 60{,}000 \ \text{ms} = t_{\text{UTC}} + 330\ \text{min}`}
      />
      <Callout variant="info" title="Why a fixed offset is safe here">
        IST has no daylight-saving time and has been a constant +5:30 for the entire range of
        data Ledgerline handles, so a fixed offset is exact — and deterministic across server and
        browser, unlike locale-dependent formatting. SQLite-style timestamps
        (&ldquo;YYYY-MM-DD HH:MM:SS&rdquo;) are treated as UTC before the shift
        (<FilePath>src/lib/format.ts</FilePath>).
      </Callout>

      <Related
        links={[
          { href: "/help/architecture", label: "Architecture" },
          { href: "/help/api", label: "API reference" },
          { href: "/help/guides", label: "How-to guides" },
        ]}
      />
    </DocPage>
  );
}
