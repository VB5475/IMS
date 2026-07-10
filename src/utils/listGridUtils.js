import { formatListDate } from "./dateFormat";
/** Normalize list row id fields for edit navigation. */
export function normalizeListRow(row) {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    IDNUMBER: row.IDNUMBER ?? row.IDNumber,
  };
}

export function normalizeListRows(rows) {
  return (rows || []).map(normalizeListRow);
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

function extractListColumnKeys(rows) {
  if (!rows?.length) return [];
  const keys = Object.keys(rows[0]);
  const seen = new Set(keys);
  for (let i = 1; i < rows.length; i += 1) {
    Object.keys(rows[i]).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    });
  }
  return keys;
}

function isDateColumnKey(key) {
  return /date/i.test(key);
}

function looksLikeDateValue(value) {
  if (value == null || value === "") return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== "string" && typeof value !== "number") return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const s = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) || /T\d{2}:\d{2}/.test(s) || /\d{2}-\w{3}-\d{4}/.test(s);
}

function inferFilterType(key, sampleValue) {
  if (isDateColumnKey(key) || looksLikeDateValue(sampleValue)) return "date";
  if (typeof sampleValue === "number") return "number";
  return "text";
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
export function buildListColumnsFromRows(rows, { includeActions = false } = {}) {
  const keys = extractListColumnKeys(rows);
  if (keys.length === 0) return [];

  const columns = keys.map((key) => {
    const sampleValue = rows.find((r) => r[key] != null && r[key] !== "")?.[key];
    const filterType = inferFilterType(key, sampleValue);
    const widthPx = inferListColumnWidth(key, filterType);
    const col = {
      key,
      label: key,
      width: `${widthPx}px`,
      minWidth: widthPx,
      filterable: true,
      align: "left",
      filterType,
    };
    if (filterType === "date") {
      col.render = (value) => formatListDate(value);
    }
    return col;
  });

  // Ensure empty cells show em-dash
  columns.forEach((col) => {
    if (!col.render) {
      col.render = (value) => (value == null || value === "" ? "—" : value);
    }
  });

  return columns;
}

/**
 * Standard Edit action column for module list pages.
 */
export function createListEditColumn({ navigate, basePath, className = "list__edit-btn" }) {
  return {
    key: "_action_edit",
    label: "Edit",
    isAction: true,
    actionType: "edit",
    width: "56px",
    minWidth: 56,
    align: "center",
    filterable: false,
    actionClassName: className,
    getActionMeta: (row) => {
      const id = resolveListRecordId(row);
      return {
        id,
        title: `Edit record ${id}`,
        ariaLabel: `Edit record ${id}`,
        navigateTo: `${basePath}/${id}/edit`,
        navigateState: { record: row },
      };
    },
  };
}

export function createListDeleteColumn({ className = "list__edit-btn list__edit-btn--delete" }) {
  return {
    key: "_action_delete",
    label: "Delete",
    isAction: true,
    actionType: "delete",
    width: "64px",
    minWidth: 64,
    align: "center",
    filterable: false,
    actionClassName: className,
    getActionMeta: (row) => {
      const id = resolveListRecordId(row);
      return {
        id,
        title: `Delete record ${id}`,
        ariaLabel: `Delete record ${id}`,
      };
    },
  };
}

/** API data columns + Edit/Delete action columns. */
export function buildListPageColumns(rows, { navigate, basePath, editBtnClass, deleteBtnClass }) {
  const dataColumns = buildListColumnsFromRows(rows);
  if (dataColumns.length === 0) return [];
  return [
    ...dataColumns,
    createListEditColumn({ navigate, basePath, className: editBtnClass }),
    createListDeleteColumn({ className: deleteBtnClass }),
  ];
}
