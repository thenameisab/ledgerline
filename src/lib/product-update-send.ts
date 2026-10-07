// Shared send path for the weekly product update cron and the admin
// "send me a test" / "send now" actions: resolve recipients → build snapshot →
// render → send one email per recipient. Mirrors lib/roundup-send.ts.

import { buildProductUpdate } from "./product-update";
import { buildProductUpdateEmail } from "./emails/product-update-email";
import { getProductUpdateRecipients, type UpdateProduct } from "./repos/settings";
import { sendEmail } from "./email";
import { todayIST } from "./repos/periods";

const appUrl = () => process.env.AUTH_URL ?? "http://localhost:3000";

export type ProductUpdateSendResult = {
  product: UpdateProduct;
  skipped?: true; // no recipients configured
  subject?: string;
  sent?: string[];
  failed?: { to: string; error: string }[];
};

/** Send one product's weekly update to its configured list (or an explicit override). */
export async function sendProductUpdate(
  product: UpdateProduct,
  overrideRecipients?: string[]
): Promise<ProductUpdateSendResult> {
  const recipients = overrideRecipients ?? (await getProductUpdateRecipients(product));
  if (recipients.length === 0) return { product, skipped: true };

  const data = await buildProductUpdate(product, todayIST());
  const { subject, html, text } = buildProductUpdateEmail(data, appUrl());

  const sent: string[] = [];
  const failed: { to: string; error: string }[] = [];
  for (const to of recipients) {
    const res = await sendEmail({ to, subject, html, text });
    if (res.ok) sent.push(to);
    else failed.push({ to, error: res.error ?? (res.skipped ? "email not configured" : "unknown") });
  }
  return { product, subject, sent, failed };
}

/** Render without sending — the cron route's ?dry=1 preview. */
export async function renderProductUpdate(
  product: UpdateProduct,
  todayOverride?: string
): Promise<{ subject: string; html: string }> {
  const data = await buildProductUpdate(product, todayOverride ?? todayIST());
  const { subject, html } = buildProductUpdateEmail(data, appUrl());
  return { subject, html };
}
