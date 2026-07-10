/** JSON payload encoded in each asset QR code (exact keys for scanners). */
export function buildAssetQrPayload(itemcode, srno) {
  return JSON.stringify({
    Itemcode: String(itemcode ?? "").trim(),
    Srno: String(srno ?? "").trim(),
  });
}

export function resolveAssetQrFields(row) {
  const itemcode =
    row?.itemcode ??
    row?.ItemCode ??
    row?.itemCode ??
    row?.ITEMCODE ??
    "";
  const itemname =
    row?.itemname ??
    row?.ItemName ??
    row?.itemName ??
    row?.ITEMNAME ??
    "";
  const srno =
    row?.assetsrno ??
    row?.AssetSrNo ??
    row?.assetSrNo ??
    row?.ASSETSRNO ??
    "";

  return {
    itemcode: String(itemcode).trim(),
    itemname: String(itemname).trim(),
    srno: String(srno).trim(),
  };
}

/** Fields printed on every asset QR label (TSPL sticker + PDF export) — same order,
 * same labels, on both renderers. Each renders as its own label line followed by
 * the value, word-wrapped onto further line(s) if it doesn't fit on one — values
 * are never shrunk or cut short. */
export const ASSET_QR_FIELD_LABELS = [
  { key: "itemcode", label: "ITEMCODE" },
  { key: "itemname", label: "ITEMNAME" },
  { key: "srno", label: "SR.NO" },
];
