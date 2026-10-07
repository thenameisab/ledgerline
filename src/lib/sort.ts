// Apply a `column.dir` sort param to a list. Universal — usable from both
// server components (Accounts/APIs pages) and account components.

export function applySort<T extends Record<string, any>>(
  items: T[],
  sortParam: string | undefined,
  defaultColumn: keyof T,
  defaultDir: "asc" | "desc" = "desc"
): T[] {
  let column = defaultColumn as string;
  let dir = defaultDir;
  if (sortParam) {
    const [c, d] = sortParam.split(".");
    if (c) column = c;
    if (d === "asc" || d === "desc") dir = d;
  }
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = a[column];
    const bv = b[column];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  });
}
