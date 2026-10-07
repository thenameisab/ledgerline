"use client";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Code2, Monitor, Boxes, Beaker, FileWarning } from "lucide-react";

export function ChannelChip({ channel }: { channel: string }) {
  const Icon = channel === "Integration" ? Code2 : channel === "Console" ? Monitor : Boxes;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs bg-bg-sunken text-ink-muted">
      <Icon size={11} strokeWidth={1.5} />
      <span>{channel}</span>
    </span>
  );
}

export function VendorChip({ vendor }: { vendor: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-bg-sunken text-ink-muted font-mono">
      {vendor}
    </span>
  );
}

const NO_MSA_HINT = "Over a week of logged usage with no MSA on file (or the MSA has lapsed)";

/** `compact` renders an icon-only flag with a tooltip, for narrow table cells
 *  where the full chip would wrap below the status chip. */
export function NoMsaChip({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            tabIndex={0}
            aria-label={`No MSA. ${NO_MSA_HINT}`}
            className="inline-flex shrink-0 items-center justify-center w-[18px] h-[18px] rounded text-bad-ink outline-none hover:bg-bad-bg focus-visible:ring-2 focus-visible:ring-accent"
          >
            <FileWarning size={13} strokeWidth={1.75} aria-hidden />
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            collisionPadding={12}
            className="z-50 max-w-xs rounded-md bg-ink text-bg-raised px-2.5 py-1.5 text-xs leading-snug"
          >
            <span className="font-medium">No MSA.</span> {NO_MSA_HINT}
            <Tooltip.Arrow className="fill-ink" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs bg-bad-bg text-bad-ink whitespace-nowrap"
      title={NO_MSA_HINT}
    >
      <FileWarning size={11} strokeWidth={1.5} />
      <span>No MSA</span>
    </span>
  );
}

export function SandboxChip() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs bg-info-bg text-info-ink">
      <Beaker size={11} strokeWidth={1.5} />
      <span>Sandbox</span>
    </span>
  );
}
