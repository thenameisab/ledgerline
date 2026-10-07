"use server";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/access";
import {
  finalizeStatement,
  issueStatement,
  addStatementAdjustment,
  removeStatementAdjustment,
  StatementError,
} from "@/lib/repos/statements";

export type InvoiceActionResult =
  | { ok: true; number: string }
  | { ok: false; error: string; code?: string };

export async function finalizeInvoice(
  accountId: number,
  accountSlug: string,
  periodId: number
): Promise<InvoiceActionResult> {
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) return guard;
  try {
    const result = await finalizeStatement(accountId, periodId, guard.user.id);
    revalidatePath(`/accounts/${accountSlug}/invoices`);
    revalidatePath(`/accounts/${accountSlug}/invoices/${periodId}`);
    return { ok: true, number: result.header.number };
  } catch (e) {
    if (e instanceof StatementError) return { ok: false, error: e.message, code: e.code };
    return { ok: false, error: (e as Error).message };
  }
}

export async function issueInvoice(
  accountId: number,
  accountSlug: string,
  periodId: number
): Promise<InvoiceActionResult> {
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) return guard;
  try {
    const result = await issueStatement(accountId, periodId, guard.user.id);
    revalidatePath(`/accounts/${accountSlug}/invoices`);
    revalidatePath(`/accounts/${accountSlug}/invoices/${periodId}`);
    return { ok: true, number: result.header.number };
  } catch (e) {
    if (e instanceof StatementError) return { ok: false, error: e.message, code: e.code };
    return { ok: false, error: (e as Error).message };
  }
}

export type AdjustmentActionResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export async function addInvoiceAdjustment(
  accountId: number,
  accountSlug: string,
  periodId: number,
  input: { label: string; amount: number; notes?: string | null }
): Promise<AdjustmentActionResult> {
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) return guard;
  try {
    await addStatementAdjustment(accountId, periodId, guard.user.id, input);
    revalidatePath(`/accounts/${accountSlug}/invoices`);
    revalidatePath(`/accounts/${accountSlug}/invoices/${periodId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof StatementError) return { ok: false, error: e.message, code: e.code };
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeInvoiceAdjustment(
  accountId: number,
  accountSlug: string,
  periodId: number,
  adjustmentId: number
): Promise<AdjustmentActionResult> {
  const guard = await guardAction("pricing.edit");
  if (!guard.ok) return guard;
  try {
    await removeStatementAdjustment(adjustmentId, guard.user.id);
    revalidatePath(`/accounts/${accountSlug}/invoices`);
    revalidatePath(`/accounts/${accountSlug}/invoices/${periodId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof StatementError) return { ok: false, error: e.message, code: e.code };
    return { ok: false, error: (e as Error).message };
  }
}
