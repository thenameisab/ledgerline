"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

export function PriceCell({
  client_id,
  api_code,
  field,
  value,
  editable,
  size = "md",
}: {
  client_id: number;
  api_code: string;
  field: "price_successful" | "price_successful_no_data" | "price_failed" | "price_in_progress";
  value: number;
  editable: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [v, setV] = useState(value === 0 ? "" : String(value));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<"" | "saved">("");

  const widthCls = size === "sm" ? "w-[68px]" : "w-[78px]";
  const inputWidth = size === "sm" ? "w-[34px]" : "w-[42px]";

  if (!editable) {
    return (
      <span
        className={`inline-flex items-center justify-end gap-0.5 px-1.5 py-1 text-sm font-mono tnum text-ink ${widthCls}`}
      >
        <span className="text-ink-faint text-xs">₹</span>
        <span>{value === 0 ? <span className="text-ink-faint">—</span> : value.toFixed(2)}</span>
      </span>
    );
  }

  const save = async () => {
    const n = v === "" ? 0 : parseFloat(v);
    if (!Number.isFinite(n)) {
      setV(value === 0 ? "" : String(value));
      return;
    }
    if (n === value) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id, api_code, [field]: n }),
      });
      if (!res.ok) {
        setV(value === 0 ? "" : String(value));
        return;
      }
      setV(n === 0 ? "" : String(n));
      setFlash("saved");
      setTimeout(() => setFlash(""), 800);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <label
      className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded border text-sm transition-colors duration-fast ease-expo bg-bg ${widthCls} ${
        flash === "saved" ? "border-success bg-ok-bg" : "border-border focus-within:border-accent focus-within:bg-bg-raised"
      }`}
    >
      <span className="text-ink-faint text-xs">₹</span>
      <input
        value={v}
        placeholder="0"
        onChange={(e) => setV(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setV(value === 0 ? "" : String(value));
        }}
        disabled={saving}
        className="flex-1 min-w-0 bg-transparent font-mono text-sm text-right tnum focus:outline-none placeholder:text-ink-faint"
      />
      {flash === "saved" && <Check size={10} strokeWidth={1.5} className="text-success shrink-0" />}
    </label>
  );
}
