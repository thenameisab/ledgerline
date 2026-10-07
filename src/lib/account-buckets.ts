// Bucket → status_pill matching. Lives in /lib (not in the account component)
// so server components can import it without dragging in the account runtime.
//
// v0.1: only buckets we can compute exactly are exposed. "Thin margin" /
// "Healthy" buckets are intentionally absent — they require per-account margin,
// which requires vendor allocation we don't have. See V0.1_PLAN.md §3.1.

export const STATUS_BUCKETS: { key: string; label: string; statuses: string[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "leak", label: "Revenue leak", statuses: ["leak"] },
  { key: "historical", label: "Historical", statuses: ["historical"] },
];

export function bucketMatches(bucket: string | undefined, status_pill: string): boolean {
  if (!bucket || bucket === "all") return status_pill !== "sandbox"; // sandbox excluded by default
  const c = STATUS_BUCKETS.find((s) => s.key === bucket);
  if (!c) return true;
  if (c.statuses.length === 0) return true;
  return c.statuses.includes(status_pill);
}
