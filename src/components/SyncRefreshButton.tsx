"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { RollingText } from "@/components/ui/RollingText";

type RefreshDiff = {
  from: string;
  to: string;
  dates: {
    date: string;
    status: "success" | "error";
    hits_before: number;
    hits_after: number;
    rows_before: number;
    rows_after: number;
    error?: string;
  }[];
  movers: { account: string; hits_before: number; hits_after: number; delta: number }[];
  hits_before: number;
  hits_after: number;
  unmapped_clients: string[];
  unmapped_apis: string[];
};

const nf = (n: number) => n.toLocaleString("en-IN");
const signed = (n: number) => (n > 0 ? `+${nf(n)}` : nf(n));

function dayLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function SyncRefreshButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [diff, setDiff] = useState<RefreshDiff | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/sync/refresh", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.diff) {
        toast.error(body.error ?? "Refresh failed");
        return;
      }
      const d: RefreshDiff = body.diff;
      setDiff(d);
      const delta = d.hits_after - d.hits_before;
      toast[body.ok ? "success" : "error"](
        body.ok
          ? delta === 0
            ? "Refreshed — no changes since the last pull"
            : `Refreshed — ${signed(delta)} hits since the last pull`
          : "Refresh finished with errors — see the run log"
      );
      router.refresh();
    } catch {
      toast.error("Refresh failed — network error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        variant="primary"
        size="sm"
        onClick={run}
        disabled={running}
        leadingIcon={
          <RefreshCw size={13} strokeWidth={1.75} className={running ? "animate-spin" : undefined} />
        }
      >
        <RollingText
          text={running ? "Pulling usage…" : "Refresh now"}
          options={{ direction: "up" }}
        />
      </Button>

      {diff && (
        <div className="bg-bg-sunken rounded-md p-4 text-sm space-y-3">
          <div className="text-xs uppercase tracking-widest text-ink-muted">
            What changed · {dayLabel(diff.from)} – {dayLabel(diff.to)}
          </div>

          <div className="space-y-1">
            {diff.dates.map((d) => {
              const delta = d.hits_after - d.hits_before;
              return (
                <div key={d.date} className="flex items-baseline gap-2 tnum">
                  <span className="w-16 shrink-0 text-ink-muted text-xs">{dayLabel(d.date)}</span>
                  {d.status === "error" ? (
                    <span className="text-bad-ink text-xs" title={d.error}>
                      failed — kept previous data
                    </span>
                  ) : (
                    <>
                      <span className="text-ink">
                        {nf(d.hits_before)} <ArrowRight size={10} className="inline text-ink-faint" />{" "}
                        <RollingText
                          text={nf(d.hits_after)}
                          options={{ direction: delta >= 0 ? "up" : "down" }}
                          colorOnChange="rise-good"
                          signValue={d.hits_after}
                        />{" "}
                        hits
                      </span>
                      <span
                        className={`text-xs ${
                          delta > 0 ? "text-success" : delta < 0 ? "text-bad-ink" : "text-ink-faint"
                        }`}
                      >
                        {delta === 0 ? "no change" : signed(delta)}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {diff.movers.length > 0 && (
            <div>
              <div className="text-xs text-ink-muted mb-1">Biggest movers</div>
              <div className="space-y-0.5">
                {diff.movers.map((m) => (
                  <div key={m.account} className="flex items-baseline justify-between gap-3 tnum">
                    <span className="text-ink text-xs truncate" title={m.account}>
                      {m.account}
                    </span>
                    <span
                      className={`text-xs shrink-0 ${m.delta > 0 ? "text-success" : "text-bad-ink"}`}
                    >
                      {signed(m.delta)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(diff.unmapped_clients.length > 0 || diff.unmapped_apis.length > 0) && (
            <div className="text-xs text-warn-ink">
              {diff.unmapped_clients.length} unmapped account name
              {diff.unmapped_clients.length === 1 ? "" : "s"} · {diff.unmapped_apis.length} unmapped
              API name{diff.unmapped_apis.length === 1 ? "" : "s"} —{" "}
              <Link href="/admin/aliases" className="underline hover:text-accent-ink">
                resolve in Aliases
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
