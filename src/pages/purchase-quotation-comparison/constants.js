// constants.js — Purchase Quotation Comparison page config
// Single-page module (no list/add/edit) — see MRD_Template4inquiry4QtnComparision.docx.
// Client-confirmed: no RB anywhere (header and grid are both static/fixed columns).

import { controlTypeMap } from "../../data/dummyData";
import { PURCHASE_API } from "../../constants/purchaseCommon";

export const PAGE_TITLE = "Purchase Quotation Comparison";

export const PQC_CONFIG = {
  // ⚠️ Not stated in the MRD — placeholder tag, confirm with DBA before go-live.
  FORM_TAG: "QTNCOMP",

  // ⚠️ @prmtrantype semantics are undocumented. Assumed to identify the source
  // transaction type ("Inquiry"), mirroring Purchase Inquiry's own FORM_TAG
  // ("INQ") since this screen always compares quotations against a PI record.
  // Confirm with DBA before go-live.
  TRAN_TYPE: "INQ",

  SP_DIVISIONS: PURCHASE_API.SP_DIVISIONS,
  SP_INQUIRY_LIST: "fn_tbl_fetchinqno4qtncomparision",
  SP_INQUIRY_DETAILS: "fn_tbl_fetchinqdetails4comparision",
  SP_COMPARISON_GRID: "fn_tbl_fetchquotationdet4comparision",

  SAVE_ENDPOINT: "/API/PurQtnComparisonSave/Post_RB_QtnComparison_Save",
};

/** Fake RB-column-shaped field descriptors — lets the header reuse MasterFormField's
 * rendering/validation for visual consistency, even though there's no real RB here. */
export const PQC_HEADER_FIELDS = {
  DIVISION: {
    ColName: "divisionid",
    DisplayName: "Division",
    ColCtrlType: controlTypeMap.DROPDOWN,
    IsMandatory: true,
  },
  INQUIRY: {
    ColName: "inqid",
    DisplayName: "Inquiry No.",
    ColCtrlType: controlTypeMap.DROPDOWN,
    IsMandatory: true,
  },
};

/** Read-only display fields populated from SP_INQUIRY_DETAILS once an Inquiry is picked.
 * Field names confirmed 2026-07-13 against the live fn_tbl_fetchinqdetails4comparision
 * response (not documented in the MRD, whose "Grid RB Fields" table was empty). */
export const PQC_DISPLAY_FIELDS = [
  { key: "inquirydate", label: "Inquiry Date", isDate: true },
  { key: "division", label: "Division" },
  { key: "indenttype", label: "Inquiry Type" },
  { key: "totalinqitmcount", label: "Items Requested" },
  { key: "qtnitmcount", label: "Items Quoted" },
];
