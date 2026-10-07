"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

type Option = { value: string; label: string };

export function AuditFilterBar({
  users,
  actions,
  entityTypes,
  active,
}: {
  users: Option[];
  actions: string[];
  entityTypes: string[];
  active: { user?: string; action?: string; entity?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page"); // filters reset pagination
    router.replace(`${pathname}?${params.toString()}`);
  }

  const hasAny = !!active.user || !!active.action || !!active.entity;

  const selectClass =
    "bg-bg-raised border border-border rounded px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        aria-label="Filter by user"
        className={selectClass}
        value={active.user ?? ""}
        onChange={(e) => setParam("user", e.target.value)}
      >
        <option value="">All users</option>
        {users.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by action"
        className={selectClass}
        value={active.action ?? ""}
        onChange={(e) => setParam("action", e.target.value)}
      >
        <option value="">All actions</option>
        {actions.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by entity type"
        className={selectClass}
        value={active.entity ?? ""}
        onChange={(e) => setParam("entity", e.target.value)}
      >
        <option value="">All entities</option>
        {entityTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {hasAny && (
        <button
          onClick={() => router.replace(pathname)}
          className="text-xs text-ink-muted hover:text-ink inline-flex items-center gap-1"
        >
          <X size={12} strokeWidth={1.5} /> Clear
        </button>
      )}
    </div>
  );
}
