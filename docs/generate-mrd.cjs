// generate-mrd.cjs — Creates MRD_PurchaseInquiry.docx using native docx package
// Run: node docs/generate-mrd.cjs
'use strict';

const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, VerticalAlign, PageOrientation, convertInchesToTwip,
  TableOfContents, StyleLevel,
} = require('docx');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'MRD_Reference_PI.docx');

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  navy:      '0F3460',
  blue:      '1E40AF',
  darkText:  '1A1A2E',
  white:     'FFFFFF',
  rowEven:   'F8FAFC',
  rowOdd:    'FFFFFF',
  thBg:      '0F3460',
  phase1Bg:  'DBEAFE', phase1Fg: '1E3A8A',
  phase2Bg:  'DCFCE7', phase2Fg: '14532D',
  phase3Bg:  'FEF9C3', phase3Fg: '713F12',
  phase4Bg:  'FFE4E6', phase4Fg: '881337',
  phase5Bg:  'F3E8FF', phase5Fg: '581C87',
  phase6Bg:  'FFEDD5', phase6Fg: '7C2D12',
  phase7Bg:  'ECFDF5', phase7Fg: '064E3B',
  fillBg:    'F8FAFC',
  noteBg:    'FFFBEB',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function txt(text, opts = {}) {
  return new TextRun({ text, font: 'Calibri', size: opts.size ?? 22, ...opts });
}

function bold(text, opts = {}) { return txt(text, { bold: true, ...opts }); }
function code(text) { return txt(text, { font: 'Courier New', size: 20, color: 'C7254E' }); }

function para(runs, opts = {}) {
  const children = Array.isArray(runs) ? runs : [typeof runs === 'string' ? txt(runs) : runs];
  return new Paragraph({ children, spacing: { after: 80, before: opts.before ?? 0 }, ...opts });
}

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.navy } },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
  });
}

function h3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 60 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [txt(text)],
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

// ── Table builder ─────────────────────────────────────────────────────────────

function cell(content, opts = {}) {
  const {
    bg = C.rowOdd, bold: isBold = false, isHeader = false,
    colspan = 1, rowspan = 1, shade = null,
  } = opts;

  const runs = Array.isArray(content) ? content
    : typeof content === 'string'
      ? [txt(content, { bold: isHeader || isBold, color: isHeader ? C.white : C.darkText, size: isHeader ? 20 : 20 })]
      : [content];

  return new TableCell({
    children: [new Paragraph({ children: runs, spacing: { after: 40, before: 40 } })],
    columnSpan: colspan,
    rowSpan: rowspan,
    verticalAlign: VerticalAlign.CENTER,
    shading: shade ?? { fill: isHeader ? C.thBg : bg, type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      left:   { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      right:  { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
    },
  });
}

function headerRow(labels) {
  return new TableRow({
    tableHeader: true,
    children: labels.map((l) => cell(l, { isHeader: true })),
  });
}

function dataRow(values, even = false) {
  const bg = even ? C.rowEven : C.rowOdd;
  return new TableRow({
    children: values.map((v, i) => {
      if (typeof v === 'object' && v !== null && !Array.isArray(v) && v._type !== 'TextRun') {
        return cell(v.text ?? '', { bg, ...v });
      }
      return cell(v, { bg });
    }),
  });
}

function simpleTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow(headers),
      ...rows.map((r, i) => dataRow(r, i % 2 === 1)),
    ],
  });
}

function spacer(pts = 80) {
  return new Paragraph({ text: '', spacing: { after: pts } });
}

// ── Cover page ────────────────────────────────────────────────────────────────

function coverSection() {
  return [
    new Paragraph({
      children: [txt('HORIZON ENTERPRISE IMS — MODULE REQUIREMENTS DOCUMENT', { bold: true, allCaps: true, color: '64748B', size: 18 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [txt('Purchase Inquiry', { bold: true, color: C.navy, size: 52 })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [txt('MRD · Version 1.0 · June 2026', { color: C.blue, size: 26, italics: true })],
      spacing: { after: 240 },
    }),
    simpleTable(
      ['Property', 'Value'],
      [
        ['Module Code', [code('INQ')]],
        ['Transaction Book', [code('PURINQUIRY')]],
        ['App Route', [code('/purchase-inquiry/:id?')]],
        ['Status', 'Completed ✓'],
        ['Document Date', '08-Jun-2026'],
        ['Prepared By', 'Horizon Enterprise IMS Team'],
      ],
    ),
    spacer(160),
    new Paragraph({
      children: [
        txt('📌  How to use this document: ', { bold: true, color: '92400E' }),
        txt('This MRD captures the screen design and API contract for Purchase Inquiry as built. '
          + 'For the next module (Purchase Order, Quotation, etc.) copy this document, '
          + 'update every highlighted section, and share it with the dev team. '
          + 'The dev team implements exactly from this document — no back-and-forth needed.', { color: '78350F' }),
      ],
      shading: { fill: C.noteBg, type: ShadingType.CLEAR },
      border: { left: { style: BorderStyle.SINGLE, size: 16, color: 'F59E0B' } },
      indent: { left: 120 },
      spacing: { after: 120, before: 80 },
    }),
  ];
}

// ── Section 1 — Module Overview ───────────────────────────────────────────────

function section1() {
  return [
    h1('1.  Module Overview'),
    simpleTable(
      ['Property', 'Value'],
      [
        ['Module Name', 'Purchase Inquiry'],
        ['Short Description', 'Raise an inquiry to suppliers for items — directly or against open indent requests.'],
        ['Form Tag', [code('INQ')]],
        ['Transaction Book', [code('PURINQUIRY')]],
        ['Master RB Code', [code('RB_PurInquiryMst')]],
        ['Detail RB Code', [code('RB_PurInquiryDet')]],
        ['Item Picker RB — Direct', [code('RB_PurInqSelOnlyItem')]],
        ['Item Picker RB — Indent Wise', [code('RB_PurInqSelIndtItem')]],
        ['localStorage Keys', [code('piHeaderMeta'), txt('  '), code('piEntryMeta')]],
        ['Year ID (Config & Division)', '2'],
        ['Based On Modes', 'Direct (value: 0)  |  Indent wise (value: 2)'],
        ['Page Default State', 'Read-only. Add button → Edit mode. Cancel → back to Read-only.'],
      ],
    ),
    spacer(),
  ];
}

// ── Section 2 — Screen Design ─────────────────────────────────────────────────

function section2() {
  return [
    h1('2.  Screen Design'),

    h2('2.1  Page Layout (Top → Bottom)'),
    simpleTable(
      ['Zone', 'Component', 'Description'],
      [
        ['Zone 1', 'Header Filter Panel', 'Inquiry No., Date, Division, Inquiry Type, Expected Date, Department, Based On, Remark'],
        ['Zone 2', 'Grid Section — 3 tabs', 'Item Grid  |  Suppliers  |  Terms & Conditions'],
        ['Zone 3', 'Indent Details', 'Collapsible section showing linked indent records per selected item row'],
        ['Zone 4', 'Action Bar (footer)', 'Read-only: Add New.  Edit mode: Document F6 | Save & Print | Save | Cancel | Close'],
      ],
    ),
    spacer(),

    h2('2.2  Header Fields'),
    simpleTable(
      ['Field Label', 'Field Key', 'Control Type', 'Required?', 'Notes / Cascade'],
      [
        ['Inquiry No.', 'TranCode', 'Text Box', 'Auto', 'Server-generated on save. Read-only.'],
        ['Date', 'TranDate', 'Date Picker', 'Yes', 'Defaults to today.'],
        ['Division', 'DivisionID', 'Dropdown', 'Yes', 'Must be selected before item/supplier pick. Triggers Inquiry Type reload.'],
        ['Inquiry Type', 'ConfigID', 'Dropdown', 'No', 'Loaded after Division selected (API-06). Cleared when Division changes.'],
        ['Expected Date', 'ExpectedDate', 'Date Picker', 'No', 'Optional target delivery date.'],
        ['Department', 'DeptID', 'Dropdown', 'No', 'Loaded on page mount. No cascade.'],
        ['Based On', 'BasedOnID', 'Dropdown', 'No', 'Hardcoded: Direct (0) / Indent wise (2). Controls item picker mode.'],
        ['Remark', 'Remarks', 'Textarea', 'No', 'Free-text.'],
      ],
    ),
    spacer(),

    h2('2.3  Grid Section — Tabs'),
    simpleTable(
      ['Tab', 'Columns Source', 'Buttons on Tab', 'Notes'],
      [
        ['Item Grid', 'API-driven (RB_PurInquiryDet)', 'Add New, Select Item', 'Dropdown options lazy-loaded on first Add New. Supports collapsible child rows in Indent wise mode.'],
        ['Suppliers', 'Hardcoded (see 2.4)', 'Select Supplier', 'Sr.No auto-resequences on delete.'],
        ['Terms & Conditions', 'Hardcoded static table', 'None', 'Sr.No | Terms Type | Code | Terms & Conditions.'],
      ],
    ),
    para([txt('Tab-level controls (always visible): ', { bold: true }), txt('Approved filter (All / Approved / Pending)  |  Delete button (enabled when rows selected)')]),
    spacer(),

    h2('2.4  Suppliers Grid — Hardcoded Columns'),
    simpleTable(
      ['Column Label', 'Key', 'Width', 'Editable'],
      [
        ['(Checkbox)', 'cb', '48 px', 'No'],
        ['Sr.No', 'SrNo', '70 px', 'No'],
        ['Supplier Name', 'SupplierName', '200 px', 'No'],
        ['Address', 'Address', '220 px', 'No'],
        ['City', 'City', '120 px', 'No'],
        ['Mobile No.', 'MobileNo', '110 px', 'No'],
      ],
    ),
    spacer(),

    h2('2.5  Indent Details — Hardcoded Columns'),
    simpleTable(
      ['Column Label', 'Key', 'Width'],
      [
        ['Sr.No', 'SrNo', '70 px'],
        ['Indent No.', 'IndentNo', '120 px'],
        ['Indent Date', 'IndentDate', '110 px'],
        ['Item Name', 'ItemName', '190 px'],
        ['Indent Qty', 'IndentQty', '100 px'],
        ['Tran Qty', 'TranQty', '100 px'],
        ['Unit', 'Unit', '80 px'],
      ],
    ),
    spacer(),
  ];
}

// ── Section 3 — Business Rules ────────────────────────────────────────────────

function section3() {
  return [
    h1('3.  Business Rules & Validations'),
    simpleTable(
      ['#', 'Rule', 'Detail'],
      [
        ['BR-01', 'Division prerequisite', 'User must select Division before Select Item / Select Supplier. Alert shown if missing.'],
        ['BR-02', 'Division cascades to Inquiry Type', 'Inquiry Type clears immediately on Division change, then reloads options for new Division.'],
        ['BR-03', 'Based On controls item picker', 'Direct (0) → RB_PurInqSelOnlyItem. Indent wise (2) → RB_PurInqSelIndtItem + collapsible child rows.'],
        ['BR-04', 'Indent wise items are aggregated', 'Selected indent rows go through Fn_tbl_FetchIndentSummaryItem4Inquiry. Response = parent item rows; originals = children.'],
        ['BR-05', 'Date format for API', 'All dates sent as dd-Mon-yyyy (e.g. 02-Jun-2026). Use formatTranDate() helper.'],
        ['BR-06', 'Edit mode gate', 'Page is read-only on load. All fields & grids disabled until Add New is clicked.'],
        ['BR-07', 'Cancel resets all state', 'Wipes localStorage, resets all state, clears both grids, force-remounts filter panel.'],
        ['BR-08', 'Sr.No resequences on delete', 'After supplier row deletion, remaining rows renumber sequentially.'],
        ['BR-09', 'Temp IDs stripped on save', 'Locally created rows have negative integer id. id field is stripped before building save payload.'],
      ],
    ),
    spacer(),
  ];
}

// ── Section 4 — API Reference ─────────────────────────────────────────────────

function phaseTag(label, bg, fg) {
  return txt(`[${label}]`, { bold: true, color: fg, shading: { fill: bg, type: ShadingType.CLEAR } });
}

function apiTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow(['Property', 'Detail']),
      ...rows.map(([k, v], i) => new TableRow({
        children: [
          cell(k, { bg: i % 2 === 1 ? C.rowEven : C.rowOdd, bold: true }),
          cell(v, { bg: i % 2 === 1 ? C.rowEven : C.rowOdd }),
        ],
      })),
    ],
  });
}

function reqTable(rows) {
  return simpleTable(['Parameter', 'Type', 'Value'], rows);
}
function resTable(rows) {
  return simpleTable(['Field', 'Type / Mapped To'], rows);
}

function section4() {
  return [
    h1('4.  API Reference'),

    h2('4.1  Infrastructure'),
    simpleTable(
      ['Property', 'Value'],
      [
        ['Primary Base URL', 'http://122.179.135.100:8095/IMS_LIVE/webservice/WsIMS.asmx'],
        ['REST Gateway (saves)', 'http://122.179.135.100:8095/IMS_LIVE'],
        ['GET mechanism', 'useApi().get(endpoint, params) → serialised to URLSearchParams'],
        ['POST mechanism', 'fetch() POST with JSON body to REST gateway'],
        ['Default Login ID', '1'],
        ['Default Company ID', '1'],
        ['Default Year ID', '2'],
      ],
    ),
    spacer(),

    h2('4.2  Load Sequence'),
    simpleTable(
      ['Phase', 'Trigger', 'APIs Called'],
      [
        ['Phase 1 — Mount', 'Page load', 'API-01 → API-02 (header cols) + API-03 (divisions) + API-04 (departments) in parallel.\nSimultaneously: API-05 (detail RB meta + columns).'],
        ['Phase 2 — Cascade', 'User selects Division', 'API-06: fetch Inquiry Types for selected Division.'],
        ['Phase 3 — Lazy Load', 'User clicks Add New (first time)', 'API-07: GetFilterDetail per dropdown column in item grid.'],
        ['Phase 4 — Select Item', 'User clicks Select Item', 'API-08 (part 1: RB meta) → API-08 (part 2: columns) → API-08 (part 3: item rows).'],
        ['Phase 5 — Select Supplier', 'User clicks Select Supplier', 'API-09: fetch supplier list for Division.'],
        ['Phase 6 — Insert Items', 'User clicks Insert in picker (Indent wise only)', 'API-10: POST selected indent rows → receive aggregated parent rows.'],
        ['Phase 7 — Save', 'User clicks Save', 'API-11: POST master + detail + indent detail JSON.'],
      ],
    ),
    spacer(),

    h2('4.3  API-01 — Fetch Master RB Metadata'),
    apiTable([
      ['Endpoint', 'FN_Fetch_Data'],
      ['Method', 'GET'],
      ['SP / ObjName', 'Fn_Fetch_RBDetailByRBCode'],
      ['Phase', 'Phase 1 — Mount'],
      ['Purpose', 'Resolve RBID and SaveProcName for the master (header) board. RBID used in all header column calls.'],
    ]),
    spacer(60),
    h3('Request'),
    reqTable([
      ['ObjType', 'int', '2  (Function)'],
      ['ObjName', 'string', 'Fn_Fetch_RBDetailByRBCode'],
      ['JSon', 'JSON string', '[{ "prmRBCode": "RB_PurInquiryMst" }]'],
      ['p_ErrCode', 'int', '-1'],
      ['p_ErrMsg', 'string', '""'],
    ]),
    h3('Response (Table[0])'),
    resTable([
      ['RBID', 'int — cached in localStorage (piHeaderMeta)'],
      ['SaveProcName', 'string — sent in save payload; cached in localStorage'],
    ]),
    spacer(),

    h2('4.4  API-02 — Fetch Header Column Definitions'),
    apiTable([
      ['Endpoint', 'GetDetailColData'],
      ['Method', 'GET'],
      ['Phase', 'Phase 1 — Mount (right after API-01)'],
      ['Purpose', 'Get field definitions for header filter panel. ColCtrlType overrides static control type per filter field.'],
    ]),
    spacer(60),
    h3('Request'),
    reqTable([
      ['prmMasterID', 'int', 'RBID from API-01'],
      ['prmLoginID', 'int', '1'],
    ]),
    h3('Response (Links array — key fields)'),
    resTable([
      ['ColName', 'string — matched against FilterParameterID in header filters'],
      ['ColCtrlType', 'int — overrides static control type (dropdown / textbox / date)'],
    ]),
    spacer(),

    h2('4.5  API-03 — Fetch Division Options'),
    apiTable([
      ['Endpoint', 'FN_Fetch_Data'],
      ['Method', 'GET'],
      ['SP / ObjName', 'Fn_tbl_FetchUserWsDivision'],
      ['Phase', 'Phase 1 — Mount (parallel)'],
      ['Purpose', 'Populate Division dropdown.'],
    ]),
    spacer(60),
    h3('Request'),
    reqTable([
      ['ObjType', 'int', '2'],
      ['ObjName', 'string', 'Fn_tbl_FetchUserWsDivision'],
      ['JSon', 'JSON string', '[{ "prmUserID": 1, "prmCompanyID": 1, "prmYearID": 2 }]'],
    ]),
    h3('Response (Table array)'),
    resTable([
      ['DivisionID', 'int → dropdown value'],
      ['DivisionName', 'string → dropdown label'],
    ]),
    spacer(),

    h2('4.6  API-04 — Fetch Department Options'),
    apiTable([
      ['Endpoint', 'FN_Fetch_Data'],
      ['Method', 'GET'],
      ['SP / ObjName', 'Pr_Fetch_DepartmentData_IMS'],
      ['ObjType', '1  (Procedure)'],
      ['Phase', 'Phase 1 — Mount (parallel)'],
      ['Purpose', 'Populate Department dropdown.'],
    ]),
    spacer(60),
    h3('Request'),
    reqTable([
      ['ObjType', 'int', '1'],
      ['ObjName', 'string', 'Pr_Fetch_DepartmentData_IMS'],
      ['JSon', 'JSON string', '[{ "PrmDeptID": 0 }]'],
    ]),
    h3('Response (Table array)'),
    resTable([
      ['DepartmentID', 'int → dropdown value'],
      ['DepartmentName', 'string → dropdown label'],
    ]),
    spacer(),

    h2('4.7  API-05 — Fetch Detail RB Metadata & Columns'),
    apiTable([
      ['Endpoints', 'FN_Fetch_Data  then  GetDetailColData'],
      ['Method', 'GET (both)'],
      ['Phase', 'Phase 1 — Mount (parallel with master meta)'],
      ['Purpose', 'Resolve RBID for RB_PurInquiryDet, then fetch column defs for item grid. Dropdown options within columns are lazy-loaded in Phase 3.'],
    ]),
    spacer(60),
    h3('Step 1 — RB Meta Request'),
    reqTable([
      ['prmRBCode', 'string', 'RB_PurInquiryDet'],
    ]),
    h3('Step 2 — Column Definitions Request'),
    reqTable([
      ['prmMasterID', 'int', 'RBID from Step 1'],
      ['prmLoginID', 'int', '1'],
    ]),
    h3('Response (Links array — key fields per column)'),
    resTable([
      ['ColName', 'string — grid column key'],
      ['ColDataType', 'int — determines default cell value (0 = numeric, else text)'],
      ['ColCtrlType', 'int — dropdown / textbox / etc.'],
      ['IsEventReq / IsEventCol', 'flag — marks columns triggering row recalculation events'],
    ]),
    spacer(),

    h2('4.8  API-06 — Fetch Inquiry Types (Division Cascade)'),
    apiTable([
      ['Endpoint', 'FN_Fetch_Data'],
      ['Method', 'GET'],
      ['SP / ObjName', 'fn_tbl_ddl_Pur_Configuration'],
      ['Phase', 'Phase 2 — Division Selected'],
      ['Purpose', 'Load Inquiry Type options for the chosen Division.'],
    ]),
    spacer(60),
    h3('Request'),
    reqTable([
      ['PrmCompanyId', 'int', '1'],
      ['PrmDivisionId', 'int', 'Selected DivisionID'],
      ['PrmYearId', 'int', '2'],
      ['PrmUserId', 'int', '1'],
      ['PrmFormTag', 'string', '"INQ"'],
      ['PrmRefType', 'string', '""'],
    ]),
    h3('Response (Table array)'),
    resTable([
      ['ConfigurationId', 'int → dropdown value'],
      ['Name', 'string → dropdown label'],
    ]),
    spacer(),

    h2('4.9  API-07 — Fetch Item Grid Dropdown Options (Lazy)'),
    apiTable([
      ['Endpoint', 'GetFilterDetail'],
      ['Method', 'GET'],
      ['Phase', 'Phase 3 — First Add New click'],
      ['Purpose', 'For each dropdown column in the detail grid, fetch selectable options. Called once per column, result cached. NOT called at mount.'],
    ]),
    spacer(60),
    h3('Request (per dropdown column)'),
    reqTable([
      ['prmMasterID', 'int', 'RBID of RB_PurInquiryDet'],
      ['prmFuncCode', 'string', 'RB_PurInquiryDet'],
      ['prmColName', 'string', 'Column name e.g. "UnitID"'],
      ['prmCboMode', 'string', '"C"'],
      ['prmDivisionID', 'int', 'Current DivisionID (or 0)'],
      ['prmLoginID', 'int', '1'],
    ]),
    h3('Response'),
    resTable([
      ['Table array', 'Option list for the column dropdown. First two fields → value and label.'],
    ]),
    spacer(),

    h2('4.10  API-08 — Fetch Item Picker RB & Rows (Select Item)'),
    apiTable([
      ['Endpoints', 'FN_Fetch_Data (×2) + GetDetailColData'],
      ['Method', 'GET'],
      ['Phase', 'Phase 4 — Select Item click'],
      ['Purpose', 'Step 1: resolve item picker RBID by BasedOnID. Step 2: get picker columns. Step 3: fetch item rows for modal.'],
    ]),
    spacer(60),
    h3('Step 1 — Choose RB Code by BasedOnID'),
    simpleTable(
      ['BasedOnID', 'RB Code Used'],
      [
        ['0  (Direct)', 'RB_PurInqSelOnlyItem'],
        ['2  (Indent wise)', 'RB_PurInqSelIndtItem'],
      ],
    ),
    h3('Step 3 — Item Rows Request'),
    reqTable([
      ['ObjName', 'string', 'Fn_Tbl_FetchPurchaseItemDetailTransWs4Web'],
      ['prmDivisionID', 'int', 'Selected DivisionID'],
      ['prmYearID', 'int', '2'],
      ['prmLoginID', 'int', '1'],
      ['prmTranDate', 'string', '"dd-Mon-yyyy"'],
      ['prmConfigID', 'int', 'Selected ConfigID'],
      ['prmSupplierID', 'int', '0'],
      ['prmTranBook', 'string', '"PURINQUIRY"'],
      ['prmFrmOption', 'int', 'BasedOnID (0 or 2)'],
    ]),
    spacer(),

    h2('4.11  API-09 — Fetch Supplier List (Select Supplier)'),
    apiTable([
      ['Endpoint', 'FN_Fetch_Data'],
      ['Method', 'GET'],
      ['SP / ObjName', 'Fn_tbl_FetchCustomerSupplierTranWs4Web'],
      ['Phase', 'Phase 5 — Select Supplier click'],
      ['Purpose', 'Populate supplier picker modal for selected Division.'],
    ]),
    spacer(60),
    h3('Request'),
    reqTable([
      ['PrmDivisionId', 'int', 'Selected DivisionID'],
      ['PrmLoginId', 'int', '1'],
      ['PrmYearId', 'int', '2'],
      ['PrmPartyType', 'string', '"S"  (Supplier)'],
    ]),
    h3('Response (Table array)'),
    resTable([
      ['SupplierID', 'int → row id'],
      ['SupplierName', 'string → SupplierName column'],
      ['SuppAddress', 'string → Address column'],
      ['City', 'string → City column'],
      ['ContactNo', 'string → MobileNo column'],
    ]),
    spacer(),

    h2('4.12  API-10 — Fetch Indent Summary (Indent Wise Only)'),
    apiTable([
      ['Endpoint', '/API/Values  (REST gateway POST)'],
      ['Method', 'POST'],
      ['SP / ObjName', 'Fn_tbl_FetchIndentSummaryItem4Inquiry'],
      ['Phase', 'Phase 6 — Insert Items in Indent wise mode'],
      ['Purpose', 'Takes selected indent rows, aggregates into parent item rows. Parents → item grid. Originals → collapsible children.'],
    ]),
    spacer(60),
    h3('Request Body'),
    reqTable([
      ['ObjType', 'int', '2'],
      ['ObjName', 'string', 'Fn_tbl_FetchIndentSummaryItem4Inquiry'],
      ['JSon', 'array', '[{ "prmJSon": [<selectedIndentRows>] }]'],
      ['p_ErrCode', 'int', '-1'],
      ['p_ErrMsg', 'string', '""'],
    ]),
    h3('Response (Table array — parent rows)'),
    resTable([
      ['ItemID', 'int — parent id; children matched via ChildFKey'],
      ['All other fields', 'Spread directly onto item grid row'],
    ]),
    spacer(),

    h2('4.13  API-11 — Save Transaction'),
    apiTable([
      ['Endpoint', '/API/TranFormSave/Post_RB_PurInquiryMst_Save'],
      ['Base URL', 'REST Gateway (http://122.179.135.100:8095/IMS_LIVE)'],
      ['Method', 'POST'],
      ['Content-Type', 'application/json'],
      ['Phase', 'Phase 7 — Save click'],
      ['Purpose', 'Save master header + all item rows + indent detail rows in a single transaction.'],
    ]),
    spacer(60),
    h3('Request Body'),
    reqTable([
      ['prmStrMstJSON', 'JSON string', 'Array of 1 master row. All header field values. LoginID always = 1.'],
      ['prmStrDetJSON', 'JSON string', 'Array of item grid rows. id field stripped. Seeded from allColumns defaults.'],
      ['prmStrIndtDetJSON', 'JSON string', 'Array of indent child rows ([] in Direct mode).'],
    ]),
    h3('Response Handling'),
    simpleTable(
      ['Scenario', 'Behaviour'],
      [
        ['HTTP 200', 'Alert: "Purchase Inquiry saved successfully!"'],
        ['HTTP error or result.message', 'Alert with error message from response'],
      ],
    ),
    spacer(),
  ];
}

// ── Section 5 — Developer Constants ──────────────────────────────────────────

function section5() {
  return [
    h1('5.  Developer Constants Reference'),
    para([txt('File: '), code('src/pages/purchase-inquiry/constants.js'), txt(' — exported as '), code('PI_CONFIG')]),
    spacer(60),
    simpleTable(
      ['Constant Key', 'Value', 'Notes'],
      [
        ['RB_MASTER',              'RB_PurInquiryMst',                              'Header board code'],
        ['RB_DETAIL',              'RB_PurInquiryDet',                              'Detail board code'],
        ['FORM_TAG',               'INQ',                                            'Sent as PrmFormTag in type cascade'],
        ['TRAN_BOOK',              'PURINQUIRY',                                     'Sent as prmTranBook to item picker'],
        ['CONFIG_YEAR_ID',         '2',                                              'Year ID for config calls'],
        ['DIVISION_YEAR_ID',       '2',                                              'Year ID for division calls'],
        ['SUPPLIER_PARTY_TYPE',    'S',                                              'Filters SP to supplier party type'],
        ['SUPPLIER_SP',            'Fn_tbl_FetchCustomerSupplierTranWs4Web',         'Supplier picker SP'],
        ['RB_ITEM_PICKER_DIRECT',  'RB_PurInqSelOnlyItem',                          'Item picker in Direct mode'],
        ['RB_ITEM_PICKER_INDENT',  'RB_PurInqSelIndtItem',                          'Item picker in Indent wise mode'],
        ['SP_RB_META',             'Fn_Fetch_RBDetailByRBCode',                     'Resolves RB code → RBID'],
        ['SP_INQUIRY_TYPES',       'fn_tbl_ddl_Pur_Configuration',                  'Inquiry Type cascade SP'],
        ['SP_DIVISIONS',           'Fn_tbl_FetchUserWsDivision',                    'Division dropdown SP'],
        ['SP_DEPARTMENTS',         'Pr_Fetch_DepartmentData_IMS',                   'Department dropdown SP'],
        ['SP_ITEM_PICKER',         'Fn_Tbl_FetchPurchaseItemDetailTransWs4Web',     'Item rows SP'],
        ['SP_INDENT_SUMMARY',      'Fn_tbl_FetchIndentSummaryItem4Inquiry',         'Indent aggregation SP'],
        ['SAVE_ENDPOINT',          '/API/TranFormSave/Post_RB_PurInquiryMst_Save', 'REST gateway save path'],
        ['STORAGE_HEADER_META',    'piHeaderMeta',                                  'localStorage: master RBID cache'],
        ['STORAGE_ENTRY_META',     'piEntryMeta',                                   'localStorage: detail RBID cache'],
      ],
    ),
    spacer(),
  ];
}

// ── Section 6 — Files Created ─────────────────────────────────────────────────

function section6() {
  return [
    h1('6.  Files Created / Modified'),
    simpleTable(
      ['File Path', 'Role'],
      [
        ['src/pages/purchase-inquiry/PurchaseInquiryPage.jsx', 'Main page — layout, state, event handlers'],
        ['src/pages/purchase-inquiry/constants.js', 'All PI config: RB codes, SP names, filter/tab/column defs'],
        ['src/pages/purchase-inquiry/PurchaseInquiryPage.css', 'Page-level styles'],
        ['src/hooks/usePurchaseInquiry.js', 'Data hook — all API calls, state, three-phase load'],
        ['src/components/purchase-inquiry/SupplierPickerModal.jsx', 'Supplier selection modal'],
        ['src/components/txn/OrderItemModal.jsx', 'Item selection modal (shared)'],
        ['src/components/filters/EnterpriseFilterPanel.jsx', 'Shared header filter panel'],
        ['src/components/grid/EntryGrid.jsx', 'Shared editable data grid'],
        ['src/components/grid/CollapsibleGrid.jsx', 'Shared collapsible indent grid'],
        ['src/components/ui/ActionBar.jsx', 'Shared footer action bar'],
        ['src/utils/gridUtils.js', 'Shared: fetchDropdownOptions, buildGridColumns'],
        ['src/api/constants.js', 'Shared: base URLs, endpoint paths, defaults'],
      ],
    ),
    spacer(),
  ];
}

// ── Section 7 — Template for Next Module ─────────────────────────────────────

function fillBox(label, hint) {
  return new Paragraph({
    children: [bold(label + ': ', { color: '334155' }), txt(hint, { italics: true, color: '64748B' })],
    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: '94A3B8' } },
    indent: { left: 120 },
    spacing: { after: 80, before: 60 },
  });
}

function section7() {
  return [
    h1('7.  Template — Submit Next Module Requirements'),
    para([
      txt('When ready to hand over a new module (e.g. Purchase Order, Quotation), '),
      txt('copy this document', { bold: true }),
      txt(' and fill in each section below. The dev team implements exactly from this document.'),
    ]),
    spacer(60),

    h2('7.1  Module Overview (fill in)'),
    fillBox('Module Name',          'e.g. Purchase Order'),
    fillBox('Short Description',    'One sentence about what this module does'),
    fillBox('Form Tag',             'e.g. PO — confirm with DBA'),
    fillBox('Transaction Book',     'e.g. PURORDER — confirm with DBA'),
    fillBox('Master RB Code',       'e.g. RB_PurOrderMst — confirm with DBA'),
    fillBox('Detail RB Code',       'e.g. RB_PurOrderDet — confirm with DBA'),
    fillBox('Item Picker RB Direct','e.g. RB_PurOrdSelOnlyItem — confirm with DBA'),
    fillBox('Item Picker RB Indent','e.g. RB_PurOrdSelIndtItem — confirm with DBA'),
    fillBox('Save Proc Endpoint',   'e.g. /API/TranFormSave/Post_RB_PurOrderMst_Save'),
    spacer(60),

    h2('7.2  Header Fields (fill in)'),
    para('List every field in the header panel. Provide: Field Label | Field Key | Control Type | Required? | Cascade / Notes.'),
    para([txt('If same as PI: ', { bold: true }), txt('write "Same as PI" and only note differences.')]),
    simpleTable(
      ['Field Label', 'Field Key', 'Control Type', 'Required?', 'Notes / Cascade'],
      [
        ['[e.g. PO No.]', '[TranCode]', '[Text]', '[Auto]', '[Server-generated. Read-only.]'],
        ['[e.g. PO Date]', '[TranDate]', '[Date]', '[Yes]', '[Defaults to today]'],
        ['[Add more rows...]', '', '', '', ''],
      ],
    ),
    spacer(60),

    h2('7.3  Grids & Tabs (fill in)'),
    para('List each tab. Specify column source (API-driven or hardcoded) and all buttons on that tab.'),
    simpleTable(
      ['Tab Name', 'Column Source', 'Buttons', 'Notes'],
      [
        ['[Tab name]', '[API: RB_XXX  or  Hardcoded]', '[Button names]', '[Any special behaviour]'],
        ['[Add more rows...]', '', '', ''],
      ],
    ),
    spacer(60),

    h2('7.4  API List (fill in)'),
    para('For each API call list: SP/Endpoint name | When called | Request params | What is done with response.'),
    para([txt('Tip: ', { bold: true }), txt('If an API is identical to PI, write "Same as PI API-03" and only note what differs (e.g. different FORM_TAG, RB code).')]),
    simpleTable(
      ['API #', 'SP / Endpoint', 'Phase / Trigger', 'Key Request Params', 'Response Used For'],
      [
        ['1', '[SP name]', '[On mount / On Division select / ...]', '[param list]', '[what you do with response]'],
        ['2', '[SP name]', '', '', ''],
        ['Add more rows...', '', '', '', ''],
      ],
    ),
    spacer(60),

    h2('7.5  Business Rules (fill in)'),
    para('List validations, cascade behaviour, and special logic unique to this module.'),
    fillBox('BR-01', 'e.g. Currency Rate auto-fills when Supplier is selected'),
    fillBox('BR-02', 'e.g. Amend checkbox shows a PO select dropdown'),
    fillBox('Add more...', ''),
    spacer(60),

    h2('7.6  Unique / Additional Fields vs Purchase Inquiry'),
    para('List anything this module has that Purchase Inquiry does not:'),
    bullet('[e.g. Currency dropdown + Currency Rate field]'),
    bullet('[e.g. Cr. Days field]'),
    bullet('[e.g. Amend checkbox + existing PO selection]'),
    bullet('[e.g. PO Type instead of Inquiry Type]'),
    spacer(),
  ];
}

// ── Assemble document ─────────────────────────────────────────────────────────

const doc = new Document({
  title:    'MRD – Purchase Inquiry',
  subject:  'Module Requirements Document — Horizon Enterprise IMS',
  creator:  'Horizon Enterprise IMS',
  keywords: 'Purchase Inquiry, MRD, IMS, API, Requirements',
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22, color: '1A1A2E' },
      },
    },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        run: { bold: true, size: 32, color: '0F3460', font: 'Calibri' },
        paragraph: { spacing: { before: 320, after: 120 } },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        run: { bold: true, size: 26, color: '1E40AF', font: 'Calibri' },
        paragraph: { spacing: { before: 240, after: 80 } },
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        basedOn: 'Normal',
        next: 'Normal',
        run: { bold: true, size: 23, color: '1E293B', font: 'Calibri' },
        paragraph: { spacing: { before: 180, after: 60 } },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            right:  convertInchesToTwip(1),
            left:   convertInchesToTwip(1),
          },
        },
      },
      children: [
        ...coverSection(),
        spacer(200),
        ...section1(),
        ...section2(),
        ...section3(),
        ...section4(),
        ...section5(),
        ...section6(),
        ...section7(),
        spacer(160),
        new Paragraph({
          children: [txt('Horizon Enterprise IMS — Internal Document   |   MRD v1.0 — Purchase Inquiry — June 2026   |   Confidential', { color: '94A3B8', size: 18 })],
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
          spacing: { before: 120 },
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT, buffer);
  console.log(`✅  DOCX saved → ${OUT}`);
});
