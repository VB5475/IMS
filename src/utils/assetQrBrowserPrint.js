import { buildAssetQrLabels } from "./assetQrLabels";
import {
  DEFAULT_STICKER_SIZE,
  PRINTER,
  STICKER_CARD_SIZE_IN,
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

function buildStickerCardHtml(label, logoUrl, compact) {
  const rows = [
    ["Tag", label.tag || label.itemcode],
    ["Model", label.model || label.itemname],
    ["Sr. No.", label.serial || label.srno],
    // ["E", label.employee || ""],
  ];

  const fieldsHtml = `
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
    </div>`;

  if (compact) {
    // 20mm-tall stock can't fit the logo header/divider/vertical stack —
    // QR on the left, info fields to the right.
    return `
  <div class="sticker-card sticker-card--compact">
    <div class="sticker-card__qr">
      <img src="${label.dataUrl}" alt="QR" />
    </div>
    ${fieldsHtml}
  </div>`;
  }

  return `
  <div class="sticker-card">
    ${logoUrl ? `<div class="sticker-card__header"><img class="sticker-card__logo" src="${logoUrl}" alt="Logo" /></div>` : ""}
    <div class="sticker-card__qr">
      <img src="${label.dataUrl}" alt="QR" />
    </div>
    <hr class="sticker-card__divider" />
    ${fieldsHtml}
  </div>`;
}

function chunk(items, size) {
  const pages = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

function buildPrintDocument(labels, size, logoUrl, requestedPerPage = 1) {
  const widthIn = size.widthIn ?? PRINTER.widthIn;
  const heightIn = size.heightIn ?? PRINTER.heightIn;
  const compact = Boolean(size.compact);
  const nominalCardIn = STICKER_CARD_SIZE_IN;
  const gapIn = 0.09;
  const cardPaddingIn = 0.08;
  // Small buffer so the card border never sits flush against the physical
  // page edge (which gets clipped by print/preview).
  const pagePaddingIn = 0.05;
  // Vertical room reserved inside each card for the divider + 4 info rows so the
  // QR never grows large enough to crowd out the text.
  const textReserveIn = 0.7;
  // Vertical room reserved for the logo header row (logo height + small gap) so
  // the QR is sized to never grow into it.
  const headerReserveIn = 0.3;

  const usableWidthIn = widthIn - pagePaddingIn * 2;
  const usableHeightIn = heightIn - pagePaddingIn * 2;

  // How many nominal 50x50mm sticker cards fit on the selected page/stock size —
  // this decides the per-page count (e.g. 2-up on TA220, 1-up on exact 50x50 stock).
  const cols = Math.max(1, Math.floor(usableWidthIn / nominalCardIn));
  const rows = Math.max(1, Math.floor(usableHeightIn / nominalCardIn));
  const maxPerPage = cols * rows;
  // Respect the user's chosen sticker-per-page count, but never let it exceed
  // what physically fits the selected size (avoids overflow/clipping).
  const perPage = Math.max(1, Math.min(requestedPerPage, maxPerPage));

  // Stretch each card to fill its grid cell instead of staying pinned at the
  // nominal size, so the printed stickers use the full page instead of leaving
  // it mostly blank.
  const cardWidthIn = +(((usableWidthIn - gapIn * (cols - 1)) / cols).toFixed(4));
  const cardHeightIn = +(((usableHeightIn - gapIn * (rows - 1)) / rows).toFixed(4));
  const qrSizeIn = compact
    ? +Math.max(0.4, cardHeightIn - cardPaddingIn * 2).toFixed(4)
    : +(
        Math.max(
          0.8,
          Math.min(cardWidthIn - cardPaddingIn * 2, cardHeightIn - textReserveIn - headerReserveIn)
        ).toFixed(4)
      );

  const pages = chunk(labels, perPage);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title></title>
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
  .print-page {
    width: ${widthIn}in;
    height: ${heightIn}in;
    padding: ${pagePaddingIn}in;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    align-items: center;
    gap: ${gapIn}in;
  }
  .print-page + .print-page {
    page-break-before: always;
    break-before: page;
  }
  .sticker-card {
    width: ${cardWidthIn}in;
    height: ${cardHeightIn}in;
    border: 1px solid #000;
    border-radius: 0.06in;
    page-break-inside: avoid;
    break-inside: avoid;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: ${cardPaddingIn}in;
    gap: 0.04in;
    background: #fff;
    overflow: hidden;
  }
  .sticker-card__header {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }
  .sticker-card__logo {
    width: 0.26in;
    height: 0.26in;
    object-fit: contain;
  }
  .sticker-card__qr {
    width: ${qrSizeIn}in; /* scaled to fill the card while leaving room for the info rows */
    height: ${qrSizeIn}in;
    flex-shrink: 0;
    margin: 0 auto;
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
  .sticker-card__divider {
    width: 85%;
    border: none;
    border-top: 0.75px solid #999;
    margin: 0 auto;
  }
  .sticker-card__fields {
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
    font-size: 10px;
    line-height: 1.2;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .sticker-card--compact {
    flex-direction: row;
    justify-content: flex-start;
    gap: 0.08in;
  }
  .sticker-card--compact .sticker-card__qr {
    margin: 0;
  }
  .sticker-card--compact .sticker-card__fields {
    width: auto;
    max-width: none;
    margin: 0;
    flex: 1;
    min-width: 0;
  }
  .sticker-card--compact .sticker-card__value {
    overflow: visible;
    white-space: normal;
    word-break: break-word;
  }
  .sticker-card__row {
    display: flex;
    gap: 3px;
    margin-bottom: 1px;
  }
  .sticker-card__label {
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .sticker-card__value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
</head>
<body>
${pages
  .map(
    (pageLabels) =>
      `<div class="print-page">${pageLabels
        .map((label) => buildStickerCardHtml(label, logoUrl, compact))
        .join("")}</div>`
  )
  .join("")}
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
 * Sticker count per physical page is derived from the selected stock size
 * (sizeKey) using a nominal 50x50mm unit — e.g. the default TA220 stock
 * (4.26in x 2.50in) fits 2 per page; an exact 50x50 stock fits 1 per page —
 * capped by `stickersPerPage` when the caller wants fewer than the max that fits.
 * Each card is then stretched (and its QR scaled up) to fill its grid cell
 * rather than staying pinned at the nominal size. Sizes flagged `compact`
 * (e.g. 50x20) render a horizontal QR-left/info-right card instead.
 */
export async function printAssetStickersBrowser(rows, sizeKey = DEFAULT_STICKER_SIZE, stickersPerPage = 1) {
  const size = STICKER_SIZES[sizeKey] ?? STICKER_SIZES[DEFAULT_STICKER_SIZE];
  const [labels, logoDataUrl] = await Promise.all([
    buildAssetQrLabels(rows),
    loadLogoDataUrl(),
  ]);
  const html = buildPrintDocument(labels, size, logoDataUrl, stickersPerPage);

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
