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

/** GET_DETAIL_COL_DATA — Sub Group 1–9 + Sub Group 10. */
export const IM_SUB_GROUP_FIELDS = [
  "SubGroupID1",
  "SubGroupID2",
  "SubGroupID3",
  "SubGroupID4",
  "SubGroupID5",
  "SubGroupID6",
  "SubGroupID7",
  "SubGroupID8",
  "SubGroupID9",
  "SubGroup10",
];

export const IM_DROPDOWN_FIELDS = new Set([
  "ItemTypeID",
  "MainGroupID",
  "SubMainGroupID",
  ...IM_SUB_GROUP_FIELDS,
  "TaxabilityID",
  "TranUnitID",
  "BaseUnitID",
]);

/** Cleared when Item Type changes (MRD cascade). */
export const IM_ITEM_TYPE_CASCADE_RESETS = [
  "MainGroupID",
  "SubMainGroupID",
  ...IM_SUB_GROUP_FIELDS,
];

/** Cleared when Main Group changes. */
export const IM_MAIN_GROUP_CASCADE_RESETS = ["SubMainGroupID", ...IM_SUB_GROUP_FIELDS];

/** Cleared when Sub Main Group changes. */
export const IM_SUB_MAIN_GROUP_CASCADE_RESETS = [...IM_SUB_GROUP_FIELDS];

/** Master-fill API may still return pre-refactor column names. */
export const IM_LEGACY_MASTER_COL_MAP = {
  ItemTypeID: "ItemType",
  MainGroupID: "MainGroup",
  SubMainGroupID: "SubMainGroup",
  SubGroupID1: "SubGroup1",
  SubGroupID2: "SubGroup2",
  SubGroupID3: "SubGroup3",
  SubGroupID4: "SubGroup4",
  SubGroupID5: "SubGroup5",
  SubGroupID6: "SubGroup6",
  SubGroupID7: "SubGroup7",
  SubGroupID8: "SubGroup8",
  SubGroupID9: "SubGroup9",
  TaxabilityID: "Texability",
  TranUnitID: "TranUnit",
  BaseUnitID: "BaseUnit",
  UnitConvRate: "Conversion",
};
