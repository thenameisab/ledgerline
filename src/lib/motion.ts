// JS-side reduced-motion check for animations CSS can't reach (e.g. recharts'
// isAnimationActive). CSS animations are covered by the media query in
// globals.css; use this only where the animation is driven from JavaScript.
// Safe during SSR: reports false, and mount-time animations only run account-side.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
