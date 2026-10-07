// Synthetic data generator for the Ledgerline portfolio mock.
//
// Populates every table with fully fictional data so all features render:
// accounts, clients, a catalog, flat + slab pricing (with history), a stitched
// bundle, vendor costs, ~3 months of daily usage, manual entries in each
// state, users across roles, billing periods, finalized/issued/draft invoices,
// sync runs, and an audit trail.
//
// Reuses the app's own repos (createManualEntry, finalizeStatement, …) wherever
// non-trivial logic lives, so the seeded data is exactly what the UI produces.
//
// Deterministic: a seeded PRNG makes reseeds reproducible. Safe to re-run.
//
//   npm run seed

import getSql from "../src/lib/db";
import { recordAudit } from "../src/lib/repos/audit";
import {
  createManualEntry,
  submitManualEntry,
  approveManualEntry,
} from "../src/lib/repos/manual-entries";
import { finalizeStatement, issueStatement } from "../src/lib/repos/statements";
import { generateSlug } from "../src/lib/slug";
import { CS_TEAM, SALES_TEAM } from "../src/lib/team";
import { syncVendorUsage } from "../src/lib/vendor-recon-sync";
import { runPendingAlerts } from "../src/lib/alerts/run";
import {
  MOCK_ACCOUNTS,
  MOCK_CLIENTS,
  MOCK_APIS,
  MOCK_USERS,
  MOCK_VENDORS,
  MOCK_VENDOR_ALIASES,
  MOCK_INACTIVE_VENDOR,
  type MockApi,
} from "./seed-data/mock-catalog";

// ── deterministic PRNG ────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260625);
const pick = (n: number) => Math.floor(rand() * n);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

// A few brand colors for the inline logo placeholders.
const LOGO_COLORS = ["#0f766e", "#4338ca", "#b45309"];

// Build a small self-contained SVG logo (initials on a colored rounded square)
// as a base64 data-URI — no external asset, exactly what the logo upload stores.
function logoDataUri(name: string, color: string): string {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" rx="28" fill="${color}"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" ` +
    `font-family="Inter, Arial, sans-serif" font-size="56" font-weight="700" fill="#ffffff">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// ── date helpers (IST business calendar, matching the app) ────────────────────
function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
function shift(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function firstOfMonth(iso: string): string {
  return iso.slice(0, 8) + "01";
}
function lastOfMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return d.toISOString().slice(0, 10);
}
function monthLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
function dow(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = Sun
}

const TODAY = todayIST();
const CUR_MONTH_START = firstOfMonth(TODAY);
const RANGE_START = addMonths(CUR_MONTH_START, -2); // first day, two months back
const PERIODS = [
  { start: RANGE_START, end: lastOfMonth(RANGE_START), closed: true, invoice: "issued" as const },
  { start: addMonths(RANGE_START, 1), end: lastOfMonth(addMonths(RANGE_START, 1)), closed: true, invoice: "final" as const },
  { start: CUR_MONTH_START, end: lastOfMonth(CUR_MONTH_START), closed: false, invoice: "draft" as const },
];

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let d = from;
  while (d <= to) {
    out.push(d);
    d = shift(d, 1);
  }
  return out;
}

async function main() {
  // The seed is always offline: the vendor-side pull below reads the mock.
  process.env.MOCK_INTEGRATIONS = "true";
  const sql = getSql();
  console.log(`seeding Ledgerline mock — today=${TODAY}, usage ${RANGE_START}…${TODAY}`);

  // ── wipe ────────────────────────────────────────────────────────────────────
  await sql`
    TRUNCATE TABLE
      statement_adjustments, statement_lines, statements, billing_periods,
      invoice_sequence, audit_log, sync_runs, usage_daily, manual_entries, app_settings,
      bundle_pricing, api_bundle_members, api_bundles,
      pricing_slab, pricing, vendor_pricing_slab, vendor_pricing, vendor_commitments,
      vendor_usage_daily, vendor_recon_dismissals, vendor_aliases, vendors,
      alerts, alert_runs, notifications,
      clients, apis, users, accounts
    RESTART IDENTITY CASCADE
  `;

  // ── accounts ──────────────────────────────────────────────────────────────────
  const accountId = new Map<string, number>();
  for (const a of MOCK_ACCOUNTS) {
    const [row] = await sql`INSERT INTO accounts (name) VALUES (${a.name}) RETURNING id`;
    accountId.set(a.name, Number(row.id));
  }
  console.log(`  accounts: ${accountId.size}`);

  // ── apis ──────────────────────────────────────────────────────────────────────
  for (const api of MOCK_APIS) {
    await sql`
      INSERT INTO apis (product_code, name, log_aliases, category, entity_type, vendor_type, default_vendor, is_active)
      VALUES (${api.product_code}, ${api.name}, ${JSON.stringify([api.name])},
              ${api.category}, ${api.entity_type}, ${api.vendor_type}, ${api.default_vendor}, ${api.is_active})
    `;
  }
  console.log(`  apis: ${MOCK_APIS.length}`);

  // ── vendor registry ──────────────────────────────────────────────────────────
  // One row per vendor, each with its own name as an alias. Verisys also has
  // two old spellings merged into it. NovaCheck has told us it does not charge
  // for sandbox calls; every other vendor keeps the default (charges).
  const vendorId = new Map<string, number>();
  for (const name of MOCK_VENDORS) {
    const [row] = await sql`
      INSERT INTO vendors (canonical_name, status, charges_sandbox)
      VALUES (${name}, ${name === MOCK_INACTIVE_VENDOR ? "inactive" : "active"}, ${name !== "NovaCheck"})
      RETURNING id`;
    vendorId.set(name, Number(row.id));
    await sql`INSERT INTO vendor_aliases (vendor_id, alias) VALUES (${Number(row.id)}, ${name})`;
  }
  for (const [name, aliases] of Object.entries(MOCK_VENDOR_ALIASES)) {
    for (const alias of aliases) {
      await sql`INSERT INTO vendor_aliases (vendor_id, alias) VALUES (${vendorId.get(name)!}, ${alias})`;
    }
  }
  console.log(`  vendors: ${vendorId.size} (aliases merged into Verisys: ${MOCK_VENDOR_ALIASES.Verisys.length})`);

  // ── vendor rate card ──────────────────────────────────────────────────────────
  // Cost = 45–70% of the list band. Every rate state appears somewhere:
  //   • a known rate, with status contracted, quoted or estimated (by rotation)
  //   • failures and in-progress hits "not charged" (a confirmed 0, not unknown)
  //   • FR5001: no rate at all (unknown, so its cost counts as missing)
  //   • IN4004: a rate for successful hits only; the other outcomes unknown
  //   • KY1001: an effective-dated change at the start of last month
  //   • BV3004: costed in-house (known and zero)
  //   • AD6001: a graduated (tier) volume rate
  //   • Sentinel Data: an old contracted rate, no current traffic
  const UNKNOWN_RATE = "FR5001";
  const PARTIAL_RATE = "IN4004";
  const RATE_CHANGE = "KY1001";
  const IN_HOUSE = "BV3004";
  const VOLUME_RATE = "AD6001";
  const STATUSES = ["contracted", "quoted", "estimated"] as const;
  let vpCount = 0;
  for (let ai = 0; ai < MOCK_APIS.length; ai++) {
    const api = MOCK_APIS[ai];
    const factor = between(0.45, 0.7);
    if (api.product_code === UNKNOWN_RATE) continue;
    const vid = vendorId.get(api.default_vendor)!;
    const c = +(api.priceBand * factor).toFixed(4);
    const status = STATUSES[ai % 3];
    if (api.product_code === VOLUME_RATE) {
      const [vp] = await sql`
        INSERT INTO vendor_pricing (vendor_id, api_code, cost_successful, cost_successful_no_data, cost_failed, cost_in_progress,
                                    effective_from, status, source, pricing_model)
        -- A volume rate keeps 0 in the flat columns; the brackets hold the cost
        -- (the same shape /api/vendor-cost writes).
        VALUES (${vid}, ${api.product_code}, 0, 0, 0, 0, ${"2026-01-01"}, 'contracted',
                ${"Lumen ID rate card 2026"}, 'tier')
        RETURNING id`;
      await sql`
        INSERT INTO vendor_pricing_slab (vendor_pricing_id, min_hits, max_hits, cost_successful, cost_successful_no_data, cost_failed, cost_in_progress)
        VALUES (${Number(vp.id)}, 0, 20000, ${c}, ${+(c * 0.2).toFixed(4)}, 0, 0),
               (${Number(vp.id)}, 20000, NULL, ${+(c * 0.75).toFixed(4)}, ${+(c * 0.15).toFixed(4)}, 0, 0)`;
      vpCount++;
      continue;
    }
    const partial = api.product_code === PARTIAL_RATE;
    await sql`
      INSERT INTO vendor_pricing (vendor_id, api_code, cost_successful, cost_successful_no_data, cost_failed, cost_in_progress,
                                  effective_from, status, source, cost_basis)
      VALUES (${vid}, ${api.product_code}, ${api.product_code === IN_HOUSE ? null : c},
              ${partial || api.product_code === IN_HOUSE ? null : +(c * 0.2).toFixed(4)},
              ${partial || api.product_code === IN_HOUSE ? null : 0}, ${partial || api.product_code === IN_HOUSE ? null : 0},
              ${"2026-01-01"}, ${status}, ${status === "estimated" ? null : `${api.default_vendor} MSA 2026-01`},
              ${api.product_code === IN_HOUSE ? "in_house" : "vendor"})`;
    vpCount++;
    if (api.product_code === RATE_CHANGE) {
      await sql`
        INSERT INTO vendor_pricing (vendor_id, api_code, cost_successful, cost_successful_no_data, cost_failed, cost_in_progress,
                                    effective_from, status, source)
        VALUES (${vid}, ${api.product_code}, ${+(c * 0.9).toFixed(4)}, ${+(c * 0.18).toFixed(4)}, 0, 0,
                ${addMonths(CUR_MONTH_START, -1)}, 'quoted', ${"Quantal revised quote"})`;
      vpCount++;
    }
  }
  // The inactive vendor: an old rate on an API it no longer serves.
  await sql`
    INSERT INTO vendor_pricing (vendor_id, api_code, cost_successful, cost_successful_no_data, cost_failed, cost_in_progress,
                                effective_from, status, source)
    VALUES (${vendorId.get(MOCK_INACTIVE_VENDOR)!}, 'FR5006', 0.9, 0.2, 0, 0, ${"2025-10-01"}, 'contracted',
            ${"Sentinel Data MSA 2025 (ended)"})`;
  vpCount++;
  console.log(`  vendor_pricing: ${vpCount}`);

  // ── users ─────────────────────────────────────────────────────────────────────
  const userId = new Map<string, number>();
  for (const u of MOCK_USERS) {
    const [row] = await sql`
      INSERT INTO users (email, display_name, role, status, emoji, job_title, last_login_at, invite_expires_at)
      VALUES (${u.email}, ${u.display_name}, ${u.role}, ${u.status}, ${u.emoji}, ${u.job_title},
              ${u.status === "active" ? new Date().toISOString() : null},
              ${u.status === "invited" ? shift(TODAY, u.inviteExpired ? -3 : 5) : null})
      RETURNING id
    `;
    userId.set(u.email, Number(row.id));
  }
  const ADMIN = userId.get("admin@ledgerline.local")!;
  console.log(`  users: ${userId.size}`);

  // ── clients ─────────────────────────────────────────────────────────────────
  type ClientRec = { id: number; name: string; scale: number; apis: MockApi[]; sandbox: boolean };
  const clients: ClientRec[] = [];
  const activeApis = MOCK_APIS.filter((a) => a.is_active === 1);
  for (let ci = 0; ci < MOCK_CLIENTS.length; ci++) {
    const c = MOCK_CLIENTS[ci];
    const slug = generateSlug(c.display_name);
    const aliases = [c.display_name, c.billing_entity];
    // Profile fields. Human-facing "Client ID", website, and
    // CS/Sales relationship owners (round-robin from the fixed rosters). Logos
    // are inline SVG data-URIs on a few clients so both the image and the
    // initials-fallback paths render; the rest stay NULL.
    const clientCode = `LL-${String(ci + 1).padStart(4, "0")}`;
    const website = `${slug}.example.com`;
    const csOwner = CS_TEAM[ci % CS_TEAM.length];
    const salesOwner = SALES_TEAM[ci % SALES_TEAM.length];
    const logoDataUrl = ci < 3 ? logoDataUri(c.display_name, LOGO_COLORS[ci % LOGO_COLORS.length]) : null;
    const [row] = await sql`
      INSERT INTO clients (account_id, display_name, slug, log_aliases, billing_entity, gstin, status, is_sandbox,
                           client_code, website, cs_owner, sales_owner, logo_data_url)
      VALUES (${accountId.get(c.account) ?? null}, ${c.display_name}, ${slug}, ${JSON.stringify(aliases)},
              ${c.billing_entity}, ${c.gstin}, ${c.status}, ${c.is_sandbox ? 1 : 0},
              ${clientCode}, ${website}, ${csOwner}, ${salesOwner}, ${logoDataUrl})
      RETURNING id
    `;
    // Deterministic API subset: stride through the active catalog from an offset.
    const offset = pick(activeApis.length);
    const apis: MockApi[] = [];
    for (let i = 0; i < c.apiCount; i++) apis.push(activeApis[(offset + i * 3) % activeApis.length]);
    const uniq = Array.from(new Map(apis.map((a) => [a.product_code, a])).values());
    clients.push({ id: Number(row.id), name: c.display_name, scale: c.scale, apis: uniq, sandbox: !!c.is_sandbox });
  }
  console.log(`  clients: ${clients.length}`);

  // ── pricing (flat + volume models + history + leaks) ──────────────────────────
  // Exercises every pricing path the app supports:
  //   • flat 4-status pricing (the common case), with one effective-dated change
  //   • 'tier'  — graduated/marginal volume pricing on the two largest clients
  //   • 'slab'  — whole-volume pricing on the third-largest client
  //   • an intentionally unpriced pair per large client → an ACTIVE revenue leak
  //   • one historical-leak pair (priced only from this month) → later dismissed
  let pricingCount = 0;
  let tierCount = 0;
  let slabCount = 0;
  const volumeModel = new Map<string, "tier" | "slab">(); // `${clientId}:${code}` → model
  const bigClients = [...clients].filter((c) => !c.sandbox).sort((a, b) => b.scale - a.scale).slice(0, 3);
  // Two largest → graduated 'tier'; third → whole-volume 'slab'. Both share the
  // pricing_slab bracket storage and differ only in the billing math.
  bigClients.slice(0, 2).forEach((bc) => {
    const t = bc.apis.find((a) => a.category === "KYC") ?? bc.apis[0];
    if (t) volumeModel.set(`${bc.id}:${t.product_code}`, "tier");
  });
  if (bigClients[2]) {
    const sc = bigClients[2];
    const t = sc.apis.find((a) => a.category === "KYC") ?? sc.apis[0];
    if (t) volumeModel.set(`${sc.id}:${t.product_code}`, "slab");
  }

  // Historical-leak demo pair: a mid-size billable client's 2nd API, priced only
  // from the current month. Usage in earlier months is therefore unpriced *in the
  // past* — a historical leak — which we acknowledge via leak_dismissals below.
  const histClient = clients.find(
    (c) => !c.sandbox && !bigClients.includes(c) && c.apis.length >= 2
  );
  const histKey = histClient ? `${histClient.id}:${histClient.apis[1].product_code}` : null;

  // Insert graduated/whole-volume brackets for a pricing row.
  const insertBrackets = async (pid: number, ps: number) => {
    const brackets = [
      { min: 0, max: 50000, p: +(ps * 1.0).toFixed(4) },
      { min: 50000, max: 200000, p: +(ps * 0.8).toFixed(4) },
      { min: 200000, max: null as number | null, p: +(ps * 0.6).toFixed(4) },
    ];
    for (const b of brackets) {
      await sql`
        INSERT INTO pricing_slab (pricing_id, min_hits, max_hits, price_successful, price_successful_no_data, price_failed, price_in_progress)
        VALUES (${pid}, ${b.min}, ${b.max}, ${b.p}, ${+(b.p * 0.3).toFixed(4)}, 0, 0)
      `;
    }
  };

  for (const c of clients) {
    const unpricedIdx = c.apis.length > 4 ? pick(c.apis.length) : -1; // leave one unpriced
    for (let i = 0; i < c.apis.length; i++) {
      const api = c.apis[i];
      const key = `${c.id}:${api.product_code}`;
      // The historical-leak pair and the volume-priced (tier/slab) targets must
      // always be priced, so never let the random unpriced slot fall on them.
      if (i === unpricedIdx && key !== histKey && !volumeModel.has(key)) continue; // active leak
      const negotiated = between(0.85, 1.25); // per-client rate variation
      const ps = +(api.priceBand * negotiated).toFixed(4);

      const model = volumeModel.get(key);
      if (model) {
        const [row] = await sql`
          INSERT INTO pricing (client_id, api_code, price_successful, price_successful_no_data, price_failed, price_in_progress, effective_from, pricing_model)
          VALUES (${c.id}, ${api.product_code}, 0, 0, 0, 0, ${"2026-01-01"}, ${model})
          RETURNING id
        `;
        await insertBrackets(Number(row.id), ps);
        if (model === "tier") tierCount++;
        else slabCount++;
        pricingCount++;
        continue;
      }

      if (key === histKey) {
        // Priced only from the current month → earlier usage is a historical leak.
        await sql`
          INSERT INTO pricing (client_id, api_code, price_successful, price_successful_no_data, price_failed, price_in_progress, effective_from, pricing_model)
          VALUES (${c.id}, ${api.product_code}, ${ps}, ${+(ps * 0.3).toFixed(4)}, 0, 0, ${CUR_MONTH_START}, 'flat')
        `;
        pricingCount++;
        continue;
      }

      // Flat. Give the first API of the big clients a mid-range price change
      // (history) so effective-dated pricing is demonstrable.
      await sql`
        INSERT INTO pricing (client_id, api_code, price_successful, price_successful_no_data, price_failed, price_in_progress, effective_from, pricing_model)
        VALUES (${c.id}, ${api.product_code}, ${ps}, ${+(ps * 0.3).toFixed(4)}, ${0}, ${0}, ${"2026-01-01"}, 'flat')
      `;
      pricingCount++;
      if (i === 0 && bigClients.some((b) => b.id === c.id)) {
        const bumped = +(ps * 1.1).toFixed(4);
        await sql`
          INSERT INTO pricing (client_id, api_code, price_successful, price_successful_no_data, price_failed, price_in_progress, effective_from, pricing_model)
          VALUES (${c.id}, ${api.product_code}, ${bumped}, ${+(bumped * 0.3).toFixed(4)}, ${0}, ${0}, ${CUR_MONTH_START}, 'flat')
        `;
        pricingCount++;
      }
    }
  }
  console.log(`  pricing rows: ${pricingCount} (tier: ${tierCount}, slab: ${slabCount})`);

  // ── stitched bundle for one client ────────────────────────────────────────────
  // Bundle three onboarding APIs into one billed product on the largest client.
  const bundleClient = bigClients[0];
  if (bundleClient && bundleClient.apis.length >= 3) {
    const members = bundleClient.apis.slice(0, 3);
    // Avoid colliding with a volume-priced (tier/slab) pair as anchor.
    const anchor = members.find((m) => !volumeModel.has(`${bundleClient.id}:${m.product_code}`)) ?? members[0];
    const [b] = await sql`
      INSERT INTO api_bundles (client_id, name, anchor_api_code)
      VALUES (${bundleClient.id}, ${"Onboarding Suite"}, ${anchor.product_code})
      RETURNING id
    `;
    const bundleId = Number(b.id);
    for (const m of members) {
      // api_bundle_members has UNIQUE(client_id, api_code); skip volume-priced pairs.
      if (volumeModel.has(`${bundleClient.id}:${m.product_code}`)) continue;
      await sql`
        INSERT INTO api_bundle_members (bundle_id, client_id, api_code)
        VALUES (${bundleId}, ${bundleClient.id}, ${m.product_code})
        ON CONFLICT DO NOTHING
      `;
    }
    const bundlePrice = +(anchor.priceBand * 2.2).toFixed(4); // one price for the suite
    await sql`
      INSERT INTO bundle_pricing (bundle_id, price_successful, price_successful_no_data, price_failed, price_in_progress, effective_from)
      VALUES (${bundleId}, ${bundlePrice}, ${+(bundlePrice * 0.3).toFixed(4)}, 0, 0, ${RANGE_START})
    `;
    console.log(`  bundle: "Onboarding Suite" on ${bundleClient.name} (anchor ${anchor.product_code})`);
  }

  // ── usage_daily (log source) ──────────────────────────────────────────────────
  const days = dateRange(RANGE_START, TODAY);
  // Per-api popularity weight so volumes differ across the catalog.
  const apiVol = new Map<string, number>();
  for (const a of MOCK_APIS) apiVol.set(a.product_code, between(0.4, 1.6));

  let usageRows = 0;
  const BATCH = 1000;
  let batch: any[] = [];
  const flush = async () => {
    if (batch.length === 0) return;
    await sql`INSERT INTO usage_daily ${sql(batch)}`;
    usageRows += batch.length;
    batch = [];
  };

  for (const c of clients) {
    for (const api of c.apis) {
      const base = 120 * c.scale * (apiVol.get(api.product_code) ?? 1);
      const phase = rand() * Math.PI * 2;
      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        const wd = dow(day);
        const weekend = wd === 0 || wd === 6 ? 0.45 : 1.0;
        const trend = 1 + (di / days.length) * 0.4; // ~40% growth across the window
        const wave = 1 + 0.18 * Math.sin(phase + di / 6);
        const noise = between(0.8, 1.2);
        const total = Math.max(0, Math.round(base * weekend * trend * wave * noise));
        if (total === 0) continue;
        const failed = Math.round(total * between(0.04, 0.1));
        const noData = Math.round(total * between(0.02, 0.06));
        const inProg = Math.round(total * between(0.0, 0.02));
        const successful = Math.max(0, total - failed - noData - inProg);
        batch.push({
          date: day,
          client_id: c.id,
          api_code: api.product_code,
          raw_client_name: c.name,
          raw_api_name: api.name,
          raw_api_code: api.product_code,
          hits_via: "Integration",
          // Before last month, Verisys rows carry an old spelling. The registry
          // resolves both to one vendor_id, so /vendors shows one Verisys.
          vendor:
            api.default_vendor === "Verisys" && day < addMonths(CUR_MONTH_START, -1)
              ? MOCK_VENDOR_ALIASES.Verisys[0]
              : api.default_vendor,
          vendor_id: vendorId.get(api.default_vendor)!,
          successful,
          successful_no_data: noData,
          failed,
          in_progress: inProg,
          source: "log",
        });
        if (batch.length >= BATCH) await flush();
      }
    }
  }
  await flush();
  console.log(`  usage_daily rows: ${usageRows}`);

  // ── API-review scenarios (code-only matching) ───────────────────────────────
  // The synthetic catalog is clean, so deliberately inject the four data-quality
  // anomalies the API-review page surfaces — otherwise every queue is empty:
  //   1. retired-with-usage  2. unknown code  3. no code  4. name drift
  const scn = clients[0];
  // Data-quality anomalies are "needs attention now" items, so they must live in
  // the current OPEN period only — never in a finalized month (unmapped, null
  // api_code rows can't be billed and would break statement finalization). Take
  // the last few days but clamp to the current month so this holds even when
  // today is early in the month.
  const recent = days.filter((d) => d >= CUR_MONTH_START).slice(-6);
  const driftApi = MOCK_APIS.find((a) => a.is_active === 1)!;

  // A deactivated catalog code that still carries traffic.
  await sql`
    INSERT INTO apis (product_code, name, log_aliases, category, entity_type, vendor_type, default_vendor, is_active)
    VALUES ('RV1099', 'Risk Score (legacy v1)', '["Risk Score (legacy v1)"]', 'Risk', 'individual', 'direct', ${driftApi.default_vendor}, 0)
    ON CONFLICT (product_code) DO NOTHING`;

  const scnRows: any[] = [];
  for (let i = 0; i < recent.length; i++) {
    const date = recent[i];
    const baseRow = { date, client_id: scn.id, raw_client_name: scn.name, hits_via: "Integration", vendor: driftApi.default_vendor, vendor_id: vendorId.get(driftApi.default_vendor)!, successful_no_data: 1, in_progress: 0, source: "log" as const };
    // 1. retired-with-usage: matched to an inactive code
    scnRows.push({ ...baseRow, api_code: "RV1099", raw_api_name: "Risk Score (legacy v1)", raw_api_code: "RV1099", successful: 42 + i, failed: 3 });
    // 2. unknown code: a Product Code not in the catalog
    scnRows.push({ ...baseRow, api_code: null, raw_api_name: "Sanctions Screening (beta)", raw_api_code: "SANC2", successful: 26 + i, failed: 2 });
    // 3. no code at all: blank Product Code, can't auto-match
    scnRows.push({ ...baseRow, api_code: null, raw_api_name: "Partner Webhook (uncoded)", raw_api_code: null, hits_via: "Webhook", successful: 14 + i, failed: 1 });
    // 4. name drift: matched code, but raw name differs from catalog name + aliases
    scnRows.push({ ...baseRow, api_code: driftApi.product_code, raw_api_name: `${driftApi.name} v2`, raw_api_code: driftApi.product_code, successful: 31 + i, failed: 2 });
  }
  await sql`INSERT INTO usage_daily ${sql(scnRows)}`;
  console.log(`  api-review scenario rows: ${scnRows.length}`);

  // ── alert scenarios ───────────────────────────────────────────────────────────
  // The alert engine evaluates the last three synced dates. Shape the recent
  // usage so each kind of alert has something to say:
  //   • Vertex Merchant Services sends nothing yesterday       → A1 (critical)
  //   • Helios Capital drops to 30% for two days                → A2d (high)
  //   • Orbit Cards spikes to 4× yesterday                     → A3 (medium)
  //   • Acme Lending Co starts a new API six days ago          → D2 (good news)
  const yday = shift(TODAY, -1);
  const clientNamed = (n: string) => clients.find((c) => c.name === n)!;
  await sql`DELETE FROM usage_daily WHERE client_id = ${clientNamed("Vertex Merchant Services").id} AND date = ${yday}`;
  await sql`
    UPDATE usage_daily
    SET successful = ROUND(successful * 0.3), successful_no_data = ROUND(successful_no_data * 0.3),
        failed = ROUND(failed * 0.3), in_progress = ROUND(in_progress * 0.3)
    WHERE client_id = ${clientNamed("Helios Capital").id} AND date IN (${shift(TODAY, -2)}, ${yday})`;
  await sql`
    UPDATE usage_daily
    SET successful = successful * 4, successful_no_data = successful_no_data * 4, failed = failed * 4
    WHERE client_id = ${clientNamed("Orbit Cards").id} AND date = ${yday}`;
  const growth = clientNamed("Acme Lending Co");
  const newApi = activeApis.find((a) => !growth.apis.some((x) => x.product_code === a.product_code) && a.category === "Fraud")!;
  await sql`
    INSERT INTO pricing (client_id, api_code, price_successful, price_successful_no_data, price_failed, price_in_progress, effective_from, pricing_model)
    VALUES (${growth.id}, ${newApi.product_code}, ${newApi.priceBand}, ${+(newApi.priceBand * 0.5).toFixed(2)}, 0, 0, ${shift(TODAY, -6)}, 'flat')`;
  const growthRows = dateRange(shift(TODAY, -6), TODAY).map((date, i) => ({
    date, client_id: growth.id, api_code: newApi.product_code, raw_client_name: growth.name,
    raw_api_name: newApi.name, raw_api_code: newApi.product_code, hits_via: "Integration",
    vendor: newApi.default_vendor, vendor_id: vendorId.get(newApi.default_vendor)!,
    successful: 160 + i * 25, successful_no_data: 8, failed: 6, in_progress: 0, source: "log" as const,
  }));
  await sql`INSERT INTO usage_daily ${sql(growthRows)}`;
  growth.apis.push(newApi);
  console.log(`  alert scenarios: silent, drop, spike, new API (${newApi.product_code} on ${growth.name})`);

  // ── unmapped account names (alias queue) ──────────────────────────────────────
  // Two names the sync could not map to an account: one with traffic, one that
  // only ever appeared with 0 hits. Current month only, like the API anomalies.
  const unmappedApi = activeApis[0];
  const unmappedRows = recent.map((date, i) => ({
    date, client_id: null, api_code: unmappedApi.product_code, raw_client_name: "Northwind Retail Desk",
    raw_api_name: unmappedApi.name, raw_api_code: unmappedApi.product_code, hits_via: "Integration",
    vendor: unmappedApi.default_vendor, vendor_id: vendorId.get(unmappedApi.default_vendor)!,
    successful: 18 + i, successful_no_data: 1, failed: 1, in_progress: 0, source: "log" as const,
  }));
  unmappedRows.push({
    ...unmappedRows[0], raw_client_name: "Orbit Cards UAT", successful: 0, successful_no_data: 0, failed: 0,
  });
  await sql`INSERT INTO usage_daily ${sql(unmappedRows)}`;
  console.log(`  unmapped account names: 2 (one with 0 hits)`);

  // ── sandbox classifications ───────────────────────────────────────────────────
  // Granular, effective-dated sandbox: a BILLABLE client is trialling one API,
  // so its usage for that pair shouldn't be billed. From effective_from onward,
  // the view's effective_is_sandbox diverges from the client's is_sandbox flag,
  // and that API drops out of headline revenue / margin / invoices.
  let sandboxRules = 0;
  const sbClient = bigClients[1] ?? bigClients[0];
  if (sbClient) {
    const sbApi =
      sbClient.apis.find((a) => !volumeModel.has(`${sbClient.id}:${a.product_code}`)) ?? sbClient.apis[0];
    if (sbApi) {
      await sql`
        INSERT INTO sandbox_classifications (client_id, api_code, effective_from, is_sandbox, note, created_by)
        VALUES (${sbClient.id}, ${sbApi.product_code}, ${addMonths(CUR_MONTH_START, -1)}, 1,
                ${"Trialling this API — exclude from billing until GA."}, ${ADMIN})
      `;
      sandboxRules++;
    }
  }
  console.log(`  sandbox_classifications: ${sandboxRules}`);

  // ── leak dismissals ───────────────────────────────────────────────────────────
  // Acknowledge the historical-leak pair set up above (priced only from this
  // month, so earlier usage was unpriced in the past). Dismissing it removes the
  // pair from every leak surface, while genuinely-unpriced (active) pairs stay.
  let dismissals = 0;
  if (histClient && histKey) {
    const histCode = histClient.apis[1].product_code;
    await sql`
      INSERT INTO leak_dismissals (client_id, api_code, dismissed_by, reason)
      VALUES (${histClient.id}, ${histCode}, ${ADMIN},
              ${"Acknowledged — legacy pre-contract usage; priced going forward."})
      ON CONFLICT (client_id, api_code) DO NOTHING
    `;
    dismissals++;
  }
  console.log(`  leak_dismissals: ${dismissals}`);

  // ── billing periods ───────────────────────────────────────────────────────────
  const periodId: number[] = [];
  for (const p of PERIODS) {
    const [row] = await sql`
      INSERT INTO billing_periods (label, start_date, end_date, status, closed_at, closed_by)
      VALUES (${monthLabel(p.start)}, ${p.start}, ${p.end}, ${p.closed ? "closed" : "open"},
              ${p.closed ? new Date().toISOString() : null}, ${p.closed ? ADMIN : null})
      RETURNING id
    `;
    periodId.push(Number(row.id));
  }
  console.log(`  billing_periods: ${periodId.length}`);

  // ── statements (reuse app finalize/issue for consistency) ─────────────────────
  const invoiceClients = clients.filter((c) => !c.sandbox);
  let finalized = 0, issued = 0;
  for (let pi = 0; pi < PERIODS.length; pi++) {
    const p = PERIODS[pi];
    if (p.invoice === "draft") continue; // current month stays a live draft
    for (let ci = 0; ci < invoiceClients.length; ci++) {
      const c = invoiceClients[ci];
      // Leave one client's prior-month invoice as a draft to show that state.
      if (p.invoice === "final" && ci === invoiceClients.length - 1) continue;
      try {
        await finalizeStatement(c.id, periodId[pi], ADMIN);
        finalized++;
        if (p.invoice === "issued") {
          await issueStatement(c.id, periodId[pi], ADMIN);
          issued++;
        }
      } catch (e: any) {
        // no billable activity in a period for a tiny client — fine, skip.
        if (!/no billable activity/.test(e?.message ?? "")) throw e;
      }
    }
  }
  console.log(`  statements finalized: ${finalized} (issued: ${issued})`);

  // ── one issued invoice gets an adjustment (credit note) ───────────────────────
  const [adjStmt] = await sql`SELECT client_id, period_id FROM statements WHERE status = 'issued' ORDER BY total_revenue DESC LIMIT 1`;
  if (adjStmt) {
    const [s] = await sql`SELECT id, number FROM statements WHERE client_id = ${adjStmt.client_id} AND period_id = ${adjStmt.period_id}`;
    await sql`
      INSERT INTO statement_adjustments (statement_id, label, amount, notes, created_by)
      VALUES (${Number(s.id)}, ${"Goodwill credit — SLA miss"}, ${-2500}, ${"Agreed with account manager"}, ${ADMIN})
    `;
    await recordAudit({ user_id: ADMIN, action: "invoice.adjustment.add", entity_type: "invoice_adjustment", entity_id: `${s.number}:adj`, after: { amount: -2500 } });
  }

  // ── manual entries (each state) ───────────────────────────────────────────────
  const meClient = invoiceClients[0];
  const meApi = meClient.apis[0];
  const meApi2 = meClient.apis[1] ?? meApi;
  const mkLines = (mult: number) => [
    { api_code: meApi.product_code, hits_via: "Bulk" as const, vendor: meApi.default_vendor, successful: 800 * mult, successful_no_data: 20, failed: 15, in_progress: 0 },
    { api_code: meApi2.product_code, hits_via: "Console" as const, vendor: meApi2.default_vendor, successful: 300 * mult, successful_no_data: 5, failed: 4, in_progress: 0 },
  ];
  // draft
  await createManualEntry(
    { client_id: meClient.id, effective_date: shift(TODAY, -3), reason: "Offline bulk run — not yet in logs", reference: "TICKET-4821", attachment_path: null, source: "manual", import_hash: null, lines: mkLines(1) },
    ADMIN
  );
  // pending approval
  const pend = await createManualEntry(
    { client_id: meClient.id, effective_date: shift(TODAY, -5), reason: "Reconciliation adjustment for missed hits", reference: "TICKET-4790", attachment_path: null, source: "manual", import_hash: null, lines: mkLines(2) },
    userId.get("ops@ledgerline.local")!
  );
  await submitManualEntry(pend.id, userId.get("ops@ledgerline.local")!);
  // approved
  const appr = await createManualEntry(
    { client_id: invoiceClients[1].id, effective_date: shift(TODAY, -8), reason: "Backfill for vendor outage window", reference: "TICKET-4655", attachment_path: null, source: "manual", import_hash: null, lines: [
      { api_code: invoiceClients[1].apis[0].product_code, hits_via: "Integration", vendor: invoiceClients[1].apis[0].default_vendor, successful: 1200, successful_no_data: 30, failed: 25, in_progress: 0 },
    ] },
    ADMIN
  );
  await submitManualEntry(appr.id, ADMIN);
  await approveManualEntry(appr.id, ADMIN);
  console.log(`  manual_entries: 3 (draft / pending / approved)`);

  // ── sync runs ─────────────────────────────────────────────────────────────────
  // One successful daily 'cron' run for every business date from the sync epoch
  // through yesterday, so the integration-status page reads "up to date" (it
  // measures gaps against SYNC_EPOCH = 2026-04-01). Today is intentionally not
  // synced yet — that's what the "Refresh now" button demonstrates.
  const syncDays = dateRange(RANGE_START, shift(TODAY, -1));
  let syncCount = 0;
  for (const d of syncDays) {
    const [agg] = await sql`SELECT COALESCE(SUM(successful+successful_no_data+failed+in_progress),0) AS hits, COUNT(*) AS rows FROM usage_daily WHERE date = ${d} AND source = 'log'`;
    const started = new Date(`${shift(d, 1)}T05:30:00+05:30`).toISOString(); // next-morning cron
    await sql`
      INSERT INTO sync_runs (trigger, target_date, status, rows_fetched, rows_inserted, rows_deleted, unmapped_clients, unmapped_apis, total_hits, started_at, finished_at)
      VALUES ('cron', ${d}, 'success', ${Number(agg.rows)}, ${Number(agg.rows)}, 0, 0, 0, ${Number(agg.hits)}, ${started}, ${started})
    `;
    syncCount++;
  }
  console.log(`  sync_runs: ${syncCount}`);

  // ── a few extra audit entries for a fuller trail ──────────────────────────────
  await recordAudit({ user_id: ADMIN, action: "pricing.update", entity_type: "pricing", entity_id: `${bigClients[0]?.id}:${bigClients[0]?.apis[0]?.product_code}`, before: { price_successful: 1.5 }, after: { price_successful: 1.65 } });
  await recordAudit({ user_id: ADMIN, action: "account.create", entity_type: "client", entity_id: String(clients[0].id), after: { display_name: clients[0].name } });
  await recordAudit({ user_id: userId.get("ops@ledgerline.local")!, action: "alias.resolve", entity_type: "alias", entity_id: "NORTHWND-FIN", after: { mapped_to: clients[0].name } });

  // ── app settings ──────────────────────────────────────────────────────────────
  // Roundup digest recipients, so the admin Settings section renders populated.
  // Actual email dispatch stays env-gated (no SMTP configured locally).
  const ROUNDUPS: Array<[string, string[]]> = [
    ["roundup.daily.recipients", ["admin@ledgerline.local"]],
    ["roundup.weekly.recipients", ["admin@ledgerline.local", "analyst@ledgerline.local"]],
    ["roundup.monthly.recipients", ["admin@ledgerline.local"]],
    // Weekly product update email and alert emails per group.
    ["product_update.usage.recipients", ["admin@ledgerline.local", "ops@ledgerline.local"]],
    ["alerts.volume.recipients", ["admin@ledgerline.local", "editor@ledgerline.local"]],
    ["alerts.failures.recipients", ["ops@ledgerline.local"]],
    ["alerts.revenue.recipients", ["admin@ledgerline.local"]],
    ["alerts.lifecycle.recipients", ["admin@ledgerline.local", "analyst@ledgerline.local"]],
    ["alerts.data.recipients", ["ops@ledgerline.local"]],
  ];
  for (const [key, emails] of ROUNDUPS) {
    await sql`
      INSERT INTO app_settings (key, value, updated_by)
      VALUES (${key}, ${JSON.stringify(emails)}, ${"admin@ledgerline.local"})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }
  console.log(`  app_settings: ${ROUNDUPS.length} keys`);

  // ── sandbox billing rules ─────────────────────────────────────────────────────
  // The sandbox client bills a capped slice of its traffic: the contract covers
  // the first 500 hits/day on one API while it trials the rest for free.
  let sandboxBillingRules = 0;
  const capClient = clients.find((c) => c.sandbox);
  if (capClient && capClient.apis[0]) {
    await sql`
      INSERT INTO sandbox_billing_rules (client_id, api_code, effective_from, billable_hits, note, created_by)
      VALUES (${capClient.id}, ${capClient.apis[0].product_code}, ${RANGE_START}, 500,
              ${"Pilot contract: first 500 hits/day billable, remainder free."}, ${"admin@ledgerline.local"})
    `;
    sandboxBillingRules++;
  }
  console.log(`  sandbox_billing_rules: ${sandboxBillingRules}`);

  // ── MSA fields ────────────────────────────────────────────────────────────────
  // Every billable account has an MSA except Pinnacle NBFC, so exactly one row
  // carries the "No MSA" flag on the accounts list.
  const msaClients = clients.filter((c) => !c.sandbox && c.name !== "Pinnacle NBFC");
  for (let i = 0; i < msaClients.length; i++) {
    const c = msaClients[i];
    await sql`
      UPDATE clients
      SET msa_url = ${`https://contracts.example.com/msa/${c.id}.pdf`},
          msa_start_date = ${"2025-10-01"},
          msa_end_date = ${i === 0 ? "2027-09-30" : null}
      WHERE id = ${c.id}
    `;
  }

  // ── slug history ──────────────────────────────────────────────────────────────
  // Mirror the migration's backfill (every current slug is recorded), plus one
  // legacy slug from a pre-rename era so the redirect layer is demonstrable.
  await sql`
    INSERT INTO client_slugs (client_id, slug)
    SELECT id, slug FROM clients WHERE slug IS NOT NULL
    ON CONFLICT DO NOTHING
  `;
  const renamed = clients[0];
  await sql`
    INSERT INTO client_slugs (client_id, slug)
    VALUES (${renamed.id}, ${generateSlug("Northwind Fincorp")})
    ON CONFLICT DO NOTHING
  `;
  console.log(`  client_slugs: backfilled + 1 legacy`);

  // ── account operations + notifications ───────────────────────────────────────
  const EDITOR = userId.get("editor@ledgerline.local")!;

  // 1. An executed, still-reversible delete: a duplicate account soft-deleted
  //    ten days ago. Restorable from the account page until the deadline.
  const dupSlug = generateSlug("Acme Lending Co (duplicate)");
  const [dup] = await sql`
    INSERT INTO clients (display_name, slug, log_aliases, billing_entity, status, is_sandbox,
                         deleted_at, deleted_by, deleted_reason)
    VALUES (${"Acme Lending Co (duplicate)"}, ${dupSlug}, ${JSON.stringify([])},
            ${"Acme Lending Private Limited"}, ${"paused"}, 0,
            NOW() - INTERVAL '10 days', ${ADMIN}, ${"Duplicate of Acme Lending Co — created twice during onboarding."})
    RETURNING id
  `;
  await sql`
    INSERT INTO client_operations (kind, status, source_client_id, requested_by, requested_at,
                                   decided_by, decided_at, executed_at, reverse_deadline, note)
    VALUES ('delete', 'executed', ${dup.id}, ${EDITOR}, NOW() - INTERVAL '11 days',
            ${ADMIN}, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days',
            NOW() + INTERVAL '20 days', ${"Duplicate of Acme Lending Co."})
  `;

  // 2. A merge request awaiting admin approval (shows in /admin/approvals).
  const mergeSrc = clients.find((c) => c.name === "Northwind Insurance Brokers");
  const mergeTgt = clients.find((c) => c.name === "Northwind Home Loans");
  if (mergeSrc && mergeTgt) {
    await sql`
      INSERT INTO client_operations (kind, status, source_client_id, target_client_id, requested_by, requested_at, note)
      VALUES ('merge', 'pending', ${mergeSrc.id}, ${mergeTgt.id}, ${EDITOR}, NOW() - INTERVAL '2 days',
              ${"Same signing entity since the Northwind restructure — usage should roll up together."})
    `;
  }

  // Notifications for the flows above plus routine product events.
  const notifRows = [
    { user_id: ADMIN, kind: "account_op.requested", title: "Merge requested: Northwind Insurance Brokers → Northwind Home Loans", body: "Dev Kapoor requested a merge. Review it in Approvals.", link: "/admin/approvals", entity_type: "client_operation", entity_id: "merge:northwind" },
    { user_id: EDITOR, kind: "account_op.approved", title: "Delete approved: Acme Lending Co (duplicate)", body: "Maya Sharma approved your delete request. Reversible for 20 more days.", link: `/accounts/${dupSlug}`, entity_type: "client_operation", entity_id: String(dup.id) },
    { user_id: ADMIN, kind: "sync.completed", title: "Usage sync complete", body: "Yesterday's usage synced from the log source.", link: "/admin/sync", entity_type: "sync_run", entity_id: "latest" },
  ];
  await sql`INSERT INTO notifications ${sql(notifRows, "user_id", "kind", "title", "body", "link", "entity_type", "entity_id")}`;
  console.log(`  client_operations: 2, notifications: ${notifRows.length}`);

  // ── vendor reconciliation ─────────────────────────────────────────────────────
  // The vendor side comes from the mock pull (lib/metabase-vendor.ts), which
  // derives it from usage_daily with a few deterministic gaps. Last month's
  // largest gap is dismissed with a reason, so the page shows all three states.
  // Through today: the demo seeds today's usage, so the vendor side covers it
  // too. Stopping at yesterday would show every pair a day short.
  const recon = await syncVendorUsage(RANGE_START, TODAY);
  const lastMonth = addMonths(CUR_MONTH_START, -1);
  const [gap] = (await sql`
    WITH v AS (
      SELECT vendor, api_code, SUM(successful + successful_no_data + failed) AS hits
      FROM vendor_usage_daily
      WHERE date >= ${lastMonth} AND date < ${CUR_MONTH_START} AND api_code IS NOT NULL
      GROUP BY vendor, api_code
    ), o AS (
      SELECT COALESCE(vend.canonical_name, u.vendor) AS vendor, u.api_code,
             SUM(u.successful + u.successful_no_data + u.failed) AS hits
      FROM usage_daily u LEFT JOIN vendors vend ON vend.id = u.vendor_id
      WHERE u.date >= ${lastMonth} AND u.date < ${CUR_MONTH_START} AND u.api_code IS NOT NULL
      GROUP BY 1, 2
    )
    SELECT v.vendor, v.api_code FROM v JOIN o USING (vendor, api_code)
    WHERE o.hits > 0 ORDER BY v.hits::float / o.hits DESC LIMIT 1`) as any[];
  if (gap) {
    await sql`
      INSERT INTO vendor_recon_dismissals (vendor, api_code, raw_api_name, period_month, dismissed_by, reason)
      VALUES (${gap.vendor}, ${gap.api_code}, NULL, ${lastMonth}, ${ADMIN},
              ${"Vendor counted retries as separate calls; credit note agreed."})`;
  }
  console.log(`  vendor_usage_daily: ${recon.rows_written} rows (${recon.unmatched_rows} unmatched), 1 dismissal`);

  // ── vendor minimum ────────────────────────────────────────────────────────────
  // Lumen ID has a monthly minimum set above what its traffic costs, so the
  // vendor page shows a shortfall for the month.
  const lumen = vendorId.get("Lumen ID")!;
  const [lumenHits] = await sql`
    SELECT COALESCE(SUM(successful + successful_no_data), 0)::int AS hits
    FROM usage_daily WHERE vendor_id = ${lumen} AND date >= ${lastMonth} AND date < ${CUR_MONTH_START}`;
  const minimum = Math.ceil((Number(lumenHits.hits) * 4) / 10000) * 10000;
  await sql`
    INSERT INTO vendor_commitments (vendor_id, effective_from, monthly_minimum, status, source)
    VALUES (${lumen}, ${"2026-01-01"}, ${minimum}, 'contracted', ${"Lumen ID MSA 2026, clause 4.2"})`;
  console.log(`  vendor_commitments: Lumen ID minimum ₹${minimum.toLocaleString("en-IN")}/month`);

  // ── alerts ────────────────────────────────────────────────────────────────────
  // The same engine the cron runs: it evaluates the last three synced dates and
  // posts one bell notification per date. Then one alert is acknowledged and
  // the oldest day's notifications are read, so the inbox shows both states.
  const alertRun = await runPendingAlerts({ trigger: "manual" });
  const [spike] = await sql`SELECT id FROM alerts WHERE rule = 'A3' ORDER BY id LIMIT 1`;
  if (spike) {
    await sql`UPDATE alerts SET acknowledged_at = NOW(), acknowledged_by = ${ADMIN} WHERE id = ${spike.id}`;
  }
  const firstDate = alertRun.evaluated[0]?.date;
  if (firstDate) {
    await sql`UPDATE notifications SET read_at = NOW() WHERE kind = 'alert.digest' AND entity_id = ${firstDate}`;
  }
  const [{ n: alertCount }] = await sql`SELECT COUNT(*)::int AS n FROM alerts`;
  console.log(`  alerts: ${alertCount} over ${alertRun.evaluated.length} dates (waiting: ${alertRun.waiting.join(", ") || "none"})`);

  console.log("seed complete ✓");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
