"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNavPending } from "@/lib/nav-pending";

/**
 * Invisible component — mounts on any page that displays shared data (e.g.
 * pricing) and silently calls router.refresh() on an interval so all viewers
 * see changes made by other users within ~30 seconds.
 *
 * router.refresh() re-runs Next.js server components in-place without a full
 * navigation, so the page doesn't flash or lose scroll position.
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    // Only poll while the tab is actually visible. A backgrounded tab re-running
    // every server query every 30s is wasted load on a small connection pool;
    // refresh once on return so the user still lands on fresh data.
    const tick = () => {
      // Don't refresh mid-navigation: a refresh() can supersede a pending
      // router.push() transition and strand it (e.g. the dashboard toggle).
      if (document.visibilityState === "visible" && !isNavPending()) router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return null;
}
