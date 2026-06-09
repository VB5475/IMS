// gridUtils.js — Shared utility functions for grid-based hooks
// ─────────────────────────────────────────────────────────────────────
// Used by: useGridSearch.js, useTxnEntry.js
//
// Contains pure helper functions that are common to both hooks so they
// are defined in one place and imported wherever needed.

import { ENDPOINTS, CBO_MODE } from '../api/constants';
import { getUserSession } from '../session/userSession';

// ── Column helpers ───────────────────────────────────────────────────

/** API bit flags often arrive as 1/0, "true", or "Y" — not only boolean true. */
export function isTruthyApiFlag(val) {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'y' || s === 'yes';
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
    case 2: return 'date';
    case 4: return 'select';
    default: return 'text';
  }
}

/**
 * Derives a pixel width for a grid column based on its display-name length.
 * @param {{ DisplayName?: string }} apiCol
 * @returns {number}
 */
export function getColumnWidth(apiCol) {
  // if (apiCol.ColumnWidth && apiCol.ColumnWidth > 0) return apiCol.ColumnWidth * 1.5;
  const len = (apiCol.DisplayName || '').length;
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
  if (dataType === 'numeric') return `${value ?? ''}`;
  return value != null && value !== '' ? String(value) : '0';
}

// ── Dropdown fetcher ─────────────────────────────────────────────────

export function isLockOnEditModeCol(apiCol) {
  return isTruthyApiFlag(apiCol?.IsLockOnEditModeAllow);
}

/** Build a single { value, label } option from a master/detail row using column metadata. */
export function buildDropdownOptionFromRow(apiCol, rowData) {
  if (!apiCol || !rowData) return [];
  const valueCol = apiCol.CtrlValueCol || apiCol.ColName;
  const displayCol = apiCol.CtrlDisplayCol || valueCol;
  const value = rowData[valueCol];
  if (value == null || value === '') return [];
  const label = rowData[displayCol] ?? value;
  return [{ value: String(value), label: String(label ?? '') }];
}

/** Read the display text for a dropdown column from a grid row. */
export function getRowDropdownDisplay(row, col) {
  const displayCol = col?.ctrlDisplayCol || col?.CtrlDisplayCol;
  if (displayCol && row?.[displayCol] != null && row[displayCol] !== '') {
    return String(row[displayCol]);
  }
  const valueCol = col?.ctrlValueCol || col?.CtrlValueCol || col?.key;
  const value = row?.[valueCol ?? col?.key];
  return value != null && value !== '' ? String(value) : '';
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
    funcCode = '',
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
        colDropdownOptions[col.ColName] = rowData
          ? buildDropdownOptionFromRow(col, rowData)
          : [];
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
          const valKey = opt.FilterCtrlValueCol || 'IDNumber';
          const labelKey = opt.FilterCtrlDisplayCol || 'Name';
          return { value: String(opt[valKey]), label: opt[labelKey] };
        });
      } catch {
        console.warn(`[gridUtils] Failed dropdown for column: ${col.DisplayName}`);
        colDropdownOptions[col.ColName] = [];
      }
    }),
  );

  return colDropdownOptions;
}

// ── Column transformer ───────────────────────────────────────────────

/**
 * Converts raw API columns into the shape expected by GridForm,
 * sorts fixed columns first, then prepends the checkbox column.
 *
 * @param {object[]} apiColumns         - raw column list from GET_DETAIL_COL_DATA
 * @param {Record<string, object[]>} colDropdownOptions
 * @param {object}  [opts]
 * @param {boolean} [opts.filterable=true]      - false for entry grids
 * @param {boolean} [opts.allEditable=false]    - true for entry grids
 * @returns {object[]}  gridColumns ready for GridForm
 */
export function buildGridColumns(apiColumns, colDropdownOptions, opts = {}) {
  const { filterable = true, allEditable = false, existingRecordEdit = false } = opts;

  const dataColumns = apiColumns
    .filter(col => col.IsVisible !== false)
    .map(col => {
      const lockOnEditMode = isLockOnEditModeCol(col);
      let isEditAllow;
      if (allEditable) {
        isEditAllow = existingRecordEdit && lockOnEditMode
          ? false
          : true;
      } else {
        isEditAllow = isTruthyApiFlag(col.IsEditAllow);
      }

      return {
        id: col.ColName,
        name: col.DisplayName,
        key: col.ColName,
        controlType: col.ColCtrlType,
        colDataType: col.ColDataType || null,
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
    { id: 'cb', name: '', key: 'cb', controlType: -1, width: 48, filterable: false, isFixed: true, isEditAllow: false },
    ...dataColumns,
  ];
}
