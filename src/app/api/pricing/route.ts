import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import getSql from "@/lib/db";
import { guardAction } from "@/lib/access";
import { recordAudit } from "@/lib/repos/audit";
import { isBilledPair } from "@/lib/repos/statements";
import { toMoney, toDbNumeric, toNumber } from "@/lib/money";
import { assertSameOrigin } from "@/lib/http";
import { revalidateRevenue } from "@/lib/cache";

const PriceSchema = z.object({
  client_id: z.number().int().positive(),
  api_code: z.string().min(1),
  price_successful: z.number().nonnegative().optional(),
  price_successful_no_data: z.number().nonnegative().optional(),
  price_failed: z.number().nonnegative().optional(),
  price_in_progress: z.number().nonnegative().optional(),
});

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }
  const user = guard.user;

  const parsed = PriceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  // The whole read-check-write runs inside a transaction with FOR UPDATE
  // on the latest pricing row for this (account, api). Two concurrent
  // pricing edits serialize on that lock; a concurrent finalize is
  // serialized via the statement_lines insert path. The old code did the
  // billed-check and the write as separate statements, so a finalize that
  // ran between them could end up with an in-place UPDATE on a row that
  // was suddenly behind a finalized invoice.
  type Outcome = "update_unbilled" | "supersede" | "no_change" | "insert_new";
  let billed = false;
  // Wrap in an object so TS doesn't narrow the literal across the closure
  // boundary. (Plain `let outcome: Outcome = "insert_new"` gets narrowed
  // to "insert_new" at the post-await comparison sites.)
  const state: { outcome: Outcome } = { outcome: "insert_new" };
  const setOutcome = (o: Outcome) => { state.outcome = o; };
  let beforeForAudit: Record<string, unknown> | null = null;
  let mergedM!: {
    price_successful: import("decimal.js-light").default;
    price_successful_no_data: import("decimal.js-light").default;
    price_failed: import("decimal.js-light").default;
    price_in_progress: import("decimal.js-light").default;
  };
  let merged!: { price_successful: number; price_successful_no_data: number; price_failed: number; price_in_progress: number };

  await sql.begin(async (tx) => {
    const [existing] = await tx`
      SELECT * FROM pricing
      WHERE client_id = ${body.client_id} AND api_code = ${body.api_code}
      ORDER BY effective_from DESC LIMIT 1
      FOR UPDATE
    `;
    const e = existing as any;

    mergedM = {
      price_successful: body.price_successful != null ? toMoney(body.price_successful) : toMoney(e?.price_successful),
      price_successful_no_data: body.price_successful_no_data != null ? toMoney(body.price_successful_no_data) : toMoney(e?.price_successful_no_data),
      price_failed: body.price_failed != null ? toMoney(body.price_failed) : toMoney(e?.price_failed),
      price_in_progress: body.price_in_progress != null ? toMoney(body.price_in_progress) : toMoney(e?.price_in_progress),
    };
    merged = {
      price_successful: toNumber(mergedM.price_successful),
      price_successful_no_data: toNumber(mergedM.price_successful_no_data),
      price_failed: toNumber(mergedM.price_failed),
      price_in_progress: toNumber(mergedM.price_in_progress),
    };

    billed = await isBilledPair(body.client_id, body.api_code);

    const dbVals = {
      price_successful: toDbNumeric(mergedM.price_successful),
      price_successful_no_data: toDbNumeric(mergedM.price_successful_no_data),
      price_failed: toDbNumeric(mergedM.price_failed),
      price_in_progress: toDbNumeric(mergedM.price_in_progress),
    };

    if (existing && !billed) {
      await tx`
        UPDATE pricing
        SET price_successful = ${dbVals.price_successful},
            price_successful_no_data = ${dbVals.price_successful_no_data},
            price_failed = ${dbVals.price_failed},
            price_in_progress = ${dbVals.price_in_progress}
        WHERE id = ${e.id}
      `;
      setOutcome("update_unbilled");
      beforeForAudit = {
        price_successful: toNumber(e.price_successful),
        price_successful_no_data: toNumber(e.price_successful_no_data),
        price_failed: toNumber(e.price_failed),
        price_in_progress: toNumber(e.price_in_progress),
        effective_from: e.effective_from,
      };
    } else if (existing && billed) {
      const same =
        toMoney(e.price_successful).eq(mergedM.price_successful) &&
        toMoney(e.price_successful_no_data).eq(mergedM.price_successful_no_data) &&
        toMoney(e.price_failed).eq(mergedM.price_failed) &&
        toMoney(e.price_in_progress).eq(mergedM.price_in_progress);
      if (same) {
        setOutcome("no_change");
        return;
      }
      const [todaysRow] = await tx`
        SELECT id FROM pricing
        WHERE client_id = ${body.client_id} AND api_code = ${body.api_code} AND effective_from = ${today}
        FOR UPDATE
      `;
      if (todaysRow) {
        await tx`
          UPDATE pricing
          SET price_successful = ${dbVals.price_successful},
              price_successful_no_data = ${dbVals.price_successful_no_data},
              price_failed = ${dbVals.price_failed},
              price_in_progress = ${dbVals.price_in_progress}
          WHERE id = ${(todaysRow as any).id}
        `;
      } else {
        await tx`
          INSERT INTO pricing
            (client_id, api_code, price_successful, price_successful_no_data, price_failed, price_in_progress, effective_from)
          VALUES (
            ${body.client_id}, ${body.api_code},
            ${dbVals.price_successful}, ${dbVals.price_successful_no_data},
            ${dbVals.price_failed}, ${dbVals.price_in_progress},
            ${today}
          )
        `;
      }
      setOutcome("supersede");
      beforeForAudit = {
        price_successful: toNumber(e.price_successful),
        price_successful_no_data: toNumber(e.price_successful_no_data),
        price_failed: toNumber(e.price_failed),
        price_in_progress: toNumber(e.price_in_progress),
        effective_from: e.effective_from,
      };
    } else {
      await tx`
        INSERT INTO pricing
          (client_id, api_code, price_successful, price_successful_no_data, price_failed, price_in_progress, effective_from)
        VALUES (
          ${body.client_id}, ${body.api_code},
          ${dbVals.price_successful}, ${dbVals.price_successful_no_data},
          ${dbVals.price_failed}, ${dbVals.price_in_progress},
          ${today}
        )
      `;
      setOutcome("insert_new");
    }
  });

  if (state.outcome === "no_change") {
    return NextResponse.json({ ok: true, ...merged, billed: true, superseded: false });
  }

  // Audit + revalidate live outside the transaction; the write succeeded
  // already and failures here shouldn't roll back the pricing change.
  if (state.outcome === "update_unbilled") {
    await recordAudit({
      user_id: user.id,
      action: "pricing.update",
      entity_type: "pricing",
      entity_id: `${body.client_id}:${body.api_code}`,
      before: beforeForAudit,
      after: merged,
    });
  } else if (state.outcome === "supersede") {
    await recordAudit({
      user_id: user.id,
      action: "pricing.supersede",
      entity_type: "pricing",
      entity_id: `${body.client_id}:${body.api_code}`,
      before: beforeForAudit,
      after: { ...merged, effective_from: today, reason: "pair_is_billed" },
    });
  } else {
    await recordAudit({
      user_id: user.id,
      action: "pricing.update",
      entity_type: "pricing",
      entity_id: `${body.client_id}:${body.api_code}`,
      before: null,
      after: merged,
    });
  }

  // Revalidate the account profile using slug
  const [accountRow] = await sql`SELECT slug FROM clients WHERE id = ${body.client_id}`;
  const accountSlug = (accountRow as any)?.slug ?? String(body.client_id);
  revalidatePath(`/accounts/${accountSlug}`);
  revalidateRevenue();
  return NextResponse.json({ ok: true, ...merged, billed, superseded: billed });
}

const DeleteSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  api_code: z.string().min(1),
});

export async function DELETE(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.code === "unauthenticated" ? 401 : 403 });
  }
  const user = guard.user;
  const { searchParams } = new URL(req.url);
  const parsed = DeleteSchema.safeParse({
    client_id: searchParams.get("client_id"),
    api_code: searchParams.get("api_code"),
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const { client_id, api_code } = parsed.data;

  if (await isBilledPair(client_id, api_code)) {
    return NextResponse.json(
      { ok: false, error: "this (account, api) pair has been billed on a finalized invoice — pricing history is locked" },
      { status: 409 }
    );
  }

  const sql = getSql();
  const [before] = await sql`SELECT * FROM pricing WHERE client_id = ${client_id} AND api_code = ${api_code}`;
  await sql`DELETE FROM pricing WHERE client_id = ${client_id} AND api_code = ${api_code}`;
  await recordAudit({
    user_id: user.id,
    action: "pricing.delete",
    entity_type: "pricing",
    entity_id: `${client_id}:${api_code}`,
    before,
    after: null,
  });
  revalidateRevenue();
  return NextResponse.json({ ok: true });
}
