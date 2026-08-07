// printReportConfig.js — single source of truth for every list page's
// <PrintReportButton> reportTitle/reportFileName. Change a report's title or
// .rpt filename here — no need to touch the page component.
// Keyed by the page's own folder slug under src/pages/ (e.g.
// "account-group-master" for src/pages/account-group-master/...Page.jsx),
// since that's already unique per module and needs no extra lookup.
//
// Filenames still prefixed "" are real, pre-existing placeholders
// (not introduced by this file) — the actual .rpt name is still unconfirmed
// for those modules; fill them in here once known.

export const PRINT_REPORT_CONFIG = {
  "account-group-master": { reportTitle: "Account Group Master Report", reportFileName: "AccountGroupMaster.rpt" },
  "account-master": { reportTitle: "Account Master Report", reportFileName: "AccountMaster.rpt" },
  "assets-client-allocation": { reportTitle: "Assets Client Allocation Report", reportFileName: "AssetsClientAllocation.rpt" },
  "assets-department-issue": { reportTitle: "Assets Department Issue Report", reportFileName: "AssetsDepartmentIssue.rpt" },
  "assets-depreciation": { reportTitle: "Company Act Depreciation Report", reportFileName: "AssetsDepreciation.rpt" },
  "assets-employee-issue": { reportTitle: "Assets Employee Issue Report", reportFileName: "AssetsEmployeeIssue.rpt" },
  "assets-employee-return": { reportTitle: "Assets Employee Return Report", reportFileName: "AssetsEmployeeReturn.rpt" },
  "assets-employee-transfer": { reportTitle: "Employee Location Transfer Report", reportFileName: "AssetsEmployeeTransfer.rpt" },
  "assets-health-status-updation": { reportTitle: "Assets Health Status Updation Report", reportFileName: "AssetsHealthStatusUpdation.rpt" },
  "assets-item-opening": { reportTitle: "Assets Item Opening Report", reportFileName: "AssetsItemOpening.rpt" },
  "assets-item-opening-excel": { reportTitle: "Asset Item Opening Excel Report", reportFileName: "AssetsItemOpeningExcel.rpt" },
  "assets-returnable-gate-pass-in": { reportTitle: "Returnable Gate Pass In Report", reportFileName: "Rpt_ReturnableGatePass.rpt" },
  "assets-returnable-gate-pass-out": { reportTitle: "Returnable Gate Pass Out Report", reportFileName: "Rpt_ReturnableGatePass.rpt" },
  "assets-revaluation": { reportTitle: "Assets Revaluation Report", reportFileName: "AssetsRevaluation.rpt" },
  "assets-stock-transfer": { reportTitle: "Assets Stock Transfer Report", reportFileName: "AssetsStockTransfer.rpt" },
  "assets-write-off": { reportTitle: "Assets Write Off Report", reportFileName: "AssetsWriteOff.rpt" },
  "company": { reportTitle: "Company Report", reportFileName: "Company.rpt" },
  "complaint-register": { reportTitle: "Complaint Register Report", reportFileName: "ComplaintRegister.rpt" },
  "customer-master": { reportTitle: "Customer Master Report", reportFileName: "CustomerMaster.rpt" },
  "cwip-to-fa": { reportTitle: "CWIP To FA Report", reportFileName: "CWIPToFA.rpt" },
  "department-master": { reportTitle: "Department Master Report", reportFileName: "DepartmentMaster.rpt" },
  "division-master": { reportTitle: "Division Master Report", reportFileName: "DivisionMaster.rpt" },
  "dm-department-master": { reportTitle: "DMS Department Master Report", reportFileName: "DMDepartmentMaster.rpt" },
  "document-subtype-master": { reportTitle: "DMS Document SubType Master Report", reportFileName: "DocumentSubTypeMaster.rpt" },
  "document-type-master": { reportTitle: "DMS Document Type Master Report", reportFileName: "DocumentTypeMaster.rpt" },
  "dop-master": { reportTitle: "DOP Master Report", reportFileName: "DopMaster.rpt" },
  "goods-received-note": { reportTitle: "Goods Received Note Report", reportFileName: "GoodsReceivedNote.rpt" },
  "item-master": { reportTitle: "Item Master Report", reportFileName: "RptPrintItems.rpt" },
  "location-master": { reportTitle: "Location Master Report", reportFileName: "LocationMaster.rpt" },
  "main-group-master": { reportTitle: "Main Group Master Report", reportFileName: "RptMainGroupList.rpt" },
  "purchase-indent": { reportTitle: "Purchase Indent Report", reportFileName: "PurchaseIndent.rpt" },
  "purchase-inquiry": { reportTitle: "Purchase Inquiry Report", reportFileName: "PurchaseInquiry.rpt" },
  "purchase-order": { reportTitle: "Purchase Order Report", reportFileName: "PurchaseOrder.rpt" },
  "purchase-quotation": { reportTitle: "Purchase Quotation Report", reportFileName: "PurchaseQuotation.rpt" },
  "purchase-voucher": { reportTitle: "Purchase Voucher Report", reportFileName: "PurchaseVoucher.rpt" },
  "sub-group-master": { reportTitle: "Sub Group Master Report", reportFileName: "RptSubGroupMaster.rpt" },
  "sub-main-group-master": { reportTitle: "Sub Main Group Master Report", reportFileName: "RptSubMainGroupList.rpt" },
  "supplier-master": { reportTitle: "Supplier Master Report", reportFileName: "SupplierMaster.rpt" },
  "transporter-master": { reportTitle: "Transporter Master Report", reportFileName: "TransporterMaster.rpt" },
  "user-group": { reportTitle: "User Group Report", reportFileName: "UserGroup.rpt" },
  "user-master": { reportTitle: "User Master Report", reportFileName: "UserMaster.rpt" },
};
