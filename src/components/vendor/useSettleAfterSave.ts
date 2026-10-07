"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Close a vendor editor once the page has caught up with the save, not before.
 *
 * A fixed close timer measures nothing. A refresh re-runs the page's server components, and the reads behind them
 * (`rateCard`, `listVendors`, `vendorConfidence`) are cached aggregates over
 * the revenue view that the write has just invalidated, so they are recomputed
 * against the database, which can take several seconds. If the editor closes
 * before the table changes, a save that worked looks like a save that failed.
 *
 * `useTransition` gives the refresh an end to wait for: the transition stays
 * pending until React has rendered the new server payload. The editor holds
 * its "Saved" state for exactly that long and closes when the number behind it
 * is right.
 *
 * Returns a `settle(done, href?)` function. It refreshes the current page, or
 * navigates to `href` for a save that moves the URL, and runs `done` when the
 * new payload is on screen.
 */
export function useSettleAfterSave() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const doneRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!armed || pending) return;
    setArmed(false);
    const done = doneRef.current;
    doneRef.current = null;
    done?.();
  }, [armed, pending]);

  return useCallback(
    (done: () => void, href?: string) => {
      doneRef.current = done;
      setArmed(true);
      startTransition(() => {
        if (href) router.push(href);
        else router.refresh();
      });
    },
    [router]
  );
}
