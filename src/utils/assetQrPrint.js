import { buildAssetQrLabels } from "./assetQrLabels";
import { buildPrintDocument, loadLogoDataUrl } from "./assetQrBrowserPrint";
import { DEFAULT_STICKER_SIZE, STICKER_SIZES } from "./assetQrStickerConstants";

export { buildAssetQrPayload, resolveAssetQrFields, resolveAssetStickerFields } from "./assetQrUtils";
export { generateQrDataUrl, buildAssetQrLabels } from "./assetQrLabels";

const MM_PER_IN = 25.4;
// Render at a high enough pixel density that the QR stays scannable once
// rasterized into the PDF (the sticker sheet is only a couple of inches wide).
const RENDER_SCALE = 4;

let jsPdfPromise = null;
let html2canvasPromise = null;

function loadJsPdf() {
  if (!jsPdfPromise) jsPdfPromise = import("jspdf");
  return jsPdfPromise;
}

function loadHtml2Canvas() {
  if (!html2canvasPromise) html2canvasPromise = import("html2canvas");
  return html2canvasPromise;
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

/** Renders `html` (the same document the browser print flow generates) into an
 * offscreen iframe so its `.print-page` elements can be captured by html2canvas.
 * Unlike the browser print flow's 0x0 print iframe (fine for `window.print()`,
 * which lays out via `@page` independent of screen viewport), html2canvas takes
 * an actual screenshot of rendered pixels — a 0-sized (or `visibility:hidden`,
 * which inherits) iframe has no real viewport/paint to capture and silently
 * produces a blank canvas. So this iframe gets real pixel dimensions and is
 * pushed off-screen via position instead. */
function renderToHiddenIframe(html, pxWidth, pxHeight) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${pxWidth}px;height:${pxHeight}px;border:0;`;
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not prepare PDF render frame.");
  }
  doc.open();
  doc.write(html);
  doc.close();
  return iframe;
}

async function waitForImagesToDecode(doc) {
  const images = Array.from(doc.images || []);
  await Promise.all(
    images.map((img) =>
      img.decode ? img.decode().catch(() => {}) : Promise.resolve()
    )
  );
}

/**
 * Download a PDF of asset stickers by rendering the exact same sheet HTML the
 * browser print flow produces (one `.print-page` per PDF page, via html2canvas) —
 * so Download PDF can never visually drift from Print again.
 */
export async function downloadAssetQrCodes(rows, sizeKey = DEFAULT_STICKER_SIZE, stickersPerPage = 1) {
  const size = STICKER_SIZES[sizeKey] ?? STICKER_SIZES[DEFAULT_STICKER_SIZE];
  const normalized = {
    ...size,
    widthIn: size.widthIn ?? size.width / MM_PER_IN,
    heightIn: size.heightIn ?? size.height / MM_PER_IN,
  };

  const [{ jsPDF }, { default: html2canvas }, labels, logoDataUrl] = await Promise.all([
    loadJsPdf(),
    loadHtml2Canvas(),
    buildAssetQrLabels(rows),
    loadLogoDataUrl(),
  ]);

  const html = buildPrintDocument(labels, normalized, logoDataUrl, stickersPerPage);
  // Generous off-screen viewport: wide/tall enough that no `.print-page` (each
  // individually sized in the sheet's own CSS) is ever viewport-clipped.
  const pxWidth = Math.ceil(normalized.widthIn * 96) + 40;
  const pxHeight = Math.ceil(normalized.heightIn * 96 * Math.max(1, labels.length)) + 200;
  const iframe = renderToHiddenIframe(html, pxWidth, pxHeight);

  try {
    const frameDoc = iframe.contentDocument;
    await waitForImagesToDecode(frameDoc);

    const pageEls = Array.from(frameDoc.querySelectorAll(".print-page"));
    if (pageEls.length === 0) {
      throw new Error("No sticker pages were generated.");
    }

    const orientation = pageOrientation(normalized);
    const format = [normalized.width, normalized.height];
    const doc = new jsPDF({ orientation, unit: "mm", format });

    for (let i = 0; i < pageEls.length; i += 1) {
      if (i > 0) doc.addPage(format, orientation);
      // Pages must render in order onto the same doc, so this stays sequential.
      const canvas = await html2canvas(pageEls[i], {
        scale: RENDER_SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, normalized.width, normalized.height);
    }

    doc.save(buildDownloadFilename());
    return labels.length;
  } finally {
    iframe.remove();
  }
}

/** @deprecated Use downloadAssetQrCodes instead */
export const printAssetQrCodes = downloadAssetQrCodes;
