/** TSC TA220 label stock used by the asset sticker printer (width × height). */
export const PRINTER = {
  model: "TA220",
  widthIn: 4.26,
  heightIn: 2.5,
};

/** mm equivalents of PRINTER inches (1 in = 25.4 mm). */
export const STICKER_SIZES = {
  ta220: {
    width: +(PRINTER.widthIn * 25.4).toFixed(3),
    height: +(PRINTER.heightIn * 25.4).toFixed(3),
    widthIn: PRINTER.widthIn,
    heightIn: PRINTER.heightIn,
  },
  // Kept for older callers / PDF fallbacks
  "2x4in": { width: 101.6, height: 50.8 },
  "100x50": { width: 100, height: 50 },
};

/** Current physical label stock: TA220 4.26in × 2.50in. */
export const DEFAULT_STICKER_SIZE = "ta220";

/** Public logo used on the right of each sticker. */
export const STICKER_LOGO_URL = "/test.png";

/** TSC TA200/TA220 resolution (203 dpi). */
export const TSC_DPI = 203;
export const TSC_DOTS_PER_MM = TSC_DPI / 25.4;

// Shared label layout policy — used by TSPL / legacy PDF paths.
export const LABEL_BORDER_INSET_MM = 1.5;
export const LABEL_CONTENT_GUTTER_MM = 2;
export const LABEL_QR_ZONE_RATIO = 0.4;
