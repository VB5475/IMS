import * as XLSX from "xlsx";
import { isTruthyApiFlag } from "./gridUtils";

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function getDisplayHeaders(apiColumns = []) {
  return apiColumns
    .map((col) => String(col.displayname ?? "").trim())
    .filter(Boolean);
}

/** Visible RB columns from GET_DETAIL_COL_DATA — Excel must include these displayname headers. */
function getRequiredDisplayHeaders(apiColumns = []) {
  return apiColumns
    .filter((col) => isTruthyApiFlag(col.isvisible ?? col.IsVisible))
    .map((col) => String(col.displayname ?? "").trim())
    .filter(Boolean);
}

function buildColumnLookup(apiColumns = []) {
  const lookup = new Map();
  apiColumns.forEach((col) => {
    const displayname = String(col.displayname ?? "").trim();
    const colname = String(col.colname ?? "").trim().toLowerCase();
    if (!displayname || !colname) return;
    lookup.set(normalizeHeader(displayname), colname);
  });
  return lookup;
}

function formatCellValue(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().split("T")[0];
  }
  return value;
}

function isBlankRow(values = []) {
  return values.every((value) => String(value ?? "").trim() === "");
}

function formatColumnList(columns = []) {
  return columns.map((col) => `"${col}"`).join(", ");
}

/**
 * Parse the first worksheet of an Excel file into grid rows keyed by RB colname.
 * Header row must use displayname values from GET_DETAIL_COL_DATA (case-insensitive, spaces ignored).
 * @param {File} file
 * @param {object[]} apiColumns — RB column metadata from GET_DETAIL_COL_DATA
 * @returns {Promise<object[]>}
 */
export async function parseExcelFileToGridRows(file, apiColumns = []) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const lookup = buildColumnLookup(apiColumns);
  const allDisplayHeaders = getDisplayHeaders(apiColumns);
  const requiredDisplayHeaders = getRequiredDisplayHeaders(apiColumns);

  const sheetRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
  });

  if (!sheetRows.length) return [];

  const headerRow = sheetRows[0] || [];
  const normalizedHeaders = headerRow.map(normalizeHeader).filter(Boolean);

  const invalidHeaders = normalizedHeaders.filter((header) => !lookup.has(header));
  if (invalidHeaders.length > 0) {
    throw new Error(
      `These columns do not match the expected format: ${formatColumnList(
        headerRow.filter((header) => !lookup.has(normalizeHeader(header)))
      )}. Please remove the extra or invalid columns and use the original display names from the template.`
    );
  }

  const missingHeaders = requiredDisplayHeaders.filter(
    (header) => !normalizedHeaders.includes(normalizeHeader(header))
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `Some required columns are missing: ${formatColumnList(
        missingHeaders
      )}. Please add these columns and make sure the header row uses the original display names from GET_DETAIL_COL_DATA.`
    );
  }

  if (sheetRows.length < 2 || isBlankRow(sheetRows[1] || [])) {
    throw new Error("Data format should start from 2nd row. Row 2 cannot be blank.");
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rawRows.length) return [];

  return rawRows.map((rawRow, index) => {
    const mapped = {
      id: `excel_${index + 1}`,
      __excelRowNo: index + 2,
    };
    Object.entries(rawRow).forEach(([header, value]) => {
      const colname = lookup.get(normalizeHeader(header));
      if (colname) mapped[colname] = formatCellValue(value);
    });
    return mapped;
  });
}
