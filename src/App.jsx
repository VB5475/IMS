import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import AppShell from "./layout/AppShell";
import Loader from "./components/ui/Loader";
import { PageHeaderProvider } from "./context/PageHeaderContext";
import { UserProvider, useUser } from "./context/UserContext";

const LoginPage = lazy(() => import("./pages/login/LoginPage"));
const EnterpriseDashboard = lazy(() => import("./pages/dashboard/EnterpriseDashboard"));
const ReportWorkspacePage = lazy(() => import("./pages/report-workspace/ReportWorkspacePage"));
const TxnEntryPage = lazy(() => import("./pages/txn-entry/TxnEntryPage"));
const PurchaseInquiryPage = lazy(() => import("./pages/purchase-inquiry/PurchaseInquiryPage"));
const PurchaseInquiryForm = lazy(() => import("./pages/purchase-inquiry/PurchaseInquiryForm"));
const PurchaseQuotationPage = lazy(() => import("./pages/purchase-quotation/PurchaseQuotationPage"));
const PurchaseQuotationForm = lazy(() => import("./pages/purchase-quotation/PurchaseQuotationForm"));
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
const MainGroupMasterPage = lazy(() => import("./pages/main-group-master/MainGroupMasterPage"));
const UserMasterPage = lazy(() => import("./pages/user-master/UserMasterPage"));
const UserGroupPage = lazy(() => import("./pages/user-group/UserGroupPage"));
const DivisionWiseRightsPage = lazy(() => import("./pages/division-wise-rights/DivisionWiseRightsPage"));
const ItemMasterPage = lazy(() => import("./pages/item-master/ItemMasterPage"));
const DepartmentMasterPage = lazy(() => import("./pages/department-master/DepartmentMasterPage"));
const CompanyPage = lazy(() => import("./pages/company/CompanyPage"));

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

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Suspense fallback={<Loader text="Loading page…" />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<EnterpriseDashboard />} />
          <Route path="main/:reportBoardId" element={<ReportWorkspacePage />} />
          <Route path="txn-entry/:id?" element={<TxnEntryPage />} />
          <Route path="purchase-inquiry" element={<PurchaseInquiryPage />} />
          <Route path="purchase-inquiry/:id" element={<PurchaseInquiryForm />} />
          <Route path="purchase-inquiry/:id/edit" element={<PurchaseInquiryForm />} />
          <Route path="purchase-inquiry/:id/edit" element={<PurchaseInquiryForm />} />
          <Route path="purchase-order" element={<PurchaseOrderPage />} />
          <Route path="purchase-order/:id" element={<PurchaseOrderForm />} />
          <Route path="purchase-quotation/new" element={<PurchaseQuotationForm />} />
          <Route path="purchase-quotation/:id/edit" element={<PurchaseQuotationForm />} />
          <Route path="purchase-quotation" element={<PurchaseQuotationPage />} />
          <Route path="purchase-order/:id/edit" element={<PurchaseOrderForm />} />
          <Route path="purchase-indent" element={<PurchaseIndentPage />} />
          <Route path="purchase-indent/new" element={<PurchaseIndentForm />} />
          <Route path="purchase-indent/:id" element={<PurchaseIndentForm />} />
          <Route path="purchase-indent/:id/edit" element={<PurchaseIndentForm />} />
          <Route path="purchase-voucher" element={<PurchaseVoucherPage />} />
          <Route path="purchase-voucher/new" element={<PurchaseVoucherForm />} />
          <Route path="purchase-voucher/:id" element={<PurchaseVoucherForm />} />
          <Route path="purchase-voucher/:id/edit" element={<PurchaseVoucherForm />} />
          <Route path="goods-received-note" element={<GoodsReceivedNotePage />} />
          <Route path="goods-received-note/new" element={<GoodsReceivedNoteForm />} />
          <Route path="goods-received-note/:id/edit" element={<GoodsReceivedNoteForm />} />
          <Route path="cwip-to-fa" element={<CWIPToFAPage />} />
          <Route path="cwip-to-fa/new" element={<CWIPToFAForm />} />
          <Route path="cwip-to-fa/:id" element={<CWIPToFAForm />} />
          <Route path="cwip-to-fa/:id/edit" element={<CWIPToFAForm />} />
          <Route path="admin/main-group-master" element={<MainGroupMasterPage />} />
          <Route path="admin/user-master" element={<UserMasterPage />} />
          <Route path="admin/user-group" element={<UserGroupPage />} />
          <Route path="admin/division-wise-rights" element={<DivisionWiseRightsPage />} />
          <Route path="admin/item-master" element={<ItemMasterPage />} />
          <Route path="admin/department-master" element={<DepartmentMasterPage />} />
          <Route path="admin/company" element={<CompanyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <PageHeaderProvider>
          <AppRoutes />
        </PageHeaderProvider>
      </UserProvider>
    </BrowserRouter>
  );
}
