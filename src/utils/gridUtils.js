// gridUtils.js — Shared utility functions for grid-based hooks
// ─────────────────────────────────────────────────────────────────────
// Used by: useGridSearch.js, useTxnEntry.js
//
// Contains pure helper functions that are common to both hooks so they
// are defined in one place and imported wherever needed.

import { ENDPOINTS, CBO_MODE, DEFAULT_LOGIN_ID } from '../api/constants';

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

/**
 * Fetches dropdown options for every column whose ColCtrlType === 4
 * and returns a map of { [ColName]: [{ value, label }] }.
 *
 * @param {Function}  get          - useApi().get
 * @param {object[]}  apiColumns   - raw column list from GET_DETAIL_COL_DATA
 * @param {number}    masterID     - prmMasterID
 * @param {object}    [opts]
 * @param {string}    [opts.funcCode='']        - FuncCode from master detail
 * @param {number}    [opts.divisionID=0]       - DivisionID from filter values
 * @returns {Promise<Record<string, {value:string, label:string}[]>>}
 */
export async function fetchDropdownOptions(get, apiColumns, masterID, opts = {}) {
  const { funcCode = '', divisionID = 0 } = opts;

  const dropdownCols = apiColumns.filter(c => c.ColCtrlType === 4);
  const colDropdownOptions = {};

  if (dropdownCols.length > 0) {
    await Promise.all(
      dropdownCols.map(async (col) => {
        try {
          console.log("see FilterParameterID:", col)

          const detailData = await get(ENDPOINTS.GET_FILTER_DETAIL, {
            prmMasterID: masterID,
            prmFilterParameterName: col.ObjDetID,
            prmCboMode: CBO_MODE.COLUMN,
            prmFuncCode: funcCode,
            prmDivisionID: divisionID,
            prmLoginID: DEFAULT_LOGIN_ID,
          });


          colDropdownOptions[col.ColName] = (detailData?.Links || []).map(opt => {
            const valKey = opt.FilterCtrlValueCol || 'IDNumber';
            const labelKey = opt.FilterCtrlDisplayCol || 'Name';

            return { value: String(opt[valKey]), label: opt[labelKey] };
          });
        } catch {
          console.warn(`[gridUtils] Failed dropdown for column: ${col.DisplayName}`);
          colDropdownOptions[col.ColName] = [];
        }
      })
    );
  }

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
  const { filterable = true, allEditable = false } = opts;

  const dataColumns = apiColumns
    .filter(col => col.IsVisible !== false)
    .map(col => ({
      id: col.ColName,
      name: col.DisplayName,
      key: col.ColName,
      controlType: col.ColCtrlType,
      colDataType: col.ColDataType || null,   // e.g. "numeric(18,2)", "varchar(50)", "datetime"
      width: getColumnWidth(col),
      filterable,
      filterType: deriveFilterType(col.ColCtrlType),
      isFixed: isTruthyApiFlag(col.IsFreezeReq),
      isEditAllow: allEditable ? true : isTruthyApiFlag(col.IsEditAllow),
      dropdownOptions: colDropdownOptions[col.ColName] || [],
    }));

  dataColumns.sort((a, b) => (a.isFixed === b.isFixed ? 0 : a.isFixed ? -1 : 1));

  return [
    { id: 'cb', name: '', key: 'cb', controlType: -1, width: 48, filterable: false, isFixed: true, isEditAllow: false },
    ...dataColumns,
  ];
}
