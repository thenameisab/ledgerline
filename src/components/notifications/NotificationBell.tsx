"use client";

// The header bell and its notifications panel. Items are grouped by day (IST),
// each kind has its own icon, and an alert digest shows its severity counts as
// dots. Clicking an item marks it read and opens its link.

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck, CircleCheck, CircleX, OctagonAlert, ShieldAlert, type LucideIcon } from "lucide-react";
import { formatDate, formatDatesInText, formatDateTime } from "@/lib/format";
import { SEVERITY_DOT, SEVERITY_LABEL } from "@/components/alerts/severity";
import type { AlertSeverity } from "@/lib/alerts/config";

type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const KIND: Record<string, { icon: LucideIcon; tile: string }> = {
  "alert.critical": { icon: OctagonAlert, tile: "bg-bad-bg text-bad-ink" },
  "alert.digest": { icon: BellRing, tile: "bg-bg-sunken text-ink-muted" },
  "account_op.requested": { icon: ShieldAlert, tile: "bg-warn-bg text-warn-ink" },
  "account_op.approved": { icon: CircleCheck, tile: "bg-ok-bg text-ok-ink" },
  "account_op.rejected": { icon: CircleX, tile: "bg-bg-sunken text-ink-muted" },
};
const DEFAULT_KIND = { icon: Bell, tile: "bg-bg-sunken text-ink-muted" };

const SEVERITIES: AlertSeverity[] = ["critical", "high", "medium", "info"];

/** "1 high, 3 medium" (the digest body) → severity counts, or null for any other text. */
function digestCounts(body: string | null): { s: AlertSeverity; n: number }[] | null {
  if (!body) return null;
  const parts = body.split(", ").map((p) => /^(\d+) (critical|high|medium|info)$/.exec(p));
  if (!parts.length || parts.some((m) => !m)) return null;
  return parts.map((m) => ({ n: Number(m![1]), s: m![2] as AlertSeverity })).sort((a, b) => SEVERITIES.indexOf(a.s) - SEVERITIES.indexOf(b.s));
}

/** The IST calendar date of a timestamp, as YYYY-MM-DD. */
function istDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

function dayLabel(day: string, now: number): string {
  const today = istDate(new Date(now).toISOString());
  const yesterday = istDate(new Date(now - 86_400_000).toISOString());
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return formatDate(day);
}

function timeAgo(iso: string, now: number): string {
  const secs = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // `render` keeps the panel in the DOM through its exit transition; `shown`
  // drives the open/closed animation state.
  const [render, setRender] = useState(false);
  const [shown, setShown] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* transient — next poll retries */
    }
  }, []);

  // Poll while mounted; refresh immediately when the panel opens.
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Mount, then flip to shown on the next frame so the enter transition runs;
  // on close, run the exit transition, then unmount.
  useEffect(() => {
    if (open) {
      setRender(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setRender(false), 200);
    return () => clearTimeout(t);
  }, [open]);

  // Anchor the panel below the bell, aligned to its trailing edge.
  useEffect(() => {
    if (!render) return;
    const place = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      // Align to the bell's trailing edge, but keep the whole panel 16px inside the viewport.
      const vw = window.innerWidth;
      const width = Math.min(400, vw - 32);
      setCoords({ top: r.bottom + 8, right: Math.min(Math.max(16, vw - r.right), vw - 16 - width) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [render]);

  // Close on outside click / Escape. The panel is portalled outside rootRef.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
  };

  const onItemClick = async (n: Notification) => {
    if (!n.read_at) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", ids: [n.id] }),
      });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const now = Date.now();
  const visible = onlyUnread ? items.filter((n) => !n.read_at) : items;
  const days: { day: string; rows: Notification[] }[] = [];
  for (const n of visible) {
    const day = istDate(n.created_at);
    if (days[days.length - 1]?.day !== day) days.push({ day, rows: [] });
    days[days.length - 1].rows.push(n);
  }
  const hasAlerts = items.some((n) => n.kind.startsWith("alert."));
  const hasApprovals = items.some((n) => n.kind === "account_op.requested");

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-muted hover:bg-bg-sunken hover:text-ink active:scale-[0.96] transition-[background-color,color,transform] duration-fast ease-expo focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Bell size={17} strokeWidth={1.75} aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-white text-[9px] leading-[16px] font-semibold text-center ring-2 ring-bg tnum">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {render && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            data-state={shown ? "open" : "closed"}
            style={{
              position: "fixed",
              top: coords.top,
              right: coords.right,
              width: "min(400px, calc(100vw - 32px))",
              maxHeight: `calc(100vh - ${coords.top + 16}px)`,
            }}
            className="popover-panel z-[100] flex flex-col overflow-hidden rounded-md"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Notifications</h2>
              <div className="flex items-center gap-0.5 rounded bg-bg-sunken p-0.5 text-xs" role="group" aria-label="Show">
                {[
                  { v: false, label: "All" },
                  { v: true, label: unread > 0 ? `Unread ${unread}` : "Unread" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={onlyUnread === o.v}
                    onClick={() => setOnlyUnread(o.v)}
                    className={[
                      "whitespace-nowrap rounded-sm px-2 py-1 font-medium transition-colors duration-fast ease-expo tnum",
                      onlyUnread === o.v ? "bg-bg-raised text-ink shadow-low" : "text-ink-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  aria-label="Mark all read"
                  title="Mark all read"
                  className="ms-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-xs font-medium text-ink-muted hover:bg-bg-sunken hover:text-ink transition-colors duration-fast ease-expo"
                >
                  <CheckCheck size={14} strokeWidth={2} aria-hidden />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {visible.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell size={24} strokeWidth={1.5} className="mx-auto text-ink-faint" aria-hidden />
                  <p className="mt-2 text-sm text-ink-muted">{onlyUnread ? "You have read everything." : "No notifications yet."}</p>
                </div>
              ) : (
                days.map((d) => (
                  <section key={d.day} aria-label={dayLabel(d.day, now)}>
                    <h3 className="sticky top-0 z-[1] bg-bg-raised px-4 pb-1 pt-3 text-xs font-medium text-ink-faint">
                      {dayLabel(d.day, now)}
                    </h3>
                    <ul className="px-2 pb-1">
                      {d.rows.map((n) => {
                        const k = KIND[n.kind] ?? DEFAULT_KIND;
                        const Icon = k.icon;
                        const counts = n.kind === "alert.digest" ? digestCounts(n.body) : null;
                        const title = formatDatesInText(n.title);
                        const body = n.body ? formatDatesInText(n.body) : null;
                        return (
                          <li key={n.id}>
                            <button
                              type="button"
                              onClick={() => onItemClick(n)}
                              className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] gap-x-3 rounded px-2 py-2.5 text-start hover:bg-bg-sunken transition-colors duration-fast ease-expo"
                            >
                              <span
                                className={`flex items-center justify-center rounded ${k.tile}`}
                                style={{ width: 28, height: 28 }}
                                aria-hidden
                              >
                                <Icon size={15} strokeWidth={2} />
                              </span>
                              <span className="min-w-0">
                                <span
                                  className={`text-sm leading-snug line-clamp-2 ${n.read_at ? "text-ink-muted" : "font-medium text-ink"}`}
                                  title={title}
                                >
                                  {title}
                                </span>
                                {counts ? (
                                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                                    {counts.map((c) => (
                                      <span key={c.s} className="inline-flex items-center gap-1.5">
                                        <span className={`size-1.5 rounded-full ${SEVERITY_DOT[c.s]}`} aria-hidden />
                                        <span className="tnum">{c.n}</span> {SEVERITY_LABEL[c.s]}
                                      </span>
                                    ))}
                                  </span>
                                ) : (
                                  body && (
                                    <span className="mt-0.5 text-xs leading-snug text-ink-muted line-clamp-2" title={body}>
                                      {body}
                                    </span>
                                  )
                                )}
                              </span>
                              <span className="flex flex-col items-end gap-1.5 pt-0.5">
                                <time dateTime={n.created_at} title={formatDateTime(n.created_at)} className="text-xs text-ink-faint tnum">
                                  {timeAgo(n.created_at, now)}
                                </time>
                                {!n.read_at && <span className="size-2 rounded-full bg-accent" aria-label="Unread" />}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>

            {(hasAlerts || hasApprovals) && (
              <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-xs">
                {hasAlerts && (
                  <Link href="/alerts" onClick={() => setOpen(false)} className="font-medium text-accent-ink hover:underline">
                    Open alerts
                  </Link>
                )}
                {hasApprovals && (
                  <Link href="/admin/approvals" onClick={() => setOpen(false)} className="font-medium text-accent-ink hover:underline">
                    Open approvals
                  </Link>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
