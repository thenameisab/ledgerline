"use client";

// Settings → Alerts: who receives the alert emails. One recipient list per
// alert group (see RecipientListRow), and one "Send me a test" button per
// email type. Tests go only to the signed-in admin.

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RecipientListRow } from "@/components/admin/RecipientListRow";
import { ALERT_GROUPS, ALERT_RULES, type AlertGroup, type AlertRule } from "@/lib/alerts/config";
import { saveAlertRecipients, sendAlertEmailTest } from "@/app/admin/settings/alerts/actions";

// The rules that can open a critical alert. Severity is set in lib/alerts/rules.ts.
const CRITICAL_NOTE: Record<AlertGroup, string> = {
  volume: "Critical alerts: account sent no traffic (A1), platform volume dropped (A5).",
  failures: "Critical alerts: failures rose across accounts (B2), when the rise or the number of accounts is large.",
  revenue: "No rule in this group opens critical alerts.",
  lifecycle: "No rule in this group opens critical alerts.",
  data: "Critical alerts: usage not synced (F1). This replaces the old “daily roundup withheld” email.",
};

const rulesOf = (g: AlertGroup) => (Object.keys(ALERT_RULES) as AlertRule[]).filter((r) => ALERT_RULES[r].group === g);

function TestButton({ kind, label }: { kind: "daily" | "critical"; label: string }) {
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const res = await sendAlertEmailTest(kind);
      if (!res.ok) {
        toast.error("The test email was not sent", { description: res.error });
        return;
      }
      toast.success("Test sent to you", { description: res.subject });
    });
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={run}
      disabled={pending}
      leadingIcon={pending ? <Loader2 className="animate-spin" /> : <Mail />}
    >
      {pending ? "Sending…" : label}
    </Button>
  );
}

export function AlertEmailSettings({ initial }: { initial: Record<AlertGroup, string[]> }) {
  return (
    <section className="elev-1 bg-bg-raised rounded-md p-6">
      <h2 className="font-serif text-xl text-ink mb-1" style={{ fontWeight: 600 }}>
        Alert emails
      </h2>
      <div className="space-y-2 text-sm text-ink-muted">
        <p>
          <span className="text-ink">Daily email.</span> After each usage date is checked (the first check runs at
          11:45 IST), each person gets one email with that date&rsquo;s new alerts for the groups they are on, most
          severe first. A person with no alerts in their groups gets no email.
        </p>
        <p>
          <span className="text-ink">Critical email.</span> Each critical alert is also emailed on its own when it
          opens, to the list for its group. The daily email lists it again and marks it as already emailed.
        </p>
        <p>Only @ledgerline.local addresses. An empty list turns that group&rsquo;s emails off.</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TestButton kind="daily" label="Send me a test daily email" />
        <TestButton kind="critical" label="Send me a test critical email" />
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Tests go only to you and change nothing. The daily test uses the latest date with alerts, for all groups. The
        critical test uses the latest critical alert, or a sample &ldquo;usage not synced&rdquo; alert if there is none.
      </p>
      <div className="mt-4">
        {ALERT_GROUPS.map((g) => (
          <RecipientListRow
            key={g.id}
            label={g.label}
            hint={`Rules ${rulesOf(g.id).join(", ")}. ${CRITICAL_NOTE[g.id]}`}
            initial={initial[g.id]}
            onSave={(raw) => saveAlertRecipients(g.id, raw)}
          />
        ))}
      </div>
    </section>
  );
}
