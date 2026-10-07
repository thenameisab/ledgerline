import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, ArrowUpRight } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { Integration, IntegrationHealth } from "@/lib/repos/integration-status";

const STYLE: Record<
  IntegrationHealth,
  { dot: string; text: string; chipBg: string; label: string; Icon: typeof CheckCircle2 }
> = {
  operational: { dot: "bg-success", text: "text-ok-ink", chipBg: "bg-ok-bg", label: "Operational", Icon: CheckCircle2 },
  degraded: { dot: "bg-warn", text: "text-warn-ink", chipBg: "bg-warn-bg", label: "Degraded", Icon: AlertTriangle },
  down: { dot: "bg-bad", text: "text-bad-ink", chipBg: "bg-bad-bg", label: "Down", Icon: XCircle },
  not_configured: { dot: "bg-ink-faint", text: "text-ink-muted", chipBg: "bg-bg-sunken", label: "Not configured", Icon: MinusCircle },
};

// Worst-first severity for the overall banner. "Not configured" is left out:
// the optional integrations (CLI import, email) are often unset on purpose.
const SEVERITY: IntegrationHealth[] = ["down", "degraded"];

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function SystemStatus({ integrations }: { integrations: Integration[] }) {
  const overall =
    SEVERITY.find((h) => integrations.some((i) => i.health === h)) ?? "operational";
  const allOk = overall === "operational";
  const o = STYLE[overall];
  const someUnset = integrations.some((i) => i.health === "not_configured");

  return (
    <section
      className="elev-1 bg-bg-raised rounded-lg p-6 dash-enter"
      style={{ "--i": 0 } as React.CSSProperties}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xs uppercase tracking-widest text-ink-muted">System status</h2>
        <div className={`inline-flex items-center gap-2 text-sm ${o.text}`}>
          <span aria-hidden className={`h-2 w-2 rounded-full ${o.dot}`} />
          <span className="font-medium">
            {allOk
              ? someUnset
                ? "All configured systems operational"
                : "All systems operational"
              : `${o.label} — needs attention`}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {integrations.map((i) => {
          const s = STYLE[i.health];
          const card = (
            <div className="h-full rounded-md border border-border bg-bg p-4 transition-colors duration-fast ease-expo hover:border-ink-faint">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <s.Icon size={14} strokeWidth={1.75} className={`shrink-0 ${s.text}`} />
                    <span className="text-sm font-medium text-ink truncate">{i.name}</span>
                    {i.href && (
                      <ArrowUpRight size={12} strokeWidth={1.75} className="shrink-0 text-ink-faint" />
                    )}
                  </div>
                  <div className="mt-1 text-sm text-ink-muted">{i.summary}</div>
                  {i.detail && <div className="mt-0.5 text-xs text-ink-faint">{i.detail}</div>}
                </div>
                <span
                  className={`shrink-0 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${s.chipBg} ${s.text}`}
                >
                  <span aria-hidden className={`h-1 w-1 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs">
                <span className="text-ink-faint">{i.lastActivityLabel}</span>
                <span className="font-mono text-ink-muted" title={i.lastActivityAt ? formatDateTime(i.lastActivityAt) : undefined}>
                  {i.lastActivityAt ? `${formatDateTime(i.lastActivityAt)} · ${relativeTime(i.lastActivityAt)}` : "—"}
                </span>
              </div>
            </div>
          );
          return i.href ? (
            <Link key={i.key} href={i.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={i.key}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}
