import React, { Suspense, lazy } from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import AppShell from "./layout/AppShell";
import Loader from "./components/ui/Loader";
import { PageHeaderProvider } from "./context/PageHeaderContext";
import { UserProvider, useUser } from "./context/UserContext";
import { RB_CODES as RB, rbRouteSegment as rs } from "./constants/rbCodes";

const LoginPage = lazy(() => import("./pages/login/LoginPage"));
const EnterpriseDashboard = lazy(() => import("./pages/dashboard/EnterpriseDashboard"));
const ReportWorkspacePage = lazy(() => import("./pages/report-workspace/ReportWorkspacePage"));
const TxnEntryPage = lazy(() => import("./pages/txn-entry/TxnEntryPage"));
const PurchaseInquiryPage = lazy(() => import("./pages/purchase-inquiry/PurchaseInquiryPage"));
const PurchaseInquiryForm = lazy(() => import("./pages/purchase-inquiry/PurchaseInquiryForm"));
const PurchaseQuotationPage = lazy(() => import("./pages/purchase-quotation/PurchaseQuotationPage"));
const PurchaseQuotationForm = lazy(() => import("./pages/purchase-quotation/PurchaseQuotationForm"));
const PurchaseQuotationComparisonPage = lazy(
  () => import("./pages/purchase-quotation-comparison/PurchaseQuotationComparisonPage")
);
const PurchaseOrderPage = lazy(() => import("./pages/purchase-order/PurchaseOrderPage"));
const PurchaseOrderForm = lazy(() => import("./pages/purchase-order/PurchaseOrderForm"));
const PurchaseIndentPage = lazy(() => import("./pages/purchase-indent/PurchaseIndentPage"));
const PurchaseIndentForm = lazy(() => import("./pages/purchase-indent/PurchaseIndentForm"));
const PurchaseVoucherPage = lazy(() => import("./pages/purchase-voucher/PurchaseVoucherPage"));
const PurchaseVoucherForm = lazy(() => import("./pages/purchase-voucher/PurchaseVoucherForm"));
const GoodsReceivedNotePage = lazy(() => import("./pages/goods-received-note/GoodsReceivedNotePage"));
const GoodsReceivedNoteForm = lazy(() => import("./pages/goods-received-note/GoodsReceivedNoteForm"));
const CWIPToFAPage = lazy(() => import("./pages/cwip-to-fa/CWIPToFAPage"));
const CWIPToFAForm = lazy(() => import("./pages/cwip-to-fa/CWIPToFAForm"));
const AssetsDepreciationPage = lazy(() => import("./pages/assets-depreciation/AssetsDepreciationPage"));
const AssetsDepreciationForm = lazy(() => import("./pages/assets-depreciation/AssetsDepreciationForm"));
const AssetDepreciationPercentagePage = lazy(
  () => import("./pages/asset-depreciation-percentage/AssetDepreciationPercentagePage")
);
const AssetsItemOpeningPage = lazy(() => import("./pages/assets-item-opening/AssetsItemOpeningPage"));
const AssetsItemOpeningForm = lazy(() => import("./pages/assets-item-opening/AssetsItemOpeningForm"));
const AssetsWriteOffPage = lazy(() => import("./pages/assets-write-off/AssetsWriteOffPage"));
const AssetsWriteOffForm = lazy(() => import("./pages/assets-write-off/AssetsWriteOffForm"));
const AssetsEmployeeIssuePage = lazy(() => import("./pages/assets-employee-issue/AssetsEmployeeIssuePage"));
const AssetsEmployeeIssueForm = lazy(() => import("./pages/assets-employee-issue/AssetsEmployeeIssueForm"));
const AssetsEmployeeTransferPage = lazy(
  () => import("./pages/assets-employee-transfer/AssetsEmployeeTransferPage")
);
const AssetsEmployeeTransferForm = lazy(
  () => import("./pages/assets-employee-transfer/AssetsEmployeeTransferForm")
);
const AssetsEmployeeReturnPage = lazy(() => import("./pages/assets-employee-return/AssetsEmployeeReturnPage"));
const AssetsEmployeeReturnForm = lazy(() => import("./pages/assets-employee-return/AssetsEmployeeReturnForm"));
const AssetsDepartmentIssuePage = lazy(
  () => import("./pages/assets-department-issue/AssetsDepartmentIssuePage")
);
const AssetsDepartmentIssueForm = lazy(
  () => import("./pages/assets-department-issue/AssetsDepartmentIssueForm")
);
const AssetsHealthStatusUpdationPage = lazy(
  () => import("./pages/assets-health-status-updation/AssetsHealthStatusUpdationPage")
);
const AssetsHealthStatusUpdationForm = lazy(
  () => import("./pages/assets-health-status-updation/AssetsHealthStatusUpdationForm")
);
const AssetsRevaluationPage = lazy(() => import("./pages/assets-revaluation/AssetsRevaluationPage"));
const AssetsRevaluationForm = lazy(() => import("./pages/assets-revaluation/AssetsRevaluationForm"));
const AssetsClientAllocationPage = lazy(
  () => import("./pages/assets-client-allocation/AssetsClientAllocationPage")
);
const AssetsClientAllocationForm = lazy(
  () => import("./pages/assets-client-allocation/AssetsClientAllocationForm")
);
const ComplaintRegisterPage = lazy(() => import("./pages/complaint-register/ComplaintRegisterPage"));
const ComplaintRegisterForm = lazy(() => import("./pages/complaint-register/ComplaintRegisterForm"));
const MaintenanceContractRenewalPage = lazy(
  () => import("./pages/maintenance-contract-renewal/MaintenanceContractRenewalPage")
);
const MaintenanceContractRenewalForm = lazy(
  () => import("./pages/maintenance-contract-renewal/MaintenanceContractRenewalForm")
);
const MaintenanceNewContractPage = lazy(
  () => import("./pages/maintenance-new-contract/MaintenanceNewContractPage")
);
const MaintenanceNewContractForm = lazy(
  () => import("./pages/maintenance-new-contract/MaintenanceNewContractForm")
);
const MaintenanceDashboard = lazy(() => import("./pages/maintenance-dashboard/MaintenanceDashboard"));
const AssetsReturnableGatePassOutPage = lazy(
  () => import("./pages/assets-returnable-gate-pass-out/AssetsReturnableGatePassOutPage")
);
const AssetsReturnableGatePassOutForm = lazy(
  () => import("./pages/assets-returnable-gate-pass-out/AssetsReturnableGatePassOutForm")
);
const AssetsReturnableGatePassInPage = lazy(
  () => import("./pages/assets-returnable-gate-pass-in/AssetsReturnableGatePassInPage")
);
const AssetsReturnableGatePassInForm = lazy(
  () => import("./pages/assets-returnable-gate-pass-in/AssetsReturnableGatePassInForm")
);
const AssetsStockTransferPage = lazy(() => import("./pages/assets-stock-transfer/AssetsStockTransferPage"));
const AssetsStockTransferForm = lazy(() => import("./pages/assets-stock-transfer/AssetsStockTransferForm"));
const MainGroupMasterPage = lazy(() => import("./pages/main-group-master/MainGroupMasterPage"));
const LocationMasterPage = lazy(() => import("./pages/location-master/LocationMasterPage"));
const SubMainGroupMasterPage = lazy(() => import("./pages/sub-main-group-master/SubMainGroupMasterPage"));
const SubGroupMasterPage = lazy(() => import("./pages/sub-group-master/SubGroupMasterPage"));
const UserMasterPage = lazy(() => import("./pages/user-master/UserMasterPage"));
const UserGroupPage = lazy(() => import("./pages/user-group/UserGroupPage"));
const DivisionWiseRightsPage = lazy(() => import("./pages/division-wise-rights/DivisionWiseRightsPage"));
const ItemMasterPage = lazy(() => import("./pages/item-master/ItemMasterPage"));
const DepartmentMasterPage = lazy(() => import("./pages/department-master/DepartmentMasterPage"));
const CompanyPage = lazy(() => import("./pages/company/CompanyPage"));
const AccountGroupMasterPage = lazy(() => import("./pages/account-group-master/AccountGroupMasterPage"));
const AccountMasterPage = lazy(() => import("./pages/account-master/AccountMasterPage"));
const DopMasterPage = lazy(() => import("./pages/dop-master/DopMasterPage"));
const DopMasterForm = lazy(() => import("./pages/dop-master/DopMasterForm"));
const DMDepartmentMasterPage = lazy(() => import("./pages/dm-department-master/DMDepartmentMasterPage"));
const DocumentTypeMasterPage = lazy(() => import("./pages/document-type-master/DocumentTypeMasterPage"));
const DocumentSubTypeMasterPage = lazy(() => import("./pages/document-subtype-master/DocumentSubTypeMasterPage"));
const DMTT2DocTypeMasterPage = lazy(() => import("./pages/dm-tt2doctype-master/DMTT2DocTypeMasterPage"));
const DivisionMasterPage = lazy(() => import("./pages/division-master/DivisionMasterPage"));
const AssetItemMasterPage = lazy(() => import("./pages/asset-item-master/AssetItemMasterPage"));
const AssetsItemOpeningExcelPage = lazy(
  () => import("./pages/assets-item-opening-excel/AssetsItemOpeningExcelPage")
);
const AssetsItemOpeningExcelForm = lazy(
  () => import("./pages/assets-item-opening-excel/AssetsItemOpeningExcelForm")
);
const SupplierMasterPage = lazy(() => import("./pages/supplier-master/SupplierMasterPage"));
const CustomerMasterPage = lazy(() => import("./pages/customer-master/CustomerMasterPage"));
const TrialBalanceDemoPage = lazy(() => import("./pages/trial-balance-demo/TrialBalanceDemoPage"));

function AppLayout() {
  return (
    <AppShell>
      <Suspense fallback={<Loader text="Loading page…" />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

function RequireAuth() {
  const { isAuthenticated } = useUser();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/** Module route: friendly `path`, RB code as unique route `id`. */
function rbModule({ rb, list, form, variants = ["new", "edit", "view"] }) {
  const children = [{ index: true, element: list }];
  if (form) {
    if (variants.includes("new")) children.push({ path: "new", element: form });
    if (variants.includes("edit")) children.push({ path: ":id/edit", element: form });
    if (variants.includes("view")) children.push({ path: ":id", element: form });
  }
  return {
    id: rb,
    path: rs(rb),
    children,
  };
}

function rbLeaf({ rb, element }) {
  return {
    id: rb,
    path: rs(rb),
    element,
  };
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <Suspense fallback={<Loader text="Loading page…" />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <EnterpriseDashboard /> },
          { path: "main/:reportBoardId", element: <ReportWorkspacePage /> },

          {
            id: RB.TXN_ENTRY,
            path: `${rs(RB.TXN_ENTRY)}/:id?`,
            element: <TxnEntryPage />,
          },

          rbModule({
            rb: RB.PURCHASE_INQUIRY,
            list: <PurchaseInquiryPage />,
            form: <PurchaseInquiryForm />,
            variants: ["new", "edit", "view"],
          }),
          rbModule({
            rb: RB.PURCHASE_ORDER,
            list: <PurchaseOrderPage />,
            form: <PurchaseOrderForm />,
            variants: ["new", "edit", "view"],
          }),
          rbModule({
            rb: RB.PURCHASE_QUOTATION,
            list: <PurchaseQuotationPage />,
            form: <PurchaseQuotationForm />,
            variants: ["new", "edit"],
          }),
          { path: "purchase-quotation-comparison", element: <PurchaseQuotationComparisonPage /> },
          rbModule({
            rb: RB.PURCHASE_INDENT,
            list: <PurchaseIndentPage />,
            form: <PurchaseIndentForm />,
          }),
          rbModule({
            rb: RB.PURCHASE_VOUCHER,
            list: <PurchaseVoucherPage />,
            form: <PurchaseVoucherForm />,
          }),
          rbModule({
            rb: RB.GOODS_RECEIVED_NOTE,
            list: <GoodsReceivedNotePage />,
            form: <GoodsReceivedNoteForm />,
            variants: ["new", "edit"],
          }),
          rbModule({
            rb: RB.CWIP_TO_FA,
            list: <CWIPToFAPage />,
            form: <CWIPToFAForm />,
          }),
          rbModule({
            rb: RB.ASSETS_DEPRECIATION,
            list: <AssetsDepreciationPage />,
            form: <AssetsDepreciationForm />,
          }),
          rbLeaf({ rb: RB.ASSET_DEPRECIATION_PERCENTAGE, element: <AssetDepreciationPercentagePage /> }),
          rbModule({
            rb: RB.ASSETS_ITEM_OPENING,
            list: <AssetsItemOpeningPage />,
            form: <AssetsItemOpeningForm />,
          }),
          rbModule({
            rb: RB.ASSETS_WRITE_OFF,
            list: <AssetsWriteOffPage />,
            form: <AssetsWriteOffForm />,
          }),
          rbModule({
            rb: RB.ASSETS_EMPLOYEE_ISSUE,
            list: <AssetsEmployeeIssuePage />,
            form: <AssetsEmployeeIssueForm />,
          }),
          rbModule({
            rb: RB.ASSETS_EMPLOYEE_TRANSFER,
            list: <AssetsEmployeeTransferPage />,
            form: <AssetsEmployeeTransferForm />,
          }),
          rbModule({
            rb: RB.ASSETS_EMPLOYEE_RETURN,
            list: <AssetsEmployeeReturnPage />,
            form: <AssetsEmployeeReturnForm />,
          }),
          rbModule({
            rb: RB.ASSETS_DEPARTMENT_ISSUE,
            list: <AssetsDepartmentIssuePage />,
            form: <AssetsDepartmentIssueForm />,
          }),
          rbModule({
            rb: RB.ASSETS_HEALTH_STATUS_UPDATION,
            list: <AssetsHealthStatusUpdationPage />,
            form: <AssetsHealthStatusUpdationForm />,
          }),
          rbModule({
            rb: RB.ASSETS_REVALUATION,
            list: <AssetsRevaluationPage />,
            form: <AssetsRevaluationForm />,
          }),
          rbModule({
            rb: RB.ASSETS_CLIENT_ALLOCATION,
            list: <AssetsClientAllocationPage />,
            form: <AssetsClientAllocationForm />,
          }),
          rbModule({
            rb: RB.ASSETS_RETURNABLE_GATE_PASS_OUT,
            list: <AssetsReturnableGatePassOutPage />,
            form: <AssetsReturnableGatePassOutForm />,
          }),
          rbModule({
            rb: RB.ASSETS_RETURNABLE_GATE_PASS_IN,
            list: <AssetsReturnableGatePassInPage />,
            form: <AssetsReturnableGatePassInForm />,
          }),
          rbModule({
            rb: RB.ASSETS_STOCK_TRANSFER,
            list: <AssetsStockTransferPage />,
            form: <AssetsStockTransferForm />,
          }),
          rbModule({
            rb: RB.COMPLAINT_REGISTER,
            list: <ComplaintRegisterPage />,
            form: <ComplaintRegisterForm />,
          }),
          rbModule({
            rb: RB.MAINTENANCE_CONTRACT_RENEWAL,
            list: <MaintenanceContractRenewalPage />,
            form: <MaintenanceContractRenewalForm />,
          }),
          rbModule({
            rb: RB.MAINTENANCE_NEW_CONTRACT,
            list: <MaintenanceNewContractPage />,
            form: <MaintenanceNewContractForm />,
          }),
          rbLeaf({ rb: RB.MAINTENANCE_DASHBOARD, element: <MaintenanceDashboard /> }),

          // Admin — Master modules
          rbLeaf({ rb: RB.MAIN_GROUP_MASTER, element: <MainGroupMasterPage /> }),
          rbLeaf({ rb: RB.SUB_MAIN_GROUP_MASTER, element: <SubMainGroupMasterPage /> }),
          rbLeaf({ rb: RB.SUB_GROUP_MASTER, element: <SubGroupMasterPage /> }),
          rbLeaf({ rb: RB.LOCATION_MASTER, element: <LocationMasterPage /> }),
          rbLeaf({ rb: RB.DIVISION_MASTER, element: <DivisionMasterPage /> }),
          rbLeaf({ rb: RB.ASSET_ITEM_MASTER, element: <AssetItemMasterPage /> }),
          rbModule({
            rb: RB.ASSETS_ITEM_OPENING_EXCEL,
            list: <AssetsItemOpeningExcelPage />,
            form: <AssetsItemOpeningExcelForm />,
            variants: ["new"],
          }),
          rbLeaf({ rb: RB.SUPPLIER_MASTER, element: <SupplierMasterPage /> }),
          { path: "admin/master/customer-master", element: <CustomerMasterPage /> },
          rbLeaf({ rb: RB.USER_MASTER, element: <UserMasterPage /> }),
          rbLeaf({ rb: RB.USER_GROUP, element: <UserGroupPage /> }),
          rbLeaf({ rb: RB.DIVISION_WISE_RIGHTS, element: <DivisionWiseRightsPage /> }),
          rbLeaf({ rb: RB.ITEM_MASTER, element: <ItemMasterPage /> }),
          rbLeaf({ rb: RB.DEPARTMENT_MASTER, element: <DepartmentMasterPage /> }),
          rbLeaf({ rb: RB.COMPANY, element: <CompanyPage /> }),
          rbLeaf({ rb: RB.ACCOUNT_GROUP_MASTER, element: <AccountGroupMasterPage /> }),
          rbLeaf({ rb: RB.ACCOUNT_MASTER, element: <AccountMasterPage /> }),
          rbModule({
            rb: RB.DOP_MASTER,
            list: <DopMasterPage />,
            form: <DopMasterForm />,
          }),
          rbLeaf({ rb: RB.DM_DEPARTMENT_MASTER, element: <DMDepartmentMasterPage /> }),
          rbLeaf({ rb: RB.DOCUMENT_TYPE_MASTER, element: <DocumentTypeMasterPage /> }),
          rbLeaf({ rb: RB.DOCUMENT_SUBTYPE_MASTER, element: <DocumentSubTypeMasterPage /> }),
          rbLeaf({ rb: RB.DM_TT2DOCTYPE_MASTER, element: <DMTT2DocTypeMasterPage /> }),
          { path: "demo/trial-balance", element: <TrialBalanceDemoPage /> },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <UserProvider>
      <PageHeaderProvider>
        <RouterProvider router={router} />
      </PageHeaderProvider>
    </UserProvider>
  );
}
