// constants.js — Assets Write Off (AWF) page config
export { ENTRY_FORM_LABEL } from "../../constants/uiStrings";
export const PAGE_TITLE = "Assets Write Off";
export const PAGE_TITLE_NEW = "New Assets Write Off";

// Values aligned to MRD_Template4AssetsWriteOff.docx (Richa, 16-Jun-2026).

/** Item-grid column that supports multi-value paste (Serial Number replication). */
export const AWF_MULTI_PASTE_COLUMNS = new Set(["batchsrno"]);

/** Item-grid column that opens the paste-friendly remark modal (EntryGrid remarkModalColumns). */
export const AWF_REMARK_COLUMNS = new Set(["remark"]);

export const AWF_CONFIG = {
  RB_MASTER: "rb_astwriteoffmst",
  DELETE_PROC_NAME: "pr_rb_astwriteoffmst_delete",
  RB_DETAIL: "rb_astwriteoffdet",
  RB_ITEM_PICKER: "rb_astwritoffselonly",

  FORM_TAG: "rb_astwriteoffmst",
  TRAN_BOOK: "ASTWOF",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DIVISIONS: "Fn_tbl_FetchUserWsDivision",
  SP_LOCATION: "Fn_Gen_FetchLocationMaster",
  SP_ASSETS_ACC: "Fn_tbl_Fetch_AssetsAccount",
  SP_ITEM_PICKER: "fn_tbl_rb_astwritoffselonly",

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

const AWF_ITEM_PICKER_REQUIRED_FIELDS = [
  { keys: ["divisionid", "DivisionID"], label: "Division" },
  { keys: ["trandate", "TranDate"], label: "Write-off Date", isDate: true },
  { keys: ["fromlocid", "LocationID", "locationid"], label: "From Location" },
  { keys: ["accountid", "AccountID"], label: "Account" },
];

function pickHeaderValue(headerValues, keys) {
  if (!headerValues) return undefined;
  for (const key of keys) {
    if (headerValues[key] !== undefined && headerValues[key] !== null && headerValues[key] !== "") {
      return headerValues[key];
    }
  }
  return undefined;
}

function isMissingValue(field, value) {
  if (field.isDate) return value == null || value === "";
  if (value == null || value === "") return true;
  return Number(value) === 0 || value === "0";
}

export function getMissingItemPickerHeaderFields(headerValues) {
  return AWF_ITEM_PICKER_REQUIRED_FIELDS.filter((f) =>
    isMissingValue(f, pickHeaderValue(headerValues, f.keys))
  ).map((f) => f.label);
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
