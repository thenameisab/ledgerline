"use client";

// Admin-only editor for the roundup email distribution lists. One row per
// kind: recipients input (comma/space separated, @ledgerline.local only, empty =
// that roundup off) + Save + "Send me a test" (builds the real digest and
// emails only the signed-in admin).

import { RecipientListRow } from "@/components/admin/RecipientListRow";
import { saveRoundupRecipients, sendRoundupTest, sendRoundupNow } from "@/app/admin/settings/actions";

type Kind = "daily" | "weekly" | "monthly";

const ROWS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "daily", label: "Daily roundup", hint: "Every morning at ~11:45 IST, covering yesterday." },
  { kind: "weekly", label: "Weekly roundup", hint: "Mondays, covering the finished Mon–Sun week." },
  { kind: "monthly", label: "Monthly roundup", hint: "The 1st, covering the finished month." },
];

export function RoundupSettings({ initial }: { initial: Record<Kind, string[]> }) {
  return (
    <>
      {ROWS.map((r) => (
        <RecipientListRow
          key={r.kind}
          label={r.label}
          hint={r.hint}
          initial={initial[r.kind]}
          onSave={(raw) => saveRoundupRecipients(r.kind, raw)}
          onTest={() => sendRoundupTest(r.kind)}
          onSendNow={() => sendRoundupNow(r.kind)}
        />
      ))}
    </>
  );
}
