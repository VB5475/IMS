// useTxnEntry.js — Hook for TxnEntryForm page
// ─────────────────────────────────────────────────────────────────────
// On mount:
//   1a. fetchHeaderMeta() — RB_SampleInvMst → RBID → GetDetailColData
//       + Division options in parallel
//   1b. fetchTxnMeta()   — RB_SampleInvDet → RBID → GetDetailColData
//       ONLY stores allColumns (key/datatype for row seeding).
//       Does NOT yet fetch dropdown options — that is deferred.
//
// On first "Add New" click:
//   fetchGridColumns() — fetchDropdownOptions + buildGridColumns → columns
//
// All API calls go through useApi().get(endpoint, params).

import { useState, useCallback, useRef } from 'react';
import { useApi } from '../api/useApi';
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../api/constants';

import {
  ENDPOINTS,
  STORAGE_KEYS,
  DEFAULT_RB_CODE_TXN,
  DEFAULT_RB_CODE_TXN_MST,
  DEFAULT_LOGIN_ID,
  getColDefault,
} from '../api/constants';
import {
  fetchDropdownOptions,
  buildGridColumns,
} from '../utils/gridUtils';

// ── Hook ─────────────────────────────────────────────────────────────

export function useTxnEntry() {
  const { get } = useApi();

  // ── Grid (detail) state ─────────────────────────────────────────
  const [rbMeta, setRbMeta] = useState(null);
  const [columns, setColumns] = useState([]);
  // ALL columns from the API (visible + hidden) — stored as { key, colDataType }
  // so TxnEntryForm can seed blank rows with the correct per-type default value.
  const [allColumns, setAllColumns] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [isEventFiring, setIsEventFiring] = useState(false);

  // Raw detail API columns kept in a ref so fetchGridColumns can use them
  // without needing to re-fetch from the server.
  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  // ── Header (master) state ───────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerDropdownOpts, setHeaderDropdownOpts] = useState({});
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  // ── fetchHeaderMeta — header filter panel ──────────────────────
  // 1. FN_Fetch_Data (RB_SampleInvMst) → { RBID, SaveProcName }
  // 2. GetDetailColData → raw column defs
  // 3. fetchDropdownOptions + Fn_tbl_FetchUserWsDivision  (in parallel)
  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);

    try {
      // Step 1 — header RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: 'Fn_Fetch_RBDetailByRBCode',
        JSon: JSON.stringify([{ prmRBCode: DEFAULT_RB_CODE_TXN_MST }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error('No header RB metadata returned from server.');

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      setHeaderRbMeta(hdrMeta);
      localStorage.setItem(STORAGE_KEYS.TXN_HEADER_META, JSON.stringify(hdrMeta));
      console.log('%c[TxnEntry] Header meta stored:', 'color:#8b5cf6;font-weight:600', hdrMeta);

      // Step 2 — header column definitions
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const apiColumns = colData?.Links || [];
      setHeaderColumns(apiColumns);
      console.log('%c[TxnEntry] Header columns received:', 'color:#8b5cf6;font-weight:600', apiColumns.length);

      // Step 3 — dropdown options + Division list  (parallel)
      const [colDropdownOptions, divisionData] = await Promise.all([
        fetchDropdownOptions(get, apiColumns, hdrMeta.RBID, { funcCode: DEFAULT_RB_CODE_TXN_MST }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: 'Fn_tbl_FetchUserWsDivision',
          JSon: JSON.stringify([{ prmUserID: 1, prmCompanyID: 1, prmYearID: 14 }]),
          p_ErrCode: -1,
          p_ErrMsg: '',
        }).catch(err => {
          console.warn('[TxnEntry] Division fetch failed:', err);
          return null;
        }),
      ]);

      setHeaderDropdownOpts(colDropdownOptions);

      const divOpts = (divisionData?.Table || []).map(row => ({
        value: String(row.DivisionID),
        label: row.DivisionName,
      }));
      setDivisionOptions(divOpts);
      console.log('%c[TxnEntry] Division options:', 'color:#22c55e;font-weight:600', divOpts);
      console.log('%c[TxnEntry] Header columns synced:', 'color:#22c55e;font-weight:600',
        apiColumns.map(c => `${c.DisplayName} (${c.ColName})`));

    } catch (err) {
      console.error('[TxnEntry] fetchHeaderMeta failed:', err);
      setHeaderError(err?.message || 'Failed to load header configuration.');
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchTxnMeta — Phase A: RBID + column defs only (on mount) ─
  // Fetches RBID, SaveProcName, and raw column definitions.
  // Sets allColumns (needed for row seeding) but does NOT yet fetch
  // dropdown options — that is deferred to fetchGridColumns().
  const fetchTxnMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);

    try {
      // Step A — RBID + SaveProcName
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: 'Fn_Fetch_RBDetailByRBCode',
        JSon: JSON.stringify([{ prmRBCode: DEFAULT_RB_CODE_TXN }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error('No RB metadata returned from server.');

      const meta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      setRbMeta(meta);
      rawDetailRbMetaRef.current = meta;
      localStorage.setItem(STORAGE_KEYS.TXN_ENTRY_META, JSON.stringify(meta));
      console.log('%c[TxnEntry] Meta stored:', 'color:#6366f1;font-weight:600', meta);

      // Step B — column definitions (allColumns only — no dropdowns yet)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: meta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const apiColumns = colData?.Links || [];
      console.log('%c[TxnEntry] Raw columns received:', 'color:#6366f1;font-weight:600', apiColumns.length);

      // Store raw columns in ref for use by fetchGridColumns later
      rawDetailColumnsRef.current = apiColumns;

      // allColumns lets TxnEntryForm seed blank rows with correct defaults
      setAllColumns(
        apiColumns.map(c => ({ key: c.ColName, colDataType: c.ColDataType || null }))
      );

    } catch (err) {
      console.error('[TxnEntry] fetchTxnMeta failed:', err);
      setMetaError(err?.message || 'Failed to load form configuration.');
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns — Phase B: dropdown options + build columns ─
  // Called on the first "Add New" click (not on mount).
  // Uses rawDetailColumnsRef so no extra server round-trip for column defs.
  // divisionID — taken from the Division field in the header filter panel
  //   so GET_FILTER_DETAIL receives the correct prmDivisionID.
  // Returns the built columns array so the caller can use them immediately.
  const fetchGridColumns = useCallback(async (divisionID = 0) => {
    const apiColumns = rawDetailColumnsRef.current;
    const meta = rawDetailRbMetaRef.current;

    if (!apiColumns.length || !meta) {
      console.warn('[TxnEntry] fetchGridColumns called before fetchTxnMeta completed.');
      return [];
    }

    try {
      console.log('%c[TxnEntry] Fetching grid dropdown options…', 'color:#6366f1;font-weight:600',
        { divisionID });
      const colDropdownOptions = await fetchDropdownOptions(
        get, apiColumns, meta.RBID,
        { funcCode: DEFAULT_RB_CODE_TXN, divisionID: Number(divisionID) || 0 }
      );
      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable: false,
        allEditable: true,
      });
      setColumns(gridColumns);
      console.log('%c[TxnEntry] Grid columns built:', 'color:#22c55e;font-weight:600',
        `${gridColumns.length} cols`);
      return gridColumns;
    } catch (err) {
      console.error('[TxnEntry] fetchGridColumns failed:', err);
      return [];
    }
  }, [get]);

  // ── Cell event: fire server-side calculation on Tab ─────────────
  const fireCellEvent = useCallback(async (colName, rowData, headerValues) => {
    setIsEventFiring(true);
    try {
      const { id, ...newRowData } = rowData;
      console.log('see trimmedRowData:', newRowData);
      console.log('see headerValues:', headerValues);

      const result = await get(ENDPOINTS.FN_TBL_RB_GRID_EVENT, {
        GridEventFuncName: 'fn_tbl_RB_SampleInvDet_Event',
        EventColName: colName,
        DetJSON: JSON.stringify([newRowData]),
        MstJSon: JSON.stringify([headerValues]),
      });
      console.log('%c[TxnEntry] CellEvent response:',
        'color:#f59e0b;font-weight:600', { col: colName, result });
      return result;
    } catch (err) {
      console.error('[TxnEntry] fireCellEvent failed:', err);
      return null;
    } finally {
      setIsEventFiring(false);
    }
  }, [get]);

  // ── saveTxn — save master (header) + detail (grid) to backend ──────
  // Reads SaveProcName from localStorage for both master and detail.
  // headerValues = current filter panel values (MstJSON)
  // detailRows   = grid rows from TxnEntryGridForm (DetJSON)
  // genIDNumber  = 0 for new entry, 1 for existing (from route :id)
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const saveTxn = useCallback(async (headerValues, detailRows, genIDNumber = 0) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Read proc names from localStorage
      const mstMeta = JSON.parse(localStorage.getItem(STORAGE_KEYS.TXN_HEADER_META) || 'null');
      const detMeta = JSON.parse(localStorage.getItem(STORAGE_KEYS.TXN_ENTRY_META) || 'null');

      if (!mstMeta || !detMeta) {
        throw new Error('Missing save configuration. Please refresh and try again.');
      }

      // Strip internal 'id' field from each detail row before sending
      // const cleanedRows = detailRows.map(({ id, ...rest }) => rest);
      // // console.log("see the cleanedRows:", cleanedRows)
      // const params = {
      //   PrmStrMstRBName: DEFAULT_RB_CODE_TXN_MST,
      //   prmStrMstJSON: JSON.stringify([headerValues]),
      //   prmstrMasterSaveProcName: mstMeta?.SaveProcName,
      //   prmstrDetailSaveProcName: detMeta?.SaveProcName,
      //   PrmStrDetRBName: DEFAULT_RB_CODE_TXN,
      //   prmStrDetJSON: JSON.stringify(cleanedRows),
      //   GenIDNumber: genIDNumber,
      //   p_ErrCode: -1,
      //   p_ErrMsg: '',
      // };

      // // console.log('%c[TxnEntry] Saving transaction…', 'color:#f59e0b;font-weight:600', params);

      // const result = await get(ENDPOINTS.RB_MASTER_DETAIL_FORM_SAVE, params);

      // console.log('%c[TxnEntry] Save result:', 'color:#22c55e;font-weight:600', result);
      // return result;


      // Strip internal 'id' field from each detail row before sending
      const cleanedRows = detailRows.map(({ id, ...rest }) => rest);

      const body = {
        PrmStrMstRBName: DEFAULT_RB_CODE_TXN_MST,
        prmStrMstJSON: JSON.stringify([headerValues]),
        prmstrMasterSaveProcName: mstMeta?.SaveProcName,
        prmstrDetailSaveProcName: detMeta?.SaveProcName,
        PrmStrDetRBName: DEFAULT_RB_CODE_TXN,
        prmStrDetJSON: JSON.stringify(cleanedRows),
        GenIDNumber: genIDNumber,
        p_ErrCode: -1,
        p_ErrMsg: '',
      };

      const result = await axios.post(
        `${API_BASE_URL}${ENDPOINTS.RB_MASTER_DETAIL_FORM_SAVE}`,
        body,                          // ← raw JSON body
        {
          timeout: API_TIMEOUT,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );

      console.log('%c[TxnEntry] Save result:', 'color:#22c55e;font-weight:600', result.data);
      return result.data;




    } catch (err) {
      console.error('[TxnEntry] saveTxn failed:', err);
      setSaveError(err?.message || 'Save failed. Please try again.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [get]);

  return {
    // Grid (detail)
    rbMeta,
    columns,
    allColumns,
    isFetching,
    isEventFiring,
    metaError,
    fetchTxnMeta,
    fetchGridColumns,   // call on first "Add New" click
    fireCellEvent,

    // Header (master) — raw API columns for syncing
    headerColumns,
    headerDropdownOpts,
    divisionOptions,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,

    // Save
    saveTxn,
    isSaving,
    saveError,
  };
}
