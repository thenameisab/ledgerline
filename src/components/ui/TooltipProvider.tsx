"use client";
import * as Tooltip from "@radix-ui/react-tooltip";

/**
 * Root Tooltip.Provider mounted once at the app shell so all TruncateTooltips
 * (and future Tooltip primitives) share delay state and pointer coordination.
 */
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={200} skipDelayDuration={0}>
      {children}
    </Tooltip.Provider>
  );
}
