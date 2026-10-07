import { RollingText } from "@/components/ui/RollingText";
import { setSandboxPreference } from "@/app/admin/sandbox/actions";

// The app-wide sandbox default, shown at the head of the precedence chain it
// sits under. Editors work the per-pair rules but can't move this default, so
// they see its state without a control they can't use.
export function SandboxGlobalToggle({
  enabled,
  canEdit,
}: {
  enabled: boolean;
  canEdit: boolean;
}) {
  const label = (
    <RollingText
      className={`text-xs font-mono uppercase tracking-wider ${
        enabled ? "text-accent-ink" : "text-ink-faint"
      }`}
      text={enabled ? "Included" : "Excluded"}
      options={{ direction: "up" }}
    />
  );

  return (
    <div className="elev-1 bg-bg-raised rounded-md p-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-sm text-ink" style={{ fontWeight: 500 }}>
            App-wide default: sandbox traffic in reports
          </div>
          <div className="text-xs text-ink-muted mt-1 max-w-xl">
            Applies everywhere — KPIs, charts, account &amp; SKU lists, and invoices. When
            excluded, sandbox usage is left out of all of them; when included, it is counted and
            billed like production traffic. The rules below override it per account·SKU.
            Default: excluded.
          </div>
        </div>

        {canEdit ? (
          <form
            className="flex shrink-0 items-center gap-2.5"
            action={async () => {
              "use server";
              await setSandboxPreference(!enabled);
            }}
          >
            {label}
            <button
              type="submit"
              aria-pressed={enabled}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-fast ease-expo focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                enabled ? "bg-accent" : "bg-border"
              }`}
            >
              <span className="sr-only">
                {enabled ? "Exclude" : "Include"} sandbox traffic in reports
              </span>
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-bg-raised shadow-low ring-0 transition-transform duration-fast ease-expo ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </form>
        ) : (
          <div
            className="flex shrink-0 items-center gap-2.5"
            title="Admins set the app-wide default. You can still set rules per account·SKU below."
          >
            {label}
            <span
              aria-hidden
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent opacity-50 ${
                enabled ? "bg-accent" : "bg-border"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-bg-raised shadow-low ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
