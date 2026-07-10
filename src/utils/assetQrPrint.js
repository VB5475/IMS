import { jsPDF } from "jspdf";
import { buildAssetQrLabels } from "./assetQrLabels";

export { buildAssetQrPayload, resolveAssetQrFields } from "./assetQrUtils";
export { generateQrDataUrl, buildAssetQrLabels } from "./assetQrLabels";
const LABELS_PER_PAGE = 21;
const GRID_COLUMNS = 3;
const GRID_ROWS = 7;
const PAGE_MARGIN_MM = 10;
const QR_SIZE_MM = 28;
const CELL_WIDTH_MM = (210 - PAGE_MARGIN_MM * 2) / GRID_COLUMNS;
const CELL_HEIGHT_MM = (297 - PAGE_MARGIN_MM * 2) / GRID_ROWS;

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

function drawLabel(doc, { itemcode, srno, dataUrl }, index) {
  if (index > 0 && index % LABELS_PER_PAGE === 0) {
    doc.addPage();
  }

  const posOnPage = index % LABELS_PER_PAGE;
  const col = posOnPage % GRID_COLUMNS;
  const row = Math.floor(posOnPage / GRID_COLUMNS);

  const cellX = PAGE_MARGIN_MM + col * CELL_WIDTH_MM;
  const cellY = PAGE_MARGIN_MM + row * CELL_HEIGHT_MM;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(cellX + 1, cellY + 1, CELL_WIDTH_MM - 2, CELL_HEIGHT_MM - 2);

  const qrX = cellX + (CELL_WIDTH_MM - QR_SIZE_MM) / 2;
  const qrY = cellY + 4;
  doc.addImage(dataUrl, "PNG", qrX, qrY, QR_SIZE_MM, QR_SIZE_MM);

  const textX = cellX + CELL_WIDTH_MM / 2;
  const textMaxWidth = CELL_WIDTH_MM - 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(itemcode, textX, qrY + QR_SIZE_MM + 4, {
    align: "center",
    maxWidth: textMaxWidth,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(srno, textX, qrY + QR_SIZE_MM + 9, {
    align: "center",
    maxWidth: textMaxWidth,
  });
}

function buildAssetQrPdf(labels) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  labels.forEach((label, index) => {
    drawLabel(doc, label, index);
  });

  return doc;
}

/**
 * Generate QR codes for the given rows and download a PDF file
 * with an A4 layout (3 × 7 labels per page).
 */
export async function downloadAssetQrCodes(rows) {
  const labels = await buildAssetQrLabels(rows);

  const doc = buildAssetQrPdf(labels);
  doc.save(buildDownloadFilename());

  return labels.length;
}
/** @deprecated Use downloadAssetQrCodes instead */
export const printAssetQrCodes = downloadAssetQrCodes;
