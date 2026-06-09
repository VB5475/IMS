// generate-full-blueprint.cjs
// Produces IMS_FullBlueprint.md  AND  IMS_FullBlueprint.docx
// Both contain every source file so the project can be rebuilt without the git repo.
// Run: node docs/generate-full-blueprint.cjs
'use strict';

const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, VerticalAlign,
} = require('docx');
const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const MD_OUT  = path.join(__dirname, 'IMS_FullBlueprint.md');
const DOC_OUT = path.join(__dirname, 'IMS_FullBlueprint.docx');

// ── File manifest (order = doc order) ─────────────────────────────────────────
// Each entry: [displayPath, description, language]
const MANIFEST = [
  // ── Bootstrap ──────────────────────────────────────────────────────────────
  { section: '## Part 1 — Bootstrap & Entry Points', isHeading: true },
  ['package.json',        'Exact dependency list',                          'json'],
  ['vite.config.js',      'Vite 8 build configuration',                    'js'],
  ['src/main.jsx',        'React 19 DOM entry point',                      'jsx'],
  ['src/App.jsx',         'Root routing tree + context providers',         'jsx'],

  // ── Design System ──────────────────────────────────────────────────────────
  { section: '## Part 2 — Design System (CSS Tokens)', isHeading: true },
  ['src/index.css',                    'Global resets + theme imports',   'css'],
  ['src/theme/enterprise.css',          'Design tokens (colours, spacing, typography)',  'css'],
  ['src/theme/enterprise-components.css','Shared component base styles',  'css'],
  ['src/theme/workspace-base.css',      'Page/workspace layout helpers',  'css'],

  // ── API Layer ──────────────────────────────────────────────────────────────
  { section: '## Part 3 — API Layer', isHeading: true },
  ['src/api/constants.js',  'Base URLs, ENDPOINTS, OBJ_TYPE, defaults, getColDefault()', 'js'],
  ['src/api/useApi.js',     'Axios client cache + useApi hook (get / post / getWithBody)', 'js'],

  // ── Utilities & Static Data ────────────────────────────────────────────────
  { section: '## Part 4 — Utilities & Static Data', isHeading: true },
  ['src/data/dummyData.js',    'controlTypeMap (filter panel control-type constants)', 'js'],
  ['src/utils/gridUtils.js',   'buildGridColumns, fetchDropdownOptions, isTruthyApiFlag', 'js'],

  // ── Context ────────────────────────────────────────────────────────────────
  { section: '## Part 5 — React Context', isHeading: true },
  ['src/context/PageHeaderContext.jsx', 'PageHeaderProvider + usePageHeader hook (topbar title/subtitle/back)', 'jsx'],

  // ── Application Shell ──────────────────────────────────────────────────────
  { section: '## Part 6 — Application Shell', isHeading: true },
  ['src/layout/AppShell.jsx',   'Sidebar + topbar shell wrapping all authenticated pages', 'jsx'],
  ['src/layout/AppShell.css',   'Sidebar / topbar / layout CSS',                          'css'],

  // ── UI Primitives ──────────────────────────────────────────────────────────
  { section: '## Part 7 — UI Primitive Components', isHeading: true },
  ['src/components/ui/ActionBar.jsx',       'Sticky bottom action bar (Add/Cancel + custom buttons)', 'jsx'],
  ['src/components/ui/ActionBar.css',       'ActionBar styles',                                       'css'],
  ['src/components/ui/SearchSelect.jsx',    'Styled searchable <select> replacement',                 'jsx'],
  ['src/components/ui/search-select.css',   'SearchSelect styles',                                    'css'],
  ['src/components/ui/Loader.jsx',          'Loading spinner',                                        'jsx'],
  ['src/components/ui/loader.css',          'Loader styles',                                          'css'],
  ['src/components/ui/Modal.jsx',           'Generic overlay modal',                                  'jsx'],
  ['src/components/ui/modal.css',           'Modal styles',                                           'css'],

  // ── Filter Panel ───────────────────────────────────────────────────────────
  { section: '## Part 8 — Filter Panel', isHeading: true },
  ['src/components/filters/EnterpriseFilterPanel.jsx',     '3-column tabular filter panel for entry form headers', 'jsx'],
  ['src/components/filters/enterprise-filter-query.css',   'Filter panel primary CSS',                            'css'],
  ['src/components/filters/enterprise-filter-base.css',    'Filter panel base/legacy CSS',                        'css'],
  ['src/components/filters/enterprise-filter-modern.css',  'Filter panel modern variant CSS',                     'css'],

  // ── Grid Components ────────────────────────────────────────────────────────
  { section: '## Part 9 — Grid Components', isHeading: true },
  ['src/components/grid/gridColumnClass.js',       'Column class helpers for grid rendering',           'js'],
  ['src/components/grid/EnterpriseDataGrid.jsx',   'Read-only paginated listing grid',                  'jsx'],
  ['src/components/grid/EnterpriseDataGrid.css',   'EnterpriseDataGrid styles',                         'css'],
  ['src/components/grid/EnterpriseGrid.jsx',       'Core editable grid engine (used by EntryGrid)',     'jsx'],
  ['src/components/grid/EnterpriseGrid.css',       'EnterpriseGrid styles (largest CSS file)',          'css'],
  ['src/components/grid/EntryGrid.jsx',            'Ref-forwarded entry grid with add/remove/get API', 'jsx'],
  ['src/components/grid/EntryGridBottomPanel.jsx', 'Bottom panel for EntryGrid (row count, page nav)',  'jsx'],
  ['src/components/grid/GridBottomPanel.jsx',      'Bottom panel for generic grids',                    'jsx'],
  ['src/components/grid/CollapsibleGrid.jsx',      'Expandable parent/child row grid (indent details)', 'jsx'],
  ['src/components/grid/CollapsibleGrid.css',      'CollapsibleGrid styles',                            'css'],
  ['src/components/grid/InlineChildTable.jsx',     'Inline sub-table inside a parent row',              'jsx'],
  ['src/components/grid/InlineChildTable.css',     'InlineChildTable styles',                           'css'],
  ['src/components/grid/PopupGrid.jsx',            'Floating CBO popup grid (ComboBox Object cells)',   'jsx'],
  ['src/components/grid/PopupGrid.css',            'PopupGrid styles',                                  'css'],
  ['src/components/grid/Columnfilter.jsx',         'Per-column search filter row',                      'jsx'],
  ['src/components/grid/column-filter.css',        'Column filter row styles',                          'css'],

  // ── Picker Modals ──────────────────────────────────────────────────────────
  { section: '## Part 10 — Picker Modals & Transaction Components', isHeading: true },
  ['src/components/purchase-inquiry/SupplierPickerModal.jsx', 'Multi-select supplier picker modal',    'jsx'],
  ['src/components/txn/OrderItemModal.jsx',                   'Multi-select item picker modal',        'jsx'],
  ['src/components/txn/OrderItemModal.css',                   'OrderItemModal styles',                 'css'],
  ['src/components/txn/TxnHeaderPanel.jsx',                   'Header panel for txn-entry page',       'jsx'],
  ['src/components/txn/TxnHeaderPanel.css',                   'TxnHeaderPanel styles',                 'css'],

  // ── Dashboard Components ───────────────────────────────────────────────────
  { section: '## Part 11 — Dashboard Components', isHeading: true },
  ['src/components/KpiStrip.jsx',                    'KPI metric strip',              'jsx'],
  ['src/components/KpiStrip.css',                    'KpiStrip styles',               'css'],
  ['src/components/PageHeaderCard.jsx',              'Standalone page title card',    'jsx'],
  ['src/components/PageHeaderCard.css',              'PageHeaderCard styles',         'css'],
  ['src/components/dashboard/DecisionPanel.jsx',     'Approval queue panel',          'jsx'],
  ['src/components/dashboard/DecisionPanel.css',     'DecisionPanel styles',          'css'],
  ['src/components/dashboard/TaskBoardPanel.jsx',    'Kanban task board panel',       'jsx'],
  ['src/components/dashboard/TaskBoardPanel.css',    'TaskBoardPanel styles',         'css'],
  ['src/components/dashboard/ReportBoardPanel.jsx',  'RB report mini-viewer',         'jsx'],
  ['src/components/dashboard/ReportBoardPanel.css',  'ReportBoardPanel styles',       'css'],

  // ── Module 1: Purchase Inquiry ─────────────────────────────────────────────
  { section: '## Part 12 — Module 1: Purchase Inquiry (Canonical Pattern)', isHeading: true },
  ['src/pages/purchase-inquiry/constants.js',            'PI config: RB codes, SPs, filter defs, grid defs',            'js'],
  ['src/hooks/usePurchaseInquiry.js',                    'PI hook: all async state (header meta, columns, dropdowns)',   'js'],
  ['src/pages/purchase-inquiry/PurchaseInquiryPage.jsx', 'PI listing page (grid + Add New)',                            'jsx'],
  ['src/pages/purchase-inquiry/PurchaseInquiryPage.css', 'PI listing CSS',                                              'css'],
  ['src/pages/purchase-inquiry/PurchaseInquiryForm.jsx', 'PI entry form (filter panel + 3-tab grid + action bar)',      'jsx'],
  ['src/pages/purchase-inquiry/PurchaseInquiryForm.css', 'PI entry form CSS',                                           'css'],

  // ── Module 2: Purchase Order ───────────────────────────────────────────────
  { section: '## Part 13 — Module 2: Purchase Order (Variation — Amend + Currency)', isHeading: true },
  ['src/pages/purchase-order/constants.js',           'PO config: extends PI pattern + currency/supplier/amend fields', 'js'],
  ['src/hooks/usePurchaseOrder.js',                   'PO hook: extends PI hook + fetchPoTypes, fetchSupplierInfo',     'js'],
  ['src/pages/purchase-order/PurchaseOrderPage.jsx',  'PO listing page',                                               'jsx'],
  ['src/pages/purchase-order/PurchaseOrderPage.css',  'PO listing + form CSS (includes amend strip)',                  'css'],
  ['src/pages/purchase-order/PurchaseOrderForm.jsx',  'PO entry form (+ Amend strip, SupplierID→Currency auto-fill)',  'jsx'],

  // ── Other Pages ────────────────────────────────────────────────────────────
  { section: '## Part 14 — Other Pages', isHeading: true },
  ['src/pages/dashboard/constants.js',                  'Dashboard RB config',              'js'],
  ['src/pages/dashboard/EnterpriseDashboard.jsx',       'Dashboard page',                   'jsx'],
  ['src/pages/dashboard/EnterpriseDashboard.css',       'Dashboard CSS',                    'css'],
  ['src/pages/login/LoginPage.jsx',                     'Login page (placeholder)',          'jsx'],
  ['src/pages/login/LoginPage.css',                     'Login page CSS',                   'css'],
  ['src/pages/report-workspace/ReportWorkspacePage.jsx','Dynamic RB report viewer',         'jsx'],
  ['src/pages/report-workspace/ReportWorkspacePage.css','Report workspace CSS',              'css'],
  ['src/pages/txn-entry/TxnEntryPage.jsx',              'Invoice/transaction entry page',   'jsx'],
  ['src/pages/txn-entry/TxnEntryPage.css',              'TxnEntry CSS',                     'css'],
];

// ── Module N template ─────────────────────────────────────────────────────────
const MODULE_N_TEMPLATE = {
  constants: `// constants.js — [MODULE_NAME] config
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
  return \`\${dd}-\${MONTH_ABBR[d.getMonth()]}-\${d.getFullYear()}\`;
}
`,

  hook: `// use[Module].js
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
`,

  appShellAddition: `// src/layout/AppShell.jsx — NAV_SECTIONS
// Find the 'Modules' section and add one line:
import { FileText } from 'lucide-react';   // or any lucide icon

// Inside NAV_SECTIONS:
{ to: '/[module-route]', icon: FileText, label: '[Module Display Name]', end: false },
`,

  appJsxAddition: `// src/App.jsx
// 1. Add imports:
import [Module]Page from './pages/[module-route]/[Module]Page';
import [Module]Form from './pages/[module-route]/[Module]Form';

// 2. Add routes inside AppLayout:
<Route path="[module-route]"      element={<[Module]Page />} />
<Route path="[module-route]/:id"  element={<[Module]Form />} />
`,

  constantsAddition: `// src/api/constants.js — add at the bottom:
export { [MODULE_PREFIX]_CONFIG } from '../pages/[module-route]/constants';
`,
};

// ── Read a file safely ────────────────────────────────────────────────────────
function readFile(relPath) {
  const full = path.join(ROOT, relPath);
  try {
    return fs.readFileSync(full, 'utf8');
  } catch {
    return `// FILE NOT FOUND: ${relPath}\n`;
  }
}

// ── Detect language from extension ────────────────────────────────────────────
function langFromPath(relPath) {
  if (relPath.endsWith('.css'))  return 'css';
  if (relPath.endsWith('.json')) return 'json';
  if (relPath.endsWith('.jsx'))  return 'jsx';
  return 'js';
}

// ═════════════════════════════════════════════════════════════════════════════
// MARKDOWN GENERATOR
// ═════════════════════════════════════════════════════════════════════════════

function generateMarkdown() {
  const lines = [];

  // ── Cover ──────────────────────────────────────────────────────────────────
  lines.push(`# Horizon Enterprise IMS — Full Project Blueprint`);
  lines.push(`> **Self-contained cloning guide.** Contains complete source code of every file.`);
  lines.push(`> Copy the files in order and the project runs without any git repository.`);
  lines.push(``);
  lines.push(`**Stack:** React 19 · React Router 7 · Vite 8 · Axios 1.x · Lucide React  `);
  lines.push(`**Styling:** Vanilla CSS with design tokens  `);
  lines.push(`**No:** TypeScript · Redux · test suite`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // ── Bootstrap instructions ─────────────────────────────────────────────────
  lines.push(`## Quick Start`);
  lines.push(``);
  lines.push(`\`\`\`bash`);
  lines.push(`# 1. Create project with Vite`);
  lines.push(`npm create vite@latest horizon-enterprise -- --template react`);
  lines.push(`cd horizon-enterprise`);
  lines.push(``);
  lines.push(`# 2. Install exact runtime deps`);
  lines.push(`npm install react@^19 react-dom@^19 react-router-dom@^7 axios@^1 lucide-react@^1`);
  lines.push(``);
  lines.push(`# 3. Install dev deps`);
  lines.push(`npm install -D @vitejs/plugin-react@^6 vite@^8`);
  lines.push(``);
  lines.push(`# 4. Remove Vite boilerplate`);
  lines.push(`rm src/App.css src/assets/react.svg public/vite.svg`);
  lines.push(``);
  lines.push(`# 5. Create folder structure`);
  lines.push(`mkdir -p src/{api,components/{ui,grid,filters,dashboard,purchase-inquiry,txn},context,data,hooks,layout,pages/{dashboard,login,purchase-inquiry,purchase-order,report-workspace,txn-entry},theme,utils}`);
  lines.push(``);
  lines.push(`# 6. Copy every file from this document (Parts 1-14) into the matching path`);
  lines.push(``);
  lines.push(`# 7. Start dev server`);
  lines.push(`npm run dev`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // ── File manifest ──────────────────────────────────────────────────────────
  for (const entry of MANIFEST) {
    if (entry.isHeading) {
      lines.push(``);
      lines.push(entry.section);
      lines.push(``);
      continue;
    }

    const [relPath, description, lang] = entry;
    const source = readFile(relPath);
    const anchor = relPath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    lines.push(`### \`${relPath}\``);
    lines.push(`*${description}*`);
    lines.push(``);
    lines.push(`\`\`\`${lang || langFromPath(relPath)}`);
    lines.push(source.trimEnd());
    lines.push(`\`\`\``);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  // ── Module N template ──────────────────────────────────────────────────────
  lines.push(`## Part 15 — Module N Template (Copy-Paste to Add Any New Module)`);
  lines.push(``);
  lines.push(`> Replace every \`[placeholder]\` with your module's actual values.`);
  lines.push(`> Run through the 9-step checklist below after creating the files.`);
  lines.push(``);

  lines.push(`### Template: \`src/pages/[module-route]/constants.js\``);
  lines.push(`\`\`\`js`);
  lines.push(MODULE_N_TEMPLATE.constants);
  lines.push(`\`\`\``);
  lines.push(``);

  lines.push(`### Template: \`src/hooks/use[Module].js\``);
  lines.push(`\`\`\`js`);
  lines.push(MODULE_N_TEMPLATE.hook);
  lines.push(`\`\`\``);
  lines.push(``);

  lines.push(`> **Note:** For the Page.jsx and Form.jsx templates, copy`);
  lines.push(`> \`PurchaseInquiryPage.jsx\` / \`PurchaseInquiryForm.jsx\` from Part 12.`);
  lines.push(`> Global-replace \`PI\` → your module prefix, \`purchase-inquiry\` → your route.`);
  lines.push(``);

  // ── Wiring snippets ────────────────────────────────────────────────────────
  lines.push(`## Part 16 — Wiring a New Module (3 File Edits)`);
  lines.push(``);

  lines.push(`### Edit 1: \`src/App.jsx\``);
  lines.push(`\`\`\`jsx`);
  lines.push(MODULE_N_TEMPLATE.appJsxAddition);
  lines.push(`\`\`\``);
  lines.push(``);

  lines.push(`### Edit 2: \`src/layout/AppShell.jsx\``);
  lines.push(`\`\`\`jsx`);
  lines.push(MODULE_N_TEMPLATE.appShellAddition);
  lines.push(`\`\`\``);
  lines.push(``);

  lines.push(`### Edit 3: \`src/api/constants.js\``);
  lines.push(`\`\`\`js`);
  lines.push(MODULE_N_TEMPLATE.constantsAddition);
  lines.push(`\`\`\``);
  lines.push(``);

  // ── 9-step checklist ───────────────────────────────────────────────────────
  lines.push(`## Part 17 — Full Module Checklist (9 Steps)`);
  lines.push(``);
  const steps = [
    '**Get backend values** — RB_MASTER, RB_DETAIL, SAVE_ENDPOINT, SP_LIST, SP_TYPES from the DBA.',
    '**Create folder** — `src/pages/[module-route]/`',
    '**Create `constants.js`** — copy template from Part 15, fill all CONFIRM values.',
    '**Create `use[Module].js`** — copy template from Part 15, adapt cascade logic.',
    '**Create `[Module]Page.jsx`** — copy `PurchaseInquiryPage.jsx`, replace PI_ → your prefix.',
    '**Create `[Module]Form.jsx`** — copy `PurchaseInquiryForm.jsx`, replace PI_ → your prefix. Add module-specific strips (Amend, Currency) if needed.',
    '**Create `[Module]Page.css`** — copy `PurchaseInquiryPage.css`, global-replace `pi-` → your prefix.',
    '**Wire routes** — edit `App.jsx` (see Part 16, Edit 1).',
    '**Wire nav + re-export** — edit `AppShell.jsx` and `constants.js` (see Part 16, Edits 2 & 3).',
  ];
  steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push(``);
  lines.push(`> ✅ Test with \`npm run dev\` — navigate to \`/[module-route]\` and \`/[module-route]/new\`.`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`*— End of IMS Full Blueprint —*`);

  return lines.join('\n');
}

// ═════════════════════════════════════════════════════════════════════════════
// DOCX GENERATOR
// ═════════════════════════════════════════════════════════════════════════════
const C = {
  navy: '0F3460', white: 'FFFFFF', thBg: '0F3460', rowEven: 'F0F4F8', rowOdd: 'FFFFFF',
  border: 'CBD5E1', codeBg: 'F1F5F9', codeFg: '0F172A',
  tipBg: 'F0FDF4', tipFg: '166534', noteBg: 'EFF6FF', noteFg: '1D4ED8',
  warnBg: 'FFF7ED', warnFg: 'B45309',
};

const sb = (clr = C.border, sz = 4) => ({ style: BorderStyle.SINGLE, size: sz, color: clr });
const noBorders = () => ({ top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } });
const cellBorders = (clr = C.border) => ({ top: sb(clr), bottom: sb(clr), left: sb(clr), right: sb(clr) });

function run(text, opts = {}) {
  return new TextRun({ text, font: opts.font ?? 'Calibri', size: opts.size ?? 22, bold: opts.bold ?? false, italics: opts.italic ?? false, color: opts.color ?? C.navy });
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [run(text, opts)],
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 80 },
    indent: opts.indent ? { left: opts.indent } : undefined,
  });
}

const blank = (before = 60) => new Paragraph({ children: [], spacing: { before, after: 0 } });

function h1(text) {
  return new Paragraph({
    children: [run(text, { size: 26, bold: true, color: C.white })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 100 },
    shading: { type: ShadingType.CLEAR, fill: C.navy },
    indent: { left: 120, right: 120 },
  });
}

function h2(text) {
  return new Paragraph({
    children: [run(text, { size: 22, bold: true, color: C.white })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 80 },
    shading: { type: ShadingType.CLEAR, fill: '1E4A7A' },
    indent: { left: 120, right: 120 },
  });
}

function callout(type, text) {
  const map = { tip: [C.tipBg, C.tipFg, '✔'], note: [C.noteBg, C.noteFg, 'ℹ'], warn: [C.warnBg, C.warnFg, '⚠'] };
  const [bg, fg, icon] = map[type] ?? map.note;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        children: [new Paragraph({ children: [run(`${icon}  ${text}`, { color: fg, size: 19 })], spacing: { before: 60, after: 60 } })],
        shading: { type: ShadingType.CLEAR, fill: bg },
        borders: { top: sb(fg, 6), bottom: sb(fg, 6), left: sb(fg, 6), right: sb(fg, 6) },
        margins: { top: 60, bottom: 60, left: 160, right: 160 },
      })],
    })],
  });
}

// Render source code as a docx table with monospace font (first 80 lines)
function codeBlock(source, truncateAt = 80) {
  const srcLines = source.split('\n');
  const shown = srcLines.slice(0, truncateAt);
  const truncated = srcLines.length > truncateAt;
  const children = shown.map((ln) =>
    new Paragraph({
      children: [new TextRun({ text: ln || ' ', font: 'Courier New', size: 16, color: C.codeFg })],
      spacing: { before: 10, after: 10 },
    }),
  );
  if (truncated) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `… (${srcLines.length - truncateAt} more lines — see .md file for full source)`, font: 'Courier New', size: 16, color: '94A3B8', italics: true })],
      spacing: { before: 10, after: 10 },
    }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        children,
        shading: { type: ShadingType.CLEAR, fill: C.codeBg },
        borders: { top: sb('94A3B8', 4), bottom: sb('94A3B8', 4), left: sb('94A3B8', 4), right: sb('94A3B8', 4) },
        margins: { top: 80, bottom: 80, left: 180, right: 180 },
      })],
    })],
  });
}

function bullet(text) {
  return new Paragraph({
    children: [run(text, { size: 21 })],
    bullet: { level: 0 },
    spacing: { before: 30, after: 50 },
  });
}

function step(n, text) {
  return new Paragraph({
    children: [run(`${n}.  `, { bold: true, size: 21, color: '1E4A7A' }), run(text, { size: 21 })],
    spacing: { before: 60, after: 60 },
    indent: { left: 200 },
  });
}

async function generateDocx() {
  const docChildren = [];

  // Cover
  docChildren.push(blank(600));
  docChildren.push(p('HORIZON ENTERPRISE IMS', { bold: true, size: 28, color: C.navy, align: AlignmentType.CENTER, after: 80 }));
  docChildren.push(p('Full Project Cloning Blueprint', { bold: true, size: 52, color: C.navy, align: AlignmentType.CENTER, after: 120 }));
  docChildren.push(p('Complete source code of every file — rebuild the project without the git repo', { italic: true, size: 22, color: '64748B', align: AlignmentType.CENTER, after: 200 }));
  docChildren.push(callout('warn', 'The .md file (IMS_FullBlueprint.md) contains the full source of every file with no truncation. This .docx shows the first 80 lines of each file and links to the .md for the rest.'));
  docChildren.push(blank(200));
  docChildren.push(callout('tip', 'Stack: React 19 · React Router 7 · Vite 8 · Axios 1.x · Lucide React. No TypeScript. No Redux. No test suite. Vanilla CSS with design tokens.'));
  docChildren.push(new Paragraph({ children: [], pageBreakBefore: true }));

  // Quick start
  docChildren.push(h1('Quick Start'));
  docChildren.push(blank(60));
  docChildren.push(codeBlock(
    `# 1. Create project\nnpm create vite@latest horizon-enterprise -- --template react\ncd horizon-enterprise\n\n# 2. Install deps\nnpm install react@^19 react-dom@^19 react-router-dom@^7 axios@^1 lucide-react@^1\nnpm install -D @vitejs/plugin-react@^6 vite@^8\n\n# 3. Create folders\nmkdir -p src/{api,components/{ui,grid,filters,dashboard,purchase-inquiry,txn},context,data,hooks,layout,pages/{dashboard,login,purchase-inquiry,purchase-order,report-workspace,txn-entry},theme,utils}\n\n# 4. Copy all files from this document in order\n# 5. npm run dev`,
    20,
  ));
  docChildren.push(blank());

  // Each manifest entry
  for (const entry of MANIFEST) {
    if (entry.isHeading) {
      docChildren.push(h1(entry.section.replace('## ', '')));
      docChildren.push(blank(60));
      continue;
    }

    const [relPath, description] = entry;
    const source = readFile(relPath);

    docChildren.push(h2(relPath));
    docChildren.push(p(description, { italic: true, color: '64748B', size: 19, after: 60 }));
    docChildren.push(blank(40));
    docChildren.push(codeBlock(source, 60));
    docChildren.push(blank(80));
  }

  // Module N template
  docChildren.push(h1('Part 15 — Module N Template'));
  docChildren.push(callout('note', 'Copy these templates for any new module. Replace every [placeholder] with your module values. See IMS_FullBlueprint.md for full untruncated templates.'));
  docChildren.push(blank(80));
  docChildren.push(h2('Template: constants.js'));
  docChildren.push(codeBlock(MODULE_N_TEMPLATE.constants, 60));
  docChildren.push(blank(80));
  docChildren.push(h2('Template: use[Module].js hook'));
  docChildren.push(codeBlock(MODULE_N_TEMPLATE.hook, 60));
  docChildren.push(blank());

  // Wiring
  docChildren.push(h1('Part 16 — Wiring (3 File Edits)'));
  docChildren.push(blank(60));
  docChildren.push(h2('Edit 1: App.jsx — add routes'));
  docChildren.push(codeBlock(MODULE_N_TEMPLATE.appJsxAddition, 20));
  docChildren.push(blank(80));
  docChildren.push(h2('Edit 2: AppShell.jsx — add nav link'));
  docChildren.push(codeBlock(MODULE_N_TEMPLATE.appShellAddition, 20));
  docChildren.push(blank(80));
  docChildren.push(h2('Edit 3: src/api/constants.js — re-export'));
  docChildren.push(codeBlock(MODULE_N_TEMPLATE.constantsAddition, 10));
  docChildren.push(blank());

  // 9-step checklist
  docChildren.push(h1('Part 17 — Module Checklist (9 Steps)'));
  docChildren.push(blank(60));
  const steps = [
    'Get backend values — RB_MASTER, RB_DETAIL, SAVE_ENDPOINT, SP_LIST, SP_TYPES from the DBA.',
    'Create folder — src/pages/[module-route]/',
    'Create constants.js — copy template from Part 15, fill all CONFIRM values.',
    'Create use[Module].js — copy template from Part 15, adapt cascade logic.',
    'Create [Module]Page.jsx — copy PurchaseInquiryPage.jsx, replace PI_ → your prefix.',
    'Create [Module]Form.jsx — copy PurchaseInquiryForm.jsx, replace PI_ → your prefix.',
    'Create [Module]Page.css — copy PurchaseInquiryPage.css, replace pi- → your prefix.',
    'Wire routes — edit App.jsx (Part 16 Edit 1).',
    'Wire nav + re-export — edit AppShell.jsx and constants.js (Part 16 Edits 2 & 3).',
  ];
  steps.forEach((s, i) => docChildren.push(step(i + 1, s)));
  docChildren.push(blank(120));
  docChildren.push(callout('tip', 'Test with npm run dev — navigate to /[module-route] and /[module-route]/new. Check browser console for API errors.'));
  docChildren.push(blank(200));
  docChildren.push(p('— End of IMS Full Blueprint —', { color: '94A3B8', size: 19, italic: true, align: AlignmentType.CENTER }));

  const doc = new Document({
    creator: 'Horizon Enterprise IMS',
    title:   'IMS Full Project Cloning Blueprint',
    subject: 'Complete source code and developer guide',
    sections: [{
      properties: { page: { margin: { top: 1080, bottom: 1080, left: 1260, right: 1260 } } },
      children: docChildren,
    }],
  });

  return Packer.toBuffer(doc);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Reading source files…');
  const md = generateMarkdown();
  fs.writeFileSync(MD_OUT, md, 'utf8');
  const mdKB = (md.length / 1024).toFixed(1);
  console.log(`✅  Markdown saved → ${MD_OUT}  (${mdKB} KB, ${md.split('\n').length.toLocaleString()} lines)`);

  console.log('Generating docx…');
  const docxBuf = await generateDocx();
  fs.writeFileSync(DOC_OUT, docxBuf);
  const docKB = (docxBuf.length / 1024).toFixed(1);
  console.log(`✅  Docx saved    → ${DOC_OUT}  (${docKB} KB)`);
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });
