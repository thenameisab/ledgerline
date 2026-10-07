"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/access";
import { revalidateRevenue } from "@/lib/cache";
import { recordAudit } from "@/lib/repos/audit";
import {
  getAccountBySlug,
  updateAccountProfile,
  AccountConflictError,
} from "@/lib/repos/accounts";
import { CS_TEAM, SALES_TEAM } from "@/lib/team";

// Empty strings from the form collapse to NULL so a cleared field clears the column.
const blankToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const ProfileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Account name is required.")
    .max(200, "Account name is too long."),
  client_code: z.preprocess(
    blankToNull,
    z
      .string()
      .max(64, "Account ID is too long.")
      .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dot, dash only.")
      .nullable()
  ),
  // "Legal name" reuses the billing_entity column.
  billing_entity: z.preprocess(blankToNull, z.string().max(500).nullable()),
  website: z.preprocess(
    blankToNull,
    z.string().max(300, "Website URL is too long.").nullable()
  ),
  cs_owner: z.preprocess(blankToNull, z.enum(CS_TEAM).nullable()),
  sales_owner: z.preprocess(blankToNull, z.enum(SALES_TEAM).nullable()),
  logo_data_url: z.preprocess(
    blankToNull,
    z
      .string()
      .regex(/^data:image\/(png|webp|jpeg);base64,/, "Unsupported image format.")
      .max(500_000, "Logo is too large — try a smaller image.")
      .nullable()
  ),
  msa_url: z.preprocess(
    blankToNull,
    z.string().url("Enter a valid URL.").max(500, "URL is too long.").nullable()
  ),
  msa_start_date: z.preprocess(
    blankToNull,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").nullable()
  ),
  msa_end_date: z.preprocess(
    blankToNull,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").nullable()
  ),
}).superRefine((val, ctx) => {
  if (val.msa_start_date && val.msa_end_date && val.msa_end_date < val.msa_start_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["msa_end_date"],
      message: "End date can't be before the start date.",
    });
  }
});

export type ProfileInput = z.input<typeof ProfileSchema>;

export type SaveProfileResult =
  | { ok: true; slug: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function saveAccountProfile(
  slug: string,
  input: ProfileInput
): Promise<SaveProfileResult> {
  const guard = await guardAction("account.update");
  if (!guard.ok) {
    return { ok: false, error: guard.error };
  }

  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const account = await getAccountBySlug(slug);
  if (!account) return { ok: false, error: "Account not found." };

  const id = Number(account.id);
  const fields = parsed.data;

  let newSlug: string;
  try {
    ({ slug: newSlug } = await updateAccountProfile(id, fields));
  } catch (err) {
    if (err instanceof AccountConflictError) {
      return {
        ok: false,
        fieldErrors:
          err.field === "display_name"
            ? { display_name: "Another account already uses this name." }
            : { client_code: "This Account ID is already in use." },
      };
    }
    throw err;
  }

  await recordAudit({
    user_id: guard.user.id,
    action: "account.update",
    entity_type: "account",
    entity_id: String(id),
    before: {
      display_name: account.display_name ?? null,
      client_code: account.client_code ?? null,
      billing_entity: account.billing_entity ?? null,
      website: account.website ?? null,
      cs_owner: account.cs_owner ?? null,
      sales_owner: account.sales_owner ?? null,
      msa_url: account.msa_url ?? null,
      msa_start_date: account.msa_start_date ?? null,
      msa_end_date: account.msa_end_date ?? null,
      logo_changed: false,
    },
    after: {
      display_name: fields.display_name,
      client_code: fields.client_code,
      billing_entity: fields.billing_entity,
      website: fields.website,
      cs_owner: fields.cs_owner,
      sales_owner: fields.sales_owner,
      msa_url: fields.msa_url,
      msa_start_date: fields.msa_start_date,
      msa_end_date: fields.msa_end_date,
      logo_changed: (account.logo_data_url ?? null) !== fields.logo_data_url,
    },
  });

  // display_name is an output of the cached getAccountSummaries (accounts list +
  // group rollups), so a rename must bust the revenue tag, not just the routes.
  if ((account.display_name ?? null) !== fields.display_name) {
    revalidateRevenue();
  }

  revalidatePath(`/accounts/${slug}/profile`);
  revalidatePath(`/accounts/${slug}`);
  revalidatePath("/accounts");
  // A rename moves the slug — revalidate the new paths too so the redirected
  // pages render fresh.
  if (newSlug !== slug) {
    revalidatePath(`/accounts/${newSlug}/profile`);
    revalidatePath(`/accounts/${newSlug}`);
  }

  return { ok: true, slug: newSlug };
}
