// constants.js — Asset Parts Indent Detail page config
// Source: MRD_Template4Assetpartindtdeatail_new.docx (Aditya, 20-Aug-2026).

import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Asset Parts Indent Detail";
export const PAGE_TITLE_NEW = "New Asset Parts Indent Detail";

export const APID_CONFIG = {
  RB_MASTER: RB_CODES.ASSET_PARTS_INDENT,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSET_PARTS_INDENT),
  RB_DETAIL: "rb_astindentdet",

  FORM_TAG: "rb_astindentmst",
  TRAN_BOOK: "astpart",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_DIVISION: "fn_tbl_fetchuserwsdivision",
  SP_ASSET_ITEM: "fn_tbl_astitem_fetch",

  SP_MASTER_FILL: "fn_tbl_rb_astindentmst",
  SP_DETAIL_FILL: "fn_tbl_rb_astindentdet",

  SAVE_ENDPOINT: "/API/AstPartIndentDet/Post_RB_AstIndentMst_Save",
  SAVE_DETAIL_JSON_KEY: "prmStrDetJSON",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astindentmst_list",
  LIST_DIVISION_ID: 15,

  STORAGE_HEADER_META: "piHeaderMeta",
  STORAGE_ENTRY_META: "apidEntryMeta",
};

export const APID_GRID_TABS = [{ id: "items", label: "Item Detail" }];

export function applyApidHardcodedHeaderValues(headerValues = {}) {
  return {
    ...headerValues,
    funccode: APID_CONFIG.RB_MASTER,
  };
}

export function resolveApidColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.some((h) => name === h || name.includes(h));
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildApidCascadeResets(fieldDefs) {
  const division = resolveApidColKey(fieldDefs, "divisionid");
  const astItem = resolveApidColKey(fieldDefs, "astitemid");
  const srNo = resolveApidColKey(fieldDefs, "astsrno");
  const tagId = resolveApidColKey(fieldDefs, "asttagid");
  const mln = resolveApidColKey(fieldDefs, "mln");
  const resets = {};
  if (division) resets[division] = [astItem, srNo, tagId, mln].filter(Boolean);
  return resets;
}

/** Parse hardware QR / pasted JSON for Asset Sr No scan — fills tag id + MLN when present. */
export function parseAssetSrScan(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return {
          astsrno: String(parsed.astsrno ?? parsed.srno ?? parsed.SrNo ?? parsed.assetsrno ?? "").trim(),
          asttagid: String(parsed.asttagid ?? parsed.tagid ?? parsed.TagID ?? parsed.asttag ?? "").trim(),
          mln: String(parsed.mln ?? parsed.MLN ?? "").trim(),
        };
      }
    } catch {
      /* fall through — treat as plain sr no */
    }
  }
  return { astsrno: trimmed, asttagid: "", mln: "" };
}

export function buildApidListJsonPayload({
  companyId,
  loginId,
  yearId,
  fromDate,
  toDate,
  divisionId = APID_CONFIG.LIST_DIVISION_ID,
} = {}) {
  const session = getUserSession();
  const year = new Date().getFullYear();
  return {
    prmcompanyid: Number(companyId) || session.companyId,
    prmdivisionid: Number(divisionId) || 0,
    prmyearid: Number(yearId) || session.yearId,
    prmfromdate: fromDate ?? `01-Jan-${year}`,
    prmtodate: toDate ?? `31-Dec-${year}`,
    prmloginid: Number(loginId) || session.loginId,
  };
}
