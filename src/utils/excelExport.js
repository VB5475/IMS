// excelExport.js — real .xlsx export (ExcelJS) with actual cell formatting
// (bold, fills, borders). The `xlsx` (SheetJS) package cannot do this in its
// free tier — verified empirically: a font.bold + fill style written through
// it and read back (both via the JS API and by unzipping the produced file
// and inspecting styles.xml directly) came back completely stripped, only
// the default styleset survives. ExcelJS writes styles natively.
//
// `exceljs` is a large library, so it's dynamically imported here rather
// than statically — only pages that actually trigger an export pay for it.

const TITLE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
const BAND_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
const THIN_BORDER = { style: "thin", color: { argb: "FFB7B7B7" } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

function appendXlsxExt(filename) {
  return /\.xlsx$/i.test(filename) ? filename : `${filename}.xlsx`;
}

// Same Blob + anchor-click download approach as csvExport.js's downloadCsv —
// ExcelJS (browser build) hands back a buffer rather than triggering the
// download itself, unlike xlsx's writeFile.
async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = appendXlsxExt(filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/** columns: [{ key, label }]; rows: plain objects already keyed by
 *  column.key (same contract as csvExport.js's buildCsvContent — raw
 *  row[c.key] access, no field-name resolution). Single sheet, no styling —
 *  used where the export is one flat table (see exportSideBySideTablesToExcel
 *  for titled/formatted multi-table sheets). */
export async function exportRowsToExcel(rows, columns, filenameBase) {
  if (!rows || rows.length === 0 || !columns || columns.length === 0) return;

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(columns.map((c) => c.label ?? c.key));
  rows.forEach((row) => ws.addRow(columns.map((c) => row[c.key] ?? "")));
  ws.columns = columns.map((c) => ({ width: Math.max(String(c.label ?? c.key).length + 2, 12) }));

  await downloadWorkbook(wb, filenameBase);
}

/**
 * One sheet holding multiple titled tables side by side — each gets its own
 * column range (title merged across just its own columns, its own header
 * row, its own data rows, its own column widths), with one blank spacer
 * column between consecutive tables. Every table's title lands on row 1,
 * header on row 2, data from row 3 — written directly to (row, col) cells
 * rather than via ws.addRow(), since addRow always appends to the sheet's
 * next row regardless of column and would stack the tables vertically
 * instead of aligning them.
 *
 * A data row can carry `__isTotal: true` to render bold (e.g. a summary
 * table's grand-total row) — it's metadata, not written as a column.
 *
 * tables: [{ title, columns: [{key,label}], rows: [...] }]
 */
export async function exportSideBySideTablesToExcel(tables, filename, sheetName = "Sheet1") {
  const usable = tables.filter((t) => t.rows?.length > 0 && t.columns?.length > 0);
  if (usable.length === 0) return;

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.getRow(1).height = 20;

  let offset = 1;
  usable.forEach((table) => {
    const colCount = table.columns.length;

    const titleCell = ws.getCell(1, offset);
    titleCell.value = table.title ?? "";
    if (colCount > 1) ws.mergeCells(1, offset, 1, offset + colCount - 1);
    titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    titleCell.fill = TITLE_FILL;
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    table.columns.forEach((c, colIdx) => {
      const cell = ws.getCell(2, offset + colIdx);
      cell.value = c.label ?? c.key;
      cell.font = { bold: true };
      cell.fill = HEADER_FILL;
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    table.rows.forEach((row, rowIndex) => {
      const isTotal = row.__isTotal === true;
      table.columns.forEach((c, colIdx) => {
        const cell = ws.getCell(3 + rowIndex, offset + colIdx);
        cell.value = row[c.key] ?? "";
        cell.border = CELL_BORDER;
        if (isTotal) cell.font = { bold: true };
        else if (rowIndex % 2 === 1) cell.fill = BAND_FILL;
      });
    });

    table.columns.forEach((c, colIdx) => {
      const contentLengths = table.rows.map((r) => String(r[c.key] ?? "").length);
      const width = Math.max(String(c.label ?? c.key).length, ...contentLengths) + 2;
      ws.getColumn(offset + colIdx).width = Math.max(width, 12);
    });

    offset += colCount + 1; // +1 blank spacer column before the next table
  });

  await downloadWorkbook(wb, filename);
}
