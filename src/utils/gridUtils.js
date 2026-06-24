// gridUtils.js — Shared utility functions for grid-based hooks
// ─────────────────────────────────────────────────────────────────────
// Used by: useGridSearch.js, useTxnEntry.js
//
// Contains pure helper functions that are common to both hooks so they
// are defined in one place and imported wherever needed.

import { ENDPOINTS, CBO_MODE } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { buildColumnMeta, formatColumnDisplayValue, getDateInputConstraints, isNumericColumnDef } from "./columnValidation";
import { isDateColumnDef } from "./dateFormat";

// ── Column helpers ───────────────────────────────────────────────────

/** API bit flags often arrive as 1/0, "true", or "Y" — not only boolean true. */
export function isTruthyApiFlag(val) {
  if (val === true || val === 1) return true;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "y" || s === "yes";
  }
  return false;
}

/**
 * Maps a ColCtrlType numeric code to a filter-type string understood by GridForm.
 * @param {number} ctrlType
 * @returns {'date'|'select'|'text'}
 */
export function deriveFilterType(ctrlType) {
  switch (ctrlType) {
    case 2:
      return "date";
    case 4:
      return "select";
    default:
      return "text";
  }
}

/**
 * Derives a pixel width for a grid column based on its display-name length.
 * @param {{ DisplayName?: string }} apiCol
 * @returns {number}
 */
export function getColumnWidth(apiCol) {
  // if (apiCol.ColumnWidth && apiCol.ColumnWidth > 0) return apiCol.ColumnWidth * 1.5;
  const len = (apiCol.DisplayName || "").length;
  if (len <= 4) return 80;
  if (len <= 8) return 110;
  if (len <= 14) return 150;
  if (len <= 20) return 180;
  return 220;
}

// ── Proc-parameter helper (used only by useGridSearch) ───────────────

/**
 * Formats a filter value for embedding in a stored-procedure call string.
 * @param {*} value
 * @param {string} dataType  - e.g. 'numeric', 'varchar', …
 * @returns {string}
 */
export function formatParamValue(value, dataType) {
  if (dataType === "numeric") return `${value ?? ""}`;
  return value != null && value !== "" ? String(value) : "0";
}

// ── Dropdown fetcher ─────────────────────────────────────────────────

export function isLockOnEditModeCol(apiCol) {
  return isTruthyApiFlag(apiCol?.IsLockOnEditModeAllow);
}

/**
 * Merge a static header filter stub with a GET_DETAIL_COL_DATA column.
 * Match key: filter.FilterParameterID === apiCol.ColName.
 */
export function syncHeaderFilterWithApiCol(filter, apiCol, patch = {}) {
  const colName = apiCol?.ColName ?? filter.FilterColName ?? filter.FilterParameterID;
  const columnMeta = apiCol ? buildColumnMeta(apiCol) : null;
  const dateConstraints =
    columnMeta?.dataKind === "date" ? getDateInputConstraints(columnMeta) : null;

  return {
    ...filter,
    ...patch,
    FilterColName: colName,
    FilterCaption: apiCol?.DisplayName ?? colName,
    ctrlValueCol: apiCol?.CtrlValueCol,
    ctrlDisplayCol: apiCol?.CtrlDisplayCol,
    columnMeta,
    dateMin: dateConstraints?.min ?? null,
    dateMax: dateConstraints?.max ?? null,
  };
}

/** Build a ColName → column map from GET_DETAIL_COL_DATA Links. */
export function buildHeaderColMap(headerColumns = []) {
  const map = {};
  headerColumns.forEach((col) => {
    map[col.ColName] = col;
  });
  return map;
}

/** Resolve header column by FilterParameterID (ColName). */
export function resolveHeaderApiCol(filter, apiColMap) {
  return apiColMap[filter.FilterParameterID] ?? apiColMap[filter.FilterColName] ?? null;
}

/**
 * Merge a static master summary stub with a GET_DETAIL_COL_DATA column.
 * Match key: field.SummaryParameterID === apiCol.ColName.
 * detKey = detail grid column to sum; mstKey = master save payload key (ColName).
 */
export function syncMasterSummaryFieldWithApiCol(field, apiCol, patch = {}) {
  const paramId = field?.SummaryParameterID ?? field?.mstKey;
  const mstKey = apiCol?.ColName ?? paramId;
  return {
    ...field,
    ...patch,
    SummaryParameterID: paramId,
    mstKey,
    label: apiCol?.DisplayName ?? field?.label ?? mstKey,
  };
}

/** Resolve master summary column by SummaryParameterID (ColName). */
export function resolveMasterSummaryApiCol(field, apiColMap) {
  return apiColMap[field.SummaryParameterID] ?? apiColMap[field.mstKey] ?? null;
}

/**
 * Sync page-wise summary field stubs with GET_DETAIL_COL_DATA master columns.
 * Returns [] until headerColumns are loaded (same as header filter sync).
 */
export function syncMasterSummaryFields(summaryFields = [], headerColumns = []) {
  if (!headerColumns.length) return [];

  const apiColMap = buildHeaderColMap(headerColumns);

  return summaryFields
    .map((field) => {
      const apiCol = resolveMasterSummaryApiCol(field, apiColMap);
      if (apiCol?.IsVisible === false) return null;
      return syncMasterSummaryFieldWithApiCol(field, apiCol);
    })
    .filter(Boolean);
}

/** Resolve a row field by exact key, then case-insensitive key match (API casing may differ). */
export function resolveRowFieldValue(row, fieldName) {
  if (!row || fieldName == null || fieldName === "") return undefined;
  const direct = row[fieldName];
  if (direct != null && direct !== "") return direct;
  const lower = String(fieldName).toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === lower) {
      const val = row[key];
      if (val != null && val !== "") return val;
    }
  }
  return undefined;
}

/** Read the stored cell value for a grid column (ColName key + CtrlValueCol + casing fallback). */
export function resolveRowCellValue(row, col) {
  if (!row || !col) return "";
  const key = col.key;
  const valueCol = col.ctrlValueCol || col.CtrlValueCol || key;
  const resolved = resolveRowFieldValue(row, key) ?? resolveRowFieldValue(row, valueCol);
  return resolved != null && resolved !== "" ? resolved : "";
}

/** Build a single { value, label } option from a master/detail row using column metadata. */
export function buildDropdownOptionFromRow(apiCol, rowData) {
  if (!apiCol || !rowData) return [];
  const valueCol = apiCol.CtrlValueCol || apiCol.ColName;
  const displayCol = apiCol.CtrlDisplayCol || valueCol;
  const value = resolveRowFieldValue(rowData, valueCol);
  if (value == null || value === "") return [];
  const label = resolveRowFieldValue(rowData, displayCol) ?? value;
  return [{ value: String(value), label: String(label ?? "") }];
}

/**
 * Merge dropdown options from a master-fill row into an options map
 * using GET_DETAIL_COL_DATA column metadata (CtrlValueCol / CtrlDisplayCol).
 */
export function seedMasterDropdownOptions(fieldDefs, master, prev = {}) {
  const next = { ...prev };
  (fieldDefs || []).forEach((field) => {
    if (Number(field.ColCtrlType) !== 4 || !field.ColName) return;
    const opts = buildDropdownOptionFromRow(field, master);
    if (!opts.length) return;
    const key = field.ColName;
    const existing = next[key] || [];
    const merged = [...existing];
    opts.forEach((opt) => {
      if (!merged.some((o) => o.value === opt.value)) merged.unshift(opt);
    });
    next[key] = merged;
  });
  return next;
}

/** Map a master-fill / grid row to form values using GET_DETAIL_COL_DATA columns. */
export function mapRowToFieldValues(row, fieldDefs, context = {}) {
  const values = { ...context };
  (fieldDefs || []).forEach((field) => {
    const key = field.ColName;
    if (!key || row[key] === undefined) return;
    values[key] = row[key];
  });
  return values;
}

/** Read the display text for a dropdown column from a grid row (master-fill display col only). */
export function getRowDropdownDisplay(row, col) {
  const displayCol = col?.ctrlDisplayCol || col?.CtrlDisplayCol;
  if (!displayCol) return "";
  const display = resolveRowFieldValue(row, displayCol);
  if (display == null || display === "") return "";
  const value = resolveRowCellValue(row, col);
  if (String(display) === String(value)) return "";
  return String(display);
}

/** Normalize dropdown option shapes from GET_FILTER_DETAIL or static lists. */
export function normalizeDropdownOptions(dropdownOptions) {
  return (dropdownOptions || []).map((opt) => {
    if (typeof opt === "string") return { value: opt, label: opt };
    if (opt?.value !== undefined) {
      return { value: String(opt.value), label: String(opt.label ?? opt.value) };
    }
    return { value: String(opt.IDNumber ?? opt), label: String(opt.Name ?? opt) };
  });
}

/**
 * Resolve dropdown display label: GET_FILTER_DETAIL options first, then master-fill
 * display column, then raw value. Used in read-only view before edit mode.
 */
export function resolveDropdownLabel(col, row, rawValue) {
  const value =
    rawValue != null && rawValue !== ""
      ? rawValue
      : row
        ? resolveRowCellValue(row, col)
        : "";
  if (value === "" || value == null) return "";

  const opts = normalizeDropdownOptions(col?.dropdownOptions);
  const found = opts.find((o) => String(o.value) === String(value));
  if (found?.label) return found.label;

  const rowDisplay = row ? getRowDropdownDisplay(row, col) : "";
  if (rowDisplay) return rowDisplay;

  return String(value);
}

/**
 * After GET_MASTER_DATA_FILL, align dropdown ColName keys with values that may
 * arrive under CtrlValueCol or with different API casing (e.g. LocationID vs LocationId).
 */
export function syncEditGridDropdownValues(rows, gridColumns) {
  if (!rows?.length || !gridColumns?.length) return rows || [];
  const dropdownCols = gridColumns.filter((c) => c.controlType === 4 && c.key !== "cb");
  if (!dropdownCols.length) return rows;

  return rows.map((row) => {
    const next = { ...row };
    dropdownCols.forEach((col) => {
      const resolved = resolveRowCellValue(row, col);
      if (resolved !== "" && (next[col.key] == null || next[col.key] === "")) {
        next[col.key] = resolved;
      }
    });
    return next;
  });
}

/** Ensure the current row value appears in dropdown options (from master fill + display col). */
export function mergeRowDropdownOptions(col, row, baseOpts = []) {
  const opts = [...baseOpts];
  const value = resolveRowCellValue(row, col);
  if (value === "") return opts;
  const strVal = String(value);
  if (opts.some((o) => String(o.value) === strVal)) return opts;
  const label = resolveDropdownLabel(col, row, value);
  return [{ value: strVal, label: label || strVal }, ...opts];
}

/**
 * Fetches dropdown options for every column whose ColCtrlType === 4
 * and returns a map of { [ColName]: [{ value, label }] }.
 *
 * When existingRecordEdit is true, locked columns (IsLockOnEditModeAllow)
 * skip the API and use rowData instead (master row for filters, omit for detail grid).
 */
export async function fetchDropdownOptions(get, apiColumns, masterID, opts = {}) {
  const {
    funcCode = "",
    divisionID = 0,
    existingRecordEdit = false,
    rowData = null,
    fetchUnlockedDropdowns = true,
  } = opts;

  const dropdownCols = apiColumns.filter((c) => c.ColCtrlType === 4);
  const colDropdownOptions = {};

  if (dropdownCols.length === 0) return colDropdownOptions;

  await Promise.all(
    dropdownCols.map(async (col) => {
      if (existingRecordEdit && isLockOnEditModeCol(col)) {
        colDropdownOptions[col.ColName] = rowData ? buildDropdownOptionFromRow(col, rowData) : [];
        return;
      }

      if (existingRecordEdit && !fetchUnlockedDropdowns) {
        colDropdownOptions[col.ColName] = [];
        return;
      }

      try {
        const detailData = await get(ENDPOINTS.GET_FILTER_DETAIL, {
          prmMasterID: masterID,
          prmFilterParameterName: col.ObjDetID,
          prmCboMode: CBO_MODE.COLUMN,
          prmFuncCode: funcCode,
          prmDivisionID: divisionID,
          prmLoginID: getUserSession().loginId,
        });

        colDropdownOptions[col.ColName] = (detailData?.Links || []).map((opt) => {
          const valKey = opt.FilterCtrlValueCol || "IDNumber";
          const labelKey = opt.FilterCtrlDisplayCol || "Name";
          return { value: String(opt[valKey]), label: opt[labelKey] };
        });
      } catch {
        console.warn(`[gridUtils] Failed dropdown for column: ${col.DisplayName}`);
        colDropdownOptions[col.ColName] = [];
      }
    })
  );

  return colDropdownOptions;
}

function normalizeGridColumnFetchOpts(editOpts) {
  if (typeof editOpts === "boolean") {
    return { existingRecordEdit: editOpts, fetchUnlockedDropdowns: true };
  }
  return {
    existingRecordEdit: false,
    masterRow: null,
    fetchUnlockedDropdowns: true,
    preserveUnlockedDropdowns: false,
    ...(editOpts || {}),
  };
}

/** Division id available from list navigation before master fill. */
export function resolveEditDivisionId(listRecord, fallback = 0) {
  return (
    Number(
      listRecord?.DivisionID ??
      listRecord?.DivisionId ??
      listRecord?.prmDivisionID ??
      fallback
    ) || 0
  );
}

/** Edit load step 1 — GET_FILTER_DETAIL before GET_MASTER_DATA_FILL. */
export function editPrefetchGridColumnOpts() {
  return {
    existingRecordEdit: false,
    fetchUnlockedDropdowns: true,
  };
}

/**
 * Edit load step 2 — after GET_MASTER_DATA_FILL: locked cols from master,
 * unlocked cols keep options prefetched in step 1.
 */
export function editMergeMasterGridColumnOpts(masterRow) {
  return {
    existingRecordEdit: true,
    masterRow,
    fetchUnlockedDropdowns: false,
    preserveUnlockedDropdowns: true,
  };
}

/**
 * fetchGridColumns options when loading an existing record in one pass
 * (e.g. ensureItemColumns) — fetches GET_FILTER_DETAIL for unlocked columns.
 */
export function editRecordGridColumnOpts(masterRow) {
  return {
    existingRecordEdit: true,
    masterRow,
    fetchUnlockedDropdowns: true,
  };
}

/** Keep unlocked dropdown options from a prior prefetch when merging master row. */
export function mergePreservedUnlockedDropdowns(
  colDropdownOptions,
  apiColumns,
  currentGridColumns
) {
  if (!currentGridColumns?.length) return colDropdownOptions;
  const prevByKey = new Map(
    currentGridColumns
      .filter((c) => c.key !== "cb" && c.controlType === 4 && c.dropdownOptions?.length)
      .map((c) => [c.key, c.dropdownOptions])
  );
  const merged = { ...colDropdownOptions };
  apiColumns.forEach((apiCol) => {
    if (apiCol.ColCtrlType !== 4 || isLockOnEditModeCol(apiCol)) return;
    const prev = prevByKey.get(apiCol.ColName);
    if (prev?.length) merged[apiCol.ColName] = prev;
  });
  return merged;
}

/**
 * Normalizes edit opts for fetchDropdownOptions + optional merge from current columns.
 * @deprecated alias — use normalizeGridColumnFetchOpts via fetchAndBuildGridColumns
 */
export function resolveGridDropdownFetchOpts(editOpts, currentGridColumns, apiColumns = []) {
  const opts = normalizeGridColumnFetchOpts(editOpts);
  return {
    existingRecordEdit: opts.existingRecordEdit,
    rowData: opts.masterRow,
    fetchUnlockedDropdowns: opts.fetchUnlockedDropdowns,
    preserveUnlockedDropdowns: opts.preserveUnlockedDropdowns,
    existingRecordEditForBuild: opts.existingRecordEdit,
    mergeAfterFetch(colDropdownOptions) {
      if (!opts.preserveUnlockedDropdowns) return colDropdownOptions;
      return mergePreservedUnlockedDropdowns(
        colDropdownOptions,
        apiColumns,
        currentGridColumns
      );
    },
  };
}

/**
 * Shared fetchGridColumns implementation for module hooks.
 */
export async function fetchAndBuildGridColumns(
  get,
  {
    apiColumns,
    rbId,
    funcCode,
    divisionID = 0,
    editOpts = false,
    currentColumns = [],
    buildColumnOpts = {},
  }
) {
  const opts = normalizeGridColumnFetchOpts(editOpts);
  let colDropdownOptions = await fetchDropdownOptions(get, apiColumns, rbId, {
    funcCode,
    divisionID: Number(divisionID) || 0,
    existingRecordEdit: opts.existingRecordEdit,
    rowData: opts.masterRow,
    fetchUnlockedDropdowns: opts.fetchUnlockedDropdowns,
  });
  if (opts.preserveUnlockedDropdowns) {
    colDropdownOptions = mergePreservedUnlockedDropdowns(
      colDropdownOptions,
      apiColumns,
      currentColumns
    );
  }
  return buildGridColumns(apiColumns, colDropdownOptions, {
    filterable: false,
    allEditable: true,
    existingRecordEdit: opts.existingRecordEdit,
    ...buildColumnOpts,
  });
}

// ── Column transformer ───────────────────────────────────────────────

/**
 * Converts raw API columns into the shared internal grid column shape,
 * sorts fixed columns first, then prepends the checkbox column.
 *
 * @param {object[]} apiColumns         - raw column list from GET_DETAIL_COL_DATA
 * @param {Record<string, object[]>} colDropdownOptions
 * @param {object}  [opts]
 * @param {boolean} [opts.filterable=true]      - false for entry grids
 * @param {boolean} [opts.allEditable=false]    - true for entry grids
 * @returns {object[]}  gridColumns for EntryGrid or conversion via toEnterpriseDataGridColumns
 */
export function buildGridColumns(apiColumns, colDropdownOptions, opts = {}) {
  const { filterable = true, allEditable = false, existingRecordEdit = false } = opts;

  const dataColumns = apiColumns
    .filter((col) => col.IsVisible !== false)
    .map((col) => {
      const lockOnEditMode = isLockOnEditModeCol(col);
      let isEditAllow;
      if (allEditable) {
        isEditAllow = existingRecordEdit && lockOnEditMode ? false : true;
      } else {
        isEditAllow = isTruthyApiFlag(col.IsEditAllow);
      }

      return {
        id: col.ColName,
        name: col.DisplayName,
        key: col.ColName,
        controlType: col.ColCtrlType,
        colDataType: col.ColDataType || null,
        columnMeta: buildColumnMeta(col),
        width: getColumnWidth(col),
        filterable,
        filterType: deriveFilterType(col.ColCtrlType),
        isFixed: isTruthyApiFlag(col.IsFreezeReq),
        isEditAllow,
        lockOnEditMode,
        ctrlValueCol: col.CtrlValueCol || col.ColName,
        ctrlDisplayCol: col.CtrlDisplayCol || null,
        dropdownOptions: colDropdownOptions[col.ColName] || [],
      };
    });

  dataColumns.sort((a, b) => (a.isFixed === b.isFixed ? 0 : a.isFixed ? -1 : 1));

  return [
    {
      id: "cb",
      name: "",
      key: "cb",
      controlType: -1,
      width: 48,
      filterable: false,
      isFixed: true,
      isEditAllow: false,
    },
    ...dataColumns,
  ];
}

/**
 * Maps internal grid columns (from buildGridColumns) to EnterpriseDataGrid column defs.
 * Drops the selection checkbox column — not used by the read-only list grid.
 *
 * @param {object[]} gridColumns
 * @returns {object[]}
 */
export function toEnterpriseDataGridColumns(gridColumns) {
  if (!Array.isArray(gridColumns)) return [];

  return gridColumns
    .filter((col) => col.key !== "cb")
    .map((col) => {
      const isDate = isDateColumnDef(col);
      let filterType = col.filterType || "text";
      if (filterType === "select") filterType = "list";

      const width =
        typeof col.width === "number" ? `${col.width}px` : col.width || undefined;

      const mapped = {
        key: col.key,
        label: col.name || col.label || col.key,
        width,
        filterable: col.filterable !== false,
        filterType,
        dropdownOptions: col.dropdownOptions,
        align: "left",
      };

      if (isDate) {
        mapped.filterType = "date";
        mapped.render = (value) => formatColumnDisplayValue(value, col) || "—";
      } else if (isNumericColumnDef(col)) {
        mapped.render = (value) => formatColumnDisplayValue(value, col) || "—";
      }

      return mapped;
    });
}
