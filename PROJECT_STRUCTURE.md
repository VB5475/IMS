# Horizon Enterprise — IMS Project Structure & Handover Document

**Project:** Horizon Enterprise — Inventory Management System (IMS)  
**Application Name:** `horizon-enterprise`  
**Version:** v2.4.0  
**Document Owner:** Alex Mercer, Project Manager  
**Last Updated:** 2026-06-03  
**Status:** 🟢 Active Development

---

## 1. Project Overview

Horizon Enterprise IMS is a **frontend-only React SPA** that acts as an ERP workspace UI. It connects to a live ASP.NET Web Service backend via REST/SOAP endpoints. The UI is a configurable, metadata-driven system — column definitions, dropdown options, filter panels, and save procedures are all fetched dynamically from the API at runtime.

**Business Context:**

- Module in scope: Sample Invoice (Master + Detail transaction entry)
- Dashboard: Report board summary with KPI strip
- Report Workspace: Configurable grid-based report viewer

---

## 2. Tech Stack

| Layer              | Technology                  | Version |
| ------------------ | --------------------------- | ------- |
| UI Framework       | React                       | 19.2.6  |
| Routing            | React Router DOM            | 7.15.1  |
| Build Tool         | Vite                        | 8.0.12  |
| HTTP Client        | Axios                       | 1.16.0  |
| Icon Library       | Lucide React                | 1.16.0  |
| Language           | JavaScript (ES Modules)     | —       |
| Styling            | Vanilla CSS (CSS variables) | —       |
| Dev Plugin         | @vitejs/plugin-react        | 6.0.1   |
| Backend (external) | ASP.NET ASMX Web Service    | —       |

**No TypeScript. No UI component library. No state management library (Redux/Zustand). Pure React + CSS.**

---

## 3. Repository & Environment

```
Working Directory : d:\Hardik Shah CAI\Projects\IMS
Git Branch (active): 03-06-2026-Hardik_S
Main Branch       : main
Dev Server Port   : 5175
API Base URL      : http://122.179.135.100:8095/ERPWS_TB/webservice/WsIMS.asmx
```

**Scripts:**

```bash
npm run dev       # Start Vite dev server at http://localhost:5175
npm run build     # Production build → /dist
npm run preview   # Preview production build
```

---

## 4. Complete Folder Structure

```
IMS/
├── index.html                      # HTML entry point — mounts <div id="root">
├── vite.config.js                  # Vite config — port 5175, React plugin
├── package.json                    # Dependencies & scripts
├── package-lock.json
├── .gitignore
├── .claude/                        # Claude Code settings (not application code)
│   └── settings.local.json
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx                    # React DOM root — renders <App /> into #root
    ├── App.jsx                     # Router root — BrowserRouter + PageHeaderProvider + routes
    ├── index.css                   # Global reset / base styles
    │
    ├── api/                        # ALL API communication lives here
    │   ├── constants.js            # API_BASE_URL, ENDPOINTS, STORAGE_KEYS, DEFAULT_* IDs, helpers
    │   └── useApi.js               # Singleton Axios instance + useApi() hook
    │
    ├── components/                 # Reusable, page-agnostic UI components
    │   ├── KpiStrip.jsx            # KPI metrics bar (dashboard)
    │   ├── KpiStrip.css
    │   ├── PageHeaderCard.jsx      # Page-level title card
    │   ├── PageHeaderCard.css
    │   │
    │   ├── dashboard/              # Dashboard panel components
    │   │   ├── DecisionPanel.jsx
    │   │   ├── DecisionPanel.css
    │   │   ├── ReportBoardPanel.jsx
    │   │   ├── ReportBoardPanel.css
    │   │   ├── TaskBoardPanel.jsx
    │   │   └── TaskBoardPanel.css
    │   │
    │   ├── filters/                # Filter UI components
    │   │   ├── EnterpriseFilterPanel.jsx   # Advanced filter panel (text / date / select inputs)
    │   │   ├── enterprise-filter-base.css
    │   │   ├── enterprise-filter-modern.css
    │   │   └── enterprise-filter-query.css
    │   │
    │   ├── grid/                   # Data grid components (core of the application)
    │   │   ├── EnterpriseDataGrid.jsx      # Read-only paginated grid (report workspace)
    │   │   ├── EnterpriseDataGrid.css
    │   │   ├── EnterpriseGrid.jsx          # Grid base styles/structure
    │   │   ├── EnterpriseGrid.css
    │   │   ├── EntryGrid.jsx               # Editable entry grid (txn detail rows)
    │   │   ├── EntryGridBottomPanel.jsx    # Action buttons below entry grid (Add, Delete, etc.)
    │   │   ├── GridBottomPanel.jsx         # Pagination + summary for read-only grids
    │   │   ├── Columnfilter.jsx            # Column-level filter popup (per column)
    │   │   ├── column-filter.css
    │   │   └── gridColumnClass.js          # Column class helpers / width logic
    │   │
    │   ├── txn/                    # Transaction-specific components
    │   │   ├── TxnHeaderPanel.jsx          # Header filter panel (master form fields)
    │   │   ├── TxnHeaderPanel.css
    │   │   ├── OrderItemModal.jsx          # Modal for order item selection
    │   │   └── OrderItemModal.css
    │   │
    │   └── ui/                     # Generic primitive UI components
    │       ├── Loader.jsx                  # Loading spinner
    │       ├── loader.css
    │       ├── Modal.jsx                   # Generic modal wrapper
    │       ├── modal.css
    │       ├── SearchSelect.jsx            # Dropdown / autocomplete select
    │       └── search-select.css
    │
    ├── context/                    # React Context providers
    │   └── PageHeaderContext.jsx   # Top-bar title / subtitle / back-button state
    │
    ├── data/                       # Static mock / reference data
    │   └── dummyData.js            # controlTypeMap, gridMeta, sample columns & rows
    │
    ├── hooks/                      # Custom React hooks (business logic)
    │   ├── useTxnEntry.js          # All logic for TxnEntryPage (meta fetch, grid build, save)
    │   └── useGridSearch.js        # Grid search / filter logic
    │
    ├── layout/                     # App shell / layout wrappers
    │   ├── AppShell.jsx            # Sidebar + topbar layout — wraps all authenticated pages
    │   └── AppShell.css
    │
    ├── pages/                      # Route-level page components (thin — delegate to hooks/components)
    │   ├── LoginPage.jsx           # /login
    │   ├── LoginPage.css
    │   ├── EnterpriseDashboard.jsx # / (index route)
    │   ├── EnterpriseDashboard.css
    │   ├── ReportWorkspacePage.jsx # /main/:reportBoardId
    │   ├── ReportWorkspacePage.css
    │   ├── TxnEntryPage.jsx        # /txn-entry/:id?  (largest file ~21KB)
    │   └── TxnEntryPage.css
    │
    ├── theme/                      # Global design tokens & shared component styles
    │   ├── enterprise.css          # CSS variables (colours, spacing, shadows)
    │   ├── enterprise-components.css  # Shared component utility classes
    │   └── workspace-base.css      # Workspace layout base styles
    │
    └── utils/                      # Pure utility functions (no React)
        └── gridUtils.js            # fetchDropdownOptions(), buildGridColumns()
```

---

## 5. Application Routes

Defined in [src/App.jsx](src/App.jsx). All routes except `/login` are wrapped in `<AppLayout>` (AppShell).

| Route                  | Component             | Description                                  |
| ---------------------- | --------------------- | -------------------------------------------- |
| `/login`               | `LoginPage`           | Login screen (no shell)                      |
| `/`                    | `EnterpriseDashboard` | Default dashboard with KPI + report board    |
| `/main/:reportBoardId` | `ReportWorkspacePage` | Report viewer for a given report board ID    |
| `/txn-entry/:id?`      | `TxnEntryPage`        | Sample Invoice entry (new or edit via `:id`) |
| `*`                    | Redirect → `/`        | Catch-all redirect                           |

**Context:** `PageHeaderProvider` wraps the entire router so all pages can set the top-bar title/subtitle/back button via `usePageHeader()`.

---

## 6. API Layer

### Base URL

```
http://122.179.135.100:8095/ERPWS_TB/webservice/WsIMS.asmx
```

### Endpoints ([src/api/constants.js](src/api/constants.js))

| Constant                     | Endpoint                     | Purpose                                                 |
| ---------------------------- | ---------------------------- | ------------------------------------------------------- |
| `FN_FETCH_DATA`              | `/FN_Fetch_Data`             | Multi-purpose data fetch (ObjType + ObjName driven)     |
| `GET_FILTERS`                | `/GetFilters`                | Filter definitions for a given master ID                |
| `GET_FILTER_DETAIL`          | `/GetFilterDetail`           | Dropdown options for a specific filter parameter        |
| `GET_MASTER_DETAIL`          | `/GetMasterDetail`           | Master detail info (QueryName, FuncCode)                |
| `GET_PARAMETERS`             | `/GetParameters`             | Stored procedure parameters for a QueryName             |
| `GET_DETAIL_COL_DATA`        | `/GetDetailColData`          | Column definitions for a grid                           |
| `GET_MASTER_DATA_FILL`       | `/GetMasterDataFill`         | Grid row data (executes a built procedure string)       |
| `RB_REPORTBOARD_DETAIL_SAVE` | `/RB_ReportBoardDetail_Save` | Saves selected rows to backend                          |
| `FN_TBL_RB_GRID_EVENT`       | `/fn_tbl_RB_Grid_Event`      | Server-side cell calculation on Tab key                 |
| `RB_MASTER_DETAIL_FORM_SAVE` | `/RB_MasterDetailForm_Save`  | Saves master header + detail rows (POST with JSON body) |

### Default Identifiers

```js
DEFAULT_LOGIN_ID = 1;
DEFAULT_COMPANY_ID = 1;
DEFAULT_YEAR_ID = 13;
DEFAULT_SESSION_ID = 88;
DEFAULT_DIVISION_ID = 0;
API_TIMEOUT = 30000; // 30 seconds
```

### RB Codes (Report Board identifiers)

```js
DEFAULT_RB_CODE_TXN = "RB_SampleInvDet"; // detail grid
DEFAULT_RB_CODE_TXN_MST = "RB_SampleInvMst"; // master header
```

### localStorage Keys ([src/api/constants.js](src/api/constants.js))

```js
STORAGE_KEYS.MASTER_DETAIL = "masterDetail";
STORAGE_KEYS.TXN_ENTRY_META = "txnEntryMeta"; // { RBID, SaveProcName } for detail
STORAGE_KEYS.TXN_HEADER_META = "txnHeaderMeta"; // { RBID, SaveProcName } for master
```

### useApi Hook ([src/api/useApi.js](src/api/useApi.js))

- Creates a **singleton Axios instance** (`apiClient`) shared across the app.
- Exposes `get(endpoint, paramsObject)` and `post(endpoint, body, paramsObject)`.
- Params are serialised to `URLSearchParams` internally — callers pass plain objects.
- Null/undefined values are dropped; empty strings (`''`) and `0` are preserved.
- Request/response interceptors log all API traffic to console.
- Tracks concurrent requests via `activeRequests` ref — loading state only resets when all in-flight calls complete.

---

## 7. State Management Architecture

The project uses **React's built-in state only** — no external state library.

| Scope                  | Mechanism                              | Location                            |
| ---------------------- | -------------------------------------- | ----------------------------------- |
| App-wide top-bar state | React Context                          | `src/context/PageHeaderContext.jsx` |
| Page-level state       | `useState` / `useReducer` inside pages | Each page component                 |
| Transaction form logic | Custom hook                            | `src/hooks/useTxnEntry.js`          |
| Grid search/filter     | Custom hook                            | `src/hooks/useGridSearch.js`        |
| Session persistence    | `localStorage`                         | `STORAGE_KEYS` in `constants.js`    |

---

## 8. Key Files — Role & Responsibility

| File                                                                                     | Role                                                                                             |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [src/App.jsx](src/App.jsx)                                                               | Router root; wraps all routes in `PageHeaderProvider`; defines `AppLayout`                       |
| [src/layout/AppShell.jsx](src/layout/AppShell.jsx)                                       | Collapsible sidebar + fixed topbar; renders `{children}` in `<main>`                             |
| [src/api/constants.js](src/api/constants.js)                                             | Single source of truth for all endpoints, default IDs, RB codes, storage keys, column data types |
| [src/api/useApi.js](src/api/useApi.js)                                                   | Axios singleton + `useApi()` hook — the ONLY way to make API calls                               |
| [src/hooks/useTxnEntry.js](src/hooks/useTxnEntry.js)                                     | All business logic for transaction entry: meta fetch, grid column build, cell events, save       |
| [src/utils/gridUtils.js](src/utils/gridUtils.js)                                         | `fetchDropdownOptions()` and `buildGridColumns()` — pure utility, no React                       |
| [src/data/dummyData.js](src/data/dummyData.js)                                           | `controlTypeMap` (label=0, textbox=1, date=2, dropdown=4, textarea=9) and mock grid data         |
| [src/context/PageHeaderContext.jsx](src/context/PageHeaderContext.jsx)                   | `usePageHeader()` hook — pages call this to set the top-bar title/subtitle/back                  |
| [src/pages/TxnEntryPage.jsx](src/pages/TxnEntryPage.jsx)                                 | Largest page (~21KB) — Sample Invoice entry form; uses `useTxnEntry` hook                        |
| [src/components/grid/EntryGrid.jsx](src/components/grid/EntryGrid.jsx)                   | Editable grid with cell-level dropdown/date/textarea rendering                                   |
| [src/components/grid/EnterpriseDataGrid.jsx](src/components/grid/EnterpriseDataGrid.jsx) | Read-only paginated grid with column-level filters                                               |
| [src/components/txn/TxnHeaderPanel.jsx](src/components/txn/TxnHeaderPanel.jsx)           | Master header form — renders dynamic fields from API column definitions                          |

---

## 9. Transaction Entry Flow (useTxnEntry.js)

The most complex flow in the application. Three phases:

```
Mount
  ├─ fetchHeaderMeta()         [RB_SampleInvMst]
  │    1. FN_FETCH_DATA → RBID + SaveProcName  → localStorage (TXN_HEADER_META)
  │    2. GET_DETAIL_COL_DATA → header column defs
  │    3. fetchDropdownOptions + Fn_tbl_FetchUserWsDivision [parallel]
  │
  └─ fetchTxnMeta()            [RB_SampleInvDet]
       1. FN_FETCH_DATA → RBID + SaveProcName  → localStorage (TXN_ENTRY_META)
       2. GET_DETAIL_COL_DATA → allColumns (key + colDataType only)
          └─ Stored in rawDetailColumnsRef (NOT state) for deferred use

"Add New" click
  └─ fetchGridColumns(divisionID)
       Uses rawDetailColumnsRef (no re-fetch)
       1. fetchDropdownOptions → dropdown options per column
       2. buildGridColumns → final columns array for EntryGrid

Cell Tab (specific columns: ItemID, TranQty, BaseQty, BaseRate…)
  └─ fireCellEvent(colName, rowData, headerValues)
       → fn_tbl_RB_SampleInvDet_Event → recalculated row values

Save
  └─ saveTxn(headerValues, detailRows, genIDNumber)
       Reads SaveProcName from localStorage
       POST to /RB_MasterDetailForm_Save with JSON body
       genIDNumber=0 → new entry, 1 → edit
```

---

## 10. Component Hierarchy

```
<App>
  <BrowserRouter>
    <PageHeaderProvider>
      <Route /login>     → <LoginPage>               (no shell)
      <AppLayout>
        <AppShell>
          <Route />       → <EnterpriseDashboard>
                              <KpiStrip>
                              <ReportBoardPanel>
                              <TaskBoardPanel>
                              <DecisionPanel>

          <Route /main/:id> → <ReportWorkspacePage>
                                <EnterpriseFilterPanel>
                                <EnterpriseDataGrid>
                                  <Columnfilter>
                                  <GridBottomPanel>

          <Route /txn-entry/:id?> → <TxnEntryPage>
                                      <TxnHeaderPanel>     (master fields)
                                        <SearchSelect>
                                      <EntryGrid>          (detail rows)
                                        <EntryGridBottomPanel>
                                      <OrderItemModal>
        </AppShell>
      </AppLayout>
    </PageHeaderProvider>
  </BrowserRouter>
</App>
```

---

## 11. Control Type Map

Defined in [src/data/dummyData.js](src/data/dummyData.js). Used across grid and header panel rendering.

| Control Type | Value | Rendered As                    |
| ------------ | ----- | ------------------------------ |
| `LABEL`      | `0`   | Read-only text cell            |
| `TEXTBOX`    | `1`   | `<input type="text">`          |
| `DATE`       | `2`   | `<input type="date">`          |
| `DROPDOWN`   | `4`   | `<SearchSelect>` or `<select>` |
| `TEXTAREA`   | `9`   | `<textarea>`                   |

---

## 12. Column Data Types

Defined in [src/api/constants.js](src/api/constants.js). Used to seed default values for new rows.

| ColDataType prefix | Default value seeded |
| ------------------ | -------------------- |
| `numeric*`         | `0`                  |
| `varchar*`         | `''`                 |
| `datetime*`        | `null`               |
| unknown            | `null`               |

Helper: `getColDefault(colDataType)` — exported from `constants.js`.

---

## 13. Styling Architecture

**Convention: one CSS file per component, co-located with the component file.**

| File                                                                       | Scope                                                    |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| [src/index.css](src/index.css)                                             | Global reset, base body styles                           |
| [src/theme/enterprise.css](src/theme/enterprise.css)                       | CSS custom properties (design tokens — colours, spacing) |
| [src/theme/enterprise-components.css](src/theme/enterprise-components.css) | Shared utility classes used across multiple components   |
| [src/theme/workspace-base.css](src/theme/workspace-base.css)               | Workspace layout base                                    |
| `src/layout/AppShell.css`                                                  | Shell layout (sidebar, topbar, content area)             |
| `src/pages/*.css`                                                          | Page-level layout styles                                 |
| `src/components/**/*.css`                                                  | Component-scoped styles                                  |

**CSS class naming:** BEM-style with `ent-` prefix for enterprise shell classes (e.g., `ent-shell`, `ent-sidebar`, `ent-topbar`).

---

## 14. Navigation Structure (AppShell Sidebar)

Defined in [src/layout/AppShell.jsx](src/layout/AppShell.jsx) `NAV_SECTIONS` constant.

```js
Home
  └─ Dashboard     →  /

Modules
  └─ Invoices      →  /txn-entry
```

The sidebar is collapsible (toggle button). Collapsed state shows icons only.

---

## 15. Code Conventions & Patterns

1. **All API calls go through `useApi().get()` or `useApi().post()`** — never raw `axios` except in `saveTxn` (which uses `axios.post` directly for the JSON body save endpoint).
2. **All endpoints and default values are imported from `src/api/constants.js`** — never hardcoded in components.
3. **Page components are thin** — business logic lives in custom hooks in `src/hooks/`.
4. **No TypeScript** — project is pure JavaScript ES Modules.
5. **No third-party UI library** — all components are custom-built.
6. **CSS co-location** — every `.jsx` file has a matching `.css` file in the same folder.
7. **`dummyData.js` is reference data** — `controlTypeMap` is used in production logic; the `rows` export is mock data only.
8. **`localStorage`** is used only for `RBID` and `SaveProcName` persistence between fetches within a session.
9. **Grid column definitions are always fetched from the API** — never hardcoded (except for the dummy data used in development/testing).
10. **`getColDefault()`** must be used whenever seeding a new blank row — never manually set defaults per column.

---

## 16. Development Setup

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5175)
npm run dev

# Production build
npm run build
```

No `.env` file required — API URL is hardcoded in [src/api/constants.js](src/api/constants.js).

---

## 17. What Does NOT Exist (Important for Handover)

| Item                      | Status                                               |
| ------------------------- | ---------------------------------------------------- |
| TypeScript                | Not configured — project is JavaScript only          |
| Test suite                | No tests (unit, integration, or E2E)                 |
| README.md                 | Does not exist — this document is the reference      |
| .env / environment config | Not used — constants are hardcoded                   |
| State management library  | Not used — React Context + useState only             |
| UI component library      | Not used — all custom components                     |
| Backend code              | Not in this repo — external ASP.NET service          |
| Authentication logic      | Login page exists but auth guard not yet implemented |
| Error boundary            | Not implemented                                      |

---

## 18. Active Branch & Git Status

| Item           | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| Current Branch | `03-06-2026-Hardik_S`                                       |
| Main Branch    | `main`                                                      |
| Latest Commit  | `[REFACTOR]: refactored the FAMM project into newer layout` |
| Working Tree   | Clean (no uncommitted changes at handover)                  |

---

## 19. RACI Matrix

| Task                         | Responsible | Accountable | Consulted | Informed  |
| ---------------------------- | ----------- | ----------- | --------- | --------- |
| Frontend feature development | /tl + /fe   | /tl         | /po       | /pm       |
| API integration              | /tl + /node | /tl         | /ba       | /pm       |
| UX design                    | /ux         | /ux         | /po       | /pm       |
| QA & testing                 | /qa         | /qa         | /tl       | /pm, /avp |
| Sprint planning              | /scrum      | /pm         | /po, /tl  | /avp      |
| Product backlog              | /po         | /po         | /ba, /tl  | /pm       |
| Deployment                   | /devops     | /devops     | /tl       | /pm       |

---

## 20. Risk Register

| Risk                                                         | Likelihood | Impact | Mitigation                                           |
| ------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------- |
| API base URL is hardcoded                                    | High       | Medium | Move to environment variable before production       |
| No authentication guard on routes                            | High       | High   | Implement route protection after LoginPage           |
| No error boundaries                                          | Medium     | Medium | Add React error boundary at AppShell level           |
| No test suite                                                | High       | High   | Add unit tests for `useTxnEntry` and `gridUtils`     |
| `dummyData.js` mock rows may be used in prod unintentionally | Low        | Medium | Audit all imports of `rows` from `dummyData.js`      |
| localStorage cleared between sessions loses RBID meta        | Low        | Low    | Consider fetching meta on every mount (already done) |

---

_Document prepared by Alex Mercer, Project Manager — CAI Agentic AI Firm_  
_For questions: escalate to /avp (Nitin Bhargava)_
