import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AppShell from './layout/AppShell';
import LoginPage from './pages/login/LoginPage';
import EnterpriseDashboard from './pages/dashboard/EnterpriseDashboard';
import ReportWorkspacePage from './pages/report-workspace/ReportWorkspacePage';
import TxnEntryPage from './pages/txn-entry/TxnEntryPage';
import PurchaseInquiryPage from './pages/purchase-inquiry/PurchaseInquiryPage';
import PurchaseInquiryForm from './pages/purchase-inquiry/PurchaseInquiryForm';
import { PageHeaderProvider } from './context/PageHeaderContext';
import PurchaseOrderPage  from './pages/purchase-order/PurchaseOrderPage';
import PurchaseOrderForm  from './pages/purchase-order/PurchaseOrderForm';
function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<EnterpriseDashboard />} />
        <Route path="main/:reportBoardId" element={<ReportWorkspacePage />} />
        <Route path="txn-entry/:id?" element={<TxnEntryPage />} />
        <Route path="purchase-inquiry"      element={<PurchaseInquiryPage />} />
        <Route path="purchase-inquiry/:id" element={<PurchaseInquiryForm />} />
        <Route path="purchase-order"       element={<PurchaseOrderPage />} />
        <Route path="purchase-order/:id"   element={<PurchaseOrderForm />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PageHeaderProvider>
        <AppRoutes />
      </PageHeaderProvider>
    </BrowserRouter>
  );
}
