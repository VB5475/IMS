/** JSON payload encoded in each asset QR code (exact keys for scanners). */
export function buildAssetQrPayload(itemcode, srno) {
  return JSON.stringify({
    Itemcode: String(itemcode ?? "").trim(),
    Srno: String(srno ?? "").trim(),
  });
}

function pickFirst(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function resolveAssetQrFields(row) {
  const itemcode = pickFirst(row, [
    "itemcode",
    "ItemCode",
    "itemCode",
    "ITEMCODE",
    "tag",
    "Tag",
    "assettag",
    "AssetTag",
  ]);
  const itemname = pickFirst(row, [
    "itemname",
    "ItemName",
    "itemName",
    "ITEMNAME",
    "model",
    "Model",
    "itemmodel",
    "ItemModel",
  ]);
  const srno = pickFirst(row, [
    "assetsrno",
    "AssetSrNo",
    "assetSrNo",
    "ASSETSRNO",
    "srno",
    "SrNo",
    "serial",
    "Serial",
  ]);

  return {
    itemcode,
    itemname,
    srno,
  };
}

/** Sticker face fields matching the physical asset tag layout. */
export function resolveAssetStickerFields(row) {
  const base = resolveAssetQrFields(row);
  const employee = pickFirst(row, [
    "issued2employee",
    "Issued2Employee",
    "issued2Employee",
    "ISSUED2EMPLOYEE",
    "empname",
    "EmpName",
    "employeename",
    "EmployeeName",
    "employee",
    "Employee",
    "username",
    "UserName",
    "assignedto",
    "AssignedTo",
    "fromempusername",
    "toempusername",
    "empusername",
  ]);

  return {
    tag: base.itemcode,
    model: base.itemname,
    serial: base.srno,
    employee,
    itemcode: base.itemcode,
    itemname: base.itemname,
    srno: base.srno,
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

/** On-sticker labels matching the physical asset tag (Tag / Model / S/N / E). */
export const ASSET_STICKER_FIELD_LABELS = [
  { key: "tag", label: "Tag" },
  { key: "model", label: "Model" },
  { key: "serial", label: "S/N" },
  { key: "employee", label: "E" },
];
