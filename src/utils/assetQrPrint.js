import { jsPDF } from "jspdf";
import { buildAssetQrLabels } from "./assetQrLabels";
import { ASSET_QR_FIELD_LABELS } from "./assetQrUtils";
import {
  DEFAULT_STICKER_SIZE,
  LABEL_BORDER_INSET_MM,
  LABEL_CONTENT_GUTTER_MM,
  LABEL_QR_ZONE_RATIO,
  STICKER_SIZES,
} from "./assetQrStickerConstants";

export { buildAssetQrPayload, resolveAssetQrFields } from "./assetQrUtils";
export { generateQrDataUrl, buildAssetQrLabels } from "./assetQrLabels";

const MM_PER_PT = 25.4 / 72;
const LINE_SPACING_FACTOR = 1.15;
const FIELD_GAP_FACTOR = 0.4;
// Worst case we plan vertical space for: label line + up to 2 value lines, x3 fields.
const WORST_CASE_LINES = 9;
const MAX_FONT_SIZE = 10;
const MIN_FONT_SIZE = 5;

function lineHeightMm(fontSize) {
  return fontSize * MM_PER_PT * LINE_SPACING_FACTOR;
}

/** One constant font size for the whole label (label + value lines alike) —
 * the largest that keeps WORST_CASE_LINES within the available text-area height,
 * so long values wrap onto new lines instead of shrinking. */
function pickTableFontSize(textAreaHeightMm) {
  for (let size = MAX_FONT_SIZE; size >= MIN_FONT_SIZE; size -= 0.5) {
    if (lineHeightMm(size) * WORST_CASE_LINES <= textAreaHeightMm) return size;
  }
  return MIN_FONT_SIZE;
}

function buildDownloadFilename() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");
  return `asset-qr-codes-${stamp}.pdf`;
}

/** jsPDF's getPageSize() force-swaps a [width, height] array back to portrait
 * unless orientation is explicitly "landscape" — must match on every addPage() too. */
function pageOrientation(size) {
  return size.width >= size.height ? "landscape" : "portrait";
}

/** Same border/QR/divider layout policy as the TSPL sticker (assetQrTsplPrint.js),
 * expressed directly in mm since jsPDF already works in mm — no dots-per-mm conversion needed. */
function computeLabelLayout(size) {
  const margin = LABEL_BORDER_INSET_MM + LABEL_CONTENT_GUTTER_MM;
  const usableW = size.width - margin * 2;
  const usableH = size.height - margin * 2;
  const isWide = size.width >= size.height * 1.25;

  const border = {
    x: LABEL_BORDER_INSET_MM,
    y: LABEL_BORDER_INSET_MM,
    w: size.width - LABEL_BORDER_INSET_MM * 2,
    h: size.height - LABEL_BORDER_INSET_MM * 2,
  };

  if (isWide) {
    const qrZoneWidth = Math.max(0, usableW * LABEL_QR_ZONE_RATIO - LABEL_CONTENT_GUTTER_MM);
    const qrSize = Math.min(usableH, qrZoneWidth);
    const qrX = margin;
    const qrY = margin + (usableH - qrSize) / 2;

    const textX = margin + qrZoneWidth + LABEL_CONTENT_GUTTER_MM;
    const textTop = margin;
    const textBottom = margin + usableH;

    const dividerX = (qrX + qrSize + textX) / 2;
    const divider = { x1: dividerX, y1: margin, x2: dividerX, y2: margin + usableH };

    return {
      border,
      divider,
      qrX,
      qrY,
      qrSize,
      textX,
      textTop,
      textBottom,
      valueMaxX: margin + usableW,
      fontSize: pickTableFontSize(textBottom - textTop),
    };
  }

  // Narrow/portrait labels: QR on top, three fields (each label + value line(s)) below.
  const textBand = Math.max(usableH * 0.45, 20);
  const qrSpace = usableH - textBand;
  const qrSize = Math.min(usableW, qrSpace);
  const qrX = margin + Math.max(0, (usableW - qrSize) / 2);
  const qrY = margin;

  const textX = margin;
  const textTop = margin + qrSpace;
  const textBottom = margin + usableH;

  const dividerY = margin + qrSpace;
  const divider = { x1: margin, y1: dividerY, x2: margin + usableW, y2: dividerY };

  return {
    border,
    divider,
    qrX,
    qrY,
    qrSize,
    textX,
    textTop,
    textBottom,
    valueMaxX: margin + usableW,
    fontSize: pickTableFontSize(textBottom - textTop),
  };
}

function drawLabel(doc, { itemcode, itemname, srno, dataUrl }, size) {
  const layout = computeLabelLayout(size);
  const values = { itemcode, itemname, srno };

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(layout.border.x, layout.border.y, layout.border.w, layout.border.h);

  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.2);
  doc.line(layout.divider.x1, layout.divider.y1, layout.divider.x2, layout.divider.y2);

  doc.addImage(dataUrl, "PNG", layout.qrX, layout.qrY, layout.qrSize, layout.qrSize);

  const lineH = lineHeightMm(layout.fontSize);
  const fieldGap = lineH * FIELD_GAP_FACTOR;
  const valueMaxWidth = Math.max(0, layout.valueMaxX - layout.textX);

  // Wrap every field's value up front (font must be set first — splitTextToSize
  // measures against the currently active font/size) so the total block height
  // is known before any Y position is picked, to center the block in the text area.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(layout.fontSize);
  const fieldBlocks = ASSET_QR_FIELD_LABELS.map(({ key, label }) => ({
    label,
    valueLines: doc.splitTextToSize(String(values[key] ?? ""), valueMaxWidth),
  }));
  const totalLines = fieldBlocks.reduce((sum, f) => sum + 1 + f.valueLines.length, 0);
  const contentHeight = totalLines * lineH + (fieldBlocks.length - 1) * fieldGap;
  const textAreaHeight = layout.textBottom - layout.textTop;
  const blockTop = layout.textTop + Math.max(0, (textAreaHeight - contentHeight) / 2);

  let y = blockTop + lineH * 0.8; // first baseline, not the block's top edge
  fieldBlocks.forEach(({ label, valueLines }, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(layout.fontSize);
    doc.text(`${label} :`, layout.textX, y);
    y += lineH;

    doc.setFont("helvetica", "normal");
    valueLines.forEach((line) => {
      doc.text(line, layout.textX, y);
      y += lineH;
    });
    if (i < fieldBlocks.length - 1) y += fieldGap;
  });
}

function buildAssetQrPdf(labels, size) {
  const orientation = pageOrientation(size);
  const format = [size.width, size.height];
  const doc = new jsPDF({ orientation, unit: "mm", format });

  labels.forEach((label, index) => {
    if (index > 0) doc.addPage(format, orientation);
    drawLabel(doc, label, size);
  });

  return doc;
}

/**
 * Generate QR codes for the given rows and download a PDF — one label per page,
 * sized and styled identically to the TSC thermal sticker (border, QR, divider,
 * and ITEMCODE/ITEMNAME/SR.NO as label-then-value stacked rows) so this can serve
 * as a preview or a backup print path for the same physical label stock.
 */
export async function downloadAssetQrCodes(rows, sizeKey = DEFAULT_STICKER_SIZE) {
  const size = STICKER_SIZES[sizeKey] ?? STICKER_SIZES[DEFAULT_STICKER_SIZE];
  const labels = await buildAssetQrLabels(rows);

  const doc = buildAssetQrPdf(labels, size);
  doc.save(buildDownloadFilename());

  return labels.length;
}
/** @deprecated Use downloadAssetQrCodes instead */
export const printAssetQrCodes = downloadAssetQrCodes;
