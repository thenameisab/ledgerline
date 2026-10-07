import { TruncateTooltip } from "./ui/TruncateTooltip";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export async function StatusBar({
  title,
  subtitle,
  chip,
  actions,
  leading,
}: {
  title: string;
  subtitle?: string;
  chip?: React.ReactNode;
  actions?: React.ReactNode;
  /** Optional element rendered before the title (e.g. an account logo). */
  leading?: React.ReactNode;
}) {
  return (
    <div className="relative border-b border-border bg-bg">
      <div className="pl-14 pr-7 md:px-7 py-3 flex items-center gap-5 flex-wrap min-h-14">
        {/* identity cluster */}
        <div className="min-w-0 flex items-center gap-3">
          {leading && <div className="shrink-0">{leading}</div>}
          <div className="min-w-0">
            <TruncateTooltip
              as="h1"
              text={title}
              className="font-sans text-2xl text-ink leading-tight"
              style={{ fontWeight: 600 }}
            />
            {subtitle && (
              <TruncateTooltip
                as="div"
                text={subtitle}
                className="text-sm text-ink-muted mt-1"
              />
            )}
          </div>
          {chip && <div className="shrink-0 self-center">{chip}</div>}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {/* Notifications live top-right, the conventional home for a tray. */}
          <NotificationBell />
        </div>
      </div>
    </div>
  );
}
