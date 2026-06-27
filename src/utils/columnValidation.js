import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { COL_DATA_TYPE } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { formatNumber, parseNumberInput } from "./numberFormat";
import { parseFlexibleDate, inputFormatToDayjs } from "./dateFormat";

dayjs.extend(customParseFormat);

/** API bit flags often arrive as 1/0, "true", or "Y" — not only boolean true. */
function isTruthyApiFlag(val) {
  if (val === true || val === 1) return true;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "y" || s === "yes";
  }
  return false;
}

export function getColDataKind(colDataType) {
  if (!colDataType) return null;
  const lower = String(colDataType).toLowerCase();
  // numeric / decimal / float / real / double precision / integer / bigint / smallint / money
  if (
    lower.includes("numeric") ||
    lower.includes("decimal") ||
    lower.includes("float") ||
    lower.includes("real") ||
    lower.includes("double") ||
    lower.includes("int") ||
    lower.includes("money")
  )
    return "numeric";
  if (lower.includes("varchar") || lower.includes("text") || lower.includes("char")) return "varchar";
  if (lower.includes("datetime") || lower.includes("date") || lower.includes("time")) return "date";
  return null;
}

export function isNumericColDataType(colDataType) {
  return getColDataKind(colDataType) === "numeric";
}

/** True when a grid column definition represents a numeric column. */
export function isNumericColumnDef(col) {
  if (!col) return false;
  if (col.columnMeta?.dataKind === "numeric") return true;
  const colDataType = col.colDataType ?? col.coldatatype ?? col.columnMeta?.colDataType;
  return isNumericColDataType(colDataType);
}

/** Extract decimal places (N) from ColDataType like "numeric(M,N)" or "decimal(M,N)". */
export function getNumericDecimalPlaces(colDataType) {
  if (!colDataType) return 0;
  const match = String(colDataType).match(/(?:numeric|decimal)\s*\(\s*\d+\s*,\s*(\d+)\s*\)/i);
  return match ? Number(match[1]) : 0;
}

/**
 * Build a DetJSON string that preserves decimal precision for numeric columns.
 *
 * JSON.stringify collapses 12.00 → 12 because JS numbers have no scale.
 * This helper uses toFixed(N) from the column's type (e.g. numeric(18,2) → N=2)
 * so the SP receives "tranqty":12.00 instead of "tranqty":12.
 *
 * @param {Object[]} rows       - Row data objects (id already stripped)
 * @param {Object}   colTypeMap - { key: rawColDataType } from allColumns
 */
export function buildDetJSON(rows, colTypeMap = {}) {
  function enc(k, v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return String(v);
    if (typeof v === "number") {
      const dp = getNumericDecimalPlaces(colTypeMap[k]);
      return dp > 0 ? v.toFixed(dp) : String(v);
    }
    if (typeof v === "string") return JSON.stringify(v);
    return JSON.stringify(v);
  }
  const inner = rows
    .map((row) => `{${Object.entries(row).map(([k, v]) => `${JSON.stringify(k)}:${enc(k, v)}`).join(",")}}`)
    .join(",");
  return `[${inner}]`;
}

/** Build normalized validation/display metadata from a GET_DETAIL_COL_DATA column. */
export function buildColumnMeta(apiCol) {
  if (!apiCol) return null;
  const colDataType = apiCol.coldatatype ?? apiCol.colDataType ?? null;
  return {
    key: apiCol.colname ?? apiCol.key,
    displayName: apiCol.displayname ?? apiCol.name ?? apiCol.colname ?? apiCol.key ?? "Field",
    isMandatory: isTruthyApiFlag(apiCol.ismandatory),
    isValidationReq: isTruthyApiFlag(apiCol.isvalidationreq),
    colDataType,
    dataKind: getColDataKind(colDataType),
    inputFormat: apiCol.inputformat ?? apiCol.inputFormat ?? "",
    decimalPlaces: getNumericDecimalPlaces(colDataType),
    minLen: apiCol.minlen != null ? Number(apiCol.minlen) : null,
    maxLen: apiCol.maxlen != null ? Number(apiCol.maxlen) : null,
    valueMinRange: apiCol.valueminrange != null ? Number(apiCol.valueminrange) : null,
    valueMaxRange: apiCol.valuemaxrange != null ? Number(apiCol.valuemaxrange) : null,
    isCrossYearEntryAllow: isTruthyApiFlag(apiCol.iscrossyearentryallow),
    isFutureDateAllow: isTruthyApiFlag(apiCol.isfuturedateallow),
  };
}

/** Read column meta from a grid column def or raw API column. */
export function resolveColumnMeta(col) {
  if (!col) return null;
  if (col.columnMeta) return col.columnMeta;
  return buildColumnMeta(col);
}

/** True when GET_DETAIL_COL_DATA marks the column as mandatory (IsMandatory). */
export function isColumnMandatory(colOrMeta) {
  return Boolean(resolveColumnMeta(colOrMeta)?.isMandatory);
}

function isEmptyValue(value) {
  return value == null || value === "";
}

function toIsoDateOnly(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : parseFlexibleDate(date);
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getSessionYearBounds() {
  const year = getUserSession()?.year;
  return {
    yearFrom: year?.YearFrom ? parseFlexibleDate(year.YearFrom) : null,
    yearTo: year?.YearTo ? parseFlexibleDate(year.YearTo) : null,
  };
}

/**
 * Date input constraints for HTML date pickers and validation.
 * @returns {{ min: string|null, max: string|null }}
 */
export function getDateInputConstraints(meta) {
  if (!meta || meta.dataKind !== "date") return { min: null, max: null };

  const { yearFrom, yearTo } = getSessionYearBounds();
  const todayIso = toIsoDateOnly(new Date());

  let min = null;
  let max = null;

  if (!meta.isCrossYearEntryAllow) {
    min = toIsoDateOnly(yearFrom);
    max = toIsoDateOnly(yearTo);
  }

  if (!meta.isFutureDateAllow) {
    const futureMax = todayIso;
    max = max ? (futureMax < max ? futureMax : max) : futureMax;
  } else if (!meta.isCrossYearEntryAllow) {
    max = toIsoDateOnly(yearTo);
  }

  return { min, max };
}

/**
 * Validate a single field value against column metadata.
 * @returns {{ valid: boolean, message: string }}
 */
export function validateColumnValue(value, colOrMeta) {
  const meta = resolveColumnMeta(colOrMeta);
  if (!meta) return { valid: true, message: "" };

  const label = meta.displayName || meta.key || "Field";

  if (meta.isMandatory && isEmptyValue(value)) {
    return { valid: false, message: `${label} is required.` };
  }

  if (!meta.isValidationReq || isEmptyValue(value)) {
    return { valid: true, message: "" };
  }

  const kind = meta.dataKind ?? getColDataKind(meta.colDataType);

  if (kind === "varchar") {
    const str = String(value);
    if (meta.minLen != null && !Number.isNaN(meta.minLen) && str.length < meta.minLen) {
      return {
        valid: false,
        message: `${label} must be at least ${meta.minLen} character(s).`,
      };
    }
    if (meta.maxLen != null && !Number.isNaN(meta.maxLen) && str.length > meta.maxLen) {
      return {
        valid: false,
        message: `${label} must be at most ${meta.maxLen} character(s).`,
      };
    }
    return { valid: true, message: "" };
  }

  if (kind === "numeric") {
    const num = Number(value);
    if (Number.isNaN(num)) {
      return { valid: false, message: `${label} must be a valid number.` };
    }
    if (meta.valueMinRange != null && !Number.isNaN(meta.valueMinRange) && num < meta.valueMinRange) {
      return {
        valid: false,
        message: `${label} must be at least ${meta.valueMinRange}.`,
      };
    }
    if (meta.valueMaxRange != null && !Number.isNaN(meta.valueMaxRange) && num > meta.valueMaxRange) {
      return {
        valid: false,
        message: `${label} must be at most ${meta.valueMaxRange}.`,
      };
    }
    return { valid: true, message: "" };
  }

  if (kind === "date") {
    const date = parseFlexibleDate(value);
    if (!date) {
      return { valid: false, message: `${label} must be a valid date.` };
    }

    const valueIso = toIsoDateOnly(date);
    const { min, max } = getDateInputConstraints(meta);

    if (min && valueIso < min) {
      return { valid: false, message: `${label} cannot be before ${min}.` };
    }
    if (max && valueIso > max) {
      return { valid: false, message: `${label} cannot be after ${max}.` };
    }
    return { valid: true, message: "" };
  }

  return { valid: true, message: "" };
}

/** Format a column value for read-only display. Original value is unchanged for save/API. */
export function formatColumnDisplayValue(value, colOrMeta) {
  const meta = resolveColumnMeta(colOrMeta);
  if (!meta || isEmptyValue(value)) return "";

  const kind = meta.dataKind ?? getColDataKind(meta.colDataType);

  if (kind === "numeric") {
    const parsed = parseNumberInput(value);
    if (parsed === "") return "";
    return formatNumber(parsed, meta.inputFormat, meta.decimalPlaces);
  }

  if (kind === "date") {
    const date = parseFlexibleDate(value);
    if (!date) return String(value);
    const fmt = inputFormatToDayjs(meta.inputFormat);
    return dayjs(date).format(fmt);
  }

  return String(value);
}

/**
 * Validate multiple rows against grid column definitions.
 * @returns {string[]} error messages
 */
export function validateGridRows(rows, columns) {
  const errors = [];
  const dataCols = (columns || []).filter((c) => c.key && c.key !== "cb");

  (rows || []).forEach((row, rowIdx) => {
    dataCols.forEach((col) => {
      const result = validateColumnValue(row[col.key], col);
      if (!result.valid) {
        errors.push(`Row ${rowIdx + 1} — ${result.message}`);
      }
    });
  });

  return errors;
}

/**
 * Validate a flat values object against raw GET_DETAIL_COL_DATA columns.
 * @returns {string[]} error messages
 */
export function validateApiColumns(values, apiColumns) {
  const errors = [];
  (apiColumns || []).forEach((apiCol) => {
    if (!isTruthyApiFlag(apiCol.isvisible)) return;
    const key = apiCol.colname;
    if (!key) return;
    const result = validateColumnValue(values[key], apiCol);
    if (!result.valid) errors.push(result.message);
  });
  return errors;
}
