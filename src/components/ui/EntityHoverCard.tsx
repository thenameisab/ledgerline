"use client";
import * as React from "react";
import * as HoverCard from "@radix-ui/react-hover-card";

// Generic rich-hover shell: wraps a trigger (an account/API name link) and, on
// open, lazily fetches a compact summary from `endpoint`, caching it in-module
// so re-hovering the same entity is instant. The caller supplies the width and
// a render fn for the fetched payload; a skeleton shows while the first fetch
// is in flight. Built on Radix HoverCard so it's pointer + keyboard-focus
// driven and never fires on touch (unlike a click popover).

// Module-level cache shared across every hover card on the page. Keyed by the
// full endpoint URL, so account and API entities never collide.
const cache = new Map<string, unknown>();

type FetchState<T> =
  | { status: "idle" | "loading" }
  | { status: "ready"; data: T }
  | { status: "error" };

export function EntityHoverCard<T>({
  endpoint,
  width,
  render,
  skeleton,
  children,
  side = "top",
  align = "start",
}: {
  endpoint: string;
  width: number;
  render: (data: T) => React.ReactNode;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const [state, setState] = React.useState<FetchState<T>>(() =>
    cache.has(endpoint) ? { status: "ready", data: cache.get(endpoint) as T } : { status: "idle" }
  );

  const load = React.useCallback(() => {
    if (cache.has(endpoint)) {
      setState({ status: "ready", data: cache.get(endpoint) as T });
      return;
    }
    setState({ status: "loading" });
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        cache.set(endpoint, data);
        setState({ status: "ready", data });
      })
      .catch(() => setState({ status: "error" }));
  }, [endpoint]);

  return (
    <HoverCard.Root openDelay={220} closeDelay={120} onOpenChange={(o) => o && load()}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          style={{ width, transformOrigin: "var(--radix-hover-card-content-transform-origin)" }}
          className="hovercard-content z-50 rounded-lg border border-border bg-bg-raised shadow-high overflow-hidden"
        >
          {state.status === "ready" ? (
            render(state.data)
          ) : state.status === "error" ? (
            <div className="px-4 py-6 text-center text-xs text-ink-faint">
              Couldn’t load details.
            </div>
          ) : (
            skeleton
          )}
          <HoverCard.Arrow className="fill-bg-raised" width={12} height={6} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

// Shared shimmer bar for skeleton states.
export function SkelBar({ w, h = 10 }: { w: number | string; h?: number }) {
  return (
    <div
      className="rounded bg-bg-sunken animate-pulse"
      style={{ width: w, height: h }}
    />
  );
}
