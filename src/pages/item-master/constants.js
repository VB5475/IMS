// Item Master — admin module config (MRD_Template4ItemMst.docx)

export const IM_CONFIG = {
  RB_MASTER: "rb_puritemmst",
  FORM_TAG: "rb_puritemmst",
  TRAN_BOOK: "CR",

  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_MASTER_FILL: "fn_tbl_rb_puritemmst",

  SP_ITEM_TYPE:      "fn_tbl_pur_itemtypemst_fetch",
  SP_MAIN_GROUP:     "fn_tbl_fetch_maingroup",
  SP_SUB_MAIN_GROUP: "fn_tbl_fetch_submaingroup",
  SP_SUB_GROUP:      "fn_tbl_fetch_subgroup",
  SP_TAX: "fn_tbl_fetch_texability",
  SP_TRAN_UNIT: "fn_tbl_fetch_tranunit",
  SP_BASE_UNIT: "fn_tbl_fetch_baseunit",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "fn_tbl_mnt_itemmst_list",
  LIST_DIVISION_ID: 15,

  DELETE_PROC_NAME: "pr_rb_puritemmst_delete",

  SAVE_ENDPOINT: "/API/PurItemMst/Post_RB_PurItemMst_Save",
  STORAGE_HEADER_META: "imitemheadermeta",
};

/** RB colnames for Sub Group levels (all lowercase — PG returns lowercase keys). */
export const IM_SUB_GROUP_FIELDS = [
  "subgroupid1",
  "subgroupid2",
  "subgroupid3",
  "subgroupid4",
  "subgroupid5",
  "subgroupid6",
  "subgroupid7",
  "subgroupid8",
  "subgroupid9",
  "subgroup10",
];

export const IM_DROPDOWN_FIELDS = new Set([
  "itemtypeid",
  "maingroupid",
  "submaingroupid",
  ...IM_SUB_GROUP_FIELDS,
  "taxabilityid",
  "tranunitid",
  "baseunitid",
]);

/** Cleared when Item Type changes (MRD cascade). */
export const IM_ITEM_TYPE_CASCADE_RESETS = [
  "maingroupid",
  "submaingroupid",
  ...IM_SUB_GROUP_FIELDS,
];

/** Cleared when Main Group changes. */
export const IM_MAIN_GROUP_CASCADE_RESETS = ["submaingroupid", ...IM_SUB_GROUP_FIELDS];

/** Cleared when Sub Main Group changes. */
export const IM_SUB_MAIN_GROUP_CASCADE_RESETS = [...IM_SUB_GROUP_FIELDS];
