import { AlertOctagon, CircleCheck, Beaker, History } from "lucide-react";

// v0.1: status semantics restricted to signals we can compute *exactly* from
// the data we have today. Margin-derived statuses (negative, thin, estimated)
// are intentionally absent — per-account margin requires vendor allocation we
// don't yet have, and showing inaccurate signals is worse than not showing
// them. See V0.1_PLAN.md §3.1.
export type StatusKind = "leak" | "historical" | "sandbox" | "ok";

const CFG: Record<StatusKind, { label: string; bg: string; ink: string; icon: any }> = {
  leak: { label: "Leak", bg: "bg-bad-bg", ink: "text-bad-ink", icon: AlertOctagon },
  historical: { label: "Historical", bg: "bg-warn-bg", ink: "text-warn-ink", icon: History },
  sandbox: { label: "Sandbox", bg: "bg-info-bg", ink: "text-info-ink", icon: Beaker },
  ok: { label: "OK", bg: "bg-bg-sunken", ink: "text-ink-muted", icon: CircleCheck },
};

export function StatusChip({ kind, label }: { kind: StatusKind; label?: string }) {
  const cfg = CFG[kind];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${cfg.bg} ${cfg.ink}`}>
      <Icon size={12} strokeWidth={1.5} />
      <span className="font-medium">{label ?? cfg.label}</span>
    </span>
  );
}
