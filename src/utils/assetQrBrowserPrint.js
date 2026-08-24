import { buildAssetQrLabels } from "./assetQrLabels";
import {
  DEFAULT_STICKER_SIZE,
  PRINTER,
  STICKER_LOGO_URL,
  STICKER_SIZES,
} from "./assetQrStickerConstants";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildStickerCardHtml(label, logoUrl) {
  const rows = [
    ["Tag", label.tag || label.itemcode],
    ["Name", label.model || label.itemname],
    ["S/N", label.serial || label.srno],
    ["E", label.employee || ""],
  ];

  return `
  <div class="sticker-card">
    <div class="sticker-card__qr">
      <img src="${label.dataUrl}" alt="QR" />
    </div>
    <div class="sticker-card__fields">
      ${rows
      .map(
        ([labelText, value]) => `
        <div class="sticker-card__row">
          <span class="sticker-card__label">${escapeHtml(labelText)}:</span>
          <span class="sticker-card__value">${escapeHtml(value)}</span>
        </div>`
      )
      .join("")}
    </div>
  </div>`;
}

function buildPrintDocument(labels, size, logoUrl) {
  const widthIn = size.widthIn ?? PRINTER.widthIn;
  const heightIn = size.heightIn ?? PRINTER.heightIn;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Asset stickers</title>
<style>
  @page { 
    size: ${widthIn}in ${heightIn}in; 
    margin: 0in; /* Fixed: Changed from 5in to 0in so it doesn't clip the stickers */
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @media print {
    html, body, img, .sticker-card {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    img {
      filter: none !important;
      -webkit-filter: none !important;
    }
  }
  .sticker-card {
    width: ${widthIn}in;
    height: ${heightIn}in;
    margin: 0 auto;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: always; /* Ensures each sticker takes up its own designated label page/roll section */
    break-after: page;
    display: flex;
    align-items: center;
    padding: 0.15in; 
    gap: 0.15in;
    background: #fff;
    overflow: hidden;
  }
  .sticker-card__qr {
    width: 1.9685in; /* 50mm converted to inches */
    height: 1.9685in; /* 50mm converted to inches */
    flex-shrink: 0;
    margin-left: 0.18in; /* shifts QR right so it doesn't get cut off at the paper edge */
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
  }
  .sticker-card__qr img {
    width: 100%;
    height: 100%;
    object-path: contain;
    object-fit: contain;
    image-rendering: pixelated;
  }
  .sticker-card__fields {
    flex: 1;
    min-width: 0;
    font-size: 9.5px;
    line-height: 1.3;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .sticker-card__row {
    display: flex;
    gap: 4px;
    margin-bottom: 2px;
  }
  .sticker-card__label {
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .sticker-card__value {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
    word-break: break-word;
  }
</style>
</head>
<body>
${labels.map((label) => buildStickerCardHtml(label, logoUrl)).join("")}
</body>
</html>`;
}

async function loadLogoDataUrl() {
  try {
    const logoUrl = new URL(STICKER_LOGO_URL, window.location.origin).href;
    const res = await fetch(logoUrl, { cache: "force-cache" });
    if (!res.ok) return logoUrl;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return new URL(STICKER_LOGO_URL, window.location.origin).href;
  }
}

/**
 * Print selected asset stickers via the browser print dialog.
 * Page size matches TA220 stock (4.26in × 2.50in). Layout: QR | fields | IMS logo.
 */
export async function printAssetStickersBrowser(rows, sizeKey = DEFAULT_STICKER_SIZE) {
  const size = STICKER_SIZES[sizeKey] ?? STICKER_SIZES[DEFAULT_STICKER_SIZE];
  const [labels, logoDataUrl] = await Promise.all([
    buildAssetQrLabels(rows),
    loadLogoDataUrl(),
  ]);
  const html = buildPrintDocument(labels, size, logoDataUrl);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not open print frame.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  await new Promise((resolve) => {
    // Give QR + color logo a moment to decode before printing.
    setTimeout(resolve, 400);
  });

  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  } finally {
    setTimeout(() => iframe.remove(), 1000);
  }

  return labels.length;
}
