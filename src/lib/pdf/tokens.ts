// PDF design tokens — mirrors DESIGN.md.
//
// @react-pdf/renderer's StyleSheet doesn't understand CSS custom properties, so
// we materialize the screen tokens as sRGB hex here. The screen tokens are hex
// too now, so this is a straight mirror rather than a colour-space conversion —
// keep the *pairings* (text + bg) WCAG AA when either side moves.
//
// PDFs are light-only by design: a statement is a printed artifact, so the dark
// theme never applies here.
//
// When the design system's tokens change, update both files in lockstep.

export const pdf = {
  color: {
    bg:           "#F7F7F7", // cool neutral page
    bgRaised:     "#FFFFFF",
    bgSunken:     "#EFF0F1",
    ink:          "#050505",
    inkMuted:     "#292F32",
    inkFaint:     "#616D75",
    border:       "#DEE1E3",

    accent:       "#1364F1", // azure
    accentBg:     "#E9F1FE",
    accentInk:    "#0E54CD",

    // status family — Blade feedback palette, paired bg/ink AA-safe
    okBg:         "#E9F1FE",
    okInk:        "#0E54CD",

    warnBg:       "#FDF0E6",
    warnInk:      "#9C4100",

    badBg:        "#FBEAE8",
    badInk:       "#91150C",

    infoBg:       "#E3F4FC",
    infoInk:      "#00648F",

    successBg:    "#E5F5ED",
    successInk:   "#006432",
  },

  // 1.125 ratio scale, mirrors tokens.css §2.2.
  text: {
    xs:   8,
    sm:   9,
    base: 10,
    md:   11,
    lg:   13,
    xl:   16,
    "2xl": 20,
    "3xl": 26,
    "4xl": 32,
  },

  // 8px base unit; type uses pt in PDF, but 1pt = 1.333px on a 96dpi screen.
  // Spacing here is given in PDF points (pt) so layout is print-accurate.
  space: {
    px:  0.5,
    1:   2,
    2:   4,
    3:   6,
    4:   8,
    5:   12,
    6:   16,
    7:   20,
    8:   24,
    10:  32,
  },

  // Stroke width for hairlines. PDFs render 0.5pt as a visible hairline on
  // both screen and print. 1pt reads heavy in print.
  hairline: 0.5,

  // A4 portrait minus 0.5 inch margins; defines the content width.
  page: {
    size: "A4" as const,
    margin: {
      top:    44,
      right:  48,
      bottom: 44,
      left:   48,
    },
  },
} as const;

export type PdfTokens = typeof pdf;
