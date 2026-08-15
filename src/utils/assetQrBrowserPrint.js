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
    ["Model", label.model || label.itemname],
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
    <div class="sticker-card__logo">
      <img src="${escapeHtml(logoUrl)}" alt="IMS" />
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
  @page { size: ${widthIn}in ${heightIn}in; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  @media print {
    html, body, img, .sticker-card, .sticker-card__logo {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    img {
      filter: none !important;
      -webkit-filter: none !important;
    }
  }
  .sticker-card {
    width: ${widthIn}in;
    height: ${heightIn}in;
    page-break-after: always;
    display: flex;
    align-items: center;
    gap: 0.18in;
    padding: 0.16in 0.18in;
    background: #fff;
    overflow: hidden;
  }
  .sticker-card:last-child { page-break-after: auto; }
  .sticker-card__qr {
    width: 1.7in;
    height: 1.7in;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
  }
  .sticker-card__qr img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }
  .sticker-card__fields {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    line-height: 1.55;
  }
  .sticker-card__row {
    display: flex;
    gap: 6px;
    margin-bottom: 3px;
  }
  .sticker-card__label {
    font-weight: 700;
    white-space: nowrap;
  }
  .sticker-card__value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sticker-card__logo {
    width: 0.72in;
    height: 0.72in;
    flex-shrink: 0;
    border-radius: 50%;
    overflow: hidden;
    align-self: flex-start;
    margin-top: 0.06in;
    background: #fff;
  }
  .sticker-card__logo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: none !important;
    -webkit-filter: none !important;
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
