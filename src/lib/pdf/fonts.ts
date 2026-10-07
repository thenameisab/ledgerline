import { Font } from "@react-pdf/renderer";
import path from "node:path";

// Font registration for @react-pdf/renderer.
//
// The design system names three families: TASA Orbiter (display headings and
// landmark figures), Inter (body / UI), JetBrains Mono (numerics / codes).
//
// PDF fonts are static TTFs vendored in /public/fonts, generated from the
// @fontsource packages' latin + latin-ext subsets merged into one file per
// weight (see DEPLOY.md). They have to be full files, not aggressively-subset
// woffs, or fontkit's glyph metric reader trips during render.
//
// Two substitutions the screen doesn't need, both for the same reason — the
// Indian Rupee Sign U+20B9:
//
//   1. JetBrains Mono has no ₹ in any release, so the PDF's mono is Source Code
//      Pro, which does.
//   2. TASA Orbiter has no ₹ either. Display type is therefore used for the
//      *words* (brand, account name, period, thank-you) while the currency
//      landmarks — the statement total and grand total — are set in Inter
//      Semibold at the same size. They still read as landmarks; they just
//      aren't display type. Do not move a ₹-bearing style onto "Display".
//
// The screen renders JetBrains Mono and display-type figures as normal; only
// the PDF carries these swaps.

const FONTS = path.join(process.cwd(), "public", "fonts");

let registered = false;

export function registerPdfFonts() {
  if (registered) return;
  registered = true;

  Font.register({
    family: "Display",
    fonts: [
      { src: path.join(FONTS, "TASAOrbiter-Regular.ttf"),  fontWeight: 400 },
      { src: path.join(FONTS, "TASAOrbiter-Semibold.ttf"), fontWeight: 600 },
    ],
  });

  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(FONTS, "Inter-Regular.ttf"),  fontWeight: 400 },
      { src: path.join(FONTS, "Inter-Medium.ttf"),   fontWeight: 500 },
      { src: path.join(FONTS, "Inter-Semibold.ttf"), fontWeight: 600 },
    ],
  });

  Font.register({
    family: "JetBrainsMono",
    fonts: [
      { src: path.join(FONTS, "SourceCodePro-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS, "SourceCodePro-Medium.ttf"),  fontWeight: 500 },
    ],
  });

  // Hyphenation defaults to over-eager English on long product codes like
  // "KY1001_Comprehensive". Disable globally — line breaks go to whitespace
  // only, matching the screen behavior.
  Font.registerHyphenationCallback((word) => [word]);
}
