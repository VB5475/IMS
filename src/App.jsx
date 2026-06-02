import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AppShell from './layout/AppShell';
import LoginPage from './pages/LoginPage';
import EnterpriseDashboard from './pages/EnterpriseDashboard';
import ReportWorkspacePage from './pages/ReportWorkspacePage';
import TxnEntryPage from './pages/TxnEntryPage';
import { PageHeaderProvider } from './context/PageHeaderContext';

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
