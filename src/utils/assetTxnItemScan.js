import { parseQrItemPayload } from "./qrScanJson";

/** True if grid already has the same itemcode + assetsrno (or srno fallback). */
export function gridHasScannedItem(rows, itemcode, srno) {
  const norm = (value) => String(value ?? "").trim().toLowerCase();
  const code = norm(itemcode);
  const serial = norm(srno);
  if (!code || !serial) return false;
  return (rows || []).some((row) => {
    const rowCode = norm(row.itemcode ?? row.ItemCode);
    const rowSrno = norm(row.assetsrno ?? row.Assetsrno ?? row.srno ?? row.SrNo);
    return rowCode === code && rowSrno === serial;
  });
}

/** Parse pasted/scanned QR JSON for item picker prmqrjson. */
export function normalizeAssetQrSearchJson(rawText) {
  const trimmed = String(rawText ?? "").trim();
  if (!trimmed) return { error: "Enter both Item Code and Sr No." };
  const parsed = parseQrItemPayload(trimmed);
  if (!parsed) {
    return { error: "Invalid JSON. Expected itemcode and srno (any key casing)." };
  }
  return { qrJson: JSON.stringify(parsed) };
}
