import QRCode from "qrcode";
import { buildAssetQrPayload, resolveAssetStickerFields } from "./assetQrUtils";

export async function generateQrDataUrl(text, size = 280) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
  });
}

export async function buildAssetQrLabels(rows) {
  const validRows = (rows || [])
    .map((row) => resolveAssetStickerFields(row))
    .filter(({ itemcode, srno }) => itemcode && srno);

  if (validRows.length === 0) {
    throw new Error("Selected rows must have both Item Code and Asset Sr No.");
  }

  return Promise.all(
    validRows.map(async (fields) => {
      const payload = buildAssetQrPayload(fields.itemcode, fields.itemname, fields.srno);
      const dataUrl = await generateQrDataUrl(payload, 600);
      return { ...fields, dataUrl };
    })
  );
}
