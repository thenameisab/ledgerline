import Link from "next/link";
import { Copy } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { AliasResolver } from "@/components/AliasResolver";
import { FilterPill } from "@/components/ui/FilterPill";
import { requireCan } from "@/lib/access";
import getSql from "@/lib/db";
import { listAccounts, listGroups } from "@/lib/repos/accounts";
import { listApis, listCatalogDuplicates, parseAliases } from "@/lib/repos/apis";
import { formatNumber } from "@/lib/format";
import { ROW_WARN } from "@/lib/row-status";

export default async function AliasMapperPage({ searchParams }: { searchParams: { tab?: string } }) {
  await requireCan("alias.resolve");
  const sql = getSql();
  const [unmappedAccounts, unmappedApis, accounts, apis, apiIdents, duplicates, groups] = await Promise.all([
    sql`
      SELECT raw_client_name AS raw_name,
             SUM(successful + successful_no_data + failed + in_progress) AS hits,
             MAX(date) AS last_seen
      FROM usage_daily
      WHERE client_id IS NULL
      GROUP BY raw_client_name
      ORDER BY hits DESC NULLS LAST
    `,
    sql`
      SELECT raw_api_name AS raw_name,
             SUM(successful + successful_no_data + failed + in_progress) AS hits,
             MAX(date) AS last_seen
      FROM usage_daily
      WHERE api_code IS NULL
      GROUP BY raw_api_name
      ORDER BY hits DESC NULLS LAST
    `,
    listAccounts(),
    listApis(),
    sql`SELECT product_code, name, log_aliases FROM apis`,
    listCatalogDuplicates(),
    listGroups(),
  ]);

  // Every identifier the catalog answers to. A raw log name matching none of
  // these has never existed as an API — it's genuinely new, not an alias.
  const knownIdents = new Set<string>();
  for (const a of apiIdents as any[]) {
    knownIdents.add(String(a.product_code).toLowerCase());
    knownIdents.add(String(a.name).trim().toLowerCase());
    for (const al of parseAliases(a.log_aliases)) knownIdents.add(al.trim().toLowerCase());
  }

  const ucList = (unmappedAccounts as any[]).map((r) => ({ raw_name: r.raw_name, hits: Number(r.hits), last_seen: r.last_seen }));
  const uaList = (unmappedApis as any[]).map((r) => ({
    raw_name: r.raw_name,
    hits: Number(r.hits),
    last_seen: r.last_seen,
    is_new: !knownIdents.has(String(r.raw_name).trim().toLowerCase()),
  }));
  const unmappedHits = [...ucList, ...uaList].reduce((s, r) => s + r.hits, 0);
  const newApiCount = uaList.filter((r) => r.is_new).length;

  // With no ?tab, open the first tab that has work, so the page does not open
  // on an empty "all resolved" list while another tab has rows.
  const tab =
    searchParams.tab === "accounts" || searchParams.tab === "apis" || searchParams.tab === "duplicates"
      ? searchParams.tab
      : ucList.length > 0
        ? "accounts"
        : uaList.length > 0
          ? "apis"
          : duplicates.length > 0
            ? "duplicates"
            : "accounts";

  return (
    <main>
      <StatusBar
        title="Alias mapper"
        subtitle={`${ucList.length} unmapped account name${ucList.length === 1 ? "" : "s"} · ${uaList.length} unmapped API name${uaList.length === 1 ? "" : "s"}${newApiCount > 0 ? ` (${newApiCount} new)` : ""}`}
      />

      <div className="mx-auto w-full max-w-[1200px] px-7 py-6 space-y-5">
        {/* Ops question: how much traffic is invisible to billing because no one mapped it? */}
        <section
          className="elev-1 bg-bg-raised rounded-lg p-6 dash-enter"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <h2 className="text-xs uppercase tracking-widest text-ink-muted">
            Unattributed hits (all time)
          </h2>
          <div className="flex items-end gap-3 mt-[6px]">
            <span className="inline-block">
              <span
                className="block font-serif text-5xl text-ink leading-none tnum landmark-wipe"
                style={{ fontWeight: 600 }}
              >
                {formatNumber(unmappedHits)}
              </span>
              <span className="block h-px bg-accent mt-2 landmark-rail" aria-hidden="true" />
            </span>
          </div>
          <p className="text-sm text-ink-muted mt-3 max-w-xl leading-normal">
            {unmappedHits > 0 ? (
              <>
                Hits whose raw log name doesn&apos;t map to a canonical account or API — they
                earn nothing and appear in no report until resolved below.
              </>
            ) : (
              "Every raw name across all logs maps to a canonical record."
            )}
          </p>
        </section>

        <div className="flex items-center gap-2 flex-wrap dash-enter" style={{ "--i": 1 } as React.CSSProperties}>
          <FilterPill
            label="Accounts"
            count={ucList.length}
            active={tab === "accounts"}
            href="/admin/aliases?tab=accounts"
          />
          <FilterPill
            label="APIs"
            count={uaList.length}
            active={tab === "apis"}
            href="/admin/aliases?tab=apis"
          />
          <FilterPill
            label="Duplicates"
            count={duplicates.length}
            active={tab === "duplicates"}
            href="/admin/aliases?tab=duplicates"
          />
        </div>

        <div className="dash-enter" style={{ "--i": 2 } as React.CSSProperties}>
          {tab === "accounts" ? (
            <AliasResolver kind="account" rows={ucList} targets={accounts} groups={groups} />
          ) : tab === "apis" ? (
            <AliasResolver kind="api" rows={uaList} targets={apis} />
          ) : (
            <DuplicatesPanel duplicates={duplicates} />
          )}
        </div>
      </div>
    </main>
  );
}

function DuplicatesPanel({
  duplicates,
}: {
  duplicates: Awaited<ReturnType<typeof listCatalogDuplicates>>;
}) {
  if (duplicates.length === 0) {
    return (
      <div className="elev-1 bg-bg-raised rounded-md p-10 text-center">
        <Copy size={20} strokeWidth={1.5} className="text-success mx-auto mb-3" />
        <div className="font-serif text-lg text-ink">No duplicates</div>
        <div className="text-sm text-ink-muted mt-1">
          Every name and alias in the catalog identifies exactly one API.
        </div>
      </div>
    );
  }

  return (
    <div className="elev-1 bg-bg-raised rounded-md overflow-hidden">
      <div className="px-4 py-3 bg-warn-bg text-warn-ink text-sm border-b border-border">
        These identifiers point at more than one API — the importer resolves them
        ambiguously. Edit the colliding APIs to remove the overlap.
      </div>
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-ink-muted text-xs uppercase tracking-wide">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-3 py-3 font-medium">Shared identifier</th>
            <th className="px-4 py-3 font-medium">APIs claiming it</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {duplicates.map((d, i) => (
            <tr
              key={`${d.kind}-${d.value}`}
              className={`${ROW_WARN} row-enter`}
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            >
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] uppercase tracking-wider bg-bg-sunken text-ink-muted">
                  {d.kind === "name" ? "Same name" : "Same alias"}
                </span>
              </td>
              <td className="px-3 py-3 font-mono text-ink">{d.value}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {d.apis.map((a) => (
                    <Link
                      key={a.product_code}
                      href={`/apis/${a.product_code}`}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-bg-sunken text-ink hover:text-accent-ink"
                    >
                      {a.product_code} – {a.name}
                    </Link>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
