"use client";

// Settings → Alerts form. One card per rule group; each rule has an on/off
// switch and the thresholds it reads. Shares and percentage points are edited
// as percentages and stored as fractions. Nothing is saved until "Save".

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import {
  ALERT_GROUPS,
  ALERT_RULES,
  DEFAULT_THRESHOLDS,
  THRESHOLD_META,
  thresholdError,
  type AlertRule,
  type ThresholdUnit,
} from "@/lib/alerts/config";
import { saveAlertSettings } from "@/app/admin/settings/alerts/actions";

type Key = keyof typeof DEFAULT_THRESHOLDS;

const inputCls =
  "w-28 rounded-md border border-border bg-bg-raised px-2.5 py-1.5 text-sm text-ink font-mono tnum text-right " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

const SUFFIX: Record<ThresholdUnit, string> = {
  share: "%",
  points: "points",
  times: "×",
  hits: "units",
  rupees: "$",
  count: "",
  days: "days",
  dayOfMonth: "day of month",
};

const isPercent = (u: ThresholdUnit) => u === "share" || u === "points";
const toDisplay = (k: Key, v: number) => (isPercent(THRESHOLD_META[k].unit) ? +(v * 100).toFixed(4) : v);
const toStored = (k: Key, v: number) => (isPercent(THRESHOLD_META[k].unit) ? +(v / 100).toFixed(6) : v);

const RULES = Object.keys(ALERT_RULES) as AlertRule[];
const KEYS = Object.keys(DEFAULT_THRESHOLDS) as Key[];
/** Shown once at the top, because many rules read it. */
const GENERAL_KEYS: Key[] = ["coverageShare"];
/** Thresholds shown under a rule: those whose first listed rule is this one. */
const keysFor = (r: AlertRule) => KEYS.filter((k) => !GENERAL_KEYS.includes(k) && THRESHOLD_META[k].rules[0] === r);

export function AlertSettingsForm({
  initial,
}: {
  initial: { enabled: Record<AlertRule, boolean>; thresholds: Record<Key, number> };
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  // Text per field, so a half-typed value is not coerced while editing.
  const [text, setText] = useState<Record<Key, string>>(
    () => Object.fromEntries(KEYS.map((k) => [k, String(toDisplay(k, initial.thresholds[k]))])) as Record<Key, string>
  );
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<{ field?: string; error: string } | null>(null);

  const errors = useMemo(() => {
    const e: Partial<Record<Key, string>> = {};
    for (const k of KEYS) {
      const raw = text[k].trim();
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n)) e[k] = "Enter a number.";
      else {
        const msg = thresholdError(k, toStored(k, n));
        if (msg) e[k] = msg;
      }
    }
    return e;
  }, [text]);

  const dirty =
    RULES.some((r) => enabled[r] !== initial.enabled[r]) ||
    KEYS.some((k) => Number(text[k]) !== toDisplay(k, initial.thresholds[k]));
  const hasErrors = Object.keys(errors).length > 0;

  function resetToDefaults() {
    setEnabled(Object.fromEntries(RULES.map((r) => [r, true])) as Record<AlertRule, boolean>);
    setText(Object.fromEntries(KEYS.map((k) => [k, String(toDisplay(k, DEFAULT_THRESHOLDS[k]))])) as Record<Key, string>);
  }

  async function save() {
    setSaving(true);
    setServerError(null);
    try {
      const res = await saveAlertSettings({
        enabled,
        thresholds: Object.fromEntries(KEYS.map((k) => [k, toStored(k, Number(text[k]))])),
      });
      if (res.ok) {
        toast.success("Alert settings saved. They apply from the next daily check.");
        router.refresh();
      } else {
        setServerError(res);
        toast.error(res.error);
      }
    } finally {
      setSaving(false);
    }
  }

  const field = (k: Key, showUsedBy: boolean) => {
    const meta = THRESHOLD_META[k];
    const def = toDisplay(k, DEFAULT_THRESHOLDS[k]);
    const changed = Number(text[k]) !== def;
    const err = errors[k] ?? (serverError?.field === k ? serverError.error : undefined);
    const others = showUsedBy ? meta.rules.slice(1) : [];
    return (
      <div key={k}>
        <label htmlFor={`t-${k}`} className="block text-xs text-ink-muted">
          {meta.label}
          {others.length > 0 && <span className="text-ink-faint"> (also used by {others.join(", ")})</span>}
        </label>
        <div className="mt-1 flex items-center gap-2">
          {meta.unit === "rupees" && <span className="text-sm text-ink-muted">$</span>}
          <input
            id={`t-${k}`}
            inputMode="decimal"
            value={text[k]}
            onChange={(e) => setText({ ...text, [k]: e.target.value })}
            aria-invalid={!!err}
            className={`${inputCls} ${err ? "border-bad" : ""}`}
          />
          {meta.unit !== "rupees" && SUFFIX[meta.unit] && <span className="text-xs text-ink-muted">{SUFFIX[meta.unit]}</span>}
          {changed && <span className="text-xs text-ink-faint">default {def}</span>}
        </div>
        {err && <p className="mt-1 text-xs text-bad-ink">{err}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="elev-1 bg-bg-raised rounded-md p-6">
        <h2 className="font-serif text-xl text-ink mb-1" style={{ fontWeight: 600 }}>
          Covered accounts
        </h2>
        <p className="text-sm text-ink-muted mb-4">
          Volume and revenue rules (A1–A4, C1–C5) check only these accounts; the list is worked out again each month.
          Failure, lifecycle and data rules check every account.
        </p>
        {GENERAL_KEYS.map((k) => field(k, false))}
      </section>
      {ALERT_GROUPS.map((g, gi) => (
        <section
          key={g.id}
          className="elev-1 bg-bg-raised rounded-md p-6 dash-enter"
          style={{ "--i": gi } as React.CSSProperties}
        >
          <h2 className="font-serif text-xl text-ink mb-4" style={{ fontWeight: 600 }}>
            {g.label}
          </h2>
          <div className="divide-y divide-border">
            {RULES.filter((r) => ALERT_RULES[r].group === g.id).map((r) => {
              const keys = keysFor(r);
              return (
                <div key={r} className="py-4 first:pt-0 last:pb-0">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled[r]}
                      onChange={(e) => setEnabled({ ...enabled, [r]: e.target.checked })}
                      className="mt-1 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0">
                      <span className="text-sm font-medium text-ink">
                        {ALERT_RULES[r].label} <span className="font-mono text-xs text-ink-faint">{r}</span>
                      </span>
                      <span className="block text-sm text-ink-muted">{ALERT_RULES[r].desc}</span>
                    </span>
                  </label>
                  {keys.length > 0 && (
                    <div className={`mt-3 ml-7 grid gap-x-6 gap-y-3 sm:grid-cols-2 ${enabled[r] ? "" : "opacity-60"}`}>
                      {keys.map((k) => field(k, true))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Buttons sit on the left: toasts appear bottom-right and would cover them. */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 flex flex-wrap items-center gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <Button onClick={save} disabled={!dirty || hasErrors || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={resetToDefaults} disabled={saving}>
          Reset all to defaults
        </Button>
        {hasErrors && <span className="text-xs text-bad-ink">Fix the highlighted values to save.</span>}
      </div>
    </div>
  );
}
