// generate-template.cjs — Creates MRD_Template.docx
// Pre-filled with Purchase Inquiry as a worked example.
// Team copies file, renames it, replaces green (example) values with their module's values.
// Run: node docs/generate-template.cjs
'use strict';

const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, VerticalAlign,
} = require('docx');
const fs   = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'MRD_Template.docx');

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  navy:    '0F3460',
  white:   'FFFFFF',
  thBg:    '0F3460',
  rowEven: 'F8FAFC',
  rowOdd:  'FFFFFF',
  border:  'CBD5E1',
  // amber — how-to instructions only
  note:    'B45309',
  // blue — empty "add your rows here" cells
  fillBg:  'EFF6FF',
  fillFg:  '1D4ED8',
  // green — pre-filled Purchase Inquiry example values
  exBg:    'F0FDF4',
  exFg:    '166534',
  // gray — image placeholder
  imageBg: 'F1F5F9',
  imageFg: '64748B',
};

// ── Border helpers ────────────────────────────────────────────────────────────
const solidBorder = (color = C.border, sz = 4) =>
  ({ style: BorderStyle.SINGLE, size: sz, color });

const cellBorders = (clr = C.border) => ({
  top: solidBorder(clr), bottom: solidBorder(clr),
  left: solidBorder(clr), right: solidBorder(clr),
});

// ── Text helpers ──────────────────────────────────────────────────────────────
function para(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({
      text,
      size:    opts.size    ?? 22,
      bold:    opts.bold    ?? false,
      color:   opts.color   ?? C.navy,
      font:    'Calibri',
      italics: opts.italic  ?? false,
    })],
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing:   { before: opts.spaceBefore ?? 0, after: opts.spaceAfter ?? 80 },
    indent:    opts.indent ? { left: opts.indent } : undefined,
  });
}

function sectionHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 24, bold: true, color: C.white, font: 'Calibri' })],
    heading:  HeadingLevel.HEADING_2,
    alignment: AlignmentType.LEFT,
    spacing:  { before: 200, after: 80 },
    shading:  { type: ShadingType.CLEAR, fill: C.navy },
    indent:   { left: 120, right: 120 },
  });
}

// Amber instruction line
function note(text) {
  return para(text, { italic: true, color: C.note, size: 19, indent: 120, spaceAfter: 100 });
}

// Label + value line (used in Section 1)
function fillLine(label, exampleValue) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, size: 21, bold: true, color: C.navy, font: 'Calibri' }),
      new TextRun({ text: exampleValue, size: 21, color: C.exFg, font: 'Calibri', bold: false }),
    ],
    spacing: { before: 40, after: 60 },
    indent:  { left: 200 },
  });
}

const blank = (before = 60) =>
  new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before, after: 0 } });

// ── Table cell factories ──────────────────────────────────────────────────────

// Example cell (green — PI value, replace for new module)
function tdEx(text, widthPct, even = false) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, size: 19, color: C.exFg, font: 'Calibri' })],
      alignment: AlignmentType.LEFT,
    })],
    width:         { size: widthPct, type: WidthType.PERCENTAGE },
    shading:       { type: ShadingType.CLEAR, fill: even ? 'E7FAF0' : C.exBg },
    borders:       cellBorders(),
    verticalAlign: VerticalAlign.TOP,
    margins:       { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

// Empty fill-in cell (blue — team adds their own extra rows)
function tdBlank(widthPct, even = false) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: '(add here)', size: 18, color: C.fillFg, font: 'Calibri', italics: true })],
    })],
    width:         { size: widthPct, type: WidthType.PERCENTAGE },
    shading:       { type: ShadingType.CLEAR, fill: even ? 'DBEAFE' : C.fillBg },
    borders:       cellBorders(),
    verticalAlign: VerticalAlign.TOP,
    margins:       { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

// Header cell
function th(text, widthPct) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, size: 18, bold: true, color: C.white, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
    })],
    width:         { size: widthPct, type: WidthType.PERCENTAGE },
    shading:       { type: ShadingType.CLEAR, fill: C.thBg },
    borders:       cellBorders(C.navy),
    verticalAlign: VerticalAlign.CENTER,
    margins:       { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

// Build a row of example cells from an array of strings
function exRow(values, widths, even = false) {
  return new TableRow({
    children: values.map((v, i) => tdEx(v, widths[i], even)),
  });
}

// Build a blank fill-in row
function blankRow(widths, even = false) {
  return new TableRow({
    children: widths.map((w) => tdBlank(w, even)),
  });
}

// ── Image placeholder ─────────────────────────────────────────────────────────
function imagePlaceholderTable() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({
                text: '[ PASTE DESIGN / WIREFRAME SCREENSHOT HERE ]',
                size: 22, bold: true, color: C.imageFg, font: 'Calibri',
              })],
              alignment: AlignmentType.CENTER,
              spacing:   { before: 300, after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({
                text: 'In Word:  Insert → Pictures → This Device  — paste the UI screenshot at full page width.',
                size: 18, italic: true, color: C.imageFg, font: 'Calibri',
              })],
              alignment: AlignmentType.CENTER,
              spacing:   { before: 0, after: 80 },
            }),
            new Paragraph({
              children: [new TextRun({
                text: 'Add a second image below if there is a separate Listing view design.',
                size: 18, italic: true, color: C.imageFg, font: 'Calibri',
              })],
              alignment: AlignmentType.CENTER,
              spacing:   { before: 0, after: 300 },
            }),
          ],
          shading:  { type: ShadingType.CLEAR, fill: C.imageBg },
          borders:  {
            top:    solidBorder('94A3B8', 6),
            bottom: solidBorder('94A3B8', 6),
            left:   solidBorder('94A3B8', 6),
            right:  solidBorder('94A3B8', 6),
          },
          margins: { top: 120, bottom: 120, left: 240, right: 240 },
        })],
      }),
    ],
  });
}

// ── Legend box ────────────────────────────────────────────────────────────────
function legendTable() {
  function legendCell(bg, fg, label, desc) {
    return new TableCell({
      children: [new Paragraph({
        children: [
          new TextRun({ text: `  ${label}  `, size: 19, bold: true, color: fg, font: 'Calibri' }),
          new TextRun({ text: ` — ${desc}`, size: 19, color: C.navy, font: 'Calibri' }),
        ],
      })],
      width:   { size: 33, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: bg },
      borders: cellBorders(),
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
    });
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        legendCell(C.exBg,   C.exFg,   'GREEN',  'Example value from Purchase Inquiry — replace for your module'),
        legendCell(C.fillBg, C.fillFg, 'BLUE',   'Empty slot — add your own rows here'),
        legendCell('FFF7ED', C.note,   'AMBER',  'Instruction — read once, ignore after'),
      ],
    })],
  });
}

// ── Sections ──────────────────────────────────────────────────────────────────

function sectionOne() {
  return [
    sectionHeading('1. Module Overview'),
    note('Replace every green value below with your module\'s equivalent.'),
    fillLine('Module Name',    'Purchase Inquiry'),
    fillLine('Module Code',    'INQ'),
    fillLine('Purpose',        'Create and manage purchase inquiries to suppliers before issuing a formal Purchase Order.'),
    fillLine('Primary Users',  'Procurement / Purchase Team'),
    fillLine('Listing Route',  '/purchase-inquiry'),
    fillLine('New Form Route', '/purchase-inquiry/new'),
    fillLine('Edit Route',     '/purchase-inquiry/:id'),
    fillLine('Nav Menu Label', 'Purchase Inquiry'),
    blank(),
  ];
}

function sectionTwo() {
  return [
    sectionHeading('2. Screen Design'),
    note('Delete the placeholder box below and paste your design screenshot (Insert → Pictures). Add a second image for the listing view if applicable.'),
    blank(80),
    imagePlaceholderTable(),
    blank(120),
    para('Screen notes / layout description:', { bold: true, color: C.navy, size: 21, spaceBefore: 100 }),
    note('Describe each visible area: panels, tabs, special controls, conditionally visible sections.'),
    ...[
      'Header panel — EnterpriseFilterPanel with 8 fields: Inquiry No. (auto), Date, Division, Inquiry Type (cascades from Division), Expected Date, Department, Based On, Remark.',
      'Item Grid tab — EntryGrid with columns from RB_PurInquiryDet metadata (dynamic). Buttons: Add New | Select Item.',
      'Suppliers tab — hardcoded grid: Sr.No, Supplier Name, Address, City, Mobile No. Button: Select Supplier.',
      'Terms tab — static read-only table (Sr.No, Terms Type, Code, Terms & Conditions).',
    ].map((t) => new Paragraph({
      children: [
        new TextRun({ text: '► ', size: 21, bold: true, color: C.exFg, font: 'Calibri' }),
        new TextRun({ text: t,   size: 21,              color: C.exFg, font: 'Calibri' }),
      ],
      spacing: { before: 40, after: 80 },
      indent:  { left: 200 },
    })),
    blank(),
  ];
}

function sectionThree() {
  const W = [22, 22, 16, 10, 30]; // col widths %
  const piRows = [
    ['Inquiry No.', 'TranCode',     'Textbox',  'No',  'Auto-generated on save'],
    ['Date',        'TranDate',     'Date',     'No',  'Default: today\'s date'],
    ['Division',    'DivisionID',   'Dropdown', 'Yes', 'Fn_tbl_FetchUserWsDivision'],
    ['Inquiry Type','ConfigID',     'Dropdown', 'No',  'fn_tbl_ddl_Pur_Configuration — cascades from DivisionID'],
    ['Expected Date','ExpectedDate','Date',     'No',  '—'],
    ['Department',  'DeptID',       'Dropdown', 'No',  'Pr_Fetch_DepartmentData_IMS'],
    ['Based On',    'BasedOnID',    'Dropdown', 'No',  'Hardcoded: Direct / Indent wise'],
    ['Remark',      'Remarks',      'Textarea', 'No',  '—'],
  ];

  return [
    sectionHeading('3. Header / Filter Fields'),
    note('One row per field shown in the EnterpriseFilterPanel. Control types: Textbox | Date | Dropdown | Textarea | Checkbox.'),
    blank(40),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: W.map((w, i) => th(['Field Label','Field ID (ColName)','Control Type','Required','Source SP / Cascade Note'][i], w)), tableHeader: true }),
        ...piRows.map((r, i) => exRow(r, W, i % 2 === 0)),
        blankRow(W, false),
        blankRow(W, true),
      ],
    }),
    blank(120),
    para('Cascade resets:', { bold: true, color: C.navy, size: 21, spaceBefore: 80 }),
    new Paragraph({
      children: [
        new TextRun({ text: '► ', size: 21, bold: true, color: C.exFg, font: 'Calibri' }),
        new TextRun({ text: 'When DivisionID changes → clear ConfigID (Inquiry Type) and reload its options.', size: 21, color: C.exFg, font: 'Calibri' }),
      ],
      spacing: { before: 40, after: 80 },
      indent:  { left: 200 },
    }),
    blank(),
  ];
}

function sectionFour() {
  const W = [20, 20, 18, 12, 30];
  const piRows = [
    ['Sr. No.',    'SrNo',     'Number',   'No',  'API — RB_PurInquiryDet metadata'],
    ['Item Code',  'ItemCode', 'Textbox',  'Yes', 'API — RB_PurInquiryDet metadata'],
    ['Item Name',  'ItemName', 'Textbox',  'No',  'API — RB_PurInquiryDet metadata'],
    ['Quantity',   'Qty',      'Number',   'Yes', 'API — RB_PurInquiryDet metadata'],
    ['Unit',       'Unit',     'Dropdown', 'No',  'API — RB_PurInquiryDet metadata'],
    ['Rate',       'Rate',     'Number',   'Yes', 'API — RB_PurInquiryDet metadata'],
    ['Amount',     'Amount',   'Number',   'No',  'API — auto-calculated: Qty × Rate'],
    ['Remarks',    'Remarks',  'Textarea', 'Yes', 'API — RB_PurInquiryDet metadata'],
  ];

  return [
    sectionHeading('4. Grid / Entry Columns'),
    note('List every column in the Item Grid (EntryGrid). Source = "API (RB detail metadata)" or "Hardcoded" if static.'),
    blank(40),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: W.map((w, i) => th(['Column Label','Key (ColName)','Control Type','Editable','Source'][i], w)), tableHeader: true }),
        ...piRows.map((r, i) => exRow(r, W, i % 2 === 0)),
        blankRow(W, false),
        blankRow(W, true),
      ],
    }),
    blank(120),
    para('Additional grids / tabs:', { bold: true, color: C.navy, size: 21, spaceBefore: 80 }),
    ...[
      'Suppliers tab — hardcoded columns: Sr.No, Supplier Name, Address, City, Mobile No.',
      'Terms tab — static display table: Sr.No, Terms Type, Code, Terms & Conditions.',
    ].map((t) => new Paragraph({
      children: [
        new TextRun({ text: '► ', size: 21, bold: true, color: C.exFg, font: 'Calibri' }),
        new TextRun({ text: t,   size: 21,              color: C.exFg, font: 'Calibri' }),
      ],
      spacing: { before: 40, after: 80 },
      indent:  { left: 200 },
    })),
    blank(),
  ];
}

function sectionFive() {
  const W = [28, 10, 22, 22, 18];
  const piRows = [
    ['Fn_Fetch_RBDetailByRBCode',                   '2', 'Fetch RB column metadata (header + detail)',        'prmRBCode',                                                            'Table[0]: RBID + column definitions'],
    ['fn_tbl_ddl_Pur_Configuration',                '2', 'Inquiry Type dropdown options',                      'prmDivisionID, prmYearID, prmLoginID',                                 'Table: value/label pairs'],
    ['Fn_tbl_FetchUserWsDivision',                  '2', 'Division dropdown options',                          'prmYearID, prmLoginID',                                                'Table: division list'],
    ['Fn_tbl_FetchCustomerSupplierTranWs4Web',      '2', 'Supplier picker list',                               "PrmDivisionId, PrmPartyType='S', PrmLoginId, PrmYearId",               'Table: supplier rows'],
    ['Fn_Tbl_FetchPurchaseItemDetailTransWs4Web',   '2', 'Item picker — Direct mode (BasedOnID=0)',            'prmDivisionID, prmYearID, prmTranDate, prmConfigID, prmFrmOption=0',   'Table: item rows'],
    ['Fn_Tbl_FetchPurchaseItemDetailTransWs4Web',   '2', 'Item picker — Indent wise mode (BasedOnID=2)',       'same SP, prmFrmOption=2, uses RB_PurInqSelIndtItem',                   'Table: indent item rows'],
    ['Fn_tbl_FetchIndentSummaryItem4Inquiry',       '2', 'Aggregate indent selections into parent rows',       'prmJSon: JSON array of selected indent rows',                          'Table: parent item rows (grouped)'],
    ['Pr_Fetch_DepartmentData_IMS',                 '1', 'Department dropdown options',                        '—',                                                                    'Table: department list'],
    ['Fn_tbl_Pur_InquiryMst_List',                  '2', 'Fetch listing page data',                            'prmCompanyID, prmDivisionID, prmFroDate, prmToDate, prmLoginID, prmYearID', 'Table: all inquiry records'],
  ];

  return [
    sectionHeading('5. API Reference'),
    note('List every stored procedure / function called. ObjType 2 = Function, 1 = Procedure. Source: backend DBA.'),
    blank(40),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: W.map((w, i) => th(['SP / Function Name','ObjType','Purpose','Key Parameters','Returns'][i], w)), tableHeader: true }),
        ...piRows.map((r, i) => exRow(r, W, i % 2 === 0)),
        blankRow(W, false),
        blankRow(W, true),
      ],
    }),
    blank(120),
    para('Save endpoint (REST POST):', { bold: true, color: C.navy, size: 21, spaceBefore: 80 }),
    fillLine('Endpoint path', '/API/TranFormSave/Post_RB_PurInquiryMst_Save'),
    fillLine('Payload keys',  'prmStrMstJSON | prmStrDetJSON | prmStrIndtDetJSON'),
    blank(),
  ];
}

function sectionSix() {
  const rules = [
    'Division cascade — When DivisionID changes, clear Inquiry Type (ConfigID) and reload its options via fn_tbl_ddl_Pur_Configuration.',
    'Item picker mode — BasedOnID = 0 (Direct) loads items with RB_PurInqSelOnlyItem. BasedOnID = 2 (Indent wise) loads with RB_PurInqSelIndtItem.',
    'Indent grouping — Selected indent rows are passed to Fn_tbl_FetchIndentSummaryItem4Inquiry → returns parent rows; child detail rows shown in CollapsibleGrid.',
    'Three-phase metadata load — Phase 1 (mount): header RB + divisions in parallel. Phase 2: detail RB. Phase 3 (lazy, on first Add New / Select Item): grid columns.',
    'Supplier dedup — When inserting suppliers, skip SupplierID if already present in the grid. Sr.No auto-renumbers on delete.',
    'Temp row IDs — New rows get negative temp IDs (nextTempId--) to avoid collisions with real DB IDs on save.',
    'isNewRoute detection — /purchase-inquiry/new → IDNumber = 0 in save payload. /purchase-inquiry/:id → IDNumber = numeric id.',
    'Edit mode gate — All inputs disabled until user clicks the ActionBar Add/Edit button. Prevents accidental edits on load.',
  ];

  return [
    sectionHeading('6. Business Rules'),
    note('Every rule the developer must implement. Add or remove lines for your module.'),
    ...rules.map((rule, i) => new Paragraph({
      children: [
        new TextRun({ text: `${i + 1}. `, size: 21, bold: true, color: C.navy, font: 'Calibri' }),
        new TextRun({ text: rule,           size: 21,              color: C.exFg, font: 'Calibri' }),
      ],
      spacing: { before: 60, after: 80 },
      indent:  { left: 200 },
    })),
    blank(80),
    new Paragraph({
      children: [
        new TextRun({ text: '9. ', size: 21, bold: true, color: C.navy, font: 'Calibri' }),
        new TextRun({ text: '(add here)', size: 21, italic: true, color: C.fillFg, font: 'Calibri' }),
      ],
      spacing: { before: 60, after: 80 },
      indent:  { left: 200 },
    }),
    blank(),
  ];
}

function sectionSeven() {
  const W = [28, 28, 12, 32];
  const piRows = [
    ['RB_MASTER',            'RB_PurInquiryMst',                              'No',      'Master board code — header column metadata'],
    ['RB_DETAIL',            'RB_PurInquiryDet',                              'No',      'Detail board code — grid column metadata'],
    ['FORM_TAG',             'INQ',                                            'No',      'Short module tag used in save payload'],
    ['TRAN_BOOK',            'PURINQUIRY',                                     'No',      'Transaction book name for item picker SP'],
    ['CONFIG_YEAR_ID',       '2',                                              'CONFIRM', 'Year ID passed to configuration SPs'],
    ['DIVISION_YEAR_ID',     '2',                                              'CONFIRM', 'Year ID passed to division fetch SP'],
    ['SUPPLIER_PARTY_TYPE',  'S',                                              'No',      'Party type filter for supplier picker'],
    ['LIST_OBJ_TYPE',        '2',                                              'No',      'OBJ_TYPE.FUNCTION — for listing SP call'],
    ['SP_INQUIRY_LIST',      'Fn_tbl_Pur_InquiryMst_List',                    'CONFIRM', 'SP to load listing page data'],
    ['LIST_DIVISION_ID',     '15',                                             'CONFIRM', 'Default division ID for listing data fetch'],
    ['SAVE_ENDPOINT',        '/API/TranFormSave/Post_RB_PurInquiryMst_Save',  'No',      'REST gateway save path'],
    ['STORAGE_HEADER_META',  'piHeaderMeta',                                   'No',      'localStorage key for cached header RB metadata'],
  ];

  return [
    sectionHeading('7. Constants  (constants.js)'),
    note('All values for the constants.js file. RB codes and SP names come from the backend DBA. Mark CONFIRM = Yes if value is uncertain.'),
    blank(40),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: W.map((w, i) => th(['Constant Name','Value','CONFIRM?','Notes'][i], w)), tableHeader: true }),
        ...piRows.map((r, i) => exRow(r, W, i % 2 === 0)),
      ],
    }),
    blank(),
  ];
}

// ── Title page ────────────────────────────────────────────────────────────────
function titlePage() {
  return [
    blank(600),
    new Paragraph({
      children: [new TextRun({ text: 'HORIZON ENTERPRISE IMS', size: 28, bold: true, color: C.navy, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing:   { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Module Requirements Template', size: 48, bold: true, color: C.navy, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing:   { before: 0, after: 160 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Module: ', size: 28, bold: true, color: C.navy, font: 'Calibri' }),
        new TextRun({ text: '[Replace with your Module Name]', size: 28, color: C.fillFg, font: 'Calibri', italics: true }),
      ],
      alignment: AlignmentType.CENTER,
      spacing:   { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Submitted by: ', size: 22, bold: true, color: C.navy, font: 'Calibri' }),
        new TextRun({ text: '[Your Name / Team]',  size: 22, color: C.fillFg, font: 'Calibri', italics: true }),
      ],
      alignment: AlignmentType.CENTER,
      spacing:   { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Date: ', size: 22, bold: true, color: C.navy, font: 'Calibri' }),
        new TextRun({ text: '[DD-Mon-YYYY]', size: 22, color: C.fillFg, font: 'Calibri', italics: true }),
      ],
      alignment: AlignmentType.CENTER,
      spacing:   { before: 0, after: 80 },
    }),
    blank(200),

    // ── Legend ──
    new Paragraph({
      children: [new TextRun({ text: 'COLOUR GUIDE', size: 20, bold: true, color: C.navy, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing:   { before: 0, after: 80 },
    }),
    legendTable(),
    blank(120),

    // ── How-to instructions ──
    new Paragraph({
      children: [new TextRun({ text: 'HOW TO USE THIS TEMPLATE', size: 22, bold: true, color: C.note, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing:   { before: 0, after: 60 },
    }),
    ...([
      '1.  Save a copy — rename to  MRD_[ModuleName].docx  before editing.',
      '2.  Replace every green value with your module\'s equivalent (SP names, RB codes, field names, routes, etc.).',
      '3.  Add your own rows in the blue slots at the bottom of each table.',
      '4.  In Section 2, delete the placeholder box and paste your design screenshot (Insert → Pictures).',
      '5.  Send completed document to the development team BEFORE coding starts.',
      '6.  Dev team signs off by stamping "Dev Confirmed" on each section.',
    ].map((t) => para(t, { color: C.note, size: 19, indent: 400, spaceAfter: 60 }))),

    new Paragraph({ children: [], pageBreakBefore: true }),
  ];
}

// ── Assemble ──────────────────────────────────────────────────────────────────
async function main() {
  const doc = new Document({
    creator: 'Horizon Enterprise IMS',
    title:   'IMS Module Requirements Template',
    subject: 'Module Requirements Template — Purchase Inquiry Example',
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1260, right: 1260 },
        },
      },
      children: [
        ...titlePage(),
        ...sectionOne(),
        ...sectionTwo(),
        ...sectionThree(),
        ...sectionFour(),
        ...sectionFive(),
        ...sectionSix(),
        ...sectionSeven(),
        blank(200),
        para('— END OF TEMPLATE —', {
          color: C.imageFg, size: 19, italic: true, align: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT, buffer);
  console.log(`✅  Template saved → ${OUT}`);
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
