import * as XLSX from "xlsx";
import { flattenFullTree } from "./tbHierarchy";

/** Spaces per hierarchy level — matches TB_Hierarchy_Grouping.xlsx indentation. */
const INDENT_SPACES = 3;

/** Excel outline supports outlineLevel 1–7. */
const MAX_OUTLINE_LEVEL = 7;

const AMOUNT_KEYS = [
  { key: "OpeningDebit", header: "Op. Debit" },
  { key: "OpeningCredit", header: "Op. Credit" },
  { key: "DebitAmount", header: "Debit" },
  { key: "CreditAmount", header: "Credit" },
  { key: "ClosingDebit", header: "Cl. Debit" },
  { key: "ClosingCredit", header: "Cl. Credit" },
];

function toExcelNumber(value) {
  if (value == null || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) && num !== 0 ? num : "";
}

function buildIndentedParticulars(name, depth) {
  const label = String(name ?? "").trim();
  if (!depth) return label;
  return `${" ".repeat(depth * INDENT_SPACES)}${label}`;
}

function buildFileName(meta = {}) {
  const company = String(meta.company ?? "trial_balance")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${company || "trial_balance"}_${stamp}.xlsx`;
}

/**
 * Excel row outline / group collapsibles via SheetJS only
 * (no post-write XML patch — that was corrupting sheet1.xml for Excel).
 *
 * - `!outline.above` → summaryBelow=0 (parent above children)
 * - `!rows[].level` → outlineLevel for +/- grouping
 */
function applyHierarchyOutline(worksheet, tree) {
  const rows = [{}]; // header row — no outline level

  for (const { depth } of tree) {
    rows.push({
      level: Math.min(Math.max(depth, 0), MAX_OUTLINE_LEVEL),
    });
  }

  worksheet["!rows"] = rows;
  worksheet["!outline"] = { above: true };
}

/**
 * Export trial balance rows to Excel in hierarchical depth-first order,
 * with Excel outline grouping (open/close collapsibles).
 *
 * @param {{ rows: object[], meta?: object, fileName?: string }} options
 */
export function exportTrialBalanceToExcel({ rows, meta = {}, fileName }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No trial balance rows to export.");
  }

  const tree = flattenFullTree(rows);
  const headers = [
    "Particulars",
    "Code",
    "Group Code",
    ...AMOUNT_KEYS.map(({ header }) => header),
    "Type",
    "ParentCode",
    "Level",
  ];

  const exportRows = tree.map(({ row, depth }) => {
    const exportRow = {
      Particulars: buildIndentedParticulars(row.AcGrpNameWOAlign, depth),
      Code: row.AcGrpCode ?? "",
      "Group Code": row.ChildCode ?? "",
    };

    for (const { key, header } of AMOUNT_KEYS) {
      exportRow[header] = toExcelNumber(row[key]);
    }

    exportRow.Type = row.COAType ?? "";
    exportRow.ParentCode = row.ParentCode ?? "";
    exportRow.Level = row.GroupLevelCount ?? depth;

    return exportRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: headers });
  worksheet["!cols"] = [
    { wch: 48 },
    { wch: 10 },
    { wch: 12 },
    ...AMOUNT_KEYS.map(() => ({ wch: 14 })),
    { wch: 8 },
    { wch: 12 },
    { wch: 6 },
  ];

  applyHierarchyOutline(worksheet, tree);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Trial Balance");
  XLSX.writeFile(workbook, fileName ?? buildFileName(meta));
}
