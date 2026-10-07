// Severity labels and colors, shared by the /alerts page (server) and its rows (client).

import type { AlertSeverity } from "@/lib/alerts/config";

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  info: "Info",
};

export const SEVERITY_CHIP: Record<AlertSeverity, string> = {
  critical: "bg-bad-bg text-bad-ink",
  high: "bg-warn-bg text-warn-ink",
  medium: "bg-bg-sunken text-ink-muted",
  info: "bg-info-bg text-info-ink",
};

export const SEVERITY_DOT: Record<AlertSeverity, string> = {
  critical: "bg-bad",
  high: "bg-warn",
  medium: "bg-ink-faint",
  info: "bg-info",
};
