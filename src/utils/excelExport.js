// excelExport.js — generic client-side Excel export (sibling to excelImport.js,
// which is import-only). Kept generic (rows + headers in, .xlsx file out) so any
// future module can reuse it, not just Purchase Quotation Comparison.

import { loadXlsx } from "./xlsxLoader";

/**
 * @param {object[]} rows — plain objects; each key becomes a column
 * @param {{ key: string, label: string }[]} columns — column order + header labels
 * @param {string} filename — without extension
 * @param {string} [sheetName]
 */
export async function exportRowsToExcel(rows, columns, filename, sheetName = "Sheet1") {
  const XLSX = await loadXlsx();
  const data = rows.map((row) => {
    const out = {};
    columns.forEach(({ key, label }) => {
      out[label] = row[key] ?? "";
    });
    return out;
  });

  const worksheet = XLSX.utils.json_to_sheet(data, {
    header: columns.map((c) => c.label),
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
