import QRCode from "qrcode";

/**
 * Build a TSPL BITMAP command from QR payload.
 * Avoids QRCODE command issues with JSON double-quotes in the data string.
 */
export async function buildQrBitmapTsplCommand(payload, x, y, maxSizeDots) {
  const qr = await QRCode.create(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
  });

  const moduleCount = qr.modules.size;
  const scale = Math.max(1, Math.floor(maxSizeDots / moduleCount));
  const pixelW = moduleCount * scale;
  const pixelH = moduleCount * scale;
  const widthBytes = Math.ceil(pixelW / 8);

  const bytes = [];
  for (let py = 0; py < pixelH; py += 1) {
    const my = Math.min(moduleCount - 1, Math.floor(py / scale));
    for (let bx = 0; bx < widthBytes; bx += 1) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const px = bx * 8 + bit;
        if (px >= pixelW) continue;
        const mx = Math.min(moduleCount - 1, Math.floor(px / scale));
        const dark =
          typeof qr.modules.get === "function"
            ? qr.modules.get(mx, my)
            : qr.modules.data[my * moduleCount + mx];
        if (dark) {
          byte |= 0x80 >> bit;
        }
      }
      bytes.push(byte);
    }
  }

  const hex = bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join("");
  return `BITMAP ${x},${y},${widthBytes},${pixelH},0,${hex}`;
}
