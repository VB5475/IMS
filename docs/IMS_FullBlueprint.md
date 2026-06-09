# Horizon Enterprise IMS — Full Project Blueprint
> **Self-contained cloning guide.** Contains complete source code of every file.
> Copy the files in order and the project runs without any git repository.

**Stack:** React 19 · React Router 7 · Vite 8 · Axios 1.x · Lucide React  
**Styling:** Vanilla CSS with design tokens  
**No:** TypeScript · Redux · test suite

---

## Quick Start

```bash
# 1. Create project with Vite
npm create vite@latest horizon-enterprise -- --template react
cd horizon-enterprise

# 2. Install exact runtime deps
npm install react@^19 react-dom@^19 react-router-dom@^7 axios@^1 lucide-react@^1

# 3. Install dev deps
npm install -D @vitejs/plugin-react@^6 vite@^8

# 4. Remove Vite boilerplate
rm src/App.css src/assets/react.svg public/vite.svg

# 5. Create folder structure
mkdir -p src/{api,components/{ui,grid,filters,dashboard,purchase-inquiry,txn},context,data,hooks,layout,pages/{dashboard,login,purchase-inquiry,purchase-order,report-workspace,txn-entry},theme,utils}

# 6. Copy every file from this document (Parts 1-14) into the matching path

# 7. Start dev server
npm run dev
```

---


## Part 1 — Bootstrap & Entry Points

### `package.json`
*Exact dependency list*

```json
{
  "name": "horizon-enterprise",
  "private": true,
  "version": "1.0.0",
  "description": "Horizon Enterprise — standalone ERP workspace UI",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.16.0",
    "lucide-react": "^1.16.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.15.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.1",
    "docx": "^9.7.1",
    "html-to-docx": "^1.8.0",
    "playwright": "^1.60.0",
    "vite": "^8.0.12"
  }
}
```

---

### `vite.config.js`
*Vite 8 build configuration*

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5175 },
});
```

---

### `src/main.jsx`
*React 19 DOM entry point*

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

---

### `src/App.jsx`
*Root routing tree + context providers*

```jsx
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
```

---


## Part 2 — Design System (CSS Tokens)

### `src/index.css`
*Global resets + theme imports*

```css
@import './theme/enterprise.css';
@import './theme/workspace-base.css';
@import './theme/enterprise-components.css';

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  overflow: hidden;
}

body {
  margin: 0;
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: 1.3;
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select,
textarea {
  font: inherit;
}
```

---

### `src/theme/enterprise.css`
*Design tokens (colours, spacing, typography)*

```css
/* Horizon Enterprise — design tokens */
:root {
  --primary: #1e4a7a;
  --primary-hover: #00335f;
  --primary-light: #d3e3ff;
  --primary-lighter: #eef4fa;
  --accent: #0660a7;
  --secondary: #226db4;

  --navy-dark: #0f2d4a;
  --navy-mid: #1a3a5c;
  --navy: #1e4a7a;
  --navy-light: #72b1fd;

  --danger: #d93025;
  --danger-hover: #ba1a1a;
  --success: #089949;
  --warning: #e37400;

  --orange: #e37400;
  --orange-hover: #c26400;
  --orange-light: #fef3e8;

  --magenta: #c2327a;
  --magenta-light: #fce7f3;

  --bg: #e8eef4;
  --bg-tint: #eef4fa;
  --sidebar-bg: linear-gradient(180deg, #0f2d4a 0%, #1a3a5c 100%);
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-text: rgba(255, 255, 255, 0.72);
  --sidebar-text-active: #ffffff;
  --surface: #ffffff;
  --border: #d8dee6;
  --border-dark: #c3c6d0;

  --text: #161c21;
  --text-secondary: #42474f;
  --text-muted: #737780;

  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.04);
  --shadow: 0 2px 4px rgb(0 0 0 / 0.05);
  --shadow-md: 0 2px 4px rgb(0 0 0 / 0.05), 0 8px 16px rgb(0 0 0 / 0.05);
  --shadow-lg: 0 4px 12px rgb(0 0 0 / 0.08);

  --radius: 4px;
  --radius-sm: 4px;
  --radius-lg: 6px;
  --transition: 150ms ease;

  --header-gradient: linear-gradient(180deg, #f4f6f9 0%, #eef4fa 100%);
  --header-gradient-deep: var(--sidebar-bg);
  --header-height: 26px;
  --grid-row-height: 24px;
  --grid-filter-row-height: 24px;
  --grid-visible-rows: 18;
  --grid-thead-rows: 1;
  --grid-fixed-height: calc(100vh - var(--topbar-height) - 220px);
  --page-header-accent: var(--primary);

  --sidebar-width: 220px;
  --sidebar-collapsed: 64px;
  --topbar-height: 44px;

  --chevron-svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737780' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");

  --font-family: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --font-size-base: 13px;
  --font-size-sm: 12px;
  --font-size-xs: 11px;

  /* Grid base — neutral grey foundation under column-type tints */
  --col-base-bg: #eef1f5;
  --col-base-header-bg: #e4e8ee;
  --col-base-header-text: #5c6470;
  --col-base-filter: #e8ebf0;
  --col-base-hover: #e4e8ee;
  --col-base-selected: #dce4ed;

  /* IsFreezeReq — navy frozen anchor columns */
  --col-fixed-bg: #1e4a7a;
  --col-fixed-text: #ffffff;
  --col-fixed-border: #163a62;
  --col-fixed-body: #ffffff;
  --col-fixed-filter: #eef4fa;
  --col-fixed-label: #1e4a7a;
  --col-fixed-stripe: #1e4a7a;
  --col-fixed-accent: #72b1fd;

  /* IsEditAllow — muted grey (editable inputs) */
  --col-editable-bg: #e4e7ec;
  --col-editable-text: #5c6470;
  --col-editable-border: rgba(92, 100, 112, 0.4);
  --col-editable-body: #f0f2f6;
  --col-editable-filter: #e8ebf0;
  --col-editable-input-bg: #ffffff;
  --col-editable-input-border: #c3c6d0;
  --col-editable-accent: #737780;

  /* Read-only — cool primary blue (display values) */
  --col-readonly-bg: #dceaf7;
  --col-readonly-text: #1a4572;
  --col-readonly-border: rgba(26, 69, 114, 0.4);
  --col-readonly-body: #e6f1fc;
  --col-readonly-filter: #e3eef8;
  --col-readonly-label: #163a62;
  --col-readonly-accent: #226db4;
}

::selection {
  background: rgba(30, 74, 122, 0.15);
  color: var(--text);
}

::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 10px;
}
```

---

### `src/theme/enterprise-components.css`
*Shared component base styles*

```css
/* Enterprise restyle for data grids — flat headers, compact rows, no gradients */

/* ── Enterprise Data Grid (NormalGrid) ── */
.ng-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.ng-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f4f6f9;
  border-bottom: 1px solid var(--border);
  min-height: 36px;
}

.ng-card-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.ng-table thead th {
  background: var(--bg-tint) !important;
  color: var(--text-secondary) !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 6px 12px !important;
  height: 28px;
  border-bottom: 1px solid var(--border) !important;
  border-right: none !important;
}

.ng-table tbody td {
  padding: 6px 12px !important;
  font-size: 12px !important;
  height: 32px;
  border-right: none !important;
  border-bottom: 1px solid var(--border);
}

.ng-table tbody tr:nth-child(even) td {
  background: #fafbfc;
}

.ng-table tbody tr:hover td {
  background: var(--primary-lighter) !important;
}

.ng-link {
  color: var(--primary);
  font-weight: 600;
  cursor: pointer;
}

.ng-link:hover {
  text-decoration: underline;
  color: var(--primary-hover);
}

.ng-badge--danger { background: #fee2e2; color: #b91c1c; }
.ng-badge--warning { background: #fef3c7; color: #92400e; }
.ng-badge--success { background: #d1fae5; color: #065f46; }
.ng-badge--neutral { background: #f1f5f9; color: var(--text-muted); }

.ng-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 700;
}

.ng-bottom-panel {
  background: var(--surface) !important;
  border-top: 1px solid var(--border) !important;
  padding: 4px 12px !important;
}

.ng-pagination-info {
  color: var(--text-secondary) !important;
  font-size: 12px !important;
}

.ng-pagination-info strong {
  color: var(--text) !important;
}

.ng-page-btn {
  background: var(--surface) !important;
  border: 1px solid var(--border) !important;
  color: var(--text) !important;
  font-size: 12px !important;
  padding: 4px 12px !important;
  border-radius: var(--radius) !important;
}

.ng-page-btn:hover:not(:disabled) {
  background: var(--primary-lighter) !important;
  border-color: var(--primary) !important;
  color: var(--primary) !important;
}

.ng-select {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 12px;
  padding: 2px 6px;
}

/* ── Enterprise Grid (GridForm) ── */
.erp-grid-container {
  background: var(--surface);
  border: 2px solid var(--primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 8px rgba(30, 74, 122, 0.08);
  overflow: hidden;
}

.grid-header {
  background: #f4f6f9 !important;
  border-bottom: 1px solid var(--border) !important;
  padding: 8px 16px !important;
  min-height: 36px !important;
  box-shadow: none !important;
}

.grid-header::after {
  display: none !important;
}

.grid-title {
  color: var(--primary) !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  text-shadow: none !important;
}

/* Column-type header/body colors live in EnterpriseGrid.css — do not override here */

.grid-bottom-panel {
  background: var(--surface) !important;
  border-top: 1px solid var(--border) !important;
  box-shadow: none !important;
  padding: 4px 12px !important;
}

.toolbar-btn {
  background: var(--surface) !important;
  border: 1px solid var(--border) !important;
  color: var(--text) !important;
  font-size: 11px !important;
  padding: 3px 10px !important;
  min-height: 24px !important;
  border-radius: var(--radius) !important;
  box-shadow: none !important;
  gap: 5px !important;
}

.toolbar-btn:hover {
  background: var(--primary-lighter) !important;
  border-color: var(--primary) !important;
  color: var(--primary) !important;
  transform: none !important;
}

.toolbar-btn.primary {
  background: var(--primary) !important;
  border-color: var(--primary) !important;
  color: #fff !important;
}

.toolbar-btn.primary:hover {
  background: var(--primary-hover) !important;
}

/* ── Filter panels ── */
.filter-panel,
.tef-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.fp-toolbar {
  background: #f4f6f9 !important;
  border-bottom: 1px solid var(--border) !important;
  box-shadow: none !important;
}

.fp-toolbar__title {
  color: var(--primary) !important;
  font-size: 13px !important;
  text-shadow: none !important;
}

.filter-search-btn {
  background: var(--primary) !important;
  border: 1px solid var(--primary) !important;
  color: #fff !important;
  border-radius: var(--radius) !important;
  box-shadow: none !important;
}

.filter-search-btn.filter-action-btn {
  background: var(--success) !important;
  border-color: var(--success) !important;
}

.filter-control input,
.filter-control textarea,
.tef-control input,
.tef-control textarea {
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  font-size: 13px !important;
  height: 32px;
}

.filter-control-label,
.tef-label {
  font-size: 12px !important;
  font-weight: 500 !important;
  color: var(--text-secondary) !important;
}

/* ── Loader ── */
.loader-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px;
  color: var(--text-secondary);
  font-size: 13px;
}

.loader-spin {
  animation: ent-spin 0.8s linear infinite;
  color: var(--primary);
}

@keyframes ent-spin {
  to { transform: rotate(360deg); }
}

/* ── Search select ── */
.ss-trigger {
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  font-size: 13px !important;
  min-height: 32px !important;
  background: var(--surface) !important;
}

.ss-trigger:focus,
.ss-trigger.ss-open {
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 2px rgba(30, 74, 122, 0.12) !important;
}

/* ── Modal ── */
.modal-overlay {
  backdrop-filter: blur(4px);
}

.modal-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.modal-header {
  background: #f4f6f9 !important;
  border-bottom: 1px solid var(--border) !important;
}

.modal-title {
  color: var(--primary) !important;
  font-size: 15px !important;
  text-shadow: none !important;
}
```

---

### `src/theme/workspace-base.css`
*Page/workspace layout helpers*

```css
/* Workspace page layout — self-contained base structural styles */

.workspace-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  box-sizing: border-box;
}

/* Filter + grid pages: lock to viewport height, grid absorbs leftover space */
.workspace-page--fill {
  flex: 1;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 12px 16px;
}

.workspace-page--fill .workspace-page__filters {
  flex: 0 1 auto;
  min-height: 0;
  max-height: 42vh;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
}

.workspace-page__grid {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.workspace-page__grid > .erp-grid-container,
.workspace-page__grid > .workspace-empty,
.workspace-page__grid > .workspace-error {
  flex: 1;
  min-height: 0;
}

.workspace-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  background: var(--surface);
  border: 1px dashed var(--border-dark);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  text-align: center;
}

.workspace-empty svg {
  opacity: 0.45;
}

.workspace-empty p {
  margin: 0;
  font-size: 13px;
  max-width: 360px;
}

.workspace-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: #fef2f1;
  border: 1px solid #fecaca;
  border-left: 3px solid var(--danger);
  border-radius: var(--radius);
  color: var(--danger);
  font-size: 13px;
}

.workspace-error button {
  margin-left: auto;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.app-filter-section,
.app-grid-section {
  /* legacy class names used by grid pages */
}

.enterprise-content .app-filter-section {
  padding: 0;
}

.enterprise-content .app-grid-section {
  margin: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface);
}

.enterprise-content .app-empty-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  color: var(--text-muted);
  text-align: center;
}
```

---


## Part 3 — API Layer

### `src/api/constants.js`
*Base URLs, ENDPOINTS, OBJ_TYPE, defaults, getColDefault()*

```js
// constants.js — Shared API constants for the whole project
// ──────────────────────────────────────────────────────────
// Page-specific configs (RB codes, SP names, IDs, storage keys) live in each
// page's own constants file, e.g. src/pages/purchase-inquiry/constants.js.
// The re-exports below keep existing hook/component import paths unchanged.

// ── Base URLs ──────────────────────────────────────────────────────────
export const API_BASE_URL =
  'http://122.179.135.100:8095/IMS_LIVE/webservice/WsIMS.asmx';

export const API_BASE_URL_OLD =
  'http://122.179.135.100:8095/ERPWS_TB/webservice/WsIMS.asmx';

// REST-style endpoint — body is a JSON object, not query params.
// Used by SPs that route through the newer /API/Values gateway.
export const API_BASE_URL_IMS =
  'http://122.179.135.100:8095/IMS_LIVE';

// ── API endpoint paths ─────────────────────────────────────────────────
export const ENDPOINTS = {
  FN_FETCH_DATA: '/FN_Fetch_Data',
  // REST gateway — accepts a JSON body: { ObjType, ObjName, JSon (array), p_ErrCode, p_ErrMsg }
  API_VALUES: '/API/Values',
  GET_FILTERS: '/GetFilters',
  GET_FILTER_DETAIL: '/GetFilterDetail',
  GET_MASTER_DETAIL: '/GetMasterDetail',
  GET_PARAMETERS: '/GetParameters',
  GET_DETAIL_COL_DATA: '/GetDetailColData',
  GET_MASTER_DATA_FILL: '/GetMasterDataFill',
  RB_REPORTBOARD_DETAIL_SAVE: '/RB_ReportBoardDetail_Save',
  FN_TBL_RB_GRID_EVENT: '/fn_tbl_RB_Grid_Event',
  RB_MASTER_DETAIL_FORM_SAVE: '/RB_MasterDetailForm_Save',
};

// ── Shared request defaults (used across pages) ────────────────────────
export const DEFAULT_LOGIN_ID = 1;
export const DEFAULT_COMPANY_ID = 1;
export const DEFAULT_YEAR_ID = 13;
export const DEFAULT_SESSION_ID = 88;
export const DEFAULT_DIVISION_ID = 0;
export const API_TIMEOUT = 30000;

/** FN_Fetch_Data / API/Values — ObjType discriminator */
export const OBJ_TYPE = {
  PROCEDURE: 1,
  FUNCTION: 2,
};

export const CBO_MODE = {
  FILTER: 'F',
  COLUMN: 'C',
};

// ── Column data-type identifiers (prefix-matched against ColDataType) ──
export const COL_DATA_TYPE = {
  NUMERIC: 'numeric',   // → default 0
  VARCHAR: 'varchar',   // → default ''
  DATETIME: 'datetime',  // → default null
};

/**
 * Returns the correct server-side default value for a column based on its
 * ColDataType string from the GET_DETAIL_COL_DATA response.
 * @param {string|null|undefined} colDataType  e.g. "numeric(18,2)", "varchar(50)"
 * @returns {number|string|null}
 */
export function getColDefault(colDataType) {
  if (!colDataType) return null;
  const lower = colDataType.toLowerCase().trimStart();
  if (lower.startsWith(COL_DATA_TYPE.NUMERIC)) return 0;
  if (lower.startsWith(COL_DATA_TYPE.VARCHAR)) return '';
  if (lower.startsWith(COL_DATA_TYPE.DATETIME)) return null;
  return null;
}

// ══════════════════════════════════════════════════════════════════════
// Page-config re-exports — the authoritative definitions live in each
// page's own constants.js; these re-exports keep hooks and shared
// components working without touching their import paths.
// ══════════════════════════════════════════════════════════════════════
export { DASHBOARD_CONFIG } from '../pages/dashboard/constants';
export { REPORT_WORKSPACE_CONFIG } from '../pages/report-workspace/constants';
export { TXN_CONFIG }              from '../pages/txn-entry/constants';
export { PI_CONFIG }               from '../pages/purchase-inquiry/constants';
export { PO_CONFIG }               from '../pages/purchase-order/constants';
```

---

### `src/api/useApi.js`
*Axios client cache + useApi hook (get / post / getWithBody)*

```js
// useApi.js — Custom hook with a global Axios interceptor
// ────────────────────────────────────────────────────────
// Every API call in the project goes through this single instance,
// so logging, auth headers, error normalization, etc. are applied
// in one place.
//
// Pass an optional baseURL to target a different server (e.g. API_BASE_URL_OLD).
//
// ── get(endpoint, params) ────────────────────────────────────────────
// Accepts a plain-object `params` map.
// Serialises it to URLSearchParams internally — callers never touch
// URLSearchParams directly.

import { useState, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from './constants';

function attachInterceptors(client) {
  client.interceptors.request.use(
    (config) => {
      console.log(
        `%c[API ➜] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        'color:#6366f1;font-weight:600',
        config.params || '',
      );
      return config;
    },
    (error) => {
      console.error('[API ➜] Request setup error:', error);
      return Promise.reject(error);
    },
  );

  client.interceptors.response.use(
    (response) => {
      console.log(
        `%c[API ✓] ${response.status} ${response.config.url}`,
        'color:#22c55e;font-weight:600',
      );
      return response.data;
    },
    (error) => {
      if (axios.isCancel(error)) return Promise.reject(error);

      const status = error.response?.status;
      const url = error.config?.url;

      console.error(
        `%c[API ✗] ${status || 'NETWORK'} ${url}`,
        'color:#ef4444;font-weight:600',
        error.response?.data || error.message,
      );

      return Promise.reject({
        status,
        message: error.response?.data?.message || error.message,
        raw: error,
      });
    },
  );
}

const clientCache = new Map();

/** Returns a cached axios client for the given base URL. */
export function getApiClient(baseURL = API_BASE_URL) {
  if (!clientCache.has(baseURL)) {
    const client = axios.create({
      baseURL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    attachInterceptors(client);
    clientCache.set(baseURL, client);
  }
  return clientCache.get(baseURL);
}

/** Default client — IMS_LIVE */
export const apiClient = getApiClient(API_BASE_URL);

function buildQueryString(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== null && v !== undefined);
  return new URLSearchParams(Object.fromEntries(entries)).toString();
}

/**
 * useApi — provides `get` and `post` helpers that track loading / error state.
 * @param {string} [baseURL] — defaults to API_BASE_URL
 */
export function useApi(baseURL = API_BASE_URL) {
  const client = useMemo(() => getApiClient(baseURL), [baseURL]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const activeRequests = useRef(0);

  const get = useCallback(async (url, params = {}) => {
    const qs = buildQueryString(params);
    const fullUrl = qs ? `${url}?${qs}` : url;

    activeRequests.current += 1;
    setLoading(true);
    setError(null);
    try {
      return await client.get(fullUrl);
    } catch (err) {
      if (!axios.isCancel(err)) setError(err);
      throw err;
    } finally {
      activeRequests.current -= 1;
      if (activeRequests.current === 0) setLoading(false);
    }
  }, [client]);

  const post = useCallback(async (url, body = {}, params = {}) => {
    const qs = buildQueryString(params);
    const fullUrl = qs ? `${url}?${qs}` : url;

    activeRequests.current += 1;
    setLoading(true);
    setError(null);
    try {
      return await client.post(fullUrl, body);
    } catch (err) {
      if (!axios.isCancel(err)) setError(err);
      throw err;
    } finally {
      activeRequests.current -= 1;
      if (activeRequests.current === 0) setLoading(false);
    }
  }, [client]);

  // GET with a JSON request body (mirrors: --request GET --header 'Content-Type: application/json' --data '{...}').
  // Uses client.request() instead of client.get() to guarantee Axios serialises
  // and sends the body even though the HTTP verb is GET.
  const getWithBody = useCallback(async (url, body = {}) => {
    activeRequests.current += 1;
    setLoading(true);
    setError(null);
    try {
      return await client.request({
        method: 'GET',
        url,
        data: body,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      if (!axios.isCancel(err)) setError(err);
      throw err;
    } finally {
      activeRequests.current -= 1;
      if (activeRequests.current === 0) setLoading(false);
    }
  }, [client]);

  return useMemo(
    () => ({ get, post, getWithBody, loading, error, client, baseURL }),
    [get, post, getWithBody, loading, error, client, baseURL],
  );
}
```

---


## Part 4 — Utilities & Static Data

### `src/data/dummyData.js`
*controlTypeMap (filter panel control-type constants)*

```js
// dummyData.js — Backend response simulation
// Control Types: Label=0, TextBox=1, Date=2, Dropdown=4, Textarea=9

export const controlTypeMap = {
  LABEL: 0,
  TEXTBOX: 1,
  DATE: 2,
  DROPDOWN: 4,
  TEXTAREA: 9
};

// export const controlTypeName = {
//   0: 'Label',
//   1: 'TextBox',
//   2: 'Date',
//   4: 'Dropdown',
//   9: 'Textarea'
// };

export const gridMeta = {
  title: 'RB Marketing Action',
  division: 'INDIAN CHEMICAL',
  year: '2025-2026',
  pagination: {
    pageSize: 5,
    pageSizeOptions: [5, 10, 25, 50, 100]
  }
};

export const columns = [
  { id: 'cb', name: '', key: 'cb', controlType: 0, isFixed: true, width: 42, filterable: false },
  { id: 'industries', name: 'Industries', key: 'industries', controlType: 0, isFixed: true, width: 140, filterable: true, filterType: 'select' },
  { id: 'productGroup', name: 'Product Group', key: 'productGroup', controlType: 4, isFixed: true, width: 120, filterable: true, filterType: 'select', dropdownOptions: ['ICHOSOL', 'ICHOLACE', 'ICHOPRINT', 'ICHOACID'] },
  { id: 'productName', name: 'Product Name', key: 'productName', controlType: 0, isFixed: true, width: 190, filterable: true, filterType: 'text' },
  { id: 'customer', name: 'Customer', key: 'customer', controlType: 1, isFixed: true, width: 170, filterable: true, filterType: 'text' },
  { id: 'sharingFrom', name: 'Sharing From', key: 'sharingFrom', controlType: 1, isFixed: false, width: 130, filterable: true, filterType: 'text' },
  { id: 'sharingTo', name: 'Sharing To', key: 'sharingTo', controlType: 1, isFixed: false, width: 130, filterable: true, filterType: 'text' },
  { id: 'taskStatus', name: 'Task Status', key: 'taskStatus', controlType: 4, isFixed: false, width: 140, filterable: true, filterType: 'select', dropdownOptions: ['TNC', 'In Progress', 'Completed', 'On Hold', 'Cancelled'] },
  { id: 'tcoDate', name: 'TCO Date', key: 'tcoDate', controlType: 2, isFixed: false, width: 130, filterable: true, filterType: 'date' },
  { id: 'tcoDays', name: 'TCO Days', key: 'tcoDays', controlType: 1, isFixed: false, width: 100, filterable: true, filterType: 'number' },
  { id: 'tcoStage', name: 'TCO Stage', key: 'tcoStage', controlType: 4, isFixed: false, width: 150, filterable: true, filterType: 'select', dropdownOptions: ['Initial', 'Evaluation', 'Negotiation', 'Closed'] },
  { id: 'soNo', name: 'SO No', key: 'soNo', controlType: 1, isFixed: false, width: 120, filterable: true, filterType: 'text' },
  { id: 'exhibition', name: 'Exhibition', key: 'exhibition', controlType: 9, isFixed: false, width: 160, filterable: true, filterType: 'text' },
  { id: 'customerQty', name: 'Customer Qty', key: 'customerQty', controlType: 1, isFixed: false, width: 120, filterable: true, filterType: 'number' },
  { id: 'onenessQty', name: 'Oneness Qty', key: 'onenessQty', controlType: 1, isFixed: false, width: 120, filterable: true, filterType: 'number' }
];

const productNames = [
  'ICHOSOL BLUE EAIP-LOOSE',
  'ICHOLACE BORDEAUX F2RNUPRD-LOOSE',
  'ICHOLACE LEMON YELLOW 3GHNUPRD-LOOSE',
  'ICHOPRINT RED M2G-LOOSE',
  'ICHOLACE YELLOW F4GNU PRD-LOOSE',
  'ICHOSOL BLACK RL-LOOSE',
  'ICHOPRINT NAVY BLUE R-LOOSE',
  'ICHOACID RED G-LOOSE',
  'ICHOLACE ORANGE 3R-LOOSE',
  'ICHOSOL VIOLET 4BL-LOOSE'
];

const customers = [
  'RAJ CHEMICAL CO',
  'BRIGHT ENTERPRISE',
  'NCI CHEMICAL INDUSTRY LTD',
  'SAHYOG G101',
  'PIDILITE INDUSTRIES LTD',
  'AAKASHI COLORANTS PVT LTD',
  'BRITACEL SILICON LTD',
  'APOLLO PAINTS PVT LTD',
  'KANORIA CHEMICALS',
  'MEGHMANI ORGANICS',
  'ATUL LTD',
  'CLARIANT CHEMICALS'
];

const industries = ['Printing & Signage', 'Textile', 'Ceramics & Pottery', 'Agriculture', 'Adhesive', 'Home & Personal Care', 'Paper', 'Leather'];

const sharingCodes = ['43e333333333', 'oo;9', '5533', '5252', 'sdfa', 'A101 OWE', 'RI01 OWE', 'PI01 OWE', 'SAHYOG A101', 'SAHYOG J101', 'SAHYOG G101'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate() {
  const start = new Date(2025, 0, 1);
  const end = new Date(2026, 11, 31);
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

export const rows = Array.from({ length: 25 }, (_, i) => {
  const industry = randomItem(industries);
  const pg = randomItem(['ICHOSOL', 'ICHOLACE', 'ICHOPRINT', 'ICHOACID']);
  const pn = randomItem(productNames);
  const cust = randomItem(customers);
  const sf = randomItem(sharingCodes);
  const st = randomItem(sharingCodes);
  const tco = randomItem(['TNC', 'In Progress', 'Completed', 'On Hold']);
  const stage = randomItem(['Initial', 'Evaluation', 'Negotiation', 'Closed']);
  const cq = Math.floor(Math.random() * 10000);
  const oq = Math.floor(Math.random() * 10000);

  return {
    id: i + 1,
    industries: industry,
    productGroup: pg,
    productName: pn,
    customer: cust,
    sharingFrom: sf,
    sharingTo: st,
    taskStatus: tco,
    tcoDate: randomDate(),
    tcoDays: String(Math.floor(Math.random() * 60) + 1),
    tcoStage: stage,
    soNo: Math.random() > 0.5 ? String(Math.floor(Math.random() * 900000) + 100000) : '',
    exhibition: Math.random() > 0.7 ? 'Competition standard' : (Math.random() > 0.5 ? 'Previous Data' : 'Waiting for customer'),
    customerQty: cq,
    onenessQty: oq
  };
});
```

---

### `src/utils/gridUtils.js`
*buildGridColumns, fetchDropdownOptions, isTruthyApiFlag*

```js
// gridUtils.js — Shared utility functions for grid-based hooks
// ─────────────────────────────────────────────────────────────────────
// Used by: useGridSearch.js, useTxnEntry.js
//
// Contains pure helper functions that are common to both hooks so they
// are defined in one place and imported wherever needed.

import { ENDPOINTS, CBO_MODE, DEFAULT_LOGIN_ID } from '../api/constants';

// ── Column helpers ───────────────────────────────────────────────────

/** API bit flags often arrive as 1/0, "true", or "Y" — not only boolean true. */
export function isTruthyApiFlag(val) {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'y' || s === 'yes';
  }
  return false;
}

/**
 * Maps a ColCtrlType numeric code to a filter-type string understood by GridForm.
 * @param {number} ctrlType
 * @returns {'date'|'select'|'text'}
 */
export function deriveFilterType(ctrlType) {
  switch (ctrlType) {
    case 2: return 'date';
    case 4: return 'select';
    default: return 'text';
  }
}

/**
 * Derives a pixel width for a grid column based on its display-name length.
 * @param {{ DisplayName?: string }} apiCol
 * @returns {number}
 */
export function getColumnWidth(apiCol) {
  // if (apiCol.ColumnWidth && apiCol.ColumnWidth > 0) return apiCol.ColumnWidth * 1.5;
  const len = (apiCol.DisplayName || '').length;
  if (len <= 4) return 80;
  if (len <= 8) return 110;
  if (len <= 14) return 150;
  if (len <= 20) return 180;
  return 220;
}

// ── Proc-parameter helper (used only by useGridSearch) ───────────────

/**
 * Formats a filter value for embedding in a stored-procedure call string.
 * @param {*} value
 * @param {string} dataType  - e.g. 'numeric', 'varchar', …
 * @returns {string}
 */
export function formatParamValue(value, dataType) {
  if (dataType === 'numeric') return `${value ?? ''}`;
  return value != null && value !== '' ? String(value) : '0';
}

// ── Dropdown fetcher ─────────────────────────────────────────────────

/**
 * Fetches dropdown options for every column whose ColCtrlType === 4
 * and returns a map of { [ColName]: [{ value, label }] }.
 *
 * @param {Function}  get          - useApi().get
 * @param {object[]}  apiColumns   - raw column list from GET_DETAIL_COL_DATA
 * @param {number}    masterID     - prmMasterID
 * @param {object}    [opts]
 * @param {string}    [opts.funcCode='']        - FuncCode from master detail
 * @param {number}    [opts.divisionID=0]       - DivisionID from filter values
 * @returns {Promise<Record<string, {value:string, label:string}[]>>}
 */
export async function fetchDropdownOptions(get, apiColumns, masterID, opts = {}) {
  const { funcCode = '', divisionID = 0 } = opts;

  const dropdownCols = apiColumns.filter(c => c.ColCtrlType === 4);
  const colDropdownOptions = {};

  if (dropdownCols.length > 0) {
    await Promise.all(
      dropdownCols.map(async (col) => {
        try {
          console.log("see FilterParameterID:", col)

          const detailData = await get(ENDPOINTS.GET_FILTER_DETAIL, {
            prmMasterID: masterID,
            prmFilterParameterName: col.ObjDetID,
            prmCboMode: CBO_MODE.COLUMN,
            prmFuncCode: funcCode,
            prmDivisionID: divisionID,
            prmLoginID: DEFAULT_LOGIN_ID,
          });


          colDropdownOptions[col.ColName] = (detailData?.Links || []).map(opt => {
            const valKey = opt.FilterCtrlValueCol || 'IDNumber';
            const labelKey = opt.FilterCtrlDisplayCol || 'Name';

            return { value: String(opt[valKey]), label: opt[labelKey] };
          });
        } catch {
          console.warn(`[gridUtils] Failed dropdown for column: ${col.DisplayName}`);
          colDropdownOptions[col.ColName] = [];
        }
      })
    );
  }

  return colDropdownOptions;
}

// ── Column transformer ───────────────────────────────────────────────

/**
 * Converts raw API columns into the shape expected by GridForm,
 * sorts fixed columns first, then prepends the checkbox column.
 *
 * @param {object[]} apiColumns         - raw column list from GET_DETAIL_COL_DATA
 * @param {Record<string, object[]>} colDropdownOptions
 * @param {object}  [opts]
 * @param {boolean} [opts.filterable=true]      - false for entry grids
 * @param {boolean} [opts.allEditable=false]    - true for entry grids
 * @returns {object[]}  gridColumns ready for GridForm
 */
export function buildGridColumns(apiColumns, colDropdownOptions, opts = {}) {
  const { filterable = true, allEditable = false } = opts;

  const dataColumns = apiColumns
    .filter(col => col.IsVisible !== false)
    .map(col => ({
      id: col.ColName,
      name: col.DisplayName,
      key: col.ColName,
      controlType: col.ColCtrlType,
      colDataType: col.ColDataType || null,   // e.g. "numeric(18,2)", "varchar(50)", "datetime"
      width: getColumnWidth(col),
      filterable,
      filterType: deriveFilterType(col.ColCtrlType),
      isFixed: isTruthyApiFlag(col.IsFreezeReq),
      isEditAllow: allEditable ? true : isTruthyApiFlag(col.IsEditAllow),
      dropdownOptions: colDropdownOptions[col.ColName] || [],
    }));

  dataColumns.sort((a, b) => (a.isFixed === b.isFixed ? 0 : a.isFixed ? -1 : 1));

  return [
    { id: 'cb', name: '', key: 'cb', controlType: -1, width: 48, filterable: false, isFixed: true, isEditAllow: false },
    ...dataColumns,
  ];
}
```

---


## Part 5 — React Context

### `src/context/PageHeaderContext.jsx`
*PageHeaderProvider + usePageHeader hook (topbar title/subtitle/back)*

```jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const DEFAULT_HEADER = {
  title: null,
  subtitle: null,
  showBack: false,
  backTo: '/',
};

const PageHeaderContext = createContext(null);

export function PageHeaderProvider({ children }) {
  const [header, setHeaderState] = useState(DEFAULT_HEADER);

  const setHeader = useCallback((partial) => {
    setHeaderState({ ...DEFAULT_HEADER, ...partial });
  }, []);

  const resetHeader = useCallback(() => {
    setHeaderState(DEFAULT_HEADER);
  }, []);

  const value = useMemo(
    () => ({ header, setHeader, resetHeader, hasLayoutHeader: true }),
    [header, setHeader, resetHeader],
  );

  return (
    <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
  );
}

/** Returns true when running inside Nexus/Horizon app shell */
export function useLayoutHeaderActive() {
  return Boolean(useContext(PageHeaderContext)?.hasLayoutHeader);
}

export function usePageHeaderContext() {
  return useContext(PageHeaderContext);
}

/**
 * Register page title/subtitle/back in the app layout top bar.
 * No-op when used outside PageHeaderProvider (original standalone app).
 */
export function usePageHeader({ title, subtitle, showBack = false, backTo = '/' } = {}) {
  const ctx = useContext(PageHeaderContext);
  const setHeader = ctx?.setHeader;
  const resetHeader = ctx?.resetHeader;

  useEffect(() => {
    if (!setHeader) return undefined;
    setHeader({ title, subtitle, showBack, backTo });
    return () => resetHeader?.();
  }, [setHeader, resetHeader, title, subtitle, showBack, backTo]);
}

export function getDefaultRouteTitle(pathname) {
  if (pathname.startsWith('/main/')) return 'Report Workspace';
  if (pathname.startsWith('/txn-entry')) return 'Sample Invoice';
  return 'Dashboard';
}
```

---


## Part 6 — Application Shell

### `src/layout/AppShell.jsx`
*Sidebar + topbar shell wrapping all authenticated pages*

```jsx
import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  ClipboardList,
  ShoppingCart,
  PanelLeftClose,
  PanelLeft,
  Box,
  Bell,
  Search,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import {
  getDefaultRouteTitle,
  usePageHeaderContext,
} from '../context/PageHeaderContext';
import './AppShell.css';

const NAV_SECTIONS = [
  {
    label: 'Home',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true }],
  },
  {
    label: 'Modules',
    items: [
      { to: '/txn-entry',          icon: FileSpreadsheet, label: 'Invoices',           end: false },
      { to: '/purchase-inquiry',   icon: ClipboardList,   label: 'Purchase Inquiry',   end: false },
      { to: '/purchase-order',     icon: ShoppingCart,    label: 'Purchase Order',      end: false },
    ],
  },
];

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { header } = usePageHeaderContext() ?? { header: {} };

  const title = header.title ?? getDefaultRouteTitle(location.pathname);
  const subtitle = header.subtitle ?? 'FY 2025-26 · 01 Jun 2026';

  return (
    <div className={`ent-shell ${collapsed ? 'ent-shell--collapsed' : ''}`}>
      <aside className="ent-sidebar">
        <div className="ent-sidebar__header">
          <div className="ent-sidebar__brand">
            <div className="ent-sidebar__logo">
              <Box size={16} strokeWidth={2} />
            </div>
            {!collapsed && (
              <div>
                <div className="ent-sidebar__name">Horizon Enterprise</div>
                <div className="ent-sidebar__tag">Business Suite</div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="ent-sidebar__collapse"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>

        <nav className="ent-sidebar__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="ent-sidebar__section">
              {!collapsed && (
                <div className="ent-sidebar__section-label">{section.label}</div>
              )}
              {section.items.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `ent-sidebar__link ${isActive ? 'ent-sidebar__link--active' : ''}`
                  }
                  title={collapsed ? label : undefined}
                >
                  <span className="ent-sidebar__link-icon">
                    <Icon size={16} strokeWidth={1.5} />
                  </span>
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="ent-sidebar__footer">
            <span className="ent-sidebar__version">v2.4.0</span>
          </div>
        )}
      </aside>

      <div className="ent-main">
        <header className="ent-topbar">
          <div className="ent-topbar__left">
            {header.showBack && (
              <button
                type="button"
                className="ent-topbar__back"
                onClick={() => navigate(header.backTo || '/')}
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            <div className="ent-topbar__titles">
              <h1 className="ent-topbar__title">{title}</h1>
              {subtitle && <p className="ent-topbar__subtitle">{subtitle}</p>}
            </div>
            <div className="ent-topbar__search">
              <Search size={14} />
              <input type="text" placeholder="Global Search..." />
            </div>
          </div>
          <div className="ent-topbar__actions">
            <button type="button" className="ent-topbar__icon-btn" aria-label="Notifications">
              <Bell size={16} strokeWidth={1.5} />
              <span className="ent-topbar__badge">3</span>
            </button>
            <button type="button" className="ent-topbar__icon-btn" aria-label="Settings">
              <Settings size={16} strokeWidth={1.5} />
            </button>
            <div className="ent-topbar__divider" />
            <div className="ent-topbar__profile">
              <div className="ent-topbar__profile-text">
                <span className="ent-topbar__profile-name">Admin</span>
                <span className="ent-topbar__profile-role">Superuser</span>
              </div>
              <div className="ent-topbar__avatar">A</div>
            </div>
          </div>
        </header>

        <main className="ent-content enterprise-content">{children}</main>
      </div>
    </div>
  );
}
```

---

### `src/layout/AppShell.css`
*Sidebar / topbar / layout CSS*

```css
.ent-shell {
  display: flex;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background: var(--bg);
}

.ent-sidebar {
  width: var(--sidebar-width);
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 100;
  box-shadow: var(--shadow-md);
  transition: width var(--transition);
}

.ent-shell--collapsed .ent-sidebar {
  width: var(--sidebar-collapsed);
}

.ent-sidebar__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 12px 12px;
  gap: 8px;
}

.ent-sidebar__brand {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.ent-sidebar__logo {
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  background: var(--navy-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.ent-sidebar__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--sidebar-text-active);
  line-height: 1.2;
}

.ent-sidebar__tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
}

.ent-sidebar__collapse {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.06);
  color: var(--sidebar-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ent-sidebar__collapse:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.ent-sidebar__nav {
  flex: 1;
  padding: 0 8px;
  overflow-y: auto;
}

.ent-sidebar__section {
  margin-bottom: 20px;
}

.ent-sidebar__section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
  padding: 0 12px 6px;
}

.ent-sidebar__link {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 36px;
  padding: 0 12px;
  margin-bottom: 2px;
  color: var(--sidebar-text);
  font-size: var(--font-size-base);
  font-weight: 400;
  transition: background var(--transition), color var(--transition);
}

.ent-sidebar__link-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.85;
}

.ent-sidebar__link:hover {
  color: var(--sidebar-text-active);
  background: rgba(163, 201, 255, 0.12);
}

.ent-sidebar__link--active {
  color: #93baf1;
  background: var(--primary);
  border-left: 3px solid #72b1fd;
  padding-left: 9px;
  box-shadow: 0 0 8px rgba(114, 177, 253, 0.25);
}

.ent-sidebar__link--active .ent-sidebar__link-icon {
  opacity: 1;
  color: #72b1fd;
}

.ent-shell--collapsed .ent-sidebar__link {
  justify-content: center;
  padding: 0;
  border-left: none;
}

.ent-shell--collapsed .ent-sidebar__link--active {
  border-left: none;
  box-shadow: none;
}

.ent-sidebar__footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.ent-sidebar__version {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
}

.ent-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.ent-topbar {
  height: var(--topbar-height);
  flex-shrink: 0;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border-bottom: 1px solid var(--border-dark);
  z-index: 50;
}

.ent-topbar__left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  flex: 1;
}

.ent-topbar__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-tint);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.ent-topbar__back:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.ent-topbar__titles {
  min-width: 0;
  flex-shrink: 0;
}

.ent-topbar__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--primary);
  line-height: 1.2;
}

.ent-topbar__subtitle {
  margin: 2px 0 0;
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1;
}

.ent-topbar__search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 12px 0 32px;
  background: var(--bg-tint);
  border: 1px solid var(--border-dark);
  border-radius: 999px;
  color: var(--text-muted);
  position: relative;
  margin-left: 8px;
  min-width: 200px;
}

.ent-topbar__search svg {
  position: absolute;
  left: 10px;
}

.ent-topbar__search input {
  border: none;
  background: transparent;
  outline: none;
  color: var(--text);
  font-size: 12px;
  width: 100%;
}

.ent-topbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ent-topbar__icon-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ent-topbar__icon-btn:hover {
  background: var(--bg-tint);
  color: var(--primary);
}

.ent-topbar__badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ent-topbar__divider {
  width: 1px;
  height: 24px;
  background: var(--border-dark);
  margin: 0 4px;
}

.ent-topbar__profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-radius: var(--radius-lg);
  cursor: pointer;
}

.ent-topbar__profile:hover {
  background: var(--bg-tint);
}

.ent-topbar__profile-text {
  display: flex;
  flex-direction: column;
  text-align: right;
}

.ent-topbar__profile-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
  line-height: 1.1;
}

.ent-topbar__profile-role {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.1;
}

.ent-topbar__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(30, 74, 122, 0.2);
}

.ent-content {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Workspace pages fill the content pane; scroll stays in ent-content if filters overflow */
.ent-content:has(.workspace-page--fill) {
  overflow: hidden;
}

/* Dashboard fills viewport; internal panels scroll */
.ent-content:has(.ent-dashboard--fill) {
  overflow: hidden;
}

@media (max-width: 1024px) {
  .ent-content:has(.ent-dashboard--fill) {
    overflow: auto;
  }
}

@media (max-width: 1100px) {
  .ent-topbar__search {
    display: none;
  }
}

@media (max-width: 768px) {
  .ent-topbar__profile-text {
    display: none;
  }
}
```

---


## Part 7 — UI Primitive Components

### `src/components/ui/ActionBar.jsx`
*Sticky bottom action bar (Add/Cancel + custom buttons)*

```jsx
// ActionBar — Common sticky bottom action bar for all entry pages.
//
// Built-in pair (shown by default, controlled by showAddCancel prop):
//   • Read mode  → "Add" button     (calls onAdd, enters edit mode)
//   • Edit mode  → "Cancel" button  (calls onCancel, resets + exits edit mode)
//
// Page-specific buttons are passed via the `extraButtons` prop as an array:
//   { key, label, Icon, variant, onClick, disabled, loading, showAlways }
//   Add a separator object { key, separator: true } to insert a divider.
//   By default extra buttons are only rendered in edit mode.
//   Set showAlways: true to show a button regardless of edit mode.
//
// Usage — page that only needs custom buttons (no Add/Cancel):
//   <ActionBar showAddCancel={false} extraButtons={[...]} />

import React from 'react';
import { FilePlus, XCircle } from 'lucide-react';
import './ActionBar.css';

export default function ActionBar({
  // ── Add / Cancel pair ──────────────────────────────────────────────
  showAddCancel = true,
  isEditMode    = false,
  onAdd,
  onCancel,
  addLabel    = 'Add',
  cancelLabel = 'Cancel',

  // ── Extra buttons ──────────────────────────────────────────────────
  // Array of button descriptor objects (see file header for shape).
  extraButtons = [],

  // ── Layout ────────────────────────────────────────────────────────
  // sticky=true → position: sticky; bottom: 0 inside the scroll container.
  sticky = true,
}) {
  const visibleExtras = extraButtons.filter(
    (btn) => btn.showAlways || isEditMode,
  );

  const hasExtras = visibleExtras.some((b) => !b.separator);

  return (
    <footer className={`action-bar${sticky ? ' action-bar--sticky' : ''}`}>
      {/* Page-specific extra buttons */}
      {visibleExtras.map((btn) => {
        if (btn.separator) {
          return <div key={btn.key} className="action-bar__sep" />;
        }
        const Icon = btn.Icon;
        return (
          <button
            key={btn.key}
            type="button"
            className={`action-btn action-btn--${btn.variant || 'secondary'}`}
            onClick={btn.onClick}
            disabled={btn.disabled || false}
            title={btn.label}
          >
            {btn.loading ? (
              <>
                <div className="action-spinner" />
                <span>{btn.label}</span>
              </>
            ) : (
              <>
                {Icon && <Icon size={13} strokeWidth={2} />}
                <span>{btn.label}</span>
              </>
            )}
          </button>
        );
      })}

      {/* Auto-separator between extras and the built-in Add/Cancel */}
      {showAddCancel && hasExtras && (
        <div className="action-bar__sep" />
      )}

      {/* Built-in Add / Cancel */}
      {showAddCancel && (
        isEditMode ? (
          <button
            type="button"
            className="action-btn action-btn--cancel"
            onClick={onCancel}
            title={cancelLabel}
          >
            <XCircle size={13} strokeWidth={2} />
            <span>{cancelLabel}</span>
          </button>
        ) : (
          <button
            type="button"
            className="action-btn action-btn--add"
            onClick={onAdd}
            title={addLabel}
          >
            <FilePlus size={13} strokeWidth={2} />
            <span>{addLabel}</span>
          </button>
        )
      )}
    </footer>
  );
}
```

---

### `src/components/ui/ActionBar.css`
*ActionBar styles*

```css
/* ActionBar.css — Common bottom action bar */

.action-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  box-shadow: 0 -2px 8px rgba(30, 74, 122, 0.07);
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* Sticky variant — sits at the bottom of the scroll container */
.action-bar--sticky {
  position: sticky;
  bottom: 0;
  z-index: 10;
  border-radius: 0;
}

/* ── Separator ── */
.action-bar__sep {
  width: 1px;
  height: 22px;
  background: var(--border-dark, var(--border));
  margin: 0 3px;
  flex-shrink: 0;
}

/* ── Shared button base ── */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 14px;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: var(--radius);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
  border: 1px solid transparent;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* Secondary — neutral */
.action-btn--secondary {
  color: var(--text-secondary);
  background: var(--bg-tint, var(--surface));
  border-color: var(--border);
}
.action-btn--secondary:hover:not(:disabled) {
  background: var(--bg, #f5f5f5);
  border-color: var(--border-dark, #bbb);
  color: var(--text);
}

/* Save & Print — primary blue tint */
.action-btn--print {
  color: var(--primary);
  background: var(--primary-lighter);
  border-color: var(--primary-light);
}
.action-btn--print:hover:not(:disabled) {
  background: var(--primary-light);
  transform: translateY(-1px);
}

/* Save — green */
.action-btn--save {
  color: #ffffff;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  border-color: rgba(34, 197, 94, 0.35);
  box-shadow: 0 2px 6px rgba(34, 197, 94, 0.25);
}
.action-btn--save:hover:not(:disabled) {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);
  transform: translateY(-1px);
}
.action-btn--save:active:not(:disabled) { transform: translateY(0); }

/* Add — primary blue (built-in) */
.action-btn--add {
  color: #ffffff;
  background: var(--primary);
  border-color: var(--primary);
}
.action-btn--add:hover:not(:disabled) {
  background: var(--primary-dark, #1558a0);
  border-color: var(--primary-dark, #1558a0);
  transform: translateY(-1px);
}

/* Cancel — amber (built-in) */
.action-btn--cancel {
  color: var(--warning, #e37400);
  background: var(--orange-light, #fff7ed);
  border-color: rgba(227, 116, 0, 0.25);
}
.action-btn--cancel:hover:not(:disabled) {
  background: #fde8c7;
  transform: translateY(-1px);
}

/* Close — red */
.action-btn--close {
  color: var(--danger);
  background: #fef2f2;
  border-color: rgba(217, 48, 37, 0.25);
}
.action-btn--close:hover:not(:disabled) {
  background: #fde8e8;
  transform: translateY(-1px);
}

/* ── Spinner (used when loading=true on a button) ── */
.action-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: action-spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes action-spin { to { transform: rotate(360deg); } }
```

---

### `src/components/ui/SearchSelect.jsx`
*Styled searchable <select> replacement*

```jsx
// SearchSelect.jsx — Reusable searchable dropdown component
// ─────────────────────────────────────────────────────────
// Replaces native <select> with a custom dropdown that has
// a search/filter input at the top.

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import './search-select.css';

/**
 * SearchSelect — A searchable select dropdown.
 *
 * Props:
 *   value        — currently selected value (string)
 *   onChange      — (newValue) => void
 *   options       — [{ value, label }]
 *   placeholder   — text when nothing is selected
 *   searchPlaceholder — text inside the search input
 *   className     — additional CSS class on the wrapper
 *   id            — HTML id for accessibility
 *   ariaLabel     — aria-label for the trigger button
 *   disabled      — disables the control
 *   compact       — if true, uses compact sizing (for grid cells)
 */
export default function SearchSelect({
  value = '',
  onChange,
  options = [],
  placeholder = '-- Select --',
  searchPlaceholder = 'Search...',
  className = '',
  id,
  ariaLabel,
  disabled = false,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsListRef = useRef(null);

  // Find the label for the currently selected value
  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : '';

  // Filter options by search text
  const filteredOptions = search
    ? options.filter((o) =>
      o.label.toLowerCase().includes(search.toLowerCase())
    )
    : options;

  // ── Reset focusedIndex when search changes or dropdown opens ────────────
  useEffect(() => {
    // Pre-highlight the already-selected item, or default to -1
    const idx = filteredOptions.findIndex(
      (o) => String(o.value) === String(value)
    );
    setFocusedIndex(idx);
  }, [search, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll focused option into view ────────────────────────────────────
  useEffect(() => {
    if (focusedIndex < 0 || !optionsListRef.current) return;
    const item = optionsListRef.current.children[focusedIndex];
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  // ── Compute dropdown position from the trigger element ──────────────────
  const computeDropdownStyle = useCallback(() => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const minWidth = Math.max(rect.width, 200);
    const maxDropHeight = 280;
    const gap = 4;
    const margin = 8;

    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const dropUp = spaceBelow < maxDropHeight && spaceAbove > spaceBelow;
    const available = dropUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(maxDropHeight, Math.max(120, available - margin));

    let left = rect.left;
    const maxLeft = window.innerWidth - minWidth - margin;
    if (left > maxLeft) left = Math.max(margin, maxLeft);
    if (left < margin) left = margin;

    return {
      position: 'fixed',
      left: `${left}px`,
      width: `${minWidth}px`,
      maxHeight: `${maxHeight}px`,
      ...(dropUp
        ? { bottom: `${window.innerHeight - rect.top + gap}px`, top: 'auto' }
        : { top: `${rect.bottom + gap}px`, bottom: 'auto' }),
      zIndex: 2147483647,
    };
  }, []);

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      const inWrapper =
        wrapperRef.current && wrapperRef.current.contains(e.target);
      const inDropdown =
        dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inWrapper && !inDropdown) {
        setIsOpen(false);
        setSearch('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside, true);
    return () =>
      document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen]);

  // ── Auto-focus search input when opened ─────────────────────────────────
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const id = requestAnimationFrame(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen]);

  // ── Reposition on scroll/resize while open (portal mode) ─────────────────
  useLayoutEffect(() => {
    if (!isOpen) return;
    setDropdownStyle(computeDropdownStyle());
  }, [isOpen, computeDropdownStyle]);

  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = () => {
      setDropdownStyle(computeDropdownStyle());
    };

    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, computeDropdownStyle]);

  // ── Toggle open/closed ───────────────────────────────────────────────────
  const handleToggle = useCallback(
    (e) => {
      e.stopPropagation();

      if (disabled) return;

      if (!isOpen) {
        setDropdownStyle(computeDropdownStyle());
        setIsOpen(true);
      } else {
        setIsOpen(false);
        setSearch('');
      }
    },
    [disabled, isOpen, computeDropdownStyle]
  );

  const handleSelect = useCallback(
    (optValue) => {
      onChange(optValue);
      setIsOpen(false);
      setSearch('');
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e) => {
      e.stopPropagation();
      onChange('');
      setIsOpen(false);
      setSearch('');
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [onChange]
  );

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
            handleSelect(filteredOptions[focusedIndex].value);
          } else if (filteredOptions.length === 1) {
            // Fallback: if nothing is focused but only one result exists, select it
            handleSelect(filteredOptions[0].value);
          }
          break;
        }
        case 'Escape': {
          setIsOpen(false);
          setSearch('');
          requestAnimationFrame(() => triggerRef.current?.focus());
          break;
        }
        default:
          break;
      }
    },
    [isOpen, focusedIndex, filteredOptions, handleSelect]
  );

  const wrapperClass = [
    'search-select',
    compact ? 'search-select--compact' : '',
    isOpen ? 'search-select--open' : '',
    disabled ? 'search-select--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // ── Dropdown element (shared between portal and inline) ──────────────────
  const dropdownEl = isOpen ? (
    <div
      ref={dropdownRef}
      className="search-select__dropdown search-select__dropdown--portal"
      role="listbox"
      style={dropdownStyle ?? undefined}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Search input */}
      <div className="search-select__search-wrap">
        <Search size={14} className="search-select__search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          className="search-select__search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Options list */}
      <div className="search-select__options" ref={optionsListRef}>
        {filteredOptions.map((opt, idx) => {
          const isSelected = String(opt.value) === String(value);
          const isFocused = idx === focusedIndex;
          return (
            <div
              key={opt.value}
              className={[
                'search-select__option',
                isSelected ? 'search-select__option--selected' : '',
                isFocused ? 'search-select__option--focused' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSelect(opt.value)}
              onMouseEnter={() => setFocusedIndex(idx)}
              role="option"
              aria-selected={isSelected}
              title={opt.label}
            >
              {opt.label}
              {isSelected && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="search-select__check"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          );
        })}
        {filteredOptions.length === 0 && (
          <div className="search-select__empty">No results found</div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={wrapperClass} ref={wrapperRef} id={id}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        className="search-select__trigger"
        onClick={handleToggle}
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        title={displayLabel || placeholder}
      >
        <span
          className={`search-select__value ${!displayLabel ? 'search-select__placeholder' : ''
            }`}
        >
          {displayLabel || placeholder}
        </span>
        <span className="search-select__icons">
          {value && !disabled && (
            <span
              className="search-select__clear"
              onClick={handleClear}
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
            >
              ×
            </span>
          )}
          <ChevronDown size={12} className="search-select__chevron" />
        </span>
      </button>

      {/* Dropdown portaled to body — escapes overflow:hidden / sticky ancestors */}
      {dropdownEl && createPortal(dropdownEl, document.body)}
    </div>
  );
}
```

---

### `src/components/ui/search-select.css`
*SearchSelect styles*

```css
/* SearchSelect.css — tokens from App.css :root */

.search-select {
  position: relative;
  width: 100%;
}

/* ── Trigger ── */
.search-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 34px;
  padding: 0 10px 0 12px;
  font-size: 0.85rem;
  font-family: inherit;
  color: var(--text);
  background: linear-gradient(180deg, var(--surface) 0%, #f8fafc 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  outline: none;
  transition: all var(--transition);
  text-align: left;
  gap: 6px;
  box-shadow: var(--shadow-sm);
}

.search-select__trigger:hover {
  border-color: #93c5fd;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
  transform: translateY(-1px);
}

.search-select--open .search-select__trigger,
.search-select__trigger:focus-visible {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37,99,168,0.12), 0 2px 6px rgba(0,0,0,0.06);
  background: var(--surface);
}

.search-select--disabled .search-select__trigger {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg);
  transform: none;
}

.search-select__value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 32px;
  font-weight: 500;
}

.search-select__placeholder {
  color: var(--text-muted);
  font-weight: 400;
}

.search-select__icons {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.search-select__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 14px;
  line-height: 1;
  color: var(--text-muted);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
}

.search-select__clear:hover {
  color: #ef4444;
  background: #fef2f2;
  transform: scale(1.1);
}

.search-select__chevron {
  color: var(--text-muted);
  transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
  flex-shrink: 0;
}

.search-select--open .search-select__chevron { transform: rotate(180deg); }

/* ── Dropdown ── */
.search-select__dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 100%;
  min-width: 200px;
  max-height: 280px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  animation: ssDropIn 0.2s cubic-bezier(0.4,0,0.2,1);
}

/* Portaled dropdown — fixed position set via inline styles from JS */
.search-select__dropdown--portal {
  position: fixed;
  top: auto;
  left: auto;
  width: auto;
  min-width: 200px;
  z-index: 2147483647;
}

@keyframes ssDropIn {
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}

/* ── Search input ── */
.search-select__search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
}

.search-select__search-icon { color: var(--text-muted); flex-shrink: 0; }

.search-select__search {
  width: 100%;
  border: none;
  outline: none;
  font-size: 0.85rem;
  font-family: inherit;
  color: var(--text);
  background: transparent;
  line-height: 1.5;
}

.search-select__search::placeholder { color: var(--border-dark); }

/* ── Options ── */
.search-select__options {
  overflow-y: auto;
  flex: 1;
  padding: 4px 0;
}

.search-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  font-size: 0.85rem;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
  gap: 10px;
  font-weight: 500;
}

.search-select__option:hover {
  background: var(--bg);
  color: var(--text);
  padding-left: 18px;
}

.search-select__option--selected {
  background: var(--primary-light);
  color: var(--navy);
  font-weight: 700;
}

.search-select__option--selected:hover { background: #bfdbfe; }

/* ── Keyboard-focused option (ArrowUp / ArrowDown) ── */
.search-select__option--focused {
  background: var(--bg);
  color: var(--text);
  padding-left: 18px;
  outline: 2px solid var(--primary);
  outline-offset: -2px;
  border-radius: 4px;
}

.search-select__option--selected.search-select__option--focused {
  background: #bfdbfe;
  outline-color: var(--navy);
}

.search-select__check { color: var(--primary); flex-shrink: 0; }

.search-select__empty {
  padding: 20px 14px;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}

/* ── Compact mode ── */
.search-select--compact .search-select__trigger {
  height: 30px;
  font-size: 0.78rem;
  padding: 0 8px 0 10px;
  border-radius: var(--radius-sm);
}

.search-select--compact .search-select__value { line-height: 28px; }

.search-select--compact .search-select__dropdown--portal {
  max-height: 240px;
  min-width: 180px;
  border-radius: var(--radius);
}

.search-select--compact .search-select__option { padding: 6px 12px; font-size: 0.78rem; }
.search-select--compact .search-select__search { font-size: 0.78rem; }

/* ── Scrollbar ── */
.search-select__options::-webkit-scrollbar { width: 6px; }
.search-select__options::-webkit-scrollbar-track { background: transparent; }
.search-select__options::-webkit-scrollbar-thumb { background: var(--border-dark); border-radius: 3px; }
.search-select__options::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
```

---

### `src/components/ui/Loader.jsx`
*Loading spinner*

```jsx
import React from 'react';
import { Loader as LucideLoader } from 'lucide-react';
import './loader.css';

export default function Loader({ text = 'Loading...' }) {
    return (
        <div className="loader-wrap">
            <LucideLoader size={20} className="loader-spin" />
            {text && <span className="loader-text">{text}</span>}
        </div>
    );
}
```

---

### `src/components/ui/loader.css`
*Loader styles*

```css
/* Loader.css */

.loader-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.loader-spin {
  flex-shrink: 0;
  color: var(--primary);
  animation: loader-spin 0.7s linear infinite;
}

.loader-text {
  white-space: nowrap;
}

@keyframes loader-spin {
  to { transform: rotate(360deg); }
}
```

---

### `src/components/ui/Modal.jsx`
*Generic overlay modal*

```jsx
// Modal.jsx — Generic reusable modal wrapper
// ─────────────────────────────────────────────────────────────────────
// Wraps ANY children in a full-screen overlay + dialog. Works like a
// higher-order component — pass any component as children:
//
//   <Modal isOpen={open} onClose={close} title="Pick Items" size="xl">
//     <TxnEntryGridForm config={config} readOnly initialRows={data} />
//   </Modal>
//
//   <Modal isOpen={open} onClose={close} headerless size="md">
//     <TxnEntryFilterPanel filters={filters} onAddNew={add} />
//   </Modal>
//
// Props:
//   isOpen    — boolean — controls visibility
//   onClose   — () => void — called on Escape key or overlay/close-btn click
//   title     — string — header title text
//   subtitle  — string (optional) — sub-header text
//   icon      — ReactNode (optional) — icon shown in header
//   size      — 'sm' | 'md' | 'lg' | 'xl' | 'full' (default: 'lg')
//   headerless — boolean (default: false) — hides the built-in header
//   footer    — ReactNode (optional) — custom footer content
//   children  — body content (any React component)

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import './modal.css';

export default function Modal({
  isOpen = false,
  onClose,
  title = '',
  subtitle = '',
  icon = null,
  size = 'lg',
  headerless = false,
  variant = 'default',
  footer = null,
  children,
}) {
  // Close on Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Modal dialog'}
    >
      <div className={`modal-dialog modal-dialog--${size} ${headerless ? 'modal-dialog--headerless' : ''} ${variant === 'enterprise' ? 'modal-dialog--enterprise' : ''}`}>

        {/* Header — hidden when headerless */}
        {!headerless && (
          <div className="modal-header">
            <div className="modal-header-left">
              {icon && (
                <span className={`modal-header-icon${variant === 'enterprise' ? ' modal-header-icon--enterprise' : ''}`}>
                  {icon}
                </span>
              )}
              <div>
                <div className="modal-title">{title}</div>
                {subtitle && <div className="modal-subtitle">{subtitle}</div>}
              </div>
            </div>
            <button
              className="modal-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Floating close button when headerless */}
        {headerless && (
          <button
            className="modal-close modal-close--floating"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        )}

        {/* Body */}
        <div className="modal-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### `src/components/ui/modal.css`
*Modal styles*

```css
/* Modal.css — Generic reusable modal overlay + dialog */

/* ── Overlay ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: modal-fade-in 180ms ease-out both;
}

@keyframes modal-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Dialog ── */
.modal-dialog {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(30, 61, 122, 0.08);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  width: 100%;
  animation: modal-slide-up 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  overflow: hidden;
}

@keyframes modal-slide-up {
  from { opacity: 0; transform: translateY(18px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Size variants */
.modal-dialog--sm  { max-width: 480px; }
.modal-dialog--md  { max-width: 700px; }
.modal-dialog--lg  { max-width: 960px; }
.modal-dialog--xl  { max-width: 1200px; }
.modal-dialog--full { max-width: calc(100vw - 32px); }

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  background: var(--header-gradient-deep);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  flex-shrink: 0;
  gap: 12px;
}

.modal-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.modal-title {
  font-size: 1rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-subtitle {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.65);
  font-weight: 400;
  margin-top: 1px;
}

/* ── Close button ── */
.modal-close {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition);
  flex-shrink: 0;
}
.modal-close:hover {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
}

/* ── Body ── */
.modal-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  /* custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: var(--border-dark) transparent;
}
.modal-body::-webkit-scrollbar { width: 6px; }
.modal-body::-webkit-scrollbar-thumb {
  background: var(--border-dark);
  border-radius: 99px;
}

/* ── Footer ── */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
}

/* ══════════════════════════════════════════════════════════════════════
   Headerless variant — used when the Modal wraps a component that
   already has its own header (e.g. TxnEntryFilterPanel, TxnEntryGridForm).
   ══════════════════════════════════════════════════════════════════════ */
.modal-dialog--headerless {
  position: relative; /* anchor for floating close button */
}

.modal-dialog--headerless .modal-body {
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

/* Floating close button (top-right pill) */
.modal-close--floating {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 50;
  width: 28px;
  height: 28px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  backdrop-filter: blur(6px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.modal-close--floating:hover {
  background: rgba(15, 23, 42, 0.85);
  color: #fff;
  transform: scale(1.08);
}

/* ── Enterprise variant (flat header, matches filter panel / app shell) ── */
.modal-dialog--enterprise {
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
}

.modal-dialog--enterprise .modal-header {
  background: var(--primary-lighter);
  border-bottom: 1px solid var(--border);
  padding: 10px 14px 10px 16px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  position: relative;
}

.modal-dialog--enterprise .modal-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--primary);
  border-radius: var(--radius-lg) 0 0 0;
}

.modal-dialog--enterprise .modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--primary);
  letter-spacing: -0.01em;
}

.modal-dialog--enterprise .modal-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}

.modal-dialog--enterprise .modal-header-icon--enterprise {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-dialog--enterprise .modal-header-icon--enterprise svg {
  color: #fff;
}

.modal-dialog--enterprise .modal-close {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.modal-dialog--enterprise .modal-close:hover {
  background: var(--surface);
  border-color: var(--primary);
  color: var(--primary);
}

.modal-dialog--enterprise .modal-body {
  background: var(--bg);
  padding: 0;
}

.modal-dialog--enterprise .modal-footer {
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 10px 16px;
}
```

---


## Part 8 — Filter Panel

### `src/components/filters/EnterpriseFilterPanel.jsx`
*3-column tabular filter panel for entry form headers*

```jsx
// EnterpriseFilterPanel — tabular 3-column filter layout
// Dynamic filter controls: GetFilters + GetFilterDetail via the local API layer.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApi } from '../../api/useApi';
import { ENDPOINTS, DEFAULT_LOGIN_ID, CBO_MODE } from '../../api/constants';
import { controlTypeMap } from '../../data/dummyData';
import SearchSelect from '../ui/SearchSelect';
import { AlertCircle, Search, Database, RotateCcw, X, Plus, ShoppingCart, FileSpreadsheet } from 'lucide-react';
import './enterprise-filter-query.css';

const COLS = 3;

function getAccentClass(filter) {
  const t = filter.FilterColCtrlType;
  if (t === controlTypeMap.DROPDOWN || t === controlTypeMap.LABEL) {
    return 'efq-cell--fixed';
  }
  return 'efq-cell--editable';
}

/** Build table rows: 3 filters per row; textarea spans full width. */
function buildFilterRows(filters) {
  const rows = [];
  let i = 0;

  while (i < filters.length) {
    const filter = filters[i];

    if (filter.FilterColCtrlType === controlTypeMap.TEXTAREA) {
      rows.push({ type: 'full', items: [filter] });
      i += 1;
      continue;
    }

    const items = [];
    while (items.length < COLS && i < filters.length) {
      if (filters[i].FilterColCtrlType === controlTypeMap.TEXTAREA) break;
      items.push(filters[i]);
      i += 1;
    }
    rows.push({ type: 'row', items });
  }

  return rows;
}

function FilterControl({ filter, value, options, onChange, disabled = false }) {
  const { FilterColCtrlType, FilterCaption, FilterColName } = filter;
  const accent = getAccentClass(filter);

  const handleChange = (e) => onChange(FilterColName, e.target.value);

  const labelEl = (
    <label className="efq-cell__label" htmlFor={`efq-${FilterColName}`} title={FilterCaption}>
      {FilterCaption}
    </label>
  );

  const renderInput = () => {
    switch (FilterColCtrlType) {
      case controlTypeMap.LABEL:
        return <span className="efq-cell__value">{value || '—'}</span>;

      case controlTypeMap.TEXTBOX:
        return (
          <input
            id={`efq-${FilterColName}`}
            type="text"
            className="efq-cell__input"
            value={value || ''}
            onChange={handleChange}
            placeholder={`Enter ${FilterCaption}…`}
            autoComplete="off"
            disabled={disabled}
          />
        );

      case controlTypeMap.DATE:
        return (
          <input
            id={`efq-${FilterColName}`}
            type="date"
            className="efq-cell__input efq-cell__input--date"
            value={value || ''}
            onChange={handleChange}
            disabled={disabled}
          />
        );

      case controlTypeMap.DROPDOWN:
        return (
          <SearchSelect
            id={`efq-${FilterColName}`}
            className="efq-cell__select"
            value={value || ''}
            onChange={(val) => onChange(FilterColName, val)}
            options={(options || []).map((opt) => {
              if (opt.value !== undefined) {
                return { value: String(opt.value), label: opt.label };
              }
              const valKey = opt.FilterCtrlValueCol || 'IDNumber';
              const labelKey = opt.FilterCtrlDisplayCol || 'Name';
              return { value: String(opt[valKey]), label: opt[labelKey] };
            })}
            placeholder={`Select…`}
            ariaLabel={FilterCaption}
            disabled={disabled}
          />
        );

      case controlTypeMap.TEXTAREA:
        return (
          <textarea
            id={`efq-${FilterColName}`}
            className="efq-cell__input efq-cell__input--textarea"
            value={value || ''}
            onChange={handleChange}
            placeholder={`Enter ${FilterCaption}…`}
            rows={2}
            disabled={disabled}
          />
        );

      default:
        return <span className="efq-cell__value">{value || '—'}</span>;
    }
  };

  const isTextarea = FilterColCtrlType === controlTypeMap.TEXTAREA;

  return (
    <td
      className={`efq-table__cell ${accent}${isTextarea ? ' efq-table__cell--full' : ''}`}
      colSpan={isTextarea ? COLS : 1}
    >
      <div className={`efq-cell${isTextarea ? ' efq-cell--stacked' : ''}`}>
        {FilterColCtrlType === controlTypeMap.LABEL ? (
          <span className="efq-cell__label">{FilterCaption}</span>
        ) : (
          labelEl
        )}
        <div className="efq-cell__control">{renderInput()}</div>
      </div>
    </td>
  );
}

function FilterTable({ filters, values, dropdownOptions, onChange, disabled = false }) {
  const rows = useMemo(() => buildFilterRows(filters), [filters]);

  return (
    <table className="efq-table">
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={`row-${rowIdx}`} className="efq-table__row">
            {row.type === 'full' ? (
              <FilterControl
                filter={row.items[0]}
                value={values[row.items[0].FilterColName]}
                options={
                  row.items[0].FilterColCtrlType === controlTypeMap.DROPDOWN
                    ? dropdownOptions[row.items[0].FilterParameterID]
                    : undefined
                }
                onChange={onChange}
                disabled={disabled}
              />
            ) : (
              <>
                {row.items.map((filter) => (
                  <FilterControl
                    key={filter.FilterParameterID}
                    filter={filter}
                    value={values[filter.FilterColName]}
                    options={
                      filter.FilterColCtrlType === controlTypeMap.DROPDOWN
                        ? dropdownOptions[filter.FilterParameterID]
                        : undefined
                    }
                    onChange={onChange}
                    disabled={disabled}
                  />
                ))}
                {row.items.length < COLS
                  && Array.from({ length: COLS - row.items.length }).map((_, i) => (
                    <td key={`pad-${rowIdx}-${i}`} className="efq-table__cell efq-table__cell--empty" aria-hidden="true" />
                  ))}
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function EnterpriseFilterPanel({
  title = '',
  masterID,
  loginID = DEFAULT_LOGIN_ID,
  funcCode = '',
  divisionID = 0,
  onSearch,
  isSearching = false,
  onFiltersLoaded,
  staticFilters = null,
  actionLabel = 'Search',
  ActionIcon = null,
  onFilterChange = null,
  onOrderItem = null,
  orderItemLabel = 'Order Item',
  OrderItemIcon = null,
  initialValues = null,
  cascadeResets = null,
  disabled = false,
  apiBaseUrl,
}) {
  const { get } = useApi(apiBaseUrl);

  const [filters, setFilters] = useState(staticFilters || []);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [values, setValues] = useState({});
  const [defaults, setDefaults] = useState({});
  const [isLoading, setIsLoading] = useState(staticFilters === null);
  const [errorMsg, setErrorMsg] = useState(null);
  const initialValuesAppliedRef = useRef(false);

  const isEntryMode = staticFilters !== null;
  const ButtonIcon = ActionIcon || (isEntryMode ? Plus : Search);
  const SecondaryIcon = OrderItemIcon || ShoppingCart;
  const runLabel = actionLabel === 'Search' && !isEntryMode ? 'Run Search' : actionLabel;
  const headerLabel = isEntryMode && title ? title : 'Query Builder';
  const headerSubtitle = isEntryMode
    ? `${filters.length} header field${filters.length !== 1 ? 's' : ''}`
    : title;
  const HeaderIcon = isEntryMode ? FileSpreadsheet : Database;

  useEffect(() => {
    if (staticFilters === null) return;
    setFilters(staticFilters);
    onFiltersLoaded?.(staticFilters.length > 0);
    const optMap = {};
    staticFilters.forEach((f) => {
      if (f.FilterColCtrlType === controlTypeMap.DROPDOWN && f.staticOptions) {
        optMap[f.FilterParameterID] = f.staticOptions;
      }
    });
    setDropdownOptions(optMap);
    if (initialValues && !initialValuesAppliedRef.current) {
      setValues(initialValues);
      setDefaults(initialValues);
      initialValuesAppliedRef.current = true;
    }
  }, [staticFilters, onFiltersLoaded, initialValues]);

  const fetchFilters = useCallback(async (signal) => {
    if (staticFilters !== null) return;
    if (!masterID) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await get(ENDPOINTS.GET_FILTERS, { prmMasterID: masterID });
      if (signal?.aborted) return;

      const filterList = data?.Links || [];
      setFilters(filterList);
      onFiltersLoaded?.(filterList.length > 0);

      const seed = {};
      filterList.forEach((f) => {
        if (f.FilterCtrlDefaultValue != null && f.FilterCtrlDefaultValue !== '') {
          seed[f.FilterColName] = String(f.FilterCtrlDefaultValue);
        } else if (
          f.FilterCtrlDefaultValue === null
          || (f.FilterCtrlDefaultValue === '' && f.FilterColCtrlType === 4)
        ) {
          seed[f.FilterColName] = 0;
        }
      });
      setValues(seed);
      setDefaults(seed);

      const dropdownFilters = filterList.filter(
        (f) => f.FilterColCtrlType === controlTypeMap.DROPDOWN,
      );

      const optionsMap = {};
      await Promise.all(
        dropdownFilters.map(async (f) => {
          try {
            const detailData = await get(ENDPOINTS.GET_FILTER_DETAIL, {
              prmMasterID: masterID,
              prmFilterParameterName: f.FilterParameterID,
              prmCboMode: CBO_MODE.FILTER,
              prmFuncCode: funcCode,
              prmDivisionID: divisionID,
              prmLoginID: loginID,
            });
            optionsMap[f.FilterParameterID] = detailData?.Links || [];
          } catch {
            optionsMap[f.FilterParameterID] = [];
          }
        }),
      );

      if (signal?.aborted) return;
      setDropdownOptions(optionsMap);
    } catch (err) {
      if (signal?.aborted) return;
      setErrorMsg(err?.message || 'Failed to load filter configuration. Please try again.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [get, masterID, funcCode, divisionID, loginID, staticFilters, onFiltersLoaded]);

  useEffect(() => {
    const controller = new AbortController();
    fetchFilters(controller.signal);
    return () => controller.abort();
  }, [fetchFilters]);

  const handleChange = useCallback((colName, value) => {
    setValues((prev) => {
      const next = { ...prev, [colName]: value };
      const resetFields = cascadeResets?.[colName];
      if (resetFields) {
        resetFields.forEach((field) => {
          next[field] = '';
        });
      }
      return next;
    });
    onFilterChange?.(colName, value);
    cascadeResets?.[colName]?.forEach((field) => onFilterChange?.(field, ''));
  }, [onFilterChange, cascadeResets]);

  const handleActionClick = useCallback(() => {
    if (onSearch) onSearch(values, filters);
  }, [onSearch, values, filters]);

  const handleReset = useCallback(() => {
    setValues({ ...defaults });
  }, [defaults]);

  const handleClearAll = useCallback(() => {
    const cleared = {};
    filters.forEach((f) => {
      cleared[f.FilterColName] = '';
    });
    setValues(cleared);
  }, [filters]);

  const activeCriteriaCount = useMemo(
    () => Object.values(values).filter((v) => v != null && v !== '' && String(v) !== '0').length,
    [values],
  );

  const appliedChips = useMemo(() => filters
    .filter((f) => {
      const v = values[f.FilterColName];
      return v != null && v !== '' && String(v) !== '0';
    })
    .map((f) => {
      let display = String(values[f.FilterColName]);
      if (f.FilterColCtrlType === controlTypeMap.DROPDOWN) {
        const opts = dropdownOptions[f.FilterParameterID] || f.staticOptions || [];
        const match = opts.find((o) => {
          const val = o.value ?? o[o.FilterCtrlValueCol || 'IDNumber'];
          return String(val) === String(values[f.FilterColName]);
        });
        if (match) {
          display = match.label || match.Name || match[match.FilterCtrlDisplayCol || 'Name'] || display;
        }
      }
      return { colName: f.FilterColName, caption: f.FilterCaption, display };
    }), [filters, values, dropdownOptions]);

  const handleOrderItemClick = useCallback(() => {
    if (onOrderItem) onOrderItem(values);
  }, [onOrderItem, values]);

  const ActionButton = (
    <button
      type="button"
      className={`efq-btn-run${isEntryMode ? ' efq-btn-run--action' : ''}`}
      onClick={handleActionClick}
      disabled={isSearching}
      title={runLabel}
      aria-label={runLabel}
    >
      {isSearching ? (
        <>
          <span className="efq-btn-run__spinner" aria-hidden="true" />
          <span>{runLabel}…</span>
        </>
      ) : (
        <>
          <ButtonIcon size={15} strokeWidth={2.5} />
          <span>{runLabel}</span>
        </>
      )}
    </button>
  );

  return (
    <div className="efq-panel">
      <header className="efq-command">
        <div className="efq-command__brand">
          <span className="efq-command__icon" aria-hidden="true">
            <HeaderIcon size={16} strokeWidth={2} />
          </span>
          <div className="efq-command__titles">
            <h2 className="efq-command__label">{headerLabel}</h2>
            {headerSubtitle && (
              <span className="efq-command__subtitle">{headerSubtitle}</span>
            )}
          </div>
        </div>

        {!isLoading && !errorMsg && (onSearch || onOrderItem) && (
          <div className="efq-command__actions">
            {!isEntryMode && filters.length > 0 && (
              <span className="efq-badge">
                <span className="efq-badge__dot" aria-hidden="true" />
                {activeCriteriaCount} criteria
              </span>
            )}
            {!isEntryMode && filters.length > 0 && (
              <button
                type="button"
                className="efq-btn-ghost"
                onClick={handleReset}
                disabled={isSearching}
                title="Reset to defaults"
              >
                <RotateCcw size={14} strokeWidth={2} />
                Reset
              </button>
            )}
            {onOrderItem && (
              <button
                type="button"
                className="efq-btn-ghost efq-btn-order"
                onClick={handleOrderItemClick}
                disabled={isSearching}
                title={orderItemLabel}
                aria-label={orderItemLabel}
              >
                <SecondaryIcon size={14} strokeWidth={2.5} />
                {orderItemLabel}
              </button>
            )}
            {onSearch && ActionButton}
          </div>
        )}
      </header>

      {isLoading && (
        <div className="efq-loading" role="status" aria-label="Loading filters">
          <table className="efq-table">
            <tbody>
              <tr className="efq-table__row">
                {[1, 2, 3].map((n) => (
                  <td key={n} className="efq-table__cell">
                    <div className="efq-skeleton-cell">
                      <div className="efq-skeleton efq-skeleton--label" />
                      <div className="efq-skeleton" />
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="efq-table__row">
                {[1, 2, 3].map((n) => (
                  <td key={n} className="efq-table__cell">
                    <div className="efq-skeleton-cell">
                      <div className="efq-skeleton efq-skeleton--label" />
                      <div className="efq-skeleton" />
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && errorMsg && (
        <div className="efq-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} />
          <span>{errorMsg}</span>
          <button type="button" className="efq-error__retry" onClick={() => fetchFilters()}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !errorMsg && filters.length > 0 && (
        <>
          <div className="efq-body">
            <FilterTable
              filters={filters}
              values={values}
              dropdownOptions={dropdownOptions}
              onChange={handleChange}
              disabled={disabled}
            />
          </div>

          {appliedChips.length > 0 && !isEntryMode && (
            <footer className="efq-applied">
              <span className="efq-applied__label">Applied:</span>
              <div className="efq-applied__chips">
                {appliedChips.map((chip) => (
                  <span key={chip.colName} className="efq-chip">
                    {chip.caption}: {chip.display}
                    <button
                      type="button"
                      className="efq-chip__remove"
                      onClick={() => handleChange(chip.colName, '')}
                      aria-label={`Remove ${chip.caption} filter`}
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
              <button type="button" className="efq-applied__clear" onClick={handleClearAll}>
                Clear all
              </button>
            </footer>
          )}
        </>
      )}

      {!isLoading && !errorMsg && filters.length === 0 && onSearch && (
        <div className="efq-empty-run">{ActionButton}</div>
      )}
    </div>
  );
}
```

---

### `src/components/filters/enterprise-filter-query.css`
*Filter panel primary CSS*

```css
/* Query Builder filter panel — Stitch Premium ERP Filter Workspace */

.efq-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  flex-shrink: 0;
}

.efq-panel::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--primary);
  z-index: 2;
  pointer-events: none;
}

/* ── Command strip ── */
.efq-command {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 8px 14px 8px 18px;
  background: var(--primary);
  color: #fff;
}

.efq-command__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.efq-command__icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.efq-command__titles {
  min-width: 0;
}

.efq-command__label {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  color: #fff;
  letter-spacing: -0.01em;
}

.efq-command__subtitle {
  display: block;
  margin-top: 1px;
  font-size: 11px;
  font-weight: 600;
  color: var(--primary-light, #a3c9ff);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.efq-command__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.efq-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: #d2e4ff;
  background: rgba(47, 74, 105, 0.55);
  border-radius: var(--radius-sm);
}

.efq-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--secondary, #72b1fd);
}

.efq-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  color: var(--primary-light, #a3c9ff);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.efq-btn-ghost:hover:not(:disabled) {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.efq-btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.efq-btn-run {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  color: var(--primary);
  background: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  transition: background 0.15s, transform 0.1s;
}

.efq-btn-run:hover:not(:disabled) {
  background: #f5faff;
}

.efq-btn-run:active:not(:disabled) {
  transform: scale(0.98);
}

.efq-btn-run:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.efq-btn-run--action {
  color: #fff;
  background: linear-gradient(135deg, var(--success, #089949) 0%, #067a3a 100%);
  box-shadow: 0 2px 8px rgba(8, 153, 73, 0.3);
}

.efq-btn-run--action:hover:not(:disabled) {
  filter: brightness(1.05);
}

.efq-btn-run__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(30, 74, 122, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: efq-spin 0.7s linear infinite;
}

.efq-btn-order {
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.efq-btn-run--action .efq-btn-run__spinner {
  border-color: rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
}

@keyframes efq-spin {
  to { transform: rotate(360deg); }
}

/* ── Error banner ── */
.efq-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 8px 18px;
  font-size: 12px;
  color: #93000a;
  background: #ffdad6;
  border-bottom: 1px solid rgba(186, 26, 26, 0.15);
}

.efq-error svg {
  flex-shrink: 0;
  color: #ba1a1a;
}

.efq-error__retry {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: #ba1a1a;
  background: none;
  border: 1px solid rgba(186, 26, 26, 0.35);
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: pointer;
  font-family: inherit;
}

.efq-error__retry:hover {
  background: rgba(186, 26, 26, 0.08);
}

/* ── Loading skeleton ── */
.efq-loading {
  background: #fff;
  overflow-x: auto;
}

.efq-skeleton-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  min-height: 28px;
}

.efq-skeleton {
  height: 24px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, #eef4fa 25%, #e3e9ef 50%, #eef4fa 75%);
  background-size: 200% 100%;
  animation: efq-shimmer 1.5s infinite;
}

.efq-skeleton--label {
  height: 10px;
  width: 72px;
}

@keyframes efq-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* ── Body + 3-column tabular table ── */
.efq-body {
  background: #fff;
  overflow-x: auto;
}

.efq-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.efq-table__row:nth-child(even) .efq-table__cell:not(.efq-table__cell--empty) {
  background: #f8fafc;
}

.efq-table__cell {
  width: 33.333%;
  padding: 0;
  vertical-align: middle;
  border: 1px solid var(--border);
  background: #fff;
}

.efq-table__cell--empty {
  background: #fafbfc;
}

.efq-table__cell--full {
  width: 100%;
}

/* Label | control row inside each cell */
.efq-cell {
  display: flex;
  align-items: center;
  gap: 0;
  min-height: 28px;
}

.efq-cell--stacked {
  flex-direction: column;
  align-items: stretch;
  padding: 4px 8px;
  gap: 4px;
  min-height: auto;
}

.efq-cell--stacked .efq-cell__label {
  width: auto;
  border-right: none;
  padding: 0;
  background: transparent;
}

.efq-cell__label {
  flex: 0 0 38%;
  max-width: 140px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  line-height: 1.2;
  background: var(--primary-lighter, #eef4fa);
  border-right: 1px solid var(--border);
  align-self: stretch;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.efq-cell__control {
  flex: 1;
  min-width: 0;
  padding: 2px 6px;
  display: flex;
  align-items: center;
}

.efq-cell--fixed .efq-cell__label {
  border-left: 3px solid #4682b4;
}

.efq-cell--editable .efq-cell__label {
  border-left: 3px solid #c2327a;
}

.efq-cell__input {
  width: 100%;
  height: 24px;
  padding: 0 6px;
  font-size: 12px;
  font-family: inherit;
  color: var(--text);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.efq-cell__input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(30, 74, 122, 0.1);
}

.efq-cell__input--date {
  padding: 0 6px;
}

.efq-cell__input--textarea {
  height: auto;
  min-height: 40px;
  padding: 4px 6px;
  resize: vertical;
  line-height: 1.35;
  font-size: 12px;
}

.efq-cell__value {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  padding: 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.efq-cell__select {
  width: 100%;
}

.efq-cell__control .search-select__trigger {
  min-height: 24px;
  height: 24px;
  padding: 0 22px 0 6px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: #fff;
  box-shadow: none;
}

.efq-cell__control .search-select__value {
  line-height: 24px;
  font-size: 12px;
}

.efq-cell__control .search-select__trigger:hover,
.efq-cell__control .search-select--open .search-select__trigger,
.efq-cell__control .search-select__trigger:focus-visible {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(30, 74, 122, 0.1);
}

/* ── Applied criteria footer ── */
.efq-applied {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px 7px 18px;
  background: var(--bg, #e9eff5);
  border-top: 1px solid var(--border);
  overflow-x: auto;
}

.efq-applied__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.efq-applied__chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  min-width: 0;
}

.efq-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 6px 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.efq-chip__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.efq-chip__remove:hover {
  background: var(--primary-lighter);
  color: var(--primary);
}

.efq-applied__clear {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  color: var(--secondary, #0660a7);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  padding: 0 0 0 8px;
}

.efq-applied__clear:hover {
  color: var(--primary);
}

.efq-empty-run {
  padding: 14px 18px;
  display: flex;
  justify-content: flex-end;
  background: #fff;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .efq-table,
  .efq-table tbody,
  .efq-table tr,
  .efq-table td {
    display: block;
    width: 100%;
  }

  .efq-table__cell--empty {
    display: none;
  }

  .efq-table__cell {
    border-bottom: none;
  }

  .efq-table__row {
    border-bottom: 1px solid var(--border);
  }

  .efq-table__row:last-child {
    border-bottom: none;
  }

  .efq-command {
    flex-wrap: wrap;
    min-height: auto;
    padding-bottom: 10px;
  }

  .efq-command__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
```

---

### `src/components/filters/enterprise-filter-base.css`
*Filter panel base/legacy CSS*

```css
/* FilterPanel.css — tokens from App.css :root */

.filter-panel {
background: var(--header-gradient);  
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  margin-bottom: 0;
  box-shadow:
    0 8px 32px rgba(26,53,102,0.4),
    0 2px 8px rgba(0,0,0,0.2),
    inset 0 1px 0 rgba(255,255,255,0.1);
  position: relative;
  overflow: visible;
  flex-shrink: 0;
  min-height: fit-content;
}

.filter-panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.filter-panel::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 10%; right: 10%;
  height: 16px;
  background: radial-gradient(ellipse at center, rgba(26,53,102,0.15) 0%, transparent 70%);
  pointer-events: none;
  z-index: -1;
}

/* ── Header row ── */
.filter-panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.12);
}

.filter-panel-header svg {
  color: rgba(255,255,255,0.85);
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
}

.filter-panel-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 3px rgba(0,0,0,0.25);
  text-transform: uppercase;
}

.filter-panel-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: #ffffff;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.25);
  padding: 3px 12px;
  border-radius: 12px;
  margin-left: auto;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* ── Controls grid ── */
.filter-panel-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 18px;
  align-items: flex-end;
  background: rgba(0,0,0,0.15);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 14px 16px;
  backdrop-filter: blur(8px);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
}

/* ── Individual control ── */
.filter-control {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 170px;
  max-width: 260px;
  flex: 0 1 auto;
}

.filter-control-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

/* ── Shared inputs ── */
.filter-control input[type='text'],
.filter-control input[type='date'],
.filter-control select,
.filter-control textarea {
  width: 100%;
  height: 34px;
  padding: 0 12px;
  font-size: 0.85rem;
  font-family: inherit;
  color: #1e293b;
  background: rgba(255,255,255,0.97);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: var(--radius);
  outline: none;
  transition: all var(--transition);
  box-shadow:
    0 1px 3px rgba(0,0,0,0.08),
    0 1px 2px rgba(0,0,0,0.04),
    inset 0 1px 0 rgba(255,255,255,0.6);
}

.filter-control textarea {
  height: 64px;
  padding: 8px 12px;
  resize: vertical;
  line-height: 1.5;
}

.filter-control input:focus,
.filter-control select:focus,
.filter-control textarea:focus {
  border-color: #60a5fa;
  box-shadow:
    0 0 0 4px rgba(96,165,250,0.2),
    0 1px 3px rgba(0,0,0,0.08);
  background: #ffffff;
  transform: translateY(-1px);
}

.filter-control input:hover,
.filter-control select:hover,
.filter-control textarea:hover {
  border-color: #93c5fd;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  transform: translateY(-1px);
}

.filter-control select {
  appearance: none;
  background-image: var(--chevron-svg);
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 32px;
  cursor: pointer;
}

/* ── Label-only control ── */
.filter-control-value {
  height: 34px;
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: #ffffff;
  padding: 0 12px;
  background: rgba(255,255,255,0.12);
  border-radius: var(--radius);
  border: 1px solid rgba(255,255,255,0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
}


.filter-panel-spinner {
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(255,255,255,0.15);
  border-top-color: rgba(255,255,255,0.95);
  border-radius: 50%;
  animation: fp-spin 0.7s linear infinite;
}

@keyframes fp-spin { to { transform: rotate(360deg); } }

.filter-panel-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  font-size: 0.85rem;
  color: var(--danger);
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius);
  box-shadow: 0 2px 8px rgba(220,38,38,0.08);
}

.filter-panel-error svg { flex-shrink: 0; }

.filter-panel-retry {
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--danger);
  background: none;
  border: 1px solid #fca5a5;
  border-radius: var(--radius-sm);
  padding: 4px 12px;
  cursor: pointer;
  transition: all var(--transition);
}

.filter-panel-retry:hover {
  background: #fee2e2;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(220,38,38,0.1);
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .filter-panel-controls { flex-direction: column; }
  .filter-control { max-width: 100%; min-width: 0; }
}

/* ── Search button ── */
.filter-search-wrap {
  min-width: auto !important;
  max-width: none !important;
  flex: 0 0 auto !important;
}

.filter-search-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 24px;
  font-size: 0.85rem;
  font-weight: 700;
  font-family: inherit;
  color: var(--navy);
  background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: var(--radius);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
  box-shadow:
    0 2px 8px rgba(0,0,0,0.15),
    0 1px 3px rgba(0,0,0,0.1),
    inset 0 1px 0 rgba(255,255,255,0.8);
}

.filter-search-btn:hover:not(:disabled) {
  background: linear-gradient(180deg, #ffffff 0%, #ffffff 100%);
  box-shadow: 0 6px 20px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.1);
  transform: translateY(-2px);
  color: var(--navy);
}

.filter-search-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}

.filter-search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.filter-search-btn svg { flex-shrink: 0; color: var(--navy); }

.filter-search-spinner {
  width: 16px;
  height: 16px;
  border: 2.5px solid rgba(26,53,102,0.2);
  border-top-color: var(--navy);
  border-radius: 50%;
  animation: fp-spin 0.7s linear infinite;
}

/* ── Entry-mode action button (Add New) — green accent ── */
.filter-action-btn {
  color: #ffffff !important;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
  border-color: rgba(34,197,94,0.4) !important;
  box-shadow:
    0 2px 10px rgba(34,197,94,0.35),
    0 1px 3px rgba(0,0,0,0.1),
    inset 0 1px 0 rgba(255,255,255,0.25) !important;
}

.filter-action-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%) !important;
  box-shadow:
    0 6px 20px rgba(34,197,94,0.45),
    0 2px 6px rgba(0,0,0,0.1) !important;
  transform: translateY(-2px);
}

.filter-action-btn svg {
  color: #ffffff !important;
}

.filter-action-btn .filter-search-spinner {
  border-color: rgba(255,255,255,0.3);
  border-top-color: #ffffff;
}
```

---

### `src/components/filters/enterprise-filter-modern.css`
*Filter panel modern variant CSS*

```css
/* Shared modern filter layout — FilterPanel + TxnEntryFilterPanel */

.filter-panel,
.tef-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.filter-panel::before,
.tef-panel::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--header-gradient);
  z-index: 1;
}

.filter-panel::after,
.tef-panel::after {
  display: none;
}

/* Toolbar row */
.fp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px 8px 16px;
  background: linear-gradient(90deg, var(--primary-lighter) 0%, var(--surface) 55%);
  border-bottom: 1px solid var(--border);
}

.fp-toolbar__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.fp-toolbar__icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  background: var(--header-gradient);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.fp-toolbar__title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.fp-toolbar__meta {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  margin-top: 1px;
}

.fp-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Field grid */
.fp-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 8px 10px;
  padding: 10px 12px 10px 16px;
  background: var(--bg);
  align-items: end;
}

.fp-fields__actions {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  grid-column: 1 / -1;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px dashed var(--border);
  margin-top: 2px;
}

@media (min-width: 900px) {
  .fp-fields__actions {
    grid-column: auto;
    border-top: none;
    margin-top: 0;
    padding-top: 0;
    justify-content: flex-end;
  }
}

/* Controls — override legacy white-on-blue labels */
.filter-panel .filter-control,
.tef-panel .tef-control,
.filter-panel .filter-control-label,
.tef-panel .tef-label {
  min-width: 0;
  max-width: none;
}

.filter-panel .filter-control-label,
.tef-panel .tef-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-shadow: none;
}

.filter-panel .filter-control input[type='text'],
.filter-panel .filter-control input[type='date'],
.filter-panel .filter-control select,
.filter-panel .filter-control textarea,
.tef-panel .tef-control input[type='text'],
.tef-panel .tef-control input[type='date'],
.tef-panel .tef-control select,
.tef-panel .tef-control textarea {
  height: 30px;
  padding: 0 10px;
  font-size: var(--font-size-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  box-shadow: none;
}

.filter-panel .filter-control input:focus,
.filter-panel .filter-control select:focus,
.filter-panel .filter-control textarea:focus,
.tef-panel .tef-control input:focus,
.tef-panel .tef-control select:focus,
.tef-panel .tef-control textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-light);
  transform: none;
}

.filter-panel .filter-control-value,
.tef-panel .tef-value {
  height: 30px;
  font-size: var(--font-size-sm);
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: none;
}

.filter-panel .filter-search-btn,
.tef-panel .tef-add-btn,
.tef-panel .tef-order-btn {
  height: 30px;
  padding: 0 16px;
  font-size: var(--font-size-sm);
  border-radius: var(--radius-sm);
}

.filter-panel .filter-search-btn {
  color: #fff;
  background: var(--header-gradient);
  border: 1px solid transparent;
  box-shadow: var(--shadow-sm);
}

.filter-panel .filter-search-btn:hover:not(:disabled) {
  filter: brightness(1.05);
  transform: none;
  box-shadow: var(--shadow-md);
}

.filter-panel .filter-search-btn svg {
  color: #fff;
}

.filter-panel .filter-action-btn {
  background: linear-gradient(135deg, var(--success) 0%, var(--primary-hover) 100%) !important;
}

.filter-panel-header,
.tef-panel-header,
.filter-panel-controls,
.tef-panel-controls {
  all: unset;
  display: contents;
}

.filter-search-wrap,
.tef-action-wrap {
  min-width: auto !important;
  max-width: none !important;
}
```

---


## Part 9 — Grid Components

### `src/components/grid/gridColumnClass.js`
*Column class helpers for grid rendering*

```js
/** Column role from API flags: IsFreezeReq, IsEditAllow (or mapped isFixed / isEditAllow). */

import { isTruthyApiFlag } from '../../utils/gridUtils';

export function isColumnFixed(col) {
  if (!col) return false;
  if (col.isFixed === true) return true;
  return isTruthyApiFlag(col.IsFreezeReq);
}

export function isColumnEditable(col) {
  if (isColumnFixed(col)) return false;
  if (col.isEditAllow === true) return true;
  return isTruthyApiFlag(col.IsEditAllow);
}

export function getColumnCellClass(col, lastFixedColId) {
  if (isColumnFixed(col)) {
    const classes = ['fixed-col'];
    if (col.id === lastFixedColId) classes.push('last-fixed');
    return classes.join(' ');
  }
  if (isColumnEditable(col)) return 'editable-col';
  return 'readonly-col';
}

export function getColumnHeaderThemeClass(col) {
  if (isColumnFixed(col)) return 'fixed-header';
  if (isColumnEditable(col)) return 'editable-header';
  return 'readonly-header';
}
```

---

### `src/components/grid/EnterpriseDataGrid.jsx`
*Read-only paginated listing grid*

```jsx
// NormalGrid.jsx — updated to use shared ColumnFilter component
// Changes from original:
//   • Header filter dropdowns replaced with the shared ColumnFilter popup
//   • columnFilters state uses the same shape as GridForm (Set / range objects)
//   • applyColumnFilterValue + isFilterActive imported from ColumnFilter.jsx
//   • filterType on each column controls which filter UI renders
//     ('list' | 'date' | 'number' | 'text')

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import Loader from '../ui/Loader';
import ColumnFilter, { applyColumnFilterValue, isFilterActive } from './Columnfilter';
import './EnterpriseDataGrid.css';

/**
 * NormalGrid — a reusable paginated data-grid card.
 *
 * Props
 * ─────
 * title          {string}          Card header title
 * icon           {ReactNode}       Icon rendered beside the title
 * columns        {Column[]}        Column definitions (see shape below)
 * data           {object[]}        Raw row data
 * loading        {boolean}         Show loader overlay
 * error          {string|null}     Error message to display
 * onRowClick     {(row) => void}   Called when a row or link-cell is clicked
 * loaderText     {string}          Loader label  (default: 'Loading…')
 * defaultPageSize{number}          Initial rows per page (default: 10)
 * pageSizeOptions{number[]}        Rows-per-page choices (default: [5,10,20,50,99])
 * emptyMessage   {string}          Empty-state text (default: 'No records found.')
 *
 * Column shape
 * ────────────
 * {
 *   key         : string,
 *   label       : string,
 *   width?      : string,              // CSS width, e.g. '36%'
 *   filterable? : boolean,             // show filter icon in header
 *   filterType? : 'list'|'date'|'number'|'text',  // default 'list'
 *   dropdownOptions?: array,           // for 'list' type — same shape as GridForm
 *   align?      : 'left'|'center'|'right',
 *   isLink?     : boolean,
 *   badge?      : (value, row) => 'danger'|'warning'|'success'|'neutral',
 *   render?     : (value, row) => ReactNode,
 * }
 */
function EnterpriseDataGrid({
  title,
  icon,
  columns = [],
  data = [],
  loading = false,
  error = null,
  onRowClick,
  loaderText = 'Loading…',
  defaultPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50, 99],
  pageSize: pageSizeProp,
  onPageSizeChange,
  emptyMessage = 'No records found.',
  hideHeader = false,
  fill = false,
}) {
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);
  const itemsPerPage = pageSizeProp ?? internalPageSize;

  const setItemsPerPage = useCallback((next) => {
    const value = typeof next === 'function' ? next(itemsPerPage) : next;
    if (onPageSizeChange) onPageSizeChange(value);
    else setInternalPageSize(value);
    setCurrentPage(1);
  }, [itemsPerPage, onPageSizeChange]);

  // One ref per column for anchor positioning — keyed by col.key
  const filterButtonRefs = useRef({});
  const getFilterRef = useCallback((key) => {
    if (!filterButtonRefs.current[key]) {
      filterButtonRefs.current[key] = React.createRef();
    }
    return filterButtonRefs.current[key];
  }, []);

  /* ── Filter toggle ────────────────────────────────────────────────── */
  const toggleFilter = useCallback((colKey) => {
    setActiveFilterCol(prev => (prev === colKey ? null : colKey));
  }, []);

  const handleFilterChange = useCallback((colKey, value) => {
    setColumnFilters(prev => ({ ...prev, [colKey]: value }));
    setCurrentPage(1);
  }, []);

  const handleFilterClear = useCallback((colKey) => {
    setColumnFilters(prev => { const n = { ...prev }; delete n[colKey]; return n; });
    setCurrentPage(1);
  }, []);

  /* ── Apply all column filters ─────────────────────────────────────── */
  const filteredData = useMemo(() => {
    let result = [...data];
    Object.entries(columnFilters).forEach(([key, filterValue]) => {
      const col = columns.find(c => c.key === key);
      result = applyColumnFilterValue(result, key, filterValue, col);
    });
    return result;
  }, [data, columnFilters, columns]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

  const currentData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  /* ── Cell renderer ────────────────────────────────────────────────── */
  const renderCell = (col, row) => {
    const value = row[col.key];
    if (col.render) return col.render(value, row);
    if (col.badge) {
      const variant = col.badge(value, row);
      return <span className={`ng-badge ng-badge--${variant}`}>{value}</span>;
    }
    if (col.isLink) {
      return (
        <span className="ng-link" onClick={e => { e.stopPropagation(); onRowClick?.(row); }}>
          {value}
        </span>
      );
    }
    return value ?? '—';
  };

  const rowIsClickable = onRowClick && !columns.some(c => c.isLink);
  const cellAlign = (col, colIndex) => col.align ?? (colIndex === 0 ? 'left' : 'center');

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className={`ng-card ${fill ? 'ng-card--fill' : ''}`}>
      {/* ── header ── */}
      {!hideHeader && (
      <div className="ng-card-header">
        <h2 className="ng-card-title">
          {icon && <span className="ng-card-icon">{icon}</span>}
          {title}
        </h2>
        <div className="ng-pagesize-wrapper">
          <label htmlFor="ng-pagesize-select">Show</label>
          <select
            id="ng-pagesize-select"
            className="ng-select"
            value={itemsPerPage}
            onChange={e => setItemsPerPage(Number(e.target.value))}
          >
            {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label htmlFor="ng-pagesize-select">entries</label>
        </div>
      </div>
      )}

      {/* ── body ── */}
      <div className="ng-card-content">
        {loading ? (
          <Loader text={loaderText} />
        ) : error ? (
          <div className="ng-error">{error}</div>
        ) : (
          <>
            <div className="ng-table-wrapper">
              <table className="ng-table">
                <colgroup>
                  {columns.map((col, i) => (
                    <col key={i} style={col.width ? { width: col.width } : undefined} />
                  ))}
                </colgroup>

                <thead>
                  <tr>
                    {columns.map((col, i) => {
                      const active = isFilterActive(columnFilters[col.key]);
                      const filterRef = col.filterable ? getFilterRef(col.key) : null;
                      return (
                        <th key={i} style={{ textAlign: cellAlign(col, i) }}>
                          <div className="ng-th-inner">
                            <span className="ng-th-label">{col.label}</span>
                            {col.filterable && (
                              <span
                                ref={filterRef}
                                className={`ng-filter-icon ${active ? 'ng-filter-icon--active' : ''}`}
                                onClick={() => toggleFilter(col.key)}
                                role="button"
                                aria-label={`Filter ${col.label}`}
                                title={`Filter ${col.label}`}
                              >
                                <Filter size={11} color='#162d5c' />
                              </span>
                            )}
                          </div>
                          {/* Active filter indicator */}
                          {active && <span className="ng-filter-dot" aria-label="Filter active" />}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {currentData.length > 0 ? (
                    currentData.map((row, ri) => (
                      <tr
                        key={ri}
                        className={rowIsClickable ? 'ng-row--clickable' : ''}
                        onClick={rowIsClickable ? () => onRowClick(row) : undefined}
                      >
                        {columns.map((col, ci) => (
                          <td
                            key={ci}
                            style={{ textAlign: cellAlign(col, ci) }}
                            data-col={col.key}
                          >
                            {renderCell(col, row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length} className="ng-empty-cell">
                        {emptyMessage}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── pagination bar ── */}
            {filteredData.length > 0 && (
              <div className="ng-bottom-panel">
                <p className="ng-pagination-info">
                  Showing{' '}
                  <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> –{' '}
                  <strong>{Math.min(currentPage * itemsPerPage, filteredData.length)}</strong>{' '}
                  of <strong>{filteredData.length}</strong> entries
                  {filteredData.length !== data.length && ` (filtered from ${data.length})`}
                </p>
                <div className="ng-pagination-controls">
                  <button
                    className="ng-page-btn"
                    onClick={() => setCurrentPage(p => p - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button
                    className="ng-page-btn"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Filter popup (portaled to body) ── */}
      {activeFilterCol && (() => {
        const col = columns.find(c => c.key === activeFilterCol);
        if (!col) return null;
        return (
          <ColumnFilter
            col={col}
            allRows={data}
            value={columnFilters[activeFilterCol]}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            onClose={() => setActiveFilterCol(null)}
            anchorRef={getFilterRef(activeFilterCol)}
          />
        );
      })()}
    </div>
  );
}

export default EnterpriseDataGrid;
```

---

### `src/components/grid/EnterpriseDataGrid.css`
*EnterpriseDataGrid styles*

```css
/* NormalGrid.css — self-contained styles for the NormalGrid component.
   Consumes CSS custom-properties from the global App.css :root,
   but introduces NO new globals of its own.
   All class names are prefixed `ng-` to avoid collisions.            */

/* ─── Card shell ──────────────────────────────────────────────────── */
.ng-card {
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;                   /* stretches inside a flex column */
}

/* ─── Card header ─────────────────────────────────────────────────── */
.ng-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--header-gradient);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

/* subtle shimmer line at the very top of the header */
.ng-card-header::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.22) 50%,
    transparent 100%
  );
}

.ng-card-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.ng-card-icon {
  display: inline-flex;
  align-items: center;
  opacity: 0.9;
  filter: brightness(0) invert(1);
}

/* ── Page-size selector (header right) ── */
.ng-pagesize-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.82);
  font-weight: 500;
}

/* ─── Shared select style (header filter + page-size) ────────────── */
.ng-select {
  padding: 2px 22px 2px 6px;
  font-size: 0.75rem;
  border: 1px solid var(--border-dark);
  border-radius: var(--radius-sm);
  background-color: var(--surface);
  color: var(--text);
  appearance: none;
  background-image: var(--chevron-svg);
  background-repeat: no-repeat;
  background-position: right 6px center;
  cursor: pointer;
  transition: border-color var(--transition);
  vertical-align: middle;
}

.ng-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--primary-light);
}

/* ─── Card content area ───────────────────────────────────────────── */
.ng-card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  min-height: 0;
}

/* Fill parent — table flexes, pagination pinned at bottom */
.ng-card--fill {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ng-card--fill .ng-card-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.ng-card--fill .ng-table-wrapper {
  flex: 1;
  min-height: 0;
  height: auto;
  max-height: none;
  overflow: auto;
}

.ng-card--fill .ng-bottom-panel {
  flex-shrink: 0;
}

/* ─── Error + empty states ────────────────────────────────────────── */
.ng-error {
  padding: 20px;
  color: #dc2626;
  text-align: center;
  font-size: 0.875rem;
}

.ng-empty-cell {
  text-align: center;
  padding: 28px 20px;
  color: #64748b;
  font-size: 0.85rem;
  font-style: italic;
}

/* ─── Scrollable table wrapper ────────────────────────────────────── */
/*
  Fixed height = 10 body rows (48 px each) + sticky header row (44 px).
  Content beyond 10 rows scrolls internally.
  Override --ng-max-rows via the style prop if you need a different limit.
*/
.ng-table-wrapper {
  overflow: auto;
  height: calc(var(--ng-max-rows, 10) * 48px + 44px);
  scrollbar-width: thin;
  scrollbar-color: var(--border-dark) transparent;
}

.ng-table-wrapper::-webkit-scrollbar          { width: 8px; height: 8px; }
.ng-table-wrapper::-webkit-scrollbar-track    { background: transparent; }
.ng-table-wrapper::-webkit-scrollbar-thumb    { background: var(--border-dark); border-radius: 4px; }

/* ─── Table ───────────────────────────────────────────────────────── */
.ng-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.84rem;
  font-family: 'Inter', system-ui, sans-serif;
  table-layout: fixed;         /* enables word-wrap in first column */
}

/* ── Sticky header ── */
.ng-table thead th {
  position: sticky;
  top: 0;
  z-index: 5;
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #dbeafe 100%);
  color: #334155;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 10px 12px;
  border-bottom: 2px solid #94a3b8;
  border-right: 1px solid var(--border-dark);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
  user-select: none;
  vertical-align: middle;
}

.ng-table thead th:last-child { border-right: none; }

.ng-th-label {
  vertical-align: middle;
}

/* ── Body cells ── */
.ng-table tbody td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.83rem;
  color: #334155;
  font-weight: 400;
  vertical-align: middle;
  white-space: nowrap;         /* default: single line */
  line-height: 1.4;
}

.ng-table tbody td:last-child { border-right: none; }

/* First column: allow wrapping (long names, etc.) */
.ng-table tbody td:first-child {
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Zebra striping */
.ng-table tbody tr:nth-child(even) td { background: #f8fafc; }

/* Row hover */
.ng-table tbody tr:hover td { background: var(--primary-lighter); }

/* Clickable row cursor */
.ng-table tbody tr.ng-row--clickable { cursor: pointer; }

/* ─── Link cell (isLink columns) ──────────────────────────────────── */
.ng-link {
  color: var(--primary);
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: block;
  word-break: break-word;
  transition: color var(--transition);
}

.ng-link:hover {
  color: var(--primary-hover);
  text-decoration: underline;
}

/* ─── Badge cell (badge columns) ─────────────────────────────────── */
.ng-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.ng-badge--danger  { background: #fee2e2; color: #b91c1c; }
.ng-badge--warning { background: #fef3c7; color: #92400e; }
.ng-badge--success { background: #d1fae5; color: #065f46; }
.ng-badge--neutral { background: #f1f5f9; color: var(--text-muted); }

/* ─── Bottom pagination bar ───────────────────────────────────────── */
.ng-bottom-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  background: var(--header-gradient);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}

.ng-pagination-info {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 400;
}

.ng-pagination-info strong {
  font-weight: 700;
  color: #ffffff;
}

.ng-pagination-controls {
  display: flex;
  gap: 6px;
}

.ng-page-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition);
  backdrop-filter: blur(4px);
}

.ng-page-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

.ng-page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}


/* ─── Inline filter icon (replaces button) ──────────────────────── */
.ng-filter-icon {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  color: #94a3b8;           /* muted by default — blends with header */
  margin-left: 5px;
  opacity: 0.55;
  transition: opacity var(--transition), color var(--transition);
  vertical-align: middle;
  line-height: 0;
  /* no background, no border, no padding — pure icon */
}

.ng-filter-icon:hover {
  opacity: 1;
  color: var(--primary);
}

.ng-filter-icon--active {
  opacity: 1;
  color: var(--primary);
}

/* ─── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .ng-bottom-panel {
    flex-direction: column;
    align-items: flex-start;
  }

  .ng-table-wrapper {
    /* on mobile, let the wrapper grow rather than clip at 10 rows */
    height: auto;
    max-height: calc(var(--ng-max-rows, 10) * 48px + 44px);
  }
}
```

---

### `src/components/grid/EnterpriseGrid.jsx`
*Core editable grid engine (used by EntryGrid)*

```jsx
import React, { useState, useMemo, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import SearchSelect from '../ui/SearchSelect';
import BottomControlPanel from './GridBottomPanel';
import { Filter, X, ChevronDown } from 'lucide-react';

import './EnterpriseGrid.css';
import { isColumnFixed, getColumnCellClass, getColumnHeaderThemeClass } from './gridColumnClass';

const generateId = () => Math.random().toString(36).substr(2, 9);

const operatorsByType = {
  text: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts', label: 'Starts With' },
    { value: 'ends', label: 'Ends With' },
    { value: 'empty', label: 'Is Empty' },
    { value: 'notempty', label: 'Is Not Empty' }
  ],
  number: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not Equals' },
    { value: 'gt', label: 'Greater Than' },
    { value: 'lt', label: 'Less Than' },
    { value: 'gte', label: 'Greater Than or Equal' },
    { value: 'lte', label: 'Less Than or Equal' },
    { value: 'empty', label: 'Is Empty' },
    { value: 'notempty', label: 'Is Not Empty' }
  ],
  date: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not Equals' },
    { value: 'gt', label: 'After' },
    { value: 'lt', label: 'Before' },
    { value: 'gte', label: 'On or After' },
    { value: 'lte', label: 'On or Before' },
    { value: 'empty', label: 'Is Empty' },
    { value: 'notempty', label: 'Is Not Empty' }
  ],
  select: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not Equals' },
    { value: 'empty', label: 'Is Empty' },
    { value: 'notempty', label: 'Is Not Empty' }
  ]
};

function evaluateFilter(rowValue, operator, filterValue) {
  const val = rowValue == null ? '' : String(rowValue).toLowerCase();
  const fVal = filterValue == null ? '' : String(filterValue).toLowerCase();
  const numVal = Number(rowValue);
  const fNum = Number(filterValue);
  switch (operator) {
    case 'eq': return val === fVal;
    case 'ne': return val !== fVal;
    case 'contains': return val.includes(fVal);
    case 'starts': return val.startsWith(fVal);
    case 'ends': return val.endsWith(fVal);
    case 'gt': return !isNaN(numVal) && !isNaN(fNum) && numVal > fNum;
    case 'lt': return !isNaN(numVal) && !isNaN(fNum) && numVal < fNum;
    case 'gte': return !isNaN(numVal) && !isNaN(fNum) && numVal >= fNum;
    case 'lte': return !isNaN(numVal) && !isNaN(fNum) && numVal <= fNum;
    case 'empty': return val === '';
    case 'notempty': return val !== '';
    default: return true;
  }
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function toPixels(w) {
  if (typeof w === 'number') return w;
  if (typeof w === 'string') return parseInt(w, 10) || 0;
  return 0;
}

// ─── Date Helpers ─────────────────────────────────────────────────────────
function formatDateForInput(isoString) {
  if (!isoString) return '';
  if (typeof isoString === 'string' && isoString.includes('T')) {
    return isoString.split('T')[0];
  }
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function parseDateFromInput(dateString) {
  if (!dateString) return '';
  return `${dateString}T00:00:00`;
}

// ── Columns that trigger onCellEvent on Tab key ────────────────────────────
const EVENT_COLUMNS = new Set([
  'ItemID', 'TranQty', 'BaseQty', 'BaseRate', 'TranRate',
  'DiscPerc', 'Expense', 'GSTPerc',
]);

const GridForm = forwardRef(function GridForm(
  { config, initialData, title = 'Grid Form', onSave, mode = 'view', onCellEvent },
  ref
) {
  // mode: 'view' (default) — read/edit existing data with filter row
  //        'entry'         — blank grid, no filter row, rows added via Add New
  const { columns, pagination } = config;
  const { pageSize: defaultPageSize = 10, pageSizeOptions = [10, 25, 50, 100] } = pagination || {};

  const [rows, setRows] = useState(initialData);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [headerFilters, setHeaderFilters] = useState({});
  const [customFilters, setCustomFilters] = useState([]);
  const [showCustomFilter, setShowCustomFilter] = useState(false);
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const [columnWidths, setColumnWidths] = useState(() => {
    const map = {};
    columns.forEach(c => { map[c.id] = c.width; });
    return map;
  });
  const [resizing, setResizing] = useState(null);

  const rowsRef = useRef(initialData);
  const tableWrapperRef = useRef(null);
  const popupRef = useRef(null);

  // Keep rowsRef current so Tab-key closures always read the latest row data
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // In 'view' mode: reset whenever parent pushes new data (e.g. after search).
  // In 'entry' mode: only seed once on mount; rows are managed internally.
  useEffect(() => {
    if (mode !== 'entry') {
      setRows(initialData || []);
      setPage(1);
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]); // intentionally exclude mode — entry never re-seeds

  // ── Imperative handle: expose addRow() to parent refs (entry mode) ──
  useImperativeHandle(ref, () => ({
    /** Append a pre-built blank row object to the grid */
    addRow(blankRow) {
      setRows(prev => [...prev, blankRow]);
    },
    /** Expose current rows so parent can read them for save */
    getRows() {
      return rows;
    },
    /** Merge updated fields into a specific row (used after cell-event API) */
    updateRow(rowId, updatedFields) {
      setRows(prev =>
        prev.map(r =>
          String(r.id) === String(rowId) ? { ...r, ...updatedFields } : r
        )
      );
    },
  }), [rows]);

  // ─── Column Resize Logic ─────────────────────────────────────────────────
  const handleResizeStart = useCallback((e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = toPixels(columnWidths[colId] || columns.find(c => c.id === colId)?.width || 120);
    setResizing({ colId, startX: e.clientX, startWidth });
  }, [columnWidths, columns]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e) => {
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(60, resizing.startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [resizing.colId]: newWidth }));
    };
    const handleUp = () => setResizing(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  // ─── Fixed column left offsets (recalculates on resize) ───────────────────
  const fixedLeftMap = useMemo(() => {
    const map = {};
    let left = 0;
    columns.forEach(col => {
      if (isColumnFixed(col)) {
        map[col.id] = left;
        left += toPixels(columnWidths[col.id] || col.width) || 120;
      }
    });
    return map;
  }, [columns, columnWidths]);

  const lastFixedColId = useMemo(() => {
    const fixed = columns.filter(c => isColumnFixed(c));
    return fixed.length > 0 ? fixed[fixed.length - 1].id : null;
  }, [columns]);

  // ─── Helper: map raw dropdown value to its display label ─────────────────
  const getDropdownLabel = useCallback((col, rawValue) => {
    if (col.controlType !== 4 || !col.dropdownOptions) return rawValue;
    const opts = col.dropdownOptions.map(opt => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      if (opt && typeof opt === 'object') {
        if (opt.value !== undefined) return { value: String(opt.value), label: opt.label || String(opt.value) };
        return { value: String(opt.ObjDetID ?? opt), label: opt.Name ?? String(opt) };
      }
      return { value: String(opt), label: String(opt) };
    });
    const found = opts.find(o => String(o.value) === String(rawValue));
    return found ? found.label : rawValue;
  }, []);

  const processedRows = useMemo(() => {
    let data = [...rows];
    Object.entries(headerFilters).forEach(([key, text]) => {
      if (!text) return;
      const lower = text.toLowerCase();
      data = data.filter(r => String(r[key] ?? '').toLowerCase().includes(lower));
    });
    Object.entries(columnFilters).forEach(([key, filter]) => {
      if (!filter) return;
      if (filter instanceof Set) {
        if (filter.size === 0) return;
        data = data.filter(r => filter.has(String(r[key] ?? '')));
      } else if (filter.type === 'range') {
        const { from, to } = filter;
        if (!from && !to) return;
        data = data.filter(r => {
          const val = r[key];
          if (val == null || val === '') return false;
          const dateStr = typeof val === 'string' && val.includes('T') ? val.split('T')[0] : val;
          const dateVal = new Date(dateStr);
          if (isNaN(dateVal)) return false;
          if (from && dateVal < new Date(from)) return false;
          if (to) {
            const endOfDay = new Date(to);
            endOfDay.setHours(23, 59, 59, 999);
            if (dateVal > endOfDay) return false;
          }
          return true;
        });
      }
    });
    customFilters.forEach(cf => {
      if (!cf.column) return;
      data = data.filter(r => evaluateFilter(r[cf.column], cf.operator, cf.value));
    });
    if (sortConfig.key) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? '';
        const bVal = b[sortConfig.key] ?? '';
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        let cmp = 0;
        if (!isNaN(aNum) && !isNaN(bNum) && aVal !== '' && bVal !== '') {
          cmp = aNum - bNum;
        } else {
          cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        }
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [rows, headerFilters, columnFilters, customFilters, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const displayRows = processedRows.slice(startIdx, startIdx + pageSize);

  useEffect(() => { setPage(1); }, [pageSize, columnFilters, customFilters, headerFilters, sortConfig]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setActiveFilterCol(null);
      }
    }
    if (activeFilterCol) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeFilterCol]);

  const handleSelectAll = useCallback(() => {
    const pageIds = displayRows.map(r => String(r.id));
    if (pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageIds));
    }
  }, [selectedIds, displayRows]);

  const handleSelectRow = useCallback((id) => {
    const sid = String(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const handleCellChange = useCallback((rowId, colKey, value) => {
    setRows(prev => prev.map(r => String(r.id) === String(rowId) ? { ...r, [colKey]: value } : r));
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleSaveSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (onSave) {
      const selectedRows = rows.filter(r => selectedIds.has(String(r.id)));
      onSave(selectedRows);
    }
  }, [selectedIds, rows, onSave]);

  const handleCopySelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const toCopy = rows.filter(r => selectedIds.has(String(r.id)));

    let currentMinId = 0;
    rows.forEach(r => {
      const idNum = Number(r.ObjDetID);
      if (idNum < currentMinId) currentMinId = idNum;
    });

    const newRows = toCopy.map((r, idx) => {
      const newId = currentMinId - (idx + 1);
      return { ...r, id: newId, IDNumber: newId };
    });

    setRows(prev => {
      const nextRows = [...prev];
      for (let i = toCopy.length - 1; i >= 0; i--) {
        const origRow = toCopy[i];
        const newRow = newRows[i];
        const idx = nextRows.findIndex(r => String(r.id) === String(origRow.id));
        if (idx !== -1) {
          nextRows.splice(idx + 1, 0, newRow);
        } else {
          nextRows.push(newRow);
        }
      }
      return nextRows;
    });

    setSelectedIds(new Set());

    if (toCopy.length > 0) {
      const firstOrig = toCopy[0];
      const firstOrigIndex = processedRows.findIndex(r => String(r.id) === String(firstOrig.id));
      if (firstOrigIndex !== -1) {
        const firstNewRowIndex = firstOrigIndex + 1;
        const targetPage = Math.floor(firstNewRowIndex / pageSize) + 1;
        if (targetPage !== page) {
          setPage(targetPage);
        }
      }
    }
  }, [selectedIds, rows, processedRows, pageSize, page]);

  const handleExportExcel = useCallback(() => {
    const headers = columns.map(c => c.name).join(',');
    const csvRows = processedRows.map(r =>
      columns.map(c => {
        const val = r[c.key] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    downloadCSV(`${title.replace(/\s+/g, '_')}_export.csv`, [headers, ...csvRows].join('\n'));
  }, [processedRows, columns, title]);

  const handleResetFilters = useCallback(() => {
    setColumnFilters({});
    setHeaderFilters({});
    setCustomFilters([]);
    setSortConfig({ key: null, direction: 'asc' });
    setFilterSearch('');
  }, []);

  const toggleColumnFilter = useCallback((colKey) => {
    if (activeFilterCol === colKey) {
      setActiveFilterCol(null);
    } else {
      setActiveFilterCol(colKey);
      setFilterSearch('');
    }
  }, [activeFilterCol]);

  const applyColumnFilter = useCallback((colKey, selectedValues) => {
    setColumnFilters(prev => ({ ...prev, [colKey]: selectedValues }));
    setActiveFilterCol(null);
  }, []);

  const clearColumnFilter = useCallback((colKey) => {
    setColumnFilters(prev => { const n = { ...prev }; delete n[colKey]; return n; });
    setActiveFilterCol(null);
  }, []);

  const addCustomFilter = useCallback(() => {
    setCustomFilters(prev => [...prev, { id: generateId(), column: columns.find(c => c.filterable)?.key || '', operator: 'eq', value: '' }]);
  }, [columns]);

  const updateCustomFilter = useCallback((id, field, value) => {
    setCustomFilters(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  }, []);

  const removeCustomFilter = useCallback((id) => {
    setCustomFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const applyCustomFilters = useCallback(() => {
    setShowCustomFilter(false);
  }, []);

  const handleScroll = useCallback((e) => {
    const el = e.target;
    const left = el.scrollLeft > 5;
    const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 5;
    setScrollState({ left, right });
  }, []);

  // ── Cell-event helper: fires onCellEvent on Tab when col is in EVENT_COLUMNS ──
  // Returns an onKeyDown handler for the cell-wrapper <div>.
  // Keyboard events from ANY child (text input, date input, SearchSelect trigger)
  // bubble up to the wrapper, so this works for all control types.
  const makeCellKeyDown = useCallback((row, col) => {
    if (!onCellEvent || !EVENT_COLUMNS.has(col.key)) return undefined;
    return (e) => {
      if (e.key === 'Tab') {
        // rowsRef.current is always the latest snapshot — no stale closure issue
        const currentRow = rowsRef.current.find(r => String(r.id) === String(row.id)) || row;

        // For textbox/date inputs the browser fires onChange → onKeyDown in the
        // same flush, but React may not have committed the state update yet.
        // e.target.value gives us the in-flight typed value directly.
        const liveValue =
          e.target && (col.controlType === 1 || col.controlType === 2)
            ? e.target.value
            : currentRow[col.key];

        onCellEvent({
          rowId: row.id,
          colKey: col.key,
          rowData: { ...currentRow, [col.key]: liveValue },
        });
      }
    };
  }, [onCellEvent]); // rowsRef is a ref — no need to list it as a dependency

  const renderCellControl = (row, col) => {
    const value = row[col.key] ?? '';
    const commonProps = {
      value,
      onChange: (e) => handleCellChange(row.id, col.key, e.target.value),
      className: col.controlType === 0 ? 'cell-label' : col.controlType === 4 ? 'cell-select' : col.controlType === 9 ? 'cell-textarea' : 'cell-input',
      tabIndex: 0,
      'aria-label': `${col.name} for row ${row.id}`,
    };
    switch (col.controlType) {
      case 0: return <span className="cell-label" title={value}>{value}</span>;
      case 1: return <input type="text" {...commonProps} />;
      case 2: {
        const dateValue = formatDateForInput(value);
        return (
          <input
            type="date"
            {...commonProps}
            value={dateValue}
            onChange={(e) => handleCellChange(row.id, col.key, parseDateFromInput(e.target.value))}
          />
        );
      }
      case 4: {
        const opts = (col.dropdownOptions || []).map(opt => {
          if (typeof opt === 'string') return { value: opt, label: opt };
          if (opt.value !== undefined) return opt;
          return { value: String(opt.ObjDetID ?? opt), label: opt.Name ?? String(opt) };
        });
        return (
          <SearchSelect
            value={String(value)}
            onChange={(val) => handleCellChange(row.id, col.key, val)}
            options={opts}
            placeholder="-- Select --"
            compact
            ariaLabel={`${col.name} for row ${row.id}`}
          />
        );
      }
      case 9: {
        const text = String(value ?? '');
        const lineCount = (text.match(/\n/g) || []).length + 1;
        const rows = Math.max(1, Math.min(lineCount, 6));
        return (
          <textarea
            {...commonProps}
            rows={rows}
            style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', resize: 'none' }}
          />
        );
      }
      default: return <span className="cell-label">{value}</span>;
    }
  };

  const getUniqueValues = (colKey) => {
    const vals = new Set(rows.map(r => String(r[colKey] ?? '')).filter(v => v !== ''));
    return Array.from(vals).sort();
  };

  const isColFiltered = (colKey) => {
    const filter = columnFilters[colKey];
    if (!filter) return false;
    if (filter instanceof Set) return filter.size > 0;
    if (typeof filter === 'object' && filter.type === 'range') {
      return !!(filter.from || filter.to);
    }
    return false;
  };

  const cellStyle = (col, rowType = 'body') => {
    const w = `${toPixels(columnWidths[col.id] || col.width) || 120}px`;
    const base = { width: w, minWidth: w, maxWidth: w };

    if (isColumnFixed(col)) {
      base['--col-sticky-left'] = `${fixedLeftMap[col.id] ?? 0}px`;
    }

    return base;
  };

  /**
   * CSS classes from API flags: IsFreezeReq → fixed, IsEditAllow → editable, else read-only.
   */
  const cellClass = (col) => getColumnCellClass(col, lastFixedColId);

  const getHeaderThemeClass = (col) => getColumnHeaderThemeClass(col);

  const isDateColumn = (col) => col.controlType === 2 || col.filterType === 'date';

  return (
    <div className={`erp-grid-container erp-grid-container--dense erp-grid-container--fill ${resizing ? 'resizing' : ''}`}>
      <div className="grid-header">
        <h2 className="grid-title">{title}</h2>
      </div>

      {selectedIds.size > 0 && (
        <div className="selection-bar">
          <span>{selectedIds.size} row(s) selected</span>
          <button onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      {showCustomFilter && (
        <div className="custom-filter-panel">
          <div className="custom-filter-header">
            <div className="custom-filter-title">
              <Filter size={16} />
              Custom Filter Builder
            </div>
          </div>
          <div className="custom-filter-body">
            {customFilters.length === 0 && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                No custom filters applied. Click "Add Condition" to create one.
              </div>
            )}
            {customFilters.map((cf, idx) => {
              const col = columns.find(c => c.key === cf.column);
              const ops = operatorsByType[col?.filterType || 'text'] || operatorsByType.text;
              return (
                <div key={cf.id} className="filter-condition">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 20 }}>{idx + 1}.</span>
                  <select className="col-select" value={cf.column} onChange={e => updateCustomFilter(cf.id, 'column', e.target.value)}>
                    {columns.filter(c => c.filterable).map(c => (
                      <option key={c.key} value={c.key}>{c.name}</option>
                    ))}
                  </select>
                  <select className="op-select" value={cf.operator} onChange={e => updateCustomFilter(cf.id, 'operator', e.target.value)}>
                    {ops.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                  {!['empty', 'notempty'].includes(cf.operator) && (
                    col?.filterType === 'select' ? (
                      <select
                        className="val-input"
                        value={cf.value}
                        onChange={e => updateCustomFilter(cf.id, 'value', e.target.value)}
                      >
                        <option value="">-- Select --</option>
                        {(col.dropdownOptions || getUniqueValues(col.key)).map(opt => {
                          const val = typeof opt === 'object' ? opt.value : opt;
                          const label = typeof opt === 'object' ? opt.label : opt;
                          return <option key={val} value={val}>{label}</option>;
                        })}
                      </select>
                    ) : (
                      <input
                        className="val-input"
                        type={col?.filterType === 'date' ? 'date' : col?.filterType === 'number' ? 'number' : 'text'}
                        value={cf.value}
                        onChange={e => updateCustomFilter(cf.id, 'value', e.target.value)}
                        placeholder="Value..."
                      />
                    )
                  )}
                  <button className="filter-remove-btn" onClick={() => removeCustomFilter(cf.id)} title="Remove">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="filter-actions">
            <button onClick={addCustomFilter}>+ Add Condition</button>
            <button className="primary" onClick={applyCustomFilters}>Apply Filters</button>
            <button onClick={() => { setCustomFilters([]); setShowCustomFilter(false); }}>Clear All</button>
          </div>
        </div>
      )}

      <div
        className={`table-wrapper ${scrollState.left ? 'scrolled-left' : ''} ${scrollState.right ? 'scrolled-right' : ''}`}
        ref={tableWrapperRef}
        onScroll={handleScroll}
      >
        <table className="erp-table">
          <thead>
            {/* ── Header row ── */}
            <tr>
              {columns.map(col => (
                <th
                  key={col.id}
                  className={`${cellClass(col) || ''} ${getHeaderThemeClass(col)}`}
                  style={cellStyle(col, 'header')}
                >
                  <div className="header-cell-content">
                    <span
                      className="header-label"
                      onClick={() => col.key !== 'cb' && handleSort(col.key)}
                      style={{ cursor: col.key !== 'cb' ? 'pointer' : 'default' }}
                    >
                      {col.name}
                      {sortConfig.key === col.key && (
                        <span className="sort-icon" title="Sorted">
                          {sortConfig.direction === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </span>
                    {col.filterable && col.key !== 'cb' && (
                      <div className="header-actions">
                        <button
                          className={`filter-icon ${isColFiltered(col.key) ? 'active' : ''}`}
                          onClick={() => toggleColumnFilter(col.key)}
                          title="Column Filter"
                          aria-label={`Filter ${col.name}`}
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                    )}
                    {activeFilterCol === col.key && (
                      <div className="column-filter-popup" ref={popupRef}>
                        <div className="popup-header">Filter: {col.name}</div>

                        {isDateColumn(col) ? (
                          <div className="popup-date-range">
                            <div className="date-field">
                              <label>From</label>
                              <input
                                type="date"
                                value={columnFilters[col.key]?.from || ''}
                                onChange={e => {
                                  const current = columnFilters[col.key] || { type: 'range', from: '', to: '' };
                                  setColumnFilters(prev => ({ ...prev, [col.key]: { ...current, from: e.target.value } }));
                                }}
                              />
                            </div>
                            <div className="date-field">
                              <label>To</label>
                              <input
                                type="date"
                                value={columnFilters[col.key]?.to || ''}
                                onChange={e => {
                                  const current = columnFilters[col.key] || { type: 'range', from: '', to: '' };
                                  setColumnFilters(prev => ({ ...prev, [col.key]: { ...current, to: e.target.value } }));
                                }}
                              />
                            </div>
                            <div className="popup-footer">
                              <button className="popup-btn" onClick={() => clearColumnFilter(col.key)}>Clear</button>
                              <button className="popup-btn primary" onClick={() => setActiveFilterCol(null)}>Close</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="popup-search">
                              <input type="text" placeholder="Search..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} autoFocus />
                            </div>
                            <div className="popup-list">
                              {(() => {
                                const allValues = getUniqueValues(col.key);
                                const filtered = filterSearch
                                  ? allValues.filter(v => getDropdownLabel(col, v).toLowerCase().includes(filterSearch.toLowerCase()))
                                  : allValues;
                                const currentSet = columnFilters[col.key] || new Set();
                                const allSelected = filtered.length > 0 && filtered.every(v => currentSet.has(v));
                                return (
                                  <>
                                    <div className="popup-item" onClick={() => {
                                      const newSet = new Set(currentSet);
                                      if (allSelected) { filtered.forEach(v => newSet.delete(v)); }
                                      else { filtered.forEach(v => newSet.add(v)); }
                                      applyColumnFilter(col.key, newSet);
                                    }}>
                                      <input type="checkbox" checked={allSelected} readOnly />
                                      <label>(Select All)</label>
                                    </div>
                                    {filtered.map(val => (
                                      <div key={val} className="popup-item" onClick={() => {
                                        const newSet = new Set(currentSet);
                                        if (newSet.has(val)) newSet.delete(val);
                                        else newSet.add(val);
                                        applyColumnFilter(col.key, newSet);
                                      }}>
                                        <input type="checkbox" checked={currentSet.has(val)} readOnly />
                                        <label title={getDropdownLabel(col, val)}>{getDropdownLabel(col, val)}</label>
                                      </div>
                                    ))}
                                    {filtered.length === 0 && (
                                      <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>No values found</div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <div className="popup-footer">
                              <button className="popup-btn" onClick={() => clearColumnFilter(col.key)}>Clear</button>
                              <button className="popup-btn primary" onClick={() => setActiveFilterCol(null)}>Close</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, col.id)} />
                </th>
              ))}
            </tr>

            {/* ── Filter row — hidden in entry mode ── */}
            {mode !== 'entry' && (
              <tr className="filter-row">
                {columns.map(col => (
                  <td
                    key={`filter-${col.id}`}
                    className={cellClass(col)}
                    style={cellStyle(col, 'filter')}
                  >
                    {col.key === 'cb' ? (
                      <div className="cell-checkbox">
                        <input
                          type="checkbox"
                          className="row-checkbox"
                          checked={displayRows.length > 0 && displayRows.every(r => selectedIds.has(String(r.id)))}
                          onChange={handleSelectAll}
                          aria-label="Select all visible rows"
                        />
                      </div>
                    ) : col.filterable ? (
                      <input
                        className="filter-input"
                        type={col.filterType === 'date' ? 'date' : col.filterType === 'number' ? 'number' : 'text'}
                        placeholder={`Filter ${col.name}...`}
                        value={headerFilters[col.key] || ''}
                        onChange={e => setHeaderFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Escape') setHeaderFilters(prev => { const n = { ...prev }; delete n[col.key]; return n; }); }}
                      />
                    ) : null}
                  </td>
                ))}
              </tr>
            )}
          </thead>

          <tbody>
            {displayRows.map(row => (
              <tr key={row.id} className={selectedIds.has(String(row.id)) ? 'selected' : ''}>
                {columns.map(col => (
                  <td
                    key={`${row.id}-${col.id}`}
                    className={cellClass(col)}
                    style={cellStyle(col, 'body')}
                    onClick={() => { if (col.key === 'cb') handleSelectRow(row.id); }}
                  >
                    <div className="cell-wrapper" onKeyDown={col.key !== 'cb' ? makeCellKeyDown(row, col) : undefined}>
                      {col.key === 'cb' ? (
                        <div className="cell-checkbox">
                          <input
                            type="checkbox"
                            className="row-checkbox"
                            checked={selectedIds.has(String(row.id))}
                            onChange={() => handleSelectRow(row.id)}
                            onClick={e => e.stopPropagation()}
                            aria-label={`Select row ${row.id}`}
                          />
                        </div>
                      ) : (
                        renderCellControl(row, col)
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {mode === 'entry' ? (
                    <>Click <strong>Add New</strong> in the header panel to add a row.</>
                  ) : (
                    <>
                      No records match the current filters.
                      <br />
                      <button className="toolbar-btn" style={{ marginTop: 12, color: 'var(--text)' }} onClick={handleResetFilters}>Reset Filters</button>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <div className="pagination-left">
          Showing <strong>{processedRows.length > 0 ? startIdx + 1 : 0}</strong> – <strong>{Math.min(startIdx + pageSize, processedRows.length)}</strong> of <strong>{processedRows.length}</strong> records
          {processedRows.length !== rows.length && ` (filtered from ${rows.length})`}
        </div>
        <div className="pagination-right">
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Rows:</span>
          <select className="page-size-select" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
            {pageSizeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          <button className="page-btn" onClick={() => setPage(1)} disabled={safePage <= 1}>«</button>
          <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>‹</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || (p >= safePage - 2 && p <= safePage + 2))
            .map((p, idx, arr) => (
              <React.Fragment key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>}
                <button className={`page-btn ${p === safePage ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              </React.Fragment>
            ))}

          <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>›</button>
          <button className="page-btn" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>»</button>
        </div>
      </div>

      <BottomControlPanel
        selectedCount={selectedIds.size}
        showCustomFilter={showCustomFilter}
        onToggleCustomFilter={() => setShowCustomFilter(v => !v)}
        onResetFilters={handleResetFilters}
        onExportExcel={handleExportExcel}
        onCopy={handleCopySelected}
        onSave={handleSaveSelected}
      />
    </div>
  );
});

export default GridForm;
```

---

### `src/components/grid/EnterpriseGrid.css`
*EnterpriseGrid styles (largest CSS file)*

```css
/* GridForm.css — tokens from App.css :root */

/* ===== GRID CONTAINER ===== */
.erp-grid-container {
 font-family:
  "Inter",
  system-ui,
  -apple-system,
  sans-serif;
 background: var(--surface);
 color: var(--text);
 border-radius: var(--radius-lg);
 box-shadow: var(--shadow-sm);
 display: flex;
 flex-direction: column;
 border: 2px solid var(--primary);
 position: relative;
 z-index: 1;
 overflow: hidden;
}

/* ===== HEADER / TOOLBAR ===== */
.grid-header {
 padding: 12px 16px;
 background: var(--header-gradient);
 color: white;
 border-bottom: 1px solid rgba(255, 255, 255, 0.1);
 position: relative;
 overflow: hidden;
 flex-shrink: 0;
}

.grid-header::after {
 content: "";
 position: absolute;
 top: 0;
 left: 0;
 right: 0;
 height: 1px;
 background: linear-gradient(
  90deg,
  transparent 0%,
  rgba(255, 255, 255, 0.2) 50%,
  transparent 100%
 );
}

.grid-title {
 font-size: 1.1rem;
 font-weight: 700;
 margin: 0;
 text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* ── Tab-bar header (Suppliers | Term And Conditions, etc.) ── */
.grid-tabbar {
 display: flex;
 align-items: center;
 justify-content: space-between;
 flex-wrap: wrap;
 gap: 6px;
 padding-right: 10px;
 background: var(--bg-tint);
 border-bottom: 1px solid var(--border);
 flex-shrink: 0;
}

.grid-tabbar__tabs {
 display: flex;
}

.grid-tab {
 padding: 8px 16px;
 font-size: 0.8rem;
 font-weight: 600;
 font-family: inherit;
 color: var(--text-secondary);
 background: transparent;
 border: none;
 border-bottom: 2px solid transparent;
 cursor: pointer;
 white-space: nowrap;
 transition: all var(--transition);
}

.grid-tab:hover {
 color: var(--primary);
 background: rgba(30, 74, 122, 0.05);
}

.grid-tab--active {
 color: var(--primary);
 border-bottom-color: var(--primary);
 background: var(--surface);
}

.grid-tabbar__controls {
 display: flex;
 align-items: center;
 gap: 10px;
 padding: 4px 0;
}

.grid-tab-content {
 flex: 1;
 min-height: 0;
 overflow: auto;
 padding: 10px;
}

.grid-bottom-panel,
.grid-toolbar-left,
.grid-toolbar-right {
 display: flex;
 align-items: center;
 gap: 10px;
}

.grid-bottom-panel {
 justify-content: space-between;
 padding: 12px 16px;
 background: var(--header-gradient);
 color: white;
 flex-wrap: wrap;
 z-index: 10;
 border-top: 1px solid rgba(255, 255, 255, 0.1);
 position: relative;
 box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
 flex-shrink: 0;
}

.bottom-panel-left,
.bottom-panel-right {
 display: flex;
 align-items: center;
 gap: 10px;
}

.bottom-title {
 font-size: 1.1rem;
 font-weight: 700;
 letter-spacing: -0.02em;
 margin: 0;
 text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* ── Toolbar buttons ── */
.toolbar-btn {
 display: inline-flex;
 align-items: center;
 gap: 8px;
 padding: 8px 16px;
 border: 1px solid rgba(255, 255, 255, 0.2);
 background: rgba(255, 255, 255, 0.08);
 color: white;
 border-radius: var(--radius-sm);
 font-size: 0.85rem;
 font-weight: 600;
 cursor: pointer;
 transition: all var(--transition);
 white-space: nowrap;
 backdrop-filter: blur(4px);
 box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toolbar-btn:hover {
 background: rgba(255, 255, 255, 0.18);
 border-color: rgba(255, 255, 255, 0.35);
 transform: translateY(-2px);
 box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toolbar-btn:active {
 transform: translateY(0);
}

.toolbar-btn.primary {
 background: linear-gradient(
  180deg,
  var(--orange) 0%,
  var(--orange-hover) 100%
 );
 border-color: rgba(255, 255, 255, 0.3);
 box-shadow:
  0 2px 8px rgba(232, 114, 42, 0.3),
  0 1px 3px rgba(0, 0, 0, 0.1);
}

.toolbar-btn.primary:hover {
 background: linear-gradient(180deg, #f0803a 0%, var(--orange) 100%);
 box-shadow:
  0 6px 20px rgba(232, 114, 42, 0.4),
  0 2px 6px rgba(0, 0, 0, 0.1);
 transform: translateY(-2px);
}

.toolbar-btn.danger {
 background: linear-gradient(
  180deg,
  var(--danger) 0%,
  var(--danger-hover) 100%
 );
 border-color: rgba(255, 255, 255, 0.2);
}

.toolbar-btn.danger:hover {
 background: linear-gradient(180deg, #ef4444 0%, var(--danger) 100%);
 box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
}

.toolbar-btn:disabled {
 opacity: 0.4;
 cursor: not-allowed;
 transform: none;
 box-shadow: none;
}

.toolbar-divider {
 width: 1px;
 height: 26px;
 background: rgba(255, 255, 255, 0.2);
 margin: 0 6px;
}

/* ===== TABLE WRAPPER ===== */
.table-wrapper {
 overflow: auto;
 position: relative;
 background: var(--col-base-bg);
 scrollbar-width: thin;
 scrollbar-color: var(--border-dark) transparent;
}

.table-wrapper::-webkit-scrollbar {
 height: 10px;
 width: 10px;
}
.table-wrapper::-webkit-scrollbar-track {
 background: transparent;
}
.table-wrapper::-webkit-scrollbar-thumb {
 background: var(--border-dark);
 border-radius: 5px;
 border: 2px solid transparent;
 background-clip: padding-box;
}
.table-wrapper::-webkit-scrollbar-thumb:hover {
 background: var(--text-muted);
}

/* ===== TABLE ===== */
.erp-table {
 width: max-content;
 min-width: 100%;
 border-collapse: separate;
 border-spacing: 0;
 table-layout: fixed;
 font-size: 0.85rem;
}

/* ===== HEADERS — grey base, then column-type accents ===== */
.erp-table thead th {
 position: sticky;
 top: 0;
 z-index: 20;
 background: var(--col-base-header-bg);
 color: var(--col-base-header-text);
 font-family: "Inter", system-ui, sans-serif;
 font-size: 0.8rem;
 font-weight: 700;
 text-align: left;
 padding: 0;
 border-bottom: 1px solid var(--border);
 border-right: 1px solid var(--border);
 white-space: normal;
 word-wrap: break-word;
 user-select: none;
 min-height: var(--header-height);
 text-transform: uppercase;
 letter-spacing: 0.04em;
 box-shadow: none;
}

.erp-table thead th:last-child {
 border-right: none;
}

/* Fixed / frozen (IsFreezeReq) — navy anchor headers + horizontal stick */
.erp-table thead th.fixed-col,
.filter-row td.fixed-col,
.erp-table tbody td.fixed-col {
 position: -webkit-sticky;
 position: sticky;
 left: var(--col-sticky-left, 0);
}

.erp-table thead th.fixed-col {
 z-index: 30;
 background: var(--col-fixed-bg);
 color: var(--col-fixed-text);
 border-bottom: 2px solid var(--col-fixed-border);
 box-shadow: 2px 0 8px rgba(15, 45, 74, 0.14);
}

.erp-table thead th.fixed-col .header-label {
 color: var(--col-fixed-text);
 font-weight: 700;
}

/* Editable (IsEditAllow) — muted grey tint */
.erp-table thead th.editable-col {
 background: var(--col-editable-bg);
 color: var(--col-editable-text);
 border-bottom: 2px solid var(--col-editable-border);
 font-weight: 600;
}

.erp-table thead th.editable-col .header-label {
 color: var(--col-editable-text);
}

/* Read-only — cool blue tint */
.erp-table thead th.readonly-col {
 background: var(--col-readonly-bg);
 color: var(--col-readonly-text);
 border-bottom: 2px solid var(--col-readonly-border);
}

.erp-table thead th.readonly-col .header-label {
 color: var(--col-readonly-text);
}

/* Header icons — frozen (IsFreezeReq) */
.erp-table thead th.fixed-header .header-actions,
.erp-table thead th.fixed-header .sort-icon,
.erp-table thead th.fixed-header .filter-icon,
.erp-table thead th.fixed-header .header-label {
 color: var(--col-fixed-text);
}

.erp-table thead th.fixed-header .filter-icon:hover {
 background: rgba(255, 255, 255, 0.14);
 color: #fff;
}

.erp-table thead th.fixed-header .filter-icon.active {
 background: rgba(255, 255, 255, 0.22);
 color: #fff;
}

/* Header icons — editable (muted) */
.erp-table thead th.editable-header .header-actions,
.erp-table thead th.editable-header .sort-icon,
.erp-table thead th.editable-header .filter-icon,
.erp-table thead th.editable-header .header-label {
 color: var(--col-editable-text);
}

.erp-table thead th.editable-header .filter-icon:hover {
 background: rgba(92, 100, 112, 0.12);
 color: var(--col-editable-accent);
}

.erp-table thead th.editable-header .filter-icon.active {
 background: rgba(92, 100, 112, 0.18);
 color: var(--col-editable-accent);
}

/* Header icons — read-only (colored) */
.erp-table thead th.readonly-header .header-actions,
.erp-table thead th.readonly-header .sort-icon,
.erp-table thead th.readonly-header .filter-icon,
.erp-table thead th.readonly-header .header-label {
 color: var(--col-readonly-text);
}

.erp-table thead th.readonly-header .filter-icon:hover {
 background: rgba(30, 74, 122, 0.1);
 color: var(--primary);
}

.erp-table thead th.readonly-header .filter-icon.active {
 background: var(--primary-light);
 color: var(--primary);
}

/* Filter row — light neutral strip */
.filter-row td.fixed-col {
 z-index: 25;
 background: var(--col-fixed-filter);
 box-shadow: 2px 0 4px rgba(30, 74, 122, 0.04);
}

.filter-row td.editable-col {
 background: var(--col-editable-filter);
 border-bottom: 1px solid var(--border);
}

.filter-row td.readonly-col {
 background: var(--col-readonly-filter);
 border-bottom: 1px solid var(--border);
}

/* ===== RESIZE HANDLE ===== */
.resize-handle {
 position: absolute;
 right: 0;
 top: 0;
 bottom: 0;
 width: 5px;
 cursor: col-resize;
 background: transparent;
 transition: background 0.2s;
 z-index: 40;
}

.resize-handle:hover,
.erp-grid-container.resizing .resize-handle {
 background: var(--accent);
 box-shadow: -1px 0 4px rgba(59, 130, 246, 0.3);
}

.erp-grid-container.resizing,
.erp-grid-container.resizing * {
 cursor: col-resize !important;
 user-select: none !important;
}

/* ===== FILTER ROW CELLS — grey base, type overrides below ===== */
.filter-row td {
 position: sticky;
 top: var(--header-height);
 z-index: 15;
 padding: 8px 10px;
 border-right: 1px solid var(--border);
 background: var(--col-base-filter);
 box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.filter-input {
 width: 100%;
 padding: 6px 10px;
 border: 1px solid var(--border);
 border-radius: var(--radius-sm);
 font-size: 0.78rem;
 background: var(--surface);
 color: var(--text);
 transition: all var(--transition);
 box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
}

.filter-input:focus {
 outline: none;
 border-color: var(--accent);
 box-shadow:
  0 0 0 3px var(--primary-light),
  inset 0 1px 2px rgba(0, 0, 0, 0.04);
 transform: translateY(-1px);
}

.filter-input:hover {
 border-color: #93c5fd;
}

/* ===== BODY CELLS — grey base, column types layer on top ===== */
.erp-table tbody td {
 padding: 0;
 border-bottom: 1px solid var(--border);
 border-right: 1px solid var(--border);
 background: var(--col-base-bg);
 transition:
  background 0.12s ease,
  box-shadow 0.12s ease;
 vertical-align: top;
 height: auto;
 font-family: "Inter", system-ui, sans-serif;
 font-size: 0.82rem;
 font-weight: 400;
 color: var(--text);
}

.erp-table tbody td:last-child {
 border-right: none;
}

/* Row hover — subtle grey lift on base cells */
.erp-table tbody tr:hover td {
 background: var(--col-base-hover);
}

.erp-table tbody tr.selected td {
 background: var(--col-base-selected);
 box-shadow: inset 0 0 0 1px rgba(30, 74, 122, 0.1);
}

/* Frozen body cells (IsFreezeReq) — uniform base color; type coding lives on the header only */
.erp-table tbody td.fixed-col {
 z-index: 10;
 background: var(--col-base-bg);
}

.erp-table tbody tr:hover td.fixed-col {
 background: var(--col-base-hover);
}

.erp-table tbody tr.selected td.fixed-col {
 background: var(--col-base-selected);
}

.erp-table tbody td.fixed-col .cell-label {
 color: var(--text);
 font-weight: 500;
}

/* Editable (IsEditAllow) — uniform base color; type coding lives on the header only */
.erp-table tbody td.editable-col {
 background: var(--col-base-bg);
}

.erp-table tbody tr:hover td.editable-col {
 background: var(--col-base-hover);
}

.erp-table tbody tr.selected td.editable-col {
 background: var(--col-base-selected);
}

.erp-table tbody td.editable-col .cell-input,
.erp-table tbody td.editable-col .cell-select,
.erp-table tbody td.editable-col .cell-textarea {
 background: var(--col-editable-input-bg);
 border: 1px solid var(--col-editable-input-border);
 color: var(--text-secondary);
}

.erp-table tbody td.editable-col .cell-input:hover,
.erp-table tbody td.editable-col .cell-select:hover,
.erp-table tbody td.editable-col .cell-textarea:hover {
 border-color: #b8bcc4;
 background: #fff;
 color: var(--text);
}

.erp-table tbody td.editable-col .cell-input:focus,
.erp-table tbody td.editable-col .cell-select:focus,
.erp-table tbody td.editable-col .cell-textarea:focus {
 border-color: var(--col-editable-accent);
 box-shadow: 0 0 0 2px rgba(92, 100, 112, 0.16);
 color: var(--text);
 transform: none;
}

.erp-table tbody td.editable-col .search-select__trigger {
 background: var(--col-editable-input-bg) !important;
 border: 1px solid var(--col-editable-input-border) !important;
 color: var(--text-secondary) !important;
}

.erp-table tbody td.editable-col .search-select__trigger:hover,
.erp-table tbody td.editable-col .search-select--open .search-select__trigger {
 border-color: #b8bcc4 !important;
 background: #fff !important;
 color: var(--text) !important;
}

/* Read-only — uniform base color; type coding lives on the header only */
.erp-table tbody td.readonly-col {
 background: var(--col-base-bg);
}

.erp-table tbody tr:hover td.readonly-col {
 background: var(--col-base-hover);
}

.erp-table tbody tr.selected td.readonly-col {
 background: var(--col-base-selected);
}

.erp-table tbody td.readonly-col .cell-label {
 color: var(--text);
 font-weight: 500;
}

/* Last fixed column edge — stronger shadow when scrolled horizontally */
.erp-table th.fixed-col.last-fixed,
.erp-table td.fixed-col.last-fixed {
 border-right: 2px solid var(--border-dark);
}

.table-wrapper.scrolled-left .erp-table th.fixed-col.last-fixed,
.table-wrapper.scrolled-left .erp-table td.fixed-col.last-fixed {
 box-shadow: 4px 0 10px rgba(15, 45, 74, 0.16);
}

/* ===== CELL CONTROLS ===== */
.cell-wrapper {
 padding: 8px 10px;
 min-height: 38px;
 display: flex;
 align-items: center;
 overflow: visible;
}

.cell-label {
 display: block;
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
 color: var(--text);
 font-weight: 500;
}

.cell-input,
.cell-select {
 width: 100%;
 padding: 6px 10px;
 border: 1px solid transparent;
 border-radius: var(--radius-sm);
 background: transparent;
 color: var(--text);
 font-size: 0.82rem;
 font-family: inherit;
 transition:
  border-color 0.12s ease,
  background 0.12s ease,
  box-shadow 0.12s ease;
 resize: none;
}

.cell-input:hover,
.cell-select:hover {
 border-color: var(--border-dark);
 background: var(--surface);
}

.cell-input:focus,
.cell-select:focus {
 outline: none;
 border-color: var(--accent);
 background: var(--surface);
 box-shadow: 0 0 0 2px var(--primary-light);
 transform: none;
}

.cell-select {
 cursor: pointer;
 appearance: none;
 background-image: var(--chevron-svg);
 background-repeat: no-repeat;
 background-position: right 8px center;
 padding-right: 24px;
}

/* ===== TEXTAREA ===== */
.cell-textarea {
 width: 100%;
 padding: 6px 10px;
 border: 1px solid transparent;
 border-radius: var(--radius-sm);
 background: transparent;
 color: var(--text);
 font-size: 0.82rem;
 font-family: inherit;
 transition: all var(--transition);
 resize: none;
 white-space: pre-wrap;
 overflow-wrap: break-word;
 min-height: 30px;
 height: auto;
 line-height: 1.5;
}

.cell-textarea:hover {
 border-color: var(--border-dark);
 background: var(--surface);
}

.cell-textarea:focus {
 outline: none;
 border-color: var(--accent);
 background: var(--surface);
 box-shadow: 0 0 0 2px var(--primary-light);
 transform: none;
}

.erp-table tbody tr {
 height: auto;
}

/* ── Checkbox ── */
.cell-checkbox {
 display: flex;
 align-items: center;
 justify-content: center;
 height: 100%;
}

.row-checkbox {
 width: 18px;
 height: 18px;
 cursor: pointer;
 accent-color: var(--primary);
 border-radius: 4px;
}

/* ===== HEADER CELL CONTENT ===== */
.header-cell-content {
 display: flex;
 align-items: center;
 justify-content: space-between;
 padding: 10px 12px;
 height: 100%;
 gap: 8px;
}

.header-label {
 flex: 1;
 white-space: normal;
 word-wrap: break-word;
 display: inline-block;
 line-height: 1.3;
}

.header-actions {
 display: flex;
 align-items: center;
 gap: 4px;
 opacity: 0.6;
 transition: opacity var(--transition);
}

.erp-table thead th:hover .header-actions {
 opacity: 1;
}

.filter-icon {
 display: inline-flex;
 align-items: center;
 justify-content: center;
 width: 24px;
 height: 24px;
 border-radius: var(--radius-sm);
 cursor: pointer;
 border: none;
 background: transparent;
 transition: all var(--transition);
 padding: 0;
}

.sort-icon {
 display: inline-block;
 vertical-align: middle;
 margin-left: 4px;
 font-size: 0.8em;
}

.filter-icon:hover,
.sort-icon:hover {
 transform: scale(1.1);
}

/* ===== COLUMN FILTER POPUP ===== */
.column-filter-popup {
 position: absolute;
 top: calc(100% + 6px);
 right: 0;
 min-width: 200px;
 max-width: 280px;
 background: var(--surface);
 border: 1px solid var(--border-dark);
 border-radius: var(--radius);
 box-shadow: var(--shadow-xl);
 z-index: 100;
 overflow: hidden;
 animation: popupIn 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes popupIn {
 from {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
 }
 to {
  opacity: 1;
  transform: translateY(0) scale(1);
 }
}

.popup-header {
 padding: 12px 14px;
 border-bottom: 1px solid var(--border);
 font-weight: 700;
 font-size: 0.85rem;
 color: var(--text);
 background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.popup-search {
 padding: 10px 14px;
 border-bottom: 1px solid var(--border);
}

.popup-search input {
 width: 100%;
 padding: 6px 10px;
 border: 1px solid var(--border);
 border-radius: var(--radius-sm);
 font-size: 0.8rem;
 transition: all var(--transition);
}

.popup-search input:focus {
 outline: none;
 border-color: var(--accent);
 box-shadow: 0 0 0 3px var(--primary-light);
}

.popup-list {
 max-height: 240px;
 overflow-y: auto;
 padding: 6px 0;
}

.popup-item {
 display: flex;
 align-items: center;
 gap: 10px;
 padding: 8px 14px;
 cursor: pointer;
 font-size: 0.82rem;
 transition: all var(--transition);
}

.popup-item:hover {
 background: var(--primary-lighter);
 color: var(--primary);
}

.popup-item input[type="checkbox"] {
 width: 16px;
 height: 16px;
 accent-color: var(--primary);
 cursor: pointer;
 flex-shrink: 0;
 border-radius: 4px;
}

.popup-item label {
 cursor: pointer;
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
 flex: 1;
 color: var(--text);
 font-weight: 500;
}

.popup-footer {
 display: flex;
 gap: 8px;
 padding: 12px 14px;
 border-top: 1px solid var(--border);
 background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.popup-btn {
 flex: 1;
 padding: 6px 12px;
 border: 1px solid var(--border-dark);
 background: var(--surface);
 border-radius: var(--radius-sm);
 font-size: 0.78rem;
 font-weight: 600;
 cursor: pointer;
 transition: all var(--transition);
 text-align: center;
}

.popup-btn:hover {
 background: var(--bg);
 transform: translateY(-1px);
 box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.popup-btn.primary {
 background: linear-gradient(
  180deg,
  var(--primary) 0%,
  var(--primary-hover) 100%
 );
 color: white;
 border-color: var(--primary);
 box-shadow: 0 2px 6px rgba(37, 99, 168, 0.2);
}

.popup-btn.primary:hover {
 background: linear-gradient(180deg, var(--primary-hover) 0%, #1d4ed8 100%);
 box-shadow: 0 4px 12px rgba(37, 99, 168, 0.3);
}

/* ===== DATE RANGE POPUP ===== */
.popup-date-range {
 padding: 14px;
 display: flex;
 flex-direction: column;
 gap: 12px;
}

.popup-date-range .date-field {
 display: flex;
 flex-direction: column;
 gap: 6px;
}

.popup-date-range .date-field label {
 font-size: 0.78rem;
 font-weight: 600;
 color: var(--text-secondary);
 text-transform: uppercase;
 letter-spacing: 0.04em;
}

.popup-date-range .date-field input[type="date"] {
 padding: 8px 10px;
 border: 1px solid var(--border);
 border-radius: var(--radius-sm);
 font-size: 0.85rem;
 font-family: inherit;
 color: var(--text);
 background: var(--surface);
 transition: all var(--transition);
}

.popup-date-range .date-field input[type="date"]:focus {
 outline: none;
 border-color: var(--accent);
 box-shadow: 0 0 0 3px var(--primary-light);
}

/* ===== CUSTOM FILTER PANEL ===== */
.custom-filter-panel {
 background: var(--surface);
 border-top: 1px solid var(--border);
 padding: 18px;
 animation: slideUp 250ms cubic-bezier(0.4, 0, 0.2, 1);
 box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04);
 flex-shrink: 0;
}

@keyframes slideUp {
 from {
  opacity: 0;
  transform: translateY(12px);
 }
 to {
  opacity: 1;
  transform: translateY(0);
 }
}

.custom-filter-header {
 display: flex;
 align-items: center;
 justify-content: space-between;
 margin-bottom: 14px;
}

.custom-filter-title {
 font-size: 0.9rem;
 font-weight: 700;
 color: var(--text);
 display: flex;
 align-items: center;
 gap: 8px;
}

.custom-filter-body {
 display: flex;
 flex-direction: column;
 gap: 12px;
}

.filter-condition {
 display: flex;
 align-items: center;
 gap: 10px;
 flex-wrap: wrap;
}

.filter-condition select,
.filter-condition input {
 padding: 8px 12px;
 border: 1px solid var(--border-dark);
 border-radius: var(--radius-sm);
 font-size: 0.82rem;
 background: var(--surface);
 color: var(--text);
 transition: all var(--transition);
}

.filter-condition select:focus,
.filter-condition input:focus {
 outline: none;
 border-color: var(--accent);
 box-shadow: 0 0 0 3px var(--primary-light);
 transform: translateY(-1px);
}

.filter-condition .col-select {
 min-width: 180px;
}
.filter-condition .op-select {
 min-width: 150px;
}
.filter-condition .val-input {
 min-width: 200px;
 flex: 1;
}

.filter-remove-btn {
 width: 32px;
 height: 32px;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 border: none;
 background: transparent;
 color: var(--danger);
 cursor: pointer;
 border-radius: var(--radius-sm);
 transition: all var(--transition);
}

.filter-remove-btn:hover {
 background: #fee2e2;
 transform: scale(1.1);
}

.filter-actions {
 display: flex;
 gap: 10px;
 margin-top: 14px;
 padding-top: 14px;
 border-top: 1px solid var(--border);
}

.filter-actions button {
 padding: 8px 18px;
 border-radius: var(--radius-sm);
 font-size: 0.82rem;
 font-weight: 600;
 cursor: pointer;
 transition: all var(--transition);
 border: 1px solid var(--border-dark);
 background: var(--surface);
}

.filter-actions button:hover {
 background: var(--bg);
 transform: translateY(-1px);
 box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.filter-actions button.primary {
 background: linear-gradient(
  180deg,
  var(--primary) 0%,
  var(--primary-hover) 100%
 );
 color: white;
 border-color: var(--primary);
 box-shadow: 0 2px 8px rgba(37, 99, 168, 0.2);
}

.filter-actions button.primary:hover {
 background: linear-gradient(180deg, var(--primary-hover) 0%, #1d4ed8 100%);
 box-shadow: 0 4px 14px rgba(37, 99, 168, 0.3);
}

/* ===== PAGINATION BAR ===== */
.pagination-bar {
 display: flex;
 align-items: center;
 justify-content: space-between;
 padding: 12px 18px;
 background: linear-gradient(180deg, var(--surface) 0%, #f8fafc 100%);
 border-top: 1px solid var(--border);
 gap: 14px;
 flex-wrap: wrap;
 box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.03);
 flex-shrink: 0;
}

.pagination-left {
 font-size: 0.85rem;
 color: var(--text-secondary);
 font-weight: 500;
}

.pagination-right {
 display: flex;
 align-items: center;
 gap: 8px;
}

.page-btn {
 display: inline-flex;
 align-items: center;
 justify-content: center;
 min-width: 36px;
 height: 36px;
 padding: 0 10px;
 border: 1px solid var(--border);
 background: var(--surface);
 color: var(--text);
 border-radius: var(--radius-sm);
 font-size: 0.85rem;
 font-weight: 600;
 cursor: pointer;
 transition: all var(--transition);
 box-shadow: var(--shadow-sm);
}

.page-btn.active {
 background: linear-gradient(
  180deg,
  var(--orange) 0%,
  var(--orange-hover) 100%
 );
 color: white;
 border-color: var(--orange-hover);
 box-shadow: 0 2px 8px rgba(232, 114, 42, 0.25);
 font-weight: 700;
}

.page-btn:hover:not(:disabled) {
 border-color: var(--primary);
 color: var(--primary);
 background: var(--primary-lighter);
 transform: translateY(-2px);
 box-shadow: 0 4px 10px rgba(37, 99, 168, 0.12);
}

.page-btn:disabled {
 opacity: 0.35;
 cursor: not-allowed;
}

.page-size-select {
 padding: 6px 10px;
 border: 1px solid var(--border);
 border-radius: var(--radius-sm);
 background: var(--surface);
 color: var(--text);
 font-size: 0.85rem;
 cursor: pointer;
 font-weight: 500;
 transition: all var(--transition);
}

.page-size-select:hover {
 border-color: var(--primary);
}

/* ===== SELECTION BAR ===== */
.selection-bar {
 display: flex;
 align-items: center;
 gap: 14px;
 padding: 8px 18px;
 background: linear-gradient(
  90deg,
  var(--primary-light) 0%,
  var(--primary-lighter) 100%
 );
 color: var(--primary);
 font-size: 0.85rem;
 font-weight: 600;
 border-bottom: 1px solid var(--border);
 box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
 flex-shrink: 0;
}

.selection-bar button {
 background: transparent;
 border: none;
 color: var(--primary);
 cursor: pointer;
 font-size: 0.85rem;
 font-weight: 700;
 text-decoration: underline;
 padding: 0;
 transition: all var(--transition);
}

.selection-bar button:hover {
 color: var(--primary-hover);
 transform: translateY(-1px);
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
 .grid-toolbar {
  flex-direction: column;
  align-items: stretch;
 }
 .grid-toolbar-left,
 .grid-toolbar-right {
  justify-content: center;
 }
 .pagination-bar {
  flex-direction: column;
  align-items: center;
 }
 .filter-panel-controls {
  flex-direction: column;
 }
}

/* ===== FOCUS VISIBLE ===== */
*:focus-visible {
 outline: 2px solid var(--accent);
 outline-offset: 2px;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
 outline: 2px solid var(--accent);
 outline-offset: 0;
}

/* ===== DENSE ENTERPRISE MODE ===== */
.erp-grid-container--dense {
 --eg-row-h: var(--grid-row-height, 24px);
 --eg-header-h: var(--header-height, 26px);
 --eg-filter-h: var(--grid-filter-row-height, 24px);
 --header-height: var(--eg-header-h);
 font-size: var(--font-size-sm, 12px);
}

.erp-grid-container--dense .grid-header {
 padding: 6px 12px;
 min-height: 32px;
}

.erp-grid-container--dense .grid-title {
 font-size: 12px;
 font-weight: 700;
 text-transform: uppercase;
 letter-spacing: 0.02em;
}

.erp-grid-container--dense .erp-table {
 font-size: 11px;
}

.erp-grid-container--dense .erp-table thead th {
 font-size: 10px;
 min-height: var(--eg-header-h);
 padding: 0;
 border-bottom: 1px solid var(--border);
 background: var(--col-base-header-bg);
 color: var(--col-base-header-text);
}

/* Preserve column-type header accents in dense mode */
.erp-grid-container--dense .erp-table thead th.fixed-col {
 background: var(--col-fixed-bg);
 color: var(--col-fixed-text);
 border-bottom-color: var(--col-fixed-border);
}

.erp-grid-container--dense .erp-table thead th.editable-col {
 background: var(--col-editable-bg);
 color: var(--col-editable-text);
 border-bottom-color: var(--col-editable-border);
}

.erp-grid-container--dense .erp-table thead th.readonly-col {
 background: var(--col-readonly-bg);
 color: var(--col-readonly-text);
}

.erp-grid-container--dense .filter-row td.fixed-col {
 z-index: 25;
 background: var(--col-fixed-filter);
}

.erp-grid-container--dense .filter-row td.editable-col {
 background: var(--col-editable-filter);
}

.erp-grid-container--dense .filter-row td.readonly-col {
 background: var(--col-readonly-filter);
}

.erp-grid-container--dense .header-cell-content {
 padding: 3px 8px;
 min-height: var(--eg-header-h);
 gap: 4px;
}

.erp-grid-container--dense .header-label {
 line-height: 1.2;
}

.erp-grid-container--dense .filter-row td {
 padding: 2px 6px;
 top: var(--eg-header-h);
 background: var(--col-base-filter);
}

.erp-grid-container--dense .filter-input {
 padding: 2px 6px;
 height: 20px;
 font-size: 11px;
 border-radius: 3px;
}

.erp-grid-container--dense .filter-input:focus {
 transform: none;
 box-shadow: 0 0 0 2px var(--primary-light);
}

.erp-grid-container--dense .erp-table tbody tr {
 height: var(--eg-row-h);
}

.erp-grid-container--dense .erp-table tbody td {
 height: var(--eg-row-h);
 font-size: 11px;
 vertical-align: middle;
}

.erp-grid-container--dense .cell-wrapper {
 padding: 0 6px;
 min-height: var(--eg-row-h);
 max-height: var(--eg-row-h);
}

.erp-grid-container--dense .cell-label {
 font-size: 11px;
 font-weight: 400;
 line-height: 1.2;
}

.erp-grid-container--dense .cell-input,
.erp-grid-container--dense .cell-select {
 padding: 1px 4px;
 font-size: 11px;
 line-height: 1.2;
 min-height: 20px;
 height: 20px;
}

.erp-grid-container--dense .cell-input:focus,
.erp-grid-container--dense .cell-select:focus,
.erp-grid-container--dense .cell-textarea:focus {
 transform: none;
 box-shadow: 0 0 0 2px var(--primary-light);
}

.erp-grid-container--dense .cell-textarea {
 padding: 2px 4px;
 font-size: 11px;
 min-height: 20px;
 line-height: 1.2;
}

.erp-grid-container--dense .row-checkbox {
 width: 14px;
 height: 14px;
}

.erp-grid-container--dense .filter-icon {
 width: 20px;
 height: 20px;
}

.erp-grid-container--dense .selection-bar {
 padding: 3px 12px;
 font-size: 11px;
}

.erp-grid-container--dense .grid-bottom-panel {
 padding: 4px 12px;
 gap: 6px;
}

.erp-grid-container--dense .bottom-panel-left,
.erp-grid-container--dense .bottom-panel-right {
 gap: 6px;
}

.erp-grid-container--dense .toolbar-btn {
 padding: 2px 8px;
 font-size: 11px;
 gap: 4px;
 min-height: 24px;
}

.erp-grid-container--dense .pagination-bar {
 padding: 4px 12px;
 gap: 6px;
 box-shadow: none;
}

.erp-grid-container--dense .pagination-left {
 font-size: 11px;
 line-height: 1.2;
}

.erp-grid-container--dense .pagination-right {
 gap: 4px;
}

.erp-grid-container--dense .page-btn {
 min-width: 24px;
 height: 24px;
 padding: 0 4px;
 font-size: 11px;
}

.erp-grid-container--dense .page-size-select {
 padding: 1px 6px;
 font-size: 11px;
 height: 24px;
}

.erp-grid-container--dense .table-wrapper::-webkit-scrollbar {
 width: 6px;
 height: 6px;
}

.erp-grid-container--dense .search-select--compact .search-select__trigger {
 min-height: 20px;
 height: 20px;
 padding: 0 6px;
 font-size: 11px;
}

.erp-grid-container--dense .search-select--compact .search-select__value {
 line-height: 20px;
 font-size: 11px;
}

/* ===== FILL VIEWPORT — table flexes to window, footer pinned at bottom ===== */
.erp-grid-container--fill {
 flex: 1;
 min-height: 0;
 height: 100%;
 display: flex;
 flex-direction: column;
 overflow: hidden;
 border: 2px solid var(--primary);
 border-radius: var(--radius-lg);
 background: var(--surface);
 box-shadow: 0 2px 8px rgba(30, 74, 122, 0.08);
}

.erp-grid-container--fill .table-wrapper {
 flex: 1 1 auto;
 min-height: 0;
 overflow: auto;
 max-height: none;
 height: auto;
}

.erp-grid-container--fill .grid-header,
.erp-grid-container--fill .selection-bar,
.erp-grid-container--fill .custom-filter-panel,
.erp-grid-container--fill .pagination-bar,
.erp-grid-container--fill .grid-bottom-panel {
 flex-shrink: 0;
}

/* Workspace: grid stretches to remaining viewport below filters */
.workspace-page__grid > .erp-grid-container--fill {
 flex: 1;
 min-height: 0;
 height: 100%;
 width: 100%;
}

/* ===== FIXED ROW VIEWPORT — modal / embedded pickers only ===== */
.erp-grid-container--scroll-body {
 flex: none;
 height: auto;
 max-height: none;
 display: flex;
 flex-direction: column;
 overflow: hidden;
 border: 1px solid var(--border);
 border-radius: var(--radius-lg);
 background: var(--surface);
 box-shadow: var(--shadow-sm);
}

.erp-grid-container--dense.erp-grid-container--scroll-body {
 --eg-scroll-body-h: calc(
  var(--grid-thead-rows, 1) * var(--eg-header-h, 26px) +
   var(--grid-visible-rows, 18) * var(--eg-row-h, 24px)
 );
}

.erp-grid-container--scroll-body.erp-grid-container--with-filter-row {
 --grid-thead-rows: 2;
}

.erp-grid-container--scroll-body .table-wrapper {
 flex: none;
 height: var(--eg-scroll-body-h);
 max-height: var(--eg-scroll-body-h);
 min-height: var(--eg-scroll-body-h);
 overflow: auto;
}

.erp-grid-container--scroll-body .grid-header,
.erp-grid-container--scroll-body .selection-bar,
.erp-grid-container--scroll-body .custom-filter-panel,
.erp-grid-container--scroll-body .grid-bottom-panel,
.erp-grid-container--scroll-body .pagination-bar {
 flex-shrink: 0;
}

/* ── Collapsible children (EntryGrid inline sub-table) ── */
.cell-checkbox {
 display: flex;
 align-items: center;
 justify-content: center;
 gap: 3px;
}

.eg-expand-toggle {
 display: inline-flex;
 align-items: center;
 justify-content: center;
 width: 16px;
 height: 16px;
 padding: 0;
 border: 1px solid var(--border);
 border-radius: 3px;
 background: var(--surface);
 color: var(--primary);
 cursor: pointer;
 flex-shrink: 0;
 transition:
  background var(--transition),
  color var(--transition);
}

.eg-expand-toggle:hover {
 background: var(--primary-lighter);
 border-color: var(--primary-light);
}

.eg-expand-toggle[aria-expanded="true"] {
 background: var(--primary-lighter);
 color: var(--primary);
 border-color: var(--primary-light);
}

/* Row that holds the InlineChildTable — no hover highlight, no selection colour */
.eg-child-row {
 background: transparent !important;
}

.eg-child-row:hover {
 background: transparent !important;
}

.eg-child-cell {
 padding: 0 !important;
 border-bottom: 1px solid var(--border);
}
```

---

### `src/components/grid/EntryGrid.jsx`
*Ref-forwarded entry grid with add/remove/get API*

```jsx
// TxnEntryGridForm.jsx
// ─────────────────────────────────────────────────────────────────────
// Dedicated data-entry grid for TxnEntryForm.
// Supports two modes:
//   mode="entry" (default / readOnly=false):
//     • Cells are editable (text, date, dropdown, textarea)
//     • Cell-event hooks fire on Tab for configured EVENT_COLUMNS
//     • Bottom panel: Export, Copy, Save
//     • Rows added imperatively via ref.addRow(blankRow)
//
//   mode="read" (readOnly=true):
//     • All cells render as plain labels — no editing
//     • No cell-event hooks, no bottom panel
//     • Checkbox selection still works (for picking rows)
//     • Accepts initialRows to pre-populate the grid
//
// EVENT_COLUMNS — the ColNames that trigger onCellEvent when the user
// presses Tab.  Update this set if the stored procedure changes.

import React, {
  useState, useMemo, useCallback, useRef, useEffect,
  useImperativeHandle, forwardRef,
} from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import SearchSelect from '../ui/SearchSelect';
import TxnEntryBottomPanel from './EntryGridBottomPanel';
import InlineChildTable from './InlineChildTable';
import './EnterpriseGrid.css';
import { isColumnFixed, getColumnCellClass, getColumnHeaderThemeClass } from './gridColumnClass';

// ── Helper utils ───────────────────────────────────────────────────────
function toPixels(w) {
  if (typeof w === 'number') return w;
  if (typeof w === 'string') return parseInt(w, 10) || 0;
  return 0;
}

function formatDateForInput(isoString) {
  if (!isoString) return '';
  if (typeof isoString === 'string' && isoString.includes('T')) {
    return isoString.split('T')[0];
  }
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function parseDateFromInput(dateString) {
  if (!dateString) return '';
  return `${dateString}T00:00:00`;
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ── Columns that fire onCellEvent when user presses Tab ───────────────
// These match the ColName values returned by GET_DETAIL_COL_DATA.
const EVENT_COLUMNS = new Set([
  'ItemID', 'TranQty', 'BaseQty', 'BaseRate', 'TranRate',
  'DiscPerc', 'Expense', 'GSTPerc',
]);

// ── Component ─────────────────────────────────────────────────────────
const TxnEntryGridForm = forwardRef(function TxnEntryGridForm(
  {
    config,
    title = 'Invoice Line Items',
    onSave,
    onCellEvent,
    eventColumns: eventColumnsProp = null,
    readOnly = false,       // true → read-only display mode (no editing)
    hideBottomPanel = false, // true → hide the Save/Export bottom toolbar (embedded grids)
    emptyMessage = null,     // custom message shown when there are no rows
    tabs = null,             // [{ id, label }] → renders a tab-bar header instead of the title
    activeTab = null,        // currently selected tab id (controlled by parent)
    onTabChange = null,      // (tabId: string) => void
    headerControls = null,   // ReactNode rendered on the right side of the tab bar
    tabContentOverride = null, // ReactNode → replaces the grid body (used for other tabs)
    initialRows = null,     // array → pre-populated rows (used in readOnly mode)
    onSelectionChange = null, // (count: number) => void — notifies parent of selection changes
    // ── Collapsible children ─────────────────────────────────────────
    // When enableCollapsible=true each parent row that has an entry in
    // childRowsMap shows an expand toggle.  childColumns drives the sub-table.
    enableCollapsible = false,
    childRowsMap = null,   // { [rowId: string]: rowData[] }
    childColumns = [],     // column defs for the inline sub-table
  },
  ref,
) {
  const { columns, pagination } = config;
  const { pageSize: defaultPageSize = 25, pageSizeOptions = [10, 25, 50, 100] } = pagination || {};

  const [rows, setRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const [columnWidths, setColumnWidths] = useState(() => {
    const map = {};
    columns.forEach(c => { map[c.id] = c.width; });
    return map;
  });
  const [resizing, setResizing] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleExpand = useCallback((id) => {
    const sid = String(id);
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  }, []);

  // Always-current snapshot of rows for Tab-key event closures
  const rowsRef = useRef([]);
  const tableWrapperRef = useRef(null);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Load initialRows when provided (readOnly mode)
  useEffect(() => {
    if (initialRows && Array.isArray(initialRows) && initialRows.length > 0) {
      // Always use index-based id to guarantee uniqueness regardless of what
      // fields the API response contains (e.g. ItemID=0 on every row would
      // cause all rows to share the same id and appear selected together).
      const withIds = initialRows.map((r, i) => ({ ...r, id: `_row_${i}` }));
      setRows(withIds);
    }
  }, [initialRows]);

  // ── Imperative handle ─────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    addRow(blankRow) { setRows(prev => [...prev, blankRow]); },
    getRows() { return rowsRef.current; },
    getSelectedRows() {
      return rowsRef.current.filter(r => selectedIds.has(String(r.id)));
    },
    updateRow(rowId, fields) {
      setRows(prev =>
        prev.map(r => String(r.id) === String(rowId) ? { ...r, ...fields } : r)
      );
    },
    removeRows(rowIds) {
      const removeSet = new Set(rowIds.map(String));
      setRows(prev => prev.filter(r => !removeSet.has(String(r.id))));
      setSelectedIds(prev => {
        const next = new Set(prev);
        rowIds.forEach((id) => next.delete(String(id)));
        return next;
      });
    },
    clearRows() {
      setRows([]);
      setSelectedIds(new Set());
      setExpandedRows(new Set());
    },
  }), [selectedIds]);

  // Notify parent when selection changes
  useEffect(() => {
    onSelectionChange?.(selectedIds.size);
  }, [selectedIds, onSelectionChange]);

  // ── Column resize ─────────────────────────────────────────────────
  const handleResizeStart = useCallback((e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = toPixels(columnWidths[colId] || columns.find(c => c.id === colId)?.width || 120);
    setResizing({ colId, startX: e.clientX, startWidth });
  }, [columnWidths, columns]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e) => {
      const diff = e.clientX - resizing.startX;
      setColumnWidths(prev => ({ ...prev, [resizing.colId]: Math.max(60, resizing.startWidth + diff) }));
    };
    const handleUp = () => setResizing(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  // ── Fixed column offsets ──────────────────────────────────────────
  const fixedLeftMap = useMemo(() => {
    const map = {};
    let left = 0;
    columns.forEach(col => {
      if (isColumnFixed(col)) {
        map[col.id] = left;
        left += toPixels(columnWidths[col.id] || col.width) || 120;
      }
    });
    return map;
  }, [columns, columnWidths]);

  const lastFixedColId = useMemo(() => {
    const fixed = columns.filter(c => isColumnFixed(c));
    return fixed.length > 0 ? fixed[fixed.length - 1].id : null;
  }, [columns]);

  // ── Dropdown label helper ─────────────────────────────────────────
  const getDropdownLabel = useCallback((col, rawValue) => {
    if (col.controlType !== 4 || !col.dropdownOptions) return rawValue;
    const opts = col.dropdownOptions.map(opt => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      if (opt && typeof opt === 'object') {
        if (opt.value !== undefined) return { value: String(opt.value), label: opt.label || String(opt.value) };
        return { value: String(opt.IDNumber ?? opt), label: opt.Name ?? String(opt) };
      }
      return { value: String(opt), label: String(opt) };
    });
    const found = opts.find(o => String(o.value) === String(rawValue));
    return found ? found.label : rawValue;
  }, []);

  // ── Sort ──────────────────────────────────────────────────────────
  const processedRows = useMemo(() => {
    let data = [...rows];
    if (sortConfig.key) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? '';
        const bVal = b[sortConfig.key] ?? '';
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        let cmp = 0;
        if (!isNaN(aNum) && !isNaN(bNum) && aVal !== '' && bVal !== '') {
          cmp = aNum - bNum;
        } else {
          cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        }
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [rows, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const displayRows = processedRows.slice(startIdx, startIdx + pageSize);

  useEffect(() => { setPage(1); }, [pageSize, sortConfig]);

  // ── Selection ─────────────────────────────────────────────────────
  const handleSelectAll = useCallback(() => {
    const pageIds = displayRows.map(r => String(r.id));
    if (pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageIds));
    }
  }, [selectedIds, displayRows]);

  const handleSelectRow = useCallback((id) => {
    const sid = String(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  }, []);

  // ── Cell change ───────────────────────────────────────────────────
  const handleCellChange = useCallback((rowId, colKey, value) => {
    setRows(prev => prev.map(r => String(r.id) === String(rowId) ? { ...r, [colKey]: value } : r));
  }, []);

  // ── Sort handler ──────────────────────────────────────────────────
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // ── Bottom panel actions ──────────────────────────────────────────
  const handleSave = useCallback(() => {
    // onSave is called without arguments — the parent reads rows
    // via gridRef.getRows() so ALL rows are saved (not just selected).
    if (onSave) onSave();
  }, [onSave]);

  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0) return;
    const toCopy = rows.filter(r => selectedIds.has(String(r.id)));
    let currentMinId = 0;
    rows.forEach(r => {
      const n = Number(r.IDNumber);
      if (n < currentMinId) currentMinId = n;
    });
    const newRows = toCopy.map((r, idx) => {
      const newId = currentMinId - (idx + 1);
      return { ...r, id: newId, IDNumber: newId };
    });
    setRows(prev => {
      const next = [...prev];
      for (let i = toCopy.length - 1; i >= 0; i--) {
        const idx = next.findIndex(r => String(r.id) === String(toCopy[i].id));
        if (idx !== -1) next.splice(idx + 1, 0, newRows[i]);
        else next.push(newRows[i]);
      }
      return next;
    });
    setSelectedIds(new Set());
  }, [selectedIds, rows]);

  const handleExport = useCallback(() => {
    const headers = columns.map(c => c.name).join(',');
    const csvRows = processedRows.map(r =>
      columns.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    downloadCSV(`${title.replace(/\s+/g, '_')}_export.csv`, [headers, ...csvRows].join('\n'));
  }, [processedRows, columns, title]);

  const eventColumnSet = useMemo(
    () => (eventColumnsProp instanceof Set ? eventColumnsProp : new Set(eventColumnsProp || [])),
    [eventColumnsProp],
  );

  const activeEventColumns = useMemo(() => {
    if (eventColumnSet.size > 0) return eventColumnSet;
    return EVENT_COLUMNS;
  }, [eventColumnSet]);

  const makeCellKeyDown = useCallback((row, col) => {
    if (!onCellEvent || !activeEventColumns.has(col.key)) return undefined;
    return (e) => {
      if (e.key === 'Tab') {
        const currentRow = rowsRef.current.find(r => String(r.id) === String(row.id)) || row;
        const liveValue =
          e.target && (col.controlType === 1 || col.controlType === 2)
            ? e.target.value
            : currentRow[col.key];
        onCellEvent({
          rowId: row.id,
          colKey: col.key,
          rowData: { ...currentRow, [col.key]: liveValue },
        });
      }
    };
  }, [onCellEvent, activeEventColumns]);

  // ── Cell renderer ─────────────────────────────────────────────────
  const renderCell = (row, col) => {
    const value = row[col.key] ?? '';

    // ── Read-only mode: always render as label ──
    if (readOnly) {
      if (col.controlType === 4) {
        // Show the display label for dropdown values
        return <span className="cell-label" title={String(getDropdownLabel(col, value))}>{getDropdownLabel(col, value)}</span>;
      }
      if (col.controlType === 2) {
        return <span className="cell-label" title={formatDateForInput(value)}>{formatDateForInput(value) || '—'}</span>;
      }
      return <span className="cell-label" title={String(value)}>{value === '' || value == null ? '—' : value}</span>;
    }

    // ── Editable mode ──
    const commonProps = {
      value,
      onChange: (e) => handleCellChange(row.id, col.key, e.target.value),
      tabIndex: 0,
      'aria-label': `${col.name} for row ${row.id}`,
    };

    switch (col.controlType) {
      case 0: return <span className="cell-label" title={String(value)}>{value}</span>;

      case 1: return (
        <input className="cell-input" type="text" {...commonProps} />
      );

      case 2: return (
        <input
          className="cell-input"
          type="date"
          {...commonProps}
          value={formatDateForInput(value)}
          onChange={(e) => handleCellChange(row.id, col.key, parseDateFromInput(e.target.value))}
        />
      );

      case 4: {
        const opts = (col.dropdownOptions || []).map(opt => {
          if (typeof opt === 'string') return { value: opt, label: opt };
          if (opt.value !== undefined) return opt;
          return { value: String(opt.IDNumber ?? opt), label: opt.Name ?? String(opt) };
        });
        return (
          <SearchSelect
            value={String(value)}
            onChange={(val) => handleCellChange(row.id, col.key, val)}
            options={opts}
            placeholder="-- Select --"
            compact
            ariaLabel={`${col.name} for row ${row.id}`}
          />
        );
      }

      case 9: {
        const text = String(value ?? '');
        const lineCount = (text.match(/\n/g) || []).length + 1;
        return (
          <textarea
            className="cell-textarea"
            {...commonProps}
            rows={Math.max(1, Math.min(lineCount, 6))}
          />
        );
      }

      default: return <span className="cell-label">{value}</span>;
    }
  };

  // ── Cell style helpers ────────────────────────────────────────────
  const cellStyle = (col, rowType = 'body') => {
    const w = `${toPixels(columnWidths[col.id] || col.width) || 120}px`;
    const base = { width: w, minWidth: w, maxWidth: w };
    if (isColumnFixed(col)) {
      base['--col-sticky-left'] = `${fixedLeftMap[col.id] ?? 0}px`;
    }
    return base;
  };

  const cellClass = (col) => getColumnCellClass(col, lastFixedColId);

  const getHeaderThemeClass = (col) => getColumnHeaderThemeClass(col);

  const handleScroll = useCallback((e) => {
    const el = e.target;
    setScrollState({
      left: el.scrollLeft > 5,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 5,
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className={`erp-grid-container erp-grid-container--dense erp-grid-container--fill ${resizing ? 'resizing' : ''}`}>

      {tabs && tabs.length > 0 ? (
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`grid-tab ${activeTab === t.id ? 'grid-tab--active' : ''}`}
                onClick={() => onTabChange?.(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {headerControls ? (
            <div className="grid-tabbar__controls">{headerControls}</div>
          ) : null}
        </div>
      ) : title ? (
        <div className="grid-header">
          <h2 className="grid-title">{title}</h2>
        </div>
      ) : null}

      {tabContentOverride ? (
        <div className="grid-tab-content">{tabContentOverride}</div>
      ) : (
      <>
      {selectedIds.size > 0 && (
        <div className="selection-bar">
          <span>{selectedIds.size} row(s) selected</span>
          <button type="button" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      <div
        className={`table-wrapper ${scrollState.left ? 'scrolled-left' : ''} ${scrollState.right ? 'scrolled-right' : ''}`}
        ref={tableWrapperRef}
        onScroll={handleScroll}
      >
        <table className="erp-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.id}
                  className={`${cellClass(col) || ''} ${getHeaderThemeClass(col)}`}
                  style={cellStyle(col, 'header')}
                >
                  {col.key === 'cb' ? (
                    <div className="header-cell-content" style={{ justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        title="Select / deselect all visible rows"
                        aria-label="Select all rows"
                        checked={
                          displayRows.length > 0 &&
                          displayRows.every(r => selectedIds.has(String(r.id)))
                        }
                        onChange={handleSelectAll}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <div className="header-cell-content">
                      <span
                        className="header-label"
                        onClick={() => handleSort(col.key)}
                        style={{ cursor: 'pointer' }}
                      >
                        {col.name}
                        {sortConfig.key === col.key && (
                          <span className="sort-icon">
                            {sortConfig.direction === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, col.id)} />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {displayRows.map(row => {
              const rowId = String(row.id);
              const hasChildren = enableCollapsible && childRowsMap && (childRowsMap[rowId]?.length > 0);
              const isExpanded = hasChildren && expandedRows.has(rowId);
              return (
                <React.Fragment key={row.id}>
                  <tr className={selectedIds.has(rowId) ? 'selected' : ''}>
                    {columns.map(col => (
                      <td
                        key={`${row.id}-${col.id}`}
                        className={cellClass(col)}
                        style={cellStyle(col, 'body')}
                        onClick={() => { if (col.key === 'cb') handleSelectRow(row.id); }}
                      >
                        <div
                          className="cell-wrapper"
                          onKeyDown={(!readOnly && col.key !== 'cb') ? makeCellKeyDown(row, col) : undefined}
                        >
                          {col.key === 'cb' ? (
                            <div className="cell-checkbox">
                              {hasChildren && (
                                <button
                                  type="button"
                                  className="eg-expand-toggle"
                                  onClick={(e) => { e.stopPropagation(); toggleExpand(row.id); }}
                                  title={isExpanded ? 'Collapse indent details' : 'Expand indent details'}
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded
                                    ? <ChevronDown  size={11} strokeWidth={2.5} />
                                    : <ChevronRight size={11} strokeWidth={2.5} />}
                                </button>
                              )}
                              <input
                                type="checkbox"
                                className="row-checkbox"
                                checked={selectedIds.has(rowId)}
                                onChange={() => handleSelectRow(row.id)}
                                onClick={e => e.stopPropagation()}
                                aria-label={`Select row ${row.id}`}
                              />
                            </div>
                          ) : (
                            renderCell(row, col)
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {isExpanded && (
                    <tr className="eg-child-row">
                      <td colSpan={columns.length} className="eg-child-cell">
                        <InlineChildTable
                          columns={childColumns.filter(c => c.key !== 'cb')}
                          rows={childRowsMap[rowId]}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {displayRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {emptyMessage ?? (readOnly
                    ? 'No data available.'
                    : <>Click <strong>Add New</strong> in the header panel to add a row.</>)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <div className="pagination-left">
          Showing <strong>{processedRows.length > 0 ? startIdx + 1 : 0}</strong> – <strong>{Math.min(startIdx + pageSize, processedRows.length)}</strong> of <strong>{processedRows.length}</strong> records
        </div>
        <div className="pagination-right">
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Rows:</span>
          <select className="page-size-select" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
            {pageSizeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <button type="button" className="page-btn" onClick={() => setPage(1)} disabled={safePage <= 1}>«</button>
          <button type="button" className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || (p >= safePage - 2 && p <= safePage + 2))
            .map((p, idx, arr) => (
              <React.Fragment key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>…</span>}
                <button
                  type="button"
                  className={`page-btn ${p === safePage ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >{p}</button>
              </React.Fragment>
            ))}
          <button type="button" className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>›</button>
          <button type="button" className="page-btn" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>»</button>
        </div>
      </div>

      {/* Bottom toolbar — hidden in readOnly / embedded mode */}
      {!readOnly && !hideBottomPanel && (
        <TxnEntryBottomPanel
          selectedCount={selectedIds.size}
          onExportExcel={handleExport}
          onCopy={handleCopy}
          onSave={handleSave}
        />
      )}
      </>
      )}

    </div>
  );
});

export default TxnEntryGridForm;
```

---

### `src/components/grid/EntryGridBottomPanel.jsx`
*Bottom panel for EntryGrid (row count, page nav)*

```jsx
// Bottom toolbar for EntryGrid — matches EnterpriseGrid / GridBottomPanel styling.

import React from 'react';
import { Download, Copy, Save } from 'lucide-react';

export default function TxnEntryBottomPanel({
  selectedCount,
  onExportExcel,
  onCopy,
  onSave,
}) {
  return (
    <div className="grid-bottom-panel">
      <div className="bottom-panel-left">
        <button
          type="button"
          className="toolbar-btn"
          onClick={onExportExcel}
          title="Export to Excel"
        >
          <Download size={12} strokeWidth={2} />
          Export Excel
        </button>

        <button
          type="button"
          className="toolbar-btn"
          onClick={onCopy}
          disabled={selectedCount === 0}
          title="Copy Selected"
        >
          <Copy size={12} strokeWidth={2} />
          Copy ({selectedCount})
        </button>

        <button
          type="button"
          className="toolbar-btn primary"
          onClick={onSave}
          disabled={selectedCount === 0}
          title="Save Selected"
        >
          <Save size={12} strokeWidth={2} />
          Save ({selectedCount})
        </button>
      </div>
    </div>
  );
}
```

---

### `src/components/grid/GridBottomPanel.jsx`
*Bottom panel for generic grids*

```jsx
import React from 'react';
import { Download, Copy, Save, Filter, RotateCcw } from 'lucide-react';
import './EnterpriseGrid.css';

export default function BottomControlPanel({
  selectedCount,
  showCustomFilter,
  onToggleCustomFilter,
  onResetFilters,
  onExportExcel,
  onCopy,
  onSave,
}) {
  return (
    <div className="grid-bottom-panel">
      <div className="bottom-panel-left">
        <button className="toolbar-btn" onClick={onExportExcel} title="Export to Excel">
          <Download size={12} strokeWidth={2} />
          Export Excel
        </button>
        <button className="toolbar-btn" onClick={onCopy} disabled={selectedCount === 0} title="Copy Selected">
          <Copy size={12} strokeWidth={2} />
          Copy ({selectedCount})
        </button>
        <button className="toolbar-btn primary" onClick={onSave} disabled={selectedCount === 0} title="Save Selected">
          <Save size={12} strokeWidth={2} />
          Save ({selectedCount})
        </button>
      </div>
      <div className="bottom-panel-right">
        <button className="toolbar-btn" onClick={onToggleCustomFilter} title="Custom Filter">
          <Filter size={12} strokeWidth={2} />
          {showCustomFilter ? 'Hide Filter' : 'Create Filter'}
        </button>
        <button className="toolbar-btn" onClick={onResetFilters} title="Reset All Filters">
          <RotateCcw size={12} strokeWidth={2} />
          Reset
        </button>
      </div>
    </div>
  );
}
```

---

### `src/components/grid/CollapsibleGrid.jsx`
*Expandable parent/child row grid (indent details)*

```jsx
// CollapsibleGrid.jsx
// Generic collapsible table grid — shared across any page that needs
// an expandable/collapsible data section (e.g. Levy Details, Indent Details).
//
// Props:
//   title    {string}  — main heading (e.g. "Levy Details")
//   subtitle {string}  — italic sub-label (e.g. "(Collapsible Grid Of Item Grid)")
//   columns  {Array}   — [{ key, label, width? }]
//   rows     {Array}   — data rows; each row must have a field per column key
//   defaultExpanded {boolean} — whether to start open (default false)

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './CollapsibleGrid.css';

export default function CollapsibleGrid({
  title = 'Details',
  subtitle = '',
  columns = [],
  rows = [],
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="cg-panel">
      <button
        type="button"
        className="cg-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="cg-header__chevron">
          {expanded
            ? <ChevronDown  size={13} strokeWidth={2.5} />
            : <ChevronRight size={13} strokeWidth={2.5} />}
        </span>
        <span className="cg-header__title">{title}</span>
        {subtitle && <span className="cg-header__sub">{subtitle}</span>}
        <span className="cg-header__badge">{rows.length}</span>
      </button>

      {expanded && (
        <div className="cg-body">
          <div className="cg-grid-wrap">
            <table className="cg-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} style={col.width ? { minWidth: col.width } : undefined}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="cg-empty">
                      No data available.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={row.id ?? idx}>
                      {columns.map((col) => (
                        <td key={col.key}>{row[col.key] ?? '—'}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### `src/components/grid/CollapsibleGrid.css`
*CollapsibleGrid styles*

```css
/* CollapsibleGrid.css — shared collapsible table panel */

/* ── Panel shell ── */
.cg-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  flex-shrink: 0;
}

/* ── Header button ── */
.cg-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  background: var(--bg-tint);
  border: none;
  border-bottom: 1px solid transparent;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background var(--transition);
}

.cg-header:hover { background: var(--primary-lighter); }

.cg-header[aria-expanded="true"] { border-bottom-color: var(--border); }

.cg-header__chevron {
  display: flex;
  align-items: center;
  color: var(--primary);
  flex-shrink: 0;
}

.cg-header__title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--primary);
}

.cg-header__sub {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
}

.cg-header__badge {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg);
  padding: 1px 8px;
  border-radius: 10px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

/* ── Expanded body ── */
.cg-body { padding: 10px; }

.cg-grid-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

/* ── Table ── */
.cg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.cg-table thead tr { background: var(--col-base-header-bg); }

.cg-table th {
  padding: 6px 11px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--col-base-header-text);
  text-align: left;
  border-right: 1px solid var(--border);
  white-space: nowrap;
  user-select: none;
}

.cg-table th:last-child { border-right: none; }

.cg-table td {
  padding: 5px 11px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

.cg-table td:last-child { border-right: none; }

.cg-table tbody tr:last-child td { border-bottom: none; }

.cg-table tbody tr:hover { background: var(--bg-tint); }

.cg-empty {
  text-align: center;
  padding: 18px;
  color: var(--text-muted);
  font-style: italic;
  font-size: 0.8rem;
}
```

---

### `src/components/grid/InlineChildTable.jsx`
*Inline sub-table inside a parent row*

```jsx
// InlineChildTable.jsx
// Compact read-only sub-table rendered inline below a parent row in EntryGrid
// when the collapsible feature is enabled (enableCollapsible prop).
//
// Columns accept either EntryGrid format { key, name, width } or simple
// { key, label, width } — whichever field exists is used as the header text.

import React from 'react';
import './InlineChildTable.css';

export default function InlineChildTable({ columns = [], rows = [] }) {
  return (
    <div className="ict-wrap">
      <div className="ict-indent-marker" aria-hidden="true" />
      <div className="ict-content">
        <div className="ict-header-row">
          <span className="ict-badge">{rows.length} indent record{rows.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="ict-scroll">
          <table className="ict-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={col.width ? { minWidth: col.width } : undefined}>
                    {col.name ?? col.label ?? col.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="ict-empty">
                    No child records.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id ?? idx}>
                    {columns.map((col) => (
                      <td key={col.key}>{row[col.key] ?? '—'}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

---

### `src/components/grid/InlineChildTable.css`
*InlineChildTable styles*

```css
/* InlineChildTable.css
   Inline child sub-table rendered inside a collapsible row of EntryGrid.
   Uses the same design tokens as EnterpriseGrid.css.                     */

/* ── Outer wrapper (full-width td content) ── */
.ict-wrap {
  display: flex;
  align-items: stretch;
  background: var(--primary-lighter, #eef2ff);
  border-top: 1px solid var(--primary-light, #c7d2fe);
  border-bottom: 1px solid var(--primary-light, #c7d2fe);
}

/* ── Left accent stripe ── */
.ict-indent-marker {
  width: 3px;
  flex-shrink: 0;
  background: var(--primary, #4f46e5);
  border-radius: 0 2px 2px 0;
  margin: 6px 0 6px 10px;
}

/* ── Right side: badge + table ── */
.ict-content {
  flex: 1;
  padding: 6px 12px 8px 10px;
  min-width: 0;
}

/* ── Row count badge ── */
.ict-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.ict-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--primary, #4f46e5);
  background: var(--surface, #fff);
  border: 1px solid var(--primary-light, #c7d2fe);
  border-radius: 10px;
  padding: 1px 8px;
  letter-spacing: 0.01em;
}

/* ── Scroll container ── */
.ict-scroll {
  overflow-x: auto;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: var(--radius, 5px);
  background: var(--surface, #fff);
}

/* ── Table ── */
.ict-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.77rem;
}

.ict-table thead tr {
  background: var(--col-base-header-bg, #f1f5f9);
}

.ict-table th {
  padding: 5px 10px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--col-base-header-text, #475569);
  text-align: left;
  border-right: 1px solid var(--border, #e2e8f0);
  white-space: nowrap;
  user-select: none;
}

.ict-table th:last-child { border-right: none; }

.ict-table td {
  padding: 4px 10px;
  color: var(--text, #1e293b);
  border-bottom: 1px solid var(--border, #e2e8f0);
  border-right: 1px solid var(--border, #e2e8f0);
  white-space: nowrap;
}

.ict-table td:last-child { border-right: none; }

.ict-table tbody tr:last-child td { border-bottom: none; }

.ict-table tbody tr:hover { background: var(--bg-tint, #f8fafc); }

.ict-empty {
  text-align: center;
  padding: 12px;
  color: var(--text-muted, #94a3b8);
  font-style: italic;
}
```

---

### `src/components/grid/PopupGrid.jsx`
*Floating CBO popup grid (ComboBox Object cells)*

```jsx
// PopupGrid.jsx
// Lightweight read-only picker grid for modal dialogs.
// Columns are derived from row object keys — pass [{ col1: v1, col2: v2 }, ...].
//
// Ref API (matches EntryGrid picker usage):
//   getSelectedRows() → selected row objects (original data, without internal _pgId)
//   clearSelection()

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import './PopupGrid.css';

const DEFAULT_EXCLUDE = ['id', '_pgId'];

function humanizeKey(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

function resolveRowId(row, index, idKey) {
  if (idKey && row[idKey] != null) return String(row[idKey]);
  if (row.id != null) return String(row.id);
  if (row.ItemID != null) return String(row.ItemID);
  if (row.SupplierID != null) return String(row.SupplierID);
  return `_pg_${index}`;
}

function deriveColumns(rows, excludeKeys, columnOrder, columnLabels) {
  if (!rows?.length) return [];

  const excluded = new Set(excludeKeys);
  const keys = columnOrder?.length
    ? columnOrder.filter((k) => !excluded.has(k))
    : [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !excluded.has(k));

  return keys.map((key) => ({
    key,
    label: columnLabels?.[key] ?? humanizeKey(key),
  }));
}

const PopupGrid = forwardRef(function PopupGrid(
  {
    rows = [],
    excludeKeys = DEFAULT_EXCLUDE,
    columnOrder = null,
    columnLabels = null,
    idKey = null,
    pageSize: defaultPageSize = 50,
    pageSizeOptions = [25, 50, 100],
    emptyMessage = 'No records to display.',
    onSelectionChange = null,
  },
  ref,
) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const rowsRef = useRef([]);

  const normalizedRows = useMemo(
    () => rows.map((row, index) => ({
      ...row,
      _pgId: resolveRowId(row, index, idKey),
    })),
    [rows, idKey],
  );

  useEffect(() => {
    rowsRef.current = normalizedRows;
  }, [normalizedRows]);

  const columns = useMemo(
    () => deriveColumns(normalizedRows, excludeKeys, columnOrder, columnLabels),
    [normalizedRows, excludeKeys, columnOrder, columnLabels],
  );

  const processedRows = useMemo(() => {
    let data = [...normalizedRows];
    if (sortConfig.key) {
      const { key, direction } = sortConfig;
      data.sort((a, b) => {
        const aVal = a[key] ?? '';
        const bVal = b[key] ?? '';
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        let cmp = 0;
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aVal !== '' && bVal !== '') {
          cmp = aNum - bNum;
        } else {
          cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        }
        return direction === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [normalizedRows, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const displayRows = processedRows.slice(startIdx, startIdx + pageSize);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [rows]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, sortConfig]);

  useEffect(() => {
    onSelectionChange?.(selectedIds.size);
  }, [selectedIds, onSelectionChange]);

  useImperativeHandle(ref, () => ({
    getSelectedRows() {
      return rowsRef.current.filter((r) => selectedIds.has(String(r._pgId)));
    },
    clearSelection() {
      setSelectedIds(new Set());
    },
  }), [selectedIds]);

  const handleSelectAll = useCallback(() => {
    const pageIds = displayRows.map((r) => String(r._pgId));
    if (pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageIds));
    }
  }, [displayRows, selectedIds]);

  const handleSelectRow = useCallback((rowId) => {
    const sid = String(rowId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const formatCell = (value) => {
    if (value == null || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  const allPageSelected = displayRows.length > 0
    && displayRows.every((r) => selectedIds.has(String(r._pgId)));

  return (
    <div className="popup-grid">
      <div className="popup-grid__scroll">
        <table className="popup-grid__table">
          <thead>
            <tr>
              <th className="popup-grid__th popup-grid__th--cb">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={handleSelectAll}
                  aria-label="Select all on page"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="popup-grid__th popup-grid__th--sortable"
                  onClick={() => handleSort(col.key)}
                >
                  <span>{col.label}</span>
                  {sortConfig.key === col.key && (
                    <span className="popup-grid__sort" aria-hidden>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="popup-grid__empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayRows.map((row) => {
                const rowId = String(row._pgId);
                const isSelected = selectedIds.has(rowId);
                return (
                  <tr
                    key={rowId}
                    className={isSelected ? 'popup-grid__row--selected' : ''}
                    onClick={() => handleSelectRow(rowId)}
                  >
                    <td
                      className="popup-grid__td popup-grid__td--cb"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(rowId)}
                        aria-label="Select row"
                      />
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="popup-grid__td">
                        {formatCell(row[col.key])}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {processedRows.length > 0 && (
        <div className="popup-grid__footer">
          <span className="popup-grid__info">
            Showing {startIdx + 1}–{Math.min(startIdx + pageSize, processedRows.length)} of {processedRows.length}
          </span>
          <div className="popup-grid__pager">
            <select
              className="popup-grid__page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
            <button
              type="button"
              className="popup-grid__page-btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="popup-grid__page-num">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              className="popup-grid__page-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default PopupGrid;
```

---

### `src/components/grid/PopupGrid.css`
*PopupGrid styles*

```css
/* PopupGrid — read-only picker table for modal dialogs */

.popup-grid {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--surface);
}

.popup-grid__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.popup-grid__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: max-content;
}

.popup-grid__th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--col-base-header-text);
  text-align: left;
  background: var(--col-base-header-bg);
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  white-space: nowrap;
  user-select: none;
}

.popup-grid__th:last-child {
  border-right: none;
}

.popup-grid__th--cb {
  width: 40px;
  min-width: 40px;
  text-align: center;
  cursor: default;
}

.popup-grid__th--sortable {
  cursor: pointer;
}

.popup-grid__th--sortable:hover {
  background: var(--bg-tint);
  color: var(--primary);
}

.popup-grid__sort {
  margin-left: 4px;
  font-size: 9px;
  color: var(--primary);
}

.popup-grid__td {
  padding: 5px 12px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  white-space: nowrap;
}

.popup-grid__td:last-child {
  border-right: none;
}

.popup-grid__td--cb {
  width: 40px;
  text-align: center;
}

.popup-grid__row--selected td {
  background: var(--col-base-selected);
}

.popup-grid__table tbody tr:hover td {
  background: var(--bg-tint);
}

.popup-grid__row--selected:hover td {
  background: var(--col-base-selected);
}

.popup-grid__empty {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
  font-style: italic;
  font-size: 12px;
}

.popup-grid__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 6px 12px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.popup-grid__info {
  font-size: 11px;
  color: var(--text-secondary);
}

.popup-grid__pager {
  display: flex;
  align-items: center;
  gap: 6px;
}

.popup-grid__page-size {
  height: 26px;
  padding: 0 6px;
  font-size: 11px;
  font-family: inherit;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
}

.popup-grid__page-btn {
  height: 26px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition);
}

.popup-grid__page-btn:hover:not(:disabled) {
  background: var(--primary-lighter);
  border-color: var(--primary);
  color: var(--primary);
}

.popup-grid__page-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.popup-grid__page-num {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 48px;
  text-align: center;
}
```

---

### `src/components/grid/Columnfilter.jsx`
*Per-column search filter row*

```jsx
// ColumnFilter.jsx — Shared column filter popup for GridForm & NormalGrid
//
// Props:
//   col            — column definition object { key, name/label, filterType, dropdownOptions? }
//   allRows        — full unfiltered data array (used to derive unique values for 'list' type)
//   value          — current filter value for this column
//                    • 'list'   → Set of selected string values
//                    • 'date'   → { type: 'range', from: '', to: '' }
//                    • 'number' → { type: 'numrange', min: '', max: '' }
//                    • 'text'   → string
//   onChange       — (colKey, newValue) => void   called on every change (live for text/date/number)
//   onClear        — (colKey) => void
//   onClose        — () => void
//   anchorRef      — ref to the trigger element (used for positioning)
//   getDisplayLabel — optional (col, rawValue) => string  to resolve dropdown labels for 'list' type
//
// filterType values:
//   'list'    — searchable checkbox list (default when not specified)
//   'date'    — from/to date range
//   'number'  — min/max numeric range
//   'text'    — simple contains text input

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Filter, Calendar, Hash, Type } from 'lucide-react';
import './column-filter.css';

const ICONS = {
    list: <Filter size={13} />,
    date: <Calendar size={13} />,
    number: <Hash size={13} />,
    text: <Type size={13} />,
};

export default function ColumnFilter({
    col,
    allRows = [],
    value,
    onChange,
    onClear,
    onClose,
    anchorRef,
    getDisplayLabel,
}) {
    const filterType = col.filterType || 'list';
    const colKey = col.key;
    const colName = col.name || col.label || colKey;

    const popupRef = useRef(null);
    const [search, setSearch] = useState('');
    const [style, setStyle] = useState({});

    // ── Position popup below/above the anchor ──────────────────────────
    useEffect(() => {
        if (!anchorRef?.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropUp = spaceBelow < 320 && rect.top > 320;
        setStyle({
            position: 'fixed',
            left: `${Math.min(rect.left, window.innerWidth - 250)}px`,
            width: '240px',
            zIndex: 9999,
            ...(dropUp
                ? { bottom: `${window.innerHeight - rect.top + 6}px` }
                : { top: `${rect.bottom + 6}px` }),
        });
    }, [anchorRef]);

    // ── Close on outside click ──────────────────────────────────────────
    useEffect(() => {
        function handleOut(e) {
            const inPopup = popupRef.current && popupRef.current.contains(e.target);
            const inAnchor = anchorRef?.current && anchorRef.current.contains(e.target);
            if (!inPopup && !inAnchor) onClose();
        }
        document.addEventListener('mousedown', handleOut);
        return () => document.removeEventListener('mousedown', handleOut);
    }, [onClose, anchorRef]);

    // ── Escape key ─────────────────────────────────────────────────────
    useEffect(() => {
        function handleKey(e) { if (e.key === 'Escape') onClose(); }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // ── Derive unique values for list filter ───────────────────────────
    const uniqueValues = useCallback(() => {
        if (filterType !== 'list') return [];
        if (col.dropdownOptions?.length) {
            return col.dropdownOptions.map(opt => {
                if (typeof opt === 'string') return opt;
                if (opt.value !== undefined) return String(opt.value);
                return String(opt.ObjDetID ?? opt);
            });
        }
        const vals = new Set(allRows.map(r => String(r[colKey] ?? '')).filter(Boolean));
        return Array.from(vals).sort();
    }, [filterType, col.dropdownOptions, allRows, colKey]);

    const resolveLabel = useCallback((rawVal) => {
        if (getDisplayLabel) return getDisplayLabel(col, rawVal);
        if (col.dropdownOptions?.length) {
            const opt = col.dropdownOptions.find(o => {
                const v = typeof o === 'object' ? String(o.value ?? o.ObjDetID ?? o) : o;
                return v === rawVal;
            });
            if (opt) return typeof opt === 'object' ? (opt.label || opt.Name || rawVal) : opt;
        }
        return rawVal;
    }, [getDisplayLabel, col]);

    // ─────────────────────────────────────────────────────────────────────
    // Render helpers per filter type
    // ─────────────────────────────────────────────────────────────────────

    const renderList = () => {
        const all = uniqueValues();
        const filtered = search ? all.filter(v => resolveLabel(v).toLowerCase().includes(search.toLowerCase())) : all;
        const current = (value instanceof Set) ? value : new Set();
        const allSelected = filtered.length > 0 && filtered.every(v => current.has(v));

        const toggle = (val) => {
            const next = new Set(current);
            if (next.has(val)) next.delete(val); else next.add(val);
            onChange(colKey, next);
        };

        const toggleAll = () => {
            const next = new Set(current);
            if (allSelected) { filtered.forEach(v => next.delete(v)); }
            else { filtered.forEach(v => next.add(v)); }
            onChange(colKey, next);
        };

        return (
            <>
                <div className="cf-search">
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search values…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Escape' && (search ? setSearch('') : onClose())}
                    />
                </div>
                <div className="cf-list">
                    {filtered.length > 0 && (
                        <div className="cf-item cf-item--all" onClick={toggleAll}>
                            <input type="checkbox" readOnly checked={allSelected} />
                            <label>(select all)</label>
                        </div>
                    )}
                    {filtered.map(val => (
                        <div key={val} className="cf-item" onClick={() => toggle(val)}>
                            <input type="checkbox" readOnly checked={current.has(val)} />
                            <label title={resolveLabel(val)}>{resolveLabel(val)}</label>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="cf-empty">No values found</div>
                    )}
                </div>
            </>
        );
    };

    const renderDate = () => {
        const from = value?.from || '';
        const to = value?.to || '';
        const set = (field, val) => {
            const base = value?.type === 'range' ? value : { type: 'range', from: '', to: '' };
            onChange(colKey, { ...base, [field]: val });
        };
        return (
            <div className="cf-date-range">
                <div className="cf-date-field">
                    <label>From</label>
                    <input type="date" value={from} onChange={e => set('from', e.target.value)} />
                </div>
                <div className="cf-date-field">
                    <label>To</label>
                    <input type="date" value={to} onChange={e => set('to', e.target.value)} />
                </div>
            </div>
        );
    };

    const renderNumber = () => {
        const min = value?.min ?? '';
        const max = value?.max ?? '';
        const set = (field, val) => {
            const base = value?.type === 'numrange' ? value : { type: 'numrange', min: '', max: '' };
            onChange(colKey, { ...base, [field]: val });
        };
        return (
            <div className="cf-num-range">
                <div className="cf-range-row">
                    <span>Min</span>
                    <input type="number" placeholder="No min" value={min} onChange={e => set('min', e.target.value)} />
                </div>
                <div className="cf-range-row">
                    <span>Max</span>
                    <input type="number" placeholder="No max" value={max} onChange={e => set('max', e.target.value)} />
                </div>
            </div>
        );
    };

    const renderText = () => {
        const txt = typeof value === 'string' ? value : '';
        return (
            <div className="cf-text-input">
                <input
                    autoFocus
                    type="text"
                    placeholder={`Filter ${colName}…`}
                    value={txt}
                    onChange={e => onChange(colKey, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') onClose(); }}
                />
            </div>
        );
    };

    const body = {
        list: renderList,
        date: renderDate,
        number: renderNumber,
        text: renderText,
    }[filterType] || renderList;

    const popup = (
        <div className="cf-popup" ref={popupRef} style={style} role="dialog" aria-label={`Filter ${colName}`}>
            <div className="cf-header">
                <span className="cf-header-icon" aria-hidden="true">{ICONS[filterType]}</span>
                <span>Filter: {colName}</span>
            </div>
            {body()}
            <div className="cf-footer">
                <button className="cf-btn" onClick={() => { onClear(colKey); onClose(); }}>Clear</button>
                <button className="cf-btn cf-btn--primary" onClick={onClose}>Close</button>
            </div>
        </div>
    );

    return createPortal(popup, document.body);
}

// ── Utility: apply a ColumnFilter value to a data array ──────────────────
// Import this in both GridForm and NormalGrid to share filter evaluation logic.
export function applyColumnFilterValue(data, colKey, filterValue, col) {
    if (!filterValue) return data;

    if (filterValue instanceof Set) {
        if (filterValue.size === 0) return data;
        return data.filter(r => filterValue.has(String(r[colKey] ?? '')));
    }

    if (filterValue.type === 'range') {
        const { from, to } = filterValue;
        if (!from && !to) return data;
        return data.filter(r => {
            const val = r[colKey];
            if (val == null || val === '') return false;
            const dateStr = typeof val === 'string' && val.includes('T') ? val.split('T')[0] : val;
            const dateVal = new Date(dateStr);
            if (isNaN(dateVal)) return false;
            if (from && dateVal < new Date(from)) return false;
            if (to) {
                const end = new Date(to); end.setHours(23, 59, 59, 999);
                if (dateVal > end) return false;
            }
            return true;
        });
    }

    if (filterValue.type === 'numrange') {
        const { min, max } = filterValue;
        if (min === '' && max === '') return data;
        return data.filter(r => {
            const n = Number(r[colKey]);
            if (isNaN(n)) return false;
            if (min !== '' && n < Number(min)) return false;
            if (max !== '' && n > Number(max)) return false;
            return true;
        });
    }

    if (typeof filterValue === 'string') {
        const lower = filterValue.toLowerCase();
        return data.filter(r => String(r[colKey] ?? '').toLowerCase().includes(lower));
    }

    return data;
}

// ── Utility: check if a filter value is "active" (non-empty) ─────────────
export function isFilterActive(filterValue) {
    if (!filterValue) return false;
    if (filterValue instanceof Set) return filterValue.size > 0;
    if (filterValue?.type === 'range') return !!(filterValue.from || filterValue.to);
    if (filterValue?.type === 'numrange') return filterValue.min !== '' || filterValue.max !== '';
    if (typeof filterValue === 'string') return filterValue.length > 0;
    return false;
}
```

---

### `src/components/grid/column-filter.css`
*Column filter row styles*

```css
/* ColumnFilter.css — shared column filter popup
   Tokens consumed from App.css :root. All classes prefixed cf-.        */

.cf-popup {
  background: var(--surface);
  border: 1px solid var(--border-dark);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: cfDropIn 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 220px;
  max-width: 260px;
  font-family: 'Inter', system-ui, sans-serif;
}

@keyframes cfDropIn {
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Header ── */
.cf-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 14px;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid var(--border);
}

.cf-header-icon {
  color: var(--primary);
  display: inline-flex;
  align-items: center;
}

/* ── Search bar (list type) ── */
.cf-search {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.cf-search input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-family: inherit;
  background: var(--surface);
  color: var(--text);
  transition: all var(--transition);
  outline: none;
}

.cf-search input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--primary-light);
}

/* ── Checkbox list ── */
.cf-list {
  max-height: 220px;
  overflow-y: auto;
  padding: 4px 0;
  scrollbar-width: thin;
  scrollbar-color: var(--border-dark) transparent;
}

.cf-list::-webkit-scrollbar         { width: 6px; }
.cf-list::-webkit-scrollbar-track   { background: transparent; }
.cf-list::-webkit-scrollbar-thumb   { background: var(--border-dark); border-radius: 3px; }

.cf-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 14px;
  cursor: pointer;
  font-size: 0.82rem;
  color: #334155;
  transition: background var(--transition);
}

.cf-item:hover { background: var(--primary-lighter); color: var(--primary); }

.cf-item input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--primary);
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 3px;
}

.cf-item label {
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-weight: 500;
  color: inherit;
}

.cf-item--all {
  border-bottom: 1px solid var(--border);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.cf-item--all label { font-weight: 600; }

.cf-empty {
  padding: 16px 14px;
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* ── Date range ── */
.cf-date-range {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cf-date-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cf-date-field label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cf-date-field input[type="date"] {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
  transition: all var(--transition);
  outline: none;
}

.cf-date-field input[type="date"]:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--primary-light);
}

/* ── Number range ── */
.cf-num-range {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cf-range-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
}

.cf-range-row span {
  min-width: 30px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cf-range-row input[type="number"] {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
  transition: all var(--transition);
  outline: none;
}

.cf-range-row input[type="number"]:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--primary-light);
}

/* ── Text input ── */
.cf-text-input {
  padding: 8px 10px;
}

.cf-text-input input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-family: inherit;
  background: var(--surface);
  color: var(--text);
  transition: all var(--transition);
  outline: none;
}

.cf-text-input input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--primary-light);
}

/* ── Footer ── */
.cf-footer {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.cf-btn {
  flex: 1;
  padding: 7px 12px;
  border: 1px solid var(--border-dark);
  background: var(--surface);
  color: var(--text);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.cf-btn:hover {
  background: var(--bg);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}

.cf-btn--primary {
  background: linear-gradient(180deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: white;
  border-color: var(--primary);
  box-shadow: 0 2px 6px rgba(37,99,168,0.2);
}

.cf-btn--primary:hover {
  background: linear-gradient(180deg, var(--primary-hover) 0%, #1d4ed8 100%);
  box-shadow: 0 4px 12px rgba(37,99,168,0.3);
}
```

---


## Part 10 — Picker Modals & Transaction Components

### `src/components/purchase-inquiry/SupplierPickerModal.jsx`
*Multi-select supplier picker modal*

```jsx
// SupplierPickerModal — supplier picker for Purchase Inquiry (IMS_LIVE API)
// Modal + EntryGrid (readOnly) for Fn_tbl_FetchCustomerSupplierTranWs4Web rows.

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Modal from '../ui/Modal';
import EntryGrid from '../grid/EntryGrid';
import Loader from '../ui/Loader';
import { Truck, CheckCheck, Users, AlertCircle } from 'lucide-react';
import '../txn/OrderItemModal.css';

const SUPPLIER_COLUMNS = [
  { id: 'cb', name: '', key: 'cb', controlType: -1, width: 48, isFixed: true, isEditAllow: false },
  { id: 'SupplierCode', name: 'Supplier Code', key: 'SupplierCode', controlType: 0, width: 120, isFixed: true, isEditAllow: false },
  { id: 'SupplierName', name: 'Supplier Name', key: 'SupplierName', controlType: 0, width: 200, isFixed: false, isEditAllow: false },
  { id: 'GstRegNo', name: 'GST Reg No.', key: 'GstRegNo', controlType: 0, width: 140, isFixed: false, isEditAllow: false },
  { id: 'SuppAddress', name: 'Address', key: 'SuppAddress', controlType: 0, width: 220, isFixed: false, isEditAllow: false },
  { id: 'City', name: 'City', key: 'City', controlType: 0, width: 120, isFixed: false, isEditAllow: false },
  { id: 'ContactNo', name: 'Contact No.', key: 'ContactNo', controlType: 0, width: 110, isFixed: false, isEditAllow: false },
];

export default function SupplierPickerModal({
  isOpen = false,
  onClose,
  items = [],
  isLoading = false,
  error = null,
  onInsert,
}) {
  const gridRef = useRef(null);
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    if (isOpen) setSelectedCount(0);
  }, [isOpen]);

  const gridConfig = useMemo(() => ({
    columns: SUPPLIER_COLUMNS,
    pagination: { pageSize: 50, pageSizeOptions: [25, 50, 100] },
  }), []);

  const handleInsert = useCallback(() => {
    if (!gridRef.current) return;
    const selectedRows = gridRef.current.getSelectedRows?.() ?? [];
    if (selectedRows.length > 0) {
      onInsert?.(selectedRows);
      onClose?.();
    }
  }, [onInsert, onClose]);

  const showGrid = !isLoading && !error && items.length > 0;

  const footer = showGrid ? (
    <div className="oim-footer">
      <div className="oim-footer__meta">
        {selectedCount > 0 ? (
          <>
            <span className="oim-footer__badge">{selectedCount}</span>
            <span>
              supplier{selectedCount !== 1 ? 's' : ''} selected for insert
            </span>
          </>
        ) : (
          <span className="oim-footer__hint">Select one or more suppliers to insert</span>
        )}
      </div>
      <div className="oim-footer__actions">
        <button type="button" className="oim-btn oim-btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="oim-btn oim-btn--primary"
          onClick={handleInsert}
          disabled={selectedCount === 0}
          title={selectedCount > 0 ? `Insert ${selectedCount} supplier(s)` : 'Select at least one supplier'}
        >
          <CheckCheck size={14} strokeWidth={2.5} />
          Insert{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Suppliers"
      subtitle="Choose suppliers for this purchase inquiry"
      icon={<Truck size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      footer={footer}
    >
      <div className="oim">
        {isLoading && (
          <div className="oim-state">
            <Loader text="Fetching suppliers…" />
          </div>
        )}

        {!isLoading && error && (
          <div className="oim-error" role="alert">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="oim-empty">
            <Users size={32} strokeWidth={1.5} />
            <p>No suppliers found for the selected division.</p>
          </div>
        )}

        {showGrid && (
          <div className="oim-grid-wrap">
            <div className="oim-toolbar">
              <div className="oim-toolbar__left">
                <span className="oim-toolbar__label">Available Suppliers</span>
                <span className="oim-toolbar__count">
                  {items.length} record{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              {selectedCount > 0 && (
                <span className="oim-toolbar__selected">
                  {selectedCount} selected
                </span>
              )}
            </div>
            <EntryGrid
              ref={gridRef}
              config={gridConfig}
              title=""
              readOnly
              initialRows={items}
              onSelectionChange={setSelectedCount}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
```

---

### `src/components/txn/OrderItemModal.jsx`
*Multi-select item picker modal*

```jsx
// OrderItemModal — Item picker for Purchase Inquiry.
// Displays an EntryGrid in read-only mode populated with API-fetched columns
// (from GetDetailColData) and rows (from SP_ITEM_PICKER).
// The user selects rows and clicks "Insert" to add them to the main item grid.

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import EntryGrid from '../grid/EntryGrid';
import Loader from '../ui/Loader';
import { ShoppingCart, CheckCheck, Package, AlertCircle } from 'lucide-react';
import './OrderItemModal.css';

export default function OrderItemModal({
  isOpen    = false,
  onClose,
  items     = [],       // row data from SP_ITEM_PICKER
  columns   = [],       // EntryGrid column definitions from GetDetailColData
  isLoading = false,
  error     = null,
  onInsert,
}) {
  const gridRef = useRef(null);
  const [selectedCount, setSelectedCount] = useState(0);

  // Reset selection state every time the modal opens
  useEffect(() => {
    if (isOpen) setSelectedCount(0);
  }, [isOpen]);

  const handleInsert = useCallback(() => {
    if (!gridRef.current) return;
    const selectedRows = gridRef.current.getSelectedRows?.() ?? [];
    if (selectedRows.length > 0) {
      onInsert?.(selectedRows);
      onClose?.();
    }
  }, [onInsert, onClose]);

  // Memoised config so EntryGrid doesn't re-initialise on every render
  const gridConfig = useMemo(() => ({
    columns,
    pagination: { pageSize: 50, pageSizeOptions: [25, 50, 100] },
  }), [columns]);

  const hasColumns = columns.length > 0;
  const showGrid   = !isLoading && !error && hasColumns;

  const footer = showGrid ? (
    <div className="oim-footer">
      <div className="oim-footer__meta">
        {selectedCount > 0 ? (
          <>
            <span className="oim-footer__badge">{selectedCount}</span>
            <span>item{selectedCount !== 1 ? 's' : ''} selected for insert</span>
          </>
        ) : (
          <span className="oim-footer__hint">Select one or more rows to insert</span>
        )}
      </div>
      <div className="oim-footer__actions">
        <button type="button" className="oim-btn oim-btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="oim-btn oim-btn--primary"
          onClick={handleInsert}
          disabled={selectedCount === 0}
          title={selectedCount > 0 ? `Insert ${selectedCount} row(s)` : 'Select at least one item'}
        >
          <CheckCheck size={14} strokeWidth={2.5} />
          Insert{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Items"
      subtitle="Choose items to add to the inquiry"
      icon={<ShoppingCart size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      footer={footer}
    >
      <div className="oim">
        {isLoading && (
          <div className="oim-state">
            <Loader text="Loading items…" />
          </div>
        )}

        {!isLoading && error && (
          <div className="oim-error" role="alert">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && !hasColumns && (
          <div className="oim-empty">
            <Package size={32} strokeWidth={1.5} />
            <p>No items found for the selected filter values.</p>
          </div>
        )}

        {showGrid && (
          <div className="oim-grid-wrap">
            <div className="oim-toolbar">
              <div className="oim-toolbar__left">
                <span className="oim-toolbar__label">Available Items</span>
                <span className="oim-toolbar__count">
                  {items.length} record{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              {selectedCount > 0 && (
                <span className="oim-toolbar__selected">{selectedCount} selected</span>
              )}
            </div>

            {/* key=isOpen forces a full remount on each open, resetting rows + selection */}
            <EntryGrid
              key={String(isOpen)}
              ref={gridRef}
              config={gridConfig}
              title=""
              readOnly
              initialRows={items}
              hideBottomPanel
              emptyMessage="No items found for the selected criteria."
              onSelectionChange={setSelectedCount}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
```

---

### `src/components/txn/OrderItemModal.css`
*OrderItemModal styles*

```css
/* OrderItemModal — enterprise picker dialog */

.oim {
  min-height: 200px;
  display: flex;
  flex-direction: column;
}

/* ── States ── */
.oim-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  padding: 32px 24px;
  background: var(--surface);
}

.oim-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 220px;
  padding: 32px 24px;
  color: var(--text-muted);
  background: var(--surface);
}

.oim-empty svg {
  color: var(--border-dark);
}

.oim-empty p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.oim-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 16px;
  padding: 10px 12px;
  font-size: 12px;
  color: #93000a;
  background: #ffdad6;
  border: 1px solid rgba(186, 26, 26, 0.2);
  border-radius: var(--radius-sm);
}

.oim-error svg {
  flex-shrink: 0;
  color: #ba1a1a;
}

/* ── Grid shell ── */
.oim-grid-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 160px;
  margin: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  max-height: min(62vh, 560px);
}

.oim-grid-wrap .popup-grid {
  flex: 1;
  min-height: 0;
  border: none;
  border-radius: 0;
}

/* ── Toolbar strip (matches filter command bar density) ── */
.oim-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
  padding: 6px 12px;
  background: linear-gradient(90deg, var(--primary-lighter) 0%, var(--surface) 60%);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.oim-toolbar__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.oim-toolbar__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.oim-toolbar__count {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--primary);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.oim-toolbar__selected {
  font-size: 11px;
  font-weight: 600;
  color: var(--success);
  padding: 2px 8px;
  background: rgba(8, 153, 73, 0.08);
  border: 1px solid rgba(8, 153, 73, 0.25);
  border-radius: var(--radius-sm);
}

/* ── Footer ── */
.oim-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.oim-footer__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 0;
}

.oim-footer__hint {
  color: var(--text-muted);
  font-style: italic;
}

.oim-footer__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  border-radius: var(--radius-sm);
}

.oim-footer__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.oim-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  border: 1px solid transparent;
}

.oim-btn--ghost {
  color: var(--text-secondary);
  background: var(--surface);
  border-color: var(--border);
}

.oim-btn--ghost:hover {
  color: var(--text);
  border-color: var(--border-dark);
  background: var(--primary-lighter);
}

.oim-btn--primary {
  color: #fff;
  background: var(--primary);
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}

.oim-btn--primary:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.oim-btn--primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
```

---

### `src/components/txn/TxnHeaderPanel.jsx`
*Header panel for txn-entry page*

```jsx
// TxnEntryFilterPanel.jsx
// ─────────────────────────────────────────────────────────────────────
// Dedicated filter panel for TxnEntryForm.
// Static-only: no GET_FILTERS / GET_FILTER_DETAIL API calls.
// Always renders the caller-supplied `filters` array immediately.
//
// Props:
//   title         — header text
//   filters       — array of filter definition objects (required)
//                   Each: { FilterParameterID, FilterColName, FilterCaption,
//                            FilterColCtrlType, staticOptions? }
//   onAddNew      — () => void — called when "Add New" is clicked
//   isAdding      — boolean — disables button while a row is being added
//   onFilterChange — (colName, value) => void — live change notification

import React, { useState, useCallback, useEffect } from 'react';
import { controlTypeMap } from '../../data/dummyData';
import SearchSelect from '../ui/SearchSelect';
import { Plus, Table2, ShoppingCart } from 'lucide-react';
import './TxnHeaderPanel.css';
import '../filters/enterprise-filter-modern.css';

// ── Single filter control ─────────────────────────────────────────────
function FilterControl({ filter, value, options, onChange }) {
  const { FilterColCtrlType, FilterCaption, FilterColName } = filter;
  const handleChange = (e) => onChange(FilterColName, e.target.value);

  switch (FilterColCtrlType) {
    case controlTypeMap.LABEL:
      return (
        <div className="tef-control">
          <span className="tef-label">{FilterCaption}</span>
          <span className="tef-value">{value || '—'}</span>
        </div>
      );

    case controlTypeMap.TEXTBOX:
      return (
        <div className="tef-control">
          <label className="tef-label" htmlFor={`tef-${FilterColName}`}>
            {FilterCaption}
          </label>
          <input
            id={`tef-${FilterColName}`}
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder={`Enter ${FilterCaption}…`}
          />
        </div>
      );

    case controlTypeMap.DATE:
      return (
        <div className="tef-control">
          <label className="tef-label" htmlFor={`tef-${FilterColName}`}>
            {FilterCaption}
          </label>
          <input
            id={`tef-${FilterColName}`}
            type="date"
            value={value || ''}
            onChange={handleChange}
          />
        </div>
      );

    case controlTypeMap.DROPDOWN:
      return (
        <div className="tef-control">
          <label className="tef-label" htmlFor={`tef-${FilterColName}`}>
            {FilterCaption}
          </label>
          <SearchSelect
            id={`tef-${FilterColName}`}
            value={value || ''}
            onChange={(val) => onChange(FilterColName, val)}
            options={(options || []).map((opt) => {
              if (opt.value !== undefined) return { value: String(opt.value), label: opt.label };
              const valKey = opt.FilterCtrlValueCol || 'IDNumber';
              const labelKey = opt.FilterCtrlDisplayCol || 'Name';
              return { value: String(opt[valKey]), label: opt[labelKey] };
            })}
            placeholder={`-- Select ${FilterCaption} --`}
            ariaLabel={FilterCaption}
          />
        </div>
      );

    case controlTypeMap.TEXTAREA:
      return (
        <div className="tef-control">
          <label className="tef-label" htmlFor={`tef-${FilterColName}`}>
            {FilterCaption}
          </label>
          <textarea
            id={`tef-${FilterColName}`}
            value={value || ''}
            onChange={handleChange}
            placeholder={`Enter ${FilterCaption}…`}
            rows={2}
          />
        </div>
      );

    default:
      return (
        <div className="tef-control">
          <span className="tef-label">{FilterCaption}</span>
          <span className="tef-value">{value || '—'}</span>
        </div>
      );
  }
}

// ── Main component ────────────────────────────────────────────────────
export default function TxnHeaderPanel({
  title = '',
  filters = [],
  onAddNew,
  onOrderItem,              // legacy — kept for backward compat (TxnEntryPage)
  onSecondaryAction,        // preferred generic prop (replaces onOrderItem for new callers)
  secondaryBtnLabel = 'Order Item',
  SecondaryBtnIcon = ShoppingCart,
  isAdding = false,
  onFilterChange = null,
}) {
  // Unified secondary action handler — prefer onSecondaryAction over legacy onOrderItem
  const secondaryHandler = onSecondaryAction || onOrderItem;
  // Local controlled values for all header fields
  const [values, setValues] = useState({});

  // Build dropdown-options map from staticOptions on each filter definition
  const [dropdownOptions, setDropdownOptions] = useState({});
  useEffect(() => {
    const optMap = {};
    filters.forEach((f) => {
      if (f.FilterColCtrlType === controlTypeMap.DROPDOWN && f.staticOptions) {
        optMap[f.FilterParameterID] = f.staticOptions;
      }
    });
    setDropdownOptions(optMap);
  }, [filters]);

  const handleChange = useCallback((colName, value) => {
    console.log("see colName:", colName)
    console.log("see value:", value)
    setValues((prev) => ({ ...prev, [colName]: value }));
    onFilterChange?.(colName, value);
  }, [onFilterChange]);

  const handleAddNewClick = useCallback(() => {
    onAddNew?.(values);
  }, [onAddNew, values]);

  // Reusable action buttons
  const ActionButtons = (
    <div className="tef-control tef-action-wrap">
      <span className="tef-label">&nbsp;</span>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Secondary action button (Order Item / Indent Item / etc.) */}
        {secondaryHandler && (
          <button
            className="tef-order-btn"
            onClick={() => secondaryHandler(values)}
            disabled={isAdding}
            title={secondaryBtnLabel}
            aria-label={secondaryBtnLabel}
          >
            <SecondaryBtnIcon size={14} strokeWidth={2.5} />
            <span>{secondaryBtnLabel}</span>
          </button>
        )}
        {/* Add New button */}
        <button
          className="tef-add-btn"
          onClick={handleAddNewClick}
          disabled={isAdding}
          title="Add New"
          aria-label="Add New"
        >
          {isAdding ? (
            <>
              <div className="tef-spinner" />
              <span>Adding…</span>
            </>
          ) : (
            <>
              <Plus size={14} strokeWidth={2.5} />
              <span>Add New</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  console.log("see filters:", filters)

  return (
    <div className="tef-panel">
      <div className="fp-toolbar">
        <div className="fp-toolbar__left">
          <span className="fp-toolbar__icon">
            <Table2 size={16} strokeWidth={2} />
          </span>
          <div>
            <h2 className="fp-toolbar__title">{title}</h2>
            <span className="fp-toolbar__meta">
              {filters.length} header field{filters.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {filters.length > 0 ? (
        <div className="fp-fields">
          {filters.map((filter) => (
            <FilterControl
              key={filter.FilterParameterID}
              filter={filter}
              value={values[filter.FilterColName]}
              options={
                filter.FilterColCtrlType === controlTypeMap.DROPDOWN
                  ? dropdownOptions[filter.FilterParameterID]
                  : undefined
              }
              onChange={handleChange}
            />
          ))}
          <div className="fp-fields__actions">{ActionButtons}</div>
        </div>
      ) : (
        <div className="fp-fields">
          <div className="fp-fields__actions">{ActionButtons}</div>
        </div>
      )}
    </div>
  );
}
```

---

### `src/components/txn/TxnHeaderPanel.css`
*TxnHeaderPanel styles*

```css
/* TxnEntryFilterPanel.css
   Scoped styles for the TxnEntryForm header panel.
   Mirrors the visual design of FilterPanel.css but uses
   tef-* class names to avoid collisions.
*/

/* ── Panel shell ── */
.tef-panel {
  background: var(--header-gradient);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  box-shadow:
    0 8px 32px rgba(26,53,102,0.4),
    0 2px 8px rgba(0,0,0,0.2),
    inset 0 1px 0 rgba(255,255,255,0.1);
  position: relative;
  overflow: visible;
  flex-shrink: 0;
  min-height: fit-content;
}

.tef-panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

/* ── Header row ── */
.tef-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.12);
}

.tef-panel-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.18);
}


/* ── Controls grid ── */
.tef-panel-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 18px;
  align-items: flex-end;
  background: rgba(0,0,0,0.15);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 14px 16px;
  backdrop-filter: blur(8px);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
}

/* ── Individual control ── */
.tef-control {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 170px;
  max-width: 260px;
  flex: 0 1 auto;
}

.tef-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

/* ── Shared inputs ── */
.tef-control input[type='text'],
.tef-control input[type='date'],
.tef-control select,
.tef-control textarea {
  width: 100%;
  height: 34px;
  padding: 0 12px;
  font-size: 0.85rem;
  font-family: inherit;
  color: #1e293b;
  background: rgba(255,255,255,0.97);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: var(--radius);
  outline: none;
  transition: all var(--transition);
  box-shadow:
    0 1px 3px rgba(0,0,0,0.08),
    0 1px 2px rgba(0,0,0,0.04),
    inset 0 1px 0 rgba(255,255,255,0.6);
}

.tef-control textarea {
  height: 64px;
  padding: 8px 12px;
  resize: vertical;
  line-height: 1.5;
}

.tef-control input:focus,
.tef-control select:focus,
.tef-control textarea:focus {
  border-color: #60a5fa;
  box-shadow:
    0 0 0 4px rgba(96,165,250,0.2),
    0 1px 3px rgba(0,0,0,0.08);
  background: #ffffff;
  transform: translateY(-1px);
}

.tef-control input:hover,
.tef-control select:hover,
.tef-control textarea:hover {
  border-color: #93c5fd;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  transform: translateY(-1px);
}

/* ── Label-only value ── */
.tef-value {
  height: 34px;
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: #ffffff;
  padding: 0 12px;
  background: rgba(255,255,255,0.12);
  border-radius: var(--radius);
  border: 1px solid rgba(255,255,255,0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Add New button ── */
.tef-action-wrap {
  min-width: auto !important;
  max-width: none !important;
  flex: 0 0 auto !important;
}

.tef-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 24px;
  font-size: 0.85rem;
  font-weight: 700;
  font-family: inherit;
  color: #ffffff;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  border: 1px solid rgba(34,197,94,0.4);
  border-radius: var(--radius);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
  box-shadow:
    0 2px 10px rgba(34,197,94,0.35),
    0 1px 3px rgba(0,0,0,0.1),
    inset 0 1px 0 rgba(255,255,255,0.25);
}

.tef-add-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  box-shadow:
    0 6px 20px rgba(34,197,94,0.45),
    0 2px 6px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.tef-add-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}

.tef-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.tef-add-btn svg { flex-shrink: 0; color: #ffffff; }

/* ── Order Item button ── */
.tef-order-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 18px;
  font-size: 0.85rem;
  font-weight: 700;
  font-family: inherit;
  color: #ffffff;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: 1px solid rgba(59,130,246,0.4);
  border-radius: var(--radius);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
  box-shadow:
    0 2px 10px rgba(59,130,246,0.35),
    0 1px 3px rgba(0,0,0,0.1),
    inset 0 1px 0 rgba(255,255,255,0.25);
}

.tef-order-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow:
    0 6px 20px rgba(59,130,246,0.45),
    0 2px 6px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.tef-order-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}

.tef-order-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.tef-order-btn svg { flex-shrink: 0; color: #ffffff; }


/* ── Loading spinner ── */
.tef-spinner {
  width: 16px;
  height: 16px;
  border: 2.5px solid rgba(255,255,255,0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: tef-spin 0.7s linear infinite;
}

@keyframes tef-spin { to { transform: rotate(360deg); } }

/* ── Responsive ── */
@media (max-width: 768px) {
  .tef-panel-controls { flex-direction: column; }
  .tef-control { max-width: 100%; min-width: 0; }
}
```

---


## Part 11 — Dashboard Components

### `src/components/KpiStrip.jsx`
*KPI metric strip*

```jsx
import React from 'react';
import { FileText, ClipboardList, Receipt, TrendingUp } from 'lucide-react';
import './KpiStrip.css';

const KPI_ITEMS = [
  { label: 'Total Reports', value: '142', trend: '+12%', trendType: 'up', icon: FileText },
  { label: 'Pending Tasks', value: '8', trend: '-3%', trendType: 'down', icon: ClipboardList },
  { label: 'Open Invoices', value: '23', trend: '+5%', trendType: 'up', icon: Receipt },
  { label: 'Revenue MTD', value: '₹4.2L', trend: '+18%', trendType: 'up', icon: TrendingUp },
];

export default function KpiStrip() {
  return (
    <section className="kpi-strip" aria-label="Key metrics">
      {KPI_ITEMS.map(({ label, value, trend, trendType, icon: Icon }) => (
        <article key={label} className="kpi-card">
          <div className="kpi-card__body">
            <span className="kpi-card__label">{label}</span>
            <div className="kpi-card__row">
              <span className="kpi-card__value">{value}</span>
              <span className={`kpi-card__trend kpi-card__trend--${trendType}`}>{trend}</span>
            </div>
          </div>
          <div className="kpi-card__icon">
            <Icon size={18} strokeWidth={1.5} />
          </div>
        </article>
      ))}
    </section>
  );
}
```

---

### `src/components/KpiStrip.css`
*KpiStrip styles*

```css
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.kpi-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition);
}

.kpi-card:hover {
  box-shadow: var(--shadow-md);
}

.kpi-card__label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.kpi-card__row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.kpi-card__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--primary);
  line-height: 1;
}

.kpi-card__trend {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
}

.kpi-card__trend--up {
  color: var(--success);
  background: #e6f4ea;
}

.kpi-card__trend--down {
  color: var(--danger);
  background: #ffdad6;
}

.kpi-card__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  background: rgba(34, 109, 180, 0.08);
  color: var(--secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

@media (max-width: 1100px) {
  .kpi-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .kpi-strip {
    grid-template-columns: 1fr;
  }
}
```

---

### `src/components/PageHeaderCard.jsx`
*Standalone page title card*

```jsx
import React from 'react';
import './PageHeaderCard.css';

export default function PageHeaderCard({ title, description, action }) {
  return (
    <section className="page-header-card">
      <div>
        <h2 className="page-header-card__title">{title}</h2>
        {description && <p className="page-header-card__desc">{description}</p>}
      </div>
      {action}
    </section>
  );
}
```

---

### `src/components/PageHeaderCard.css`
*PageHeaderCard styles*

```css
.page-header-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  margin-bottom: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.page-header-card__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--primary);
  line-height: 1.2;
}

.page-header-card__desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.page-header-card__refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: var(--radius);
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition);
}

.page-header-card__refresh:hover {
  background: var(--primary-hover);
}
```

---

### `src/components/dashboard/DecisionPanel.jsx`
*Approval queue panel*

```jsx
import React from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';
import './DecisionPanel.css';

export default function DecisionPanel() {
  return (
    <section className="dec-panel">
      <header className="dec-panel__header">
        <Lightbulb size={14} strokeWidth={2} />
        <span>Decision Insights</span>
      </header>
      <div className="dec-panel__body">
        <article className="dec-alert dec-alert--primary">
          <h4>Resource Allocation Needed</h4>
          <p>
            The &quot;QC Sample Status&quot; board has a high number of pending items. Consider
            re-allocating team members.
          </p>
          <button type="button" className="dec-alert__action">
            Take Action <ArrowRight size={14} />
          </button>
        </article>
        <article className="dec-alert dec-alert--success">
          <h4>Efficiency Target Met</h4>
          <p>
            Short term goals for Q2 are currently tracking 15% ahead of schedule across all major
            boards.
          </p>
        </article>
      </div>
    </section>
  );
}
```

---

### `src/components/dashboard/DecisionPanel.css`
*DecisionPanel styles*

```css
.dec-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  max-height: 42%;
  min-height: 0;
}

.dec-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  flex-shrink: 0;
  padding: 0 16px;
  background: #f4f6f9;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--primary);
}

.dec-panel__body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
}

.dec-alert {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  flex-shrink: 0;
}

.dec-alert h4 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.dec-alert p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.45;
}

.dec-alert--primary {
  border-left: 3px solid var(--primary);
  background: var(--primary-lighter);
}

.dec-alert--primary h4 {
  color: var(--primary);
}

.dec-alert--success {
  border-left: 3px solid var(--success);
  background: #f0fdf4;
}

.dec-alert--success h4 {
  color: #065f46;
}

.dec-alert__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 6px 14px;
  border: none;
  border-radius: var(--radius);
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.dec-alert__action:hover {
  background: var(--primary-hover);
}
```

---

### `src/components/dashboard/TaskBoardPanel.jsx`
*Kanban task board panel*

```jsx
import React from 'react';
import { ClipboardList, CheckCircle2, Clock3 } from 'lucide-react';
import './TaskBoardPanel.css';

const TASKS = [
  { id: 1, title: 'Review Q1 Performance', status: 'Pending', time: 'Today', tone: 'warning' },
  { id: 2, title: 'Update HR Policies', status: 'Completed', time: 'Yesterday', tone: 'success' },
  { id: 3, title: 'Client Onboarding — Tech Solutions', status: 'In Progress', time: 'Tomorrow', tone: 'info' },
];

const STATUS_ICON = {
  Completed: CheckCircle2,
  Pending: Clock3,
  'In Progress': Clock3,
};

export default function TaskBoardPanel() {
  return (
    <section className="tbp-panel">
      <header className="tbp-panel__header">
        <ClipboardList size={14} strokeWidth={2} />
        <span>Task Board</span>
      </header>
      <ul className="tbp-list">
        {TASKS.map((task) => {
          const Icon = STATUS_ICON[task.status] || Clock3;
          return (
            <li key={task.id} className="tbp-item">
              <div className="tbp-item__main">
                <h4>{task.title}</h4>
                <p>{task.time}</p>
              </div>
              <div className={`tbp-item__status tbp-item__status--${task.tone}`}>
                <Icon size={16} strokeWidth={2} />
                <span>{task.status}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

---

### `src/components/dashboard/TaskBoardPanel.css`
*TaskBoardPanel styles*

```css
.tbp-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.tbp-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  flex-shrink: 0;
  padding: 0 16px;
  background: #f4f6f9;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--primary);
}

.tbp-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}

.tbp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  transition: background var(--transition), border-color var(--transition);
  flex-shrink: 0;
}

.tbp-item:hover {
  background: var(--primary-lighter);
  border-color: var(--border-dark);
}

.tbp-item__main h4 {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.tbp-item__main p {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
}

.tbp-item__status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.tbp-item__status--success { color: var(--success); }
.tbp-item__status--warning { color: var(--warning); }
.tbp-item__status--info { color: var(--secondary); }
```

---

### `src/components/dashboard/ReportBoardPanel.jsx`
*RB report mini-viewer*

```jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import EnterpriseDataGrid from '../grid/EnterpriseDataGrid';
import { useApi } from '../../api/useApi';
import { ENDPOINTS, API_BASE_URL_OLD } from '../../api/constants';
import { DASHBOARD_CONFIG } from '../../pages/dashboard/constants';
import './ReportBoardPanel.css';

const REPORT_COLUMNS = [
  {
    key: 'ReportBoardName',
    label: 'Board Name',
    width: '36%',
    filterable: true,
    isLink: true,
  },
  {
    key: 'Overdue',
    label: 'Over Due',
    width: '14%',
    badge: (value) => (value > 0 ? 'danger' : 'neutral'),
  },
  {
    key: 'ShortTerm',
    label: 'Short Term',
    width: '14%',
    badge: (value) => (value > 0 ? 'warning' : 'neutral'),
  },
  {
    key: 'LongTerm',
    label: 'Long Term',
    width: '14%',
    badge: (value) => (value > 0 ? 'success' : 'neutral'),
  },
  {
    key: 'Team',
    label: 'Team',
    width: '22%',
    filterable: true,
    align: 'left',
  },
];

const PAGE_SIZE_OPTIONS = {
  compact: [5, 8, 10, 15, 20],
  default: [5, 10, 20, 50, 99],
};

function buildReportBoardParams() {
  return {
    ObjType: DASHBOARD_CONFIG.REPORT_OBJ_TYPE,
    ObjName: DASHBOARD_CONFIG.SP_REPORT_BOARDS,
    JSon: JSON.stringify([
      {
        prmUserID: DASHBOARD_CONFIG.LOGIN_ID,
        prmSubDesgID: DASHBOARD_CONFIG.DEFAULT_SUB_DESG_ID,
        prmOnDate: '2026-05-25T00:00:00',
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: '',
  };
}

export default function ReportBoardPanel({ compact = false, fill = compact }) {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL_OLD);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pageSizeOptions = useMemo(
    () => (compact ? PAGE_SIZE_OPTIONS.compact : PAGE_SIZE_OPTIONS.default),
    [compact],
  );
  const [pageSize, setPageSize] = useState(() => (compact ? 8 : 10));

  useEffect(() => {
    setPageSize(compact ? 8 : 10);
  }, [compact]);

  const fetchReportBoards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildReportBoardParams());
      const rows = (json?.Table || []).map((row) => ({
        ...row,
        Team: row.Team || 'Default Team',
      }));
      setData(rows);
    } catch (err) {
      console.error('[ReportBoardPanel] fetch failed:', err);
      setError('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchReportBoards();
  }, [fetchReportBoards]);

  const handleRowClick = useCallback(
    (row) => navigate(`/main/${row.ReportBoardID}`),
    [navigate],
  );

  return (
    <section
      className={`rbp-panel ${fill ? 'rbp-panel--fill' : ''} ${compact ? 'rbp-panel--compact' : ''}`}
    >
      <header className="rbp-panel__header">
        <div className="rbp-panel__title">
          <FileText size={14} strokeWidth={2} />
          <span>Report Boards</span>
        </div>
        <div className="rbp-panel__toolbar">
          <label htmlFor="rbp-page-size" className="rbp-panel__pagesize-label">
            Rows per page
          </label>
          <select
            id="rbp-page-size"
            className="ng-select rbp-panel__pagesize-select"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </header>

      <EnterpriseDataGrid
        title=""
        columns={REPORT_COLUMNS}
        data={data}
        loading={loading}
        error={error}
        onRowClick={handleRowClick}
        loaderText="Loading Reports…"
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeOptions={pageSizeOptions}
        emptyMessage="No reports found."
        hideHeader
        fill={fill}
      />
    </section>
  );
}
```

---

### `src/components/dashboard/ReportBoardPanel.css`
*ReportBoardPanel styles*

```css
.rbp-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.rbp-panel--fill {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.rbp-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 36px;
  flex-shrink: 0;
  padding: 0 16px;
  background: #f4f6f9;
  border-bottom: 1px solid var(--border);
}

.rbp-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--primary);
}

.rbp-panel__toolbar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.rbp-panel__pagesize-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.rbp-panel__pagesize-select {
  height: 26px;
  min-width: 56px;
  padding: 0 24px 0 8px;
}

/* Nested grid — panel supplies the header; flatten the inner card chrome */
.rbp-panel .ng-card {
  border: none;
  border-radius: 0;
  box-shadow: none;
  flex: 1;
  min-height: 0;
}

.rbp-panel .ng-card-header {
  display: none;
}

.rbp-panel .ng-card-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
```

---


## Part 12 — Module 1: Purchase Inquiry (Canonical Pattern)

### `src/pages/purchase-inquiry/constants.js`
*PI config: RB codes, SPs, filter defs, grid defs*

```js
// constants.js — Purchase Inquiry page config
// All RB codes, SP names, IDs, and request defaults used by this page in one place.

import { controlTypeMap } from '../../data/dummyData';

export const PI_CONFIG = {
  // RB board codes
  RB_MASTER: 'RB_PurInquiryMst',
  RB_DETAIL: 'RB_PurInquiryDet',

  // Form identifiers
  FORM_TAG: 'INQ',
  TRAN_BOOK: 'PURINQUIRY',

  // Year IDs
  CONFIG_YEAR_ID: 2,
  DIVISION_YEAR_ID: 2,  // NOTE: confirm with backend — may be 13

  // Supplier picker
  SUPPLIER_PARTY_TYPE: 'S',
  SUPPLIER_SP: 'Fn_tbl_FetchCustomerSupplierTranWs4Web',

  // RB codes for item picker modal (depends on BasedOn selection)
  RB_ITEM_PICKER_DIRECT: 'RB_PurInqSelOnlyItem',  // BasedOn = '0' (Direct)
  RB_ITEM_PICKER_INDENT: 'RB_PurInqSelIndtItem',  // BasedOn = '2' (Indent wise)

  // SP / function names used in API calls
  SP_RB_META: 'Fn_Fetch_RBDetailByRBCode',
  SP_INQUIRY_TYPES: 'fn_tbl_ddl_Pur_Configuration',
  SP_INDENTS: 'Fn_Tbl_FetchPurchaseItemDetailTransWs4Web',
  SP_DIVISIONS: 'Fn_tbl_FetchUserWsDivision',
  SP_DEPARTMENTS: 'Pr_Fetch_DepartmentData_IMS',
  SP_ITEM_PICKER: 'Fn_Tbl_FetchPurchaseItemDetailTransWs4Web',

  // Called when Indent wise is selected and user clicks Insert in the item picker.
  // Input: prmJSon = selected indent rows. Output: parent/item rows (aggregated).
  SP_INDENT_SUMMARY: 'Fn_tbl_FetchIndentSummaryItem4Inquiry',

  // "Based On" dropdown options (hardcoded — not from API)
  BASED_ON_OPTIONS: [
    { value: '0', label: 'Direct' },
    { value: '2', label: 'Indent wise' },
  ],

  // Hardcoded columns for the Suppliers grid (Sr.No, Name, Address, City, Mobile)
  SUPPLIER_GRID_COLUMNS: [
    { id: 'cb', name: '', key: 'cb', controlType: -1, width: 48, isFixed: true, isEditAllow: false },
    { id: 'SrNo', name: 'Sr.No', key: 'SrNo', controlType: 0, width: 70, isFixed: false, isEditAllow: false },
    { id: 'SupplierName', name: 'Supplier Name', key: 'SupplierName', controlType: 0, width: 200, isFixed: false, isEditAllow: false },
    { id: 'Address', name: 'Address', key: 'Address', controlType: 0, width: 220, isFixed: false, isEditAllow: false },
    { id: 'City', name: 'City', key: 'City', controlType: 0, width: 120, isFixed: false, isEditAllow: false },
    { id: 'MobileNo', name: 'Mobile No.', key: 'MobileNo', controlType: 0, width: 110, isFixed: false, isEditAllow: false },
  ],

  // Misc request params
  INDENT_FRM_OPTION: 0,

  // Save endpoint (REST gateway — POST with JSON body)
  SAVE_ENDPOINT: '/API/TranFormSave/Post_RB_PurInquiryMst_Save',

  // localStorage keys for cached RB meta
  STORAGE_HEADER_META: 'piHeaderMeta',
  STORAGE_ENTRY_META: 'piEntryMeta',

  // Inquiry list (FN_Fetch_Data)
  LIST_OBJ_TYPE: 2,
  SP_INQUIRY_LIST: 'Fn_tbl_Pur_InquiryMst_List',
  LIST_DIVISION_ID: 15,
};

// ── Header filter definitions — cascade order: Division → Inquiry Type → Indent ──
// Kept here alongside PI_CONFIG so all PI-specific constants live together.
export const PI_HEADER_FILTERS = [
  { FilterParameterID: 'TranCode', FilterColName: 'TranCode', FilterCaption: 'Inquiry No.', FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: 'TranDate', FilterColName: 'TranDate', FilterCaption: 'Date', FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: 'DivisionID', FilterColName: 'DivisionID', FilterCaption: 'Division', FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'ConfigID', FilterColName: 'ConfigID', FilterCaption: 'Inquiry Type', FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'ExpectedDate', FilterColName: 'ExpectedDate', FilterCaption: 'Expected Date', FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: 'DeptID', FilterColName: 'DeptID', FilterCaption: 'Department', FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'BasedOnID', FilterColName: 'BasedOnID', FilterCaption: 'Based On', FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: PI_CONFIG.BASED_ON_OPTIONS },
  { FilterParameterID: 'Remarks', FilterColName: 'Remarks', FilterCaption: 'Remark', FilterColCtrlType: controlTypeMap.TEXTAREA },
];

export const PI_GRID_TABS = [
  { id: 'items', label: 'Item Grid' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'terms', label: 'Term And Conditions' },
];

export const APPROVED_OPTS = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
];

export const TERMS_COLUMNS = ['Sr.No', 'Terms Type', 'Code', 'Terms & Conditions'];

export const INDENT_DETAILS_COLUMNS = [
  { key: 'SrNo', label: 'Sr.No', width: 70 },
  { key: 'IndentNo', label: 'Indent No.', width: 120 },
  { key: 'IndentDate', label: 'Indent Date', width: 110 },
  { key: 'ItemName', label: 'Item Name', width: 190 },
  { key: 'IndentQty', label: 'Indent Qty', width: 100 },
  { key: 'TranQty', label: 'Tran Qty', width: 100 },
  { key: 'Unit', label: 'Unit', width: 80 },
];

export const PI_FILTER_INITIAL_VALUES = { BasedOnID: '0' };

export const PI_FILTER_CASCADE_RESETS = {
  DivisionID: ['ConfigID'],
};

// Supplier grid config (used by the Suppliers tab EntryGrid)
export const SUPPLIER_GRID_CONFIG = {
  columns: PI_CONFIG.SUPPLIER_GRID_COLUMNS,
  pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25] },
};

// Formats a date value as "dd-Mon-yyyy" (e.g. "02-Jun-2026") for API params.
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatTranDate(dateVal) {
  if (!dateVal) return '0';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '0';
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = MONTH_ABBR[d.getMonth()];
  return `${dd}-${mon}-${d.getFullYear()}`;
}
```

---

### `src/hooks/usePurchaseInquiry.js`
*PI hook: all async state (header meta, columns, dropdowns)*

```js
// usePurchaseInquiry.js — Header meta, detail grid, and filter dropdowns for Purchase Inquiry
// ─────────────────────────────────────────────────────────────────────
// On mount:
//   fetchHeaderMeta  → RB_PurInquiryMst → GetDetailColData + Division + Department
//   fetchDetailMeta  → RB_PurInquiryDet → GetDetailColData (columns only, no dropdowns)
//
// On first "Add New" / supplier insert:
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns
//
// Cascading filters (page onFilterChange):
//   Division → Inquiry Type → Indent

import { useState, useCallback, useRef } from 'react';
import { useApi } from '../api/useApi';
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  OBJ_TYPE,
} from '../api/constants';
import { PI_CONFIG } from '../pages/purchase-inquiry/constants';
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
} from '../utils/gridUtils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** API expects e.g. "02-Jun-2026" */
export function formatPiTranDate(dateVal) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    return `${dd}-${MONTHS[now.getMonth()]}-${now.getFullYear()}`;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function uniqueIndentOptions(rows) {
  const seen = new Set();
  const opts = [];
  for (const row of rows) {
    const id = String(row.IndentID);
    if (seen.has(id)) continue;
    seen.add(id);
    opts.push({ value: id, label: row.IndentNo || id });
  }
  // return opts;
  return rows;
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.IsEventReq) || isTruthyApiFlag(col.IsEventCol)) {
      set.add(col.ColName);
    }
  });
  if (set.size === 0) {
    fallbackKeys.forEach((k) => set.add(k));
  }
  return set;
}

// Shared loader: RB code → RBID + SaveProcName → GetDetailColData columns.
// Used by both the item-detail and supplier grids (same backend pattern,
// only the RB code + storage key change).
async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: OBJ_TYPE.FUNCTION,
    ObjName: PI_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmRBCode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: '',
  });
  const tableRow = metaData?.Table?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);

  const meta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
  localStorage.setItem(storageKey, JSON.stringify(meta));

  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: DEFAULT_LOGIN_ID,
  });
  const apiColumns = colData?.Links || [];
  return { meta, apiColumns };
}

export function usePurchaseInquiry(baseURL = API_BASE_URL) {
  const { get, post } = useApi(baseURL);

  // ── Header (master) state ─────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [inquiryTypeOptions, setInquiryTypeOptions] = useState([]);
  const [indentOptions, setIndentOptions] = useState([]);
  const [isLoadingInquiryTypes, setIsLoadingInquiryTypes] = useState(false);
  const [isLoadingIndents, setIsLoadingIndents] = useState(false);

  // ── Detail grid state ─────────────────────────────────────────────
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const fetchInquiryTypes = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === '0') {
      setInquiryTypeOptions([]);
      return [];
    }

    setIsLoadingInquiryTypes(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_INQUIRY_TYPES,
        JSon: JSON.stringify([{
          PrmCompanyId: DEFAULT_COMPANY_ID,
          PrmDivisionId: Number(divisionId),
          PrmYearId: PI_CONFIG.CONFIG_YEAR_ID,
          PrmUserId: DEFAULT_LOGIN_ID,
          PrmFormTag: PI_CONFIG.FORM_TAG,
          PrmRefType: '',
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.ConfigurationId),
        label: r.Name,
      }));
      setInquiryTypeOptions(opts);
      return opts;
    } catch (err) {
      console.warn('[PI] Inquiry Type fetch failed:', err);
      setInquiryTypeOptions([]);
      return [];
    } finally {
      setIsLoadingInquiryTypes(false);
    }
  }, [get]);

  const fetchIndents = useCallback(async ({ divisionId, configId, tranDate, supplierId = 0, frmOption = 0 }) => {
    if (!divisionId || divisionId === '0' || !configId || configId === '0') {
      setIndentOptions([]);
      return [];
    }

    setIsLoadingIndents(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_INDENTS,
        JSon: JSON.stringify([{
          prmDivisionID: Number(divisionId),
          prmYearID: PI_CONFIG.CONFIG_YEAR_ID,
          prmLoginID: DEFAULT_LOGIN_ID,
          prmTranDate: formatPiTranDate(tranDate),
          prmConfigID: Number(configId),
          prmSupplierID: Number(supplierId) || 0,
          prmTranBook: PI_CONFIG.TRAN_BOOK,
          prmFrmOption: Number(frmOption) || 0,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const opts = uniqueIndentOptions(res?.Table || []);
      // console.log(see opts)
      console.log("SEE OPTIONS:", res?.Table)
      setIndentOptions(opts);
      return opts;
    } catch (err) {
      console.warn('[PI] Indent fetch failed:', err);
      setIndentOptions([]);
      return [];
    } finally {
      setIsLoadingIndents(false);
    }
  }, [get]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);

    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: PI_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error('No PI header RB metadata returned from server.');

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      setHeaderRbMeta(hdrMeta);
      localStorage.setItem(PI_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      console.log('%c[PI] Header meta stored:', 'color:#8b5cf6;font-weight:600', hdrMeta);

      const [colData, divisionData, departmentData] = await Promise.all([
        get(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: hdrMeta.RBID,
          prmLoginID: DEFAULT_LOGIN_ID,
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmUserID: DEFAULT_LOGIN_ID,
            prmCompanyID: DEFAULT_COMPANY_ID,
            prmYearID: PI_CONFIG.DIVISION_YEAR_ID,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: '',
        }).catch((err) => {
          console.warn('[PI] Division fetch failed:', err);
          return null;
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.PROCEDURE,
          ObjName: PI_CONFIG.SP_DEPARTMENTS,
          JSon: JSON.stringify([{ PrmDeptID: 0 }]),
          p_ErrCode: -1,
          p_ErrMsg: '',
        }).catch((err) => {
          console.warn('[PI] Department fetch failed:', err);
          return null;
        }),
      ]);

      const apiColumns = colData?.Links || [];
      setHeaderColumns(apiColumns);
      console.log('%c[PI] Header columns received:', 'color:#8b5cf6;font-weight:600', apiColumns.length);

      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({
          value: String(r.DivisionID),
          label: r.DivisionName,
        })),
      );

      setDepartmentOptions(
        (departmentData?.Table || []).map((r) => ({
          value: String(r.DepartmentID),
          label: r.DepartmentName,
        })),
      );
    } catch (err) {
      console.error('[PI] fetchHeaderMeta failed:', err);
      setHeaderError(err?.message || 'Failed to load header configuration.');
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);

    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get, PI_CONFIG.RB_DETAIL, PI_CONFIG.STORAGE_ENTRY_META,
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;
      setEventColumns(buildEventColumnSet(apiColumns, [
        'ItemID', 'ItemCode', 'TranQty', 'BaseQty', 'UnitConvRate', 'TranRate', 'TranUnit',
      ]));
      setAllColumns(
        apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null })),
      );
      console.log('%c[PI] Detail columns received:', 'color:#6366f1;font-weight:600', apiColumns.length);
    } catch (err) {
      console.error('[PI] fetchDetailMeta failed:', err);
      setMetaError(err?.message || 'Failed to load item grid configuration.');
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(async (divisionID = 0) => {
    const apiColumns = rawDetailColumnsRef.current;
    const meta = rawDetailRbMetaRef.current;

    if (!apiColumns.length || !meta) {
      console.warn('[PI] fetchGridColumns called before fetchDetailMeta completed.');
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(
        get, apiColumns, meta.RBID,
        { funcCode: PI_CONFIG.RB_DETAIL, divisionID: Number(divisionID) || 0 },
      );
      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable: false,
        allEditable: true,
      });
      setColumns(gridColumns);
      console.log('%c[PI] Grid columns built:', 'color:#22c55e;font-weight:600', gridColumns.length);
      return gridColumns;
    } catch (err) {
      console.error('[PI] fetchGridColumns failed:', err);
      return [];
    }
  }, [get]);

  const saveTxn = useCallback(async (headerValues, detailRows, genIDNumber = 0) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const mstMeta = JSON.parse(localStorage.getItem(PI_CONFIG.STORAGE_HEADER_META) || 'null');
      const detMeta = JSON.parse(localStorage.getItem(PI_CONFIG.STORAGE_ENTRY_META) || 'null');

      if (!mstMeta || !detMeta) {
        throw new Error('Missing save configuration. Please refresh and try again.');
      }

      const cleanedRows = detailRows.map(({ id, ...rest }) => rest);
      const body = {
        PrmStrMstRBName: PI_CONFIG.RB_MASTER,
        prmStrMstJSON: JSON.stringify([headerValues]),
        prmstrMasterSaveProcName: mstMeta?.SaveProcName,
        prmstrDetailSaveProcName: detMeta?.SaveProcName,
        PrmStrDetRBName: PI_CONFIG.RB_DETAIL,
        prmStrDetJSON: JSON.stringify(cleanedRows),
        GenIDNumber: genIDNumber,
        p_ErrCode: -1,
        p_ErrMsg: '',
      };

      const result = await post(ENDPOINTS.RB_MASTER_DETAIL_FORM_SAVE, body);

      console.log('%c[PI] Save result:', 'color:#22c55e;font-weight:600', result);
      return result;
    } catch (err) {
      console.error('[PI] saveTxn failed:', err);
      setSaveError(err?.message || 'Save failed. Please try again.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [post]);

  const clearInquiryTypes = useCallback(() => setInquiryTypeOptions([]), []);
  const clearIndents = useCallback(() => setIndentOptions([]), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    departmentOptions,
    inquiryTypeOptions,
    indentOptions,
    fetchInquiryTypes,
    fetchIndents,
    clearInquiryTypes,
    clearIndents,
    isLoadingInquiryTypes,
    isLoadingIndents,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  };
}
```

---

### `src/pages/purchase-inquiry/PurchaseInquiryPage.jsx`
*PI listing page (grid + Add New)*

```jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Pencil } from 'lucide-react';
import EnterpriseDataGrid from '../../components/grid/EnterpriseDataGrid';
import { useApi } from '../../api/useApi';
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
} from '../../api/constants';
import { usePageHeader } from '../../context/PageHeaderContext';
import { PI_CONFIG } from './constants';
import './PurchaseInquiryPage.css';

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatListDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = MONTH_ABBR[d.getMonth()];
  return `${dd}-${mon}-${d.getFullYear()}`;
}

function buildListParams() {
  const year = new Date().getFullYear();
  return {
    ObjType: PI_CONFIG.LIST_OBJ_TYPE,
    ObjName: PI_CONFIG.SP_INQUIRY_LIST,
    JSon: JSON.stringify([
      {
        prmCompanyID: DEFAULT_COMPANY_ID,
        prmDivisionID: PI_CONFIG.LIST_DIVISION_ID,
        prmFroDate: `${year}-01-01`,
        prmToDate: `${year}-12-31`,
        prmLoginID: DEFAULT_LOGIN_ID,
        prmYearID: PI_CONFIG.CONFIG_YEAR_ID,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: '',
  };
}

function buildInquiryColumns(navigate) {
  return [
    {
      key: 'InquiryNo',
      label: 'Inquiry No.',
      width: '14%',
      filterable: true,
      align: 'left',
    },
    {
      key: 'InquiryDate',
      label: 'Inquiry Date',
      width: '11%',
      filterable: true,
      filterType: 'date',
      render: (value) => formatListDate(value),
    },
    {
      key: 'ExpectedDate',
      label: 'Expected Date',
      width: '11%',
      filterable: true,
      filterType: 'date',
      render: (value) => formatListDate(value),
    },
    {
      key: 'Division',
      label: 'Division',
      width: '12%',
      filterable: true,
      align: 'left',
    },
    {
      key: 'InquiryType',
      label: 'Inquiry Type',
      width: '14%',
      filterable: true,
      align: 'left',
    },
    {
      key: 'BasedOn',
      label: 'Based On',
      width: '12%',
      filterable: true,
      align: 'left',
    },
    {
      key: 'CreatedBy',
      label: 'Created By',
      width: '11%',
      filterable: true,
      align: 'left',
    },
    {
      key: 'CreatedDate',
      label: 'Created Date',
      width: '11%',
      filterable: true,
      filterType: 'date',
      render: (value) => formatListDate(value),
    },
    {
      key: '_actions',
      label: 'Edit',
      width: '4%',
      align: 'center',
      render: (_value, row) => (
        <button
          type="button"
          className="pi-list__edit-btn"
          title={`Edit inquiry ${row.InquiryNo ?? ''}`}
          aria-label={`Edit inquiry ${row.InquiryNo ?? ''}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/purchase-inquiry/${row.IDNUMBER}/edit`);
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function PurchaseInquiryPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(8);

  usePageHeader({
    title: 'Purchase Inquiry',
    subtitle: 'Browse purchase inquiries or create a new one.',
    showBack: true,
    backTo: '/',
  });

  const columns = useMemo(() => buildInquiryColumns(navigate), [navigate]);

  const fetchInquiries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(json?.Table ?? []);
    } catch (err) {
      console.error('[PurchaseInquiryPage] list fetch failed:', err);
      setError('Failed to load purchase inquiries.');
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleAddNew = useCallback(() => {
    navigate('/purchase-inquiry/new');
  }, [navigate]);

  return (
    <div className="workspace-page pi-list-page">
      <section className="pi-list-panel pi-list-panel--compact pi-list-panel--fill">
        <header className="pi-list-panel__header">
          <div className="pi-list-panel__title">
            <ClipboardList size={14} strokeWidth={2} />
            <span>Purchase Inquiries</span>
          </div>
          <div className="pi-list-panel__toolbar">
            <button type="button" className="pi-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              Add New
            </button>
            <label htmlFor="pi-list-page-size" className="pi-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="pi-list-page-size"
              className="ng-select pi-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </header>

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading inquiries…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase inquiries found."
          hideHeader
          fill
        />
      </section>
    </div>
  );
}
```

---

### `src/pages/purchase-inquiry/PurchaseInquiryPage.css`
*PI listing CSS*

```css
/* PurchaseInquiryPage.css — inquiry list view */

.pi-list-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pi-list-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.pi-list-panel--fill {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.pi-list-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 40px;
  flex-shrink: 0;
  padding: 0 16px;
  background: #f4f6f9;
  border-bottom: 1px solid var(--border);
}

.pi-list-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--primary);
}

.pi-list-panel__toolbar {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.pi-list-panel__add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--primary);
  border-radius: var(--radius);
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.pi-list-panel__add-btn:hover {
  filter: brightness(1.05);
}

.pi-list-panel__pagesize-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.pi-list-panel__pagesize-select {
  height: 26px;
  min-width: 56px;
  padding: 0 24px 0 8px;
}

.pi-list-panel .ng-card {
  border: none;
  border-radius: 0;
  box-shadow: none;
  flex: 1;
  min-height: 0;
}

.pi-list-panel .ng-card-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pi-list__edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--primary);
  cursor: pointer;
}

.pi-list__edit-btn:hover {
  background: #eef3fa;
  border-color: var(--primary);
}
```

---

### `src/pages/purchase-inquiry/PurchaseInquiryForm.jsx`
*PI entry form (filter panel + 3-tab grid + action bar)*

```jsx
// PurchaseInquiryForm.jsx
// Purchase Inquiry entry form (add / edit).
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields only (no action buttons)
//   2. pi-grid-section        — custom 3-tab wrapper
//        • Item Grid tab  → EntryGrid (API columns, RB_PurInquiryDet)
//                           buttons: Add New | Select Item
//        • Suppliers tab  → EntryGrid (hardcoded SUPPLIER_GRID_CONFIG)
//                           button: Select Supplier
//        • Terms tab      → static terms table (no buttons)
//        Fixed controls (always): Approved filter | Delete
//   3. CollapsibleGrid        — Indent Details
//   4. PIActionBar            — Save / Cancel / Close etc.
//
// Both the Items and Suppliers EntryGrid instances are always mounted (CSS
// show/hide) so their row state is preserved when switching tabs.

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Truck, Plus, Trash2, Package, FileText, Printer, Save, LogOut } from 'lucide-react';
import EnterpriseFilterPanel from '../../components/filters/EnterpriseFilterPanel';
import EntryGrid from '../../components/grid/EntryGrid';
import CollapsibleGrid from '../../components/grid/CollapsibleGrid';
import ActionBar from '../../components/ui/ActionBar';
import SupplierPickerModal from '../../components/purchase-inquiry/SupplierPickerModal';
import OrderItemModal from '../../components/txn/OrderItemModal';
import SearchSelect from '../../components/ui/SearchSelect';
import { usePurchaseInquiry } from '../../hooks/usePurchaseInquiry';
import { useApi } from '../../api/useApi';
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, DEFAULT_LOGIN_ID, getColDefault, OBJ_TYPE } from '../../api/constants';
import { buildGridColumns } from '../../utils/gridUtils';
import { usePageHeader } from '../../context/PageHeaderContext';
import {
  PI_CONFIG,
  PI_HEADER_FILTERS,
  PI_GRID_TABS,
  APPROVED_OPTS,
  TERMS_COLUMNS,
  INDENT_DETAILS_COLUMNS,
  PI_FILTER_CASCADE_RESETS,
  SUPPLIER_GRID_CONFIG,
  formatTranDate,
} from './constants';
import './PurchaseInquiryForm.css';

// ── Temp-ID generator (negative → never clash with real IDs) ─────────
let _piTempId = -1;
const nextTempId = () => _piTempId--;

// Map a supplier picker row → supplier grid row (hardcoded column keys).
function mapPickerToSupplierRow(item, srNo) {
  return {
    id: String(item.SupplierID ?? nextTempId()),
    SrNo: srNo,
    SupplierName: item.SupplierName ?? '',
    Address: item.SuppAddress ?? item.Address ?? '',
    City: item.City ?? '',
    MobileNo: item.ContactNo ?? item.MobileNo ?? '',
  };
}

// Map an item picker row → items grid row (seeded from allColumns).
function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
  Object.entries(item).forEach(([k, v]) => {
    if (k !== 'id' && v != null && Object.prototype.hasOwnProperty.call(row, k)) row[k] = v;
  });
  return row;
}

// ── Component ────────────────────────────────────────────────────────

export default function PurchaseInquiryForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith('/new');
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const supplierGridRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, departmentOptions, inquiryTypeOptions,
    fetchInquiryTypes, clearInquiryTypes,
    isLoadingInquiryTypes,
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    saveTxn, isSaving, saveError, clearSaveError,
  } = usePurchaseInquiry(API_BASE_URL);

  // Computed first so both the ref and the filter panel share the same initial date.
  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // TranDate seeded with todayISO so prmTranDate is correct on the first
  // "Select Item" click even before the user touches the date field.
  const headerValuesRef = useRef({
    TranCode: '', TranDate: todayISO, ConfigID: 0, ExpectedDate: null,
    DivisionID: 0, DeptID: 0, BasedOnID: '0',
    Remarks: '', CompanyID: 1, YearID: PI_CONFIG.DIVISION_YEAR_ID, LoginID: 1,
    IDNumber: recordId,
  });

  const filterInitialValues = useMemo(
    () => ({ BasedOnID: '0', TranDate: todayISO }),
    [todayISO],
  );

  // Incrementing this forces EnterpriseFilterPanel to remount and re-apply
  // initialValues, resetting all filter field values visually on Cancel.
  const [filterResetKey, setFilterResetKey] = useState(0);

  // ── Edit-mode gate ─────────────────────────────────────────────────
  // Page starts in read-only mode. Clicking the "Add" footer button enters
  // edit mode; "Cancel" (or the action-bar Cancel) returns to read-only.
  const [isEditMode, setIsEditMode] = useState(false);

  const enterEditMode = useCallback(() => setIsEditMode(true), []);
  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('items');

  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [supplierSelectionCount, setSupplierSelectionCount] = useState(0);
  const activeSelectionCount = activeTab === 'items' ? itemSelectionCount
    : activeTab === 'suppliers' ? supplierSelectionCount
      : 0;

  const [approvedFilter, setApprovedFilter] = useState('all');
  const [isGridLoading, setIsGridLoading] = useState(false);
  const [indentRows, setIndentRows] = useState([]);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierModalItems, setSupplierModalItems] = useState([]);
  const [supplierModalLoading, setSupplierModalLoading] = useState(false);
  const [supplierModalError, setSupplierModalError] = useState(null);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  // ── Collapsible indent children (indent-wise mode only) ───────────────
  // childRowsMap  — { [parentRowId: string]: selectedIndentRows[] }
  // childColumns  — same column defs passed to InlineChildTable (picker cols)
  const [childRowsMap, setChildRowsMap] = useState({});
  const [childColumns, setChildColumns] = useState([]);

  usePageHeader({
    title: isNewRoute ? 'New Purchase Inquiry' : 'Purchase Inquiry',
    subtitle: isNewRoute
      ? 'Fill in the header fields, then use Item Grid or Suppliers tabs.'
      : `Inquiry #${recordId || routeId || '—'} — fill in the header fields, then use Item Grid or Suppliers tabs.`,
    showBack: true,
    backTo: '/purchase-inquiry',
  });

  useEffect(() => {
    fetchHeaderMeta();
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current) return;
    fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns]);

  useEffect(() => {
    if (columns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      queuedRowsRef.current = [];
    }
  }, [columns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── syncedFilters ─────────────────────────────────────────────────
  const syncedFilters = useMemo(() => {
    const injectOptions = (filter) => {
      switch (filter.FilterParameterID) {
        case 'DivisionID': return { ...filter, staticOptions: divisionOptions };
        case 'ConfigID': return { ...filter, staticOptions: inquiryTypeOptions };
        case 'DeptID': return { ...filter, staticOptions: departmentOptions };
        default: return filter;
      }
    };

    if (headerColumns.length === 0) return PI_HEADER_FILTERS.map(injectOptions);

    const apiColMap = {};
    headerColumns.forEach((col) => { apiColMap[col.ColName] = col; });

    return PI_HEADER_FILTERS.map((filter) => {
      const withOpts = injectOptions(filter);
      const apiCol = apiColMap[filter.FilterParameterID] || apiColMap[filter.FilterColName];
      if (!apiCol) return withOpts;
      return {
        ...withOpts,
        FilterColName: apiCol.ColName,
        FilterColCtrlType: apiCol.ColCtrlType ?? withOpts.FilterColCtrlType,
      };
    });
  }, [headerColumns, divisionOptions, inquiryTypeOptions, departmentOptions]);

  // ── Filter cascade ─────────────────────────────────────────────────
  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === 'DivisionID') {
      headerValuesRef.current.ConfigID = 0;
      clearInquiryTypes();
      if (val && val !== '0') await fetchInquiryTypes(val);
      return;
    }
  }, [fetchInquiryTypes, clearInquiryTypes]);

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0);
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns]);

  // ── Add New (Items tab) ────────────────────────────────────────────
  const handleAddNew = useCallback(async () => {
    if (isFetching || isGridLoading) return;
    setActiveTab('items');
    const activeCols = await ensureItemColumns();
    if (!activeCols || activeCols.length === 0) return;
    const blankRow = { id: nextTempId() };
    allColumns.forEach(({ key, colDataType }) => { blankRow[key] = getColDefault(colDataType); });
    addItemRow(blankRow);
  }, [isFetching, isGridLoading, ensureItemColumns, allColumns, addItemRow]);

  // ── Select Item (Items tab) ────────────────────────────────────────
  // Flow:
  //   1. Pick RB code by BasedOn ('0'→Direct, '2'→Indent wise)
  //   2. Fetch RBID via Fn_Fetch_RBDetailByRBCode
  //   3. Fetch grid columns via GetDetailColData (read-only, no dropdown fetch)
  //   4. Fetch item rows via SP_ITEM_PICKER
  //   5. Open modal — EntryGrid in readOnly mode with those columns + rows
  const handleSelectItem = useCallback(async () => {
    const { DivisionID, ConfigID, TranDate, BasedOnID } = headerValuesRef.current;
    const divisionID = DivisionID ?? 0;
    const configID = ConfigID ?? 0;
    if (!divisionID || divisionID === '0' || divisionID === 0) {
      alert('Please select a Division before selecting items.');
      return;
    }

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      // Step 1 — choose RB code by BasedOnID
      const rbCode = Number(BasedOnID) === 2
        ? PI_CONFIG.RB_ITEM_PICKER_INDENT
        : PI_CONFIG.RB_ITEM_PICKER_DIRECT;

      // Step 2 — fetch RBID
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: rbCode }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error('Could not load item picker configuration.');

      // Step 3 — fetch columns (read-only: skip dropdown options)
      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const gridColumns = buildGridColumns(colRes?.Links || [], {}, {
        filterable: false,
        allEditable: false,
      });
      setItemModalColumns(gridColumns);

      // Step 4 — fetch item rows
      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([{
          prmDivisionID: Number(divisionID),
          prmYearID: PI_CONFIG.CONFIG_YEAR_ID,
          prmLoginID: DEFAULT_LOGIN_ID,
          prmTranDate: formatTranDate(TranDate),
          prmConfigID: Number(configID),
          prmSupplierID: Number(headerValuesRef.current?.SupplierID ?? 0),
          prmTranBook: PI_CONFIG.TRAN_BOOK,
          prmFrmOption: Number(BasedOnID) || 0,
        }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      setItemModalItems(rowRes?.Table || []);
    } catch (err) {
      console.error('[PI] Item picker fetch failed:', err);
      setItemModalError(err?.message || 'Failed to fetch items.');
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    setActiveTab('items');

    const isIndentWise = Number(headerValuesRef.current?.BasedOnID) === 2;

    if (!isIndentWise) {
      // ── Direct mode ───────────────────────────────────────────────────
      // Column definitions must be loaded before we can map rows.
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) return;
      setChildRowsMap({});
      setChildColumns([]);
      selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
      return;
    }

    // ── Indent-wise mode ─────────────────────────────────────────────
    // The summary API call must not be gated on column loading — fire it
    // immediately.  Parent rows are spread directly onto the grid row so
    // the display works even if allColumns hasn't resolved yet.
    // Also kick off column loading in the background so the grid is
    // properly configured by the time the user interacts with it.
    ensureItemColumns().catch(() => { });

    // Strip synthetic '_row_N' ids before sending to the API.
    const cleanItems = selectedItems.map(({ id: _id, ...rest }) => rest);

    setIsGridLoading(true);
    try {
      const summaryResponse = await fetch(`${API_BASE_URL_IMS}${ENDPOINTS.API_VALUES}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_INDENT_SUMMARY,
          JSon: [{ prmJSon: cleanItems }],
          p_ErrCode: -1,
          p_ErrMsg: '',
        }),
      });
      const summaryRes = await summaryResponse.json();

      const parents = summaryRes?.Table ?? [];
      if (!parents.length) return;

      // Build childRowsMap: parent.ItemID → matching selected indent rows.
      // Relationship: child.ChildFKey === parent.ItemID
      const newChildRowsMap = {};
      parents.forEach((parent) => {
        const pid = String(Math.round(Number(parent.ItemID)));
        const children = cleanItems.filter(
          (c) => String(Math.round(Number(c.ChildFKey))) === pid,
        );
        if (children.length > 0) newChildRowsMap[pid] = children;

        // Spread all API fields directly so the row doesn't depend on
        // allColumns being loaded yet; any grid column whose key matches
        // a parent field will display the correct value automatically.
        addItemRow({ ...parent, id: pid });
      });

      setChildRowsMap((prev) => ({ ...prev, ...newChildRowsMap }));
      setChildColumns(itemModalColumns.filter((c) => c.key !== 'cb'));
    } catch (err) {
      console.error('[PI] Indent summary fetch failed:', err);
    } finally {
      setIsGridLoading(false);
    }
  }, [ensureItemColumns, allColumns, addItemRow, itemModalColumns]);

  // ── Select Supplier (Suppliers tab) ──────────────────────────────
  const handleSelectSupplier = useCallback(async () => {
    const divisionID = headerValuesRef.current?.DivisionID ?? 0;
    if (!divisionID || divisionID === '0' || divisionID === 0) {
      alert('Please select a Division before selecting suppliers.');
      return;
    }
    setSupplierModalOpen(true);
    setSupplierModalItems([]);
    setSupplierModalError(null);
    setSupplierModalLoading(true);
    try {
      const response = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SUPPLIER_SP,
        JSon: JSON.stringify([{
          PrmDivisionId: Number(divisionID),
          PrmLoginId: DEFAULT_LOGIN_ID,
          PrmYearId: PI_CONFIG.CONFIG_YEAR_ID,
          PrmPartyType: PI_CONFIG.SUPPLIER_PARTY_TYPE,
        }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      setSupplierModalItems(
        (response?.Table || []).map((row, idx) => ({
          ...row,
          id: String(row.SupplierID ?? `sup_${idx}`),
        })),
      );
    } catch (err) {
      console.error('[PI] Supplier fetch failed:', err);
      setSupplierModalError(err?.message || 'Failed to fetch suppliers.');
    } finally {
      setSupplierModalLoading(false);
    }
  }, [getLive]);

  const handleInsertSuppliers = useCallback((selectedSuppliers) => {
    if (!selectedSuppliers?.length) return;
    setActiveTab('suppliers');
    const existing = supplierGridRef.current?.getRows?.() ?? [];
    const existingIds = new Set(existing.map((r) => String(r.SupplierID ?? r.id)));
    let nextSrNo = existing.length;
    selectedSuppliers.forEach((item) => {
      const sid = String(item.SupplierID ?? item.id);
      if (existingIds.has(sid)) return;
      existingIds.add(sid);
      nextSrNo += 1;
      supplierGridRef.current?.addRow(mapPickerToSupplierRow(item, nextSrNo));
    });
  }, []);

  // ── Delete selected rows (active tab's grid) ───────────────────────
  const handleDeleteSelected = useCallback(() => {
    const ref = activeTab === 'items' ? itemGridRef
      : activeTab === 'suppliers' ? supplierGridRef
        : null;
    if (!ref?.current) return;
    const selected = ref.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    ref.current.removeRows?.(selected.map((r) => r.id));
    if (activeTab === 'suppliers') {
      const remaining = ref.current.getRows?.() ?? [];
      remaining.forEach((row, idx) => {
        if (Object.prototype.hasOwnProperty.call(row, 'SrNo')) {
          ref.current.updateRow?.(row.id, { SrNo: idx + 1 });
        }
      });
    }
  }, [activeTab]);

  // ── Save / Cancel ──────────────────────────────────────────────────
  const [isSavingPI, setIsSavingPI] = useState(false);

  const handleSave = useCallback(async () => {
    // ── Master ────────────────────────────────────────────────────────
    const mstRow = {};
    headerColumns.forEach((col) => { mstRow[col.ColName] = getColDefault(col.ColDataType); });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => { if (k !== 'id') mstRow[k] = v; });
    mstRow.LoginID = DEFAULT_LOGIN_ID;

    // ── Detail ────────────────────────────────────────────────────────
    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
      return { ...row, ...rest, LoginID: DEFAULT_LOGIN_ID };
    });

    // ── IndentDetail ──────────────────────────────────────────────────
    const indentDetailRows = Object.values(childRowsMap)
      .flat()
      .map(({ id: _id, ...rest }) => ({ ...rest, LoginID: DEFAULT_LOGIN_ID }));

    const payload = {
      prmStrMstJSON: JSON.stringify([mstRow]),
      prmStrDetJSON: JSON.stringify(detRows),
      prmStrIndtDetJSON: JSON.stringify(indentDetailRows),
    };

    console.log('%c[PI Save] Payload:', 'color:#f59e0b;font-weight:700', payload);
    console.log('%c[PI Save] Master:', 'color:#6366f1;font-weight:600', [mstRow]);
    console.log('%c[PI Save] Detail:', 'color:#22c55e;font-weight:600', detRows);
    console.log('%c[PI Save] IndentDetail:', 'color:#ec4899;font-weight:600', indentDetailRows);

    setIsSavingPI(true);
    try {
      const res = await fetch(`${API_BASE_URL_IMS}${PI_CONFIG.SAVE_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      console.log('%c[PI Save] Response:', 'color:#22c55e;font-weight:700', result);
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert('Purchase Inquiry saved successfully!');
    } catch (err) {
      console.error('[PI Save] Failed:', err);
      alert(err?.message || 'Save failed. Please try again.');
    } finally {
      setIsSavingPI(false);
    }
  }, [headerColumns, allColumns, childRowsMap]);

  const handleSaveAndPrint = useCallback(async () => {
    await handleSave();
    window.print();
  }, [handleSave]);

  const handleCancel = useCallback(() => {
    if (!window.confirm('Discard changes and reset the form?')) return;

    // ── 1. Wipe page-session storage ──────────────────────────────────
    localStorage.removeItem(PI_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(PI_CONFIG.STORAGE_ENTRY_META);
    sessionStorage.removeItem(PI_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(PI_CONFIG.STORAGE_ENTRY_META);

    // ── 2. Reset header ref (TranDate back to today, matching filterInitialValues) ──
    headerValuesRef.current = {
      TranCode: '', TranDate: todayISO, ConfigID: 0, ExpectedDate: null,
      DivisionID: 0, DeptID: 0, BasedOnID: '0',
      Remarks: '', CompanyID: 1, YearID: PI_CONFIG.DIVISION_YEAR_ID, LoginID: 1, IDNumber: 0,
    };

    // ── 3. Reset internal refs ────────────────────────────────────────
    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;

    // ── 4. Reset hook-owned state ─────────────────────────────────────
    clearInquiryTypes();   // inquiryTypeOptions → []
    clearSaveError();      // saveError → null

    // ── 5. Reset every local useState to its initial value ────────────
    setActiveTab('items');
    setApprovedFilter('all');
    setIsGridLoading(false);
    setIndentRows([]);
    setItemSelectionCount(0);
    setSupplierSelectionCount(0);

    // Item picker modal
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);

    // Collapsible child state
    setChildRowsMap({});
    setChildColumns([]);

    // Supplier picker modal
    setSupplierModalOpen(false);
    setSupplierModalItems([]);
    setSupplierModalLoading(false);
    setSupplierModalError(null);

    // ── 6. Clear both grids ───────────────────────────────────────────
    itemGridRef.current?.clearRows?.();
    supplierGridRef.current?.clearRows?.();

    // ── 7. Force-remount EnterpriseFilterPanel so its internal field
    //       state is wiped and initialValues are re-applied cleanly ────
    setFilterResetKey((k) => k + 1);

    exitEditMode();
  }, [clearInquiryTypes, clearSaveError, exitEditMode]);

  const handleClose = useCallback(() => navigate('/purchase-inquiry'), [navigate]);
  const handleDocument = useCallback(() => {
    console.log('[PI] Document F6 — reserved for document generation.');
  }, []);

  const itemGridConfig = { columns, pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] } };
  const combinedError = metaError || headerError;
  const filterBusy = headerFetching || isLoadingInquiryTypes;

  // Extra buttons visible in the ActionBar while in edit mode
  const piExtraButtons = useMemo(() => [
    { key: 'document', label: 'Document F6', Icon: FileText, variant: 'secondary', onClick: handleDocument },
    { key: 'sep1', separator: true },
    { key: 'saveprint', label: 'Save & Print', Icon: Printer, variant: 'print', onClick: handleSaveAndPrint, disabled: isSavingPI },
    { key: 'save', label: isSavingPI ? 'Saving…' : 'Save', Icon: Save, variant: 'save', onClick: handleSave, disabled: isSavingPI, loading: isSavingPI },
    { key: 'sep2', separator: true },
    { key: 'close', label: 'Close', Icon: LogOut, variant: 'close', onClick: handleClose },
  ], [handleDocument, handleSaveAndPrint, isSavingPI, handleSave, handleClose]);

  return (
    <div className="workspace-page pi-page">

      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchDetailMeta(); }}>
              Retry
            </button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            title="Purchase Inquiry Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={PI_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy}
            disabled={!isEditMode}
          />
        )}
      </section>

      <section className="pi-grid-section">

        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {PI_GRID_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`grid-tab ${activeTab === t.id ? 'grid-tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid-tabbar__controls">
            {activeTab === 'items' && (
              <>
                <button
                  type="button"
                  className="pi-tab-action-btn"
                  onClick={handleAddNew}
                  disabled={!isEditMode || isFetching || isGridLoading}
                  title="Add a blank item row"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Add New
                </button>
                <button
                  type="button"
                  className="pi-tab-action-btn"
                  onClick={handleSelectItem}
                  disabled={!isEditMode}
                  title="Pick items from list"
                >
                  <Package size={12} strokeWidth={2.5} />
                  Select Item
                </button>
              </>
            )}

            {activeTab === 'suppliers' && (
              <button
                type="button"
                className="pi-tab-action-btn"
                onClick={handleSelectSupplier}
                disabled={!isEditMode}
                title="Pick suppliers from list"
              >
                <Truck size={12} strokeWidth={2.5} />
                Select Supplier
              </button>
            )}

            <div className="pi-tab-filter">
              <span className="pi-tab-filter__label">Approved</span>
              <SearchSelect
                value={approvedFilter}
                onChange={setApprovedFilter}
                options={APPROVED_OPTS}
                compact
                ariaLabel="Approved filter"
              />
            </div>
            <button
              type="button"
              className="pi-tab-delete-btn"
              onClick={handleDeleteSelected}
              disabled={!isEditMode || activeSelectionCount === 0}
              title="Delete selected rows"
            >
              <Trash2 size={12} strokeWidth={2} />
              Delete
            </button>
          </div>
        </div>

        <div className={`pi-tab-pane${activeTab === 'items' ? ' pi-tab-pane--active' : ''}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Add New or Select Item above."
            onSelectionChange={setItemSelectionCount}
            enableCollapsible={Object.keys(childRowsMap).length > 0}
            childRowsMap={childRowsMap}
            childColumns={childColumns}
          />
        </div>

        <div className={`pi-tab-pane${activeTab === 'suppliers' ? ' pi-tab-pane--active' : ''}`}>
          <EntryGrid
            ref={supplierGridRef}
            config={SUPPLIER_GRID_CONFIG}
            title=""
            hideBottomPanel
            emptyMessage="No suppliers added. Click Select Supplier above."
            onSelectionChange={setSupplierSelectionCount}
          />
        </div>

        {activeTab === 'terms' && (
          <div className="pi-terms-pane">
            <table className="pi-terms-table">
              <thead>
                <tr>{TERMS_COLUMNS.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={TERMS_COLUMNS.length} className="pi-terms-empty">
                    No terms &amp; conditions added.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </section>

      {/* <section className="pi-page__section">
        <CollapsibleGrid
          title="Indent Details"
          subtitle="(Select one item row above to load its indent records)"
          columns={INDENT_DETAILS_COLUMNS}
          rows={indentRows}
        />
      </section> */}

      <ActionBar
        isEditMode={isEditMode}
        onAdd={enterEditMode}
        onCancel={handleCancel}
        extraButtons={piExtraButtons}
      />

      <SupplierPickerModal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        items={supplierModalItems}
        isLoading={supplierModalLoading}
        error={supplierModalError}
        onInsert={handleInsertSuppliers}
      />

      <OrderItemModal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        items={itemModalItems}
        columns={itemModalColumns}
        isLoading={itemModalLoading}
        error={itemModalError}
        onInsert={handleInsertItems}
      />
    </div>
  );
}
```

---

### `src/pages/purchase-inquiry/PurchaseInquiryForm.css`
*PI entry form CSS*

```css
/* PurchaseInquiryPage.css */

/* ── Page shell ── */
.pi-page {
 flex: 1;
 min-height: 0;
 overflow-y: auto;
 overflow-x: hidden;
 padding-bottom: 0; /* footer is sticky inside the scroll container — no extra padding needed */
 display: flex;
 flex-direction: column;
}

/* Match filter panel styling to the rest of the app */
.pi-page .efq-panel {
 border: 1px solid var(--border);
 border-radius: var(--radius-lg);
 background: var(--surface);
 box-shadow: var(--shadow-sm);
}

/* ── 3-tab grid section
   Wraps the tab bar + two always-mounted EntryGrid instances.
   Uses the same 2px primary border as .erp-grid-container. ── */
.pi-grid-section {
 flex: 0 0 auto;
 display: flex;
 flex-direction: column;
 height: auto;
 min-height: 320px;

 border: 2px solid var(--primary);
 border-radius: var(--radius-lg);
 background: var(--surface);
 box-shadow: 0 2px 8px rgba(30, 74, 122, 0.08);
 overflow: hidden;
}

/* Tab pane: hidden by default; fills remaining height when active */
.pi-tab-pane {
 display: none;
 flex: 1;
 min-height: 0;
 overflow: hidden;
}

.pi-tab-pane--active {
 display: flex;
 flex-direction: column;
}

/* Strip duplicate border/shadow from the child EntryGrid —
   the outer pi-grid-section provides the container chrome. */
.pi-tab-pane .erp-grid-container {
 border: none !important;
 border-radius: 0 !important;
 box-shadow: none !important;
}

/* Terms tab: plain scrollable pane */
.pi-terms-pane {
 flex: 1;
 overflow: auto;
 padding: 12px 16px;
 background: var(--surface);
}

/* ── Misc sections (CollapsibleGrid etc.) ── */
.pi-page__section {
 flex-shrink: 0;
}

/* ── Tab-bar action buttons (Add New / Select Item / Select Supplier)
   Matches the enterprise flat toolbar-btn pattern from enterprise-components.css ── */
.pi-tab-action-btn {
 display: inline-flex;
 align-items: center;
 gap: 5px;
 height: 26px;
 padding: 0 10px;
 font-size: 11px;
 font-weight: 600;
 font-family: inherit;
 color: var(--text);
 background: var(--surface);
 border: 1px solid var(--border);
 border-radius: var(--radius);
 cursor: pointer;
 transition: all var(--transition);
 white-space: nowrap;
}

.pi-tab-action-btn:hover:not(:disabled) {
 background: var(--primary-lighter);
 border-color: var(--primary);
 color: var(--primary);
}

.pi-tab-action-btn:active:not(:disabled) {
 background: var(--primary-light);
}

.pi-tab-action-btn:disabled {
 opacity: 0.45;
 cursor: not-allowed;
}

/* ── "Approved" label + compact SearchSelect ── */
.pi-tab-filter {
 display: flex;
 align-items: center;
 gap: 5px;
}

.pi-tab-filter__label {
 font-size: 11px;
 font-weight: 500;
 color: var(--text-secondary);
 white-space: nowrap;
}

/* ── Delete button — danger semantic matching pi-action-btn--close ── */
.pi-tab-delete-btn {
 display: inline-flex;
 align-items: center;
 gap: 5px;
 height: 26px;
 padding: 0 10px;
 font-size: 11px;
 font-weight: 600;
 font-family: inherit;
 color: var(--danger);
 background: #fef2f2;
 border: 1px solid rgba(217, 48, 37, 0.25);
 border-radius: var(--radius);
 cursor: pointer;
 transition: all var(--transition);
 white-space: nowrap;
}

.pi-tab-delete-btn:hover:not(:disabled) {
 background: #fde8e8;
 border-color: var(--danger);
}

.pi-tab-delete-btn:disabled {
 opacity: 0.45;
 cursor: not-allowed;
}

/* ── Terms & Conditions table ── */
.pi-terms-table {
 width: 100%;
 border-collapse: collapse;
 font-size: 12px;
 min-width: 400px;
 border: 1px solid var(--border);
 border-radius: var(--radius);
 overflow: hidden;
}

.pi-terms-table thead tr {
 background: var(--col-base-header-bg);
}

.pi-terms-table th {
 padding: 6px 12px;
 font-size: 10px;
 font-weight: 700;
 text-transform: uppercase;
 letter-spacing: 0.04em;
 color: var(--col-base-header-text);
 text-align: left;
 border-right: 1px solid var(--border);
 border-bottom: 1px solid var(--border);
 white-space: nowrap;
}

.pi-terms-table th:last-child {
 border-right: none;
}

.pi-terms-table td {
 padding: 6px 12px;
 font-size: 12px;
 border-bottom: 1px solid var(--border);
 border-right: 1px solid var(--border);
}

.pi-terms-table td:last-child {
 border-right: none;
}

.pi-terms-empty {
 text-align: center;
 padding: 24px;
 color: var(--text-muted);
 font-style: italic;
 font-size: 12px;
 border-right: none !important;
}
```

---


## Part 13 — Module 2: Purchase Order (Variation — Amend + Currency)

### `src/pages/purchase-order/constants.js`
*PO config: extends PI pattern + currency/supplier/amend fields*

```js
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
```

---

### `src/hooks/usePurchaseOrder.js`
*PO hook: extends PI hook + fetchPoTypes, fetchSupplierInfo*

```js
// usePurchaseOrder.js — Header meta, detail grid, and filter dropdowns for Purchase Order
// ─────────────────────────────────────────────────────────────────────────────────────
// Mirrors usePurchaseInquiry.js exactly — same three-phase load pattern:
//
//   fetchHeaderMeta  → RB_PurOrderMst → GetDetailColData + Division + Supplier + Currency
//   fetchDetailMeta  → RB_PurOrderDet → GetDetailColData (columns only, no dropdowns)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (on first Add New)
//
// Additional PO-specific calls:
//   fetchPoTypes(divisionId)          — cascade: Division → PO Type
//   fetchSupplierInfo(supplierId)     — derive CurrencyRate + CrDays from selected Supplier
//   fetchExistingPOs()                — Amend dropdown: list of existing POs
//
// Cascade: Division → PO Type

import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useApi } from '../api/useApi';
import {
  ENDPOINTS,
  API_BASE_URL,
  API_TIMEOUT,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
} from '../api/constants';
import { PO_CONFIG } from '../pages/purchase-order/constants';
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
} from '../utils/gridUtils';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatPoTranDate(dateVal) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2,'0')}-${MONTHS[now.getMonth()]}-${now.getFullYear()}`;
  }
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.IsEventReq) || isTruthyApiFlag(col.IsEventCol)) {
      set.add(col.ColName);
    }
  });
  if (set.size === 0) fallbackKeys.forEach((k) => set.add(k));
  return set;
}

// Shared loader: RB code → RBID + SaveProcName → GetDetailColData columns.
async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: PO_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmRBCode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: '',
  });
  const tableRow = metaData?.Table?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);

  const meta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
  localStorage.setItem(storageKey, JSON.stringify(meta));

  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: DEFAULT_LOGIN_ID,
  });
  const apiColumns = colData?.Links || [];
  return { meta, apiColumns };
}

export function usePurchaseOrder(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Header (master) state ───────────────────────────────────────────
  const [headerColumns,      setHeaderColumns]      = useState([]);
  const [headerRbMeta,       setHeaderRbMeta]        = useState(null);
  const [headerFetching,     setHeaderFetching]      = useState(false);
  const [headerError,        setHeaderError]         = useState(null);

  const [divisionOptions,    setDivisionOptions]     = useState([]);
  const [poTypeOptions,      setPoTypeOptions]       = useState([]);
  const [supplierOptions,    setSupplierOptions]     = useState([]);
  const [currencyOptions,    setCurrencyOptions]     = useState([]);
  const [existingPOs,        setExistingPOs]         = useState([]);

  const [isLoadingPoTypes,   setIsLoadingPoTypes]    = useState(false);
  const [isLoadingSuppliers, setIsLoadingSuppliers]  = useState(false);
  const [isLoadingExistingPOs, setIsLoadingExistingPOs] = useState(false);

  // ── Detail grid state ───────────────────────────────────────────────
  const [columns,     setColumns]     = useState([]);
  const [allColumns,  setAllColumns]  = useState([]);
  const [eventColumns,setEventColumns]= useState(() => new Set());
  const [isFetching,  setIsFetching]  = useState(false);
  const [metaError,   setMetaError]   = useState(null);
  const [isSaving,    setIsSaving]    = useState(false);
  const [saveError,   setSaveError]   = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef  = useRef(null);

  // ── fetchPoTypes — cascade from Division ───────────────────────────
  const fetchPoTypes = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === '0') {
      setPoTypeOptions([]);
      return [];
    }
    setIsLoadingPoTypes(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PO_CONFIG.SP_PO_TYPES,
        JSon: JSON.stringify([{
          PrmCompanyId:  DEFAULT_COMPANY_ID,
          PrmDivisionId: Number(divisionId),
          PrmYearId:     PO_CONFIG.CONFIG_YEAR_ID,
          PrmUserId:     DEFAULT_LOGIN_ID,
          PrmFormTag:    PO_CONFIG.FORM_TAG,
          PrmRefType:    '',
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.ConfigurationId),
        label: r.Name,
      }));
      setPoTypeOptions(opts);
      return opts;
    } catch (err) {
      console.warn('[PO] PO Type fetch failed:', err);
      setPoTypeOptions([]);
      return [];
    } finally {
      setIsLoadingPoTypes(false);
    }
  }, [get]);

  // ── fetchSupplierInfo — derive CurrencyID, CurrencyRate, CrDays ────
  // Returns { CurrencyID, CurrencyRate, CrDays } or null on failure.
  // CONFIRM: SP_SUPPLIER_INFO returns these fields for the given SupplierID.
  const fetchSupplierInfo = useCallback(async (supplierId) => {
    if (!supplierId || supplierId === '0') return null;
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 1,
        ObjName: PO_CONFIG.SP_SUPPLIER_INFO,
        JSon: JSON.stringify([{ PrmSupplierID: Number(supplierId) }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const row = res?.Table?.[0];
      if (!row) return null;
      return {
        CurrencyID:   row.CurrencyID   ?? 0,
        CurrencyRate: row.CurrencyRate ?? 0,
        CrDays:       row.CrDays       ?? 0,
      };
    } catch (err) {
      console.warn('[PO] Supplier info fetch failed:', err);
      return null;
    }
  }, [get]);

  // ── fetchExistingPOs — Amend dropdown ──────────────────────────────
  const fetchExistingPOs = useCallback(async () => {
    setIsLoadingExistingPOs(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PO_CONFIG.SP_EXISTING_POS,
        JSon: JSON.stringify([{
          prmLoginID:   DEFAULT_LOGIN_ID,
          prmCompanyID: DEFAULT_COMPANY_ID,
          prmYearID:    PO_CONFIG.DIVISION_YEAR_ID,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.IDNumber ?? r.POId ?? r.TranID),
        label: r.TranCode ?? r.PONo ?? String(r.IDNumber),
      }));
      setExistingPOs(opts);
      return opts;
    } catch (err) {
      console.warn('[PO] Existing POs fetch failed:', err);
      setExistingPOs([]);
      return [];
    } finally {
      setIsLoadingExistingPOs(false);
    }
  }, [get]);

  // ── fetchHeaderMeta ─────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);

    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PO_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: PO_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error('No PO header RB metadata returned from server.');

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      setHeaderRbMeta(hdrMeta);
      localStorage.setItem(PO_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      console.log('%c[PO] Header meta stored:', 'color:#8b5cf6;font-weight:600', hdrMeta);

      const [colData, divisionData, supplierData, currencyData] = await Promise.all([
        get(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: hdrMeta.RBID,
          prmLoginID:  DEFAULT_LOGIN_ID,
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PO_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmUserID:    DEFAULT_LOGIN_ID,
            prmCompanyID: DEFAULT_COMPANY_ID,
            prmYearID:    PO_CONFIG.DIVISION_YEAR_ID,
          }]),
          p_ErrCode: -1, p_ErrMsg: '',
        }).catch((err) => { console.warn('[PO] Division fetch failed:', err); return null; }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PO_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([{
            PrmDivisionId: 0,
            PrmLoginId:    DEFAULT_LOGIN_ID,
            PrmYearId:     PO_CONFIG.CONFIG_YEAR_ID,
            PrmPartyType:  PO_CONFIG.SUPPLIER_PARTY_TYPE,
          }]),
          p_ErrCode: -1, p_ErrMsg: '',
        }).catch((err) => { console.warn('[PO] Supplier fetch failed:', err); return null; }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 1,
          ObjName: PO_CONFIG.SP_CURRENCIES,
          JSon: JSON.stringify([{ PrmCurrencyID: 0 }]),
          p_ErrCode: -1, p_ErrMsg: '',
        }).catch((err) => { console.warn('[PO] Currency fetch failed:', err); return null; }),
      ]);

      setHeaderColumns(colData?.Links || []);
      console.log('%c[PO] Header columns received:', 'color:#8b5cf6;font-weight:600', (colData?.Links || []).length);

      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({
          value: String(r.DivisionID),
          label: r.DivisionName,
        })),
      );

      setIsLoadingSuppliers(true);
      setSupplierOptions(
        (supplierData?.Table || []).map((r) => ({
          value: String(r.SupplierID ?? r.PartyID),
          label: r.SupplierName ?? r.PartyName,
        })),
      );
      setIsLoadingSuppliers(false);

      setCurrencyOptions(
        (currencyData?.Table || []).map((r) => ({
          value: String(r.CurrencyID),
          label: r.CurrencyName ?? r.CurrencyCode ?? String(r.CurrencyID),
        })),
      );
    } catch (err) {
      console.error('[PO] fetchHeaderMeta failed:', err);
      setHeaderError(err?.message || 'Failed to load PO header configuration.');
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchDetailMeta ─────────────────────────────────────────────────
  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);

    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get, PO_CONFIG.RB_DETAIL, PO_CONFIG.STORAGE_ENTRY_META,
      );
      rawDetailRbMetaRef.current  = meta;
      rawDetailColumnsRef.current = apiColumns;
      setEventColumns(buildEventColumnSet(apiColumns, [
        'ItemID', 'ItemCode', 'TranQty', 'BaseQty', 'UnitConvRate', 'TranRate', 'TranUnit',
      ]));
      setAllColumns(
        apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null })),
      );
      console.log('%c[PO] Detail columns received:', 'color:#6366f1;font-weight:600', apiColumns.length);
    } catch (err) {
      console.error('[PO] fetchDetailMeta failed:', err);
      setMetaError(err?.message || 'Failed to load PO item grid configuration.');
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns ────────────────────────────────────────────────
  const fetchGridColumns = useCallback(async (divisionID = 0) => {
    const apiColumns = rawDetailColumnsRef.current;
    const meta       = rawDetailRbMetaRef.current;

    if (!apiColumns.length || !meta) {
      console.warn('[PO] fetchGridColumns called before fetchDetailMeta completed.');
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(
        get, apiColumns, meta.RBID,
        { funcCode: PO_CONFIG.RB_DETAIL, divisionID: Number(divisionID) || 0 },
      );
      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable:  false,
        allEditable: true,
      });
      setColumns(gridColumns);
      console.log('%c[PO] Grid columns built:', 'color:#22c55e;font-weight:600', gridColumns.length);
      return gridColumns;
    } catch (err) {
      console.error('[PO] fetchGridColumns failed:', err);
      return [];
    }
  }, [get]);

  // ── saveTxn ─────────────────────────────────────────────────────────
  const saveTxn = useCallback(async (headerValues, detailRows, genIDNumber = 0) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const mstMeta = JSON.parse(localStorage.getItem(PO_CONFIG.STORAGE_HEADER_META) || 'null');
      const detMeta = JSON.parse(localStorage.getItem(PO_CONFIG.STORAGE_ENTRY_META)  || 'null');

      if (!mstMeta || !detMeta) {
        throw new Error('Missing save configuration. Please refresh and try again.');
      }

      const cleanedRows = detailRows.map(({ id, ...rest }) => rest);
      const body = {
        PrmStrMstRBName:          PO_CONFIG.RB_MASTER,
        prmStrMstJSON:            JSON.stringify([headerValues]),
        prmstrMasterSaveProcName: mstMeta?.SaveProcName,
        prmstrDetailSaveProcName: detMeta?.SaveProcName,
        PrmStrDetRBName:          PO_CONFIG.RB_DETAIL,
        prmStrDetJSON:            JSON.stringify(cleanedRows),
        GenIDNumber:              genIDNumber,
        p_ErrCode:                -1,
        p_ErrMsg:                 '',
      };

      const result = await axios.post(
        `${baseURL}${ENDPOINTS.RB_MASTER_DETAIL_FORM_SAVE}`,
        body,
        {
          timeout: API_TIMEOUT,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        },
      );

      console.log('%c[PO] Save result:', 'color:#22c55e;font-weight:600', result.data);
      return result.data;
    } catch (err) {
      console.error('[PO] saveTxn failed:', err);
      setSaveError(err?.message || 'Save failed. Please try again.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [baseURL]);

  const clearPoTypes   = useCallback(() => setPoTypeOptions([]), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    // header
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    // dropdown options
    divisionOptions,
    poTypeOptions,
    supplierOptions,
    currencyOptions,
    existingPOs,
    // loaders
    isLoadingPoTypes,
    isLoadingSuppliers,
    isLoadingExistingPOs,
    // cascade / derive
    fetchPoTypes,
    clearPoTypes,
    fetchSupplierInfo,
    fetchExistingPOs,
    // detail grid
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    // save
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  };
}
```

---

### `src/pages/purchase-order/PurchaseOrderPage.jsx`
*PO listing page*

```jsx
// PurchaseOrderPage.jsx
// Purchase Order listing / landing page.
// Mirrors PurchaseInquiryPage.jsx exactly — same grid, toolbar, navigation pattern.
// Clicking Add New → /purchase-order/new (PurchaseOrderForm in new mode)
// Clicking Edit   → /purchase-order/:id  (PurchaseOrderForm in edit mode)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Pencil } from 'lucide-react';
import EnterpriseDataGrid from '../../components/grid/EnterpriseDataGrid';
import { useApi } from '../../api/useApi';
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
} from '../../api/constants';
import { usePageHeader } from '../../context/PageHeaderContext';
import { PO_CONFIG } from './constants';
import './PurchaseOrderPage.css';

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatListDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = MONTH_ABBR[d.getMonth()];
  return `${dd}-${mon}-${d.getFullYear()}`;
}

function buildListParams() {
  const year = new Date().getFullYear();
  return {
    ObjType: PO_CONFIG.LIST_OBJ_TYPE,
    ObjName: PO_CONFIG.SP_PO_LIST,
    JSon: JSON.stringify([
      {
        prmCompanyID:  DEFAULT_COMPANY_ID,
        prmDivisionID: PO_CONFIG.LIST_DIVISION_ID,
        prmFroDate:    `${year}-01-01`,
        prmToDate:     `${year}-12-31`,
        prmLoginID:    DEFAULT_LOGIN_ID,
        prmYearID:     PO_CONFIG.CONFIG_YEAR_ID,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg:  '',
  };
}

function buildPoColumns(navigate) {
  return [
    {
      key:       'PONo',
      label:     'PO No.',
      width:     '13%',
      filterable: true,
      align:     'left',
    },
    {
      key:        'PODate',
      label:      'PO Date',
      width:      '10%',
      filterable: true,
      filterType: 'date',
      render:     (value) => formatListDate(value),
    },
    {
      key:        'ExpectedDate',
      label:      'Expected Date',
      width:      '10%',
      filterable: true,
      filterType: 'date',
      render:     (value) => formatListDate(value),
    },
    {
      key:        'Division',
      label:      'Division',
      width:      '12%',
      filterable: true,
      align:      'left',
    },
    {
      key:        'POType',
      label:      'PO Type',
      width:      '13%',
      filterable: true,
      align:      'left',
    },
    {
      key:        'SupplierName',
      label:      'Supplier',
      width:      '15%',
      filterable: true,
      align:      'left',
    },
    {
      key:        'Currency',
      label:      'Currency',
      width:      '8%',
      filterable: true,
      align:      'left',
    },
    {
      key:        'CreatedBy',
      label:      'Created By',
      width:      '10%',
      filterable: true,
      align:      'left',
    },
    {
      key:        'CreatedDate',
      label:      'Created Date',
      width:      '10%',
      filterable: true,
      filterType: 'date',
      render:     (value) => formatListDate(value),
    },
    {
      key:    '_actions',
      label:  'Edit',
      width:  '4%',
      align:  'center',
      render: (_value, row) => (
        <button
          type="button"
          className="po-list__edit-btn"
          title={`Edit PO ${row.PONo ?? ''}`}
          aria-label={`Edit PO ${row.PONo ?? ''}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/purchase-order/${row.IDNUMBER}`);
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function PurchaseOrderPage() {
  const navigate    = useNavigate();
  const { get }     = useApi(API_BASE_URL);

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(8);

  usePageHeader({
    title:    'Purchase Orders',
    subtitle: 'Browse purchase orders or create a new one.',
    showBack: true,
    backTo:   '/',
  });

  const columns = useMemo(() => buildPoColumns(navigate), [navigate]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(json?.Table ?? []);
    } catch (err) {
      console.error('[PurchaseOrderPage] list fetch failed:', err);
      setError('Failed to load purchase orders.');
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleAddNew = useCallback(() => {
    navigate('/purchase-order/new');
  }, [navigate]);

  return (
    <div className="workspace-page po-list-page">
      <section className="po-list-panel po-list-panel--compact po-list-panel--fill">
        <header className="po-list-panel__header">
          <div className="po-list-panel__title">
            <ShoppingCart size={14} strokeWidth={2} />
            <span>Purchase Orders</span>
          </div>
          <div className="po-list-panel__toolbar">
            <button type="button" className="po-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              Add New
            </button>
            <label htmlFor="po-list-page-size" className="po-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="po-list-page-size"
              className="ng-select po-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </header>

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading purchase orders…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase orders found."
          hideHeader
          fill
        />
      </section>
    </div>
  );
}
```

---

### `src/pages/purchase-order/PurchaseOrderPage.css`
*PO listing + form CSS (includes amend strip)*

```css
/* PurchaseOrderPage.css */

/* ── Listing page ── */
.po-list-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.po-list-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.po-list-panel--fill {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.po-list-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 40px;
  flex-shrink: 0;
  padding: 0 16px;
  background: #f4f6f9;
  border-bottom: 1px solid var(--border);
}

.po-list-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--primary);
}

.po-list-panel__toolbar {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.po-list-panel__add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--primary);
  border-radius: var(--radius);
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.po-list-panel__add-btn:hover {
  filter: brightness(1.05);
}

.po-list-panel__pagesize-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.po-list-panel__pagesize-select {
  height: 26px;
  min-width: 56px;
  padding: 0 24px 0 8px;
}

.po-list-panel .ng-card {
  border: none;
  border-radius: 0;
  box-shadow: none;
  flex: 1;
  min-height: 0;
}

.po-list-panel .ng-card-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.po-list__edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--primary);
  cursor: pointer;
}

.po-list__edit-btn:hover {
  background: #eef3fa;
  border-color: var(--primary);
}

/* ── Form page shell ── */
.po-page {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 0;
  display: flex;
  flex-direction: column;
}

.po-page .efq-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

/* ── Amend strip ────────────────────────────────────────────────────── */
.po-amend-strip {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 16px 6px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  min-height: 38px;
}

.po-amend-strip__checkbox {
  display: flex;
  align-items: center;
  gap: 7px;
}

.po-amend-strip__chk-input {
  width: 14px;
  height: 14px;
  accent-color: var(--primary);
  cursor: pointer;
  flex-shrink: 0;
}

.po-amend-strip__chk-input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.po-amend-strip__chk-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.po-amend-strip__select {
  width: 300px;
}

/* ── 3-tab grid section ── */
.po-grid-section {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  height: 320px;
  min-height: 0;
  border: 2px solid var(--primary);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(30, 74, 122, 0.08);
  overflow: hidden;
}

.po-tab-pane {
  display: none;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.po-tab-pane--active {
  display: flex;
  flex-direction: column;
}

.po-tab-pane .erp-grid-container {
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.po-terms-pane {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
  background: var(--surface);
}

/* ── Misc sections ── */
.po-page__section {
  flex-shrink: 0;
}

/* ── Tab-bar action buttons ── */
.po-tab-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}

.po-tab-action-btn:hover:not(:disabled) {
  background: var(--primary-lighter);
  border-color: var(--primary);
  color: var(--primary);
}

.po-tab-action-btn:active:not(:disabled) {
  background: var(--primary-light);
}

.po-tab-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Approved label + compact SearchSelect ── */
.po-tab-filter {
  display: flex;
  align-items: center;
  gap: 5px;
}

.po-tab-filter__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ── Delete button ── */
.po-tab-delete-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  color: var(--danger);
  background: #fef2f2;
  border: 1px solid rgba(217, 48, 37, 0.25);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition);
  white-space: nowrap;
}

.po-tab-delete-btn:hover:not(:disabled) {
  background: #fde8e8;
  border-color: var(--danger);
}

.po-tab-delete-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Terms & Conditions table ── */
.po-terms-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 400px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.po-terms-table thead tr {
  background: var(--col-base-header-bg);
}

.po-terms-table th {
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--col-base-header-text);
  text-align: left;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.po-terms-table th:last-child { border-right: none; }

.po-terms-table td {
  padding: 6px 12px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

.po-terms-table td:last-child { border-right: none; }

.po-terms-empty {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
  font-style: italic;
  font-size: 12px;
  border-right: none !important;
}
```

---

### `src/pages/purchase-order/PurchaseOrderForm.jsx`
*PO entry form (+ Amend strip, SupplierID→Currency auto-fill)*

```jsx
// PurchaseOrderForm.jsx
// Purchase Order entry form (add / edit).
// Mirrors PurchaseInquiryForm.jsx exactly — same three-phase load, same 3-tab layout.
// PO-specific additions vs PI: Amend strip, Currency, Cr. Days, Supplier auto-fill on select.
//
// Layout (top → bottom):
//   1. Amend strip          — checkbox + conditional PO-select dropdown
//   2. EnterpriseFilterPanel — header fields (PO No, Date, Division, PO Type,
//                              Based On, Supplier, Currency, Currency Rate, Cr. Days, Exp. Date)
//   3. po-grid-section       — 3-tab wrapper
//        • Item Grid tab  → EntryGrid (API columns, RB_PurOrderDet)
//                           buttons: Add New | Select Item
//        • Suppliers tab  → EntryGrid (hardcoded SUPPLIER_GRID_CONFIG)
//                           button: Select Supplier
//        • Terms tab      → static terms table
//        Fixed controls (always): Approved filter | Delete
//   4. POActionBar           — Save / Cancel / Close etc.

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, Truck, Plus, Trash2, Package, FileText, Printer, Save, LogOut,
} from 'lucide-react';
import EnterpriseFilterPanel from '../../components/filters/EnterpriseFilterPanel';
import EntryGrid             from '../../components/grid/EntryGrid';
import ActionBar             from '../../components/ui/ActionBar';
import SupplierPickerModal   from '../../components/purchase-inquiry/SupplierPickerModal';
import OrderItemModal        from '../../components/txn/OrderItemModal';
import SearchSelect          from '../../components/ui/SearchSelect';
import { usePurchaseOrder }  from '../../hooks/usePurchaseOrder';
import { useApi }            from '../../api/useApi';
import {
  ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, DEFAULT_LOGIN_ID, getColDefault, OBJ_TYPE,
} from '../../api/constants';
import { buildGridColumns }  from '../../utils/gridUtils';
import { usePageHeader }     from '../../context/PageHeaderContext';
import {
  PO_CONFIG,
  PO_HEADER_FILTERS,
  PO_GRID_TABS,
  APPROVED_OPTS,
  TERMS_COLUMNS,
  PO_FILTER_CASCADE_RESETS,
  SUPPLIER_GRID_CONFIG,
  formatTranDate,
} from './constants';
import './PurchaseOrderPage.css';

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _poTempId = -1;
const nextTempId = () => _poTempId--;

function mapPickerToSupplierRow(item, srNo) {
  return {
    id:           String(item.SupplierID ?? nextTempId()),
    SrNo:         srNo,
    SupplierName: item.SupplierName ?? '',
    Address:      item.SuppAddress ?? item.Address ?? '',
    City:         item.City ?? '',
    MobileNo:     item.ContactNo ?? item.MobileNo ?? '',
  };
}

function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
  Object.entries(item).forEach(([k, v]) => {
    if (k !== 'id' && v != null && Object.prototype.hasOwnProperty.call(row, k)) row[k] = v;
  });
  return row;
}

// ── Component ──────────────────────────────────────────────────────────

export default function PurchaseOrderForm() {
  const { id: routeId } = useParams();
  const location        = useLocation();
  const isNewRoute      = location.pathname.endsWith('/new') || routeId === 'new';
  const recordId        = isNewRoute ? 0 : Number(routeId) || 0;
  const navigate        = useNavigate();

  const itemGridRef              = useRef(null);
  const supplierGridRef          = useRef(null);
  const gridColumnsLoadedRef     = useRef(false);
  const queuedRowsRef            = useRef([]);
  const { get: getLive }         = useApi(API_BASE_URL);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, poTypeOptions, supplierOptions, currencyOptions,
    existingPOs,
    fetchPoTypes, clearPoTypes,
    fetchSupplierInfo,
    fetchExistingPOs,
    isLoadingPoTypes,
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    saveTxn, isSaving, saveError, clearSaveError,
  } = usePurchaseOrder(API_BASE_URL);

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const headerValuesRef = useRef({
    TranCode:     '',
    TranDate:     todayISO,
    POTypeID:     0,
    ExpectedDate: null,
    DivisionID:   0,
    SupplierID:   0,
    CurrencyID:   0,
    CurrencyRate: 0,
    CrDays:       0,
    BasedOnID:    '0',
    CompanyID:    1,
    YearID:       PO_CONFIG.DIVISION_YEAR_ID,
    LoginID:      1,
    IDNumber:     recordId,
    IsAmend:      0,
    AmendPOID:    0,
  });

  const filterInitialValues = useMemo(
    () => ({ BasedOnID: '0', TranDate: todayISO }),
    [todayISO],
  );

  const [filterResetKey, setFilterResetKey] = useState(0);

  // ── Amend strip state ──────────────────────────────────────────────
  const [isAmend,   setIsAmend]   = useState(false);
  const [amendPOID, setAmendPOID] = useState('');

  const handleAmendChange = useCallback(async (checked) => {
    setIsAmend(checked);
    headerValuesRef.current.IsAmend = checked ? 1 : 0;
    if (!checked) {
      setAmendPOID('');
      headerValuesRef.current.AmendPOID = 0;
      return;
    }
    await fetchExistingPOs();
  }, [fetchExistingPOs]);

  const handleAmendPOChange = useCallback((val) => {
    setAmendPOID(val);
    headerValuesRef.current.AmendPOID = Number(val) || 0;
  }, []);

  // ── Edit-mode gate ─────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);
  const enterEditMode = useCallback(() => setIsEditMode(true),  []);
  const exitEditMode  = useCallback(() => setIsEditMode(false), []);

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('items');

  const [itemSelectionCount,     setItemSelectionCount]     = useState(0);
  const [supplierSelectionCount, setSupplierSelectionCount] = useState(0);
  const activeSelectionCount = activeTab === 'items'     ? itemSelectionCount
    : activeTab === 'suppliers' ? supplierSelectionCount
    : 0;

  const [approvedFilter,   setApprovedFilter]   = useState('all');
  const [isGridLoading,    setIsGridLoading]     = useState(false);

  // Supplier picker modal
  const [supplierModalOpen,    setSupplierModalOpen]    = useState(false);
  const [supplierModalItems,   setSupplierModalItems]   = useState([]);
  const [supplierModalLoading, setSupplierModalLoading] = useState(false);
  const [supplierModalError,   setSupplierModalError]   = useState(null);

  // Item picker modal
  const [itemModalOpen,    setItemModalOpen]    = useState(false);
  const [itemModalItems,   setItemModalItems]   = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError,   setItemModalError]   = useState(null);

  // Collapsible indent children (indent-wise mode)
  const [childRowsMap, setChildRowsMap] = useState({});
  const [childColumns, setChildColumns] = useState([]);

  usePageHeader({
    title:    isNewRoute ? 'New Purchase Order' : 'Purchase Order',
    subtitle: isNewRoute
      ? 'Fill in the header fields, then use Item Grid or Suppliers tabs.'
      : `PO #${recordId || routeId || '—'} — fill in the header fields, then use Item Grid or Suppliers tabs.`,
    showBack: true,
    backTo:   '/purchase-order',
  });

  // ── Mount: load metadata ───────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta();
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current) return;
    fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns]);

  useEffect(() => {
    if (columns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      queuedRowsRef.current = [];
    }
  }, [columns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── syncedFilters — inject dynamic options ─────────────────────────
  const syncedFilters = useMemo(() => {
    const injectOptions = (filter) => {
      switch (filter.FilterParameterID) {
        case 'DivisionID': return { ...filter, staticOptions: divisionOptions };
        case 'POTypeID':   return { ...filter, staticOptions: poTypeOptions };
        case 'SupplierID': return { ...filter, staticOptions: supplierOptions };
        case 'CurrencyID': return { ...filter, staticOptions: currencyOptions };
        default:           return filter;
      }
    };

    if (headerColumns.length === 0) return PO_HEADER_FILTERS.map(injectOptions);

    const apiColMap = {};
    headerColumns.forEach((col) => { apiColMap[col.ColName] = col; });

    return PO_HEADER_FILTERS.map((filter) => {
      const withOpts = injectOptions(filter);
      const apiCol   = apiColMap[filter.FilterParameterID] || apiColMap[filter.FilterColName];
      if (!apiCol) return withOpts;
      return {
        ...withOpts,
        FilterColName:     apiCol.ColName,
        FilterColCtrlType: apiCol.ColCtrlType ?? withOpts.FilterColCtrlType,
      };
    });
  }, [headerColumns, divisionOptions, poTypeOptions, supplierOptions, currencyOptions]);

  // ── Filter change / cascade ────────────────────────────────────────
  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === 'DivisionID') {
      headerValuesRef.current.POTypeID = 0;
      clearPoTypes();
      if (val && val !== '0') await fetchPoTypes(val);
      return;
    }

    if (colName === 'SupplierID' && val && val !== '0') {
      const info = await fetchSupplierInfo(val);
      if (info) {
        headerValuesRef.current.CurrencyID   = info.CurrencyID;
        headerValuesRef.current.CurrencyRate = info.CurrencyRate;
        headerValuesRef.current.CrDays       = info.CrDays;
      }
    }
  }, [fetchPoTypes, clearPoTypes, fetchSupplierInfo]);

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0);
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns]);

  // ── Add New (Items tab) ────────────────────────────────────────────
  const handleAddNew = useCallback(async () => {
    if (isFetching || isGridLoading) return;
    setActiveTab('items');
    const activeCols = await ensureItemColumns();
    if (!activeCols || activeCols.length === 0) return;
    const blankRow = { id: nextTempId() };
    allColumns.forEach(({ key, colDataType }) => { blankRow[key] = getColDefault(colDataType); });
    addItemRow(blankRow);
  }, [isFetching, isGridLoading, ensureItemColumns, allColumns, addItemRow]);

  // ── Select Item ────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const { DivisionID, POTypeID, TranDate, BasedOnID } = headerValuesRef.current;
    const divisionID = DivisionID ?? 0;
    if (!divisionID || divisionID === '0' || divisionID === 0) {
      alert('Please select a Division before selecting items.');
      return;
    }

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const rbCode = Number(BasedOnID) === 2
        ? PO_CONFIG.RB_ITEM_PICKER_INDENT
        : PO_CONFIG.RB_ITEM_PICKER_DIRECT;

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PO_CONFIG.SP_RB_META,
        JSon:    JSON.stringify([{ prmRBCode: rbCode }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error('Could not load item picker configuration.');

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      const gridColumns = buildGridColumns(colRes?.Links || [], {}, {
        filterable: false, allEditable: false,
      });
      setItemModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PO_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([{
          prmDivisionID: Number(divisionID),
          prmYearID:     PO_CONFIG.CONFIG_YEAR_ID,
          prmLoginID:    DEFAULT_LOGIN_ID,
          prmTranDate:   formatTranDate(TranDate),
          prmConfigID:   Number(POTypeID ?? 0),
          prmSupplierID: Number(headerValuesRef.current?.SupplierID ?? 0),
          prmTranBook:   PO_CONFIG.TRAN_BOOK,
          prmFrmOption:  Number(BasedOnID) || 0,
        }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      setItemModalItems(rowRes?.Table || []);
    } catch (err) {
      console.error('[PO] Item picker fetch failed:', err);
      setItemModalError(err?.message || 'Failed to fetch items.');
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    setActiveTab('items');

    const isIndentWise = Number(headerValuesRef.current?.BasedOnID) === 2;

    if (!isIndentWise) {
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) return;
      setChildRowsMap({});
      setChildColumns([]);
      selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
      return;
    }

    ensureItemColumns().catch(() => {});

    const cleanItems = selectedItems.map(({ id: _id, ...rest }) => rest);
    setIsGridLoading(true);
    try {
      const summaryResponse = await fetch(`${API_BASE_URL_IMS}${ENDPOINTS.API_VALUES}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ObjType:   OBJ_TYPE.FUNCTION,
          ObjName:   PO_CONFIG.SP_INDENT_SUMMARY,
          JSon:      [{ prmJSon: cleanItems }],
          p_ErrCode: -1,
          p_ErrMsg:  '',
        }),
      });
      const summaryRes = await summaryResponse.json();

      const parents = summaryRes?.Table ?? [];
      if (!parents.length) return;

      const newChildRowsMap = {};
      parents.forEach((parent) => {
        const pid      = String(Math.round(Number(parent.ItemID)));
        const children = cleanItems.filter(
          (c) => String(Math.round(Number(c.ChildFKey))) === pid,
        );
        if (children.length > 0) newChildRowsMap[pid] = children;
        addItemRow({ ...parent, id: pid });
      });

      setChildRowsMap((prev) => ({ ...prev, ...newChildRowsMap }));
      setChildColumns(itemModalColumns.filter((c) => c.key !== 'cb'));
    } catch (err) {
      console.error('[PO] Indent summary fetch failed:', err);
    } finally {
      setIsGridLoading(false);
    }
  }, [ensureItemColumns, allColumns, addItemRow, itemModalColumns]);

  // ── Select Supplier ────────────────────────────────────────────────
  const handleSelectSupplier = useCallback(async () => {
    const divisionID = headerValuesRef.current?.DivisionID ?? 0;
    if (!divisionID || divisionID === '0' || divisionID === 0) {
      alert('Please select a Division before selecting suppliers.');
      return;
    }
    setSupplierModalOpen(true);
    setSupplierModalItems([]);
    setSupplierModalError(null);
    setSupplierModalLoading(true);
    try {
      const response = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PO_CONFIG.SUPPLIER_SP,
        JSon: JSON.stringify([{
          PrmDivisionId: Number(divisionID),
          PrmLoginId:    DEFAULT_LOGIN_ID,
          PrmYearId:     PO_CONFIG.CONFIG_YEAR_ID,
          PrmPartyType:  PO_CONFIG.SUPPLIER_PARTY_TYPE,
        }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      setSupplierModalItems(
        (response?.Table || []).map((row, idx) => ({
          ...row,
          id: String(row.SupplierID ?? `sup_${idx}`),
        })),
      );
    } catch (err) {
      console.error('[PO] Supplier fetch failed:', err);
      setSupplierModalError(err?.message || 'Failed to fetch suppliers.');
    } finally {
      setSupplierModalLoading(false);
    }
  }, [getLive]);

  const handleInsertSuppliers = useCallback((selectedSuppliers) => {
    if (!selectedSuppliers?.length) return;
    setActiveTab('suppliers');
    const existing    = supplierGridRef.current?.getRows?.() ?? [];
    const existingIds = new Set(existing.map((r) => String(r.SupplierID ?? r.id)));
    let nextSrNo      = existing.length;
    selectedSuppliers.forEach((item) => {
      const sid = String(item.SupplierID ?? item.id);
      if (existingIds.has(sid)) return;
      existingIds.add(sid);
      nextSrNo += 1;
      supplierGridRef.current?.addRow(mapPickerToSupplierRow(item, nextSrNo));
    });
  }, []);

  // ── Delete selected rows ───────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    const ref = activeTab === 'items'     ? itemGridRef
              : activeTab === 'suppliers' ? supplierGridRef
              : null;
    if (!ref?.current) return;
    const selected = ref.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    ref.current.removeRows?.(selected.map((r) => r.id));
    if (activeTab === 'suppliers') {
      const remaining = ref.current.getRows?.() ?? [];
      remaining.forEach((row, idx) => {
        if (Object.prototype.hasOwnProperty.call(row, 'SrNo')) {
          ref.current.updateRow?.(row.id, { SrNo: idx + 1 });
        }
      });
    }
  }, [activeTab]);

  // ── Save ───────────────────────────────────────────────────────────
  const [isSavingPO, setIsSavingPO] = useState(false);

  const handleSave = useCallback(async () => {
    const mstRow = {};
    headerColumns.forEach((col) => { mstRow[col.ColName] = getColDefault(col.ColDataType); });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => { if (k !== 'id') mstRow[k] = v; });
    mstRow.LoginID = DEFAULT_LOGIN_ID;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
      return { ...row, ...rest, LoginID: DEFAULT_LOGIN_ID };
    });

    const indentDetailRows = Object.values(childRowsMap)
      .flat()
      .map(({ id: _id, ...rest }) => ({ ...rest, LoginID: DEFAULT_LOGIN_ID }));

    const payload = {
      prmStrMstJSON:     JSON.stringify([mstRow]),
      prmStrDetJSON:     JSON.stringify(detRows),
      prmStrIndtDetJSON: JSON.stringify(indentDetailRows),
    };

    console.log('%c[PO Save] Payload:',      'color:#f59e0b;font-weight:700', payload);
    console.log('%c[PO Save] Master:',       'color:#6366f1;font-weight:600', [mstRow]);
    console.log('%c[PO Save] Detail:',       'color:#22c55e;font-weight:600', detRows);
    console.log('%c[PO Save] IndentDetail:', 'color:#ec4899;font-weight:600', indentDetailRows);

    setIsSavingPO(true);
    try {
      const res = await fetch(`${API_BASE_URL_IMS}${PO_CONFIG.SAVE_ENDPOINT}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      console.log('%c[PO Save] Response:', 'color:#22c55e;font-weight:700', result);
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert('Purchase Order saved successfully!');
    } catch (err) {
      console.error('[PO Save] Failed:', err);
      alert(err?.message || 'Save failed. Please try again.');
    } finally {
      setIsSavingPO(false);
    }
  }, [headerColumns, allColumns, childRowsMap]);

  const handleSaveAndPrint = useCallback(async () => {
    await handleSave();
    window.print();
  }, [handleSave]);

  const handleCancel = useCallback(() => {
    if (!window.confirm('Discard changes and reset the form?')) return;

    localStorage.removeItem(PO_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(PO_CONFIG.STORAGE_ENTRY_META);
    sessionStorage.removeItem(PO_CONFIG.STORAGE_HEADER_META);
    sessionStorage.removeItem(PO_CONFIG.STORAGE_ENTRY_META);

    headerValuesRef.current = {
      TranCode: '', TranDate: todayISO, POTypeID: 0, ExpectedDate: null,
      DivisionID: 0, SupplierID: 0, CurrencyID: 0, CurrencyRate: 0,
      CrDays: 0, BasedOnID: '0', CompanyID: 1,
      YearID: PO_CONFIG.DIVISION_YEAR_ID, LoginID: 1, IDNumber: 0,
      IsAmend: 0, AmendPOID: 0,
    };

    queuedRowsRef.current       = [];
    gridColumnsLoadedRef.current = false;

    clearPoTypes();
    clearSaveError();

    setIsAmend(false);
    setAmendPOID('');
    setActiveTab('items');
    setApprovedFilter('all');
    setIsGridLoading(false);
    setItemSelectionCount(0);
    setSupplierSelectionCount(0);

    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);

    setChildRowsMap({});
    setChildColumns([]);

    setSupplierModalOpen(false);
    setSupplierModalItems([]);
    setSupplierModalLoading(false);
    setSupplierModalError(null);

    itemGridRef.current?.clearRows?.();
    supplierGridRef.current?.clearRows?.();

    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [clearPoTypes, clearSaveError, exitEditMode, todayISO]);

  const handleClose    = useCallback(() => navigate('/purchase-order'), [navigate]);
  const handleDocument = useCallback(() => {
    console.log('[PO] Document F6 — reserved for document generation.');
  }, []);

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;
  const filterBusy    = headerFetching || isLoadingPoTypes;

  const poExtraButtons = useMemo(() => [
    { key: 'document',  label: 'Document F6',                          Icon: FileText, variant: 'secondary', onClick: handleDocument },
    { key: 'sep1',      separator: true },
    { key: 'saveprint', label: 'Save & Print',                         Icon: Printer,  variant: 'print',     onClick: handleSaveAndPrint, disabled: isSavingPO },
    { key: 'save',      label: isSavingPO ? 'Saving…' : 'Save',       Icon: Save,     variant: 'save',       onClick: handleSave,         disabled: isSavingPO, loading: isSavingPO },
    { key: 'sep2',      separator: true },
    { key: 'close',     label: 'Close',                                 Icon: LogOut,   variant: 'close',     onClick: handleClose },
  ], [handleDocument, handleSaveAndPrint, isSavingPO, handleSave, handleClose]);

  return (
    <div className="workspace-page po-page">

      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchDetailMeta(); }}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* ── Amend strip ─────────────────────────────────────── */}
            <div className="po-amend-strip">
              <div className="po-amend-strip__checkbox">
                <input
                  type="checkbox"
                  id="po-amend-chk"
                  className="po-amend-strip__chk-input"
                  checked={isAmend}
                  onChange={(e) => handleAmendChange(e.target.checked)}
                  disabled={!isEditMode}
                />
                <label htmlFor="po-amend-chk" className="po-amend-strip__chk-label">
                  Amend
                </label>
              </div>

              {isAmend && (
                <div className="po-amend-strip__select">
                  <SearchSelect
                    value={amendPOID}
                    onChange={handleAmendPOChange}
                    options={existingPOs}
                    placeholder="Select PO to Amend…"
                    ariaLabel="Select PO to Amend"
                    disabled={!isEditMode}
                  />
                </div>
              )}
            </div>

            {/* ── Header filter panel ──────────────────────────────── */}
            <EnterpriseFilterPanel
              key={filterResetKey}
              title="Purchase Order Detail"
              staticFilters={syncedFilters}
              initialValues={filterInitialValues}
              cascadeResets={PO_FILTER_CASCADE_RESETS}
              onFilterChange={handleFilterChange}
              isSearching={filterBusy}
              disabled={!isEditMode}
            />
          </>
        )}
      </section>

      {/* ── 3-tab grid section ───────────────────────────────────────── */}
      <section className="po-grid-section">

        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {PO_GRID_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`grid-tab ${activeTab === t.id ? 'grid-tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid-tabbar__controls">
            {activeTab === 'items' && (
              <>
                <button
                  type="button"
                  className="po-tab-action-btn"
                  onClick={handleAddNew}
                  disabled={!isEditMode || isFetching || isGridLoading}
                  title="Add a blank item row"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Add New
                </button>
                <button
                  type="button"
                  className="po-tab-action-btn"
                  onClick={handleSelectItem}
                  disabled={!isEditMode}
                  title="Pick items from list"
                >
                  <Package size={12} strokeWidth={2.5} />
                  Select Item
                </button>
              </>
            )}

            {activeTab === 'suppliers' && (
              <button
                type="button"
                className="po-tab-action-btn"
                onClick={handleSelectSupplier}
                disabled={!isEditMode}
                title="Pick suppliers from list"
              >
                <Truck size={12} strokeWidth={2.5} />
                Select Supplier
              </button>
            )}

            <div className="po-tab-filter">
              <span className="po-tab-filter__label">Approved</span>
              <SearchSelect
                value={approvedFilter}
                onChange={setApprovedFilter}
                options={APPROVED_OPTS}
                compact
                ariaLabel="Approved filter"
              />
            </div>
            <button
              type="button"
              className="po-tab-delete-btn"
              onClick={handleDeleteSelected}
              disabled={!isEditMode || activeSelectionCount === 0}
              title="Delete selected rows"
            >
              <Trash2 size={12} strokeWidth={2} />
              Delete
            </button>
          </div>
        </div>

        <div className={`po-tab-pane${activeTab === 'items' ? ' po-tab-pane--active' : ''}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Add New or Select Item above."
            onSelectionChange={setItemSelectionCount}
            enableCollapsible={Object.keys(childRowsMap).length > 0}
            childRowsMap={childRowsMap}
            childColumns={childColumns}
          />
        </div>

        <div className={`po-tab-pane${activeTab === 'suppliers' ? ' po-tab-pane--active' : ''}`}>
          <EntryGrid
            ref={supplierGridRef}
            config={SUPPLIER_GRID_CONFIG}
            title=""
            hideBottomPanel
            emptyMessage="No suppliers added. Click Select Supplier above."
            onSelectionChange={setSupplierSelectionCount}
          />
        </div>

        {activeTab === 'terms' && (
          <div className="po-terms-pane">
            <table className="po-terms-table">
              <thead>
                <tr>{TERMS_COLUMNS.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={TERMS_COLUMNS.length} className="po-terms-empty">
                    No terms &amp; conditions added.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </section>

      <ActionBar
        isEditMode={isEditMode}
        onAdd={enterEditMode}
        onCancel={handleCancel}
        extraButtons={poExtraButtons}
      />

      <SupplierPickerModal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        items={supplierModalItems}
        isLoading={supplierModalLoading}
        error={supplierModalError}
        onInsert={handleInsertSuppliers}
      />

      <OrderItemModal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        items={itemModalItems}
        columns={itemModalColumns}
        isLoading={itemModalLoading}
        error={itemModalError}
        onInsert={handleInsertItems}
      />
    </div>
  );
}
```

---


## Part 14 — Other Pages

### `src/pages/dashboard/constants.js`
*Dashboard RB config*

```js
// constants.js — Enterprise Dashboard page config
// All SP names, IDs, and request defaults used by this page in one place.

export const DASHBOARD_CONFIG = {
  // SP / function name for the report board summary panel
  SP_REPORT_BOARDS:    'Fn_tbl_FetchReportBoardSummaryUserWise',
  REPORT_OBJ_TYPE:     2,

  // Request params
  LOGIN_ID:            1,
  DEFAULT_SUB_DESG_ID: 0,
};
```

---

### `src/pages/dashboard/EnterpriseDashboard.jsx`
*Dashboard page*

```jsx
import React from 'react';
import KpiStrip from '../../components/KpiStrip';
import ReportBoardPanel from '../../components/dashboard/ReportBoardPanel';
import TaskBoardPanel from '../../components/dashboard/TaskBoardPanel';
import DecisionPanel from '../../components/dashboard/DecisionPanel';
import './EnterpriseDashboard.css';

export default function EnterpriseDashboard() {
  return (
    <div className="ent-dashboard ent-dashboard--fill">
      <KpiStrip />
      <div className="ent-dashboard__main">
        <div className="ent-dashboard__left">
          <ReportBoardPanel compact />
        </div>
        <div className="ent-dashboard__right">
          <TaskBoardPanel />
          <DecisionPanel />
        </div>
      </div>
    </div>
  );
}
```

---

### `src/pages/dashboard/EnterpriseDashboard.css`
*Dashboard CSS*

```css
.ent-dashboard {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px;
  box-sizing: border-box;
}

/* Fill viewport below topbar — KPI fixed, main area flexes */
.ent-dashboard--fill {
  flex: 1;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
}

.ent-dashboard--fill .kpi-strip {
  flex-shrink: 0;
}

.ent-dashboard__main {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);
  gap: 12px;
  flex: 1;
  min-height: 0;
  align-items: stretch;
}

.ent-dashboard__left {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.ent-dashboard__right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .ent-dashboard__main {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .ent-dashboard--fill {
    height: auto;
    max-height: none;
    overflow: visible;
  }
}
```

---

### `src/pages/login/LoginPage.jsx`
*Login page (placeholder)*

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  LogIn,
  KeyRound,
} from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showError, setShowError] = useState(true);

  const handleSubmit = (event) => {
    event.preventDefault();
    setShowError(false);
    navigate('/');
  };

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-hero__content">
          <div className="login-hero__brand">
            <Box size={32} strokeWidth={1.5} />
            <h1>Horizon Enterprise</h1>
          </div>
          <div className="login-hero__intro">
            <h2>Horizon Enterprise Suite</h2>
            <p>Enterprise Resource Planning</p>
          </div>
        </div>
        <div className="login-hero__trust">
          <span><ShieldCheck size={14} /> Secure</span>
          <span className="login-hero__dot" />
          <span><Lock size={14} /> SOC 2</span>
          <span className="login-hero__dot" />
          <span><CheckCircle2 size={14} /> 99.9% Uptime</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel__inner">
          <div className="login-card">
            <div className="login-card__header">
              <div className="login-card__logo">
                <Box size={22} strokeWidth={1.5} />
              </div>
              <h3>Horizon Enterprise</h3>
              <p>Sign in to your account</p>
            </div>

            {showError && (
              <div className="login-error" role="alert">
                <AlertCircle size={16} />
                <span>Invalid email or password. Please try again.</span>
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              <label className="login-field">
                <span>Email address</span>
                <input type="email" name="email" placeholder="name@company.com" required autoFocus />
              </label>

              <div className="login-field">
                <div className="login-field__row">
                  <label htmlFor="password">Password</label>
                  <button type="button" className="login-field__link">Forgot password?</button>
                </div>
                <div className="login-field__password">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                  />
                  <button
                    type="button"
                    className="login-field__toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <label className="login-remember">
                <input type="checkbox" name="remember" defaultChecked />
                <span>Remember me for 30 days</span>
              </label>

              <button type="submit" className="login-submit">
                Sign In
                <LogIn size={16} />
              </button>
            </form>

            <div className="login-divider">
              <span>Internal Access Only</span>
            </div>

            <button type="button" className="login-sso">
              <KeyRound size={16} />
              Sign in with SSO
            </button>
          </div>

          <p className="login-footer">© 2026 Horizon Enterprise · All Rights Reserved</p>
        </div>
      </section>
    </main>
  );
}
```

---

### `src/pages/login/LoginPage.css`
*Login page CSS*

```css
.login-page {
  display: flex;
  height: 100vh;
  max-height: 100vh;
  overflow-y: auto;
}

.login-hero {
  display: none;
  width: 55%;
  padding: 48px;
  background: linear-gradient(135deg, #0f2d4a 0%, #1a3a5c 100%);
  color: #fff;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}

@media (min-width: 1024px) {
  .login-hero {
    display: flex;
  }
}

.login-hero__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.login-hero__brand h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.login-hero__intro {
  margin-top: 80px;
}

.login-hero__intro h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
}

.login-hero__intro p {
  margin: 0;
  font-size: 14px;
  color: #a8bdd4;
}

.login-hero__trust {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 12px;
  font-weight: 500;
  color: #a8bdd4;
}

.login-hero__trust span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.login-hero__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(168, 189, 212, 0.4);
}

.login-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
}

.login-panel__inner {
  width: 100%;
  max-width: 400px;
}

.login-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
  box-shadow: var(--shadow-md);
}

.login-card__header {
  text-align: center;
  margin-bottom: 24px;
}

.login-card__logo {
  width: 40px;
  height: 40px;
  margin: 0 auto 12px;
  border-radius: var(--radius-lg);
  background: var(--primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card__header h3 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.login-card__header p {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.login-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  margin-bottom: 20px;
  background: #fef2f1;
  border-left: 3px solid var(--danger);
  border-radius: var(--radius);
  color: var(--danger);
  font-size: 12px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.login-field span,
.login-field label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 6px;
}

.login-field input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.login-field input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(30, 74, 122, 0.15);
}

.login-field__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.login-field__row label {
  margin-bottom: 0;
}

.login-field__link {
  border: none;
  background: none;
  padding: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--primary);
  cursor: pointer;
}

.login-field__link:hover {
  text-decoration: underline;
}

.login-field__password {
  position: relative;
}

.login-field__password input {
  padding-right: 40px;
}

.login-field__toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  padding: 4px;
}

.login-field__toggle:hover {
  color: var(--text);
}

.login-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.login-remember input {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

.login-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 40px;
  border: none;
  border-radius: var(--radius-lg);
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition), transform var(--transition);
}

.login-submit:hover {
  opacity: 0.92;
}

.login-submit:active {
  transform: scale(0.98);
}

.login-divider {
  position: relative;
  margin: 28px 0;
  text-align: center;
}

.login-divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 1px solid var(--border);
}

.login-divider span {
  position: relative;
  padding: 0 8px;
  background: var(--surface);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
}

.login-sso {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition);
}

.login-sso:hover {
  background: var(--bg-tint);
}

.login-footer {
  margin-top: 24px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}
```

---

### `src/pages/report-workspace/ReportWorkspacePage.jsx`
*Dynamic RB report viewer*

```jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import EnterpriseFilterPanel from '../../components/filters/EnterpriseFilterPanel';
import EnterpriseGrid from '../../components/grid/EnterpriseGrid';
import Loader from '../../components/ui/Loader';
import { useGridSearch } from '../../hooks/useGridSearch';
import { gridMeta } from '../../data/dummyData';
import { AlertCircle, Search } from 'lucide-react';
import { usePageHeader } from '../../context/PageHeaderContext';
import { API_BASE_URL_OLD } from '../../api/constants';
import './ReportWorkspacePage.css';

export default function ReportWorkspacePage() {
  const [hasFilters, setHasFilters] = useState(null);
  const { reportBoardId } = useParams();
  const masterID = Number(reportBoardId);

  const {
    columns,
    rows,
    isSearching,
    searchError,
    hasSearched,
    masterDetail,
    fetchMasterDetail,
    handleSearch,
    saveSelectedRows,
  } = useGridSearch(API_BASE_URL_OLD);

  const reportTitle = masterDetail?.ReportDashBoardName || 'Report';

  usePageHeader({
    title: reportTitle,
    subtitle: 'Configure filters and search to load data.',
    showBack: true,
    backTo: '/',
  });

  useEffect(() => {
    if (masterID) fetchMasterDetail(masterID);
  }, [fetchMasterDetail, masterID]);

  const onSearch = (filterValues, filterDefs) => {
    handleSearch(filterValues, filterDefs, masterID);
  };

  return (
    <div className="workspace-page workspace-page--fill rw-page">
      <section className="workspace-page__filters">
        <EnterpriseFilterPanel
          masterID={masterID}
          apiBaseUrl={API_BASE_URL_OLD}
          onSearch={onSearch}
          isSearching={isSearching}
          title={masterDetail?.ReportDashBoardName || gridMeta.title}
          onFiltersLoaded={setHasFilters}
        />
      </section>

      <section className="workspace-page__grid">
        {searchError && (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{searchError}</span>
          </div>
        )}

        {isSearching && <Loader text="Loading Data..." />}

        {hasSearched && columns.length > 0 ? (
          <EnterpriseGrid
            config={{
              columns,
              pagination: {
                pageSize: 25,
                pageSizeOptions: [10, 25, 50, 100],
              },
            }}
            initialData={rows}
            title={gridMeta.title}
            onSave={saveSelectedRows}
          />
        ) : (
          !isSearching &&
          !searchError && (
            <div className="workspace-empty">
              <Search size={40} strokeWidth={1.5} />
              <p>
                {hasFilters === false ? (
                  <>Click <strong>Search</strong> to load data.</>
                ) : (
                  <>Set your filters and click <strong>Search</strong> to load data.</>
                )}
              </p>
            </div>
          )
        )}
      </section>
    </div>
  );
}
```

---

### `src/pages/report-workspace/ReportWorkspacePage.css`
*Report workspace CSS*

```css
.rw-page .efq-panel,
.rw-page .filter-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.rw-page .erp-grid-container {
  border-radius: var(--radius-lg);
}
```

---

### `src/pages/txn-entry/TxnEntryPage.jsx`
*Invoice/transaction entry page*

```jsx
// TxnEntryPage.jsx
// Transaction Entry page — Sample Invoice Detail
//
// Two separate API chains on mount:
//   1a. fetchHeaderMeta()  → RB_SampleInvMst → RBID → GetDetailColData → raw cols
//       └─ Synced with hardcoded TXN_HEADER_FILTERS (FilterColName ← ColName,
//          FilterCaption ← DisplayName, staticOptions ← dropdown data)
//   1b. fetchTxnMeta()     → RB_SampleInvDet → RBID → GetDetailColData → grid columns
//       └─ GET_FILTER_DETAIL for every ColCtrlType=4 column (dropdown options)
//
// GridForm (mode="entry") is hidden until the first "Add New" click.
// Row-state lives inside GridForm; parent pushes rows via gridRef.current.addRow().

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Plus } from 'lucide-react';
import EnterpriseFilterPanel from '../../components/filters/EnterpriseFilterPanel';
import EntryGrid from '../../components/grid/EntryGrid';
import OrderItemModal from '../../components/txn/OrderItemModal';
import { useTxnEntry } from '../../hooks/useTxnEntry';
import { useApi } from '../../api/useApi';
import { controlTypeMap } from '../../data/dummyData';
import { getColDefault, ENDPOINTS, API_BASE_URL_OLD, OBJ_TYPE } from '../../api/constants';
import { TXN_CONFIG } from './constants';
import { usePageHeader } from '../../context/PageHeaderContext';
import './TxnEntryPage.css';

// ── Hardcoded header fields (mirrors the image: Sample Invoice Detail) ──
// Shape matches what FilterPanel/FilterControl expects from the API.
// FilterColCtrlType:  1=TextBox  2=Date  4=Dropdown
// For Dropdown fields, leave staticOptions empty for now (wired later).
const TXN_HEADER_FILTERS = [
  {
    FilterParameterID: 'TranCode',
    FilterColName: 'TranCode',
    FilterCaption: 'Tran Code',
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: 'TranDate',
    FilterColName: 'TranDate',
    FilterCaption: 'Tran Date',
    FilterColCtrlType: controlTypeMap.DATE,
  },
  {
    FilterParameterID: 'Division',
    FilterColName: 'DivisionID',
    FilterCaption: 'Division',
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],   // populated from Fn_tbl_FetchUserWsDivision
  },
  {
    FilterParameterID: 'InvoiceType',
    FilterColName: 'InvoiceTypeID',
    FilterCaption: 'Invoice Type',
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],   // populated from fn_tbl_ddl_Sal_Configuration
  },
  {
    FilterParameterID: 'Supplier',
    FilterColName: 'SupplierID',
    FilterCaption: 'Supplier',
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],   // populated from Pr_Fetch_SupplierData_IMS
  },
  {
    FilterParameterID: 'Currency',
    FilterColName: 'CurrencyID',
    FilterCaption: 'Currency',
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: 'CurrencyRate',
    FilterColName: 'CurrencyRate',
    FilterCaption: 'Currency Rate',
    FilterColCtrlType: controlTypeMap.TEXTBOX,
  },
  {
    FilterParameterID: 'Department',
    FilterColName: 'DepartmentID',
    FilterCaption: 'Department',
    FilterColCtrlType: controlTypeMap.DROPDOWN,
    staticOptions: [],   // populated from Pr_Fetch_DepartmentData_IMS
  },
];

// ── Temp-ID generator (negative → never clash with real IDs) ─────────
let _tempId = -1;
const nextTempId = () => _tempId--;

export default function TxnEntryPage() {
  const { id: routeId } = useParams();
  const genIDNumber = routeId ? 1 : 0;
  const { get } = useApi(API_BASE_URL_OLD);
  const gridRef = useRef(null);

  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [invoiceTypeOptions, setInvoiceTypeOptions] = useState([]);

  const {
    columns, allColumns, isFetching, metaError, fetchTxnMeta, fetchGridColumns, fireCellEvent,
    headerColumns, headerDropdownOpts, divisionOptions, headerFetching, headerError, fetchHeaderMeta,
    saveTxn, isSaving, saveError,
  } = useTxnEntry(API_BASE_URL_OLD);

  const syncedFilters = useMemo(() => {
    const injectOptions = (filter) => {
      switch (filter.FilterParameterID) {
        case 'Division': return { ...filter, staticOptions: divisionOptions };
        case 'Department': return { ...filter, staticOptions: departmentOptions };
        case 'Supplier': return { ...filter, staticOptions: supplierOptions };
        case 'InvoiceType': return { ...filter, staticOptions: invoiceTypeOptions };
        default: return filter;
      }
    };

    if (headerColumns.length === 0) return TXN_HEADER_FILTERS.map(injectOptions);

    const apiColMap = {};
    headerColumns.forEach(col => { apiColMap[col.ColName] = col; });

    return TXN_HEADER_FILTERS.map(filter => {
      const withOpts = injectOptions(filter);
      const apiCol = apiColMap[filter.FilterParameterID] || apiColMap[filter.FilterColName];
      if (!apiCol) return withOpts;
      return {
        ...withOpts,
        FilterColName: apiCol.ColName,
        FilterCaption: apiCol.DisplayName,
        staticOptions:
          withOpts?.staticOptions?.length > 0
            ? withOpts.staticOptions
            : (headerDropdownOpts[apiCol.ColName] || []),
      };
    });
  }, [headerColumns, headerDropdownOpts, divisionOptions, departmentOptions, supplierOptions, invoiceTypeOptions]);

  const headerValuesRef = useRef({
    TranCode: '', TranDate: null, DivisionID: 0, InvoiceTypeID: 0,
    SupplierID: 0, CurrencyID: 0, CurrencyRate: 0, DepartmentID: 0,
    CompanyID: 1.0, YearID: 13.0, SessionID: 4150836.0, LoginID: 1.0, IDNumber: 0,
  });

  const [showGrid, setShowGrid] = useState(false);
  const queuedRowsRef = useRef([]);

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [orderItemsLoading, setOrderItemsLoading] = useState(false);
  const [orderItemsError, setOrderItemsError] = useState(null);

  const gridColumnsLoadedRef = useRef(false);
  const [isGridLoading, setIsGridLoading] = useState(false);

  useEffect(() => {
    fetchHeaderMeta();
    fetchTxnMeta();

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.PROCEDURE,
      ObjName: TXN_CONFIG.SP_DEPARTMENTS,
      JSon: JSON.stringify([{ PrmDeptID: 0 }]),
      p_ErrCode: -1, p_ErrMsg: '',
    }).then(res => {
      setDepartmentOptions((res?.Table || []).map(r => ({ value: String(r.DepartmentID), label: r.DepartmentName })));
    }).catch(err => console.warn('[TxnEntry] Department fetch failed:', err));

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.PROCEDURE,
      ObjName: TXN_CONFIG.SP_SUPPLIERS,
      JSon: JSON.stringify([{ PrmSupplierID: 0 }]),
      p_ErrCode: -1, p_ErrMsg: '',
    }).then(res => {
      setSupplierOptions((res?.Table || []).map(r => ({ value: String(r.SupplierID), label: r.SupplierName })));
    }).catch(err => console.warn('[TxnEntry] Supplier fetch failed:', err));

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.FUNCTION,
      ObjName: TXN_CONFIG.SP_INVOICE_TYPES,
      JSon: JSON.stringify([{
        PrmCompanyId: TXN_CONFIG.COMPANY_ID,
        PrmDivisionId: TXN_CONFIG.LOGIN_ID,
        PrmYearId: TXN_CONFIG.INVOICE_TYPE_YEAR_ID,
        PrmUserId: TXN_CONFIG.LOGIN_ID,
        PrmFormTag: TXN_CONFIG.FORM_TAG,
        PrmRefTYpe: '', prmRef_MstID: 0, prmRef_DetID: 0,
      }]),
      p_ErrCode: -1, p_ErrMsg: '',
    }).then(res => {
      setInvoiceTypeOptions((res?.Table || []).map(r => ({ value: String(r.InvoiceTypeID), label: r.Name })));
    }).catch(err => console.warn('[TxnEntry] InvoiceType fetch failed:', err));

  }, [fetchHeaderMeta, fetchTxnMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showGrid && gridRef.current && queuedRowsRef.current.length > 0) {
      queuedRowsRef.current.forEach(row => gridRef.current.addRow(row));
      queuedRowsRef.current = [];
    }
  }, [showGrid]);

  const handleAddNew = useCallback(async (_values) => {
    if (isFetching || isGridLoading) return;
    if (allColumns.length === 0) return;

    let activeCols = columns;
    if (!gridColumnsLoadedRef.current) {
      const divisionID = _values?.DivisionID ?? headerValuesRef.current?.DivisionID ?? 0;
      setIsGridLoading(true);
      try {
        activeCols = await fetchGridColumns(divisionID);
        gridColumnsLoadedRef.current = true;
      } finally {
        setIsGridLoading(false);
      }
      if (!activeCols || activeCols.length === 0) return;
    }

    const blankRow = { id: nextTempId() };
    allColumns.forEach(({ key, colDataType }) => { blankRow[key] = getColDefault(colDataType); });
    activeCols.forEach(col => {
      if (col.key !== 'cb' && !(col.key in blankRow)) blankRow[col.key] = getColDefault(col.colDataType);
    });

    if (!showGrid) { queuedRowsRef.current.push(blankRow); setShowGrid(true); }
    else gridRef.current?.addRow(blankRow);
  }, [columns, allColumns, showGrid, isFetching, isGridLoading, fetchGridColumns]);

  const handleOrderItem = useCallback(async (panelValues) => {
    const divisionID = panelValues?.DivisionID ?? headerValuesRef.current?.DivisionID ?? 0;
    if (!divisionID || divisionID === '0' || divisionID === 0) {
      alert('Please select a Division before ordering items.');
      return;
    }
    setOrderModalOpen(true);
    setOrderItems([]);
    setOrderItemsError(null);
    setOrderItemsLoading(true);
    try {
      const response = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.PROCEDURE,
        ObjName: TXN_CONFIG.SP_ORDER_ITEMS,
        JSon: JSON.stringify([{
          prmDivisionID: Number(divisionID),
          prmYearID: TXN_CONFIG.ORDER_ITEM_YEAR_ID,
          prmConfigID: TXN_CONFIG.ORDER_ITEM_CONFIG_ID,
        }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      setOrderItems(response?.Table || []);
    } catch (err) {
      console.error('[TxnEntry] Order item fetch failed:', err);
      setOrderItemsError(err?.message || 'Failed to fetch items. Please try again.');
    } finally {
      setOrderItemsLoading(false);
    }
  }, [get, headerValuesRef]);

  const handleInsertOrderItems = useCallback((selectedItems) => {
    if (!selectedItems?.length) return;
    const insertRow = async (item) => {
      let activeCols = columns;
      if (!gridColumnsLoadedRef.current) {
        const divisionID = headerValuesRef.current?.DivisionID ?? 0;
        setIsGridLoading(true);
        try {
          activeCols = await fetchGridColumns(divisionID);
          gridColumnsLoadedRef.current = true;
        } finally {
          setIsGridLoading(false);
        }
        if (!activeCols?.length) return;
      }
      const blankRow = { id: nextTempId() };
      allColumns.forEach(({ key, colDataType }) => { blankRow[key] = getColDefault(colDataType); });
      Object.keys(item).forEach(key => { if (key in blankRow) blankRow[key] = item[key]; });
      if (!showGrid) queuedRowsRef.current.push(blankRow);
      else gridRef.current?.addRow(blankRow);
    };
    (async () => {
      for (const item of selectedItems) await insertRow(item);
      if (!showGrid) setShowGrid(true);
    })();
  }, [columns, allColumns, showGrid, fetchGridColumns, gridColumnsLoadedRef]);

  const handleCellEvent = useCallback(async ({ rowId, colKey, rowData }) => {
    const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
    if (!result || !gridRef.current) return;
    const responseRow = result?.Links?.[0];
    if (!responseRow) return;
    const errCode = responseRow.ErrCode;
    if (errCode !== 1 && errCode !== 1.0) {
      console.warn('[TxnEntry] Cell-event error:', responseRow.ErrMsg ?? `ErrCode ${errCode}`);
      return;
    }
    const { ErrCode, ErrMsg, ...updatedFields } = responseRow;
    gridRef.current.updateRow?.(rowId, updatedFields);
  }, [fireCellEvent]);

  const handleFilterChange = useCallback((colName, value) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: value };
  }, []);

  const handleSave = useCallback(async () => {
    const selectedRows = gridRef.current?.getSelectedRows?.() ?? [];
    if (selectedRows.length === 0) {
      alert('No rows selected. Please check at least one row to save.');
      return;
    }
    try {
      const result = await saveTxn(headerValuesRef.current, selectedRows, genIDNumber);
      if (result) alert('Transaction saved successfully!');
    } catch (err) {
      alert(saveError || err?.message || 'Save failed.');
    }
  }, [saveTxn, genIDNumber, saveError]);

  const gridConfig = {
    columns,
    pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50, 100] },
  };

  const combinedError = metaError || headerError;

  usePageHeader({
    title: 'Sample Invoice',
    subtitle: 'Fill in the header fields, then click Add New to add line items.',
    showBack: true,
    backTo: '/',
  });

  return (
    <div className="workspace-page workspace-page--fill txn-page">
      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchTxnMeta(); }}>
              Retry
            </button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            title="Sample Invoice Detail"
            staticFilters={syncedFilters}
            onSearch={handleAddNew}
            onOrderItem={handleOrderItem}
            onFilterChange={handleFilterChange}
            isSearching={isGridLoading || headerFetching}
            actionLabel="Add New"
            ActionIcon={Plus}
          />
        )}
      </section>

      {showGrid && (
        <section className="workspace-page__grid">
          <EntryGrid
            ref={gridRef}
            config={gridConfig}
            title="Invoice Line Items"
            onSave={handleSave}
            onCellEvent={handleCellEvent}
          />
        </section>
      )}

      <OrderItemModal
        isOpen={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        items={orderItems}
        isLoading={orderItemsLoading}
        error={orderItemsError}
        onInsert={handleInsertOrderItems}
      />
    </div>
  );
}
```

---

### `src/pages/txn-entry/TxnEntryPage.css`
*TxnEntry CSS*

```css
.txn-page .efq-panel,
.txn-page .tef-panel,
.txn-page .filter-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
```

---

## Part 15 — Module N Template (Copy-Paste to Add Any New Module)

> Replace every `[placeholder]` with your module's actual values.
> Run through the 9-step checklist below after creating the files.

### Template: `src/pages/[module-route]/constants.js`
```js
// constants.js — [MODULE_NAME] config
// Copy this file into src/pages/[module-route]/constants.js
// Replace every PLACEHOLDER with confirmed values from the backend DBA.
import { controlTypeMap } from '../../data/dummyData';

export const [MODULE_PREFIX]_CONFIG = {
  // ── RB board codes (from DBA) ──────────────────────────────────────────
  RB_MASTER: 'RB_[Module]Mst',          // CONFIRM with DBA
  RB_DETAIL: 'RB_[Module]Det',          // CONFIRM with DBA

  // ── Form identifiers ────────────────────────────────────────────────────
  FORM_TAG:   '[TAG]',                   // e.g. 'INQ', 'PO', 'QT'
  TRAN_BOOK:  '[TRANBOOK]',              // e.g. 'PURINQUIRY', 'PO'

  // ── Year IDs ────────────────────────────────────────────────────────────
  CONFIG_YEAR_ID:   2,                   // CONFIRM
  DIVISION_YEAR_ID: 2,                   // CONFIRM

  // ── Supplier picker ─────────────────────────────────────────────────────
  SUPPLIER_PARTY_TYPE: 'S',
  SUPPLIER_SP: 'Fn_tbl_FetchCustomerSupplierTranWs4Web',

  // ── Item picker RB codes ─────────────────────────────────────────────────
  RB_ITEM_PICKER_DIRECT: 'RB_[Module]SelOnlyItem',  // CONFIRM
  RB_ITEM_PICKER_INDENT: 'RB_[Module]SelIndtItem',  // CONFIRM

  // ── Stored procedures ────────────────────────────────────────────────────
  SP_RB_META:        'Fn_Fetch_RBDetailByRBCode',
  SP_TYPES:          'fn_tbl_ddl_Pur_Configuration',     // CONFIRM — may differ
  SP_DIVISIONS:      'Fn_tbl_FetchUserWsDivision',
  SP_ITEM_PICKER:    'Fn_Tbl_FetchPurchaseItemDetailTransWs4Web', // CONFIRM
  SP_INDENT_SUMMARY: 'Fn_tbl_FetchIndentSummaryItem4Inquiry',    // CONFIRM

  // ── Based On options ─────────────────────────────────────────────────────
  BASED_ON_OPTIONS: [
    { value: '0', label: 'Direct' },
    { value: '2', label: 'Indent wise' },
  ],

  // ── Supplier grid columns (hardcoded) ────────────────────────────────────
  SUPPLIER_GRID_COLUMNS: [
    { id: 'cb',           name: '',             key: 'cb',           controlType: -1, width: 48,  isFixed: true,  isEditAllow: false },
    { id: 'SrNo',         name: 'Sr.No',        key: 'SrNo',         controlType: 0,  width: 70,  isFixed: false, isEditAllow: false },
    { id: 'SupplierName', name: 'Supplier Name',key: 'SupplierName', controlType: 0,  width: 200, isFixed: false, isEditAllow: false },
    { id: 'Address',      name: 'Address',      key: 'Address',      controlType: 0,  width: 220, isFixed: false, isEditAllow: false },
    { id: 'City',         name: 'City',         key: 'City',         controlType: 0,  width: 120, isFixed: false, isEditAllow: false },
    { id: 'MobileNo',     name: 'Mobile No.',   key: 'MobileNo',     controlType: 0,  width: 110, isFixed: false, isEditAllow: false },
  ],

  INDENT_FRM_OPTION: 0,

  // ── Save endpoint ─────────────────────────────────────────────────────────
  SAVE_ENDPOINT: '/API/TranFormSave/Post_RB_[Module]Mst_Save', // CONFIRM

  // ── localStorage keys ─────────────────────────────────────────────────────
  STORAGE_HEADER_META: '[prefix]HeaderMeta',
  STORAGE_ENTRY_META:  '[prefix]EntryMeta',

  // ── Listing ───────────────────────────────────────────────────────────────
  LIST_OBJ_TYPE:    2,
  SP_LIST:          'Fn_tbl_Pur_[Module]Mst_List', // CONFIRM with DBA
  LIST_DIVISION_ID: 15,                             // CONFIRM
};

export const [MODULE_PREFIX]_HEADER_FILTERS = [
  { FilterParameterID: 'TranCode',   FilterColName: 'TranCode',   FilterCaption: '[Module] No.', FilterColCtrlType: controlTypeMap.TEXTBOX },
  { FilterParameterID: 'TranDate',   FilterColName: 'TranDate',   FilterCaption: 'Date',         FilterColCtrlType: controlTypeMap.DATE },
  { FilterParameterID: 'DivisionID', FilterColName: 'DivisionID', FilterCaption: 'Division',     FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'ConfigID',   FilterColName: 'ConfigID',   FilterCaption: '[Module] Type',FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [] },
  { FilterParameterID: 'BasedOnID',  FilterColName: 'BasedOnID',  FilterCaption: 'Based On',     FilterColCtrlType: controlTypeMap.DROPDOWN, staticOptions: [MODULE_PREFIX]_CONFIG.BASED_ON_OPTIONS },
  { FilterParameterID: 'Remarks',    FilterColName: 'Remarks',    FilterCaption: 'Remark',       FilterColCtrlType: controlTypeMap.TEXTAREA },
];

export const [MODULE_PREFIX]_GRID_TABS = [
  { id: 'items',     label: 'Item Grid' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'terms',     label: 'Term And Conditions' },
];

export const [MODULE_PREFIX]_FILTER_CASCADE_RESETS = {
  DivisionID: ['ConfigID'],
};

export const SUPPLIER_GRID_CONFIG = {
  columns:    [MODULE_PREFIX]_CONFIG.SUPPLIER_GRID_COLUMNS,
  pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25] },
};

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function formatTranDate(dateVal) {
  if (!dateVal) return '0';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '0';
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

```

### Template: `src/hooks/use[Module].js`
```js
// use[Module].js
// Copy to src/hooks/use[Module].js
// Replace all [Module] / [PREFIX] / [CONFIG] references.
import { useState, useCallback } from 'react';
import { useApi } from '../api/useApi';
import { ENDPOINTS, API_BASE_URL, DEFAULT_LOGIN_ID, OBJ_TYPE } from '../api/constants';
import { [MODULE_PREFIX]_CONFIG } from '../pages/[module-route]/constants';
import { fetchDropdownOptions, buildGridColumns } from '../utils/gridUtils';

export function use[Module](baseURL = API_BASE_URL) {
  const [headerColumns,   setHeaderColumns]   = useState([]);
  const [headerFetching,  setHeaderFetching]  = useState(false);
  const [headerError,     setHeaderError]     = useState(null);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [typeOptions,     setTypeOptions]     = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [columns,         setColumns]         = useState([]);
  const [allColumns,      setAllColumns]      = useState([]);
  const [isFetching,      setIsFetching]      = useState(false);
  const [metaError,       setMetaError]       = useState(null);
  const [isLoadingTypes,  setIsLoadingTypes]  = useState(false);
  const { get } = useApi(baseURL);

  // ── Phase 1 — load header RB + divisions on mount ─────────────────────────
  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // 1a. Resolve RB code → RBID
      const rbRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: [MODULE_PREFIX]_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: [MODULE_PREFIX]_CONFIG.RB_MASTER }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error('No header RB metadata returned.');

      // 1b. Fetch column definitions + divisions in parallel
      const [colRes, divRes] = await Promise.all([
        get(ENDPOINTS.GET_DETAIL_COL_DATA, { prmMasterID: rbRow.RBID, prmLoginID: DEFAULT_LOGIN_ID }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: [MODULE_PREFIX]_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{ prmYearID: [MODULE_PREFIX]_CONFIG.DIVISION_YEAR_ID, prmLoginID: DEFAULT_LOGIN_ID }]),
          p_ErrCode: -1, p_ErrMsg: '',
        }),
      ]);

      setHeaderColumns(colRes?.Links || []);
      setDivisionOptions((divRes?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName })));
    } catch (err) {
      console.error('[Module] fetchHeaderMeta failed:', err);
      setHeaderError(err?.message || 'Failed to load header metadata.');
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── Phase 2 — load detail RB on mount ────────────────────────────────────
  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const rbRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: [MODULE_PREFIX]_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: [MODULE_PREFIX]_CONFIG.RB_DETAIL }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error('No detail RB metadata returned.');
      const colRes = await get(ENDPOINTS.GET_DETAIL_COL_DATA, { prmMasterID: rbRow.RBID, prmLoginID: DEFAULT_LOGIN_ID });
      const links = colRes?.Links || [];
      setAllColumns(links.map((col, idx) => ({
        id: col.ColName || String(idx), name: col.ColLabel || col.ColName, key: col.ColName,
        controlType: col.ColCtrlType, colDataType: col.ColDataType, isEditAllow: col.IsEditAllow,
      })));
    } catch (err) {
      console.error('[Module] fetchDetailMeta failed:', err);
      setMetaError(err?.message || 'Failed to load detail metadata.');
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── Phase 3 — lazy: build grid columns on first Add New / Select ──────────
  const fetchGridColumns = useCallback(async (divisionID) => {
    if (!allColumns.length) return [];
    setIsFetching(true);
    try {
      const dropdownData = await fetchDropdownOptions(get, allColumns, divisionID, DEFAULT_LOGIN_ID);
      const built = buildGridColumns(allColumns, dropdownData, { filterable: true, allEditable: false });
      setColumns(built);
      return built;
    } catch (err) {
      console.error('[Module] fetchGridColumns failed:', err);
      return [];
    } finally {
      setIsFetching(false);
    }
  }, [allColumns, get]);

  // ── Cascade helper: load type options when Division changes ───────────────
  const fetchTypes = useCallback(async (divisionID) => {
    setIsLoadingTypes(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: [MODULE_PREFIX]_CONFIG.SP_TYPES,
        JSon: JSON.stringify([{ prmDivisionID: Number(divisionID), prmYearID: [MODULE_PREFIX]_CONFIG.CONFIG_YEAR_ID, prmLoginID: DEFAULT_LOGIN_ID }]),
        p_ErrCode: -1, p_ErrMsg: '',
      });
      setTypeOptions((res?.Table || []).map((r) => ({ value: String(r.ConfigID ?? r.ID), label: r.ConfigName ?? r.Name ?? '' })));
    } catch (err) {
      console.error('[Module] fetchTypes failed:', err);
    } finally {
      setIsLoadingTypes(false);
    }
  }, [get]);

  const clearTypes = useCallback(() => setTypeOptions([]), []);

  return {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, typeOptions, supplierOptions,
    fetchTypes, clearTypes, isLoadingTypes,
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
  };
}

```

> **Note:** For the Page.jsx and Form.jsx templates, copy
> `PurchaseInquiryPage.jsx` / `PurchaseInquiryForm.jsx` from Part 12.
> Global-replace `PI` → your module prefix, `purchase-inquiry` → your route.

## Part 16 — Wiring a New Module (3 File Edits)

### Edit 1: `src/App.jsx`
```jsx
// src/App.jsx
// 1. Add imports:
import [Module]Page from './pages/[module-route]/[Module]Page';
import [Module]Form from './pages/[module-route]/[Module]Form';

// 2. Add routes inside AppLayout:
<Route path="[module-route]"      element={<[Module]Page />} />
<Route path="[module-route]/:id"  element={<[Module]Form />} />

```

### Edit 2: `src/layout/AppShell.jsx`
```jsx
// src/layout/AppShell.jsx — NAV_SECTIONS
// Find the 'Modules' section and add one line:
import { FileText } from 'lucide-react';   // or any lucide icon

// Inside NAV_SECTIONS:
{ to: '/[module-route]', icon: FileText, label: '[Module Display Name]', end: false },

```

### Edit 3: `src/api/constants.js`
```js
// src/api/constants.js — add at the bottom:
export { [MODULE_PREFIX]_CONFIG } from '../pages/[module-route]/constants';

```

## Part 17 — Full Module Checklist (9 Steps)

1. **Get backend values** — RB_MASTER, RB_DETAIL, SAVE_ENDPOINT, SP_LIST, SP_TYPES from the DBA.
2. **Create folder** — `src/pages/[module-route]/`
3. **Create `constants.js`** — copy template from Part 15, fill all CONFIRM values.
4. **Create `use[Module].js`** — copy template from Part 15, adapt cascade logic.
5. **Create `[Module]Page.jsx`** — copy `PurchaseInquiryPage.jsx`, replace PI_ → your prefix.
6. **Create `[Module]Form.jsx`** — copy `PurchaseInquiryForm.jsx`, replace PI_ → your prefix. Add module-specific strips (Amend, Currency) if needed.
7. **Create `[Module]Page.css`** — copy `PurchaseInquiryPage.css`, global-replace `pi-` → your prefix.
8. **Wire routes** — edit `App.jsx` (see Part 16, Edit 1).
9. **Wire nav + re-export** — edit `AppShell.jsx` and `constants.js` (see Part 16, Edits 2 & 3).

> ✅ Test with `npm run dev` — navigate to `/[module-route]` and `/[module-route]/new`.

---

*— End of IMS Full Blueprint —*