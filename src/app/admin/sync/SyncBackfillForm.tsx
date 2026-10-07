"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";

export function SyncBackfillForm() {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!from || !to) return;
    setRunning(true);
    try {
      const res = await fetch("/api/sync/backfill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        const failedDay = body.results?.find((r: any) => r.status === "error");
        toast.error(body.error ?? failedDay?.error ?? "Backfill failed");
      } else {
        const hits = body.results.reduce((a: number, r: any) => a + (r.hits ?? 0), 0);
        toast.success(
          `Backfilled ${body.results.length} day${body.results.length === 1 ? "" : "s"} — ${hits.toLocaleString("en-US")} units`
        );
        setFrom("");
        setTo("");
      }
      router.refresh();
    } catch {
      toast.error("Backfill failed — network error");
    } finally {
      setRunning(false);
    }
  };

  const inputClass =
    "bg-bg-sunken border border-border rounded-md px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-accent";

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <label className="block">
        <span className="block text-xs text-ink-muted mb-1">From</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
      </label>
      <label className="block">
        <span className="block text-xs text-ink-muted mb-1">To</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
      </label>
      <Button variant="secondary" size="sm" onClick={run} disabled={!from || !to || running}>
        {running ? "Pulling usage…" : "Backfill range"}
      </Button>
      <span className="text-xs text-ink-faint pb-2">
        Re-pulls each day in the range (max 31 days per request).
      </span>
    </div>
  );
}
