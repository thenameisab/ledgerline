"use client";
import * as React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

/**
 * Wraps a single line of text in a `truncate` container that measures whether
 * its content overflows; if so, hovering or focusing reveals the full string in
 * a Radix tooltip. No tooltip is rendered for text that fits.
 *
 * Universal across product surfaces (DESIGN §6.2 Tooltip primitive). Wherever
 * a label can clip with ellipsis/line-clamp, this is the affordance.
 */
export function TruncateTooltip({
  text,
  className = "",
  style,
  as: Tag = "span",
  side = "top",
  align = "start",
  delayDuration = 200,
  multiline = false,
  children,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  /** If true, allows the content to wrap (use with `line-clamp-N`); detects vertical overflow. */
  multiline?: boolean;
  /** Optional render override — useful when the visible cell needs different markup than the text. */
  children?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [overflows, setOverflows] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const overflow = multiline
        ? el.scrollHeight > el.clientHeight + 1
        : el.scrollWidth > el.clientWidth + 1;
      setOverflows(overflow);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, multiline]);

  const truncationClass = multiline ? "" : "truncate";
  const node = React.createElement(
    Tag,
    {
      ref: (el: HTMLElement | null) => {
        ref.current = el;
      },
      className: `${truncationClass} ${className}`.trim(),
      style,
    },
    children ?? text
  );

  if (!overflows) return node;

  return (
    <Tooltip.Root delayDuration={delayDuration}>
      <Tooltip.Trigger asChild>{node}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-sm rounded-md bg-ink text-bg-raised px-2.5 py-1.5 text-xs leading-snug shadow-none animate-in fade-in-0 zoom-in-95 duration-fast"
        >
          {text}
          <Tooltip.Arrow className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
