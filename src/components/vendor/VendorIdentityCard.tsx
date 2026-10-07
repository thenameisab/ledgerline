"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/format";
import { useSettleAfterSave } from "./useSettleAfterSave";

// The vendor's registry entry, and the editor for it.
//
// Deliberately small: a name, the other spellings that mean it, and whether we
// still send it work. No logo, website, owner or contacts — those were offered
// and declined; a vendor here is a billing counterparty, not a CRM record.
//
// A vendor renamed upstream would otherwise arrive as an unknown name and
// become a second vendor with no rates, so its cost would fall to zero.
// Renaming through this card
// moves one row and keeps the old spelling as an alias, so traffic still
// arriving under it lands on the same vendor.

type SaveState = { k: "idle" } | { k: "saving" } | { k: "saved" } | { k: "error"; msg: string };

export function VendorIdentityCard({
  vendorId,
  canonicalName,
  status,
  chargesSandbox,
  sandbox,
  aliases,
  editable,
}: {
  vendorId: number;
  canonicalName: string;
  status: "active" | "inactive";
  /** Does this vendor invoice us for sandbox usage? */
  chargesSandbox: boolean;
  /** Sandbox traffic this vendor served in the period, and what it costs today. */
  sandbox: { hits: number; cost: number };
  /** Every other spelling that resolves here. Excludes the canonical name. */
  aliases: string[];
  editable: boolean;
}) {
  const settle = useSettleAfterSave();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(canonicalName);
  const [newAlias, setNewAlias] = useState("");
  const [save, setSave] = useState<SaveState>({ k: "idle" });

  const renaming = name.trim() !== "" && name.trim() !== canonicalName;

  async function post(patch: Record<string, unknown>, thenNavigate?: string) {
    setSave({ k: "saving" });
    try {
      const res = await fetch("/api/vendor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendor_id: vendorId, ...patch }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setSave({ k: "error", msg: data?.error ?? `Save failed (${res.status}).` });
        return;
      }
      setSave({ k: "saved" });
      // The page's URL carries the vendor name, so a rename has to move.
      const moved =
        thenNavigate && thenNavigate !== canonicalName
          ? `/vendors/${encodeURIComponent(thenNavigate)}`
          : undefined;
      settle(() => {
        setSave({ k: "idle" });
        setOpen(false);
      }, moved);
    } catch {
      setSave({ k: "error", msg: "Could not reach the server. Check your connection and retry." });
    }
  }

  return (
    <section className="elev-1 bg-bg-raised rounded-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xs uppercase tracking-widest text-ink-muted">Vendor</h2>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="font-serif text-2xl text-ink">{canonicalName}</span>
            {!chargesSandbox && (
              <span
                className="text-[10px] uppercase tracking-widest text-ink-faint border border-border rounded px-1.5 py-0.5"
                title="This vendor does not invoice us for sandbox usage, so sandbox traffic carries no cost from it."
              >
                No sandbox charge
              </span>
            )}
            {status === "inactive" && (
              <span
                className="text-[10px] uppercase tracking-widest text-ink-faint border border-border rounded px-1.5 py-0.5"
                title="We no longer send this vendor work. Its rates and history are unchanged."
              >
                Inactive
              </span>
            )}
          </div>
          <p className="text-sm text-ink-muted mt-2 max-w-2xl leading-normal">
            {aliases.length === 0 ? (
              <>
                No other spelling is on file. If this vendor is renamed upstream, rename it here
                rather than letting the new name arrive on its own — a name nothing recognises
                becomes a second vendor with no rates.
              </>
            ) : (
              <>
                {aliases.length} other spelling{aliases.length === 1 ? "" : "s"} resolve
                {aliases.length === 1 ? "s" : ""} to this vendor, so usage arriving under any of
                them is costed against these rates.
              </>
            )}
          </p>
          {aliases.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {aliases.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-muted border border-border rounded px-1.5 py-0.5"
                >
                  {a}
                  {editable && (
                    <button
                      type="button"
                      title={`Stop treating "${a}" as this vendor`}
                      aria-label={`Remove alias ${a}`}
                      onClick={() => post({ remove_alias: a })}
                      className="text-ink-faint hover:text-bad-ink transition-colors"
                    >
                      <X size={10} strokeWidth={2} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        {editable && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent-ink px-2 py-1 rounded border border-border transition-colors"
          >
            <Pencil size={11} strokeWidth={1.75} />
            Edit
          </button>
        )}
      </div>

      {open && editable && (
        <div className="mt-5 pt-5 border-t border-border max-w-md">
          <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (save.k === "error") setSave({ k: "idle" });
            }}
            className="w-full px-2 py-1 rounded border border-border bg-bg text-sm focus:outline-none focus:border-accent"
          />
          <div className="text-[10px] text-ink-faint mt-1 mb-3">
            {renaming ? (
              <>
                Renaming keeps <span className="font-mono">{canonicalName}</span> as an alias, so
                traffic still arriving under it stays on this vendor. Rates, minimums and history
                are untouched.
              </>
            ) : (
              <>The name shown everywhere in Ledgerline.</>
            )}
          </div>

          <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
            Add a spelling
          </label>
          <div className="flex gap-1.5 mb-3">
            <input
              value={newAlias}
              placeholder="Another name this vendor arrives under"
              onChange={(e) => {
                setNewAlias(e.target.value);
                if (save.k === "error") setSave({ k: "idle" });
              }}
              className="flex-1 px-2 py-1 rounded border border-border bg-bg text-sm focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={newAlias.trim() === "" || save.k === "saving" || save.k === "saved"}
              onClick={() => {
                post({ add_alias: newAlias.trim() });
                setNewAlias("");
              }}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-ink-muted hover:text-ink disabled:opacity-40 transition-colors"
            >
              <Plus size={11} strokeWidth={2} />
              Add
            </button>
          </div>

          <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
            Charges for sandbox usage
          </label>
          <div className="flex gap-1 mb-1" role="group" aria-label="Charges for sandbox usage">
            {([true, false] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={chargesSandbox === v}
                onClick={() => post({ charges_sandbox: v })}
                className={`flex-1 px-1.5 py-1 rounded border text-[11px] transition-colors duration-fast ease-expo ${
                  chargesSandbox === v
                    ? "border-ink-muted bg-bg-sunken text-ink"
                    : "border-border text-ink-muted hover:text-ink"
                }`}
              >
                {v ? "Charges" : "Does not charge"}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-ink-faint mb-3">
            {sandbox.hits === 0 ? (
              <>
                {canonicalName} served no sandbox traffic in this period, so the answer moves
                nothing today. It still applies to every other period.
              </>
            ) : chargesSandbox ? (
              <>
                {formatNumber(sandbox.hits)} sandbox unit{sandbox.hits === 1 ? "" : "s"} in this
                period carry {formatMoney(sandbox.cost, { precision: 0 })} of this vendor&rsquo;s
                cost. Set this to <em>does not charge</em> only from the contract — while the
                answer is unknown, charging is the safer error.
              </>
            ) : (
              <>
                {formatNumber(sandbox.hits)} sandbox unit{sandbox.hits === 1 ? "" : "s"} in this
                period carry no cost from {canonicalName}. This is not effective-dated: it
                corrects every period at once, because the contract always said so.
              </>
            )}
          </div>

          <label className="block text-[10px] uppercase tracking-wide text-ink-faint mb-1">
            Status
          </label>
          <div className="flex gap-1 mb-1" role="group" aria-label="Vendor status">
            {(["active", "inactive"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => post({ status: s })}
                className={`flex-1 px-1.5 py-1 rounded border text-[11px] capitalize transition-colors duration-fast ease-expo ${
                  status === s
                    ? "border-ink-muted bg-bg-sunken text-ink"
                    : "border-border text-ink-muted hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-ink-faint mb-3">
            Inactive means we no longer send this vendor work. Nothing is deleted: its rates, its
            history and this page stay exactly as they are.
          </div>

          {save.k === "error" && (
            <div className="mt-3 p-2 rounded bg-bad-bg text-bad-ink text-[11px] leading-snug">
              <div className="flex items-start gap-1.5">
                <AlertTriangle size={12} strokeWidth={1.5} className="shrink-0 mt-0.5" />
                <div>{save.msg}</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                setName(canonicalName);
                setOpen(false);
              }}
              className="text-xs text-ink-muted hover:text-ink px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!renaming || save.k === "saving" || save.k === "saved"}
              onClick={() => post({ canonical_name: name.trim() }, name.trim())}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-accent text-bg disabled:opacity-40 active:scale-[0.97] transition-transform duration-fast ease-expo"
            >
              {save.k === "saving" && <Loader2 size={12} strokeWidth={2} className="animate-spin" />}
              {save.k === "saved" && <Check size={12} strokeWidth={2} />}
              {save.k === "saving" ? "Saving…" : save.k === "saved" ? "Saved" : "Rename"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
