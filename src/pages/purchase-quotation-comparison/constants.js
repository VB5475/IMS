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

/** Hand-authored filter defs for EnterpriseFilterPanel's static mode — same
 * component/visual language every transaction form (PO, PV, PI, GRN) uses for
 * its header, run without the RB-driven GetFilters/GetFilterDetail fetch
 * since there's no RB here (per the file-level "no RB anywhere" note above).
 * FilterColName/FilterParameterID are hand-set to the same key rather than
 * synced from live column metadata (there is none to sync from). */
export const PQC_HEADER_FILTERS = [
  {
    FilterColName: "divisionid",
    FilterParameterID: "divisionid",
    FilterCaption: "Division",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    ismandatory: 1,
    staticOptions: [],
  },
  {
    FilterColName: "inqid",
    FilterParameterID: "inqid",
    FilterCaption: "Inquiry No.",
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    ismandatory: 1,
    staticOptions: [],
  },
];

/** Inquiry dropdown clears (visually) whenever Division changes. */
export const PQC_FILTER_CASCADE_RESETS = { divisionid: ["inqid"] };

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
