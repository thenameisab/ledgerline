import { requireRole } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { SettingsNav } from "@/components/admin/SettingsNav";
import { AlertSettingsForm } from "@/components/admin/AlertSettingsForm";
import { AlertEmailSettings } from "@/components/admin/AlertEmailSettings";
import { getAlertConfig } from "@/lib/repos/alerts";
import { getAlertRecipients } from "@/lib/repos/settings";
import { ALERT_GROUPS, type AlertGroup } from "@/lib/alerts/config";

export const dynamic = "force-dynamic";

// Settings → Alerts: who receives the alert emails, and each alert rule's
// on/off switch and thresholds. The defaults live in lib/alerts/config.ts;
// only changed values are stored.
export default async function AlertSettingsPage() {
  await requireRole("admin");
  const cfg = await getAlertConfig();
  const lists = await Promise.all(ALERT_GROUPS.map((g) => getAlertRecipients(g.id)));
  const recipients = Object.fromEntries(ALERT_GROUPS.map((g, i) => [g.id, lists[i]])) as Record<AlertGroup, string[]>;

  return (
    <main>
      <StatusBar title="Alerts" subtitle="Emails, rules and thresholds for the daily usage check" />
      <SettingsNav />
      <div className="mx-auto w-full max-w-[900px] px-4 sm:px-7 py-6 space-y-6">
        <AlertEmailSettings initial={recipients} />
        <p className="text-sm text-ink-muted">
          Changes apply from the next daily check, which runs after the usage sync. They do not change alerts that are
          already recorded. Daily rules compare with the average of the same weekday over the previous 4 weeks; rate
          rules compare with the 28 days before.
        </p>
        <AlertSettingsForm initial={{ enabled: cfg.enabled, thresholds: cfg.t }} />
      </div>
    </main>
  );
}
