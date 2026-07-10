/** TSC TA200 and common thermal label sizes (width × height mm). */
export const STICKER_SIZES = {
  "2x4in": { width: 101.6, height: 50.8 }, // exact 4in (width) x 2in (height) — current default stock
  "100x50": { width: 100, height: 50 },
  "100x25": { width: 100, height: 25 },
  "80x50": { width: 80, height: 50 },
  "60x40": { width: 60, height: 40 },
  "50x38": { width: 50, height: 38 },
  "50x25": { width: 50, height: 25 },
  "40x30": { width: 40, height: 30 },
  "62x29": { width: 62, height: 29 },
};

/** Current physical label stock: 4in x 2in. */
export const DEFAULT_STICKER_SIZE = "2x4in";

/** TSC TA200 resolution (203 dpi). */
export const TSC_DPI = 203;
export const TSC_DOTS_PER_MM = TSC_DPI / 25.4;

// Shared label layout policy — same numbers used by both renderers (TSPL sticker
// print and the PDF export) so the two stay visually identical.
/** Border frame inset from the physical label edge. */
export const LABEL_BORDER_INSET_MM = 1.5;
/** Gap kept between the border frame and the QR/text content inside it. */
export const LABEL_CONTENT_GUTTER_MM = 2;
/** Wide (landscape) labels split QR | text left-to-right; the QR zone's width share. */
export const LABEL_QR_ZONE_RATIO = 0.4;
