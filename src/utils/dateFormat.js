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
export const DEFAULT_DATE_PICKER_FORMAT = "dd/MM/yyyy";

/** GET_DETAIL_COL_DATA InputFormat, or dd/MM/yyyy when empty. */
export function resolveDateInputFormat(inputFormat = "") {
  const trimmed = String(inputFormat ?? "").trim();
  return trimmed || DEFAULT_DATE_PICKER_FORMAT;
}

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
  // eslint-disable-next-line no-control-regex --  sentinel is deliberate (protects MMM during the mm->MM replace), not a stray control char
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
 * Normalize picker modal columns so date metadata is available for read-only
 * display, and so column-wise filtering (EntryGrid's `col.filterable`, same
 * feature/UI as the list pages' EnterpriseDataGrid) is turned on — the
 * caller's own `buildGridColumns` call builds these with `filterable: false`
 * (correct for an editable transaction-detail grid), but every consumer of
 * this normalizer is a read-only PICKER grid instead, where the list-page
 * filter convention applies. Does not mutate row values — display formatting
 * happens in the grid renderer.
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
      filterable: true,
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

  // yyyy-MM-dd, optionally followed by a T- or space-separated time (API
  // createddate/updateddate come back as "yyyy-MM-ddTHH:mm:ss.ffffff") — the
  // time must be captured here, not just detected later in formatListDate,
  // or getHours()/getMinutes() on the returned Date always read back 00:00.
  const isoDate = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoDate) {
    const date = new Date(
      Number(isoDate[1]),
      Number(isoDate[2]) - 1,
      Number(isoDate[3]),
      Number(isoDate[4] ?? 0),
      Number(isoDate[5] ?? 0),
      Number(isoDate[6] ?? 0)
    );
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

  // dd.MM.yyyy / dd-MM-yyyy (and similar separators users type while editing)
  const dmyAlt = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyAlt) {
    const date = new Date(Number(dmyAlt[3]), Number(dmyAlt[2]) - 1, Number(dmyAlt[1]));
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

/** Today's date as a native <input type="date"> value (yyyy-MM-dd). */
export function getTodayDateInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Convert stored/API date values to yyyy-MM-dd for native date inputs. */
export function toNativeDateInputValue(value) {
  const date = parseFlexibleDate(value);
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Shift a native date input value (yyyy-mm-dd) by days. */
export function shiftNativeDateInputValue(value, days) {
  return shiftNativeDateInputValueBySegment(value, "day", days);
}

const nativeDateSegmentByInput = new WeakMap();

/** Visual segment order for the current locale (e.g. dd/mm/yyyy vs mm/dd/yyyy). */
function getNativeDateInputSegmentOrder() {
  const parts = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(2000, 0, 15));
  const order = parts
    .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
    .map((part) => part.type);
  return order.length === 3 ? order : ["year", "month", "day"];
}

function getNativeDateInputSegmentFromSelection(input) {
  const pos = input.selectionStart ?? 0;
  if (pos <= 4) return "year";
  if (pos <= 7) return "month";
  if (pos >= 8) return "day";
  return null;
}

/** Infer segment from horizontal click position within a native date input. */
export function inferNativeDateInputSegmentFromPointer(input, clientX) {
  const rect = input.getBoundingClientRect();
  if (!rect.width) return "year";
  const order = getNativeDateInputSegmentOrder();
  const ratio = (clientX - rect.left) / rect.width;
  const idx = ratio < 0.33 ? 0 : ratio < 0.66 ? 1 : 2;
  return order[idx];
}

export function setNativeDateInputSegment(input, segment) {
  if (!(input instanceof HTMLInputElement) || input.type !== "date") return;
  if (segment !== "year" && segment !== "month" && segment !== "day") return;
  nativeDateSegmentByInput.set(input, segment);
  setNativeDateInputSelection(input, segment);
}

/** Which yyyy-mm-dd segment is active in a native date input (year | month | day). */
export function getNativeDateInputSegment(input) {
  if (!(input instanceof HTMLInputElement) || input.type !== "date") return "day";
  const tracked = nativeDateSegmentByInput.get(input);
  if (tracked) return tracked;
  return getNativeDateInputSegmentFromSelection(input) ?? getNativeDateInputSegmentOrder()[0];
}

/** Track active segment on click/focus — native inputs rarely update selectionStart. */
export function handleNativeDateInputSegmentInteraction(e) {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "date") return false;

  if (e.type === "click" || e.type === "mouseup") {
    const clientX = e.clientX;
    requestAnimationFrame(() => {
      const fromSelection = getNativeDateInputSegmentFromSelection(input);
      const segment =
        fromSelection ?? inferNativeDateInputSegmentFromPointer(input, clientX);
      setNativeDateInputSegment(input, segment);
    });
    return true;
  }

  if (e.type === "focus") {
    const order = getNativeDateInputSegmentOrder();
    if (!nativeDateSegmentByInput.has(input)) {
      setNativeDateInputSegment(input, order[0]);
    } else {
      setNativeDateInputSelection(input, nativeDateSegmentByInput.get(input));
    }
    return true;
  }

  return false;
}

/** ArrowLeft / ArrowRight move between year, month, and day segments. */
export function handleNativeDateInputSegmentNavigation(e) {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "date") return false;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return false;

  e.preventDefault();

  const order = getNativeDateInputSegmentOrder();
  let segment = getNativeDateInputSegment(input);
  let idx = order.indexOf(segment);
  if (idx < 0) idx = 0;

  if (e.key === "ArrowRight") {
    const nextIdx = (idx + 1) % order.length;
    setNativeDateInputSegment(input, order[nextIdx]);
    return true;
  }

  const nextIdx = (idx - 1 + order.length) % order.length;
  setNativeDateInputSegment(input, order[nextIdx]);
  return true;
}

/** Combined key handler for native date inputs (segment nav + arrow up/down). */
export function handleNativeDateInputKeyDown(e, currentValue, onChange) {
  if (handleNativeDateInputSegmentNavigation(e)) {
    e.stopPropagation();
    return true;
  }
  const liveValue =
    e.target instanceof HTMLInputElement && e.target.type === "date"
      ? e.target.value
      : currentValue;
  const handled = handleDateArrowKeys(e, liveValue ?? currentValue, onChange, {
    nativeInput: true,
  });
  if (handled) e.stopPropagation();
  return handled;
}

/**
 * Shared event handlers for native `<input type="date">` — click/focus tracking,
 * Left/Right segment focus, Up/Down value changes.
 */
export function getNativeDateInputProps(value, onChange, { onFocus, onBlur } = {}) {
  const currentValue = value ?? "";
  return {
    onFocus: (e) => {
      onFocus?.(e);
      handleNativeDateInputSegmentInteraction(e);
    },
    onClick: handleNativeDateInputSegmentInteraction,
    onMouseUp: handleNativeDateInputSegmentInteraction,
    onKeyDown: (e) => handleNativeDateInputKeyDown(e, currentValue, onChange),
    ...(onBlur ? { onBlur } : {}),
  };
}

/** Restore text selection to a yyyy-mm-dd segment after programmatic value changes. */
export function setNativeDateInputSelection(input, segment) {
  if (!(input instanceof HTMLInputElement) || input.type !== "date") return;
  const len = input.value?.length || 10;
  if (segment === "year") {
    input.setSelectionRange(0, 4);
  } else if (segment === "month") {
    input.setSelectionRange(5, 7);
  } else {
    input.setSelectionRange(8, len);
  }
}

/** Shift a native date input value by year, month, or day segment. */
export function shiftNativeDateInputValueBySegment(value, segment, delta) {
  const base = parseFlexibleDate(value) ?? new Date();
  let next;
  if (segment === "year") {
    next = new Date(base.getFullYear() + delta, base.getMonth(), base.getDate());
  } else if (segment === "month") {
    next = new Date(base.getFullYear(), base.getMonth() + delta, base.getDate());
  } else {
    next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta);
  }
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Clamp native `<input type="date">` values to yyyy-mm-dd with a 4-digit year (1000–9999). */
export function sanitizeNativeDateInput(value) {
  if (value == null || value === "") return "";
  const str = String(value).trim();
  const m = str.match(/^(\d+)-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";

  const yearStr = m[1].length > 4 ? m[1].slice(0, 4) : m[1];
  const y = Number(yearStr);
  const month = Number(m[2]);
  const day = Number(m[3]);

  if (!Number.isFinite(y) || y < 1000 || y > 9999) return "";
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";

  const date = new Date(y, month - 1, day);
  if (date.getFullYear() !== y || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return "";
  }

  return `${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** ArrowUp / ArrowDown on date fields — returns true when handled.
 *  With nativeInput, shifts the focused yyyy-mm-dd segment (year / month / day).
 *  Tab / Shift+Tab leave the control (skip y/m/d segments).
 */
export function handleDateArrowKeys(e, currentValue, onChange, { nativeInput = false } = {}) {
  if (nativeInput && e.key === "Tab") {
    return handleDateInputTabKey(e);
  }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return false;
  e.preventDefault();
  const delta = e.key === "ArrowUp" ? 1 : -1;
  if (nativeInput) {
    const input = e.target;
    const segment = getNativeDateInputSegment(input);
    const baseValue = input.value || currentValue || "";
    const next = shiftNativeDateInputValueBySegment(baseValue, segment, delta);
    onChange(next);
    requestAnimationFrame(() => {
      if (document.activeElement === input) {
        setNativeDateInputSegment(input, segment);
      }
    });
    return true;
  }
  onChange(shiftStoredDate(currentValue, delta));
  return true;
}

// ── Text-based segmented date input (visible segment focus via setSelectionRange) ──

let cachedLocaleDateDisplayConfig = null;
const dateDisplayConfigCache = new Map();
const textDateSegmentByInput = new WeakMap();

function resolveInputDisplayConfig(inputOrFormat) {
  if (inputOrFormat instanceof HTMLInputElement) {
    return getDateDisplayConfig(inputOrFormat.dataset.dateInputFormat || "");
  }
  return getDateDisplayConfig(typeof inputOrFormat === "string" ? inputOrFormat : "");
}

/** Locale display pattern + segment positions (e.g. dd/MM/yyyy). */
export function getLocaleDateDisplayConfig() {
  if (cachedLocaleDateDisplayConfig) return cachedLocaleDateDisplayConfig;

  const parts = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(2000, 0, 15));

  let pattern = "";
  const segments = [];
  let pos = 0;

  for (const part of parts) {
    if (part.type === "literal") {
      pattern += part.value;
      pos += part.value.length;
    } else if (part.type === "day") {
      pattern += "dd";
      segments.push({ type: "day", start: pos, end: pos + 2 });
      pos += 2;
    } else if (part.type === "month") {
      pattern += "MM";
      segments.push({ type: "month", start: pos, end: pos + 2 });
      pos += 2;
    } else if (part.type === "year") {
      pattern += "yyyy";
      segments.push({ type: "year", start: pos, end: pos + 4 });
      pos += 4;
    }
  }

  cachedLocaleDateDisplayConfig = {
    pattern,
    segments,
    order: segments.map((seg) => seg.type),
    inputFormat: "",
    pickerFormat: inputFormatToDatePicker(""),
  };
  return cachedLocaleDateDisplayConfig;
}

/** Display/segment config from GET_DETAIL_COL_DATA InputFormat, else dd/MM/yyyy. */
export function getDateDisplayConfig(inputFormat = "") {
  const resolved = resolveDateInputFormat(inputFormat);
  if (dateDisplayConfigCache.has(resolved)) return dateDisplayConfigCache.get(resolved);

  const fmt = inputFormatToDatePicker(resolved);
  const segments = [];
  let pattern = "";
  let pos = 0;

  for (let i = 0; i < fmt.length;) {
    if (fmt.startsWith("yyyy", i)) {
      pattern += "yyyy";
      segments.push({ type: "year", start: pos, end: pos + 4 });
      pos += 4;
      i += 4;
    } else if (fmt.startsWith("MMM", i)) {
      pattern += "MMM";
      segments.push({ type: "month", start: pos, end: pos + 3 });
      pos += 3;
      i += 3;
    } else if (fmt.startsWith("MM", i)) {
      pattern += "MM";
      segments.push({ type: "month", start: pos, end: pos + 2 });
      pos += 2;
      i += 2;
    } else if (fmt.startsWith("dd", i)) {
      pattern += "dd";
      segments.push({ type: "day", start: pos, end: pos + 2 });
      pos += 2;
      i += 2;
    } else {
      pattern += fmt[i];
      pos += 1;
      i += 1;
    }
  }

  const cfg = {
    pattern,
    segments,
    order: segments.map((seg) => seg.type),
    inputFormat: resolved,
    pickerFormat: fmt,
  };
  dateDisplayConfigCache.set(resolved, cfg);
  return cfg;
}

/** Clamp yyyy-mm-dd to optional min/max bounds. */
export function clampNativeDateValue(value, min, max) {
  const normalized = sanitizeNativeDateInput(value);
  if (!normalized) return value ?? "";
  if (min && normalized < min) return min;
  if (max && normalized > max) return max;
  return normalized;
}

/** Format stored value for segmented date text input. */
export function formatDateInputDisplay(value, inputFormat = "") {
  const date = parseFlexibleDate(value);
  if (!date) return "";
  return dayjs(date).format(inputFormatToDayjs(resolveDateInputFormat(inputFormat)));
}

/** Separator character used by the resolved InputFormat pattern (default `/`). */
export function getDateFormatSeparator(inputFormat = "") {
  const pattern = getDateDisplayConfig(inputFormat).pattern;
  const match = pattern.match(/[^a-zA-Z]/);
  return match ? match[0] : "/";
}

/** True when day/month/year segments are all numeric (no MMM). */
export function isNumericDateDisplayFormat(inputFormat = "") {
  const config = getDateDisplayConfig(inputFormat);
  return config.segments.every((seg) => {
    if (seg.type === "year") return seg.end - seg.start === 2 || seg.end - seg.start === 4;
    if (seg.type === "month") return seg.end - seg.start === 2;
    if (seg.type === "day") return seg.end - seg.start === 2;
    return false;
  });
}

/**
 * Live-format typed date text to the InputFormat pattern.
 * Digits-only (`11122026`) and alternate separators (`11.12.2026`, `11-12-2026`)
 * both become the display form (e.g. `11/12/2026` for dd/MM/yyyy).
 */
export function formatDateTypingInput(raw, inputFormat = "") {
  const text = String(raw ?? "");
  if (!text) return "";

  const config = getDateDisplayConfig(inputFormat);
  const sep = getDateFormatSeparator(inputFormat);

  if (!isNumericDateDisplayFormat(inputFormat)) {
    // Keep MMM-style formats editable; only normalize separators.
    return text.replace(/[./\-\s]+/g, sep);
  }

  const digits = text.replace(/\D/g, "");
  if (!digits) return "";

  let offset = 0;
  const parts = [];
  for (const seg of config.segments) {
    const width = seg.end - seg.start;
    const slice = digits.slice(offset, offset + width);
    if (!slice) break;
    parts.push(slice);
    offset += slice.length;
    if (offset >= digits.length) break;
  }

  // Re-join with format separators between filled segments only.
  let out = "";
  for (let i = 0; i < parts.length; i += 1) {
    if (i > 0) out += sep;
    out += parts[i];
  }

  // If the next character after a full segment would be a separator in the
  // pattern and the user has typed enough digits for that segment, keep the
  // trailing separator so "11/" can appear while typing.
  if (parts.length > 0 && parts.length < config.segments.length) {
    const lastSeg = config.segments[parts.length - 1];
    const lastWidth = lastSeg.end - lastSeg.start;
    if (parts[parts.length - 1].length === lastWidth) {
      const endsWithSep = /[./\-\s]$/.test(text);
      if (endsWithSep) out += sep;
    }
  }

  return out;
}

/** Map caret (by digit count) into a formatted date string. */
export function mapDigitCaretToFormattedPosition(formatted, digitCount) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen >= digitCount) return i + 1;
    }
  }
  return formatted.length;
}

/** Parse segmented date text input to yyyy-mm-dd; null when invalid. */
export function parseDateInputDisplay(display, inputFormat = "") {
  if (display == null || String(display).trim() === "") return "";
  const resolved = resolveDateInputFormat(inputFormat);
  const normalized = formatDateTypingInput(display, resolved);
  const dayjsFmt = inputFormatToDayjs(resolved);

  let parsed = dayjs(normalized, dayjsFmt, true);
  if (!parsed.isValid() && isNumericDateDisplayFormat(resolved)) {
    // Incomplete while typing — treat as not yet a committed date.
    const digits = String(display).replace(/\D/g, "");
    const needed = getDateDisplayConfig(resolved).segments.reduce(
      (sum, seg) => sum + (seg.end - seg.start),
      0
    );
    if (digits.length < needed) return null;
  }
  if (!parsed.isValid()) {
    // Last resort: flexible parse of normalized / raw text.
    const flexible = parseFlexibleDate(normalized) || parseFlexibleDate(display);
    if (!flexible) return null;
    return toNativeDateInputValue(flexible);
  }
  return toNativeDateInputValue(parsed.toDate());
}

function getTextDateInputSegment(input, config) {
  const tracked = textDateSegmentByInput.get(input);
  if (tracked) return tracked;
  const pos = input.selectionStart ?? 0;
  for (const seg of config.segments) {
    if (pos >= seg.start && pos <= seg.end) return seg.type;
  }
  return config.order[0];
}

function setTextDateInputSegment(input, segment, config) {
  const seg = config.segments.find((s) => s.type === segment);
  if (!seg) return;
  textDateSegmentByInput.set(input, segment);
  input.setSelectionRange(seg.start, seg.end);
}

function measureInputTextWidth(input) {
  const style = window.getComputedStyle(input);
  if (!measureInputTextWidth._canvas) {
    measureInputTextWidth._canvas = document.createElement("canvas");
  }
  const ctx = measureInputTextWidth._canvas.getContext("2d");
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const sample = input.value || input.placeholder || getDateDisplayConfig(input.dataset.dateInputFormat || "").pattern;
  return ctx.measureText(sample).width;
}

/** Map a caret index to day/month/year (separators resolve to nearest segment). */
function segmentFromCaretPos(pos, config) {
  for (const seg of config.segments) {
    if (pos >= seg.start && pos < seg.end) return seg.type;
    // Caret at end of segment (inclusive) still belongs to that segment.
    if (pos === seg.end) return seg.type;
  }
  let best = config.order[0];
  let bestDist = Infinity;
  for (const seg of config.segments) {
    const mid = (seg.start + seg.end) / 2;
    const dist = Math.abs(pos - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = seg.type;
    }
  }
  return best;
}

function inferTextDateSegmentFromPointer(input, clientX, config) {
  const rect = input.getBoundingClientRect();
  if (!rect.width) return config.order[0];
  const style = window.getComputedStyle(input);
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const textWidth = Math.max(measureInputTextWidth(input), 1);
  const patternLen = Math.max(config.pattern.length, 1);
  const x = clientX - rect.left - padLeft;
  const ratio = Math.max(0, Math.min(0.999, x / textWidth));
  const charPos = Math.floor(ratio * patternLen);
  return segmentFromCaretPos(charPos, config);
}

function handleTextDateInputSegmentInteraction(e) {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return false;

  const config = resolveInputDisplayConfig(input);

  // Prefer click only — mouseup+click previously double-applied and fought the caret.
  if (e.type === "click") {
    const clientX = e.clientX;
    requestAnimationFrame(() => {
      const value = input.value || "";
      const selStart = input.selectionStart ?? 0;
      const selEnd = input.selectionEnd ?? 0;
      const fullySelected = value.length > 0 && selStart === 0 && selEnd >= value.length;
      // Browser caret already maps to the glyph under the cursor; trust it unless
      // the whole value is selected (then fall back to text-width pointer map).
      const segment = (!fullySelected && value.length > 0)
        ? segmentFromCaretPos(selStart, config)
        : inferTextDateSegmentFromPointer(input, clientX, config);
      setTextDateInputSegment(input, segment, config);
    });
    return true;
  }

  if (e.type === "mouseup") {
    // Handled on click to avoid double rAF with stale/wrong width mapping.
    return true;
  }

  if (e.type === "focus") {
    if (!textDateSegmentByInput.has(input)) {
      setTextDateInputSegment(input, config.order[0], config);
    } else {
      setTextDateInputSegment(input, textDateSegmentByInput.get(input), config);
    }
    return true;
  }

  return false;
}

const textDateSegmentTypeBuffer = new WeakMap();

function handleTextDateInputSegmentNavigation(e) {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return false;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return false;

  e.preventDefault();
  const config = resolveInputDisplayConfig(input);
  const segment = getTextDateInputSegment(input, config);
  const idx = config.order.indexOf(segment);
  const safeIdx = idx < 0 ? 0 : idx;
  const nextIdx =
    e.key === "ArrowRight"
      ? (safeIdx + 1) % config.order.length
      : (safeIdx - 1 + config.order.length) % config.order.length;
  const nextSegment = config.order[nextIdx];
  textDateSegmentTypeBuffer.delete(input);
  setTextDateInputSegment(input, nextSegment, config);
  return true;
}

/**
 * Type a digit into the focused day/month/year segment (Windows-style).
 * Returns { native, segment, advance, config } or null when not handled
 * (empty / fully-selected field uses free-typing instead).
 */
function applyDigitToFocusedDateSegment(input, digit, nativeValue, { min, max } = {}) {
  const inputFormat = input.dataset.dateInputFormat || "";
  if (!isNumericDateDisplayFormat(inputFormat)) return null;

  const config = getDateDisplayConfig(inputFormat);
  const value = input.value || "";
  const selStart = input.selectionStart ?? 0;
  const selEnd = input.selectionEnd ?? 0;
  // Only hijack digits when the field already holds a complete valid date and a
  // segment is focused. Incomplete drafts (e.g. after clear → type "1") must stay
  // on the free-typing / auto-format path so "12" becomes "12", not "01".
  const completeNative = value ? parseDateInputDisplay(value, inputFormat) : null;
  const fullySelected = selStart === 0 && selEnd >= value.length && value.length > 0;

  // Empty / incomplete / fully selected → free-typing path (caller formats via onChange).
  if (!value || !completeNative || fullySelected) {
    textDateSegmentTypeBuffer.delete(input);
    return null;
  }

  const segment = getTextDateInputSegment(input, config);
  const seg = config.segments.find((s) => s.type === segment);
  if (!seg) return null;

  const width = seg.end - seg.start;
  let buf = textDateSegmentTypeBuffer.get(input);
  if (!buf || buf.segment !== segment) {
    buf = { segment, digits: "" };
  }
  buf.digits = `${buf.digits}${digit}`.slice(-width);
  textDateSegmentTypeBuffer.set(input, buf);

  const baseNative =
    nativeValue
    || parseDateInputDisplay(value, inputFormat)
    || getTodayDateInputValue();
  const baseDate = parseFlexibleDate(baseNative) || new Date();

  let year = baseDate.getFullYear();
  let month = baseDate.getMonth() + 1;
  let day = baseDate.getDate();

  const typed = buf.digits;
  const typedNum = Number(typed);
  if (segment === "year") {
    year = width === 2 ? 2000 + (typedNum % 100) : typedNum;
  } else if (segment === "month") {
    month = Math.min(Math.max(typedNum || 1, 1), 12);
  } else if (segment === "day") {
    day = Math.min(Math.max(typedNum || 1, 1), 31);
  }

  const constructed = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const native = clampNativeDateValue(sanitizeNativeDateInput(constructed) || constructed, min, max);
  const advance = typed.length >= width;
  if (advance) {
    textDateSegmentTypeBuffer.set(input, { segment, digits: "" });
  }

  return { native, segment, advance, config };
}

function handleTextDateInputKeyDown(e, nativeValue, onChange, { min, max } = {}) {
  if (handleTextDateInputSegmentNavigation(e)) {
    e.stopPropagation();
    return true;
  }

  if (/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const input = e.target;
    const result = applyDigitToFocusedDateSegment(input, e.key, nativeValue, { min, max });
    if (result) {
      e.preventDefault();
      e.stopPropagation();
      onChange(result.native);
      requestAnimationFrame(() => {
        if (document.activeElement !== input) return;
        if (result.advance) {
          const idx = result.config.order.indexOf(result.segment);
          const nextSeg = result.config.order[Math.min(idx + 1, result.config.order.length - 1)];
          setTextDateInputSegment(input, nextSeg, result.config);
        } else {
          setTextDateInputSegment(input, result.segment, result.config);
        }
      });
      return true;
    }
  }

  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return false;

  e.preventDefault();
  const input = e.target;
  const config = resolveInputDisplayConfig(input);
  const segment = getTextDateInputSegment(input, config);
  const inputFormat = input.dataset.dateInputFormat || "";
  const baseValue =
    nativeValue || parseDateInputDisplay(input.value, inputFormat) || getTodayDateInputValue();
  const delta = e.key === "ArrowUp" ? 1 : -1;
  const next = clampNativeDateValue(
    shiftNativeDateInputValueBySegment(baseValue, segment, delta),
    min,
    max
  );

  textDateSegmentTypeBuffer.delete(input);
  onChange(next);
  requestAnimationFrame(() => {
    if (document.activeElement === input) {
      setTextDateInputSegment(input, segment, config);
    }
  });
  e.stopPropagation();
  return true;
}

/** Event handlers for text segmented date inputs (visible focus + arrow keys). */
export function getTextDateInputProps(
  nativeValue,
  onChange,
  { onFocus, onBlur, inputFormat = "", min, max } = {}
) {
  const currentValue = nativeValue ?? "";
  const resolvedFormat = resolveDateInputFormat(inputFormat);
  const displayConfig = getDateDisplayConfig(resolvedFormat);

  return {
    "data-date-segment-input": "true",
    "data-date-input-format": resolvedFormat,
    maxLength: displayConfig.pattern.length,
    placeholder: displayConfig.pattern.toLowerCase(),
    onFocus: (e) => {
      onFocus?.(e);
      handleTextDateInputSegmentInteraction(e);
    },
    onClick: handleTextDateInputSegmentInteraction,
    onMouseUp: handleTextDateInputSegmentInteraction,
    onKeyDown: (e) => {
      if (e.key === "Tab") {
        if (handleDateInputTabKey(e)) {
          e.stopPropagation();
        }
        return;
      }
      handleTextDateInputKeyDown(e, currentValue, onChange, { min, max });
    },
    ...(onBlur ? { onBlur } : {}),
  };
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
