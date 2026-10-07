import { Glyph } from "@/components/ui/Glyph";

/**
 * The login brand panel — the flutes.
 *
 * Blurred light ribbons drifting behind a sheet of fluted glass. It's the
 * canonical composition of the design language and the first thing anyone sees,
 * so it's the screen that leans hardest on the expressive layer: azure for the
 * product, the green/aqua AI stops for the ribbons that cross it.
 *
 * Entirely CSS — no images, no canvas, no client JS. The drift stops under
 * prefers-reduced-motion; the composition still reads as a still image.
 */
export function LoginAurora() {
  return (
    <div className="login-flutes relative h-full w-full overflow-hidden">
      {/* The ribbons. Each is a long blurred bar on its own slow drift, so the
          field never repeats within a session. */}
      <span className="login-ribbon login-ribbon-1" aria-hidden />
      <span className="login-ribbon login-ribbon-2" aria-hidden />
      <span className="login-ribbon login-ribbon-3" aria-hidden />
      <span className="login-ribbon login-ribbon-4" aria-hidden />

      {/* The glass in front of them: vertical flutes that break the light into
          bands, the way real fluted glass does. */}
      <span className="login-flute-glass" aria-hidden />

      {/* Wordmark, bottom-left, over the glass. */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-10">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded bg-white/12 text-white backdrop-blur-sm">
            <Glyph size={22} />
          </span>
          <span className="font-display text-xl text-white" style={{ fontWeight: 600 }}>
            Ledgerline
          </span>
        </div>
        <p className="mt-5 max-w-md font-hero text-4xl leading-[1.1] text-white">
          Every rupee, traced to the call that earned it.
        </p>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
          Usage in, priced revenue out — with the margin, the leaks, and the invoice
          all derived from the same numbers.
        </p>
      </div>
    </div>
  );
}
