import { controlTypeMap } from "../../data/dummyData";

export const MGM_CONFIG = {
  RB_MASTER:           "RB_PurMainGroupMst",
  FORM_TAG:            "RB_PurMainGroupMst",
  TRAN_BOOK:           "MainGroup",
  CONFIG_YEAR_ID:      2,             // ⚠️ CONFIRM with DBA
  DIVISION_YEAR_ID:    2,             // ⚠️ CONFIRM with DBA — used in division fetch SP
  SP_RB_META:          "Fn_Fetch_RBDetailByRBCode",
  SP_ITEM_TYPE:        "Fn_tbl_PUR_ITEMTYPEMST_Fetch",
  SP_FIXED_ASSET_ACC:  "Fn_tbl_FixedAstAcc_Fetch",
  SP_MASTER_FILL:      "fn_tbl_RB_PurMainGroupMst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "Fn_tbl_PurMainGroupMst_List",
  LIST_DIVISION_ID:    15,            // ⚠️ CONFIRM with DBA
  SAVE_ENDPOINT:       "/API/PurMainGroup/pr_RB_PurMainGroupMst_Save",
  STORAGE_HEADER_META: "mgmHeaderMeta",
};

// lockOnEditMode: true → field is frozen (non-editable) when editing an existing record
export const MGM_HEADER_FILTERS = [
  {
    FilterParameterID: "ItemTypeID",
    FilterColName:     "ItemTypeID",
    FilterCaption:     "Item Type",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions:     [],
    isRequired:        true,
    lockOnEditMode:    true,
  },
  {
    FilterParameterID: "MainGroupCode",
    FilterColName:     "MainGroupCode",
    FilterCaption:     "Main Group Code",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
    isRequired:        true,
    lockOnEditMode:    true,
  },
  {
    FilterParameterID: "MainGroupName",
    FilterColName:     "MainGroupName",
    FilterCaption:     "Main Group Name",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
    isRequired:        true,
    lockOnEditMode:    false,
  },
  {
    FilterParameterID: "MainGroupShortName",
    FilterColName:     "MainGroupShortName",
    FilterCaption:     "Main Group Short Name",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
    isRequired:        true,
    lockOnEditMode:    false,
  },
  {
    // ⚠️ CONFIRM exact DB ColName with DBA — MRD field table has spaces, likely camelCase in DB
    FilterParameterID: "UsedCodeInCodeGeneration",
    FilterColName:     "UsedCodeInCodeGeneration",
    FilterCaption:     "Used in Code Generation",
    FilterColCtrlType: controlTypeMap.CHECKBOX,
    isRequired:        false,
    lockOnEditMode:    false,
  },
  {
    FilterParameterID: "MainGroupShortCode",
    FilterColName:     "MainGroupShortCode",
    FilterCaption:     "Main Group Short Code",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
    isRequired:        false,
    lockOnEditMode:    false,  // always readonly — auto-fill only
  },
  {
    FilterParameterID: "FixedAssetAccountID",
    FilterColName:     "FixedAssetAccountID",
    FilterCaption:     "Fixed Assets Account",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions:     [],
    isRequired:        false,
    lockOnEditMode:    true,
  },
];
