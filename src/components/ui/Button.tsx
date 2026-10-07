import * as React from "react";

/**
 * Unified button. Single source of truth for variants, sizes, and interaction
 * states across the dashboard. Renders <button> by default; for anchors and
 * Next <Link>s use `buttonClass(...)` so they share the exact same styling.
 *
 * Design contract: DESIGN.md §6.1 Buttons.
 *   - Solid fill, 8px corner radius (rounded-DEFAULT), Inter at font-medium.
 *   - Bevel, not shadow: a darker inset bottom edge plus a light top catch
 *     (--bevel-solid). The fill reads physical without floating off the page,
 *     so buttons still sit *in* the layout rather than hovering over it.
 *   - No glass, no pill — those carry "interactive ornament" the product
 *     chrome doesn't want; glass is reserved for trays and the palette.
 *   - Focus: 2px accent ring at 2px offset (matches global :focus-visible).
 *   - Hover: fill shift only (no scale, no translate).
 *   - Active: 1px translate-y and the bevel collapses — the button presses in.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Render an icon before the label */
  leadingIcon?: React.ReactNode;
  /** Render an icon after the label */
  trailingIcon?: React.ReactNode;
  /** Shrink padding when there's only an icon */
  iconOnly?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    className = "",
    leadingIcon,
    trailingIcon,
    iconOnly = false,
    children,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, iconOnly, extra: className })}
      {...rest}
    >
      {leadingIcon && <span className="inline-flex items-center shrink-0">{leadingIcon}</span>}
      {!iconOnly && children}
      {trailingIcon && <span className="inline-flex items-center shrink-0">{trailingIcon}</span>}
    </button>
  );
});

export function buttonClass({
  variant = "primary",
  size = "md",
  iconOnly = false,
  extra = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  extra?: string;
} = {}): string {
  return [BASE, sizeClass(size, iconOnly), variantClass(variant), extra].filter(Boolean).join(" ");
}

const BASE =
  // layout + typography
  "relative inline-flex items-center justify-center gap-1.5 rounded whitespace-nowrap select-none " +
  "font-medium " +
  // motion + focus
  "transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-standard " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  // disabled — a disabled control shouldn't look pressable, so the bevel goes too
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none " +
  // press feel: sink by 1px and flatten the bevel
  "active:translate-y-px active:shadow-none";

function sizeClass(size: ButtonSize, iconOnly: boolean): string {
  switch (size) {
    // Blade control heights. The rail of a form should read as one band, so
    // these are the only three heights in the product.
    case "sm":
      return iconOnly ? "h-7 w-7 text-xs [&_svg]:size-3" : "h-7 px-3 text-xs [&_svg]:size-3";
    case "lg":
      return iconOnly ? "h-11 w-11 text-sm [&_svg]:size-4" : "h-11 px-5 text-sm [&_svg]:size-4";
    case "md":
    default:
      return iconOnly ? "h-9 w-9 text-sm [&_svg]:size-3.5" : "h-9 px-4 text-sm [&_svg]:size-3.5";
  }
}

function variantClass(variant: ButtonVariant): string {
  switch (variant) {
    case "primary":
      // Solid azure with the bevel. The everyday CTA.
      return [
        "bg-accent text-bg-raised shadow-bevel",
        "hover:bg-accent-ink",
        "active:bg-accent-ink",
      ].join(" ");

    case "secondary":
      // White + grey ring + the quiet bevel. Lower-emphasis actions that still
      // need a defined affordance (Cancel, secondary nav).
      return [
        "bg-bg-raised text-ink border border-border-strong shadow-bevel-quiet",
        "hover:bg-bg-sunken hover:border-ink-faint",
        "active:bg-bg-sunken",
      ].join(" ");

    case "destructive":
      // Solid negative-red with the bevel. Irreversible destructive actions only.
      return [
        "bg-bad text-bg-raised shadow-bevel",
        "hover:brightness-110",
        "active:brightness-95",
      ].join(" ");

    case "ghost":
    default:
      // No background and no bevel until hover — a ghost isn't a surface yet.
      return [
        "bg-transparent text-ink",
        "hover:bg-bg-sunken",
        "active:bg-bg-sunken",
      ].join(" ");
  }
}
