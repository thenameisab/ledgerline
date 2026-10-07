"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Download, Eye, FileText, Table2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

/**
 * One outlined "Export" menu for an invoice's downloads, so the toolbar has a
 * single primary action (Finalize or Issue). Users who cannot see cost get
 * only the customer PDF, as a plain button.
 */
export function InvoiceExportMenu({
  accountId,
  periodId,
  showInternal,
  size = "md",
}: {
  accountId: number;
  periodId: number;
  /** Internal PDF and CSV include vendor cost and margin. */
  showInternal: boolean;
  size?: "sm" | "md";
}) {
  const base = `/api/invoices/${accountId}/${periodId}`;
  const icon = size === "sm" ? 12 : 14;
  const customerHref = `${base}/pdf?variant=customer&disposition=attachment`;

  if (!showInternal) {
    return (
      <a href={customerHref} className={buttonClass({ variant: "secondary", size })}>
        <FileText size={icon} strokeWidth={1.75} />
        Customer PDF
      </a>
    );
  }

  const items = [
    { href: customerHref, icon: FileText, label: "Customer PDF", hint: "What the customer receives" },
    {
      href: `${base}/pdf?variant=internal&disposition=attachment`,
      icon: Eye,
      label: "Internal PDF",
      hint: "Adds vendor cost and margin",
    },
    {
      href: `${base}/csv?variant=internal&disposition=attachment`,
      icon: Table2,
      label: "Internal CSV",
      hint: "Line items, prices, vendor cost, margin",
    },
  ];

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className={buttonClass({ variant: "secondary", size })}>
        <Download size={icon} strokeWidth={1.75} />
        Export
        <ChevronDown size={icon} strokeWidth={1.75} className="opacity-60" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 min-w-[240px] rounded-lg border border-border bg-bg-raised p-1 shadow-high"
        >
          {items.map((it) => (
            <Menu.Item key={it.label} asChild>
              <a
                href={it.href}
                className="flex items-start gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink outline-none data-[highlighted]:bg-bg-sunken cursor-pointer"
              >
                <it.icon size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-muted" />
                <span className="min-w-0">
                  <span className="block leading-tight">{it.label}</span>
                  <span className="block text-xs text-ink-faint mt-0.5">{it.hint}</span>
                </span>
              </a>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
