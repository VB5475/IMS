/** TSC TA200 and common thermal label sizes (width × height mm). */
export const STICKER_SIZES = {
  "100x50": { width: 100, height: 50 },
  "100x25": { width: 100, height: 25 },
  "80x50": { width: 80, height: 50 },
  "60x40": { width: 60, height: 40 },
  "50x38": { width: 50, height: 38 },
  "50x25": { width: 50, height: 25 },
  "40x30": { width: 40, height: 30 },
  "62x29": { width: 62, height: 29 },
};

/** TA200 is a 4-inch printer — 100×50 mm is a common default label. */
export const DEFAULT_STICKER_SIZE = "100x50";

/** TSC TA200 resolution (203 dpi). */
export const TSC_DPI = 203;
export const TSC_DOTS_PER_MM = TSC_DPI / 25.4;
