// usePurchaseQuotation.js — Header meta, detail grid, and filter dropdowns for Purchase Quotation
// ─────────────────────────────────────────────────────────────────────
// On mount:
//   fetchHeaderMeta  → RB_PurQtnMst → GetDetailColData + Division + Department
//   fetchDetailMeta  → RB_PurQtnDet → GetDetailColData (columns only, no dropdowns)
//
// On first "Select Item":
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns
//
// Cascading filters (page onFilterChange):
//   Division → Quotation Type + Supplier

import { useState, useCallback, useRef } from 'react';
import { useApi } from '../api/useApi';
import { getUserSession } from '../session/userSession';
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from '../api/constants';
import { QTN_CONFIG } from '../pages/purchase-quotation/constants';
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
} from '../utils/gridUtils';

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || QTN_CONFIG.CONFIG_YEAR_ID,
    Number(loginId) || getUserSession().loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(idNumber) || 0,
  ].join(',');
}

function mapMasterRowToHeaderValues(master, params) {
  const toDateInput = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && value.includes('T')) return value.split('T')[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  return {
    TranCode: master.TranCode != null ? String(master.TranCode) : '',
    TranDate: toDateInput(master.TranDate),
    DivisionID: master.DivisionID != null ? Number(master.DivisionID) : 0,
    ConfigID: master.ConfigID != null ? Number(master.ConfigID) : 0,
    ExpiryDate: toDateInput(master.ExpiryDate) || null,
    DeptID: master.DeptID != null ? Number(master.DeptID) : 0,
    SupplierID: master.SupplierID != null ? Number(master.SupplierID) : 0,
    CurrencyID: master.CurrencyID ?? '',
    CurrencyRate: master.CurrencyRate ?? '',
    BasedOnID: master.BasedOnID != null ? String(master.BasedOnID) : '0',
    SupplierQuotNo: master.SupplierQuotNo ?? '',
    SupplierQuotDate: toDateInput(master.SupplierQuotDate) || null,
    ContactPerson: master.ContactPerson ?? '',
    Remarks: master.Remarks ?? '',
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(params.yearId) || QTN_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(params.loginId) || getUserSession().loginId,
    SessionID: Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    IDNumber: Number(master.IDNumber ?? params.idNumber) || 0,
    UserID: getUserSession().userId,
  };
}

function mapDetailRowsToGridRows(rows) {
  return (rows || []).map((row, index) => ({
    ...row,
    id: String(row.CompUniqueKey ?? row.IDNumber ?? row.MasterID ?? `edit_${index}`),
  }));
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
async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: OBJ_TYPE.FUNCTION,
    ObjName: QTN_CONFIG.SP_RB_META,
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
    prmLoginID: getUserSession().loginId,
  });
  const apiColumns = colData?.Links || [];
  return { meta, apiColumns };
}

export function usePurchaseQuotation(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Header (master) state ─────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [quotationTypeOptions, setQuotationTypeOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const supplierRowsRef = useRef(new Map());
  const [isLoadingQuotationTypes, setIsLoadingQuotationTypes] = useState(false);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);

  // ── Detail grid state ─────────────────────────────────────────────
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const fetchQuotationTypes = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === '0') {
      setQuotationTypeOptions([]);
      return [];
    }

    setIsLoadingQuotationTypes(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: QTN_CONFIG.SP_QUOTATION_TYPES,
        JSon: JSON.stringify([{
          PrmCompanyId: DEFAULT_COMPANY_ID,
          PrmDivisionId: Number(divisionId),
          PrmYearId: QTN_CONFIG.CONFIG_YEAR_ID,
          PrmUserId: getUserSession().loginId,
          PrmFormTag: QTN_CONFIG.FORM_TAG,
          PrmRefType: '',
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.ConfigurationId),
        label: r.Name,
      }));
      setQuotationTypeOptions(opts);
      return opts;
    } catch (err) {
      console.warn('[PQ] Quotation Type fetch failed:', err);
      setQuotationTypeOptions([]);
      return [];
    } finally {
      setIsLoadingQuotationTypes(false);
    }
  }, [get]);

  const fetchSupplierOptions = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === '0') {
      supplierRowsRef.current = new Map();
      setSupplierOptions([]);
      return [];
    }

    setIsLoadingSuppliers(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: QTN_CONFIG.SUPPLIER_SP,
        JSon: JSON.stringify([{
          PrmDivisionId: Number(divisionId),
          PrmLoginId: getUserSession().loginId,
          PrmYearId: QTN_CONFIG.CONFIG_YEAR_ID,
          PrmPartyType: QTN_CONFIG.SUPPLIER_PARTY_TYPE,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const rows = res?.Table || [];
      supplierRowsRef.current = new Map(
        rows.map((r) => [String(Math.round(Number(r.SupplierID))), r]),
      );
      const opts = rows.map((r) => ({
        value: String(Math.round(Number(r.SupplierID))),
        label: r.SupplierName,
      }));
      setSupplierOptions(opts);
      return opts;
    } catch (err) {
      console.warn('[PQ] Supplier fetch failed:', err);
      supplierRowsRef.current = new Map();
      setSupplierOptions([]);
      return [];
    } finally {
      setIsLoadingSuppliers(false);
    }
  }, [get]);

  const getSupplierRow = useCallback((supplierId) => {
    if (supplierId == null || supplierId === '' || supplierId === '0') return null;
    return supplierRowsRef.current.get(String(Math.round(Number(supplierId)))) ?? null;
  }, []);

  const fetchDivisionOptions = useCallback(async () => {
    try {
      const divisionData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: QTN_CONFIG.SP_DIVISIONS,
        JSon: JSON.stringify([{
          prmUserID: getUserSession().loginId,
          prmCompanyID: DEFAULT_COMPANY_ID,
          prmYearID: QTN_CONFIG.DIVISION_YEAR_ID,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({
          value: String(r.DivisionID),
          label: r.DivisionName,
        })),
      );
    } catch (err) {
      console.warn('[PQ] Division fetch failed:', err);
      setDivisionOptions([]);
    }
  }, [get]);

  const fetchDepartmentOptions = useCallback(async () => {
    try {
      const departmentData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.PROCEDURE,
        ObjName: QTN_CONFIG.SP_DEPARTMENTS,
        JSon: JSON.stringify([{ PrmDeptID: 0 }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      setDepartmentOptions(
        (departmentData?.Table || []).map((r) => ({
          value: String(r.DepartmentID),
          label: r.DepartmentName,
        })),
      );
    } catch (err) {
      console.warn('[PQ] Department fetch failed:', err);
      setDepartmentOptions([]);
    }
  }, [get]);

  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);

    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: QTN_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: QTN_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: '',
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error('No Quotation header RB metadata returned from server.');

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      setHeaderRbMeta(hdrMeta);
      localStorage.setItem(QTN_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const apiColumns = colData?.Links || [];
      setHeaderColumns(apiColumns);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setDepartmentOptions([]);
        return apiColumns;
      }

      await Promise.all([
        fetchDivisionOptions(),
        fetchDepartmentOptions(),
      ]);

      return apiColumns;
    } catch (err) {
      console.error('[PQ] fetchHeaderMeta failed:', err);
      setHeaderError(err?.message || 'Failed to load header configuration.');
      return [];
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchDivisionOptions, fetchDepartmentOptions]);

  /**
   * Edit flow — when user enters edit mode, reload list APIs only for header
   * dropdowns where IsLockOnEditModeAllow is false.
   */
  const fetchUnlockedHeaderDropdowns = useCallback(async (divisionId) => {
    if (!headerColumns.length) return;

    const needsDivision = headerColumns.some(
      (c) => c.ColName === 'DivisionID' && !isLockOnEditModeCol(c),
    );
    const needsDept = headerColumns.some(
      (c) => c.ColName === 'DeptID' && !isLockOnEditModeCol(c),
    );
    const needsConfig = headerColumns.some(
      (c) => c.ColName === 'ConfigID' && !isLockOnEditModeCol(c),
    );
    const needsSupplier = headerColumns.some(
      (c) => c.ColName === 'SupplierID' && !isLockOnEditModeCol(c),
    );

    const tasks = [];
    if (needsDivision) tasks.push(fetchDivisionOptions());
    if (needsDept) tasks.push(fetchDepartmentOptions());
    if (needsConfig && divisionId) tasks.push(fetchQuotationTypes(divisionId));
    if (needsSupplier && divisionId) tasks.push(fetchSupplierOptions(divisionId));
    await Promise.all(tasks);
  }, [headerColumns, fetchDivisionOptions, fetchDepartmentOptions, fetchQuotationTypes, fetchSupplierOptions]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);

    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get, QTN_CONFIG.RB_DETAIL, QTN_CONFIG.STORAGE_ENTRY_META,
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;
      setEventColumns(buildEventColumnSet(apiColumns, [
        'ItemID', 'TranQty', 'BaseQty', 'BaseRate', 'TranRate',
        'DiscPerc', 'Expense', 'GSTPerc', 'Rate', 'Qty', 'Amount',
      ]));
      setAllColumns(
        apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null })),
      );
    } catch (err) {
      console.error('[PQ] fetchDetailMeta failed:', err);
      setMetaError(err?.message || 'Failed to load item grid configuration.');
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(async (divisionID = 0, editOpts = false) => {
    const opts = typeof editOpts === 'boolean'
      ? { existingRecordEdit: editOpts }
      : (editOpts || {});
    const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

    const apiColumns = rawDetailColumnsRef.current;
    const meta = rawDetailRbMetaRef.current;

    if (!apiColumns.length || !meta) {
      console.warn('[PQ] fetchGridColumns called before fetchDetailMeta completed.');
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(
        get, apiColumns, meta.RBID,
        {
          funcCode: QTN_CONFIG.RB_DETAIL,
          divisionID: Number(divisionID) || 0,
          existingRecordEdit,
          rowData: masterRow,
          fetchUnlockedDropdowns,
        },
      );
      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable: false,
        allEditable: true,
        existingRecordEdit,
      });
      setColumns(gridColumns);
      return gridColumns;
    } catch (err) {
      console.error('[PQ] fetchGridColumns failed:', err);
      return [];
    }
  }, [get]);

  const fetchEditRecord = useCallback(async ({
    companyId, yearId, loginId, sessionId, idNumber,
  }) => {
    const prmParameters = buildMasterDataFillParams({
      companyId, yearId, loginId, sessionId, idNumber,
    });

    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: QTN_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: QTN_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: QTN_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode: QTN_CONFIG.RB_DETAIL,
      }),
    ]);

    const master = mstRes?.Links?.[0] ?? null;
    const params = { companyId, yearId, loginId, sessionId, idNumber };

    return {
      master,
      headerValues: master ? mapMasterRowToHeaderValues(master, params) : null,
      details: mapDetailRowsToGridRows(detRes?.Links || []),
    };
  }, [get]);

  const [isEventFiring, setIsEventFiring] = useState(false);

  const fireCellEvent = useCallback(async (colName, rowData, headerValues) => {
    setIsEventFiring(true);
    try {
      const { id, ...newRowData } = rowData;
      const result = await get(ENDPOINTS.FN_TBL_RB_GRID_EVENT, {
        GridEventFuncName: QTN_CONFIG.SP_GRID_EVENT,
        EventColName: colName,
        DetJSON: JSON.stringify([newRowData]),
        MstJSon: JSON.stringify([headerValues]),
      });
      return result;
    } catch (err) {
      console.error('[PQ] fireCellEvent failed:', err);
      return null;
    } finally {
      setIsEventFiring(false);
    }
  }, [get]);

  const clearQuotationTypes = useCallback(() => setQuotationTypeOptions([]), []);
  const clearSuppliers = useCallback(() => {
    supplierRowsRef.current = new Map();
    setSupplierOptions([]);
  }, []);

  return {
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchUnlockedHeaderDropdowns,
    divisionOptions,
    departmentOptions,
    quotationTypeOptions,
    supplierOptions,
    fetchQuotationTypes,
    fetchSupplierOptions,
    getSupplierRow,
    clearQuotationTypes,
    clearSuppliers,
    isLoadingQuotationTypes,
    isLoadingSuppliers,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fetchEditRecord,
    fireCellEvent,
    isEventFiring,
  };
}
