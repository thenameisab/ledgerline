import type { Metadata } from "next";
// Design-system typefaces (self-hosted via @fontsource) — replaces Google Fonts.
// TASA Orbiter (display), Inter (sans), JetBrains Mono (mono).
import "@fontsource/tasa-orbiter/latin-400.css";
import "@fontsource/tasa-orbiter/latin-500.css";
import "@fontsource/tasa-orbiter/latin-600.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "../styles/globals.css";
import { Shell } from "@/components/Shell";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "sonner";
import { cookies } from "next/headers";
import { THEME_COOKIE, isThemePref, resolvedAttr } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Ledgerline",
  description: "Usage-based billing for companies that sell many SKUs. Track revenue, margin, pricing, and invoices for each customer.",
};

/**
 * Resolves "system" before the first paint. Only needed when the preference is
 * to follow the OS — an explicit light/dark is already on <html> from the
 * cookie, server-side. Runs synchronously as the first thing in <body>, so
 * there's no flash of the wrong theme.
 */
const THEME_SCRIPT = `(function(){try{var d=document.documentElement;if(!d.dataset.theme){var m=window.matchMedia('(prefers-color-scheme: dark)');d.dataset.theme=m.matches?'dark':'light';m.addEventListener('change',function(e){if(!document.cookie.includes('${THEME_COOKIE}=light')&&!document.cookie.includes('${THEME_COOKIE}=dark')){d.dataset.theme=e.matches?'dark':'light';}});}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const stored = cookies().get(THEME_COOKIE)?.value;
  const theme = resolvedAttr(isThemePref(stored) ? stored : "system");

  return (
    /* suppressHydrationWarning: when the preference is "system" the server
       renders no data-theme and THEME_SCRIPT adds one before React hydrates, so
       the attribute legitimately differs between server and client. It's scoped
       to <html> itself and doesn't extend to any child. */
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <NextTopLoader
          color="#1364F1"
          height={2}
          showSpinner={false}
          shadow={false}
          zIndex={1000}
        />
        {/* Toasts read the design tokens rather than sonner's `richColors`
            palette, which ships its own greens and reds and was the one
            off-palette surface in the app. */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "!font-sans !text-[13px] !rounded !border !border-border !bg-bg-raised !text-ink !shadow-high",
              title: "!font-medium",
              description: "!text-ink-muted",
              actionButton: "!rounded-sm !bg-accent !text-bg-raised",
              cancelButton: "!rounded-sm !bg-bg-sunken !text-ink-muted",
              success: "!bg-success-bg !text-success-ink",
              error: "!bg-bad-bg !text-bad-ink",
              warning: "!bg-warn-bg !text-warn-ink",
              info: "!bg-info-bg !text-info-ink",
            },
          }}
        />
        {/* Refraction for the glass surfaces (notifications tray, command
            palette). A slow turbulence field displaces what's behind the pane
            by a couple of pixels, which is what makes it read as fluted glass
            rather than a blurred rectangle. Referenced from `.glass-tray`. */}
        <svg width="0" height="0" aria-hidden focusable="false" style={{ position: "absolute" }}>
          <filter id="glass-refraction" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves={2} seed={7} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={9} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
