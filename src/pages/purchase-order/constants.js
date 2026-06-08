// constants.js — Purchase Order page config
// All RB codes, SP names, IDs, and request defaults used by this page in one place.
// CONFIRM tags mark values that need backend verification before go-live.

import { controlTypeMap } from '../../data/dummyData';

export const PO_CONFIG = {
  // RB board codes — using PI's verified codes until PO-specific RBs are registered on backend
  RB_MASTER: 'RB_PurInquiryMst',
  RB_DETAIL: 'RB_PurInquiryDet',

  // Form identifiers — using PI's verified values
  FORM_TAG: 'PO',
  TRAN_BOOK: 'PO',

  // Year IDs
  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,

  // Supplier picker (same SP as PI — party type 'S')
  SUPPLIER_PARTY_TYPE: 'S',
  SUPPLIER_SP: 'Fn_tbl_FetchCustomerSupplierTranWs4Web',

  // RB codes for item picker modal — using PI's verified codes
  RB_ITEM_PICKER_DIRECT: 'RB_PurInqSelOnlyItem',  // BasedOn = '0' (Direct)
  RB_ITEM_PICKER_INDENT: 'RB_PurInqSelIndtItem',  // BasedOn = '2' (Indent wise)

  // SP / function names used in API calls
  SP_RB_META:        'Fn_Fetch_RBDetailByRBCode',
  SP_PO_TYPES:       'fn_tbl_ddl_Pur_Configuration',
  SP_INDENTS:        'Fn_Tbl_FetchPurchaseItemDetailTransWs4Web',
  SP_DIVISIONS:      'Fn_tbl_FetchUserWsDivision',
  SP_ITEM_PICKER:    'Fn_Tbl_FetchPurchaseItemDetailTransWs4Web',
  SP_INDENT_SUMMARY: 'Fn_tbl_FetchIndentSummaryItem4Inquiry',
  SP_CURRENCIES:     'Fn_tbl_FetchCurrencyList',
  SP_SUPPLIER_INFO:  'Fn_tbl_FetchSupplierCurrencyInfo',
  SP_EXISTING_POS:   'Fn_tbl_FetchPurOrderListForAmend',

  // "Based On" dropdown options (hardcoded — same as PI)
  BASED_ON_OPTIONS: [
    { value: '0', label: 'Direct' },
    { value: '1', label: 'Indent wise' },
    { value: '2', label: 'Indent Item Wise' },
    { value: '3', label: 'Quotation' },
    { value: '4', label: 'Inquiry' },
  ],

  // Hardcoded columns for the Suppliers grid (same shape as PI)
  SUPPLIER_GRID_COLUMNS: [
    { id: 'cb',           name: '',             key: 'cb',           controlType: -1, width: 48,  isFixed: true,  isEditAllow: false },
    { id: 'SrNo',         name: 'Sr.No',        key: 'SrNo',         controlType: 0,  width: 70,  isFixed: false, isEditAllow: false },
    { id: 'SupplierName', name: 'Supplier Name',key: 'SupplierName', controlType: 0,  width: 200, isFixed: false, isEditAllow: false },
    { id: 'Address',      name: 'Address',      key: 'Address',      controlType: 0,  width: 220, isFixed: false, isEditAllow: false },
    { id: 'City',         name: 'City',         key: 'City',         controlType: 0,  width: 120, isFixed: false, isEditAllow: false },
    { id: 'MobileNo',     name: 'Mobile No.',   key: 'MobileNo',     controlType: 0,  width: 110, isFixed: false, isEditAllow: false },
  ],

  INDENT_FRM_OPTION: 0,

  // Save endpoint — using PI's verified endpoint until PO-specific save proc is confirmed
  SAVE_ENDPOINT: '/API/TranFormSave/Post_RB_PurInquiryMst_Save',

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: 'poHeaderMeta',
  STORAGE_ENTRY_META:  'poEntryMeta',

  // Purchase Order listing (mirrors PI_CONFIG.LIST_* pattern)
  LIST_OBJ_TYPE:   2,                          // OBJ_TYPE.FUNCTION
  SP_PO_LIST:      'Fn_tbl_Pur_OrderMst_List', // CONFIRM with backend
  LIST_DIVISION_ID: 15,                         // default division for listing fetch
};

// ── Header filter definitions ───────────────────────────────────────────────
// Amend checkbox is NOT in this list — it is rendered separately in the page
// because it drives conditional visibility of the Amend PO dropdown.
// Field order follows the spec: PO No → PO Date → Division → PO Type →
//   Based On → Supplier → Currency → Currency Rate → Cr. Days → Exp. Date
export const PO_HEADER_FILTERS = [
  { FilterParameterID: 'TranCode',      FilterColName: 'TranCode',     FilterCaption: 'PO No.',       FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: 'TranDate',      FilterColName: 'TranDate',     FilterCaption: 'PO Date',      FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: 'DivisionID',    FilterColName: 'DivisionID',   FilterCaption: 'Division',     FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'POTypeID',      FilterColName: 'POTypeID',     FilterCaption: 'PO Type',      FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'BasedOnID',     FilterColName: 'BasedOnID',    FilterCaption: 'Based On',     FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: PO_CONFIG.BASED_ON_OPTIONS },
  { FilterParameterID: 'SupplierID',    FilterColName: 'SupplierID',   FilterCaption: 'Supplier',     FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'CurrencyID',    FilterColName: 'CurrencyID',   FilterCaption: 'Currency',     FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'CurrencyRate',  FilterColName: 'CurrencyRate', FilterCaption: 'Currency Rate',FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: 'CrDays',        FilterColName: 'CrDays',       FilterCaption: 'Cr. Days',     FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: 'ExpectedDate',  FilterColName: 'ExpectedDate', FilterCaption: 'Exp. Date',    FilterColCtrlType: controlTypeMap.DATE },
];

export const PO_GRID_TABS = [
  { id: 'items',     label: 'Item Grid' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'terms',     label: 'Term And Conditions' },
];

export const APPROVED_OPTS = [
  { value: 'all',      label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending',  label: 'Pending' },
];

export const TERMS_COLUMNS = ['Sr.No', 'Terms Type', 'Code', 'Terms & Conditions'];

export const INDENT_DETAILS_COLUMNS = [
  { key: 'SrNo',       label: 'Sr.No',        width: 70 },
  { key: 'IndentNo',   label: 'Indent No.',   width: 120 },
  { key: 'IndentDate', label: 'Indent Date',  width: 110 },
  { key: 'ItemName',   label: 'Item Name',    width: 190 },
  { key: 'IndentQty',  label: 'Indent Qty',   width: 100 },
  { key: 'TranQty',    label: 'Tran Qty',     width: 100 },
  { key: 'Unit',       label: 'Unit',         width: 80 },
];

export const PO_FILTER_INITIAL_VALUES = { BasedOnID: '0' };

// When Division changes, clear the PO Type selection.
export const PO_FILTER_CASCADE_RESETS = {
  DivisionID: ['POTypeID'],
};

export const SUPPLIER_GRID_CONFIG = {
  columns: PO_CONFIG.SUPPLIER_GRID_COLUMNS,
  pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25] },
};

// Formats a date value as "dd-Mon-yyyy" for API params (matches PI formatTranDate).
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function formatTranDate(dateVal) {
  if (!dateVal) return '0';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '0';
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}
