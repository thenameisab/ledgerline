import { requireRole } from "@/lib/access";
import { StatusBar } from "@/components/StatusBar";
import { SettingsNav } from "@/components/admin/SettingsNav";
import { getRoundupRecipients, getProductUpdateRecipients } from "@/lib/repos/settings";
import { RoundupSettings } from "@/components/admin/RoundupSettings";
import { ProductUpdateSettings } from "@/components/admin/ProductUpdateSettings";

// First tab of the Settings section: the scheduled email lists.
//
// The app-wide sandbox toggle is on Sandbox billing, and the usage-refresh
// button is on Data & sync, next to the run history.
export default async function AdminEmailSettingsPage() {
  await requireRole("admin");
  const [daily, weekly, monthly, usage] = await Promise.all([
    getRoundupRecipients("daily"),
    getRoundupRecipients("weekly"),
    getRoundupRecipients("monthly"),
    getProductUpdateRecipients("usage"),
  ]);

  return (
    <main>
      <StatusBar title="Emails" subtitle="Scheduled digests sent from Ledgerline" />
      <SettingsNav />
      <div className="mx-auto w-full max-w-[800px] px-7 py-6 space-y-6">
        <section
          className="elev-1 bg-bg-raised rounded-md p-6 dash-enter"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <h2 className="font-serif text-xl text-ink mb-1" style={{ fontWeight: 600 }}>
            Roundup emails
          </h2>
          <p className="text-sm text-ink-muted mb-5">
            Revenue digests sent from Ledgerline, each compared against the same slice of the
            previous billing period. Only @ledgerline.local addresses; an empty list turns that
            roundup off.
          </p>
          <RoundupSettings initial={{ daily, weekly, monthly }} />
        </section>

        <section
          className="elev-1 bg-bg-raised rounded-md p-6 dash-enter"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <h2 className="font-serif text-xl text-ink mb-1" style={{ fontWeight: 600 }}>
            Product update emails
          </h2>
          <p className="text-sm text-ink-muted mb-5">
            A weekly usage digest, sent on Mondays for the finished Mon–Sun week and compared
            with the week before. Usage and health only, no revenue. Only @ledgerline.local
            addresses; an empty list turns the update off.
          </p>
          <ProductUpdateSettings initial={{ usage }} />
        </section>
      </div>
    </main>
  );
}
