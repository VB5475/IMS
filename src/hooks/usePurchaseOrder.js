// usePurchaseOrder.js — Header meta, detail grid, and filter dropdowns for Purchase Order
// ─────────────────────────────────────────────────────────────────────────────────────
// Mirrors usePurchaseInquiry.js exactly — same three-phase load pattern:
//
//   fetchHeaderMeta  → RB_PurOrderMst → GetDetailColData + Division + Supplier + Currency
//   fetchDetailMeta  → RB_PurOrderDet → GetDetailColData (columns only, no dropdowns)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (on first Add New)
//
// Additional PO-specific calls:
//   fetchPoTypes(divisionId)          — cascade: Division → PO Type
//   fetchSupplierInfo(supplierId)     — derive CurrencyRate + CrDays from selected Supplier
//   fetchExistingPOs()                — Amend dropdown: list of existing POs
//
// Cascade: Division → PO Type

import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useApi } from '../api/useApi';
import {
  ENDPOINTS,
  API_BASE_URL,
  API_TIMEOUT,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
} from '../api/constants';
import { PO_CONFIG } from '../pages/purchase-order/constants';
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
} from '../utils/gridUtils';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatPoTranDate(dateVal) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2,'0')}-${MONTHS[now.getMonth()]}-${now.getFullYear()}`;
  }
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.IsEventReq) || isTruthyApiFlag(col.IsEventCol)) {
      set.add(col.ColName);
    }
  });
  if (set.size === 0) fallbackKeys.forEach((k) => set.add(k));
  return set;
}

// Shared loader: RB code → RBID + SaveProcName → GetDetailColData columns.
async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: PO_CONFIG.SP_RB_META,
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

export function usePurchaseOrder(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Header (master) state ───────────────────────────────────────────
  const [headerColumns,      setHeaderColumns]      = useState([]);
  const [headerRbMeta,       setHeaderRbMeta]        = useState(null);
  const [headerFetching,     setHeaderFetching]      = useState(false);
  const [headerError,        setHeaderError]         = useState(null);

  const [divisionOptions,    setDivisionOptions]     = useState([]);
  const [poTypeOptions,      setPoTypeOptions]       = useState([]);
  const [supplierOptions,    setSupplierOptions]     = useState([]);
  const [currencyOptions,    setCurrencyOptions]     = useState([]);
  const [existingPOs,        setExistingPOs]         = useState([]);

  const [isLoadingPoTypes,   setIsLoadingPoTypes]    = useState(false);
  const [isLoadingSuppliers, setIsLoadingSuppliers]  = useState(false);
  const [isLoadingExistingPOs, setIsLoadingExistingPOs] = useState(false);

  // ── Detail grid state ───────────────────────────────────────────────
  const [columns,     setColumns]     = useState([]);
  const [allColumns,  setAllColumns]  = useState([]);
  const [eventColumns,setEventColumns]= useState(() => new Set());
  const [isFetching,  setIsFetching]  = useState(false);
  const [metaError,   setMetaError]   = useState(null);
  const [isSaving,    setIsSaving]    = useState(false);
  const [saveError,   setSaveError]   = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef  = useRef(null);

  // ── fetchPoTypes — cascade from Division ───────────────────────────
  const fetchPoTypes = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === '0') {
      setPoTypeOptions([]);
      return [];
    }
    setIsLoadingPoTypes(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PO_CONFIG.SP_PO_TYPES,
        JSon: JSON.stringify([{
          PrmCompanyId:  DEFAULT_COMPANY_ID,
          PrmDivisionId: Number(divisionId),
          PrmYearId:     PO_CONFIG.CONFIG_YEAR_ID,
          PrmUserId:     DEFAULT_LOGIN_ID,
          PrmFormTag:    PO_CONFIG.FORM_TAG,
          PrmRefType:    '',
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.ConfigurationId),
        label: r.Name,
      }));
      setPoTypeOptions(opts);
      return opts;
    } catch (err) {
      console.warn('[PO] PO Type fetch failed:', err);
      setPoTypeOptions([]);
      return [];
    } finally {
      setIsLoadingPoTypes(false);
    }
  }, [get]);

  // ── fetchSupplierInfo — derive CurrencyID, CurrencyRate, CrDays ────
  // Returns { CurrencyID, CurrencyRate, CrDays } or null on failure.
  // CONFIRM: SP_SUPPLIER_INFO returns these fields for the given SupplierID.
  const fetchSupplierInfo = useCallback(async (supplierId) => {
    if (!supplierId || supplierId === '0') return null;
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 1,
        ObjName: PO_CONFIG.SP_SUPPLIER_INFO,
        JSon: JSON.stringify([{ PrmSupplierID: Number(supplierId) }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const row = res?.Table?.[0];
      if (!row) return null;
      return {
        CurrencyID:   row.CurrencyID   ?? 0,
        CurrencyRate: row.CurrencyRate ?? 0,
        CrDays:       row.CrDays       ?? 0,
      };
    } catch (err) {
      console.warn('[PO] Supplier info fetch failed:', err);
      return null;
    }
  }, [get]);

  // ── fetchExistingPOs — Amend dropdown ──────────────────────────────
  const fetchExistingPOs = useCallback(async () => {
    setIsLoadingExistingPOs(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PO_CONFIG.SP_EXISTING_POS,
        JSon: JSON.stringify([{
          prmLoginID:   DEFAULT_LOGIN_ID,
          prmCompanyID: DEFAULT_COMPANY_ID,
          prmYearID:    PO_CONFIG.DIVISION_YEAR_ID,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.IDNumber ?? r.POId ?? r.TranID),
        label: r.TranCode ?? r.PONo ?? String(r.IDNumber),
      }));
      setExistingPOs(opts);
      return opts;
    } catch (err) {
      console.warn('[PO] Existing POs fetch failed:', err);
      setExistingPOs([]);
      return [];
    } finally {
      setIsLoadingExistingPOs(false);
    }
  }, [get]);

  // ── fetchHeaderMeta ─────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);

    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PO_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: PO_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error('No PO header RB metadata returned from server.');

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      setHeaderRbMeta(hdrMeta);
      localStorage.setItem(PO_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      console.log('%c[PO] Header meta stored:', 'color:#8b5cf6;font-weight:600', hdrMeta);

      const [colData, divisionData, supplierData, currencyData] = await Promise.all([
        get(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: hdrMeta.RBID,
          prmLoginID:  DEFAULT_LOGIN_ID,
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PO_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmUserID:    DEFAULT_LOGIN_ID,
            prmCompanyID: DEFAULT_COMPANY_ID,
            prmYearID:    PO_CONFIG.DIVISION_YEAR_ID,
          }]),
          p_ErrCode: -1, p_ErrMsg: '',
        }).catch((err) => { console.warn('[PO] Division fetch failed:', err); return null; }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PO_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([{
            PrmDivisionId: 0,
            PrmLoginId:    DEFAULT_LOGIN_ID,
            PrmYearId:     PO_CONFIG.CONFIG_YEAR_ID,
            PrmPartyType:  PO_CONFIG.SUPPLIER_PARTY_TYPE,
          }]),
          p_ErrCode: -1, p_ErrMsg: '',
        }).catch((err) => { console.warn('[PO] Supplier fetch failed:', err); return null; }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 1,
          ObjName: PO_CONFIG.SP_CURRENCIES,
          JSon: JSON.stringify([{ PrmCurrencyID: 0 }]),
          p_ErrCode: -1, p_ErrMsg: '',
        }).catch((err) => { console.warn('[PO] Currency fetch failed:', err); return null; }),
      ]);

      setHeaderColumns(colData?.Links || []);
      console.log('%c[PO] Header columns received:', 'color:#8b5cf6;font-weight:600', (colData?.Links || []).length);

      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({
          value: String(r.DivisionID),
          label: r.DivisionName,
        })),
      );

      setIsLoadingSuppliers(true);
      setSupplierOptions(
        (supplierData?.Table || []).map((r) => ({
          value: String(r.SupplierID ?? r.PartyID),
          label: r.SupplierName ?? r.PartyName,
        })),
      );
      setIsLoadingSuppliers(false);

      setCurrencyOptions(
        (currencyData?.Table || []).map((r) => ({
          value: String(r.CurrencyID),
          label: r.CurrencyName ?? r.CurrencyCode ?? String(r.CurrencyID),
        })),
      );
    } catch (err) {
      console.error('[PO] fetchHeaderMeta failed:', err);
      setHeaderError(err?.message || 'Failed to load PO header configuration.');
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchDetailMeta ─────────────────────────────────────────────────
  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);

    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get, PO_CONFIG.RB_DETAIL, PO_CONFIG.STORAGE_ENTRY_META,
      );
      rawDetailRbMetaRef.current  = meta;
      rawDetailColumnsRef.current = apiColumns;
      setEventColumns(buildEventColumnSet(apiColumns, [
        'ItemID', 'ItemCode', 'TranQty', 'BaseQty', 'UnitConvRate', 'TranRate', 'TranUnit',
      ]));
      setAllColumns(
        apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null })),
      );
      console.log('%c[PO] Detail columns received:', 'color:#6366f1;font-weight:600', apiColumns.length);
    } catch (err) {
      console.error('[PO] fetchDetailMeta failed:', err);
      setMetaError(err?.message || 'Failed to load PO item grid configuration.');
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns ────────────────────────────────────────────────
  const fetchGridColumns = useCallback(async (divisionID = 0) => {
    const apiColumns = rawDetailColumnsRef.current;
    const meta       = rawDetailRbMetaRef.current;

    if (!apiColumns.length || !meta) {
      console.warn('[PO] fetchGridColumns called before fetchDetailMeta completed.');
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(
        get, apiColumns, meta.RBID,
        { funcCode: PO_CONFIG.RB_DETAIL, divisionID: Number(divisionID) || 0 },
      );
      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable:  false,
        allEditable: true,
      });
      setColumns(gridColumns);
      console.log('%c[PO] Grid columns built:', 'color:#22c55e;font-weight:600', gridColumns.length);
      return gridColumns;
    } catch (err) {
      console.error('[PO] fetchGridColumns failed:', err);
      return [];
    }
  }, [get]);

  // ── saveTxn ─────────────────────────────────────────────────────────
  const saveTxn = useCallback(async (headerValues, detailRows, genIDNumber = 0) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const mstMeta = JSON.parse(localStorage.getItem(PO_CONFIG.STORAGE_HEADER_META) || 'null');
      const detMeta = JSON.parse(localStorage.getItem(PO_CONFIG.STORAGE_ENTRY_META)  || 'null');

      if (!mstMeta || !detMeta) {
        throw new Error('Missing save configuration. Please refresh and try again.');
      }

      const cleanedRows = detailRows.map(({ id, ...rest }) => rest);
      const body = {
        PrmStrMstRBName:          PO_CONFIG.RB_MASTER,
        prmStrMstJSON:            JSON.stringify([headerValues]),
        prmstrMasterSaveProcName: mstMeta?.SaveProcName,
        prmstrDetailSaveProcName: detMeta?.SaveProcName,
        PrmStrDetRBName:          PO_CONFIG.RB_DETAIL,
        prmStrDetJSON:            JSON.stringify(cleanedRows),
        GenIDNumber:              genIDNumber,
        p_ErrCode:                -1,
        p_ErrMsg:                 '',
      };

      const result = await axios.post(
        `${baseURL}${ENDPOINTS.RB_MASTER_DETAIL_FORM_SAVE}`,
        body,
        {
          timeout: API_TIMEOUT,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        },
      );

      console.log('%c[PO] Save result:', 'color:#22c55e;font-weight:600', result.data);
      return result.data;
    } catch (err) {
      console.error('[PO] saveTxn failed:', err);
      setSaveError(err?.message || 'Save failed. Please try again.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [baseURL]);

  const clearPoTypes   = useCallback(() => setPoTypeOptions([]), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    // header
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    // dropdown options
    divisionOptions,
    poTypeOptions,
    supplierOptions,
    currencyOptions,
    existingPOs,
    // loaders
    isLoadingPoTypes,
    isLoadingSuppliers,
    isLoadingExistingPOs,
    // cascade / derive
    fetchPoTypes,
    clearPoTypes,
    fetchSupplierInfo,
    fetchExistingPOs,
    // detail grid
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    // save
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  };
}
