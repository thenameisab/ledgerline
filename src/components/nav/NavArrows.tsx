"use client";
import { useRouter, usePathname } from "next/navigation";
import { useReducer, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type NavState = { stack: string[]; pos: number; intent: "back" | "forward" | null };
type NavAction =
  | { type: "navigate"; path: string }
  | { type: "intent"; dir: "back" | "forward" };

function navReducer(s: NavState, a: NavAction): NavState {
  if (a.type === "intent") return { ...s, intent: a.dir };
  if (s.intent === "back") return { ...s, pos: Math.max(0, s.pos - 1), intent: null };
  if (s.intent === "forward")
    return { ...s, pos: Math.min(s.stack.length - 1, s.pos + 1), intent: null };
  // Regular navigation — truncate forward stack and push
  const newStack = [...s.stack.slice(0, s.pos + 1), a.path];
  return { stack: newStack, pos: newStack.length - 1, intent: null };
}

export function NavArrows() {
  const router = useRouter();
  const pathname = usePathname();
  const isFirst = useRef(true);

  const [{ stack, pos }, dispatch] = useReducer(navReducer, {
    stack: [pathname],
    pos: 0,
    intent: null,
  });

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    dispatch({ type: "navigate", path: pathname });
  }, [pathname]);

  const canBack = pos > 0;
  const canForward = pos < stack.length - 1;

  const btn = (enabled: boolean) =>
    `inline-flex items-center justify-center w-7 h-7 rounded transition-colors duration-fast ease-expo ${
      enabled
        ? "text-ink-muted hover:text-ink hover:bg-bg-sunken cursor-pointer"
        : "text-ink-faint opacity-40 cursor-default pointer-events-none"
    }`;

  return (
    <div className="flex items-center gap-0.5 px-1">
      <button
        type="button"
        onClick={() => { dispatch({ type: "intent", dir: "back" }); router.back(); }}
        disabled={!canBack}
        aria-label="Go back"
        className={btn(canBack)}
      >
        <ChevronLeft size={15} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={() => { dispatch({ type: "intent", dir: "forward" }); router.forward(); }}
        disabled={!canForward}
        aria-label="Go forward"
        className={btn(canForward)}
      >
        <ChevronRight size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}
