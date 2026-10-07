import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBar } from "@/components/StatusBar";
import { VendorTabs } from "@/components/vendor/VendorTabs";
import { RateCell } from "@/components/vendor/RateCell";
import { CostBasisCell } from "@/components/vendor/CostBasisCell";
import { VolumeCostCell } from "@/components/vendor/VolumeCostCell";
import { MinimumCard } from "@/components/vendor/MinimumCard";
import { VendorIdentityCard } from "@/components/vendor/VendorIdentityCard";
import { ConfidenceBar } from "@/components/vendor/ConfidenceBar";
import { Stat } from "@/components/dashboard/Headline";
import { TruncateTooltip } from "@/components/ui/TruncateTooltip";
import {
  rateCard,
  vendorByName,
  vendorConfidence,
  vendorSandboxHits,
  type RateCardRow,
} from "@/lib/repos/vendor-cost";
import { vendorRecord } from "@/lib/vendor-registry";
import { vendorMinimumMonths, vendorCommitments } from "@/lib/repos/vendor-minimum";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { resolvePeriod } from "@/lib/period";
import { requireRole, can } from "@/lib/access";
import { formatINR, formatNumber, formatPercent, formatDateRange } from "@/lib/format";
import { Activity, Layers, BadgeCheck, Ban } from "lucide-react";

/** No outcome on this row has a cost yet. */
const neverPriced = (r: RateCardRow) =>
  r.cost_successful == null &&
  r.cost_successful_no_data == null &&
  r.cost_failed == null &&
  r.cost_in_progress == null;

/** Someone has decided no vendor invoice exists for this pair. */
const decidedFree = (r: RateCardRow) => r.cost_basis != null && r.cost_basis !== "vendor";

/** The rate is a bracket set, not four flat numbers. */
const isVolume = (r: RateCardRow) => r.pricing_model !== "flat";

/** A rate is genuinely missing only when nobody has decided it is unnecessary. */
const trulyUnrated = (r: RateCardRow) => r.cost_successful == null && !decidedFree(r);

const COL_COUNT = 10;

export default async function VendorRateCardPage({
  params,
  searchParams,
}: {
  params: { vendor: string };
  searchParams?: { from?: string; to?: string };
}) {
  const requested = decodeURIComponent(params.vendor);
  const user = await requireRole("admin");
  const editable = can(user.role, "vendor_pricing.edit");
  const period = resolvePeriod(searchParams);

  // The page is driven by the registry, not by this period's traffic and not
  // by whether a rate exists: a rate has to be settable before the first hit
  // arrives, and a vendor with a quiet month must still open (findings 5 and
  // 16). Only a name the registry has never heard of is a 404.
  const registry = await vendorByName(requested);
  if (!registry) notFound();
  // A link saved under a former name resolves through the alias and lands on
  // the canonical URL, the way a renamed account's slug does.
  if (registry.canonical_name !== requested) {
    const qs = new URLSearchParams();
    if (searchParams?.from) qs.set("from", searchParams.from);
    if (searchParams?.to) qs.set("to", searchParams.to);
    const tail = qs.toString();
    redirect(`/vendors/${encodeURIComponent(registry.canonical_name)}${tail ? `?${tail}` : ""}`);
  }
  const vendor = registry.canonical_name;

  const [rows, confidence, minimumMonths, commitments, record, sandbox] = await Promise.all([
    rateCard(vendor, period.from, period.to),
    vendorConfidence(vendor, period.from, period.to),
    vendorMinimumMonths({ vendor, from: period.from, to: period.to }),
    vendorCommitments(vendor),
    vendorRecord(registry.id),
    vendorSandboxHits(vendor, period.from, period.to),
  ]);

  // A monthly minimum tops the vendor up to its floor. No API row carries it —
  // the vendor bills it because the whole month's traffic was light — so it is
  // added to the vendor's total here and stated separately below.
  const minimumTopUp = minimumMonths
    .filter((m) => m.applied)
    .reduce((s, m) => s + m.top_up, 0);
  const meteredCost = rows.reduce((s, r) => s + r.period_cost, 0);
  const totalCost = meteredCost + minimumTopUp;
  // The floor in force today: the newest row on or before today, unless it
  // cleared the minimum back to none.
  const today = new Date().toISOString().slice(0, 10);
  const currentCommitment = commitments.find((c) => c.effective_from <= today) ?? null;
  const totalHits = rows.reduce((s, r) => s + r.hits, 0);
  const priced = rows.filter((r) => r.cost_successful != null && !decidedFree(r)).length;
  const trafficked = rows.filter((r) => r.hits > 0);

  // Unpriced traffic first: it is the work to be done, and it is what makes
  // the cost total wrong. Mirrors the "Unpriced — earning nothing" band on
  // the account pricing table.
  const unpricedWithTraffic = rows.filter((r) => trulyUnrated(r) && r.hits > 0);
  const pricedRows = rows.filter((r) => r.cost_successful != null && !decidedFree(r));
  // Pairs nobody has to price. They sit in their own band rather than under
  // "No rate", because ₹0 here is a decision.
  const noVendorCost = rows.filter(decidedFree);
  const quiet = rows.filter((r) => trulyUnrated(r) && r.hits === 0);

  const maxCost = rows.reduce((m, r) => Math.max(m, r.period_cost), 0) || 1;

  return (
    <main>
      <StatusBar
        title={vendor}
        subtitle={`${rows.length} API${rows.length === 1 ? "" : "s"} on the rate card · ${formatINR(totalCost, { compact: true })} cost · ${formatDateRange(period.from, period.to)}`}
      />

      <div className="mx-auto w-full max-w-[1600px] px-7 pt-5 space-y-4">
        <VendorTabs vendor={vendor} query={`from=${period.from}&to=${period.to}`} />
        <DateRangePicker from={period.from} to={period.to} />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-7 py-6 space-y-6">
        <section
          className="elev-1 bg-bg-raised rounded-lg p-6 dash-enter"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <h2 className="text-xs uppercase tracking-widest text-ink-muted">Vendor cost</h2>
          <div className="flex items-end gap-3 mt-[6px]">
            <span className="inline-block">
              <span
                className="block font-serif text-5xl text-ink leading-none tnum landmark-wipe"
                style={{ fontWeight: 600 }}
              >
                {formatINR(totalCost, { precision: 0 })}
              </span>
              <span className="block h-px bg-accent mt-2 landmark-rail" aria-hidden="true" />
            </span>
          </div>
          <p className="text-sm text-ink-muted mt-3 max-w-2xl leading-normal">
            {vendor} served {formatNumber(totalHits)} hits across {trafficked.length} API
            {trafficked.length === 1 ? "" : "s"} in this period.{" "}
            {unpricedWithTraffic.length > 0 ? (
              <span className="text-warn-ink">
                {unpricedWithTraffic.length} of those {unpricedWithTraffic.length === 1 ? "has" : "have"}{" "}
                no rate, so {formatNumber(unpricedWithTraffic.reduce((s, r) => s + r.hits, 0))} hits
                cost ₹0 here — unknown, not free.
              </span>
            ) : trafficked.length > 0 ? (
              noVendorCost.length === rows.length ? (
                "Nothing here is billed by a vendor, so ₹0 is the answer rather than a gap."
              ) : (
                "Every API with traffic has a rate, or a decision that it needs none."
              )
            ) : (
              "No traffic in this period."
            )}
          </p>
          {minimumTopUp > 0 && (
            <p className="text-sm text-ink-muted mt-2 max-w-2xl leading-normal">
              {formatINR(minimumTopUp, { precision: 0 })} of that is the monthly minimum topping
              light months up to the contracted floor, not metered traffic. The rate card rows
              below sum to {formatINR(meteredCost, { precision: 0 })}.
            </p>
          )}
          <div className="max-w-sm mt-4">
            <ConfidenceBar confidence={confidence} />
          </div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mt-6 pt-5 border-t border-border">
            <Stat icon={<Activity size={12} strokeWidth={1.5} />} label="Hits" value={formatNumber(totalHits)} />
            <Stat icon={<Layers size={12} strokeWidth={1.5} />} label="APIs on card" value={String(rows.length)} />
            <Stat
              icon={<BadgeCheck size={12} strokeWidth={1.5} />}
              label="Rates known"
              value={`${priced} of ${rows.length - noVendorCost.length}`}
            />
            {noVendorCost.length > 0 && (
              // Counting a decided pair as a missing rate is the confusion this
              // whole change removes, so it is stated separately rather than
              // folded into the denominator above.
              <Stat
                icon={<Ban size={12} strokeWidth={1.5} />}
                label="Need no rate"
                value={String(noVendorCost.length)}
              />
            )}
          </div>
        </section>

        <div className="dash-enter" style={{ "--i": 1 } as React.CSSProperties}>
          <VendorIdentityCard
            vendorId={registry.id}
            canonicalName={vendor}
            status={record?.status ?? registry.status}
            chargesSandbox={record?.charges_sandbox ?? registry.charges_sandbox}
            sandbox={sandbox}
            aliases={record?.aliases ?? []}
            editable={editable}
          />
        </div>

        <div className="dash-enter" style={{ "--i": 2 } as React.CSSProperties}>
          <MinimumCard
            vendorName={vendor}
            months={minimumMonths}
            current={currentCommitment?.monthly_minimum ?? null}
            currentFrom={currentCommitment?.effective_from ?? null}
            status={currentCommitment?.status ?? null}
            source={currentCommitment?.source ?? null}
            editable={editable}
          />
        </div>

        <section className="dash-enter" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl text-ink">Rate card</h2>
            {editable && (
              <div className="text-xs text-ink-muted">
                A rate starts on a date and carries a status — click any cost to set it
              </div>
            )}
          </div>
          <div className="elev-1 bg-bg-raised rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-sunken text-ink-muted text-xs uppercase tracking-wide sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">API</th>
                  <th className="px-3 py-3 font-medium text-right">Hits</th>
                  {/* Full words, not "(S) / (ND) / (F) / (IP)" — finding 8. */}
                  <th className="px-3 py-3 font-medium text-right">Successful</th>
                  <th className="px-3 py-3 font-medium text-right">No data</th>
                  <th className="px-3 py-3 font-medium text-right">Failed</th>
                  <th className="px-3 py-3 font-medium text-right">In progress</th>
                  <th className="px-3 py-3 font-medium">Effective from</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Source</th>
                  <th className="px-3 py-3 font-medium text-right">Period cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unpricedWithTraffic.length > 0 && (
                  <Band label="No rate — traffic costing ₹0" count={unpricedWithTraffic.length} tone="bad" />
                )}
                {unpricedWithTraffic.map((r, i) => (
                  <Row key={r.api_code} r={r} i={i} vendor={vendor} editable={editable} maxCost={maxCost} />
                ))}

                {pricedRows.length > 0 && <Band label="Priced" count={pricedRows.length} />}
                {pricedRows.map((r, i) => (
                  <Row key={r.api_code} r={r} i={i} vendor={vendor} editable={editable} maxCost={maxCost} />
                ))}

                {noVendorCost.length > 0 && (
                  <Band label="No vendor cost — ₹0 by decision" count={noVendorCost.length} />
                )}
                {noVendorCost.map((r, i) => (
                  <Row key={r.api_code} r={r} i={i} vendor={vendor} editable={editable} maxCost={maxCost} />
                ))}

                {quiet.length > 0 && <Band label="No rate, no traffic this period" count={quiet.length} />}
                {quiet.map((r, i) => (
                  <Row key={r.api_code} r={r} i={i} vendor={vendor} editable={editable} maxCost={maxCost} />
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-ink-muted">
                Nothing on this vendor&rsquo;s rate card yet. Rows appear once the sync attributes
                traffic to {vendor}.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Band({ label, count, tone }: { label: string; count: number; tone?: "bad" }) {
  return (
    <tr className={tone === "bad" ? "bg-bad-bg" : "bg-bg-sunken"}>
      <td colSpan={COL_COUNT} className="px-4 py-2">
        <span
          className={`text-[10px] uppercase tracking-widest ${tone === "bad" ? "text-bad-ink" : "text-ink-muted"}`}
        >
          {label} · {count}
        </span>
      </td>
    </tr>
  );
}

function Row({
  r,
  i,
  vendor,
  editable,
  maxCost,
}: {
  r: RateCardRow;
  i: number;
  vendor: string;
  editable: boolean;
  maxCost: number;
}) {
  const fresh = neverPriced(r);
  const free = decidedFree(r);
  const volume = isVolume(r);
  const volumeProps = {
    vendorName: vendor,
    apiCode: r.api_code,
    apiName: r.api_name,
    model: r.pricing_model,
    slabs: r.slabs,
    status: r.status,
    source: r.source,
    effectiveFrom: r.effective_from,
    neverPriced: fresh,
    editable,
  };
  const shared = {
    vendor_name: vendor,
    api_code: r.api_code,
    api_name: r.api_name,
    status: r.status,
    source: r.source,
    effectiveFrom: r.effective_from,
    neverPriced: fresh,
    editable,
  };
  return (
    <tr
      className="row-enter hover:bg-bg-sunken transition-colors duration-fast ease-expo"
      style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
    >
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-ink-faint">{r.api_code}</div>
        <Link href={`/apis/${r.api_code}`} className="block text-sm text-ink hover:text-accent-ink">
          <TruncateTooltip as="div" text={r.api_name} />
        </Link>
        {/* A pair on flat rates gets a quiet way into volume pricing. A pair
            that already has a ladder shows it in the cost columns instead, and
            a pair nobody bills for needs neither. */}
        {!volume && !free && (
          <div className="mt-1">
            <VolumeCostCell variant="chip" {...volumeProps} />
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right font-mono tnum text-ink-muted">
        {r.hits > 0 ? formatNumber(r.hits) : <span className="text-ink-faint">—</span>}
      </td>
      {free ? (
        // Four rate cells would invite someone to price a pair that has already
        // been decided to have no vendor bill. One span says it once.
        <td
          colSpan={4}
          className="px-3 py-3 text-center text-xs text-ink-muted"
          title={
            r.cost_basis === "components"
              ? "A stitched or journey product: its cost sits on the component APIs, which are costed on their own rows."
              : "We serve this call ourselves. No vendor invoice exists for it."
          }
        >
          not billed by {vendor === "InHouse" ? "any vendor" : vendor}
        </td>
      ) : volume ? (
        // Four cells reading ₹0 would invite someone to type over a ladder.
        // One cell states the ladder and opens the editor for it.
        <td colSpan={4} className="px-3 py-3">
          <VolumeCostCell variant="summary" {...volumeProps} />
        </td>
      ) : (
        <>
          <td className="px-3 py-3 text-right">
            <RateCell {...shared} field="cost_successful" value={r.cost_successful} />
          </td>
          <td className="px-3 py-3 text-right">
            <RateCell {...shared} field="cost_successful_no_data" value={r.cost_successful_no_data} />
          </td>
          <td className="px-3 py-3 text-right">
            <RateCell {...shared} field="cost_failed" value={r.cost_failed} />
          </td>
          <td className="px-3 py-3 text-right">
            <RateCell {...shared} field="cost_in_progress" value={r.cost_in_progress} />
          </td>
        </>
      )}
      <td className="px-3 py-3 font-mono text-xs text-ink-muted tnum whitespace-nowrap">
        {r.effective_from ?? <span className="text-ink-faint">—</span>}
        {r.versions > 1 && (
          <span className="text-ink-faint" title={`${r.versions} dated versions of this rate`}>
            {" "}
            +{r.versions - 1}
          </span>
        )}
      </td>
      {/* Monochrome text, not a colour: status is a fact about provenance, not
          a severity. */}
      <td className="px-3 py-3 text-xs text-ink-muted whitespace-nowrap">
        <CostBasisCell
          vendor_name={vendor}
          api_code={r.api_code}
          api_name={r.api_name}
          basis={r.cost_basis}
          status={r.status}
          hasRate={r.cost_successful != null}
          effectiveFrom={r.effective_from}
          editable={editable}
        />
      </td>
      <td className="px-3 py-3 text-xs text-ink-muted max-w-[180px]">
        {r.source ? (
          <TruncateTooltip as="div" text={r.source} />
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="font-mono tnum text-ink">{formatINR(r.period_cost, { precision: 0 })}</div>
        {r.period_cost > 0 && (
          <div className="mt-1 h-[4px] rounded bg-bg-sunken overflow-hidden" title={`${formatPercent((r.period_cost / maxCost) * 100, 0)} of this vendor's largest API cost`}>
            <div
              className="h-full rounded bg-accent bar-grow"
              style={{ width: `${Math.max(2, (r.period_cost / maxCost) * 100)}%`, "--i": Math.min(i, 12) } as React.CSSProperties}
            />
          </div>
        )}
      </td>
    </tr>
  );
}
