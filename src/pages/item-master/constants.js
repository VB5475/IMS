// Item Master — admin module config (MRD_Template4ItemMst.docx)

export const IM_CONFIG = {
  RB_MASTER: "RB_PurItemMst",
  FORM_TAG: "RB_PurItemMst",
  TRAN_BOOK: "CR",

  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_MASTER_FILL: "fn_tbl_RB_PurItemMst",

  SP_ITEM_TYPE: "Fn_tbl_PUR_ITEMTYPEMST_Fetch",
  SP_MAIN_GROUP: "Fn_tbl_Fetch_MainGroup",
  SP_SUB_GROUP: "Fn_tbl_Fetch_SubGroup",
  SP_TAX: "Fn_tbl_Fetch_Texability",
  SP_TRAN_UNIT: "Fn_tbl_Fetch_TranUnit",
  SP_BASE_UNIT: "Fn_tbl_Fetch_BaseUnit",

  LIST_OBJ_TYPE: 2,
  SP_LIST: "Fn_tbl_Mnt_ItemMst_List",
  LIST_DIVISION_ID: 15,

  SAVE_ENDPOINT: "/API/PurItemMst/Post_RB_PurItemMst_Save",
  STORAGE_HEADER_META: "imItemHeaderMeta",
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
