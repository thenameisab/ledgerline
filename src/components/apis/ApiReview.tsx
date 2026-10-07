"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { formatDay } from "@/lib/format";

type UnknownCode = { code: string; sample_name: string; rows: number; hits: number; last_seen: string; exists_inactive: boolean };
type NoCodeRow = { raw_name: string; rows: number; hits: number; last_seen: string };
type NameDrift = { api_code: string; raw_name: string; hits: number; last_seen: string };
type Retired = { product_code: string; name: string; rows: number; hits: number };
type ApiTarget = { product_code: string; name: string };

const fmt = (n: number) => n.toLocaleString("en-IN");

async function post(body: unknown) {
  const res = await fetch("/api/api-review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

function Section({ title, hint, count, children }: { title: string; hint: string; count: number; children: React.ReactNode }) {
  return (
    <section className="elev-1 bg-bg-raised rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-lg text-ink">{title}</h2>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] tnum bg-bg-sunken text-ink-muted">{count}</span>
        </div>
        <p className="text-sm text-ink-muted mt-1 max-w-2xl leading-normal">{hint}</p>
      </div>
      {count === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-ink-muted flex items-center justify-center gap-2">
          <Check size={15} strokeWidth={1.5} className="text-success" /> Nothing to review.
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Done() {
  return <span className="inline-flex items-center gap-1 text-success text-sm"><Check size={14} strokeWidth={2} /> Done</span>;
}

function AcceptCodeRow({ row }: { row: UnknownCode }) {
  const router = useRouter();
  const [name, setName] = useState(row.sample_name);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const act = async () => {
    setBusy(true);
    const ok = await post({ action: "accept-code", code: row.code, name });
    setBusy(false);
    if (ok) { setDone(true); setTimeout(() => router.refresh(), 600); }
  };
  return (
    <tr className={done ? "bg-ok-bg" : ""}>
      <td className="px-5 py-3 font-mono text-ink">{row.code}</td>
      <td className="px-3 py-3">
        {row.exists_inactive ? (
          <span className="text-ink-muted text-sm">{row.sample_name}</span>
        ) : (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy || done}
            className="w-full min-w-[220px] bg-bg-sunken border border-border rounded px-2 py-1 text-sm text-ink"
          />
        )}
      </td>
      <td className="px-3 py-3 text-right tnum text-ink">{fmt(row.hits)}</td>
      <td className="px-3 py-3 text-xs text-ink-muted whitespace-nowrap">{formatDay(row.last_seen)}</td>
      <td className="px-5 py-3 text-right">
        {done ? <Done /> : (
          <Button variant="primary" size="sm" onClick={act} disabled={busy || (!row.exists_inactive && !name.trim())}>
            {row.exists_inactive ? (busy ? "Reactivating…" : "Reactivate") : (busy ? "Accepting…" : "Accept into catalog")}
          </Button>
        )}
      </td>
    </tr>
  );
}

function OverrideRow({ row, targets }: { row: NoCodeRow; targets: ApiTarget[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const act = async () => {
    if (!code) return;
    setBusy(true);
    const ok = await post({ action: "override", raw_api_name: row.raw_name, code });
    setBusy(false);
    if (ok) { setDone(true); setTimeout(() => router.refresh(), 600); }
  };
  return (
    <tr className={done ? "bg-ok-bg" : ""}>
      <td className="px-5 py-3 font-mono text-ink">{row.raw_name}</td>
      <td className="px-3 py-3 text-right tnum text-ink">{fmt(row.hits)}</td>
      <td className="px-3 py-3 text-xs text-ink-muted whitespace-nowrap">{formatDay(row.last_seen)}</td>
      <td className="px-3 py-3">
        <div className="min-w-[260px]">
          <Combobox
            options={targets}
            value={code}
            onChange={setCode}
            getValue={(t) => t.product_code}
            getLabel={(t) => `${t.product_code} – ${t.name}`}
            keys={["product_code", "name"]}
            emptyLabel="Map to active code…"
            searchPlaceholder="Search code or name…"
            disabled={busy || done}
          />
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        {done ? <Done /> : (
          <Button variant="primary" size="sm" onClick={act} disabled={!code || busy}>
            {busy ? "Saving…" : "Add override"}
          </Button>
        )}
      </td>
    </tr>
  );
}

function DriftRow({ row }: { row: NameDrift }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const act = async () => {
    setBusy(true);
    const ok = await post({ action: "acknowledge-drift", code: row.api_code, raw_api_name: row.raw_name });
    setBusy(false);
    if (ok) { setDone(true); setTimeout(() => router.refresh(), 600); }
  };
  return (
    <tr className={done ? "bg-ok-bg" : ""}>
      <td className="px-5 py-3 font-mono text-ink">{row.api_code}</td>
      <td className="px-3 py-3 text-ink">{row.raw_name}</td>
      <td className="px-3 py-3 text-right tnum text-ink">{fmt(row.hits)}</td>
      <td className="px-3 py-3 text-xs text-ink-muted whitespace-nowrap">{formatDay(row.last_seen)}</td>
      <td className="px-5 py-3 text-right">
        {done ? <Done /> : (
          <Button variant="secondary" size="sm" onClick={act} disabled={busy}>
            {busy ? "Saving…" : "Acknowledge"}
          </Button>
        )}
      </td>
    </tr>
  );
}

function ReactivateRow({ row }: { row: Retired }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const act = async () => {
    setBusy(true);
    const ok = await post({ action: "accept-code", code: row.product_code, name: row.name });
    setBusy(false);
    if (ok) { setDone(true); setTimeout(() => router.refresh(), 600); }
  };
  return (
    <tr className={done ? "bg-ok-bg" : ""}>
      <td className="px-5 py-3 font-mono text-ink">{row.product_code}</td>
      <td className="px-3 py-3 text-ink">{row.name}</td>
      <td className="px-3 py-3 text-right tnum text-ink">{fmt(row.hits)}</td>
      <td className="px-5 py-3 text-right">
        {done ? <Done /> : (
          <Button variant="secondary" size="sm" onClick={act} disabled={busy}>
            <RotateCcw size={13} strokeWidth={1.5} className="mr-1" />{busy ? "Reactivating…" : "Reactivate"}
          </Button>
        )}
      </td>
    </tr>
  );
}

const TH = "px-5 py-3 font-medium text-left";
const THr = "px-3 py-3 font-medium text-right";

export function ApiReview({
  unknownCodes, noCodeRows, drift, retired, targets,
}: {
  unknownCodes: UnknownCode[]; noCodeRows: NoCodeRow[]; drift: NameDrift[]; retired: Retired[]; targets: ApiTarget[];
}) {
  return (
    <div className="space-y-5">
      <Section
        title="Unknown product codes"
        hint="Usage arrived with a Product Code that isn't an active catalog code. Accept it into the catalog (then price it) or reactivate a retired code. Until then these hits earn nothing."
        count={unknownCodes.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-ink-muted text-xs uppercase tracking-wide">
            <tr>
              <th className={TH}>Code</th><th className={TH}>Name {`(catalog)`}</th>
              <th className={THr}>Hits</th><th className={TH}>Last seen</th><th className={THr}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {unknownCodes.map((r) => <AcceptCodeRow key={r.code} row={r} />)}
          </tbody>
        </table>
      </Section>

      <Section
        title="Missing product codes"
        hint="Usage arrived with a blank Product Code. The real fix is upstream in the usage log source; meanwhile add a durable name → code override so these hits bill correctly going forward."
        count={noCodeRows.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-ink-muted text-xs uppercase tracking-wide">
            <tr>
              <th className={TH}>Raw API name</th><th className={THr}>Hits</th>
              <th className={TH}>Last seen</th><th className={TH}>Map to</th><th className={THr}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {noCodeRows.map((r) => <OverrideRow key={r.raw_name} row={r} targets={targets} />)}
          </tbody>
        </table>
      </Section>

      <Section
        title="Name drift"
        hint="These hits matched by code, but the name the source used isn't a known catalog name or alias. Advisory only — billing is unaffected. Acknowledge to record the variant and clear it."
        count={drift.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-ink-muted text-xs uppercase tracking-wide">
            <tr>
              <th className={TH}>Code</th><th className={TH}>Name in source</th>
              <th className={THr}>Hits</th><th className={TH}>Last seen</th><th className={THr}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {drift.map((r) => <DriftRow key={`${r.api_code}|${r.raw_name}`} row={r} />)}
          </tbody>
        </table>
      </Section>

      <Section
        title="Retired codes with usage"
        hint="Deactivated codes that still carry usage. Their historical revenue is intact, but new incoming usage will quarantine above. Reactivate if a code retired by mistake."
        count={retired.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-bg-sunken text-ink-muted text-xs uppercase tracking-wide">
            <tr>
              <th className={TH}>Code</th><th className={TH}>Name</th><th className={THr}>Hits</th><th className={THr}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {retired.map((r) => <ReactivateRow key={r.product_code} row={r} />)}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
