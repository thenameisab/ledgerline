"use client";

// Admin-only editor for the weekly product update distribution list — same
// controls as the roundups (see RecipientListRow).

import { RecipientListRow } from "@/components/admin/RecipientListRow";
import {
  saveProductUpdateRecipients,
  sendProductUpdateTest,
  sendProductUpdateNow,
} from "@/app/admin/settings/actions";
import type { UpdateProduct } from "@/lib/repos/settings";

const ROWS: { product: UpdateProduct; label: string; hint: string }[] = [
  {
    product: "usage",
    label: "Weekly usage update",
    hint: "Mondays ~12:00 IST. Units, success rate, channels, top SKUs and accounts, newly active and quiet accounts, data quality.",
  },
];

export function ProductUpdateSettings({ initial }: { initial: Record<UpdateProduct, string[]> }) {
  return (
    <>
      {ROWS.map((r) => (
        <RecipientListRow
          key={r.product}
          label={r.label}
          hint={r.hint}
          initial={initial[r.product]}
          onSave={(raw) => saveProductUpdateRecipients(r.product, raw)}
          onTest={() => sendProductUpdateTest(r.product)}
          onSendNow={() => sendProductUpdateNow(r.product)}
        />
      ))}
    </>
  );
}
