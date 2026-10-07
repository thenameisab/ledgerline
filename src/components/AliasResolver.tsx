"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Unlink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ROW_WARN } from "@/lib/row-status";
import { Combobox } from "@/components/ui/Combobox";
import { RollingText, SUCCESS_ROLL } from "@/components/ui/RollingText";
import { ApiFormModal } from "@/components/apis/ApiFormModal";
import { AccountCreateModal } from "@/components/AccountCreateModal";
import { formatDay } from "@/lib/format";

type Row = { raw_name: string; hits: number; last_seen: string; is_new?: boolean };
type AccountTarget = { id: number; display_name: string };
type ApiTarget = { product_code: string; name: string };
type Group = { id: number; name: string };

const CREATE_NEW_API_SENTINEL = "__create_new_api__";
const CREATE_NEW_ACCOUNT_SENTINEL = "__create_new_account__";

export function AliasResolver({
  kind,
  rows,
  targets,
  groups = [],
}: {
  kind: "account" | "api";
  rows: Row[];
  targets: AccountTarget[] | ApiTarget[];
  groups?: Group[];
}) {
  if (rows.length === 0) {
    return (
      <div className="elev-1 bg-bg-raised rounded-md p-10 text-center">
        <Check size={20} strokeWidth={1.5} className="text-success mx-auto mb-3" />
        <div className="font-serif text-lg text-ink">All resolved</div>
        <div className="text-sm text-ink-muted mt-1">Every {kind} name in the logs maps to a canonical record.</div>
      </div>
    );
  }

  return (
    <div className="elev-1 bg-bg-raised rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-bg-sunken text-ink-muted text-xs uppercase tracking-wide">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">Raw {kind} name (from logs)</th>
            <th className="px-3 py-3 font-medium text-right">Units</th>
            <th className="px-3 py-3 font-medium">Last seen</th>
            <th className="px-4 py-3 font-medium">Map to</th>
            <th className="px-3 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <ResolverRow key={r.raw_name} kind={kind} row={r} targets={targets} groups={groups} index={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResolverRow({
  kind,
  row,
  targets,
  groups,
  index,
}: {
  kind: "account" | "api";
  row: Row;
  targets: AccountTarget[] | ApiTarget[];
  groups: Group[];
  index: number;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const save = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const body: any = { kind, raw_name: row.raw_name };
      if (kind === "account") body.target_id = Number(target);
      else body.target_code = target;
      await fetch("/api/aliases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setDone(true);
      setTimeout(() => router.refresh(), 600);
    } finally {
      setSaving(false);
    }
  };

  const onSelect = (value: string) => {
    if (value === CREATE_NEW_API_SENTINEL) {
      setCreating(true);
      return;
    }
    if (value === CREATE_NEW_ACCOUNT_SENTINEL) {
      setCreatingAccount(true);
      return;
    }
    setTarget(value);
  };

  return (
    <tr
      className={`${done ? "bg-ok-bg" : ROW_WARN} row-enter transition-colors duration-fast ease-expo`}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <td className="px-4 py-3 text-ink">
        <div className="flex items-center gap-2">
          <Unlink size={12} strokeWidth={1.5} className="text-warn-ink" />
          <span className="font-mono">{row.raw_name}</span>
          {row.is_new && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] uppercase tracking-wider bg-info-bg text-info-ink"
              title="Neither the name nor a SKU code in the catalog matches this. It has never been billed before. Create it as a new SKU."
            >
              <Sparkles size={10} strokeWidth={1.5} />
              New SKU
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-right font-mono tnum text-ink">{row.hits.toLocaleString("en-US")}</td>
      <td className="px-3 py-3 text-xs text-ink-muted whitespace-nowrap">{formatDay(row.last_seen)}</td>
      <td className="px-4 py-3">
        <div className="min-w-[260px]">
          {kind === "account" ? (
            <Combobox
              options={targets as AccountTarget[]}
              value={target}
              onChange={onSelect}
              getValue={(t) => String(t.id)}
              getLabel={(t) => t.display_name}
              keys={["display_name"]}
              emptyLabel="Choose canonical account…"
              searchPlaceholder="Search accounts…"
              disabled={saving || done}
              sentinel={{ value: CREATE_NEW_ACCOUNT_SENTINEL, label: "+ Create new account…" }}
            />
          ) : (
            <Combobox
              options={targets as ApiTarget[]}
              value={target}
              onChange={onSelect}
              getValue={(t) => t.product_code}
              getLabel={(t) => `${t.product_code} – ${t.name}`}
              keys={["product_code", "name"]}
              emptyLabel="Choose canonical api…"
              searchPlaceholder="Search code or name…"
              disabled={saving || done}
              sentinel={{ value: CREATE_NEW_API_SENTINEL, label: "+ Create new SKU…" }}
            />
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        {/* Secondary (outlined) until a target is picked: a solid primary button
            at 50% opacity still reads as enabled. */}
        <Button
          variant={target && !done ? "primary" : "secondary"}
          size="sm"
          onClick={save}
          disabled={!target || saving || done}
        >
          <RollingText
            text={done ? "Resolved" : saving ? "Saving…" : "Resolve"}
            options={{ direction: "up", color: done ? SUCCESS_ROLL : undefined }}
          />
        </Button>
        {creating && (
          <ApiFormModal
            mode="create"
            initial={{ name: row.raw_name }}
            existingCodes={new Set((targets as ApiTarget[]).map((t) => t.product_code))}
            resolveRawName={row.raw_name}
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              setDone(true);
              setTimeout(() => router.refresh(), 600);
            }}
          />
        )}
        {kind === "account" && (
          <AccountCreateModal
            groups={groups}
            open={creatingAccount}
            onOpenChange={setCreatingAccount}
            hideTrigger
            initialName={row.raw_name}
            resolveRawName={row.raw_name}
            onSaved={() => {
              setCreatingAccount(false);
              setDone(true);
              setTimeout(() => router.refresh(), 600);
            }}
          />
        )}
      </td>
    </tr>
  );
}
