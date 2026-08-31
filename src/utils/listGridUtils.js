import { formatListDate } from "./dateFormat";
import { resolveRowFieldValue } from "./gridUtils";
import { isErrorOnlyRow } from "./apiResponse";

function isIdNumberColumnKey(key) {
  return String(key).replace(/\s+/g, "").toLowerCase() === "idnumber";
}

// Internal-only columns hidden on every list page, project-wide (2026-08-31
// /pm — same treatment as idnumber above) — appstatusid drives its own
// dedicated UI (row tint + actions-column marker, see EnterpriseDataGrid's
// getRowState handling) rather than showing as a raw-number column.
const ALWAYS_HIDDEN_COLUMN_KEYS = new Set(["appstatusid"]);

function isAlwaysHiddenColumnKey(key) {
  return ALWAYS_HIDDEN_COLUMN_KEYS.has(String(key).replace(/\s+/g, "").toLowerCase());
}

/** Normalize list row id fields for edit navigation. */
export function normalizeListRow(row) {
  if (!row || typeof row !== "object") return row;
  const id = row.IDNUMBER ?? row.IDNumber ?? row.idnumber;
  if (row.idnumber != null || row.IDNumber != null || row.IDNUMBER != null) return row;
  if (id != null && id !== "") return { ...row, IDNUMBER: id };
  return row;
}

/**
 * @throws {Error} when the list SP returned an {ErrCode, ErrMsg} error
 * envelope instead of rows — callers' existing try/catch around the fetch
 * then reports the real backend message instead of silently rendering the
 * error object as if it were a data row (columns "ErrCode"/"ErrMsg", complete
 * with edit/delete actions).
 */
export function normalizeListRows(rows) {
  const arr = rows || [];
  if (arr.length === 1 && isErrorOnlyRow(arr[0])) {
    const row = arr[0];
    const errCode = row.ErrCode ?? row.errcode;
    const message = String(row.ErrMsg ?? row.errmsg ?? "").trim();
    throw new Error(message || `Request failed (ErrCode ${errCode}).`);
  }
  return arr.map(normalizeListRow);
}

/** Resolve primary key for list → edit navigation. */
export function resolveListRecordId(row) {
  if (!row) return 0;
  return (
    row.POID ??
    row.PVID ??
    row.IndentID ??
    row.astempissid ??
    row.AstEmpIssID ??
    row.astempretid ??
    row.AstEmpRetID ??
    row.astdeptissid ??
    row.AstDeptIssID ??
    row.asthealstamstid ??
    row.AstHealStaMstID ??
    row.astwriteoffid ??
    row.AstWriteOffID ??
    row.IDNUMBER ??
    row.IDNumber ??
    row.idnumber ??
    row.MasterID ??
    0
  );
}

function normalizeColumnKey(key) {
  return String(key).replace(/\s+/g, "").toLowerCase();
}

/** Column keys for the list grid — idnumber is a row-id reference only, never a display column.
 *  hiddenKeysSet: additional column keys to exclude (case/space-insensitive), opt-in per caller —
 *  e.g. "appstatusid", an internal workflow-status field with its own dedicated UI
 *  (row color + action-column marker, see EnterpriseDataGrid's showApprovalStatusMarker)
 *  rather than a raw-number column. */
function extractListColumnKeys(rows, hiddenKeysSet) {
  if (!rows?.length) return [];
  const isHidden = (key) =>
    isIdNumberColumnKey(key) || isAlwaysHiddenColumnKey(key) || hiddenKeysSet?.has(normalizeColumnKey(key));
  const keys = Object.keys(rows[0]).filter((key) => !isHidden(key));
  const seen = new Set(keys);
  for (let i = 1; i < rows.length; i += 1) {
    Object.keys(rows[i]).forEach((key) => {
      if (isHidden(key)) return;
      if (seen.has(key)) return;
      seen.add(key);
      keys.push(key);
    });
  }
  return keys;
}

function isDateColumnKey(key) {
  return /\bdate\b/i.test(String(key)) || /date$/i.test(String(key).replace(/\s+/g, ""));
}

function isNumericListKey(key) {
  const normalized = String(key).replace(/\s+/g, "").toLowerCase();
  return /^id(number)?$/.test(normalized) || /^(qty|quantity|amount|rate|total|price|value)$/.test(normalized);
}

function looksLikeDateValue(value) {
  if (value == null || value === "") return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === "number") return false;
  if (typeof value !== "string") return false;
  const s = String(value).trim();
  return (
    /^\d{4}-\d{2}-\d{2}/.test(s)
    || /T\d{2}:\d{2}/.test(s)
    || /^\d{2}-\w{3}-\d{4}/i.test(s)
    || /^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)
  );
}

// 2026-08-14 (/pm): non-date, non-numeric columns now default to 'list' — a
// distinct-value, searchable checkbox filter for exact-match filtering —
// instead of 'text' (plain substring "contains" search). User-requested,
// applies to every list page (this is the column-inference path list pages
// actually use, built from the list SP's own row keys — see
// deriveFilterType in gridUtils.js for the parallel fix on the RB-metadata-
// driven picker-grid path). Numeric columns keep their existing 'number'
// min/max range filter — already a sensible distinct-filter mechanism for
// continuous values, not something this ask calls for replacing.
function inferFilterType(key, sampleValue) {
  if (isDateColumnKey(key)) return "date";
  if (!isNumericListKey(key) && looksLikeDateValue(sampleValue)) return "date";
  if (typeof sampleValue === "number") return "number";
  return "list";
}

/** Infer EnterpriseDataGrid / ColumnFilter type from column key + sample cell value. */
export function inferListColumnFilterType(key, sampleValue) {
  return inferFilterType(key, sampleValue);
}

/** Human-readable header from API list column key. */
export function formatListColumnLabel(key) {
  let label = String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/([a-z])date$/i, "$1 date")
    .replace(/\s+/g, " ")
    .trim();
  return label.replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Read a list cell with case-insensitive key fallback (API casing may differ per row). */
export function resolveListCellValue(row, key) {
  return resolveRowFieldValue(row, key);
}

function formatListDisplayValue(value) {
  if (value == null || value === "" || value === "-") return "—";
  return value;
}

function findListSampleValue(rows, key) {
  for (const row of rows) {
    const val = resolveListCellValue(row, key);
    if (val != null && val !== "" && val !== "-") return val;
  }
  return undefined;
}

/** Sensible min-width (px) for list columns derived from API field names. */
function inferListColumnWidth(key, filterType) {
  const normalized = key.toLowerCase().replace(/\s+/g, "");

  if (/^id(number)?$/.test(normalized)) return 90;
  if (filterType === "date" || /date/.test(normalized)) return 120;
  if (/no$/.test(normalized) || normalized.includes("no")) return 120;
  if (/supplier|vendor|customer|party/.test(normalized)) return 180;
  if (/division|department|location|warehouse/.test(normalized)) return 150;
  if (/type|status|currency|basedon|category/.test(normalized)) return 130;
  if (/createdby|modifiedby|approvedby|enteredby/.test(normalized)) return 140;
  if (/amount|qty|quantity|rate|total|value|price/.test(normalized)) return 110;
  if (filterType === "number") return 100;

  const labelLen = key.length;
  if (labelLen > 20) return 200;
  if (labelLen > 14) return 170;
  return 140;
}

/**
 * Build EnterpriseDataGrid columns from list API row keys (first row defines order).
 * @param {object[]} rows  Normalized list rows from FN_FETCH_DATA Table
 * @param {{ includeActions?: boolean }} [options]
 */
export function buildListColumnsFromRows(rows, { includeActions = false, hiddenKeys = [] } = {}) {
  const hiddenKeysSet = new Set(hiddenKeys.map(normalizeColumnKey));
  const keys = extractListColumnKeys(rows, hiddenKeysSet);
  if (keys.length === 0) return [];

  const columns = keys.map((key) => {
    const sampleValue = findListSampleValue(rows, key);
    const filterType = inferFilterType(key, sampleValue);
    const widthPx = inferListColumnWidth(key, filterType);
    const col = {
      key,
      label: formatListColumnLabel(key),
      width: `${widthPx}px`,
      minWidth: widthPx,
      filterable: true,
      align: "left",
      filterType,
    };
    if (filterType === "date") {
      col.render = (_value, row) => formatListDate(resolveListCellValue(row, key));
    }
    return col;
  });

  // Ensure empty cells show em-dash
  columns.forEach((col) => {
    if (!col.render) {
      col.render = (_value, row) => formatListDisplayValue(resolveListCellValue(row, col.key));
    }
  });

  return columns;
}

/** Standalone Delete-only column for list pages with no per-row edit action. */
export function createDeleteActionColumn({
  getDeleteLabel,
  actionClassName = "list__edit-btn list__edit-btn--delete",
} = {}) {
  return {
    key: "_action_delete",
    label: "Delete",
    isAction: true,
    actionType: "delete",
    width: "44px",
    minWidth: 44,
    align: "center",
    filterable: false,
    actionClassName,
    getActionMeta: (row) => {
      const id = resolveListRecordId(row);
      const label = getDeleteLabel?.(row);
      const title = label ? `Delete ${label}` : `Delete record ${id}`;
      return { id, title, ariaLabel: title };
    },
  };
}

/** Standalone Edit-only column for list pages where delete is intentionally disabled (e.g. Company, Division Master). */
export function createEditActionColumn({
  navigate,
  basePath,
  onEdit,
  getEditLabel,
  actionClassName = "list__edit-btn",
} = {}) {
  return {
    key: "_action_edit",
    label: "Edit",
    isAction: true,
    actionType: "edit",
    width: "44px",
    minWidth: 44,
    align: "center",
    filterable: false,
    actionClassName,
    getActionMeta: (row) => {
      const id = resolveListRecordId(row);
      const label = getEditLabel?.(row);
      const title = label ? `Edit ${label}` : `Edit record ${id}`;
      if (onEdit) {
        return { id, title, ariaLabel: title, onClick: () => onEdit(row) };
      }
      return {
        id,
        title,
        ariaLabel: title,
        navigateTo: `${basePath}/${id}/edit`,
        navigateState: { record: row },
      };
    },
  };
}

/**
 * Single combined Action column (Edit + Delete under one "Action" header) for module list pages.
 * Edit either navigates to a route (`navigate`+`basePath`) or, for modal-based edit forms,
 * invokes `onEdit(row)` directly (pass `onEdit` and omit `navigate`/`basePath`).
 */
export function createListActionsColumn({
  navigate,
  basePath,
  onEdit,
  getEditLabel,
  getDeleteLabel,
  editClassName = "list__edit-btn",
  deleteClassName = "list__edit-btn list__edit-btn--delete",
}) {
  return {
    key: "_actions",
    label: "Action",
    isAction: true,
    actionType: "actions",
    width: "84px",
    minWidth: 84,
    align: "center",
    filterable: false,
    editClassName,
    deleteClassName,
    getEditMeta: (row) => {
      const id = resolveListRecordId(row);
      const label = getEditLabel?.(row);
      const title = label ? `Edit ${label}` : `Edit record ${id}`;
      if (onEdit) {
        return { id, title, ariaLabel: title, onClick: () => onEdit(row) };
      }
      return {
        id,
        title,
        ariaLabel: title,
        navigateTo: `${basePath}/${id}/edit`,
        navigateState: { record: row },
      };
    },
    getDeleteMeta: (row) => {
      const id = resolveListRecordId(row);
      const label = getDeleteLabel?.(row);
      const title = label ? `Delete ${label}` : `Delete record ${id}`;
      return { id, title, ariaLabel: title };
    },
  };
}

/** API data columns + a single combined Action (Edit + Delete) column. */
export function buildListPageColumns(rows, { navigate, basePath, editBtnClass, deleteBtnClass, hiddenKeys }) {
  const dataColumns = buildListColumnsFromRows(rows, { hiddenKeys });
  if (dataColumns.length === 0) return [];
  return [
    ...dataColumns,
    createListActionsColumn({
      navigate,
      basePath,
      editClassName: editBtnClass,
      deleteClassName: deleteBtnClass,
    }),
  ];
}
