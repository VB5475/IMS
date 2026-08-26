// constants.js — Assets BOM Master page config
// Source: MRD_Template4BOMMaster.docx (Aditya, 24-Aug-2026).

import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Assets BOM Master";
export const PAGE_TITLE_NEW = "New Assets BOM Master";

export const BOM_GRID_TABS = [{ id: "items", label: "Item Grid" }];

/** Header Tab / cascade focus order — Unit is read-only and skipped in tab chain. */
export const BOM_HEADER_FOCUS_ORDER = [
  "divisionid",
  "bomitemid",
  "unit",
  "bomname",
  "bomqty",
  "description",
  "isdeactive",
];

export function sortBomHeaderFilters(filters) {
  const orderMap = new Map(BOM_HEADER_FOCUS_ORDER.map((key, index) => [key, index]));
  return [...filters].sort((a, b) => {
    const aKey = String(a.FilterColName ?? a.FilterParameterID ?? "").toLowerCase();
    const bKey = String(b.FilterColName ?? b.FilterParameterID ?? "").toLowerCase();
    const aOrd = orderMap.has(aKey) ? orderMap.get(aKey) : 999;
    const bOrd = orderMap.has(bKey) ? orderMap.get(bKey) : 999;
    if (aOrd !== bOrd) return aOrd - bOrd;
    return Number(a.columnMeta?.colseqno ?? 0) - Number(b.columnMeta?.colseqno ?? 0);
  });
}

export const BOM_CONFIG = {
  RB_MASTER: RB_CODES.BOM_MASTER,
  ROUTE_PATH: rbRoutePath(RB_CODES.BOM_MASTER),
  RB_DETAIL: "rb_astbomdet",
  RB_ITEM_PICKER: "rb_astbommselonly",

  FORM_TAG: "rb_astbommaster",
  TRAN_BOOK: "ABOM",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DIVISION: "fn_tbl_fetchuserwsdivision",
  SP_BOM_ITEM: "fn_tbl_bomitem_fetch",

  SP_MASTER_FILL: "fn_tbl_rb_astbommaster",
  SP_DETAIL_FILL: "fn_tbl_rb_astbomdet",
  SP_ITEM_PICKER: "fn_tbl_rb_astbommselonly",

  SAVE_ENDPOINT: "/API/AstBomMaster/Post_RB_AstBomMaster_Save",
  SAVE_DETAIL_JSON_KEY: "prmStrDetJSON",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astbommaster_list",
  LIST_DIVISION_ID: 0,

  STORAGE_HEADER_META: "bomHeaderMeta",
  STORAGE_DETAIL_META: "bomDetailMeta",
};

function pickHeaderInt(headerValues, ...keys) {
  for (const key of keys) {
    const raw = headerValues?.[key];
    if (raw != null && raw !== "") return Number(raw) || 0;
  }
  return 0;
}

/** Item picker — MRD §5.1 params (note SP typo prmdivisonid). */
export function buildBomItemPickerJsonPayload(headerValues = {}) {
  const session = getUserSession();
  return {
    prmdivisonid: pickHeaderInt(headerValues, "divisionid", "DivisionID"),
    prmcompanyid: session.companyId,
    prmloginid: session.loginId,
    prmyearid: session.yearId,
  };
}

export function resolveBomColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildBomCascadeResets(fieldDefs) {
  const division = resolveBomColKey(fieldDefs, "divisionid");
  const bomItem = resolveBomColKey(fieldDefs, "bomitemid");
  const unit = resolveBomColKey(fieldDefs, "unit");
  const unitId = resolveBomColKey(fieldDefs, "unitidnumber");
  const resets = {};
  if (division) resets[division] = [bomItem, unit, unitId].filter(Boolean);
  return resets;
}
