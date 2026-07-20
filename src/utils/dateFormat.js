import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { COL_DATA_TYPE } from "../api/constants";
import { handleDateInputTabKey } from "./formKeyboardNav";

dayjs.extend(customParseFormat);

export const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DEFAULT_DATE_DISPLAY_FORMAT = "DD/MM/YYYY";
const DEFAULT_DATE_PICKER_FORMAT = "dd/MM/yyyy";

/** Convert API InputFormat tokens (dd-MMM-yy) to dayjs format tokens. */
export function inputFormatToDayjs(format) {
  if (!format || String(format).trim() === "") return DEFAULT_DATE_DISPLAY_FORMAT;
  return String(format)
    .replace(/yyyy/gi, "YYYY")
    .replace(/yy/gi, "YY")
    .replace(/MMM/g, "MMM")
    .replace(/dd/gi, "DD")
    .replace(/mm/g, "MM");
}

/**
 * Convert API InputFormat to react-datepicker dateFormat tokens.
 * Default is dd/MM/yyyy when InputFormat is empty.
 */
export function inputFormatToDatePicker(format) {
  if (!format || String(format).trim() === "") return DEFAULT_DATE_PICKER_FORMAT;
  const protectedFmt = String(format).replace(/MMM/g, "\u0001MMM\u0001");
  return protectedFmt.replace(/mm/g, "MM").replace(/\u0001MMM\u0001/g, "MMM");
}

/** Store a Date as the grid/API value (ISO date + T00:00:00). */
export function dateToStoredValue(date) {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00`;
}

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

  // dd/MM/yyyy or dd/MM/yyyy HH:mm[:ss] — common on list SPs (created/updated date)
  const dmyTime = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmyTime) {
    const date = new Date(
      Number(dmyTime[3]),
      Number(dmyTime[2]) - 1,
      Number(dmyTime[1]),
      Number(dmyTime[4] ?? 0),
      Number(dmyTime[5] ?? 0),
      Number(dmyTime[6] ?? 0)
    );
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
 * Format a date for read-only UI display using InputFormat (dayjs).
 * Default format is dd/mm/yyyy when InputFormat is empty.
 * Accepts ISO strings, timestamps, and other parseable values.
 * Returns "" for empty input; falls back to the raw string when unparseable.
 * @param {unknown} value
 * @param {string} [inputFormat] - API InputFormat e.g. "dd-MMM-yy"
 * @returns {string}
 */
/** Shift a stored/API date value by a number of days; returns stored format. */
export function shiftStoredDate(value, days) {
  const base = parseFlexibleDate(value) ?? new Date();
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return dateToStoredValue(next);
}

/** Shift a native date input value (yyyy-mm-dd) by days. */
export function shiftNativeDateInputValue(value, days) {
  const base = parseFlexibleDate(value) ?? new Date();
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ArrowUp / ArrowDown on date fields — returns true when handled.
 *  With nativeInput, Tab / Shift+Tab leave the control (skip y/m/d segments).
 */
export function handleDateArrowKeys(e, currentValue, onChange, { nativeInput = false } = {}) {
  if (nativeInput && e.key === "Tab") {
    return handleDateInputTabKey(e);
  }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return false;
  e.preventDefault();
  const delta = e.key === "ArrowUp" ? -1 : 1;
  const next = nativeInput
    ? shiftNativeDateInputValue(currentValue, delta)
    : shiftStoredDate(currentValue, delta);
  onChange(next);
  return true;
}

export function formatDateForDisplay(value, inputFormat = "") {
  if (value == null || value === "") return "";

  const date = parseFlexibleDate(value);
  if (!date) return String(value);

  const fmt = inputFormatToDayjs(inputFormat);
  return dayjs(date).format(fmt);
}

/** Format a Date as dd-Mon-yyyy (e.g. "02-Jun-2026"). */
export function formatDdMonYyyy(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mon = MONTH_ABBR[date.getMonth()];
  return `${dd}-${mon}-${date.getFullYear()}`;
}

/**
 * Format a date for API params (dd-Mon-yyyy).
 * Empty / invalid values return "0" by default; set `fallbackToToday: true` to use today.
 */
export function formatTranDate(dateVal, { invalidValue = "0", fallbackToToday = false } = {}) {
  if (dateVal == null || dateVal === "") {
    if (fallbackToToday) return formatDdMonYyyy(new Date());
    return invalidValue;
  }

  const d =
    dateVal instanceof Date ? dateVal : parseFlexibleDate(dateVal) ?? new Date(dateVal);
  if (!d || Number.isNaN(d.getTime())) {
    if (fallbackToToday) return formatDdMonYyyy(new Date());
    return invalidValue;
  }

  return formatDdMonYyyy(d);
}

/** Format list/grid date values for display; empty → em dash. */
export function formatListDate(value) {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : parseFlexibleDate(value);
  if (!d || Number.isNaN(d.getTime())) return "—";

  const str = String(value).trim();
  const hasClockTime = /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/.test(str)
    || (str.includes("T") && !/T00:00:00/.test(str));
  if (hasClockTime) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${formatDdMonYyyy(d)} ${hh}:${mm}`;
  }
  return formatDdMonYyyy(d);
}
