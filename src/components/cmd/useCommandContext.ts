"use client";

// Resolves the entity behind the current route so the palette can show
// scoped "on this page" actions. Refetches when the palette opens or the
// route changes.

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type CmdContext =
  | { kind: "account"; accountId: number; name: string; slug: string }
  | {
      kind: "invoice";
      accountId: number;
      name: string;
      slug: string;
      periodId: number;
      periodLabel: string | null;
      status: string;
    }
  | { kind: "group"; id: number; name: string }
  | { kind: "api"; code: string; name: string };

export function useCommandContext(open: boolean): CmdContext | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = searchParams.get("period");
  const [ctx, setCtx] = useState<CmdContext | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const qs = new URLSearchParams({ path: pathname });
    if (period) qs.set("period", period);
    fetch(`/api/context?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setCtx(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, pathname, period]);

  return ctx;
}
