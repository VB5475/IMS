import React, { Suspense, lazy, useEffect, useRef } from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
  useMatches,
} from "react-router-dom";
import AppShell from "./layout/AppShell";
import Loader from "./components/ui/Loader";
import RouteErrorBoundary from "./components/ui/RouteErrorBoundary";
import { PageHeaderProvider } from "./context/PageHeaderContext";
import { UserProvider, useUser } from "./context/UserContext";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import { useUiGuard } from "./hooks/useUiGuard";
import { useNotification } from "./context/NotificationContext";
import {
  RB_CODES as RB,
  rbRouteSegment as rs,
  findRbByPath,
  findRbFromMatches,
} from "./constants/rbCodes";
import { getModuleRights } from "./session/moduleRights";

const LoginPage = lazy(() => import("./pages/login/LoginPage"));
const EnterpriseDashboard = lazy(() => import("./pages/dashboard/EnterpriseDashboard"));
const AssetSummaryPage = lazy(() => import("./pages/asset-summary/AssetSummaryPage"));
const FarPage = lazy(() => import("./pages/far/FarPage"));
const ReportWorkspacePage = lazy(() => import("./pages/report-workspace/ReportWorkspacePage"));
const TxnEntryPage = lazy(() => import("./pages/txn-entry/TxnEntryPage"));
const PurchaseInquiryPage = lazy(() => import("./pages/purchase-inquiry/PurchaseInquiryPage"));
const PurchaseInquiryForm = lazy(() => import("./pages/purchase-inquiry/PurchaseInquiryForm"));
const PurchaseQuotationPage = lazy(
  () => import("./pages/purchase-quotation/PurchaseQuotationPage")
);
const PurchaseQuotationForm = lazy(
  () => import("./pages/purchase-quotation/PurchaseQuotationForm")
);
const PurchaseQuotationComparisonPage = lazy(
  () => import("./pages/purchase-quotation-comparison/PurchaseQuotationComparisonPage")
);
const PurchaseOrderPage = lazy(() => import("./pages/purchase-order/PurchaseOrderPage"));
const PurchaseOrderForm = lazy(() => import("./pages/purchase-order/PurchaseOrderForm"));
const PurchaseRateContractPage = lazy(
  () => import("./pages/purchase-rate-contract/PurchaseRateContractPage")
);
const PurchaseRateContractForm = lazy(
  () => import("./pages/purchase-rate-contract/PurchaseRateContractForm")
);
const PurchaseIndentPage = lazy(() => import("./pages/purchase-indent/PurchaseIndentPage"));
const PurchaseIndentForm = lazy(() => import("./pages/purchase-indent/PurchaseIndentForm"));
const PurchaseVoucherPage = lazy(() => import("./pages/purchase-voucher/PurchaseVoucherPage"));
const PurchaseVoucherForm = lazy(() => import("./pages/purchase-voucher/PurchaseVoucherForm"));
const GoodsReceivedNotePage = lazy(
  () => import("./pages/goods-received-note/GoodsReceivedNotePage")
);
const GoodsReceivedNoteForm = lazy(
  () => import("./pages/goods-received-note/GoodsReceivedNoteForm")
);
const CWIPToFAPage = lazy(() => import("./pages/cwip-to-fa/CWIPToFAPage"));
const CWIPToFAForm = lazy(() => import("./pages/cwip-to-fa/CWIPToFAForm"));
const AssetsDepreciationPage = lazy(
  () => import("./pages/assets-depreciation/AssetsDepreciationPage")
);
const AssetsDepreciationForm = lazy(
  () => import("./pages/assets-depreciation/AssetsDepreciationForm")
);
const AssetsDepreciationITActPage = lazy(
  () => import("./pages/assets-depreciation-it-act/AssetsDepreciationITActPage")
);
const AssetsDepreciationITActForm = lazy(
  () => import("./pages/assets-depreciation-it-act/AssetsDepreciationITActForm")
);
const AssetDepreciationPercentagePage = lazy(
  () => import("./pages/asset-depreciation-percentage/AssetDepreciationPercentagePage")
);
const AssetsItemOpeningPage = lazy(
  () => import("./pages/assets-item-opening/AssetsItemOpeningPage")
);
const AssetsItemOpeningForm = lazy(
  () => import("./pages/assets-item-opening/AssetsItemOpeningForm")
);
const BomMasterPage = lazy(() => import("./pages/bom-master/BomMasterPage"));
const BomMasterForm = lazy(() => import("./pages/bom-master/BomMasterForm"));
const AssetsWriteOffPage = lazy(() => import("./pages/assets-write-off/AssetsWriteOffPage"));
const AssetsWriteOffForm = lazy(() => import("./pages/assets-write-off/AssetsWriteOffForm"));
const AssetsEmployeeIssuePage = lazy(
  () => import("./pages/assets-employee-issue/AssetsEmployeeIssuePage")
);
const AssetsEmployeeIssueForm = lazy(
  () => import("./pages/assets-employee-issue/AssetsEmployeeIssueForm")
);
const AssetsEmployeeTransferPage = lazy(
  () => import("./pages/assets-employee-transfer/AssetsEmployeeTransferPage")
);
const AssetsEmployeeTransferForm = lazy(
  () => import("./pages/assets-employee-transfer/AssetsEmployeeTransferForm")
);
const AssetsEmployeeReturnPage = lazy(
  () => import("./pages/assets-employee-return/AssetsEmployeeReturnPage")
);
const AssetsEmployeeReturnForm = lazy(
  () => import("./pages/assets-employee-return/AssetsEmployeeReturnForm")
);
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
const AssetsRevaluationPage = lazy(
  () => import("./pages/assets-revaluation/AssetsRevaluationPage")
);
const AssetsRevaluationForm = lazy(
  () => import("./pages/assets-revaluation/AssetsRevaluationForm")
);
const AssetsClientAllocationPage = lazy(
  () => import("./pages/assets-client-allocation/AssetsClientAllocationPage")
);
const AssetsClientAllocationForm = lazy(
  () => import("./pages/assets-client-allocation/AssetsClientAllocationForm")
);
const AssetsClientReleasePage = lazy(
  () => import("./pages/assets-client-release/AssetsClientReleasePage")
);
const AssetsClientReleaseForm = lazy(
  () => import("./pages/assets-client-release/AssetsClientReleaseForm")
);
const ComplaintRegisterPage = lazy(
  () => import("./pages/complaint-register/ComplaintRegisterPage")
);
const ComplaintRegisterForm = lazy(
  () => import("./pages/complaint-register/ComplaintRegisterForm")
);
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
const PreventiveMaintenanceInternalPage = lazy(
  () => import("./pages/preventive-maintenance-internal/PreventiveMaintenanceInternalPage")
);
const PreventiveMaintenanceInternalForm = lazy(
  () => import("./pages/preventive-maintenance-internal/PreventiveMaintenanceInternalForm")
);
const AssetPartsIndentDetailPage = lazy(
  () => import("./pages/asset-parts-indent-detail/AssetPartsIndentDetailPage")
);
const AssetPartsIndentDetailForm = lazy(
  () => import("./pages/asset-parts-indent-detail/AssetPartsIndentDetailForm")
);
const MaintenanceDashboard = lazy(
  () => import("./pages/maintenance-dashboard/MaintenanceDashboard")
);
const WorkflowDashboard = lazy(() => import("./pages/workflow-dashboard/WorkflowDashboard"));
const WKFMainPage = lazy(() => import("./pages/wkf-main/WKFMainPage"));
const AssetPartIndentPage = lazy(() => import("./pages/assets-part-indent/AssetPartIndentPage"));
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
const AssetsStockTransferPage = lazy(
  () => import("./pages/assets-stock-transfer/AssetsStockTransferPage")
);
const AssetsStockTransferForm = lazy(
  () => import("./pages/assets-stock-transfer/AssetsStockTransferForm")
);
const MainGroupMasterPage = lazy(() => import("./pages/main-group-master/MainGroupMasterPage"));
const LocationMasterPage = lazy(() => import("./pages/location-master/LocationMasterPage"));
const SubMainGroupMasterPage = lazy(
  () => import("./pages/sub-main-group-master/SubMainGroupMasterPage")
);
const SubGroupMasterPage = lazy(() => import("./pages/sub-group-master/SubGroupMasterPage"));
const CountryMasterPage = lazy(() => import("./pages/country-master/CountryMasterPage"));
const CityMasterPage = lazy(() => import("./pages/city-master/CityMasterPage"));
const StateMasterPage = lazy(() => import("./pages/state-master/StateMasterPage"));
const UserMasterPage = lazy(() => import("./pages/user-master/UserMasterPage"));
const UserGroupPage = lazy(() => import("./pages/user-group/UserGroupPage"));
const DivisionWiseRightsPage = lazy(
  () => import("./pages/division-wise-rights/DivisionWiseRightsPage")
);
const ItemMasterPage = lazy(() => import("./pages/item-master/ItemMasterPage"));
const DepartmentMasterPage = lazy(() => import("./pages/department-master/DepartmentMasterPage"));
const CompanyPage = lazy(() => import("./pages/company/CompanyPage"));
const AccountGroupMasterPage = lazy(
  () => import("./pages/account-group-master/AccountGroupMasterPage")
);
const AccountMasterPage = lazy(() => import("./pages/account-master/AccountMasterPage"));
const VoucherTypeMasterPage = lazy(
  () => import("./pages/voucher-type-master/VoucherTypeMasterPage")
);
const DopMasterPage = lazy(() => import("./pages/dop-master/DopMasterPage"));
const DopMasterForm = lazy(() => import("./pages/dop-master/DopMasterForm"));
const TransporterMasterPage = lazy(
  () => import("./pages/transporter-master/TransporterMasterPage")
);
const TransporterMasterForm = lazy(
  () => import("./pages/transporter-master/TransporterMasterForm")
);
const DMDepartmentMasterPage = lazy(
  () => import("./pages/dm-department-master/DMDepartmentMasterPage")
);
const DocumentTypeMasterPage = lazy(
  () => import("./pages/document-type-master/DocumentTypeMasterPage")
);
const DocumentSubTypeMasterPage = lazy(
  () => import("./pages/document-subtype-master/DocumentSubTypeMasterPage")
);
const DMTT2DocTypeMasterPage = lazy(
  () => import("./pages/dm-tt2doctype-master/DMTT2DocTypeMasterPage")
);
const DMGroupRightsPage = lazy(() => import("./pages/dm-group-rights/DMGroupRightsPage"));
const DMTranTypeLinkPage = lazy(() => import("./pages/dm-tran-type-link/DMTranTypeLinkPage"));
const UserWiseGroupRightsPage = lazy(
  () => import("./pages/user-wise-group-rights/UserWiseGroupRightsPage")
);
const DivisionMasterPage = lazy(() => import("./pages/division-master/DivisionMasterPage"));
const AssetsItemOpeningExcelForm = lazy(
  () => import("./pages/assets-item-opening-excel/AssetsItemOpeningExcelForm")
);
const ItemMasterUploadExcelForm = lazy(
  () => import("./pages/item-master-upload-excel/ItemMasterUploadExcelForm")
);
const SupplierMasterPage = lazy(() => import("./pages/supplier-master/SupplierMasterPage"));
const CustomerMasterPage = lazy(() => import("./pages/customer-master/CustomerMasterPage"));
const TrialBalanceDemoPage = lazy(() => import("./pages/trial-balance-demo/TrialBalanceDemoPage"));

function AppLayout() {
  return (
    <AppShell>
      <Suspense fallback={<Loader text="Loading page…" />}>
        <RequireModuleAccess />
      </Suspense>
    </AppShell>
  );
}

function RequireAuth() {
  const { isAuthenticated, refreshPermissions } = useUser();

  // Full browser reload of ANY authenticated route remounts this guard and
  // re-fetches fn_tbl_fetchloginusermenudetail. SPA navigations keep this
  // component mounted, so they do not re-fetch. In-flight dedupe in
  // refreshPermissions covers the login → first shell mount overlap.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    (async () => {
      await refreshPermissions();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshPermissions]);

  useInactivityLogout();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/** Which right a URL needs — the `new` / `edit` children of an rbModule route. */
function routeActionFor(pathname) {
  const last = pathname.split("/").filter(Boolean).pop();
  if (last === "new") return "insert";
  if (last === "edit") return "update";
  return "view";
}

const DENIED_MESSAGE = {
  view: "You do not have permission to open that page.",
  insert: "You do not have permission to create records in that module.",
  update: "You do not have permission to edit records in that module.",
};

/**
 * Enforces module rights on the URL itself, so hiding a nav entry or an Add
 * button cannot be bypassed by typing the address. Unlisted modules are
 * unrestricted — see session/moduleRights.js.
 */
function RequireModuleAccess() {
  const matches = useMatches();
  const { pathname } = useLocation();
  const notify = useNotification();
  const notifiedFor = useRef(null);

  const rights = getModuleRights(findRbFromMatches(matches) ?? findRbByPath(pathname));
  const action = routeActionFor(pathname);
  const allowed =
    rights.canView &&
    (action === "insert" ? rights.canInsert : true) &&
    (action === "update" ? rights.canUpdate : true);

  useEffect(() => {
    if (allowed) {
      notifiedFor.current = null;
      return;
    }
    // Guarded by pathname because `notify` is a fresh object on every
    // NotificationProvider render, which would otherwise re-fire the toast.
    if (notifiedFor.current === pathname) return;
    notifiedFor.current = pathname;
    notify.warning(DENIED_MESSAGE[action]);
  }, [allowed, action, pathname, notify]);

  if (!allowed) return <Navigate to="/" replace />;
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
    // Pathless wrapper — exists only to give the whole app one shared
    // errorElement (React Router falls back to its own bare-bones dev error
    // screen otherwise). Renders an implicit <Outlet/> since it has no
    // `element` of its own, so this changes nothing about normal routing.
    errorElement: <RouteErrorBoundary />,
    children: [
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
              rbLeaf({ rb: RB.ASSET_SUMMARY, element: <AssetSummaryPage /> }),
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
                rb: RB.PURCHASE_RATE_CONTRACT,
                list: <PurchaseRateContractPage />,
                form: <PurchaseRateContractForm />,
                variants: ["new", "edit", "view"],
              }),
              rbModule({
                rb: RB.PURCHASE_QUOTATION,
                list: <PurchaseQuotationPage />,
                form: <PurchaseQuotationForm />,
                variants: ["new", "edit"],
              }),
              {
                path: "purchase-quotation-comparison",
                element: <PurchaseQuotationComparisonPage />,
              },
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
              rbModule({
                rb: RB.ASSETS_DEPRECIATION_IT_ACT,
                list: <AssetsDepreciationITActPage />,
                form: <AssetsDepreciationITActForm />,
              }),
              rbLeaf({
                rb: RB.ASSET_DEPRECIATION_PERCENTAGE,
                element: <AssetDepreciationPercentagePage />,
              }),
              rbLeaf({ rb: RB.FAR, element: <FarPage /> }),
              rbModule({
                rb: RB.ASSETS_ITEM_OPENING,
                list: <AssetsItemOpeningPage />,
                form: <AssetsItemOpeningForm />,
              }),
              rbModule({
                rb: RB.BOM_MASTER,
                list: <BomMasterPage />,
                form: <BomMasterForm />,
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
                rb: RB.ASSETS_CLIENT_RELEASE,
                list: <AssetsClientReleasePage />,
                form: <AssetsClientReleaseForm />,
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
              rbModule({
                rb: RB.PREVENTIVE_MAINTENANCE_INTERNAL,
                list: <PreventiveMaintenanceInternalPage />,
                form: <PreventiveMaintenanceInternalForm />,
              }),
              rbModule({
                rb: RB.ASSET_PARTS_INDENT,
                list: <AssetPartsIndentDetailPage />,
                form: <AssetPartsIndentDetailForm />,
              }),
              rbLeaf({ rb: RB.MAINTENANCE_DASHBOARD, element: <MaintenanceDashboard /> }),
              rbLeaf({ rb: RB.WORKFLOW_DASHBOARD, element: <WorkflowDashboard /> }),
              // No RB — reached only via a row click on Workflow Dashboard, no
              // sidebar nav entry (MRD: "New Form Route: Not Present", blank
              // "Nav Menu Label", confirmed 2026-08-14 /pm). Same plain
              // param-route pattern as "main/:reportBoardId" above.
              { path: "wkfmain", element: <WKFMainPage /> },

              // Asset Part Indent (2026-08-25 /pm) — brand-new, read-only
              // two-grid browse page; no RB code was given for this module, so
              // (unlike every other Assets route) it isn't wired through
              // rbModule/RB_CODES — same plain-route pattern as "wkfmain" above.
              // DOES have a sidebar nav entry, unlike wkfmain — see AppShell.jsx.
              { path: "assets-part-indent", element: <AssetPartIndentPage /> },

              // Admin — Master modules
              rbLeaf({ rb: RB.MAIN_GROUP_MASTER, element: <MainGroupMasterPage /> }),
              rbLeaf({ rb: RB.SUB_MAIN_GROUP_MASTER, element: <SubMainGroupMasterPage /> }),
              rbLeaf({ rb: RB.SUB_GROUP_MASTER, element: <SubGroupMasterPage /> }),
              rbLeaf({ rb: RB.COUNTRY_MASTER, element: <CountryMasterPage /> }),
              rbLeaf({ rb: RB.STATE_MASTER, element: <StateMasterPage /> }),
              rbLeaf({ rb: RB.CITY_MASTER, element: <CityMasterPage /> }),
              rbLeaf({ rb: RB.LOCATION_MASTER, element: <LocationMasterPage /> }),
              rbLeaf({ rb: RB.DIVISION_MASTER, element: <DivisionMasterPage /> }),
              rbLeaf({ rb: RB.ASSETS_ITEM_OPENING_EXCEL, element: <AssetsItemOpeningExcelForm /> }),
              rbLeaf({ rb: RB.ITEM_MASTER_UPLOAD_EXCEL, element: <ItemMasterUploadExcelForm /> }),
              rbLeaf({ rb: RB.SUPPLIER_MASTER, element: <SupplierMasterPage /> }),
              { path: "admin/master/customer-master", element: <CustomerMasterPage /> },
              rbLeaf({ rb: RB.USER_MASTER, element: <UserMasterPage /> }),
              rbLeaf({ rb: RB.USER_GROUP, element: <UserGroupPage /> }),
              rbLeaf({ rb: RB.DIVISION_WISE_RIGHTS, element: <DivisionWiseRightsPage /> }),
              rbLeaf({ rb: RB.USER_WISE_GROUP_RIGHTS, element: <UserWiseGroupRightsPage /> }),
              rbLeaf({ rb: RB.ITEM_MASTER, element: <ItemMasterPage /> }),
              rbLeaf({ rb: RB.DEPARTMENT_MASTER, element: <DepartmentMasterPage /> }),
              rbLeaf({ rb: RB.COMPANY, element: <CompanyPage /> }),
              rbLeaf({ rb: RB.ACCOUNT_GROUP_MASTER, element: <AccountGroupMasterPage /> }),
              rbLeaf({ rb: RB.ACCOUNT_MASTER, element: <AccountMasterPage /> }),
              rbLeaf({ rb: RB.VOUCHER_TYPE_MASTER, element: <VoucherTypeMasterPage /> }),
              rbModule({
                rb: RB.DOP_MASTER,
                list: <DopMasterPage />,
                form: <DopMasterForm />,
              }),
              rbModule({
                rb: RB.TRANSPORTER_MASTER,
                list: <TransporterMasterPage />,
                form: <TransporterMasterForm />,
              }),
              rbLeaf({ rb: RB.DM_DEPARTMENT_MASTER, element: <DMDepartmentMasterPage /> }),
              rbLeaf({ rb: RB.DOCUMENT_TYPE_MASTER, element: <DocumentTypeMasterPage /> }),
              rbLeaf({ rb: RB.DOCUMENT_SUBTYPE_MASTER, element: <DocumentSubTypeMasterPage /> }),
              rbLeaf({ rb: RB.DM_TT2DOCTYPE_MASTER, element: <DMTT2DocTypeMasterPage /> }),
              rbLeaf({ rb: RB.DM_GROUP_RIGHTS, element: <DMGroupRightsPage /> }),
              rbLeaf({ rb: RB.DM_TRAN_TYPE_LINK, element: <DMTranTypeLinkPage /> }),
              { path: "demo/trial-balance", element: <TrialBalanceDemoPage /> },
              { path: "*", element: <Navigate to="/" replace /> },
            ],
          },
        ],
      },
    ],
  },
]);

export default function App() {
  // Applies everywhere, including the login page — not gated on auth.
  useUiGuard();
  return (
    <UserProvider>
      <PageHeaderProvider>
        <RouterProvider router={router} />
      </PageHeaderProvider>
    </UserProvider>
  );
}
