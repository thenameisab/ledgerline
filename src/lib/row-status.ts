// Status rows in tables: a neutral row with a 3px left border in the status
// colour, and a tinted fill only on hover. The status chip in the row carries
// the label. The border is an inset shadow on the first cell (the same shadow
// AlertItem uses), because tables use border-collapse, and a box-shadow on a
// <tr> does not render reliably there.
export const ROW_BAD =
  "[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-bad)] hover:bg-bad-bg";
export const ROW_WARN =
  "[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-warn)] hover:bg-warn-bg";
