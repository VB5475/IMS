import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import AppShell from "./layout/AppShell";
import LoginPage from "./pages/login/LoginPage";
import EnterpriseDashboard from "./pages/dashboard/EnterpriseDashboard";
import ReportWorkspacePage from "./pages/report-workspace/ReportWorkspacePage";
import TxnEntryPage from "./pages/txn-entry/TxnEntryPage";
import PurchaseInquiryPage from "./pages/purchase-inquiry/PurchaseInquiryPage";
import PurchaseInquiryForm from "./pages/purchase-inquiry/PurchaseInquiryForm";
import PurchaseQuotationPage from "./pages/purchase-quotation/PurchaseQuotationPage";
import PurchaseQuotationForm from "./pages/purchase-quotation/PurchaseQuotationForm";
import PurchaseOrderPage from "./pages/purchase-order/PurchaseOrderPage";
import PurchaseOrderForm from "./pages/purchase-order/PurchaseOrderForm";
import { PageHeaderProvider } from "./context/PageHeaderContext";
import { UserProvider, useUser } from "./context/UserContext";

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
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
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<EnterpriseDashboard />} />
          <Route path="main/:reportBoardId" element={<ReportWorkspacePage />} />
          <Route path="txn-entry/:id?" element={<TxnEntryPage />} />
          <Route path="purchase-inquiry" element={<PurchaseInquiryPage />} />
          <Route path="purchase-inquiry/:id" element={<PurchaseInquiryForm />} />
          <Route path="purchase-inquiry/:id/edit" element={<PurchaseInquiryForm />} />
          <Route path="purchase-order" element={<PurchaseOrderPage />} />
          <Route path="purchase-quotation/new" element={<PurchaseQuotationForm />} />
          <Route path="purchase-quotation/:id/edit" element={<PurchaseQuotationForm />} />
          <Route path="purchase-quotation" element={<PurchaseQuotationPage />} />
          <Route path="purchase-order/:id" element={<PurchaseOrderForm />} />
          <Route path="purchase-order/:id/edit" element={<PurchaseOrderForm />} />
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
