import { COL_DATA_TYPE } from "../api/constants";

/**
 * True when ColDataType from GET_DETAIL_COL_DATA represents a date/datetime column.
 * @param {string|null|undefined} colDataType
 */
export function isDateColDataType(colDataType) {
  if (!colDataType) return false;
  const lower = String(colDataType).toLowerCase();
  return lower.includes("date") || lower.includes(COL_DATA_TYPE.DATETIME);
}

/**
 * True when a grid column definition represents a date column (display or control).
 * @param {{ controlType?: number, filterType?: string, colDataType?: string|null, ColDataType?: string|null }} col
 */
export function isDateColumnDef(col) {
  if (!col) return false;
  if (col.controlType === 2 || col.filterType === "date") return true;
  return isDateColDataType(col.colDataType ?? col.ColDataType);
}

/**
 * Normalize picker modal columns so date metadata is available for read-only display.
 * Does not mutate row values — display formatting happens in the grid renderer.
 * @param {object[]} columns
 */
export function normalizePickerGridColumns(columns) {
  if (!Array.isArray(columns)) return [];
  return columns.map((col) => {
    if (col.key === "cb") return col;
    const colDataType = col.colDataType ?? col.ColDataType ?? null;
    const isDate = isDateColumnDef({ ...col, colDataType });
    return {
      ...col,
      colDataType,
      filterType: isDate ? "date" : col.filterType,
    };
  });
}

/**
 * Parse a date value from common API / user formats into a local Date.
 * Does not mutate the original value — use only for display formatting.
 * @param {unknown} value
 * @returns {Date|null}
 */
export function parseFlexibleDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const str = String(value).trim();
  if (!str) return null;

  const isoDate = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const date = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date for read-only UI display (dd/mm/yyyy).
 * Accepts ISO strings, timestamps, and other parseable values.
 * Returns "" for empty input; falls back to the raw string when unparseable.
 * @param {unknown} value
 * @returns {string}
 */
export function formatDateForDisplay(value) {
  if (value == null || value === "") return "";

  const date = parseFlexibleDate(value);
  if (!date) return String(value);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
