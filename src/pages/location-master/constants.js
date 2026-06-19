import { controlTypeMap } from "../../data/dummyData";

export const LM_CONFIG = {
  RB_MASTER:           "RB_GenLocationMst",
  FORM_TAG:            "RB_GenLocationMst",
  TRAN_BOOK:           "LM",
  CONFIG_YEAR_ID:      2,              // ⚠️ CONFIRM with DBA
  DIVISION_YEAR_ID:    2,              // ⚠️ CONFIRM with DBA
  SP_RB_META:          "Fn_Fetch_RBDetailByRBCode",
  SP_LOCATION_TYPE:    "Fn_tbl_Fetch_LocationType",
  SP_PREMISES:         "Fn_tbl_Fetch_Premises",
  SP_MASTER_FILL:      "fn_tbl_RB_GenLocationMst",
  LIST_OBJ_TYPE:       2,
  SP_LIST:             "Fn_tbl_Gen_LocationMst_List", // ⚠️ CONFIRM with DBA
  LIST_DIVISION_ID:    15,             // ⚠️ CONFIRM with DBA
  SAVE_ENDPOINT:       "/API/Gen_LocationMst/Post_RB_GenLocationMst_Save",
  STORAGE_HEADER_META: "piHeaderMeta",
};

// Pseudo-field — renders as a section divider label row in MasterFormPanel.
// Not included in headerValuesRef → not serialised into save payload.
const ADDRESS_DIVIDER = {
  FilterParameterID: "_addressDivider",
  FilterColName:     "_addressDivider",
  FilterCaption:     "Address Details",
  FilterColCtrlType: controlTypeMap.LABEL,
  isRequired:        false,
  lockOnEditMode:    false,
};

// lockOnEditMode: true → field is frozen (non-editable) when editing an existing record
export const LM_HEADER_FILTERS = [
  {
    FilterParameterID: "LocationType",
    FilterColName:     "LocationType",
    FilterCaption:     "Location Type",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions:     [],
    isRequired:        true,
    lockOnEditMode:    true,
  },
  {
    FilterParameterID: "ParentIDNumber",
    FilterColName:     "ParentIDNumber",
    FilterCaption:     "Premises",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions:     [],
    isRequired:        true,
    lockOnEditMode:    true,
  },
  {
    FilterParameterID: "Loc_Code",
    FilterColName:     "Loc_Code",
    FilterCaption:     "Location Code",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
    isRequired:        true,
    lockOnEditMode:    true,
  },
  {
    FilterParameterID: "Location_Name",
    FilterColName:     "Location_Name",
    FilterCaption:     "Location Name (In English)",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
    isRequired:        true,
    lockOnEditMode:    true,
  },
  ADDRESS_DIVIDER,
  {
    FilterParameterID: "Address1",
    FilterColName:     "Address1",
    FilterCaption:     "Address",
    FilterColCtrlType: controlTypeMap.TEXTBOX,
    isRequired:        true,
    lockOnEditMode:    false,
  },
  {
    FilterParameterID: "City",
    FilterColName:     "City",
    FilterCaption:     "City",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
    isRequired:        true,
    lockOnEditMode:    false,
  },
  {
    FilterParameterID: "State",
    FilterColName:     "State",
    FilterCaption:     "State",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
    isRequired:        true,
    lockOnEditMode:    false,
  },
  {
    FilterParameterID: "Zipcode",
    FilterColName:     "Zipcode",
    FilterCaption:     "Zip",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
    isRequired:        true,
    lockOnEditMode:    false,
  },
  {
    FilterParameterID: "Country",
    FilterColName:     "Country",
    FilterCaption:     "Country",
    FilterColCtrlType: controlTypeMap.TEXTAREA,
    isRequired:        true,
    lockOnEditMode:    false,
  },
];
