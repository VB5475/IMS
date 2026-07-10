import QRCode from "qrcode";
import { buildAssetQrPayload, resolveAssetQrFields } from "./assetQrUtils";

export async function generateQrDataUrl(text, size = 280) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
  });
}

export async function buildAssetQrLabels(rows) {
  const validRows = (rows || [])
    .map((row) => {
      const { itemcode, srno } = resolveAssetQrFields(row);
      return { itemcode, srno };
    })
    .filter(({ itemcode, srno }) => itemcode && srno);

  if (validRows.length === 0) {
    throw new Error("Selected rows must have both Item Code and Asset Sr No.");
  }

  return Promise.all(
    validRows.map(async ({ itemcode, srno }) => {
      const payload = buildAssetQrPayload(itemcode, srno);
      const dataUrl = await generateQrDataUrl(payload, 320);
      return { itemcode, srno, dataUrl };
    })
  );
}
