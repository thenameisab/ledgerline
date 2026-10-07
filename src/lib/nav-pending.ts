// Tiny module-level tracker for in-flight client navigations.
//
// AutoRefresh polls router.refresh() on an interval; against a slow server
// render that refresh can land mid-transition and supersede a pending
// router.push() (e.g. the dashboard view toggle), so the navigation never
// commits. Components that start a navigation bump this counter for its
// duration; AutoRefresh checks it and skips a tick while anything is pending.

let pending = 0;

export function markNavPending(): () => void {
  pending++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pending = Math.max(0, pending - 1);
  };
}

export function isNavPending(): boolean {
  return pending > 0;
}
