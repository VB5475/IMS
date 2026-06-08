// usePurchaseInquiry.js — Header meta, detail grid, and filter dropdowns for Purchase Inquiry
// ─────────────────────────────────────────────────────────────────────
// On mount:
//   fetchHeaderMeta  → RB_PurInquiryMst → GetDetailColData + Division + Department
//   fetchDetailMeta  → RB_PurInquiryDet → GetDetailColData (columns only, no dropdowns)
//
// On first "Add New" / supplier insert:
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns
//
// Cascading filters (page onFilterChange):
//   Division → Inquiry Type → Indent

import { useState, useCallback, useRef } from 'react';
import { useApi } from '../api/useApi';
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  OBJ_TYPE,
} from '../api/constants';
import { PI_CONFIG } from '../pages/purchase-inquiry/constants';
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
} from '../utils/gridUtils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** API expects e.g. "02-Jun-2026" */
export function formatPiTranDate(dateVal) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    return `${dd}-${MONTHS[now.getMonth()]}-${now.getFullYear()}`;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function uniqueIndentOptions(rows) {
  const seen = new Set();
  const opts = [];
  for (const row of rows) {
    const id = String(row.IndentID);
    if (seen.has(id)) continue;
    seen.add(id);
    opts.push({ value: id, label: row.IndentNo || id });
  }
  // return opts;
  return rows;
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.IsEventReq) || isTruthyApiFlag(col.IsEventCol)) {
      set.add(col.ColName);
    }
  });
  if (set.size === 0) {
    fallbackKeys.forEach((k) => set.add(k));
  }
  return set;
}

// Shared loader: RB code → RBID + SaveProcName → GetDetailColData columns.
// Used by both the item-detail and supplier grids (same backend pattern,
// only the RB code + storage key change).
async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: OBJ_TYPE.FUNCTION,
    ObjName: PI_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmRBCode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: '',
  });
  const tableRow = metaData?.Table?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);

  const meta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
  localStorage.setItem(storageKey, JSON.stringify(meta));

  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: DEFAULT_LOGIN_ID,
  });
  const apiColumns = colData?.Links || [];
  return { meta, apiColumns };
}

export function usePurchaseInquiry(baseURL = API_BASE_URL) {
  const { get, post } = useApi(baseURL);

  // ── Header (master) state ─────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [inquiryTypeOptions, setInquiryTypeOptions] = useState([]);
  const [indentOptions, setIndentOptions] = useState([]);
  const [isLoadingInquiryTypes, setIsLoadingInquiryTypes] = useState(false);
  const [isLoadingIndents, setIsLoadingIndents] = useState(false);

  // ── Detail grid state ─────────────────────────────────────────────
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const fetchInquiryTypes = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === '0') {
      setInquiryTypeOptions([]);
      return [];
    }

    setIsLoadingInquiryTypes(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_INQUIRY_TYPES,
        JSon: JSON.stringify([{
          PrmCompanyId: DEFAULT_COMPANY_ID,
          PrmDivisionId: Number(divisionId),
          PrmYearId: PI_CONFIG.CONFIG_YEAR_ID,
          PrmUserId: DEFAULT_LOGIN_ID,
          PrmFormTag: PI_CONFIG.FORM_TAG,
          PrmRefType: '',
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.ConfigurationId),
        label: r.Name,
      }));
      setInquiryTypeOptions(opts);
      return opts;
    } catch (err) {
      console.warn('[PI] Inquiry Type fetch failed:', err);
      setInquiryTypeOptions([]);
      return [];
    } finally {
      setIsLoadingInquiryTypes(false);
    }
  }, [get]);

  const fetchIndents = useCallback(async ({ divisionId, configId, tranDate, supplierId = 0, frmOption = 0 }) => {
    if (!divisionId || divisionId === '0' || !configId || configId === '0') {
      setIndentOptions([]);
      return [];
    }

    setIsLoadingIndents(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_INDENTS,
        JSon: JSON.stringify([{
          prmDivisionID: Number(divisionId),
          prmYearID: PI_CONFIG.CONFIG_YEAR_ID,
          prmLoginID: DEFAULT_LOGIN_ID,
          prmTranDate: formatPiTranDate(tranDate),
          prmConfigID: Number(configId),
          prmSupplierID: Number(supplierId) || 0,
          prmTranBook: PI_CONFIG.TRAN_BOOK,
          prmFrmOption: Number(frmOption) || 0,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const opts = uniqueIndentOptions(res?.Table || []);
      // console.log(see opts)
      console.log("SEE OPTIONS:", res?.Table)
      setIndentOptions(opts);
      return opts;
    } catch (err) {
      console.warn('[PI] Indent fetch failed:', err);
      setIndentOptions([]);
      return [];
    } finally {
      setIsLoadingIndents(false);
    }
  }, [get]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);

    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: PI_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error('No PI header RB metadata returned from server.');

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      setHeaderRbMeta(hdrMeta);
      localStorage.setItem(PI_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      console.log('%c[PI] Header meta stored:', 'color:#8b5cf6;font-weight:600', hdrMeta);

      const [colData, divisionData, departmentData] = await Promise.all([
        get(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: hdrMeta.RBID,
          prmLoginID: DEFAULT_LOGIN_ID,
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmUserID: DEFAULT_LOGIN_ID,
            prmCompanyID: DEFAULT_COMPANY_ID,
            prmYearID: PI_CONFIG.DIVISION_YEAR_ID,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: '',
        }).catch((err) => {
          console.warn('[PI] Division fetch failed:', err);
          return null;
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.PROCEDURE,
          ObjName: PI_CONFIG.SP_DEPARTMENTS,
          JSon: JSON.stringify([{ PrmDeptID: 0 }]),
          p_ErrCode: -1,
          p_ErrMsg: '',
        }).catch((err) => {
          console.warn('[PI] Department fetch failed:', err);
          return null;
        }),
      ]);

      const apiColumns = colData?.Links || [];
      setHeaderColumns(apiColumns);
      console.log('%c[PI] Header columns received:', 'color:#8b5cf6;font-weight:600', apiColumns.length);

      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({
          value: String(r.DivisionID),
          label: r.DivisionName,
        })),
      );

      setDepartmentOptions(
        (departmentData?.Table || []).map((r) => ({
          value: String(r.DepartmentID),
          label: r.DepartmentName,
        })),
      );
    } catch (err) {
      console.error('[PI] fetchHeaderMeta failed:', err);
      setHeaderError(err?.message || 'Failed to load header configuration.');
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);

    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get, PI_CONFIG.RB_DETAIL, PI_CONFIG.STORAGE_ENTRY_META,
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;
      setEventColumns(buildEventColumnSet(apiColumns, [
        'ItemID', 'ItemCode', 'TranQty', 'BaseQty', 'UnitConvRate', 'TranRate', 'TranUnit',
      ]));
      setAllColumns(
        apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null })),
      );
      console.log('%c[PI] Detail columns received:', 'color:#6366f1;font-weight:600', apiColumns.length);
    } catch (err) {
      console.error('[PI] fetchDetailMeta failed:', err);
      setMetaError(err?.message || 'Failed to load item grid configuration.');
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(async (divisionID = 0) => {
    const apiColumns = rawDetailColumnsRef.current;
    const meta = rawDetailRbMetaRef.current;

    if (!apiColumns.length || !meta) {
      console.warn('[PI] fetchGridColumns called before fetchDetailMeta completed.');
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(
        get, apiColumns, meta.RBID,
        { funcCode: PI_CONFIG.RB_DETAIL, divisionID: Number(divisionID) || 0 },
      );
      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable: false,
        allEditable: true,
      });
      setColumns(gridColumns);
      console.log('%c[PI] Grid columns built:', 'color:#22c55e;font-weight:600', gridColumns.length);
      return gridColumns;
    } catch (err) {
      console.error('[PI] fetchGridColumns failed:', err);
      return [];
    }
  }, [get]);

  const saveTxn = useCallback(async (headerValues, detailRows, genIDNumber = 0) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const mstMeta = JSON.parse(localStorage.getItem(PI_CONFIG.STORAGE_HEADER_META) || 'null');
      const detMeta = JSON.parse(localStorage.getItem(PI_CONFIG.STORAGE_ENTRY_META) || 'null');

      if (!mstMeta || !detMeta) {
        throw new Error('Missing save configuration. Please refresh and try again.');
      }

      const cleanedRows = detailRows.map(({ id, ...rest }) => rest);
      const body = {
        PrmStrMstRBName: PI_CONFIG.RB_MASTER,
        prmStrMstJSON: JSON.stringify([headerValues]),
        prmstrMasterSaveProcName: mstMeta?.SaveProcName,
        prmstrDetailSaveProcName: detMeta?.SaveProcName,
        PrmStrDetRBName: PI_CONFIG.RB_DETAIL,
        prmStrDetJSON: JSON.stringify(cleanedRows),
        GenIDNumber: genIDNumber,
        p_ErrCode: -1,
        p_ErrMsg: '',
      };

      const result = await post(ENDPOINTS.RB_MASTER_DETAIL_FORM_SAVE, body);

      console.log('%c[PI] Save result:', 'color:#22c55e;font-weight:600', result);
      return result;
    } catch (err) {
      console.error('[PI] saveTxn failed:', err);
      setSaveError(err?.message || 'Save failed. Please try again.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [post]);

  const clearInquiryTypes = useCallback(() => setInquiryTypeOptions([]), []);
  const clearIndents = useCallback(() => setIndentOptions([]), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    departmentOptions,
    inquiryTypeOptions,
    indentOptions,
    fetchInquiryTypes,
    fetchIndents,
    clearInquiryTypes,
    clearIndents,
    isLoadingInquiryTypes,
    isLoadingIndents,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  };
}
