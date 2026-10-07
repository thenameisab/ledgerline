// Reversible account Merge & Delete.
//
// Mirrors the group-level mergeGroup transaction style (repos/accounts.ts)
// but is journaled and reversible. A merge re-points every client_id-keyed
// table (+ slug-keyed client_slugs) from source → target, folds the source's
// display_name + log_aliases into the target so the Metabase sync maps future
// rows to the target, and soft-deletes the source. A delete simply soft-deletes
// the account. Both write a client_operations row whose JSONB payload holds the
// replay journal needed to undo them until reverse_deadline; a cron purge then
// hard-deletes the source and makes the operation permanent.
//
// Collision policy on the unique-constrained tables:
//   pricing — every (api_code, effective_from) collision is surfaced in the
//     preview and resolved per-row by the operator (keep-target | keep-source).
//   all other unique tables — keep the target's row, drop (and journal) the
//     source's colliding row.
// Finalized/issued statements block the operation; the caller reverts them to
// draft inline (revertStatementToDraft) before executing.

// No "server-only" import: scripts/verify-account-merge.ts drives this from the
// CLI (same convention as usage-sync.ts). Routes remain the only app callers.
import getSql from "../db";
import { config } from "../config";
import { revalidateRevenue } from "../cache";

// JSONB can come back as text depending on driver context — normalize.
function parsePayload(row: any): any {
  if (row && typeof row.payload === "string") row.payload = JSON.parse(row.payload);
  return row;
}

// revalidateTag throws outside a Next request context (CLI verification).
function safeRevalidate() {
  try {
    revalidateRevenue();
  } catch {
    /* CLI context — nothing to revalidate */
  }
}

// ── Table map ────────────────────────────────────────────────────────────────
// client_id-keyed tables re-pointed on merge, with the account-scoped unique key
// that can collide. `null` conflict = free to re-point every row.
const ID_TABLES: { table: string; conflict: string[] | null; explicit?: boolean }[] = [
  { table: "pricing", conflict: ["api_code", "effective_from"], explicit: true },
  { table: "sandbox_classifications", conflict: ["api_code", "effective_from"] },
  { table: "statements", conflict: ["period_id"] },
  { table: "leak_dismissals", conflict: ["api_code"] },
  { table: "sandbox_billing_rules", conflict: ["api_code", "effective_from"] },
  { table: "manual_entries", conflict: null },
  { table: "usage_daily", conflict: null },
];

const FINALIZED_STATUSES = ["final", "issued"];

// ── Types ──────────────────────────────────────────────────────────────────
export type PricingCollision = {
  api_code: string;
  effective_from: string;
  source_price_successful: number;
  target_price_successful: number;
};

export type BlockingStatement = {
  id: number;
  number: string;
  status: string;
  period_label: string;
  total_revenue: number;
};

export type MergePreview = {
  source: { id: number; display_name: string };
  target: { id: number; display_name: string };
  revenueMoved: number;
  rowCounts: Record<string, number>;
  pricingCollisions: PricingCollision[];
  blockingStatements: BlockingStatement[];
  aliasesFolded: string[];
};

export type DeletePreview = {
  account: { id: number; display_name: string };
  rowCounts: Record<string, number>;
  revenue: number;
  blockingStatements: BlockingStatement[];
};

/** Per-row pricing resolution, keyed `${api_code}|${effective_from}`. */
export type PricingResolutions = Record<string, "target" | "source">;

export type AccountOperation = {
  id: number;
  kind: "merge" | "delete";
  status: "pending" | "rejected" | "executed" | "reversed" | "purged";
  source_client_id: number;
  target_client_id: number | null;
  requested_by: number;
  requested_at: string;
  decided_by: number | null;
  executed_at: string | null;
  reverse_deadline: string | null;
  note: string | null;
  payload: any;
};

// ── Small SQL helpers ────────────────────────────────────────────────────────
// `db` is either the pooled account or an open TransactionSql — typed `any` so
// both are accepted (postgres.js keeps them as distinct incompatible types).
type Db = any;

async function snapshot(tx: Db, table: string, where: any): Promise<any[]> {
  const rows = await tx`SELECT to_jsonb(t.*) AS row FROM ${tx(table)} t WHERE ${where}`;
  // JSONB may arrive as text depending on driver context — keep objects.
  return (rows as any[]).map((r) => (typeof r.row === "string" ? JSON.parse(r.row) : r.row));
}

async function restore(tx: Db, table: string, rows: any[]): Promise<void> {
  for (const raw of rows) {
    // postgres.js JSON-encodes a param cast to ::jsonb — pass the object, never
    // pre-stringified text (that double-encodes into a jsonb string scalar).
    const row = typeof raw === "string" ? JSON.parse(raw) : raw;
    await tx`
      INSERT INTO ${tx(table)}
      SELECT (jsonb_populate_record(NULL::${tx(table)}, ${row}::jsonb)).*
    `;
  }
}

/** `t.col IS NOT DISTINCT FROM s.col AND ...` — NULL-safe collision predicate. */
function conflictPredicate(tx: Db, cols: string[]): any {
  let cond = tx`TRUE`;
  for (const c of cols) cond = tx`${cond} AND t.${tx(c)} IS NOT DISTINCT FROM s.${tx(c)}`;
  return cond;
}

async function countRows(sql: Db, table: string, accountId: number): Promise<number> {
  const [r] = await sql`SELECT COUNT(*)::int AS n FROM ${sql(table)} WHERE client_id = ${accountId}`;
  return Number(r.n);
}

async function blockingStatements(sql: Db, accountId: number): Promise<BlockingStatement[]> {
  const rows = await sql`
    SELECT s.id, s.number, s.status, bp.label AS period_label, s.total_revenue
    FROM statements s JOIN billing_periods bp ON bp.id = s.period_id
    WHERE s.client_id = ${accountId} AND s.status = ANY(${FINALIZED_STATUSES})
    ORDER BY bp.start_date
  `;
  return (rows as any[]).map((r) => ({
    id: Number(r.id),
    number: r.number,
    status: r.status,
    period_label: r.period_label,
    total_revenue: Number(r.total_revenue),
  }));
}

async function windowRevenue(sql: Db, accountId: number): Promise<number> {
  const [r] = await sql`
    SELECT COALESCE(SUM(revenue), 0)::float8 AS rev
    FROM usage_daily_with_revenue WHERE client_id = ${accountId}
  `;
  return Number(r.rev);
}

// ── Previews ─────────────────────────────────────────────────────────────────
export async function previewAccountMerge(sourceId: number, targetId: number): Promise<MergePreview | null> {
  if (sourceId === targetId) return null;
  const sql = getSql();
  const [src] = await sql`SELECT id, display_name, log_aliases FROM clients WHERE id = ${sourceId} AND deleted_at IS NULL`;
  const [tgt] = await sql`SELECT id, display_name FROM clients WHERE id = ${targetId} AND deleted_at IS NULL`;
  if (!src || !tgt) return null;

  const rowCounts: Record<string, number> = {};
  for (const { table } of ID_TABLES) rowCounts[table] = await countRows(sql, table, sourceId);

  // Pricing collisions surfaced for per-row resolution.
  const collisionRows = await sql`
    SELECT s.api_code, s.effective_from,
           s.price_successful AS s_price, t.price_successful AS t_price
    FROM pricing s
    JOIN pricing t ON t.client_id = ${targetId}
      AND t.api_code = s.api_code AND t.effective_from = s.effective_from
    WHERE s.client_id = ${sourceId}
    ORDER BY s.api_code, s.effective_from
  `;
  const pricingCollisions: PricingCollision[] = (collisionRows as any[]).map((r) => ({
    api_code: r.api_code,
    effective_from: r.effective_from,
    source_price_successful: Number(r.s_price),
    target_price_successful: Number(r.t_price),
  }));

  const aliases: string[] = JSON.parse(src.log_aliases ?? "[]");
  return {
    source: { id: sourceId, display_name: src.display_name },
    target: { id: targetId, display_name: tgt.display_name },
    revenueMoved: await windowRevenue(sql, sourceId),
    rowCounts,
    pricingCollisions,
    blockingStatements: await blockingStatements(sql, sourceId),
    aliasesFolded: [src.display_name, ...aliases],
  };
}

export async function previewAccountDelete(id: number): Promise<DeletePreview | null> {
  const sql = getSql();
  const [c] = await sql`SELECT id, display_name FROM clients WHERE id = ${id} AND deleted_at IS NULL`;
  if (!c) return null;
  const rowCounts: Record<string, number> = {};
  for (const { table } of ID_TABLES) rowCounts[table] = await countRows(sql, table, id);
  return {
    account: { id, display_name: c.display_name },
    rowCounts,
    revenue: await windowRevenue(sql, id),
    blockingStatements: await blockingStatements(sql, id),
  };
}

// ── Execute merge ─────────────────────────────────────────────────────────────
export async function executeAccountMerge(opts: {
  sourceId: number;
  targetId: number;
  resolutions: PricingResolutions;
  actorId: number;
  opId?: number; // set when fulfilling a pending request
}): Promise<{ ok: true; opId: number } | { ok: false; error: string }> {
  const { sourceId, targetId, resolutions, actorId } = opts;
  if (sourceId === targetId) return { ok: false, error: "Cannot merge an account into itself." };
  const sql = getSql();
  let opId = opts.opId ?? 0;

  try {
    await sql.begin(async (tx) => {
      const [src] = await tx`SELECT id, display_name, log_aliases FROM clients WHERE id = ${sourceId} AND deleted_at IS NULL FOR UPDATE`;
      const [tgt] = await tx`SELECT id, display_name, log_aliases FROM clients WHERE id = ${targetId} AND deleted_at IS NULL FOR UPDATE`;
      if (!src || !tgt) throw new Error("source or target not found");

      const blocking = await blockingStatements(tx, sourceId);
      if (blocking.length > 0) throw new Error("BLOCKED_FINALIZED");

      const journal: any = {
        version: 1,
        sourceId,
        targetId,
        targetPrevLogAliases: tgt.log_aliases,
        moved: {},
        dropped: [] as { table: string; rows: any[] }[],
        deletedTarget: [] as { table: string; rows: any[] }[],
        slugPrevCurrent: {} as Record<string, boolean>,
      };

      // 1) id-keyed tables
      for (const { table, conflict, explicit } of ID_TABLES) {
        if (conflict) {
          const pred = conflictPredicate(tx, conflict);
          // Colliding source rows (a matching target row already exists).
          const collided: any[] = await tx`
            SELECT to_jsonb(s.*) AS row, s.id AS id FROM ${tx(table)} s
            WHERE s.client_id = ${sourceId}
              AND EXISTS (SELECT 1 FROM ${tx(table)} t WHERE t.client_id = ${targetId} AND ${pred})
          ` as any;

          const dropSrcIds: number[] = [];
          const delTgtRows: any[] = [];
          for (const c of collided) {
            const rowObj = typeof c.row === "string" ? JSON.parse(c.row) : c.row;
            const keep = explicit
              ? resolutions[`${rowObj.api_code}|${rowObj.effective_from}`] ?? "target"
              : "target";
            if (keep === "target") {
              dropSrcIds.push(Number(c.id));
              journal.dropped.push({ table, rows: [rowObj] });
            } else {
              // keep-source: remove the matching target row, keep (re-point) source.
              const tgtRows = await snapshot(
                tx,
                table,
                tx`t.client_id = ${targetId} AND EXISTS (SELECT 1 FROM ${tx(table)} s WHERE s.id = ${Number(c.id)} AND ${conflictPredicate(tx, conflict)})` as any
              );
              delTgtRows.push(...tgtRows);
              for (const tr of tgtRows) await tx`DELETE FROM ${tx(table)} WHERE id = ${tr.id}`;
            }
          }
          if (delTgtRows.length) journal.deletedTarget.push({ table, rows: delTgtRows });
          if (dropSrcIds.length) await tx`DELETE FROM ${tx(table)} WHERE id = ANY(${dropSrcIds})`;
        }
        // Re-point the survivors.
        const movedRows = await tx`SELECT id FROM ${tx(table)} WHERE client_id = ${sourceId}`;
        journal.moved[table] = (movedRows as any[]).map((r) => Number(r.id));
        await tx`UPDATE ${tx(table)} SET client_id = ${targetId} WHERE client_id = ${sourceId}`;
      }

      // 2) api_bundles (name collision → drop source bundle + its members/pricing)
      const bundleCollisions = await tx`
        SELECT s.id FROM api_bundles s
        WHERE s.client_id = ${sourceId}
          AND EXISTS (SELECT 1 FROM api_bundles t WHERE t.client_id = ${targetId} AND t.name = s.name)
      ` as any;
      for (const b of bundleCollisions) {
        const bid = Number(b.id);
        const bundleRow = await snapshot(tx, "api_bundles", tx`t.id = ${bid}` as any);
        const memberRows = await snapshot(tx, "api_bundle_members", tx`t.bundle_id = ${bid}` as any);
        const priceRows = await snapshot(tx, "bundle_pricing", tx`t.bundle_id = ${bid}` as any);
        journal.dropped.push({ table: "bundle_pricing", rows: priceRows });
        journal.dropped.push({ table: "api_bundle_members", rows: memberRows });
        journal.dropped.push({ table: "api_bundles", rows: bundleRow });
        await tx`DELETE FROM api_bundles WHERE id = ${bid}`; // cascades members + pricing
      }
      // Re-point surviving bundles + members.
      const movedBundles = await tx`SELECT id FROM api_bundles WHERE client_id = ${sourceId}`;
      journal.moved["api_bundles"] = (movedBundles as any[]).map((r) => Number(r.id));
      await tx`UPDATE api_bundles SET client_id = ${targetId} WHERE client_id = ${sourceId}`;
      // Member (api_code) collisions: keep target, drop source member.
      const memColl = await tx`
        SELECT to_jsonb(s.*) AS row FROM api_bundle_members s
        WHERE s.client_id = ${sourceId}
          AND EXISTS (SELECT 1 FROM api_bundle_members t WHERE t.client_id = ${targetId} AND t.api_code = s.api_code)
      ` as any;
      const droppedMembers = (memColl as any[]).map((r) => (typeof r.row === "string" ? JSON.parse(r.row) : r.row));
      if (droppedMembers.length) {
        journal.dropped.push({ table: "api_bundle_members", rows: droppedMembers });
        for (const m of droppedMembers) {
          await tx`DELETE FROM api_bundle_members WHERE bundle_id = ${m.bundle_id} AND api_code = ${m.api_code}`;
        }
      }
      const movedMembers = await tx`SELECT bundle_id, api_code FROM api_bundle_members WHERE client_id = ${sourceId}`;
      journal.moved["api_bundle_members"] = (movedMembers as any[]).map((r) => ({ bundle_id: Number(r.bundle_id), api_code: r.api_code }));
      await tx`UPDATE api_bundle_members SET client_id = ${targetId} WHERE client_id = ${sourceId}`;

      // 3) client_slugs — re-point, drop the moved slugs' is_current so target keeps its own.
      const slugRows = await tx`SELECT slug, is_current FROM client_slugs WHERE client_id = ${sourceId}`;
      for (const s of slugRows as any[]) journal.slugPrevCurrent[s.slug] = s.is_current;
      journal.moved["client_slugs"] = (slugRows as any[]).map((r) => r.slug);
      await tx`UPDATE client_slugs SET client_id = ${targetId}, is_current = FALSE WHERE client_id = ${sourceId}`;

      // 4) Fold display_name + aliases into target so sync maps future rows here.
      const srcAliases: string[] = JSON.parse(src.log_aliases ?? "[]");
      const tgtAliases: string[] = JSON.parse(tgt.log_aliases ?? "[]");
      const folded = Array.from(new Set([...tgtAliases, src.display_name, ...srcAliases]));
      await tx`UPDATE clients SET log_aliases = ${JSON.stringify(folded)} WHERE id = ${targetId}`;

      // 5) Soft-delete source.
      await tx`
        UPDATE clients SET deleted_at = NOW(), deleted_by = ${actorId}, merged_into = ${targetId}
        WHERE id = ${sourceId}
      `;

      // 6) Journal the operation.
      opId = await writeExecutedOp(tx, {
        kind: "merge",
        sourceId,
        targetId,
        actorId,
        payload: journal,
        opId: opts.opId,
      });
    });
  } catch (err: any) {
    if (err?.message === "BLOCKED_FINALIZED") {
      return { ok: false, error: "Source account has finalized invoices — revert them to draft first." };
    }
    throw err;
  }

  safeRevalidate();
  return { ok: true, opId };
}

// ── Execute delete ────────────────────────────────────────────────────────────
export async function executeAccountDelete(opts: {
  id: number;
  actorId: number;
  reason?: string;
  opId?: number;
}): Promise<{ ok: true; opId: number } | { ok: false; error: string }> {
  const { id, actorId, reason } = opts;
  const sql = getSql();
  let opId = opts.opId ?? 0;
  try {
    await sql.begin(async (tx) => {
      const [c] = await tx`SELECT id FROM clients WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`;
      if (!c) throw new Error("not found");
      const blocking = await blockingStatements(tx, id);
      if (blocking.length > 0) throw new Error("BLOCKED_FINALIZED");
      await tx`
        UPDATE clients SET deleted_at = NOW(), deleted_by = ${actorId}, deleted_reason = ${reason ?? null}
        WHERE id = ${id}
      `;
      opId = await writeExecutedOp(tx, { kind: "delete", sourceId: id, targetId: null, actorId, payload: { version: 1 }, opId: opts.opId });
    });
  } catch (err: any) {
    if (err?.message === "BLOCKED_FINALIZED") {
      return { ok: false, error: "Account has finalized invoices — revert them to draft first." };
    }
    if (err?.message === "not found") return { ok: false, error: "Account not found." };
    throw err;
  }
  safeRevalidate();
  return { ok: true, opId };
}

/** Insert (or update the pending row into) an executed client_operations record. */
async function writeExecutedOp(
  tx: Db,
  o: { kind: "merge" | "delete"; sourceId: number; targetId: number | null; actorId: number; payload: any; opId?: number }
): Promise<number> {
  const days = config.accountOps.undoDays;
  if (o.opId) {
    const [row] = await tx`
      UPDATE client_operations
      SET status = 'executed', decided_by = ${o.actorId}, decided_at = NOW(),
          executed_at = NOW(), reverse_deadline = NOW() + (${days} || ' days')::interval,
          payload = ${o.payload}::jsonb
      WHERE id = ${o.opId} RETURNING id
    `;
    return Number(row.id);
  }
  const [row] = await tx`
    INSERT INTO client_operations
      (kind, status, source_client_id, target_client_id, requested_by, decided_by, decided_at,
       executed_at, reverse_deadline, payload)
    VALUES
      (${o.kind}, 'executed', ${o.sourceId}, ${o.targetId}, ${o.actorId}, ${o.actorId}, NOW(),
       NOW(), NOW() + (${days} || ' days')::interval, ${o.payload}::jsonb)
    RETURNING id
  `;
  return Number(row.id);
}

// ── Reverse (undo) ────────────────────────────────────────────────────────────
export async function reverseAccountOperation(
  opId: number,
  actorId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = getSql();
  try {
    await sql.begin(async (tx) => {
      const [opRaw] = await tx`SELECT * FROM client_operations WHERE id = ${opId} FOR UPDATE` as any;
      const op = parsePayload(opRaw);
      if (!op) throw new Error("not found");
      if (op.status !== "executed") throw new Error("not undoable");
      if (op.reverse_deadline && new Date(op.reverse_deadline).getTime() < Date.now()) throw new Error("expired");

      if (op.kind === "delete") {
        await tx`UPDATE clients SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL WHERE id = ${op.source_client_id}`;
      } else {
        const j = op.payload;
        // Re-point survivors back to source.
        for (const table of Object.keys(j.moved)) {
          if (table === "api_bundle_members") {
            const pairs = j.moved[table] as { bundle_id: number; api_code: string }[];
            if (pairs.length) {
              await tx`
                UPDATE api_bundle_members m SET client_id = ${op.source_client_id}
                FROM jsonb_to_recordset(${tx.json(pairs)}) AS v(bundle_id bigint, api_code text)
                WHERE m.bundle_id = v.bundle_id AND m.api_code = v.api_code
              `;
            }
          } else if (table === "client_slugs") {
            const slugs = j.moved[table] as string[];
            for (const slug of slugs) {
              await tx`UPDATE client_slugs SET client_id = ${op.source_client_id}, is_current = ${j.slugPrevCurrent?.[slug] ?? false} WHERE slug = ${slug}`;
            }
          } else {
            const ids = (j.moved[table] as number[]) ?? [];
            if (ids.length) await tx`UPDATE ${tx(table)} SET client_id = ${op.source_client_id} WHERE id = ANY(${ids})`;
          }
        }
        // Re-insert target rows we deleted for keep-source resolutions.
        for (const d of j.deletedTarget ?? []) await restore(tx, d.table, d.rows);
        // Re-insert source rows we dropped for keep-target collisions.
        for (const d of j.dropped ?? []) await restore(tx, d.table, d.rows);
        // Restore the target's aliases and un-delete the source.
        await tx`UPDATE clients SET log_aliases = ${j.targetPrevLogAliases} WHERE id = ${op.target_client_id}`;
        await tx`UPDATE clients SET deleted_at = NULL, deleted_by = NULL, merged_into = NULL WHERE id = ${op.source_client_id}`;
      }

      await tx`UPDATE client_operations SET status = 'reversed', reversed_at = NOW() WHERE id = ${opId}`;
    });
  } catch (err: any) {
    const m = err?.message;
    if (m === "not found") return { ok: false, error: "Operation not found." };
    if (m === "not undoable") return { ok: false, error: "This operation can no longer be undone." };
    if (m === "expired") return { ok: false, error: "The undo window for this operation has passed." };
    throw err;
  }
  safeRevalidate();
  return { ok: true };
}

// ── Cron purge ────────────────────────────────────────────────────────────────
/** Hard-delete sources whose undo window has passed; mark those operations permanent. */
export async function purgeExpiredAccountOperations(): Promise<{ purged: number }> {
  const sql = getSql();
  const due = await sql`
    SELECT id, source_client_id FROM client_operations
    WHERE status = 'executed' AND reverse_deadline < NOW()
    ORDER BY reverse_deadline
  ` as any;
  let purged = 0;
  for (const op of due) {
    await sql.begin(async (tx) => {
      // Any rows still pointing at the source (e.g. a delete never re-pointed
      // its usage) are ON DELETE CASCADE/SET NULL by their FKs, so dropping the
      // account row is safe.
      await tx`DELETE FROM client_slugs WHERE client_id = ${op.source_client_id}`;
      await tx`DELETE FROM clients WHERE id = ${op.source_client_id}`;
      await tx`UPDATE client_operations SET status = 'purged' WHERE id = ${op.id}`;
    });
    purged++;
  }
  return { purged };
}

// ── Operation records + request lifecycle ──────────────────────────────────────
export async function createPendingOperation(o: {
  kind: "merge" | "delete";
  sourceId: number;
  targetId: number | null;
  requestedBy: number;
  note?: string;
  resolutions?: PricingResolutions;
}): Promise<number> {
  const sql = getSql();
  const [row] = await sql`
    INSERT INTO client_operations (kind, status, source_client_id, target_client_id, requested_by, note, payload)
    VALUES (${o.kind}, 'pending', ${o.sourceId}, ${o.targetId}, ${o.requestedBy}, ${o.note ?? null},
            ${sql.json({ resolutions: o.resolutions ?? {} })})
    RETURNING id
  `;
  return Number(row.id);
}

export async function getAccountOperation(opId: number): Promise<AccountOperation | null> {
  const sql = getSql();
  const [row] = await sql`SELECT * FROM client_operations WHERE id = ${opId}` as any;
  return row ? (parsePayload(row) as AccountOperation) : null;
}

export async function rejectAccountOperation(opId: number, actorId: number): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    UPDATE client_operations SET status = 'rejected', decided_by = ${actorId}, decided_at = NOW()
    WHERE id = ${opId} AND status = 'pending' RETURNING id
  `;
  return (rows as any[]).length > 0;
}

export type PendingOpRow = AccountOperation & {
  source_name: string;
  target_name: string | null;
  requester_name: string;
  requester_email: string;
};

export async function listPendingAccountOperations(): Promise<PendingOpRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT o.*, sc.display_name AS source_name, tc.display_name AS target_name,
           u.display_name AS requester_name, u.email AS requester_email
    FROM client_operations o
    JOIN clients sc ON sc.id = o.source_client_id
    LEFT JOIN clients tc ON tc.id = o.target_client_id
    JOIN users u ON u.id = o.requested_by
    WHERE o.status = 'pending'
    ORDER BY o.requested_at
  `;
  return (rows as any[]).map(parsePayload) as PendingOpRow[];
}

/** The active, still-undoable operation for a soft-deleted account (drives the undo banner). */
export async function getUndoableOpForSource(sourceId: number): Promise<AccountOperation | null> {
  const sql = getSql();
  const [row] = await sql`
    SELECT * FROM client_operations
    WHERE source_client_id = ${sourceId} AND status = 'executed'
    ORDER BY executed_at DESC LIMIT 1
  ` as any;
  return row ? (parsePayload(row) as AccountOperation) : null;
}

/** Active (non-deleted) accounts other than `exceptId` — the merge target picker. */
export async function listMergeTargets(exceptId: number): Promise<{ id: number; display_name: string }[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, display_name FROM clients
    WHERE deleted_at IS NULL AND id <> ${exceptId}
    ORDER BY display_name
  `;
  return (rows as any[]).map((r) => ({ id: Number(r.id), display_name: r.display_name }));
}
