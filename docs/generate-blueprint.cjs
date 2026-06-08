// generate-blueprint.cjs — Creates IMS_ProjectBlueprint.docx
// Comprehensive cloning guide: architecture, components, API patterns, module steps.
// Run: node docs/generate-blueprint.cjs
'use strict';

const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, VerticalAlign, PageNumber, NumberFormat,
} = require('docx');
const fs   = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'IMS_ProjectBlueprint.docx');

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  navy:    '0F3460',
  white:   'FFFFFF',
  thBg:    '0F3460',
  rowEven: 'F0F4F8',
  rowOdd:  'FFFFFF',
  border:  'CBD5E1',
  // section accents
  h1Bg:    '0F3460',   // section title band
  h2Bg:    '1E4A7A',   // sub-heading band
  // callout colours
  tipBg:   'F0FDF4',  tipFg:   '166534',  // green tip
  noteBg:  'EFF6FF',  noteFg:  '1D4ED8',  // blue note
  warnBg:  'FFF7ED',  warnFg:  'B45309',  // amber warning
  // code block
  codeBg:  'F1F5F9',  codeFg:  '0F172A',
  codeKw:  '7C3AED',   // purple keyword
};

// ── Border / cell helpers ─────────────────────────────────────────────────────
const sb = (clr = C.border, sz = 4) =>
  ({ style: BorderStyle.SINGLE, size: sz, color: clr });

const cellBorders = (clr = C.border) =>
  ({ top: sb(clr), bottom: sb(clr), left: sb(clr), right: sb(clr) });

const noB = () => ({ style: BorderStyle.NONE, size: 0, color: C.white });

// ── Text helpers ──────────────────────────────────────────────────────────────
function run(text, opts = {}) {
  return new TextRun({
    text,
    font:    opts.font    ?? 'Calibri',
    size:    opts.size    ?? 22,
    bold:    opts.bold    ?? false,
    italics: opts.italic  ?? false,
    color:   opts.color   ?? C.navy,
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [run(text, opts)],
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing:  { before: opts.before ?? 0, after: opts.after ?? 80 },
    indent:   opts.indent ? { left: opts.indent } : undefined,
  });
}

const blank = (before = 60) =>
  new Paragraph({ children: [], spacing: { before, after: 0 } });

// Section heading — white text on navy band
function h1(text) {
  return new Paragraph({
    children: [run(text, { size: 26, bold: true, color: C.white })],
    heading:  HeadingLevel.HEADING_1,
    spacing:  { before: 300, after: 100 },
    shading:  { type: ShadingType.CLEAR, fill: C.h1Bg },
    indent:   { left: 120, right: 120 },
  });
}

// Sub-heading — white text on mid-navy band
function h2(text) {
  return new Paragraph({
    children: [run(text, { size: 23, bold: true, color: C.white })],
    heading:  HeadingLevel.HEADING_2,
    spacing:  { before: 200, after: 80 },
    shading:  { type: ShadingType.CLEAR, fill: C.h2Bg },
    indent:   { left: 120, right: 120 },
  });
}

// Callout box factory
function callout(type, text) {
  const map = { tip: [C.tipBg, C.tipFg, '✔'], note: [C.noteBg, C.noteFg, 'ℹ'], warn: [C.warnBg, C.warnFg, '⚠'] };
  const [bg, fg, icon] = map[type] ?? map.note;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        children: [new Paragraph({
          children: [
            run(`${icon}  `, { bold: true, color: fg, size: 20 }),
            run(text,         { color: fg, size: 20 }),
          ],
          spacing: { before: 80, after: 80 },
        })],
        shading: { type: ShadingType.CLEAR, fill: bg },
        borders: { top: sb(fg, 6), bottom: sb(fg, 6), left: sb(fg, 6), right: sb(fg, 6) },
        margins: { top: 60, bottom: 60, left: 180, right: 180 },
      })],
    })],
  });
}

// Code block (monospace, gray background)
function code(lines) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        children: lines.map((ln) => new Paragraph({
          children: [new TextRun({ text: ln || ' ', font: 'Courier New', size: 18, color: C.codeFg })],
          spacing: { before: 20, after: 20 },
        })),
        shading:  { type: ShadingType.CLEAR, fill: C.codeBg },
        borders:  { top: sb('94A3B8', 4), bottom: sb('94A3B8', 4), left: sb('94A3B8', 4), right: sb('94A3B8', 4) },
        margins:  { top: 80, bottom: 80, left: 200, right: 200 },
      })],
    })],
  });
}

// Bullet paragraph
function bullet(text, level = 0) {
  return new Paragraph({
    children: [run(text, { size: 21, color: C.navy })],
    bullet:   { level },
    spacing:  { before: 30, after: 50 },
  });
}

// Numbered step
function step(n, text) {
  return new Paragraph({
    children: [
      run(`${n}.  `, { bold: true, size: 21, color: C.h2Bg }),
      run(text,       { size: 21, color: C.navy }),
    ],
    spacing: { before: 60, after: 60 },
    indent:  { left: 200 },
  });
}

// ── Table helpers ─────────────────────────────────────────────────────────────
function th(text, w) {
  return new TableCell({
    children: [new Paragraph({
      children: [run(text, { size: 18, bold: true, color: C.white })],
      alignment: AlignmentType.CENTER,
    })],
    width:         { size: w, type: WidthType.PERCENTAGE },
    shading:       { type: ShadingType.CLEAR, fill: C.thBg },
    borders:       cellBorders(C.navy),
    verticalAlign: VerticalAlign.CENTER,
    margins:       { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function td(text, w, even = false, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      children: [run(text, { size: opts.code ? 18 : 19, font: opts.code ? 'Courier New' : 'Calibri', color: opts.color ?? C.navy, bold: opts.bold ?? false })],
    })],
    width:         { size: w, type: WidthType.PERCENTAGE },
    shading:       { type: ShadingType.CLEAR, fill: even ? C.rowEven : C.rowOdd },
    borders:       cellBorders(),
    verticalAlign: VerticalAlign.TOP,
    margins:       { top: 70, bottom: 70, left: 120, right: 120 },
  });
}

function tableFromRows(headers, widths, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h, i) => th(h, widths[i])), tableHeader: true }),
      ...rows.map((row, ri) =>
        new TableRow({ children: row.map((cell, ci) => td(cell, widths[ci], ri % 2 !== 0, typeof cell === 'object' ? cell : {})) }),
      ),
    ],
  });
}

// Simple helper to build rows where cells may have opts
function dataRow(cells, widths, even = false) {
  return new TableRow({
    children: cells.map((c, i) => {
      if (typeof c === 'object' && c !== null && 'text' in c) {
        return td(c.text, widths[i], even, c);
      }
      return td(c, widths[i], even);
    }),
  });
}

// ── SECTION BUILDERS ─────────────────────────────────────────────────────────

function titlePage() {
  return [
    blank(700),
    p('HORIZON ENTERPRISE', { bold: true, size: 28, color: C.navy, align: AlignmentType.CENTER, after: 60 }),
    p('IMS — Project Cloning Blueprint', { bold: true, size: 52, color: C.navy, align: AlignmentType.CENTER, after: 160 }),
    p('Complete Developer Handbook', { size: 26, color: C.h2Bg, align: AlignmentType.CENTER, after: 80 }),
    p('Architecture · Components · API Patterns · Module Steps · Design System', { italic: true, size: 20, color: '64748B', align: AlignmentType.CENTER, after: 200 }),
    blank(200),
    callout('tip', 'Use this document to clone the project, onboard new developers, or scaffold any new ERP module in under an hour.'),
    blank(200),
    p('Version 1.0  ·  Horizon Enterprise IMS  ·  2026', { size: 19, color: '94748B', align: AlignmentType.CENTER }),
    new Paragraph({ children: [], pageBreakBefore: true }),
  ];
}

function sec1_projectIdentity() {
  const W = [30, 70];
  return [
    h1('1. Project Identity'),
    blank(60),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [th('Attribute', 30), th('Value', 70)], tableHeader: true }),
        dataRow(['Project Name', 'Horizon Enterprise IMS'], W, false),
        dataRow(['npm package name', { text: 'horizon-enterprise', code: true }], W, true),
        dataRow(['Version', '1.0.0'], W, false),
        dataRow(['Purpose', 'Multi-module ERP / procurement management web application.'], W, true),
        dataRow(['Frontend Framework', 'React 19 (SPA — no SSR, no TypeScript)'], W, false),
        dataRow(['Router', 'React Router 7 (declarative nested routes)'], W, true),
        dataRow(['Build Tool', 'Vite 8'], W, false),
        dataRow(['HTTP Client', 'Axios 1.x (via useApi hook)'], W, true),
        dataRow(['Icon Library', 'Lucide React 1.x'], W, false),
        dataRow(['State Management', 'React hooks only — no Redux, no Zustand'], W, true),
        dataRow(['Styling', 'Vanilla CSS with CSS custom properties (design tokens)'], W, false),
        dataRow(['Test Suite', 'None — Playwright included but no tests written yet'], W, true),
        dataRow(['Language', 'JavaScript ES2022 (no .ts / .tsx files)'], W, false),
      ],
    }),
    blank(100),
    callout('note', 'No TypeScript. No global state library. Every module is self-contained: its own hook, constants, page, form, and CSS.'),
    blank(),
  ];
}

function sec2_techStack() {
  const W = [28, 14, 58];
  return [
    h1('2. Tech Stack — Every Dependency'),
    blank(60),
    h2('Runtime Dependencies'),
    blank(40),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [th('Package', 28), th('Version', 14), th('Why it is here', 58)], tableHeader: true }),
        dataRow(['react',         '^19.2.6',  'Core UI library. React 19 — concurrent features, useOptimistic, Actions.'],               W, false),
        dataRow(['react-dom',     '^19.2.6',  'DOM renderer for React.'],                                                               W, true),
        dataRow(['react-router-dom', '^7.15.1', 'Client-side routing. Nested routes via <Outlet />. useNavigate, useParams, useLocation.'], W, false),
        dataRow(['axios',         '^1.16.0',  'HTTP client. Provides request/response interceptors, timeout, base URL, cancellation.'],  W, true),
        dataRow(['lucide-react',  '^1.16.0',  'Consistent SVG icon set. Swap any icon by name (Plus, Trash2, Save, LogOut…).'],          W, false),
      ],
    }),
    blank(100),
    h2('Dev / Build Dependencies'),
    blank(40),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [th('Package', 28), th('Version', 14), th('Why it is here', 58)], tableHeader: true }),
        dataRow(['vite',               '^8.0.12',  'Fast dev server + ESM build. Config: vite.config.js.'],                             W, false),
        dataRow(['@vitejs/plugin-react','^6.0.1',  'Vite plugin for React JSX transform + Fast Refresh.'],                              W, true),
        dataRow(['docx',               '^9.7.1',   'Generates native .docx files for MRD documents. Used in docs/ scripts only.'],      W, false),
        dataRow(['html-to-docx',       '^1.8.0',   'Superseded by docx package. Kept as fallback, not used in production.'],            W, true),
        dataRow(['playwright',         '^1.60.0',  'E2E test runner. Installed but no tests written yet.'],                             W, false),
      ],
    }),
    blank(),
  ];
}

function sec3_folderStructure() {
  const W = [35, 65];
  const rows = [
    ['src/api/',               'Shared API layer: constants.js, useApi.js, controlTypeMap re-exports.'],
    ['src/api/constants.js',   'All base URLs, ENDPOINTS, OBJ_TYPE, DEFAULT_* values, getColDefault(). Re-exports each module\'s config.'],
    ['src/api/useApi.js',      'Custom hook: Axios client cache + get / post / getWithBody helpers with loading/error state.'],
    ['src/components/',        'All reusable UI components (never contain page-level data-fetch logic).'],
    ['src/components/ui/',     'Primitive UI: ActionBar, Loader, Modal, SearchSelect.'],
    ['src/components/grid/',   'All grid components: EnterpriseDataGrid, EntryGrid, CollapsibleGrid, InlineChildTable, PopupGrid.'],
    ['src/components/filters/','EnterpriseFilterPanel + CSS variants (base, modern, query).'],
    ['src/components/dashboard/','Dashboard-only panels: DecisionPanel, TaskBoardPanel, ReportBoardPanel.'],
    ['src/components/txn/',    'Transaction components: TxnHeaderPanel, OrderItemModal.'],
    ['src/components/purchase-inquiry/', 'Module-specific component: SupplierPickerModal.'],
    ['src/context/',           'React contexts. Currently: PageHeaderContext (topbar title/subtitle/back).'],
    ['src/data/',              'Static / hardcoded data: dummyData (controlTypeMap used by filter panels).'],
    ['src/hooks/',             'One custom hook per module: usePurchaseInquiry, usePurchaseOrder, useTxnEntry, useGridSearch.'],
    ['src/layout/',            'AppShell: sidebar + topbar shell wrapping all authenticated pages.'],
    ['src/pages/',             'One folder per module. Folder = module boundary.'],
    ['src/pages/dashboard/',   'EnterpriseDashboard + KPI strip + constants.'],
    ['src/pages/login/',       'LoginPage — no auth wired yet; placeholder.'],
    ['src/pages/purchase-inquiry/', 'PI module: constants.js, Page.jsx (list), Form.jsx (entry), Page.css, Form.css.'],
    ['src/pages/purchase-order/',   'PO module: same 4-file structure.'],
    ['src/pages/report-workspace/', 'Dynamic RB report viewer.'],
    ['src/pages/txn-entry/',   'Invoice/transaction entry page.'],
    ['src/theme/',             'Global CSS: enterprise.css (design tokens), enterprise-components.css, workspace-base.css.'],
    ['src/utils/',             'Pure utility functions: gridUtils (buildGridColumns, fetchDropdownOptions, isTruthyApiFlag).'],
    ['src/App.jsx',            'Root component: BrowserRouter + PageHeaderProvider + all routes.'],
    ['src/main.jsx',           'Vite entry point: ReactDOM.createRoot.'],
    ['src/index.css',          'Global resets and @import of theme files.'],
    ['docs/',                  'MRD documents, blueprint, and their Node.js generator scripts (*.cjs).'],
    ['vite.config.js',         'Vite configuration (React plugin, port).'],
    ['package.json',           'Deps, scripts: dev, build, preview.'],
  ];

  return [
    h1('3. Folder Structure'),
    blank(60),
    callout('note', 'Rule: one folder = one module boundary. Never import across module folders except through src/api/constants.js or src/components/.'),
    blank(80),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [th('Path', 35), th('Purpose', 65)], tableHeader: true }),
        ...rows.map(([p_, d], i) =>
          dataRow([{ text: p_, code: true }, d], W, i % 2 !== 0),
        ),
      ],
    }),
    blank(),
  ];
}

function sec4_designSystem() {
  const W = [30, 25, 45];
  const tokens = [
    ['--primary',              '#1e4a7a',  'Main brand blue. Used for borders, buttons, active states.'],
    ['--primary-hover',        '#00335f',  'Hover state of primary.'],
    ['--primary-light',        '#d3e3ff',  'Selection / highlight tint.'],
    ['--primary-lighter',      '#eef4fa',  'Very light row hover.'],
    ['--accent',               '#0660a7',  'Secondary interactive colour.'],
    ['--danger',               '#d93025',  'Delete / error / destructive actions.'],
    ['--success',              '#089949',  'Confirmations, positive statuses.'],
    ['--warning',              '#e37400',  'Amber warnings, instructions.'],
    ['--bg',                   '#e8eef4',  'Page background (behind panels).'],
    ['--surface',              '#ffffff',  'Card / panel background.'],
    ['--border',               '#d8dee6',  'Default border colour.'],
    ['--text',                 '#161c21',  'Primary body text.'],
    ['--text-secondary',       '#42474f',  'Labels, secondary text.'],
    ['--text-muted',           '#737780',  'Placeholder, helper text.'],
    ['--sidebar-bg',           'gradient', 'Left sidebar gradient (#0f2d4a → #1a3a5c).'],
    ['--radius',               '4px',      'Default border radius (buttons, cells).'],
    ['--radius-lg',            '6px',      'Panel / card border radius.'],
    ['--sidebar-width',        '220px',    'Expanded sidebar width.'],
    ['--sidebar-collapsed',    '64px',     'Icon-only collapsed width.'],
    ['--topbar-height',        '44px',     'Fixed topbar / page header height.'],
    ['--grid-row-height',      '24px',     'Row height inside EntryGrid.'],
    ['--font-family',          'Inter',    'Primary font. Falls back to system-ui, sans-serif.'],
    ['--font-mono',            'JetBrains Mono', 'Code / monospace font. Falls back to ui-monospace.'],
    ['--font-size-base',       '13px',     'Default font size.'],
  ];

  return [
    h1('4. Design System — CSS Tokens'),
    blank(60),
    callout('note', 'All tokens live in src/theme/enterprise.css as :root CSS custom properties. Override them in a client-specific theme file — never edit enterprise.css directly for a client.'),
    blank(80),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [th('Token', 30), th('Value', 25), th('Usage', 45)], tableHeader: true }),
        ...tokens.map(([t, v, u], i) =>
          dataRow([{ text: t, code: true }, { text: v, code: true }, u], W, i % 2 !== 0),
        ),
      ],
    }),
    blank(100),
    h2('CSS File Load Order'),
    blank(40),
    code([
      '/* src/index.css — imported once in main.jsx */',
      "@import './theme/enterprise.css';            /* 1. design tokens */" ,
      "@import './theme/enterprise-components.css'; /* 2. shared component styles */",
      "@import './theme/workspace-base.css';         /* 3. page/workspace layout */",
      '',
      '/* Each component/page then imports its own .css file */',
      "import './PurchaseOrderPage.css';",
    ]),
    blank(),
  ];
}

function sec5_appShell() {
  return [
    h1('5. Application Shell & Routing'),
    blank(60),
    h2('App.jsx — Route Tree'),
    blank(40),
    code([
      'App.jsx',
      '  <BrowserRouter>',
      '    <PageHeaderProvider>          // context — topbar title/subtitle',
      '      <Routes>',
      '        /login          → LoginPage',
      '        <AppLayout>               // AppShell wrapper',
      '          /             → EnterpriseDashboard',
      '          /main/:rbId   → ReportWorkspacePage',
      '          /txn-entry/:id? → TxnEntryPage',
      '          /purchase-inquiry      → PurchaseInquiryPage  (listing)',
      '          /purchase-inquiry/:id  → PurchaseInquiryForm  (new / edit)',
      '          /purchase-order        → PurchaseOrderPage    (listing)',
      '          /purchase-order/:id    → PurchaseOrderForm    (new / edit)',
      '          *             → <Navigate to="/" />',
      '        </AppLayout>',
      '      </Routes>',
      '    </PageHeaderProvider>',
      '  </BrowserRouter>',
    ]),
    blank(120),
    h2('AppShell Structure'),
    blank(40),
    code([
      'AppShell',
      '  ├── <aside .ent-sidebar>',
      '  │     ├── Brand logo + name',
      '  │     ├── Collapse toggle button',
      '  │     └── <nav> — NAV_SECTIONS (defined in AppShell.jsx)',
      '  ├── <div .ent-main>',
      '  │     ├── <header .ent-topbar>',
      '  │     │     ├── Back button (conditional — showBack=true)',
      '  │     │     ├── Page title  (from PageHeaderContext)',
      '  │     │     └── Page subtitle (from PageHeaderContext)',
      '  │     └── <main .ent-content>',
      '  │           └── {children} — page component renders here',
    ]),
    blank(120),
    h2('Adding a Nav Link (new module)'),
    blank(40),
    callout('note', 'Open src/layout/AppShell.jsx, find NAV_SECTIONS, add one item object.'),
    blank(60),
    code([
      "// AppShell.jsx — NAV_SECTIONS",
      "{ to: '/purchase-order', icon: ShoppingCart, label: 'Purchase Order', end: false },",
      "// Add for new module:",
      "{ to: '/quotation',      icon: FileText,     label: 'Quotation',       end: false },",
    ]),
    blank(120),
    h2('PageHeaderContext — Setting the Topbar'),
    blank(40),
    callout('note', 'Call usePageHeader() at the top of every Page and Form component.'),
    blank(60),
    code([
      "import { usePageHeader } from '../../context/PageHeaderContext';",
      '',
      '// In your component:',
      'usePageHeader({',
      "  title:    'Purchase Orders',            // topbar title",
      "  subtitle: 'Browse or create new PO.',   // topbar subtitle",
      '  showBack: true,                         // show back arrow?',
      "  backTo:   '/purchase-order',            // where back arrow goes",
      '});',
    ]),
    blank(),
  ];
}

function sec6_componentLibrary() {
  const W = [22, 22, 56];
  const components = [
    // ── UI primitives ──────────────────────────────────────
    ['ActionBar', 'src/components/ui/', 'Sticky bottom bar on all entry forms. Provides Add/Cancel pair + extra custom buttons (Save, Print, Document, Close). Props: isEditMode, onAdd, onCancel, extraButtons[].'],
    ['SearchSelect', 'src/components/ui/', 'Styled <select> replacement with search filter. Used in filter panels and grids. Props: value, onChange, options[{value,label}], placeholder, compact, disabled.'],
    ['Loader', 'src/components/ui/', 'Full-panel loading spinner. Props: text, size, fullPage.'],
    ['Modal', 'src/components/ui/', 'Generic overlay modal. Props: isOpen, onClose, title, children, width.'],
    // ── Filter ─────────────────────────────────────────────
    ['EnterpriseFilterPanel', 'src/components/filters/', '3-column tabular filter layout for entry form header fields. Renders each filter as its control type (Textbox / Date / Dropdown / Textarea). Props: staticFilters[], initialValues{}, cascadeResets{}, onFilterChange(colName,val), isSearching, disabled.'],
    // ── Grid components ─────────────────────────────────────
    ['EnterpriseDataGrid', 'src/components/grid/', 'Read-only paginated data table for listing pages. Props: columns[], data[], loading, error, pageSize, emptyMessage, hideHeader, fill, onPageSizeChange.'],
    ['EntryGrid', 'src/components/grid/', 'Editable row-entry grid for form detail lines. ref-forwarded: addRow(row), removeRows(ids), getRows(), getSelectedRows(), clearRows(), updateRow(id,patch). Props: config{columns,pagination}, title, emptyMessage, onSelectionChange, enableCollapsible, childRowsMap, childColumns, hideBottomPanel.'],
    ['CollapsibleGrid', 'src/components/grid/', 'Read-only expandable child-row table. Used for indent details on PI/PO. Props: parentRows[], childRowsMap{}, parentColumns[], childColumns[].'],
    ['InlineChildTable', 'src/components/grid/', 'Inline sub-table rendered inside a parent row. Used by CollapsibleGrid internally.'],
    ['PopupGrid', 'src/components/grid/', 'Floating popup grid for CBO (ComboBox Object) cells inside EntryGrid. Opens on click, returns selected row.'],
    // ── Pickers / modals ────────────────────────────────────
    ['SupplierPickerModal', 'src/components/purchase-inquiry/', 'Modal to browse and select one or more suppliers. Props: isOpen, onClose, items[], isLoading, error, onInsert(selected[]).'],
    ['OrderItemModal', 'src/components/txn/', 'Modal to browse and insert item picker rows. Supports multi-select + filterable column grid. Props: isOpen, onClose, items[], columns[], isLoading, error, onInsert(selected[]).'],
    // ── Transaction ─────────────────────────────────────────
    ['TxnHeaderPanel', 'src/components/txn/', 'Legacy header panel for txn-entry page.'],
    // ── Dashboard ───────────────────────────────────────────
    ['DecisionPanel', 'src/components/dashboard/', 'Approval / decision queue panel for dashboard.'],
    ['TaskBoardPanel', 'src/components/dashboard/', 'Kanban-style task board for dashboard.'],
    ['ReportBoardPanel', 'src/components/dashboard/', 'Dynamic RB report mini-viewer on dashboard.'],
    ['KpiStrip', 'src/components/', 'KPI metric strip across the top of the dashboard.'],
    ['PageHeaderCard', 'src/components/', 'Standalone page title card (used outside AppShell topbar context).'],
  ];

  return [
    h1('6. Component Library — Every Component'),
    blank(60),
    callout('tip', 'Components in src/components/ NEVER fetch data directly. All async logic lives in the hook (src/hooks/use[Module].js). Components only receive props and call callbacks.'),
    blank(80),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [th('Component', 22), th('Location', 22), th('Purpose & Key Props', 56)], tableHeader: true }),
        ...components.map(([name, loc, desc], i) =>
          dataRow([{ text: name, bold: true }, { text: loc, code: true }, desc], W, i % 2 !== 0),
        ),
      ],
    }),
    blank(100),
    h2('ActionBar — extraButtons Shape'),
    blank(40),
    code([
      'const extraButtons = [',
      "  { key: 'save',  label: 'Save',  Icon: Save,  variant: 'save',  onClick: handleSave, disabled: isSaving, loading: isSaving },",
      "  { key: 'sep1',  separator: true },          // vertical divider",
      "  { key: 'close', label: 'Close', Icon: LogOut, variant: 'close', onClick: handleClose, showAlways: true },",
      '];',
    ]),
    blank(),
  ];
}

function sec7_apiPattern() {
  const W = [30, 70];
  return [
    h1('7. API Integration Pattern'),
    blank(60),
    h2('Three Base URLs'),
    blank(40),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [th('Constant', 30), th('URL / Usage', 70)], tableHeader: true }),
        dataRow([{ text: 'API_BASE_URL', code: true },     'http://122.179.135.100:8095/IMS_LIVE/webservice/WsIMS.asmx — GET requests via useApi hook (reads, dropdowns, RB meta).'], W, false),
        dataRow([{ text: 'API_BASE_URL_IMS', code: true }, 'http://122.179.135.100:8095/IMS_LIVE — REST gateway. POST with JSON body for saves and some reads.'], W, true),
        dataRow([{ text: 'API_BASE_URL_OLD', code: true }, 'Old test server. Kept as reference; do not use in new code.'], W, false),
      ],
    }),
    blank(100),
    h2('Pattern A — Standard Read (GET via useApi)'),
    blank(40),
    callout('note', 'Used for: dropdowns, RB metadata, listing data, item pickers.'),
    blank(60),
    code([
      "const { get } = useApi(API_BASE_URL);",
      '',
      'const result = await get(ENDPOINTS.FN_FETCH_DATA, {',
      '  ObjType:   OBJ_TYPE.FUNCTION,   // 2 = function, 1 = procedure',
      "  ObjName:   'SP_Or_Function_Name',",
      "  JSon:       JSON.stringify([{ prmParam1: val1, prmParam2: val2 }]),",
      '  p_ErrCode: -1,',
      "  p_ErrMsg:  '',",
      '});',
      '',
      '// Response shape:',
      'result.Table    // → array of row objects (main result set)',
      'result.Table1   // → second result set (if SP returns multiple)',
    ]),
    blank(100),
    h2('Pattern B — REST Save (POST with JSON body)'),
    blank(40),
    callout('note', 'Used for: Save actions. Endpoint path comes from MODULE_CONFIG.SAVE_ENDPOINT.'),
    blank(60),
    code([
      "const res = await fetch(`${API_BASE_URL_IMS}${PO_CONFIG.SAVE_ENDPOINT}`, {",
      "  method:  'POST',",
      "  headers: { 'Content-Type': 'application/json' },",
      '  body: JSON.stringify({',
      '    prmStrMstJSON:     JSON.stringify([masterRow]),',
      '    prmStrDetJSON:     JSON.stringify(detailRows),',
      '    prmStrIndtDetJSON: JSON.stringify(indentDetailRows),',
      '  }),',
      '});',
      'const result = await res.json();',
    ]),
    blank(100),
    h2('OBJ_TYPE Discriminator'),
    blank(40),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [th('Constant', 30), th('Value', 15), th('When to use', 55)], tableHeader: true }),
        dataRow([{ text: 'OBJ_TYPE.FUNCTION', code: true }, '2', 'Stored function — returns a result set. Use for all data-fetch calls.'],    [30, 15, 55], false),
        dataRow([{ text: 'OBJ_TYPE.PROCEDURE', code: true }, '1', 'Stored procedure — side effects (saves, deletes). Use for write calls.'], [30, 15, 55], true),
      ],
    }),
    blank(100),
    h2('Three-Phase Metadata Load Pattern'),
    blank(40),
    callout('tip', 'This pattern is used by every entry form module. Always load in this order to avoid waterfalls.'),
    blank(60),
    code([
      '// Phase 1 — on mount, parallel:',
      'useEffect(() => {',
      '  fetchHeaderMeta();   // RB_MasterCode → GetDetailColData + dropdown options',
      '  fetchDetailMeta();   // RB_DetailCode → column schema only',
      '}, []);',
      '',
      '// Phase 2 — lazy, on first Add New / Select Item:',
      'const ensureItemColumns = async () => {',
      '  if (gridColumnsLoadedRef.current) return;',
      '  await fetchGridColumns(divisionID);  // GetFilterDetail → builds column defs',
      '  gridColumnsLoadedRef.current = true;',
      '};',
      '',
      '// Phase 3 — user interaction:',
      'const handleAddNew = async () => {',
      '  await ensureItemColumns();',
      '  const blankRow = buildBlankRow(allColumns);',
      '  itemGridRef.current.addRow(blankRow);',
      '};',
    ]),
    blank(100),
    h2('getColDefault — Blank Row Builder'),
    blank(40),
    code([
      "// src/api/constants.js",
      'export function getColDefault(colDataType) {',
      "  if (colDataType?.toLowerCase().startsWith('numeric'))  return 0;",
      "  if (colDataType?.toLowerCase().startsWith('varchar'))  return '';",
      "  if (colDataType?.toLowerCase().startsWith('datetime')) return null;",
      '  return null;',
      '}',
      '',
      '// Usage when building a blank row for EntryGrid:',
      'const blankRow = { id: nextTempId() };',
      "allColumns.forEach(({ key, colDataType }) => {",
      '  blankRow[key] = getColDefault(colDataType);',
      '});',
    ]),
    blank(),
  ];
}

function sec8_moduleBlueprint() {
  const W = [28, 72];
  const files = [
    ['constants.js',        'ALL config for the module: RB codes, SP names, header filter definitions, grid tab definitions, cascade reset map, BASED_ON options, SAVE_ENDPOINT, localStorage keys, listing constants (LIST_OBJ_TYPE, SP_LIST, LIST_DIVISION_ID).'],
    ['[Module]Page.jsx',    'Listing page shown at /module-route. Fetches all records (SP_LIST), shows EnterpriseDataGrid, has Add New → /module-route/new, edit pencil → /module-route/:id.'],
    ['[Module]Form.jsx',    'Entry form at /module-route/:id. Contains: EnterpriseFilterPanel (header fields) + tab grid section (EntryGrid for items + EntryGrid for suppliers + Terms table) + ActionBar. All async logic delegated to the hook.'],
    ['[Module]Page.css',    'ALL CSS for both listing AND form views. Two namespaces: module-list-* (listing) and module-* (form / amend strip / grid section / tab buttons / delete button / terms table).'],
    ['use[Module].js',      'Custom hook: all async calls, all state (headerColumns, divisionOptions, supplierOptions, currencyOptions, poTypeOptions, columns, allColumns, isFetching, etc). Zero JSX. Exported functions: fetchHeaderMeta, fetchDetailMeta, fetchGridColumns, fetchDivisions, fetchPoTypes, clearPoTypes, fetchSupplierInfo, fetchExistingPOs, saveTxn.'],
    ['[Module]Form.css',    'Optional — only needed if the form has styles not in Page.css. PI Form.jsx imports Form.css; PO Form.jsx imports Page.css directly.'],
  ];

  return [
    h1('8. Module File Blueprint — 6 Files Per Module'),
    blank(60),
    callout('tip', 'Every module follows exactly this 6-file structure. Purchase Inquiry and Purchase Order are the canonical examples.'),
    blank(80),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [th('File', 28), th('Responsibility', 72)], tableHeader: true }),
        ...files.map(([f, d], i) =>
          dataRow([{ text: f, code: true }, d], W, i % 2 !== 0),
        ),
      ],
    }),
    blank(100),
    h2('constants.js — Minimum Required Keys'),
    blank(40),
    code([
      "export const QUOTATION_CONFIG = {",
      "  RB_MASTER:          'RB_QuotationMst',          // from DBA",
      "  RB_DETAIL:          'RB_QuotationDet',          // from DBA",
      "  FORM_TAG:           'QT',",
      "  TRAN_BOOK:          'QUOTATION',",
      "  CONFIG_YEAR_ID:      2,                         // CONFIRM",
      "  DIVISION_YEAR_ID:    2,                         // CONFIRM",
      "  SUPPLIER_PARTY_TYPE: 'S',",
      "  SUPPLIER_SP:         'Fn_tbl_FetchCustomerSupplierTranWs4Web',",
      "  SP_RB_META:          'Fn_Fetch_RBDetailByRBCode',",
      "  SP_QT_TYPES:         'fn_tbl_ddl_Pur_Configuration',  // CONFIRM",
      "  SP_DIVISIONS:        'Fn_tbl_FetchUserWsDivision',",
      "  SP_ITEM_PICKER:      'Fn_Tbl_FetchPurchaseItemDetailTransWs4Web', // CONFIRM",
      "  SAVE_ENDPOINT:       '/API/TranFormSave/Post_RB_QuotationMst_Save', // CONFIRM",
      "  STORAGE_HEADER_META: 'qtHeaderMeta',",
      "  STORAGE_ENTRY_META:  'qtEntryMeta',",
      "  LIST_OBJ_TYPE:       2,",
      "  SP_QT_LIST:          'Fn_tbl_Pur_QuotationMst_List',  // CONFIRM",
      "  LIST_DIVISION_ID:    15,                              // CONFIRM",
      '};',
    ]),
    blank(100),
    h2('use[Module].js — Hook Shape'),
    blank(40),
    code([
      '// src/hooks/useQuotation.js',
      "export function useQuotation(baseURL = API_BASE_URL) {",
      '  // ── State ──────────────────────────────────────────────',
      '  const [headerColumns,   setHeaderColumns]   = useState([]);',
      '  const [headerFetching,  setHeaderFetching]  = useState(false);',
      '  const [headerError,     setHeaderError]     = useState(null);',
      '  const [divisionOptions, setDivisionOptions] = useState([]);',
      '  const [qtTypeOptions,   setQtTypeOptions]   = useState([]);',
      '  const [supplierOptions, setSupplierOptions] = useState([]);',
      '  const [columns,         setColumns]         = useState([]);  // active visible cols',
      '  const [allColumns,      setAllColumns]      = useState([]);  // full schema',
      '  const [isFetching,      setIsFetching]      = useState(false);',
      '  const [metaError,       setMetaError]       = useState(null);',
      '  const { get } = useApi(baseURL);',
      '',
      '  // ── Phase 1 (mount) ────────────────────────────────────',
      '  const fetchHeaderMeta = useCallback(async () => { ... }, [get]);',
      '  const fetchDetailMeta = useCallback(async () => { ... }, [get]);',
      '',
      '  // ── Phase 2 (lazy) ─────────────────────────────────────',
      '  const fetchGridColumns = useCallback(async (divisionID) => { ... }, [allColumns, get]);',
      '',
      '  // ── Cascade helpers ────────────────────────────────────',
      '  const fetchQtTypes = useCallback(async (divisionID) => { ... }, [get]);',
      '  const clearQtTypes = useCallback(() => setQtTypeOptions([]), []);',
      '',
      '  return {',
      '    headerColumns, headerFetching, headerError, fetchHeaderMeta,',
      '    divisionOptions, qtTypeOptions, supplierOptions,',
      '    fetchQtTypes, clearQtTypes,',
      '    columns, allColumns, isFetching, metaError,',
      '    fetchDetailMeta, fetchGridColumns,',
      '  };',
      '}',
    ]),
    blank(),
  ];
}

function sec9_addNewModule() {
  return [
    h1('9. Adding a New Module — Step by Step'),
    blank(60),
    callout('warn', 'Complete all steps in order. Steps 1–6 are file creation. Steps 7–9 are wiring. Backend RB codes (Step 1) must be confirmed with the DBA before Step 5.'),
    blank(100),
    h2('Step 1 — Get Backend Values from DBA'),
    blank(40),
    p('Before writing a single line of code, confirm these values with the backend team:', { size: 21 }),
    blank(40),
    code([
      'RB_MASTER:     "RB_[Module]Mst"          // from DBA',
      'RB_DETAIL:     "RB_[Module]Det"          // from DBA',
      'SAVE_ENDPOINT: "/API/TranFormSave/Post_RB_[Module]Mst_Save"',
      'SP_LIST:       "Fn_tbl_Pur_[Module]Mst_List"',
      'SP_TYPES:      "fn_tbl_ddl_Pur_Configuration" (same as PI/PO, or a new SP)',
      'CONFIG_YEAR_ID / DIVISION_YEAR_ID: confirm correct year ID',
      'LIST_DIVISION_ID: default division for listing fetch',
    ]),
    blank(100),
    h2('Step 2 — Create the Module Folder and constants.js'),
    blank(40),
    ...([
      'Create folder:  src/pages/[module-name]/',
      'Copy src/pages/purchase-order/constants.js  into the new folder.',
      'Rename all PO_CONFIG keys to QUOTATION_CONFIG (or your module name).',
      'Replace all RB codes, SP names, SAVE_ENDPOINT with the confirmed values from Step 1.',
      'Change STORAGE_HEADER_META and STORAGE_ENTRY_META keys (e.g. qtHeaderMeta / qtEntryMeta).',
      'Update FORM_TAG and TRAN_BOOK to match the new module.',
    ].map((t, i) => step(i + 1, t))),
    blank(100),
    h2('Step 3 — Create the Hook  use[Module].js'),
    blank(40),
    ...([
      'Copy src/hooks/usePurchaseOrder.js → src/hooks/use[Module].js.',
      'Replace all usePurchaseOrder references with use[Module].',
      'Replace all PO_CONFIG references with your MODULE_CONFIG.',
      'Add or remove module-specific state (e.g. quotationOptions, customerOptions).',
      'Update fetchPoTypes → fetchQtTypes, clearPoTypes → clearQtTypes.',
    ].map((t, i) => step(i + 1, t))),
    blank(100),
    h2('Step 4 — Create the Listing Page  [Module]Page.jsx'),
    blank(40),
    ...([
      'Copy src/pages/purchase-order/PurchaseOrderPage.jsx → [Module]Page.jsx.',
      'Replace PO_CONFIG with your MODULE_CONFIG.',
      'Update buildListParams() to use your SP_LIST and param names.',
      'Update buildPoColumns() — change column keys (PONo → QTNo, PODate → QTDate, etc.).',
      "Update navigate calls: '/purchase-order/…' → '/[module-route]/…'.",
      'Update usePageHeader() — title, subtitle, backTo.',
    ].map((t, i) => step(i + 1, t))),
    blank(100),
    h2('Step 5 — Create the Entry Form  [Module]Form.jsx'),
    blank(40),
    ...([
      'Copy src/pages/purchase-order/PurchaseOrderForm.jsx → [Module]Form.jsx.',
      'Replace usePurchaseOrder with use[Module] (your hook).',
      'Replace all PO_CONFIG references with MODULE_CONFIG.',
      "Replace all navigate('/purchase-order') calls with navigate('/[module-route]').",
      'Update usePageHeader() — title, subtitle, backTo.',
      'Update handleFilterChange cascade logic if your module has different cascade rules.',
      'Keep or remove the Amend strip depending on module requirements.',
      'Update the save payload keys to match your module\'s SP parameters.',
    ].map((t, i) => step(i + 1, t))),
    blank(100),
    h2('Step 6 — Create  [Module]Page.css'),
    blank(40),
    ...([
      'Copy src/pages/purchase-order/PurchaseOrderPage.css.',
      'Global-replace all  po-  prefixes with your module prefix (e.g.  qt- ).',
      'Update any module-specific colours or layout dimensions.',
    ].map((t, i) => step(i + 1, t))),
    blank(100),
    h2('Step 7 — Register Route in App.jsx'),
    blank(40),
    code([
      "// src/App.jsx — add these two imports:",
      "import [Module]Page from './pages/[module-name]/[Module]Page';",
      "import [Module]Form from './pages/[module-name]/[Module]Form';",
      '',
      '// Add these two routes inside AppLayout:',
      '<Route path="[module-route]"      element={<[Module]Page />} />',
      '<Route path="[module-route]/:id"  element={<[Module]Form />} />',
    ]),
    blank(100),
    h2('Step 8 — Add Nav Link in AppShell.jsx'),
    blank(40),
    code([
      "// src/layout/AppShell.jsx — NAV_SECTIONS.items:",
      "import { FileText } from 'lucide-react';   // pick appropriate icon",
      '',
      "{ to: '/[module-route]', icon: FileText, label: '[Module Display Name]', end: false },",
    ]),
    blank(100),
    h2('Step 9 — Re-export Constants in src/api/constants.js'),
    blank(40),
    code([
      "// src/api/constants.js — add at bottom:",
      "export { QUOTATION_CONFIG } from '../pages/[module-name]/constants';",
    ]),
    blank(100),
    callout('tip', 'That\'s it — 9 steps, ~6 files. The new module is live. Test with the dev server: npm run dev.'),
    blank(),
  ];
}

function sec10_patterns() {
  return [
    h1('10. Key Design Patterns'),
    blank(60),
    h2('Pattern 1 — isNewRoute (new vs edit detection)'),
    blank(40),
    code([
      "// In every Form component:",
      "const { id: routeId } = useParams();",
      'const location         = useLocation();',
      "const isNewRoute       = location.pathname.endsWith('/new') || routeId === 'new';",
      'const recordId         = isNewRoute ? 0 : Number(routeId) || 0;',
      '',
      '// URLs:',
      "//   /purchase-order/new   → isNewRoute=true,  recordId=0  (new form)",
      "//   /purchase-order/123   → isNewRoute=false, recordId=123 (edit form)",
    ]),
    blank(100),
    h2('Pattern 2 — headerValuesRef (uncontrolled header state)'),
    blank(40),
    callout('note', 'Header field values are stored in a useRef (not useState) to avoid re-renders on every keystroke. Values are only read at save time.'),
    blank(60),
    code([
      'const headerValuesRef = useRef({',
      "  TranCode: '', TranDate: todayISO, DivisionID: 0, POTypeID: 0,",
      '  SupplierID: 0, CurrencyID: 0, CurrencyRate: 0, CrDays: 0,',
      "  BasedOnID: '0', CompanyID: 1, YearID: 2, LoginID: 1,",
      '  IDNumber: recordId, IsAmend: 0, AmendPOID: 0,',
      '});',
      '',
      '// EnterpriseFilterPanel calls this on every change:',
      'const handleFilterChange = (colName, val) => {',
      '  headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };',
      '  // Then: cascade logic (clear POTypeID, reload types, fetch supplier info, etc.)',
      '};',
    ]),
    blank(100),
    h2('Pattern 3 — isEditMode gate'),
    blank(40),
    callout('note', 'All form inputs are disabled until the user clicks Add in ActionBar. Prevents accidental edits when navigating to an existing record.'),
    blank(60),
    code([
      'const [isEditMode, setIsEditMode] = useState(false);',
      '',
      '// ActionBar Add button calls this:',
      'const enterEditMode = () => setIsEditMode(true);',
      'const exitEditMode  = () => setIsEditMode(false);',
      '',
      '// Pass to EnterpriseFilterPanel:',
      '<EnterpriseFilterPanel disabled={!isEditMode} ... />',
      '',
      '// Pass to tab buttons:',
      '<button disabled={!isEditMode}>Add New</button>',
    ]),
    blank(100),
    h2('Pattern 4 — Cascade Resets'),
    blank(40),
    code([
      "// constants.js — CASCADE_RESETS map:",
      'export const PO_FILTER_CASCADE_RESETS = {',
      "  DivisionID: ['POTypeID'],  // changing Division clears PO Type",
      '};',
      '',
      '// Form component — handleFilterChange:',
      'if (colName === "DivisionID") {',
      '  headerValuesRef.current.POTypeID = 0;',
      '  clearPoTypes();',
      '  if (val && val !== "0") await fetchPoTypes(val);',
      '}',
      '',
      '// Supplier → auto-fill Currency, Rate, CrDays:',
      'if (colName === "SupplierID" && val) {',
      '  const info = await fetchSupplierInfo(val);',
      '  if (info) {',
      '    headerValuesRef.current.CurrencyID   = info.CurrencyID;',
      '    headerValuesRef.current.CurrencyRate = info.CurrencyRate;',
      '    headerValuesRef.current.CrDays       = info.CrDays;',
      '  }',
      '}',
    ]),
    blank(100),
    h2('Pattern 5 — Temp Row IDs (EntryGrid)'),
    blank(40),
    code([
      '// Negative temp IDs never clash with real DB IDs.',
      'let _tempId = -1;',
      'const nextTempId = () => _tempId--;',
      '',
      '// Create a blank row:',
      'const blankRow = { id: nextTempId() };',
      "allColumns.forEach(({ key, colDataType }) => {",
      '  blankRow[key] = getColDefault(colDataType);',
      '});',
      'itemGridRef.current.addRow(blankRow);',
      '',
      '// On save — strip id before sending to API:',
      'const detRows = itemGridRef.current.getRows().map(({ id, ...rest }) => ({',
      '  ...rest, LoginID: DEFAULT_LOGIN_ID,',
      '}));',
    ]),
    blank(100),
    h2('Pattern 6 — Module CSS Namespace'),
    blank(40),
    callout('note', 'Every module gets its own CSS class prefix. Never share classes across module folders.'),
    blank(60),
    code([
      '/* Rule: .{prefix}-{block}__{element}--{modifier} */  ',
      '',
      '/* Purchase Inquiry: */  .pi-list-page  .pi-list-panel  .pi-list__edit-btn',
      '/* Purchase Order:   */  .po-list-page  .po-list-panel  .po-list__edit-btn',
      '/* Quotation:        */  .qt-list-page  .qt-list-panel  .qt-list__edit-btn',
      '',
      '/* Entry form uses same prefix:  */',
      '.po-page  .po-amend-strip  .po-grid-section  .po-tab-pane  .po-tab-action-btn',
    ]),
    blank(),
  ];
}

function sec11_backendContract() {
  return [
    h1('11. Backend Contract — Talking to the Server'),
    blank(60),
    h2('Standard FN_FETCH_DATA Request (GET)'),
    blank(40),
    code([
      'GET http://122.179.135.100:8095/IMS_LIVE/webservice/WsIMS.asmx/FN_Fetch_Data',
      '  ?ObjType=2',
      '  &ObjName=Fn_tbl_FetchUserWsDivision',
      '  &JSon=[{"prmYearID":2,"prmLoginID":1}]',
      '  &p_ErrCode=-1',
      '  &p_ErrMsg=',
      '',
      '// Response:',
      '{',
      '  "Table": [',
      '    { "DivisionID": 15, "DivisionName": "Head Office" },',
      '    ...',
      '  ]',
      '}',
    ]),
    blank(100),
    h2('RB Metadata Fetch Sequence'),
    blank(40),
    code([
      '// 1. Resolve RB code → RBID',
      'GET FN_Fetch_Data?ObjType=2&ObjName=Fn_Fetch_RBDetailByRBCode',
      '  &JSon=[{"prmRBCode":"RB_PurInquiryMst"}]',
      '// Response: Table[0].RBID = 42  (example)',
      '',
      '// 2. Fetch column definitions for that RBID',
      'GET GetDetailColData?prmMasterID=42&prmLoginID=1',
      '// Response: { Links: [ { ColName, ColCtrlType, ColDataType, IsEditAllow, ... } ] }',
      '',
      '// 3. Build filter panel from Links',
      'buildGridColumns(Links, dropdownData, options)',
    ]),
    blank(100),
    h2('REST Save Request (POST)'),
    blank(40),
    code([
      'POST http://122.179.135.100:8095/IMS_LIVE/API/TranFormSave/Post_RB_PurInquiryMst_Save',
      'Content-Type: application/json',
      '',
      '{',
      '  "prmStrMstJSON":     "[{\"TranCode\":\"\",\"TranDate\":\"02-Jun-2026\",...}]",',
      '  "prmStrDetJSON":     "[{\"SrNo\":1,\"ItemCode\":\"ITM001\",...}]",',
      '  "prmStrIndtDetJSON": "[]"',
      '}',
      '',
      '// Success response: { success: true, IDNumber: 1042 }',
      '// Error response:   { success: false, message: "..." }',
    ]),
    blank(100),
    h2('Error Handling Convention'),
    blank(40),
    code([
      '// useApi interceptor normalises all errors to:',
      '{ status: 404, message: "Not found", raw: axiosError }',
      '',
      '// Hooks wrap each call in try/catch:',
      'try {',
      '  const res = await get(ENDPOINTS.FN_FETCH_DATA, params);',
      '  if (!res?.Table?.length) throw new Error("No data returned.");',
      '  setData(res.Table);',
      '} catch (err) {',
      '  console.error("[Module] fetch failed:", err);',
      '  setError(err?.message || "Failed to load data.");',
      '}',
    ]),
    blank(),
  ];
}

function sec12_cloneChecklist() {
  const steps = [
    'Clone the repo: git clone [repo-url] my-new-project',
    'Install deps: npm install',
    'Start dev server: npm run dev  (opens on http://localhost:5173)',
    'Update API_BASE_URL in src/api/constants.js to point to the new backend.',
    'Update DEFAULT_LOGIN_ID, DEFAULT_COMPANY_ID, DEFAULT_YEAR_ID if different.',
    'Update AppShell.jsx — brand name, logo, NAV_SECTIONS for new project modules.',
    'Update src/theme/enterprise.css — change --primary colour for client branding.',
    'Replace demo modules (purchase-inquiry, purchase-order) with the new modules.',
    'For each new module: follow the 9-step process in Section 9.',
    'Build for production: npm run build  (outputs to dist/)',
    'Preview production build: npm run preview',
  ];

  return [
    h1('12. Clone Checklist — New Project in Minutes'),
    blank(60),
    callout('tip', 'The project is a React SPA. Cloning = git clone + npm install + update 3 files (constants.js, AppShell.jsx, enterprise.css). Then add modules one by one.'),
    blank(80),
    ...steps.map((s, i) => step(i + 1, s)),
    blank(120),
    h2('Files to Update on Every Clone'),
    blank(40),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [th('File', 35), th('What to change', 65)], tableHeader: true }),
        dataRow([{ text: 'src/api/constants.js', code: true }, 'API_BASE_URL, API_BASE_URL_IMS — point to new server. Update DEFAULT_LOGIN_ID, DEFAULT_COMPANY_ID.'], [35, 65], false),
        dataRow([{ text: 'src/layout/AppShell.jsx', code: true }, 'NAV_SECTIONS — replace modules with new project\'s modules. Brand name in sidebar.'], [35, 65], true),
        dataRow([{ text: 'src/theme/enterprise.css', code: true }, '--primary, --accent, --secondary — brand colours. --font-family if client uses a different font.'], [35, 65], false),
        dataRow([{ text: 'package.json', code: true }, 'name field — rename to new project. Update version.'], [35, 65], true),
        dataRow([{ text: 'index.html', code: true }, '<title> tag — change page title shown in browser tab.'], [35, 65], false),
      ],
    }),
    blank(),
  ];
}

// ── Assemble ──────────────────────────────────────────────────────────────────
async function main() {
  const doc = new Document({
    creator: 'Horizon Enterprise IMS',
    title:   'IMS Project Cloning Blueprint',
    subject: 'Complete developer handbook for cloning and extending Horizon Enterprise IMS',
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1260, right: 1260 },
        },
      },
      children: [
        ...titlePage(),
        ...sec1_projectIdentity(),
        ...sec2_techStack(),
        ...sec3_folderStructure(),
        ...sec4_designSystem(),
        ...sec5_appShell(),
        ...sec6_componentLibrary(),
        ...sec7_apiPattern(),
        ...sec8_moduleBlueprint(),
        ...sec9_addNewModule(),
        ...sec10_patterns(),
        ...sec11_backendContract(),
        ...sec12_cloneChecklist(),
        blank(200),
        p('— END OF BLUEPRINT —', {
          color: '94A3B8', size: 19, italic: true, align: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT, buffer);
  console.log(`✅  Blueprint saved → ${OUT}`);
  console.log(`    Size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });
