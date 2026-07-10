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
  const srno =
    row?.assetsrno ??
    row?.AssetSrNo ??
    row?.assetSrNo ??
    row?.ASSETSRNO ??
    "";
  // return { itemcode: String(itemcode).trim(), srno: String(srno).trim() };

  return {
    "itemcode": "ASS000595",
    "srno": "S4EUNZ0R200413"
  }
}
