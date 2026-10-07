import type postgres from "postgres";
import getSql from "./db";

/**
 * A plain connection or a transaction. `sql.begin` hands back a
 * `TransactionSql`, and a created vendor must be able to commit with the
 * usage that referenced it, so both have to be acceptable here.
 */
type Db = postgres.Sql | postgres.TransactionSql;

/**
 * The vendor registry.
 *
 * This replaces `vendor-names.ts`, which held one hardcoded array of the
 * sixteen spellings seen up to the day someone last edited it. Matching against
 * a constant works exactly until a vendor is renamed upstream: the new name
 * matches nothing, passes through untouched, and quietly becomes a second
 * vendor whose traffic no longer finds the rate rows filed under the old name.
 *
 * So a name now resolves against `vendor_aliases`, and an unrecognised one
 * creates a vendor rather than being bent onto the wrong name or dropped. A
 * vendor's own canonical name is one of its aliases, so resolution is one
 * index probe on one table.
 *
 * `resolveVendors` takes a whole batch because the two sync paths hold every
 * name in the pull before they write any of it: one query resolves the lot.
 */

export type VendorRef = { id: number; name: string };

/** Case-insensitive, whitespace-insensitive. The same key the unique indexes use. */
const key = (raw: string | null | undefined): string => (raw ?? "").trim().toLowerCase();

export type VendorLookup = {
  /** The vendor this spelling means, or null for a blank name. */
  get(raw: string | null | undefined): VendorRef | null;
};

function lookupOf(map: Map<string, VendorRef>): VendorLookup {
  return {
    get(raw) {
      const k = key(raw);
      return k ? (map.get(k) ?? null) : null;
    },
  };
}

/**
 * Resolve a batch of raw vendor names, creating a vendor for any never seen.
 *
 * Auto-creation mirrors how unmapped accounts and APIs are handled: the row
 * lands, attributed to something nameable, and shows up unrated so somebody
 * can price it. Refusing the row instead would lose usage; bending it onto the
 * nearest known name would lose the truth.
 *
 * Pass the transaction when writing inside one, so a created vendor and the
 * usage that referenced it commit together.
 */
export async function resolveVendors(
  sql: Db,
  raws: (string | null | undefined)[],
): Promise<VendorLookup> {
  // Keep the first spelling seen for each key — it is what a newly created
  // vendor gets called.
  const wanted = new Map<string, string>();
  for (const raw of raws) {
    const k = key(raw);
    if (k && !wanted.has(k)) wanted.set(k, (raw as string).trim());
  }
  const found = new Map<string, VendorRef>();
  if (wanted.size === 0) return lookupOf(found);

  const rows = await sql<{ k: string; id: string; canonical_name: string }[]>`
    SELECT lower(a.alias) AS k, v.id, v.canonical_name
    FROM vendor_aliases a
    JOIN vendors v ON v.id = a.vendor_id
    WHERE lower(a.alias) = ANY(${[...wanted.keys()]})
  `;
  for (const r of rows) found.set(r.k, { id: Number(r.id), name: r.canonical_name });

  for (const [k, spelling] of wanted) {
    if (found.has(k)) continue;
    // DO UPDATE rather than DO NOTHING so the row comes back either way: a
    // concurrent sync may have created this vendor between the read above and
    // this insert.
    const [v] = await sql<{ id: string; canonical_name: string }[]>`
      INSERT INTO vendors (canonical_name) VALUES (${spelling})
      ON CONFLICT (lower(canonical_name))
        DO UPDATE SET canonical_name = vendors.canonical_name
      RETURNING id, canonical_name
    `;
    await sql`
      INSERT INTO vendor_aliases (vendor_id, alias) VALUES (${v.id}, ${spelling})
      ON CONFLICT DO NOTHING
    `;
    found.set(k, { id: Number(v.id), name: v.canonical_name });
  }
  return lookupOf(found);
}

/** Resolve one name, creating the vendor if it is new. Null for a blank name. */
export async function resolveVendor(
  sql: Db,
  raw: string | null | undefined,
): Promise<VendorRef | null> {
  if (!key(raw)) return null;
  return (await resolveVendors(sql, [raw])).get(raw);
}

/**
 * The vendor a name or alias refers to, without creating anything.
 *
 * Read-only, for resolving a name that arrived from a URL or a request body.
 * A caller that means to record new traffic wants `resolveVendors`.
 */
export async function findVendor(raw: string | null | undefined): Promise<VendorRef | null> {
  if (!key(raw)) return null;
  const sql = getSql();
  const [row] = await sql<{ id: string; canonical_name: string }[]>`
    SELECT v.id, v.canonical_name
    FROM vendor_aliases a
    JOIN vendors v ON v.id = a.vendor_id
    WHERE lower(a.alias) = ${key(raw)}
  `;
  return row ? { id: Number(row.id), name: row.canonical_name } : null;
}

export type VendorRecord = {
  id: number;
  canonical_name: string;
  status: "active" | "inactive";
  /** Does this vendor invoice us for sandbox calls? */
  charges_sandbox: boolean;
  /** Every other spelling that resolves here. The canonical name is excluded. */
  aliases: string[];
};

/** One vendor's registry entry, by id. */
export async function vendorRecord(id: number): Promise<VendorRecord | null> {
  const sql = getSql();
  const [row] = await sql<
    {
      id: string;
      canonical_name: string;
      status: string;
      charges_sandbox: boolean;
      aliases: string[] | null;
    }[]
  >`
    SELECT v.id, v.canonical_name, v.status, v.charges_sandbox,
           ARRAY(
             SELECT a.alias FROM vendor_aliases a
             WHERE a.vendor_id = v.id AND lower(a.alias) <> lower(v.canonical_name)
             ORDER BY a.alias
           ) AS aliases
    FROM vendors v WHERE v.id = ${id}
  `;
  if (!row) return null;
  return {
    id: Number(row.id),
    canonical_name: row.canonical_name,
    status: row.status === "inactive" ? "inactive" : "active",
    charges_sandbox: row.charges_sandbox !== false,
    aliases: row.aliases ?? [],
  };
}
