import { buildAssetQrPayload, resolveAssetQrFields } from "./assetQrUtils";
import { buildQrBitmapTsplCommand } from "./assetQrTsplBitmap";
import {
  DEFAULT_STICKER_SIZE,
  STICKER_SIZES,
  TSC_DOTS_PER_MM,
} from "./assetQrStickerConstants";

function escapeTsplText(value) {
  return String(value ?? "").replace(/"/g, '""');
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
  const margin = Math.round(1.5 * TSC_DOTS_PER_MM);
  const widthDots = Math.round(size.width * TSC_DOTS_PER_MM);
  const heightDots = Math.round(size.height * TSC_DOTS_PER_MM);
  const usableW = widthDots - margin * 2;
  const usableH = heightDots - margin * 2;
  const isWide = size.width >= size.height * 1.25;

  if (isWide) {
    const qrMaxDots = usableH;
    const qrColumn = qrMaxDots;
    const qrX = margin;
    const qrY = margin;

    const textX = margin + qrColumn + margin;
    const textY1 = margin + Math.round(usableH * 0.22);
    const textY2 = margin + Math.round(usableH * 0.58);
    const scale = usableH >= 280 ? 3 : usableH >= 200 ? 2 : 1;

    return {
      qrX,
      qrY,
      qrMaxDots,
      textX,
      textY1,
      textY2,
      fontMain: scale >= 3 ? "5" : scale >= 2 ? "4" : "3",
      fontSub: scale >= 3 ? "4" : "3",
      xMul: scale,
      yMul: scale,
    };
  }

  const textBand = Math.max(Math.round(usableH * 0.28), Math.round(8 * TSC_DOTS_PER_MM));
  const qrSpace = usableH - textBand;
  const qrMaxDots = Math.min(usableW, qrSpace);
  const qrX = margin + Math.max(0, Math.floor((usableW - qrMaxDots) / 2));
  const qrY = margin;

  const textX = margin;
  const textY1 = margin + qrSpace + Math.round(textBand * 0.15);
  const textY2 = margin + qrSpace + Math.round(textBand * 0.55);
  const scale = usableH >= 320 ? 3 : usableH >= 220 ? 2 : usableH >= 160 ? 2 : 1;

  return {
    qrX,
    qrY,
    qrMaxDots,
    textX,
    textY1,
    textY2,
    fontMain: scale >= 3 ? "5" : scale >= 2 ? "4" : "3",
    fontSub: scale >= 2 ? "3" : "2",
    xMul: scale,
    yMul: scale,
  };
}

export async function buildTsplStickerCommands(itemcode, srno, size) {
  const payload = buildAssetQrPayload(itemcode, srno);
  const codeText = escapeTsplText(itemcode);
  const srnoText = escapeTsplText(srno);
  const layout = computeStickerLayout(size);

  const bitmapCmd = await buildQrBitmapTsplCommand(
    payload,
    layout.qrX,
    layout.qrY,
    layout.qrMaxDots
  );

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
    bitmapCmd,
    `TEXT ${layout.textX},${layout.textY1},"${layout.fontMain}",0,${layout.xMul},${layout.yMul},"${codeText}"`,
    `TEXT ${layout.textX},${layout.textY2},"${layout.fontSub}",0,${layout.xMul},${layout.yMul},"${srnoText}"`,
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
  for (const { itemcode, srno } of labels) {
    parts.push(await buildTsplStickerCommands(itemcode, srno, size));
  }
  return parts.join("\r\n\r\n");
}

export async function buildTsplPrintData(rows, sizeKey = DEFAULT_STICKER_SIZE) {
  const batch = await buildTsplBatch(rows, sizeKey);
  return [{ type: "raw", format: "plain", data: batch }];
}
