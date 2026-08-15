// constants_wkf.js — WKF (Workflow) module-wide constants.
// Source: MRD_Template4WKFMain.docx (Shivani, 11-Aug-2026), Section 7.
// WKF_TranTypeID/Code/Name are kept EXACTLY as given in the MRD — do not
// renumber or rename; the backend keys off these ids/codes directly.

export const WKF_TRAN_TYPES = [
  { id: 1, code: "PUR_IND", name: "Purchase Indent" },
  { id: 2, code: "PUR_PO", name: "Purchase Order" },
  { id: 3, code: "PUR_INQ", name: "Purchase Inquiry" },
  { id: 4, code: "PUR_QTN", name: "Purchase Quotation" },
  { id: 5, code: "PUR_INW", name: "Purchase GRN" },
  { id: 7, code: "SAL_SO", name: "Sales Order" },
  { id: 8, code: "QC_SI", name: "Sample In" },
  { id: 10, code: "PUR_PV", name: "Purchase Voucher" },
  { id: 11, code: "PUR_DV", name: "Purchase Deviation" },
  { id: 12, code: "FAS_CP", name: "Cash Payment" },
  { id: 13, code: "FAS_CR", name: "Cash Receipt" },
  { id: 14, code: "FAS_BR", name: "Bank Receipt" },
  { id: 15, code: "FAS_BP", name: "Bank Payment" },
  { id: 16, code: "FAS_CN", name: "Credit Note" },
  { id: 17, code: "FAS_DN", name: "Debit Note" },
  { id: 18, code: "FAS_CT", name: "Contra Voucher" },
  { id: 19, code: "FAS_JV", name: "Journal Voucher" },
  { id: 20, code: "FAS_CPBP", name: "Bill Wise Payment" },
  { id: 21, code: "FAS_CPBR", name: "Bill Wise Receipt" },
  { id: 22, code: "FAS_BE", name: "Bill Wise Expense" },
  { id: 23, code: "SAL_QTN", name: "Sales Quotation" },
  { id: 24, code: "SAL_INQ", name: "Sales Inquiry" },
  { id: 25, code: "PUR_PFG", name: "Purchase Voucher From GRN" },
  { id: 26, code: "PUR_PPO", name: "Purchase Voucher From PO" },
  { id: 27, code: "PUR_CPV", name: "Cash Purchase Voucher" },
  { id: 28, code: "PUR_SPV", name: "Supplimentary Purchase Voucher" },
  { id: 29, code: "RT_GP", name: "Returnable Gate Pass" },
  { id: 30, code: "NRT_GP", name: "NON Returnable Gate Pass" },
];

export function getWkfTranTypeByCode(code) {
  return WKF_TRAN_TYPES.find((t) => t.code === code) ?? null;
}

export function getWkfTranTypeById(id) {
  return WKF_TRAN_TYPES.find((t) => t.id === Number(id)) ?? null;
}
