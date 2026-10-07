"use client";
import { useState, useTransition } from "react";
import { saveSandboxRule } from "@/app/admin/sandbox/actions";

type Mode = "none" | "all" | "cap";

function initialMode(cap: number | null): Mode {
  if (cap === null) return "all";
  if (cap === 0) return "none";
  return "cap";
}

export function SandboxRuleForm({
  accountId,
  apiCode,
  sandboxSuccessful,
  cap,
  ruleScope,
}: {
  accountId: number;
  apiCode: string;
  sandboxSuccessful: number;
  cap: number | null;
  ruleScope: "api" | "account" | "global";
}) {
  const [mode, setMode] = useState<Mode>(initialMode(cap));
  const [hits, setHits] = useState<number>(cap && cap > 0 ? cap : 0);
  // The last saved rule. Save stays disabled until the row differs from it.
  const [base, setBase] = useState({ mode, hits });
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const billed = mode === "all" ? sandboxSuccessful : mode === "none" ? 0 : Math.min(sandboxSuccessful, hits);
  const dirty = mode !== base.mode || (mode === "cap" && hits !== base.hits);

  function save() {
    setSaved(false);
    start(async () => {
      await saveSandboxRule({ accountId, apiCode, mode, hits });
      setBase({ mode, hits });
      setSaved(true);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={mode}
        onChange={(e) => {
          setMode(e.target.value as Mode);
          setSaved(false);
        }}
        className="text-xs bg-bg-raised border border-border rounded-sm px-2 py-1 text-ink"
      >
        <option value="none">Don&apos;t bill</option>
        <option value="all">Bill all</option>
        <option value="cap">Bill up to…</option>
      </select>
      {mode === "cap" && (
        <input
          type="number"
          min={0}
          value={hits}
          onChange={(e) => {
            setHits(Math.max(0, Number(e.target.value)));
            setSaved(false);
          }}
          className="w-24 text-xs bg-bg-raised border border-border rounded-sm px-2 py-1 text-ink tabular-nums"
        />
      )}
      <span className="text-xs text-ink-muted tabular-nums whitespace-nowrap">
        → bills {billed.toLocaleString("en-US")}
      </span>
      <button
        onClick={save}
        disabled={!dirty || pending}
        className={`text-xs rounded-sm px-2.5 py-1 border disabled:cursor-not-allowed ${
          dirty ? "bg-accent border-accent text-bg-raised disabled:opacity-50" : "border-border text-ink-faint"
        }`}
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {saved && <span className="text-xs text-accent-ink">✓</span>}
      {ruleScope === "global" && (
        <span className="text-[11px] text-ink-faint uppercase tracking-wide">from global</span>
      )}
    </div>
  );
}
