// constants.js — Transaction Entry (Sample Invoice) page config
// All RB codes, SP names, IDs, and request defaults used by this page in one place.

export const TXN_CONFIG = {
  // RB board codes
  RB_MASTER: 'RB_SampleInvMst',
  RB_DETAIL: 'RB_SampleInvDet',

  // SP / function names used in API calls
  SP_RB_META:       'Fn_Fetch_RBDetailByRBCode',
  SP_DIVISIONS:     'Fn_tbl_FetchUserWsDivision',
  SP_DEPARTMENTS:   'Pr_Fetch_DepartmentData_IMS',
  SP_SUPPLIERS:     'Pr_Fetch_SupplierData_IMS',
  SP_INVOICE_TYPES: 'fn_tbl_ddl_Sal_Configuration',
  SP_ORDER_ITEMS:   'Pr_TBD_FetchItemDetail',
  SP_GRID_EVENT:    'fn_tbl_RB_SampleInvDet_Event',

  // Form identifier
  FORM_TAG: 'SI',

  // Year / config IDs
  DIVISION_YEAR_ID:     14,
  INVOICE_TYPE_YEAR_ID: 14,
  ORDER_ITEM_YEAR_ID:   14,
  ORDER_ITEM_CONFIG_ID: 34,

  // Request defaults
  LOGIN_ID:   1,
  COMPANY_ID: 1,

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: 'txnHeaderMeta',
  STORAGE_ENTRY_META:  'txnEntryMeta',
};
