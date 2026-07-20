import { ASSET_QR_FIELD_LABELS, buildAssetQrPayload, resolveAssetQrFields } from "./assetQrUtils";
import { buildQrBitmapTsplCommand } from "./assetQrTsplBitmap";
import {
  DEFAULT_STICKER_SIZE,
  LABEL_BORDER_INSET_MM,
  LABEL_CONTENT_GUTTER_MM,
  LABEL_QR_ZONE_RATIO,
  STICKER_SIZES,
  TSC_DOTS_PER_MM,
} from "./assetQrStickerConstants";

const BORDER_THICKNESS_DOTS = 3;
const DIVIDER_THICKNESS_DOTS = 2;
// Worst case we plan vertical space for: label line + up to 2 value lines, x3 fields.
const WORST_CASE_LINES = 9;

// Approximate TSC built-in bitmap font cell sizes (dots) at x1 magnification —
// used to pick a font that fits, and to word-wrap values; not pixel-perfect,
// but exact for these fixed-width bitmap fonts (equal char count = equal width).
const TSPL_FONT_CHAR_WIDTH_DOTS = { 1: 8, 2: 12, 3: 16, 4: 24, 5: 32 };
const TSPL_FONT_CHAR_HEIGHT_DOTS = { 1: 12, 2: 20, 3: 24, 4: 32, 5: 48 };
const FONT_CANDIDATES_LARGEST_FIRST = ["3", "2", "1"];

function escapeTsplText(value) {
  return String(value ?? "").replace(/"/g, '""');
}

function charWidthDots(font) {
  return TSPL_FONT_CHAR_WIDTH_DOTS[font] ?? 16;
}

function charHeightDots(font) {
  return TSPL_FONT_CHAR_HEIGHT_DOTS[font] ?? 24;
}

function lineHeightForFont(font) {
  const h = charHeightDots(font);
  return h + Math.max(2, Math.round(h * 0.2));
}

/** Picks the largest built-in font that keeps WORST_CASE_LINES within the
 * available text-area height — one constant size for the whole label, no
 * per-value shrinking. Falls back to the smallest font if even that's tight
 * (e.g. very small label presets). */
function pickTableFont(textAreaHeightDots) {
  for (const font of FONT_CANDIDATES_LARGEST_FIRST) {
    if (lineHeightForFont(font) * WORST_CASE_LINES <= textAreaHeightDots) {
      return font;
    }
  }
  return FONT_CANDIDATES_LARGEST_FIRST[FONT_CANDIDATES_LARGEST_FIRST.length - 1];
}

/** Greedy word-wrap to the given character width; hard-breaks a single word
 * that's wider than the whole line on its own. */
function wrapText(value, maxChars) {
  const words = String(value ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (word.length > maxChars) {
      let remaining = word;
      while (remaining.length > maxChars) {
        lines.push(remaining.slice(0, maxChars));
        remaining = remaining.slice(maxChars);
      }
      current = remaining;
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function isTscPrinter(printerName) {
  return /tsc|ta\d+/i.test(String(printerName ?? ""));
}

export function buildValidStickerRows(rows) {
  return (rows || [])
    .map((row) => resolveAssetQrFields(row))
    .filter(({ itemcode, srno }) => itemcode && srno);
}

export function computeStickerLayout(size) {
  const dpmm = TSC_DOTS_PER_MM;
  const borderInset = Math.round(LABEL_BORDER_INSET_MM * dpmm);
  const contentGutter = Math.round(LABEL_CONTENT_GUTTER_MM * dpmm);
  const margin = borderInset + contentGutter;

  const widthDots = Math.round(size.width * dpmm);
  const heightDots = Math.round(size.height * dpmm);
  const usableW = widthDots - margin * 2;
  const usableH = heightDots - margin * 2;
  const isWide = size.width >= size.height * 1.25;

  const border = {
    x1: borderInset,
    y1: borderInset,
    x2: widthDots - borderInset,
    y2: heightDots - borderInset,
    thickness: BORDER_THICKNESS_DOTS,
  };

  if (isWide) {
    const qrZoneWidth = Math.max(0, Math.floor(usableW * LABEL_QR_ZONE_RATIO) - contentGutter);
    const qrMaxDots = Math.min(usableH, qrZoneWidth);
    const qrX = margin;
    const qrY = margin + Math.round((usableH - qrMaxDots) / 2);

    const textX = margin + qrZoneWidth + contentGutter;
    const textTop = margin;
    const textBottom = margin + usableH;

    // Vertical divider centered in the gutter between the QR zone and the text zone.
    const dividerX = Math.round((qrX + qrMaxDots + textX) / 2);
    const divider = { x: dividerX, y: margin, w: DIVIDER_THICKNESS_DOTS, h: usableH };

    return {
      border,
      divider,
      qrX,
      qrY,
      qrMaxDots,
      textX,
      textTop,
      textBottom,
      valueMaxX: margin + usableW,
      font: pickTableFont(textBottom - textTop),
    };
  }

  // Narrow/portrait labels: QR on top, three fields (each label + value line(s)) below.
  const textBand = Math.max(Math.round(usableH * 0.45), Math.round(20 * dpmm));
  const qrSpace = usableH - textBand;
  const qrMaxDots = Math.min(usableW, qrSpace);
  const qrX = margin + Math.max(0, Math.floor((usableW - qrMaxDots) / 2));
  const qrY = margin;

  const textX = margin;
  const textTop = margin + qrSpace;
  const textBottom = margin + usableH;

  // Horizontal divider at the boundary between the QR area (top) and the text band (bottom).
  const divider = { x: margin, y: margin + qrSpace, w: usableW, h: DIVIDER_THICKNESS_DOTS };

  return {
    border,
    divider,
    qrX,
    qrY,
    qrMaxDots,
    textX,
    textTop,
    textBottom,
    valueMaxX: margin + usableW,
    font: pickTableFont(textBottom - textTop),
  };
}

export async function buildTsplStickerCommands(fields, size) {
  const { itemcode, srno } = fields;
  const payload = buildAssetQrPayload(itemcode, srno);
  const layout = computeStickerLayout(size);

  const bitmapCmd = await buildQrBitmapTsplCommand(
    payload,
    layout.qrX,
    layout.qrY,
    layout.qrMaxDots
  );

  const lineHeight = lineHeightForFont(layout.font);
  const maxCharsPerLine = Math.max(
    1,
    Math.floor((layout.valueMaxX - layout.textX) / charWidthDots(layout.font))
  );
  const fieldGap = Math.round(lineHeight * 0.3);

  // Wrap every field's value up front so the total block height is known before
  // any Y position is picked — needed to center the block within the text area.
  const fieldBlocks = ASSET_QR_FIELD_LABELS.map(({ key, label }) => ({
    label,
    valueLines: wrapText(fields[key], maxCharsPerLine),
  }));
  const totalLines = fieldBlocks.reduce((sum, f) => sum + 1 + f.valueLines.length, 0);
  const contentHeight = totalLines * lineHeight + (fieldBlocks.length - 1) * fieldGap;
  const textAreaHeight = layout.textBottom - layout.textTop;
  const startY = layout.textTop + Math.max(0, Math.round((textAreaHeight - contentHeight) / 2));

  const textCmds = [];
  let y = startY;
  fieldBlocks.forEach(({ label, valueLines }, i) => {
    textCmds.push(`TEXT ${layout.textX},${y},"${layout.font}",0,1,1,"${label} :"`);
    y += lineHeight;

    valueLines.forEach((line) => {
      textCmds.push(`TEXT ${layout.textX},${y},"${layout.font}",0,1,1,"${escapeTsplText(line)}"`);
      y += lineHeight;
    });
    if (i < fieldBlocks.length - 1) y += fieldGap;
  });

  const { x1, y1, x2, y2, thickness } = layout.border;
  const { x: divX, y: divY, w: divW, h: divH } = layout.divider;

  return [
    `SIZE ${size.width} mm, ${size.height} mm`,
    "GAP 2 mm, 0 mm",
    "DIRECTION 1",
    "REFERENCE 0,0",
    "OFFSET 0 mm",
    "SET PEEL OFF",
    "SET CUTTER OFF",
    "SPEED 4",
    "DENSITY 12",
    "CLS",
    `BOX ${x1},${y1},${x2},${y2},${thickness}`,
    `BAR ${divX},${divY},${divW},${divH}`,
    bitmapCmd,
    ...textCmds,
    "PRINT 1",
  ].join("\r\n");
}

export async function buildTsplBatch(rows, sizeKey = DEFAULT_STICKER_SIZE) {
  const size = STICKER_SIZES[sizeKey] ?? STICKER_SIZES[DEFAULT_STICKER_SIZE];
  const labels = buildValidStickerRows(rows);

  if (labels.length === 0) {
    throw new Error("Selected rows must have both Item Code and Asset Sr No.");
  }

  const parts = [];
  for (const fields of labels) {
    parts.push(await buildTsplStickerCommands(fields, size));
  }
  return parts.join("\r\n\r\n");
}

export async function buildTsplPrintData(rows, sizeKey = DEFAULT_STICKER_SIZE) {
  const batch = await buildTsplBatch(rows, sizeKey);
  return [{ type: "raw", format: "plain", data: batch }];
}
