import { buildAssetQrLabels } from "./assetQrLabels";
import { ASSET_STICKER_FIELD_LABELS } from "./assetQrUtils";
import {
  DEFAULT_STICKER_SIZE,
  STICKER_LOGO_URL,
  STICKER_SIZES,
} from "./assetQrStickerConstants";

export { buildAssetQrPayload, resolveAssetQrFields, resolveAssetStickerFields } from "./assetQrUtils";
export { generateQrDataUrl, buildAssetQrLabels } from "./assetQrLabels";

const MM_PER_IN = 25.4;

let jsPdfPromise = null;

function loadJsPdf() {
  if (!jsPdfPromise) jsPdfPromise = import("jspdf");
  return jsPdfPromise;
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

function pageOrientation(size) {
  return size.width >= size.height ? "landscape" : "portrait";
}

async function loadLogoDataUrl() {
  try {
    const res = await fetch(STICKER_LOGO_URL, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawLabel(doc, label, size, logoDataUrl) {
  const margin = 4;
  const qrSize = Math.min(size.height - margin * 2, size.width * 0.38);
  const qrX = margin;
  const qrY = (size.height - qrSize) / 2;

  doc.addImage(label.dataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  const logoSize = 16;
  const logoX = size.width - margin - logoSize;
  const logoY = margin + 1;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", logoX, logoY, logoSize, logoSize);
    } catch {
      // Logo optional — sticker text/QR still print.
    }
  }

  const textX = qrX + qrSize + 4;
  const textMaxW = Math.max(10, logoX - textX - 2);
  const values = {
    tag: label.tag || label.itemcode || "",
    model: label.model || label.itemname || "",
    serial: label.serial || label.srno || "",
    employee: label.employee || "",
  };

  const fontSize = 9;
  const lineH = fontSize * 0.42;
  let y = qrY + lineH + 2;

  ASSET_STICKER_FIELD_LABELS.forEach(({ key, label: fieldLabel }) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    const prefix = `${fieldLabel}: `;
    const prefixW = doc.getTextWidth(prefix);
    doc.text(prefix, textX, y);

    doc.setFont("helvetica", "normal");
    const valueLines = doc.splitTextToSize(String(values[key] ?? ""), Math.max(8, textMaxW - prefixW));
    doc.text(valueLines[0] || "", textX + prefixW, y);
    y += lineH + 1.2;
  });
}

function buildAssetQrPdf(jsPDF, labels, size, logoDataUrl) {
  const orientation = pageOrientation(size);
  const format = [size.width, size.height];
  const doc = new jsPDF({ orientation, unit: "mm", format });

  labels.forEach((label, index) => {
    if (index > 0) doc.addPage(format, orientation);
    drawLabel(doc, label, size, logoDataUrl);
  });

  return doc;
}

/**
 * Download a PDF of asset stickers — one page per selected row, TA220 size,
 * layout: QR | Tag/Model/S/N/E | IMS logo.
 */
export async function downloadAssetQrCodes(rows, sizeKey = DEFAULT_STICKER_SIZE) {
  const size = STICKER_SIZES[sizeKey] ?? STICKER_SIZES[DEFAULT_STICKER_SIZE];
  // Ensure inch fields exist for any legacy size keys.
  const normalized = {
    ...size,
    widthIn: size.widthIn ?? size.width / MM_PER_IN,
    heightIn: size.heightIn ?? size.height / MM_PER_IN,
  };
  const { jsPDF } = await loadJsPdf();
  const labels = await buildAssetQrLabels(rows);
  const logoDataUrl = await loadLogoDataUrl();
  const doc = buildAssetQrPdf(jsPDF, labels, normalized, logoDataUrl);
  doc.save(buildDownloadFilename());
  return labels.length;
}

/** @deprecated Use downloadAssetQrCodes instead */
export const printAssetQrCodes = downloadAssetQrCodes;
