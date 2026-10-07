"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2, Pencil, TrendingDown } from "lucide-react";
import { formatINR } from "@/lib/format";
import type { VendorMinimumMonth } from "@/lib/repos/vendor-minimum";
import type { RateStatus } from "@/lib/repos/vendor-cost";
import { useSettleAfterSave } from "./useSettleAfterSave";

// "Committed vs consumed", and the editor for it.
//
// A minimum is a calendar-month figure, so this reads month by month rather
// than over the window: what the floor was, what the traffic came to, and the
// difference. A month the window only partly covers, or one still running, is
// listed with its reason instead of a number — the shortfall is not knowable
// yet, and reporting one would be a guess dressed as a cost.

const STATUSES: { value: RateStatus; label: string; hint: string }[] = [
  { value: "estimated", label: "Estimated", hint: "A guess. No document behind it." },
  { value: "quoted", label: "Quoted", hint: "A figure the vendor gave us." },
  { value: "contracted", label: "Contracted", hint: "A floor in a signed agreement." },
];

type SaveState =
  | { k: "idle" }
  | { k: "saving" }
  | { k: "saved" }
  | { k: "error"; msg: string; suggested?: string };

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** First of the current calendar month — where a change to a live floor starts. */
function thisMonthStart(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

export function MinimumCard({
  vendorName,
  months,
  current,
  currentFrom,
  status,
  source,
  editable,
}: {
  vendorName: string;
  /** Every month the window touches where a minimum is in force. */
  months: VendorMinimumMonth[];
  /** The floor in force today, or null when none is on file. */
  current: number | null;
  currentFrom: string | null;
  status: RateStatus | null;
  source: string | null;
  editable: boolean;
}) {
  const settle = useSettleAfterSave();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(current != null ? String(current) : "");
  const [date, setDate] = useState(current == null ? thisMonthStart() : thisMonthStart());
  const [st, setSt] = useState<RateStatus>(status ?? "estimated");
  const [src, setSrc] = useState(source ?? "");
  const [save, setSave] = useState<SaveState>({ k: "idle" });

  const applied = months.filter((m) => m.applied);
  const skipped = months.filter((m) => !m.applied);
  const topUp = applied.reduce((s, m) => s + m.top_up, 0);
  const bound = applied.filter((m) => m.top_up > 0);

  const needsSource = st !== "estimated" && src.trim() === "";
  const parsed = amount.trim() === "" ? null : Number(amount);
  const badAmount = parsed != null && (!Number.isFinite(parsed) || parsed < 0);
  const canSave = save.k !== "saving" && save.k !== "saved" && !needsSource && !badAmount;

  async function submit(overrideDate?: string) {
    setSave({ k: "saving" });
    try {
      const res = await fetch("/api/vendor-commitment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendor_name: vendorName,
          monthly_minimum: parsed,
          status: st,
          source: src.trim() === "" ? null : src.trim(),
          effective_from: overrideDate ?? date,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setSave({
          k: "error",
          msg: data?.error ?? `Save failed (${res.status}).`,
          suggested: data?.suggested_effective_from,
        });
        return;
      }
      setSave({ k: "saved" });
      settle(() => {
        setOpen(false);
        setSave({ k: "idle" });
      });
    } catch {
      setSave({ k: "error", msg: "Could not reach the server. Check your connection and retry." });
    }
  }

  return (
    <section className="elev-1 bg-bg-raised rounded-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xs uppercase tracking-widest text-ink-muted">Monthly minimum</h2>
          <div className="mt-2 font-serif text-2xl text-ink tnum">
            {current == null ? (
              <span className="text-ink-faint text-lg">None on file</span>
            ) : (
              formatINR(current, { precision: 0 })
            )}
          </div>
          {current != null && (
            <div className="text-[11px] text-ink-faint mt-1">
              from {currentFrom} · {status ?? "estimated"}
              {source ? ` · ${source}` : ""}
            </div>
          )}
        </div>
        {editable && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent-ink px-2 py-1 rounded border border-border transition-colors"
          >
            <Pencil size={11} strokeWidth={1.75} />
            {current == null ? "Set a minimum" : "Change"}
          </button>
        )}
      </div>

      <p className="text-sm text-ink-muted mt-3 max-w-2xl leading-normal">
        {current == null ? (
          <>
            No floor is recorded for {vendorName}, so its cost is whatever the traffic came to.
            Set one if the contract says otherwise.
          </>
        ) : topUp > 0 ? (
          <>
            The floor bound in {bound.length} month{bound.length === 1 ? "" : "s"} of this window,
            adding <span className="text-ink">{formatINR(topUp, { precision: 0 })}</span> over what
            the traffic metered. That top-up belongs to no account or API — it is in this
            vendor&rsquo;s total and the company&rsquo;s, and nowhere further down.
          </>
        ) : applied.length > 0 ? (
          <>
            {vendorName} cleared its floor in every completed month of this window, so the minimum
            costs nothing extra.
          </>
        ) : (
          <>Nothing to compare yet — this window has no completed calendar month.</>
        )}
      </p>

      {months.length > 0 && (
        <div className="mt-5 rounded border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-sunken text-ink-faint text-[10px] uppercase tracking-wide">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 font-medium text-right">Consumed</th>
                <th className="px-3 py-2 font-medium text-right">Committed</th>
                <th className="px-3 py-2 font-medium text-right">Top-up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {months.map((m) => (
                <tr key={`${m.vendor}:${m.month}`}>
                  <td className="px-3 py-2 text-ink">{monthLabel(m.month)}</td>
                  <td className="px-3 py-2 text-right font-mono tnum text-ink-muted">
                    {formatINR(m.computed, { precision: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tnum text-ink-muted">
                    {formatINR(m.minimum, { precision: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!m.applied ? (
                      <span
                        className="text-[11px] text-ink-faint"
                        title={
                          m.skipped === "in_progress"
                            ? "This month has not ended. Whether the floor binds is not known until it does."
                            : "This window covers only part of this month. A monthly floor cannot be compared against part of a month, and pro-rating it would invent a daily entitlement the contract does not have."
                        }
                      >
                        {m.skipped === "in_progress" ? "month not over" : "partial month"}
                      </span>
                    ) : m.top_up > 0 ? (
                      <span className="inline-flex items-center gap-1 font-mono tnum text-warn-ink">
                        <TrendingDown size={11} strokeWidth={1.75} />
                        {formatINR(m.top_up, { precision: 0 })}
                      </span>
                    ) : (
                      <span className="text-[11px] text-ink-faint">cleared</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {skipped.length > 0 && (
        <p className="text-[11px] text-ink-faint mt-2">
          {skipped.length} month{skipped.length === 1 ? "" : "s"} in this window
          {skipped.length === 1 ? " is" : " are"} not counted above. A minimum is a calendar-month
          figure; a part-month or an unfinished month has no shortfall to report yet.
        </p>
      )}

      {open && editable && (
        <div className="mt-5 pt-5 border-t border-border max-w-md">
          <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
            Minimum per calendar month
          </label>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-bg mb-1">
            <span className="text-ink-faint text-xs">&#8377;</span>
            <input
              value={amount}
              inputMode="decimal"
              placeholder="none"
              onChange={(e) => {
                setAmount(e.target.value);
                if (save.k === "error") setSave({ k: "idle" });
              }}
              className="w-full bg-transparent font-mono text-sm tnum focus:outline-none placeholder:text-ink-faint"
            />
          </div>
          <div className="text-[10px] text-ink-faint mb-3">
            Leave it empty to record that {vendorName} has no floor from this month on. That is a
            different fact from a floor of &#8377;0.
          </div>

          <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
            First month it applies
          </label>
          <input
            type="month"
            value={date.slice(0, 7)}
            onChange={(e) => {
              setDate(`${e.target.value}-01`);
              if (save.k === "error") setSave({ k: "idle" });
            }}
            className="w-full px-2 py-1 mb-1 rounded border border-border bg-bg font-mono text-sm tnum focus:outline-none focus:border-accent"
          />
          <div className="text-[10px] text-ink-faint mb-3">
            A floor starts at the beginning of a month. Completed months keep the one they were
            billed under.
          </div>

          <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
            Status
          </label>
          <div className="flex gap-1 mb-3" role="group" aria-label="Minimum status">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                title={s.hint}
                aria-pressed={st === s.value}
                onClick={() => setSt(s.value)}
                className={`flex-1 px-1.5 py-1 rounded border text-[11px] transition-colors duration-fast ease-expo ${
                  st === s.value
                    ? "border-ink-muted bg-bg-sunken text-ink"
                    : "border-border text-ink-muted hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
            Source {st !== "estimated" && <span className="text-warn-ink">required</span>}
          </label>
          <input
            value={src}
            placeholder="Agreement, email, or a note"
            onChange={(e) => setSrc(e.target.value)}
            className="w-full px-2 py-1 rounded border border-border bg-bg text-sm focus:outline-none focus:border-accent"
          />
          {needsSource && (
            <div className="text-[10px] text-warn-ink mt-1">
              A quoted or contracted floor needs a source, so the next reader knows where it came
              from.
            </div>
          )}

          {save.k === "error" && (
            <div className="mt-3 p-2 rounded bg-bad-bg text-bad-ink text-[11px] leading-snug">
              <div className="flex items-start gap-1.5">
                <AlertTriangle size={12} strokeWidth={1.5} className="shrink-0 mt-0.5" />
                <div>
                  <div>{save.msg}</div>
                  <div className="flex gap-2 mt-1.5">
                    <button type="button" onClick={() => submit()} className="underline">
                      Retry
                    </button>
                    {save.suggested && (
                      <button
                        type="button"
                        onClick={() => {
                          setDate(save.suggested!);
                          submit(save.suggested);
                        }}
                        className="underline"
                      >
                        Use {save.suggested}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-ink-muted hover:text-ink px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => submit()}
              disabled={!canSave}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-accent text-bg disabled:opacity-40 active:scale-[0.97] transition-transform duration-fast ease-expo"
            >
              {save.k === "saving" && <Loader2 size={12} strokeWidth={2} className="animate-spin" />}
              {save.k === "saved" && <Check size={12} strokeWidth={2} />}
              {save.k === "saving" ? "Saving…" : save.k === "saved" ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
