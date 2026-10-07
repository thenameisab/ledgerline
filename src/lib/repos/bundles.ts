import getSql from "../db";
import { isBilledPair } from "./statements";
import { toNumber } from "../money";

export type BundleMember = {
  api_code: string;
  api_name: string;
};

export type AccountBundle = {
  id: number;
  name: string;
  anchor_api_code: string;
  members: BundleMember[];
  price_successful: number;
  price_successful_no_data: number;
  price_failed: number;
  price_in_progress: number;
  effective_from: string;
  /** Anchor pair appears on a finalized invoice — price edits supersede, unstitch is locked. */
  billed: boolean;
};

export async function getAccountBundles(accountId: number): Promise<AccountBundle[]> {
  const sql = getSql();

  const bundles = await sql`
    SELECT DISTINCT ON (b.id)
      b.id, b.name, b.anchor_api_code,
      bp.price_successful, bp.price_successful_no_data,
      bp.price_failed, bp.price_in_progress,
      bp.effective_from
    FROM api_bundles b
    JOIN bundle_pricing bp ON bp.bundle_id = b.id
    WHERE b.client_id = ${accountId}
    ORDER BY b.id, bp.effective_from DESC
  `;
  if ((bundles as any[]).length === 0) return [];

  const members = await sql`
    SELECT bm.bundle_id, bm.api_code, COALESCE(a.name, bm.api_code) AS api_name
    FROM api_bundle_members bm
    LEFT JOIN apis a ON a.product_code = bm.api_code
    WHERE bm.client_id = ${accountId}
    ORDER BY bm.api_code
  `;
  const membersByBundle = new Map<number, BundleMember[]>();
  for (const m of members as any[]) {
    const bid = Number(m.bundle_id);
    if (!membersByBundle.has(bid)) membersByBundle.set(bid, []);
    membersByBundle.get(bid)!.push({ api_code: m.api_code, api_name: m.api_name });
  }

  const billedFlags = await Promise.all(
    (bundles as any[]).map((b) => isBilledPair(accountId, b.anchor_api_code))
  );

  return (bundles as any[]).map((b, i) => ({
    id: Number(b.id),
    name: b.name as string,
    anchor_api_code: b.anchor_api_code as string,
    members: membersByBundle.get(Number(b.id)) ?? [],
    price_successful: toNumber(b.price_successful),
    price_successful_no_data: toNumber(b.price_successful_no_data),
    price_failed: toNumber(b.price_failed),
    price_in_progress: toNumber(b.price_in_progress),
    effective_from: b.effective_from as string,
    billed: billedFlags[i],
  }));
}

/** API codes already stitched into a bundle for this account. */
export async function getBundledApiCodes(accountId: number): Promise<Set<string>> {
  const sql = getSql();
  const rows = await sql`
    SELECT api_code FROM api_bundle_members WHERE client_id = ${accountId}
  `;
  return new Set((rows as any[]).map((r) => r.api_code as string));
}
