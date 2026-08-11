// constants.js — Assets Write Off (AWF) page config
import { getUserSession } from "../../session/userSession";
import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { getMissingMandatoryHeaderLabels } from "../../utils/columnValidation";

export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Assets Write Off";
export const PAGE_TITLE_NEW = "New Assets Write Off";

// Values aligned to MRD_Template4AssetsWriteOff.docx (Richa, 16-Jun-2026).

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const AWF_MULTI_PASTE_COLUMNS = new Set(["batchsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const AWF_REMARK_COLUMNS = new Set(["remark"]);

export const AWF_CONFIG = {
  RB_MASTER: RB_CODES.ASSETS_WRITE_OFF,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSETS_WRITE_OFF),
  DELETE_PROC_NAME: "pr_rb_astwriteoffmst_delete",
  RB_DETAIL: "rb_astwriteoffdet",
  RB_ITEM_PICKER: "rb_astwritoffselonly",

  FORM_TAG: "rb_astwriteoffmst",
  TRAN_BOOK: "ASTWOF",
  FRM_TYPE: "WRT",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS: "Fn_tbl_FetchUserWsDivision",
  SP_LOCATION: "fn_gen_fetchastissfromlocationmaster",
  SP_ASSETS_ACC: "Fn_tbl_Fetch_AssetsAccount",
  SP_ITEM_PICKER: "fn_tbl_rb_astwritoffselonly",
  SP_ITEM_MAIN_GROUP: "fn_fetch_itemmaingroup4popupfilter",
  SP_ITEM_SUB_MAIN_GROUP: "fn_fetch_itemsubmaingroup4popupfilter",

  SP_MASTER_FILL: "fn_tbl_rb_astwriteoffmst",
  SP_DETAIL_FILL: "fn_tbl_rb_astwriteoffdet",

  SAVE_ENDPOINT: "/API/AstWriteOffMst/Post_RB_AstWriteOffMst_Save",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_rb_astwriteoffmst_list",
  LIST_DIVISION_ID: 15,

  STORAGE_HEADER_META: "awfHeaderMeta",
  STORAGE_ENTRY_META: "awfEntryMeta",

  /** Main group for asset account dropdown — CONFIRM with DBA */
  ASSETS_AC_MAIN_GROUP_ID: 7,
  /** Main group for profit/loss account dropdown — CONFIRM with DBA */
  PROFIT_LOSS_AC_MAIN_GROUP_ID: 4,
};

export const AWF_GRID_TABS = [{ id: "items", label: "Item Grid" }];

/** Select Item gate — mandatory fields come only from GET_DETAIL_COL_DATA (IsMandatory + IsVisible). */
export function getMissingItemPickerHeaderFields(headerValues, headerColumns = null) {
  return getMissingMandatoryHeaderLabels(headerValues, headerColumns);
}

/** FN_FETCH_DATA JSON for fn_tbl_rb_astwritoffselonly item picker rows. */
export function buildAwfItemPickerJsonPayload(headerValues, {
  notIn = "",
  maGroupId = 0,
  subMaGroupId = 0,
  itemNameSearch = "",
  qrJson = "",
} = {}) {
  const session = getUserSession();
  return {
    prmcompanyid: session.companyId,
    prmyearid: session.yearId,
    prmdivisionid: Number(headerValues?.divisionid) || 0,
    prmtrandate: headerValues?.trandate ?? "",
    prmaccountid: Number(headerValues?.accountid) || 0,
    prmlocationid: Number(headerValues?.fromlocid ?? headerValues?.locationid) || 0,
    prmnotin: notIn,
    // Trailing SP args — keep this order:
    // prmmaingroupid, prmsubmaingroupid, prmitemnamesearch, prmsearchtext, prmotherstr, prmjson, prmqrjson
    prmmaingroupid: Number(maGroupId) || 0,
    prmsubmaingroupid: Number(subMaGroupId) || 0,
    prmitemnamesearch: String(itemNameSearch ?? "").trim(),
    prmsearchtext: "",
    prmotherstr: "",
    prmjson: "[]",
    prmqrjson: String(qrJson ?? "").trim(),
  };
}

export function resolveAwfColKey(fieldDefs, ...hints) {
  const lowerHints = hints.map((h) => String(h).toLowerCase());
  const found = (fieldDefs || []).find((col) => {
    const name = String(col.colname ?? col.ColName ?? "").toLowerCase();
    return lowerHints.includes(name);
  });
  return found?.colname ?? found?.ColName ?? hints[0] ?? "";
}

export function buildAwfCascadeResets(fieldDefs) {
  const divCol = resolveAwfColKey(fieldDefs, "divisionid", "DivisionID");
  const locCol = resolveAwfColKey(fieldDefs, "fromlocid", "locationid", "LocationID");
  const accCol = resolveAwfColKey(fieldDefs, "accountid", "AccountID");
  const plCol = resolveAwfColKey(fieldDefs, "profitlossactid", "ProfitLossActID");
  if (!divCol) return {};
  return {
    [divCol]: [locCol, accCol, plCol].filter((k) => k && k !== divCol),
  };
}
