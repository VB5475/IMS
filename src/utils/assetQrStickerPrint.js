import { DEFAULT_STICKER_SIZE, STICKER_SIZES } from "./assetQrStickerConstants";
import { buildAssetQrLabels } from "./assetQrLabels";
import {
  buildTsplBatch,
  buildValidStickerRows,
  isTscPrinter,
} from "./assetQrTsplPrint";
import { printRawToWindowsPrinter } from "./windowsPrintBridge";

export { DEFAULT_STICKER_SIZE, STICKER_SIZES } from "./assetQrStickerConstants";
export { isTscPrinter } from "./assetQrTsplPrint";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSingleStickerHtml({ itemcode, srno, dataUrl }, size) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: ${size.width}mm ${size.height}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: ${size.width}mm; height: ${size.height}mm; }
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: Arial, Helvetica, sans-serif;
    text-align: center;
    overflow: hidden;
    padding: 1mm;
  }
  img { width: ${size.qr}mm; height: ${size.qr}mm; object-fit: contain; }
  .code { font-size: ${size.codeSize}pt; font-weight: 700; line-height: 1.1; margin-top: 0.5mm; word-break: break-all; }
  .srno { font-size: ${size.srnoSize}pt; line-height: 1.1; margin-top: 0.3mm; word-break: break-all; color: #334155; }
</style></head>
<body>
  <img src="${dataUrl}" alt="QR" />
  <div class="code">${escapeHtml(itemcode)}</div>
  <div class="srno">${escapeHtml(srno)}</div>
</body></html>`;
}

async function printTsplViaQz(qz, printerName, tsplBatch) {
  const config = qz.configs.create(printerName, {
    forceRaw: true,
    encoding: "UTF-8",
  });
  await qz.print(config, [{ type: "raw", format: "plain", data: tsplBatch }]);
}

/**
 * Print sticker QR labels. TSC printers use Windows RAW TSPL (preferred) or QZ Tray.
 */
export async function printAssetStickerQrCodes(
  rows,
  { qz, printerName, sizeKey = DEFAULT_STICKER_SIZE, printMode = "qz" }
) {
  if (!printerName) {
    throw new Error("No sticker printer selected.");
  }

  const size = STICKER_SIZES[sizeKey] ?? STICKER_SIZES[DEFAULT_STICKER_SIZE];

  if (isTscPrinter(printerName)) {
    const tsplBatch = await buildTsplBatch(rows, sizeKey);

    if (printMode === "bridge") {
      await printRawToWindowsPrinter(printerName, tsplBatch);
      return buildValidStickerRows(rows).length;
    }

    if (!qz?.websocket?.isActive()) {
      throw new Error(
        "Print bridge is offline. Run: npm run print-bridge — or start QZ Tray and click QZ."
      );
    }

    await printTsplViaQz(qz, printerName, tsplBatch);
    return buildValidStickerRows(rows).length;
  }

  if (!qz?.websocket?.isActive()) {
    throw new Error("QZ Tray is not running. Install and start QZ Tray, then click QZ to reconnect.");
  }

  const labels = await buildAssetQrLabels(rows);
  const htmlConfig = qz.configs.create(printerName, {
    size: { width: size.width, height: size.height },
    units: "mm",
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    colorType: "grayscale",
    interpolation: "nearest-neighbor",
  });

  const data = labels.map((label) => ({
    type: "pixel",
    format: "html",
    flavor: "plain",
    data: buildSingleStickerHtml(label, size),
  }));

  await qz.print(htmlConfig, data);
  return labels.length;
}
