import Link from "next/link";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { SettingsNav } from "@/components/admin/SettingsNav";
import { listAudit, listAuditFacets } from "@/lib/repos/audit";
import { listUsers } from "@/lib/repos/users";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AuditFilterBar } from "./AuditFilterBar";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { user?: string; action?: string; entity?: string; page?: string };
}) {
  await requireRole("admin");
  const page = Math.max(1, Number(searchParams.page) || 1);
  const userId = Number(searchParams.user) || undefined;

  const [{ rows, total }, facets, users] = await Promise.all([
    listAudit({
      userId,
      action: searchParams.action || undefined,
      entityType: searchParams.entity || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    listAuditFacets(),
    listUsers(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (searchParams.user) params.set("user", searchParams.user);
    if (searchParams.action) params.set("action", searchParams.action);
    if (searchParams.entity) params.set("entity", searchParams.entity);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  };

  return (
    <main>
      <StatusBar
        title="Audit log"
        subtitle={`${formatNumber(total)} event${total === 1 ? "" : "s"}${
          searchParams.user || searchParams.action || searchParams.entity ? " matching filters" : " recorded"
        }`}
      />
      <SettingsNav />

      <div className="mx-auto w-full max-w-[1200px] px-7 py-6 space-y-5">
        <div className="dash-enter" style={{ "--i": 0 } as React.CSSProperties}>
          <AuditFilterBar
            users={users.map((u) => ({ value: String(u.id), label: u.display_name }))}
            actions={facets.actions}
            entityTypes={facets.entityTypes}
            active={{
              user: searchParams.user,
              action: searchParams.action,
              entity: searchParams.entity,
            }}
          />
        </div>

        <div className="elev-1 bg-bg-raised rounded-md overflow-hidden dash-enter" style={{ "--i": 1 } as React.CSSProperties}>
          {rows.length === 0 ? (
            <div className="p-10 text-center">
              <ScrollText size={20} strokeWidth={1.5} className="text-ink-faint mx-auto mb-3" />
              <div className="font-serif text-lg text-ink">No events</div>
              <div className="text-sm text-ink-muted mt-1">
                Nothing matches these filters yet. Activity lands here as users work.
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg-sunken text-ink-muted text-xs uppercase tracking-wide">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-3 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                  <th className="px-3 py-3 font-medium">Entity</th>
                  <th className="px-4 py-3 font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className="row-enter hover:bg-bg-sunken/40 align-top"
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">
                      {formatDateTime(r.created_at)}
                    </td>
                    <td className="px-3 py-3 text-ink whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {r.user_emoji && <span aria-hidden>{r.user_emoji}</span>}
                        <span title={r.user_email}>{r.user_name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-bg-sunken text-ink-muted">
                        {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {r.entity_type === "api" ? (
                        <Link href={`/skus/${r.entity_id}`} className="text-ink hover:text-accent-ink font-mono text-xs">
                          {r.entity_type} · {r.entity_id}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-ink">
                          {r.entity_type} · {r.entity_id}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ChangeSummary before={r.before_json} after={r.after_json} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-ink-muted">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="inline-flex items-center gap-1 text-ink hover:text-accent-ink">
                  <ChevronLeft size={14} strokeWidth={1.5} /> Newer
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-ink-faint">
                  <ChevronLeft size={14} strokeWidth={1.5} /> Newer
                </span>
              )}
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="inline-flex items-center gap-1 text-ink hover:text-accent-ink">
                  Older <ChevronRight size={14} strokeWidth={1.5} />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-ink-faint">
                  Older <ChevronRight size={14} strokeWidth={1.5} />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * Compact per-field diff: keys whose value changed render as "key: a → b".
 * Raw payloads stay reachable behind a disclosure for forensic reading.
 */
function ChangeSummary({ before, after }: { before: string | null; after: string | null }) {
  const b = safeParse(before);
  const a = safeParse(after);
  if (!a && !b) return <span className="text-ink-faint">—</span>;

  const keys = Array.from(new Set([...(b ? Object.keys(b) : []), ...(a ? Object.keys(a) : [])]));
  const changed = keys.filter((k) => JSON.stringify(b?.[k]) !== JSON.stringify(a?.[k]));
  const shown = changed.slice(0, 4);

  return (
    <details>
      <summary className="cursor-pointer list-none">
        <span className="text-xs text-ink-muted">
          {shown.length === 0 ? (
            "View payload"
          ) : (
            shown.map((k, i) => (
              <span key={k}>
                {i > 0 && " · "}
                <span className="text-ink">{k}</span>
                {b && k in b && a && k in a ? (
                  <>
                    : {renderValue(b[k])} → {renderValue(a[k])}
                  </>
                ) : a && k in a ? (
                  <>: {renderValue(a[k])}</>
                ) : null}
              </span>
            ))
          )}
          {changed.length > shown.length && ` · +${changed.length - shown.length} more`}
        </span>
      </summary>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {b && (
          <pre className="text-[11px] font-mono bg-bg-sunken rounded p-2 overflow-x-auto text-ink-muted">
            {JSON.stringify(b, null, 2)}
          </pre>
        )}
        {a && (
          <pre className="text-[11px] font-mono bg-bg-sunken rounded p-2 overflow-x-auto text-ink">
            {JSON.stringify(a, null, 2)}
          </pre>
        )}
      </div>
    </details>
  );
}

function safeParse(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function renderValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v.length > 24 ? `${v.slice(0, 24)}…` : v;
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return "{…}";
  return String(v);
}
