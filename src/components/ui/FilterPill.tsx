import Link from "next/link";
import { RollingText } from "./RollingText";

// Canonical filter pill — the single recipe for chip-style filters and status
// tabs (accounts buckets, APIs filters, invoice status). Three surfaces had
// copy-pasted this; now they share it. Renders <button> by default, or a
// <Link> when `href` is given, so server pages can use URL-driven filters.
const pillClass = (active: boolean) =>
  [
    "inline-flex items-center gap-2 px-3 py-1.5 text-xs leading-none rounded-md border",
    "transition-colors duration-fast ease-expo",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    active
      ? "bg-accent-bg text-accent-ink border-accent"
      : "bg-bg-raised text-ink-muted hover:bg-bg-sunken hover:text-ink border-border",
  ].join(" ");

export function FilterPill({
  label,
  active,
  count,
  href,
  onClick,
}: {
  label: string;
  active: boolean;
  /** Optional trailing count, rendered mono + faint. */
  count?: number;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span style={{ fontWeight: 500 }}>{label}</span>
      {count != null && (
        <RollingText
          className={`text-[10px] font-mono tnum ${active ? "text-accent-ink" : "text-ink-faint"}`}
          text={String(count)}
          options={{ direction: "up" }}
        />
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} role="tab" aria-selected={active} className={pillClass(active)}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={pillClass(active)}>
      {body}
    </button>
  );
}
