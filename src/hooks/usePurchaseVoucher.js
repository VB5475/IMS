// usePurchaseVoucher.js — Header meta, detail grid, and filter dropdowns for Purchase Voucher
// ──────────────────────────────────────────────────────────────────────────────────────────
// Mirrors usePurchaseOrder.js — same three-phase load pattern:
//
//   fetchHeaderMeta  → RB_PurPVMst → GetDetailColData + Division + Supplier (parallel)
//   fetchDetailMeta  → RB_PurPVDet → GetDetailColData (columns only)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Add New)
//
// PV-specific vs PO:
//   fetchPVTypes(divisionId)             — cascade: Division → PR Type
//   fetchCostCenters(divisionId, date)   — Cost Center dropdown
//   fetchCrDaysCriteria(...)             — Credit Days Criteria dropdown
//   No amend, no 3rd detail table (simpler than PO)

import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { PV_CONFIG } from "../pages/purchase-voucher/constants";
import { fetchDropdownOptions, buildGridColumns, isTruthyApiFlag, isLockOnEditModeCol } from "../utils/gridUtils";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || PV_CONFIG.CONFIG_YEAR_ID,
    Number(loginId) || getUserSession().loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(idNumber) || 0,
  ].join(",");
}

function mapMasterRowToHeaderValues(master, params) {
  const toDateInput = (value) => {
    if (!value) return "";
    if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  return {
    TranCode:              master.TranCode != null ? String(master.TranCode) : "",
    TranDate:              toDateInput(master.TranDate),
    DivisionID:            master.DivisionID != null ? Number(master.DivisionID) : 0,
    ConfigID:              master.ConfigID != null ? Number(master.ConfigID) : 0,
    BasedOnID:             master.BasedOnID != null ? String(master.BasedOnID) : "2",
    SupplierID:            master.SupplierID != null ? Number(master.SupplierID) : 0,
    CurrencyID:            master.CurrencyID != null ? Number(master.CurrencyID) : 0,
    CurrencyRate:          master.CurrencyRate != null ? Number(master.CurrencyRate) : 0,
    CreditDays:            master.CreditDays != null ? Number(master.CreditDays) : 0,
    BillNo:                master.BillNo ?? "",
    BillDate:              toDateInput(master.BillDate) || null,
    CostCenterID:          master.CostCenterID != null ? Number(master.CostCenterID) : 0,
    CreditDaysCriteriaID:  master.CreditDaysCriteriaID != null ? Number(master.CreditDaysCriteriaID) : 0,
    CreditStartDate:       toDateInput(master.CreditStartDate) || null,
    Narration:             master.Narration ?? "",
    Remarks:               master.Remarks ?? "",
    TranMstGenID:          master.TranMstGenID != null ? Number(master.TranMstGenID) : 0,
    CompanyID:             Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID:                Number(master.Year_ID ?? params.yearId) || PV_CONFIG.CONFIG_YEAR_ID,
    LoginID:               Number(master.LoginID ?? params.loginId) || getUserSession().loginId,
    SessionID:             Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    IDNumber:              Number(master.IDNumber ?? master.PVID ?? params.idNumber) || 0,
    UserID:                getUserSession().userId,
    CompUniqueKey:         master.CompUniqueKey ?? master.IDNumber ?? master.PVID ?? params.idNumber ?? 0,
    FuncCode:              master.FuncCode ?? PV_CONFIG.RB_MASTER,
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
    if (isTruthyApiFlag(col.IsEventReq) || isTruthyApiFlag(col.IsEventCol)) set.add(col.ColName);
  });
  if (set.size === 0) fallbackKeys.forEach((k) => set.add(k));
  return set;
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: PV_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmRBCode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const tableRow = metaData?.Table?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);
  const meta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
  localStorage.setItem(storageKey, JSON.stringify(meta));
  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: DEFAULT_LOGIN_ID,
  });
  return { meta, apiColumns: colData?.Links || [] };
}

export function usePurchaseVoucher(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Header (master) state ───────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [pvTypeOptions, setPvTypeOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [costCenterOptions, setCostCenterOptions] = useState([]);
  const [crDaysCriteriaOptions, setCrDaysCriteriaOptions] = useState([]);

  const [isLoadingPvTypes, setIsLoadingPvTypes] = useState(false);

  // ── Detail grid state ───────────────────────────────────────────────
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);
  const supplierCurrencyMapRef = useRef({});

  // ── fetchPVTypes — cascade from Division ───────────────────────────
  const fetchPVTypes = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setPvTypeOptions([]); return []; }
    setIsLoadingPvTypes(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PV_CONFIG.SP_PV_TYPES,
        JSon: JSON.stringify([{
          PrmCompanyId: DEFAULT_COMPANY_ID,
          PrmDivisionId: Number(divisionId),
          PrmYearId: PV_CONFIG.CONFIG_YEAR_ID,
          PrmUserId: DEFAULT_LOGIN_ID,
          PrmFormTag: PV_CONFIG.FORM_TAG,
          PrmRefType: "",
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res?.Table || []).map((r) => ({ value: String(r.ConfigurationId), label: r.Name }));
      setPvTypeOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PV] PV Type fetch failed:", err);
      setPvTypeOptions([]);
      return [];
    } finally {
      setIsLoadingPvTypes(false);
    }
  }, [get]);

  // ── fetchSupplierInfo — derive CurrencyID, CurrencyRate, CrDays ────
  const fetchSupplierInfo = useCallback(async (supplierId) => {
    if (!supplierId || supplierId === "0") return null;
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 1,
        ObjName: PV_CONFIG.SP_SUPPLIER_INFO,
        JSon: JSON.stringify([{ PrmSupplierID: Number(supplierId) }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const row = res?.Table?.[0];
      if (!row) return null;
      return { CurrencyID: row.CurrencyID ?? 0, CurrencyRate: row.CurrencyRate ?? 0, CrDays: row.CrDays ?? 0 };
    } catch (err) {
      console.warn("[PV] Supplier info fetch failed:", err);
      return null;
    }
  }, [get]);

  // ── fetchCostCenters ────────────────────────────────────────────────
  const fetchCostCenters = useCallback(async (divisionId, tranDate) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PV_CONFIG.SP_COST_CENTER,
        JSon: JSON.stringify([{
          PrmDivisionId: Number(divisionId) || 0,
          PrmTranDate: tranDate || "",
          PrmAccountId: 0,
          PrmLoginId: DEFAULT_LOGIN_ID,
          PrmLangCode: 1,
          PrmModuleCode: "PU",
          PrmIsMultiDiv: 0,
          PrmYearId: PV_CONFIG.CONFIG_YEAR_ID,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.CostCenterID ?? r.AccountId),
        label: r.CostCenterName ?? r.AccountName ?? String(r.CostCenterID),
      }));
      setCostCenterOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PV] Cost Center fetch failed:", err);
      setCostCenterOptions([]);
      return [];
    }
  }, [get]);

  // ── fetchCrDaysCriteria ─────────────────────────────────────────────
  const fetchCrDaysCriteria = useCallback(async (divisionId, tranDate, configId, supplierId) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PV_CONFIG.SP_CR_DAYS_CRITERIA,
        JSon: JSON.stringify([{
          prmDivisionId: Number(divisionId) || 0,
          prmYearId: PV_CONFIG.CONFIG_YEAR_ID,
          prmLoginId: DEFAULT_LOGIN_ID,
          prmTranDate: tranDate || "",
          prmConfigID: Number(configId) || 0,
          prmSupplierID: Number(supplierId) || 0,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res?.Table || []).map((r) => ({
        value: String(r.IDNumber ?? r.ID),
        label: r.Criteria ?? String(r.ID),
      }));
      setCrDaysCriteriaOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PV] Cr Days Criteria fetch failed:", err);
      setCrDaysCriteriaOptions([]);
      return [];
    }
  }, [get]);

  // ── fetchHeaderMeta ─────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PV_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: PV_CONFIG.RB_MASTER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No PV header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(PV_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      setHeaderColumns(colData?.Links || []);
      console.log("%c[PV] Header columns received:", "color:#8b5cf6;font-weight:600", (colData?.Links || []).length);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setSupplierOptions([]);
        return;
      }

      const [divisionData, supplierData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PV_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmUserID: DEFAULT_LOGIN_ID,
            prmCompanyID: DEFAULT_COMPANY_ID,
            prmYearID: PV_CONFIG.DIVISION_YEAR_ID,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[PV] Division fetch failed:", err); return null; }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PV_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([{
            PrmDivisionId: 0,
            PrmLoginId: DEFAULT_LOGIN_ID,
            PrmYearId: PV_CONFIG.CONFIG_YEAR_ID,
            PrmPartyType: PV_CONFIG.SUPPLIER_PARTY_TYPE,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[PV] Supplier fetch failed:", err); return null; }),
      ]);

      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName }))
      );

      const supplierRows = supplierData?.Table || [];
      setSupplierOptions(
        supplierRows.map((r) => ({ value: String(r.SupplierID ?? r.PartyID), label: r.SupplierName ?? r.PartyName }))
      );
      supplierCurrencyMapRef.current = {};
      supplierRows.forEach((r) => {
        const sid = String(r.SupplierID ?? r.PartyID);
        supplierCurrencyMapRef.current[sid] = {
          CurrencyID:   r.CurrencyID ?? 0,
          CurrencyName: r.CurrencyName ?? "",
          CurrencyRate: r.CurrencyRate ?? 0,
          CrDays:       r.CrDays ?? 0,
        };
      });
    } catch (err) {
      console.error("[PV] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load PV header configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchDetailMeta ─────────────────────────────────────────────────
  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(get, PV_CONFIG.RB_DETAIL, PV_CONFIG.STORAGE_ENTRY_META);
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;

      const evtSet = buildEventColumnSet(apiColumns, ["TranQty", "BaseQty", "TranRate", "BaseRate", "UnitConvRate", "DiscPerc", "GSTPerc"]);
      ["TranQty", "BaseQty", "TranRate", "BaseRate", "UnitConvRate", "DiscPerc", "GSTPerc"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);

      setAllColumns(apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null })));
      console.log("%c[PV] Detail columns received:", "color:#6366f1;font-weight:600", apiColumns.length);
    } catch (err) {
      console.error("[PV] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load PV item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns ────────────────────────────────────────────────
  const fetchGridColumns = useCallback(async (divisionID = 0, editOpts = false) => {
    const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
    const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

    const apiColumns = rawDetailColumnsRef.current;
    const meta = rawDetailRbMetaRef.current;
    if (!apiColumns.length || !meta) {
      console.warn("[PV] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode: PV_CONFIG.RB_DETAIL,
        divisionID: Number(divisionID) || 0,
        existingRecordEdit,
        rowData: masterRow,
        fetchUnlockedDropdowns,
      });
      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, { filterable: false, allEditable: true, existingRecordEdit });
      setColumns(gridColumns);
      console.log("%c[PV] Grid columns built:", "color:#22c55e;font-weight:600", gridColumns.length);
      return gridColumns;
    } catch (err) {
      console.error("[PV] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  // ── fireCellEvent ───────────────────────────────────────────────────
  const fireCellEvent = useCallback(async (colName, rowData, headerValues) => {
    try {
      const { id, ...newRowData } = rowData;
      const result = await get(ENDPOINTS.FN_TBL_RB_GRID_EVENT, {
        GridEventFuncName: PV_CONFIG.SP_GRID_EVENT,
        EventColName: colName,
        DetJSON: JSON.stringify([newRowData]),
        MstJSon: JSON.stringify([headerValues]),
      });
      console.log("%c[PV] CellEvent response:", "color:#f59e0b;font-weight:600", { col: colName, result });
      return result;
    } catch (err) {
      console.error("[PV] fireCellEvent failed:", err);
      return null;
    }
  }, [get]);

  // ── seedOptionsFromMaster ───────────────────────────────────────────
  const seedOptionsFromMaster = useCallback((master) => {
    if (master.DivisionID != null && master.DivisionName) {
      setDivisionOptions([{ value: String(master.DivisionID), label: master.DivisionName }]);
    }
    if (master.SupplierID != null && master.SupplierName) {
      setSupplierOptions([{ value: String(master.SupplierID), label: master.SupplierName }]);
      const sid = String(master.SupplierID);
      supplierCurrencyMapRef.current[sid] = {
        CurrencyID:   master.CurrencyID ?? 0,
        CurrencyName: master.CurrencyName ?? master.Currency ?? "",
        CurrencyRate: master.CurrencyRate ?? 0,
        CrDays:       master.CreditDays ?? 0,
      };
    }
    if (master.ConfigID != null && master.ConfigName) {
      setPvTypeOptions([{ value: String(master.ConfigID), label: master.ConfigName }]);
    }
    if (master.CostCenterID != null && master.CostCenterName) {
      setCostCenterOptions([{ value: String(master.CostCenterID), label: master.CostCenterName }]);
    }
    if (master.CreditDaysCriteriaID != null && master.CreditDaysCriteriaName) {
      setCrDaysCriteriaOptions([{ value: String(master.CreditDaysCriteriaID), label: master.CreditDaysCriteriaName }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns ────────────────────────────────────
  const fetchUnlockedHeaderDropdowns = useCallback(async (divisionId, tranDate, configId, supplierId) => {
    if (!headerColumns.length) return;
    const isEditable = (c) => isTruthyApiFlag(c.IsEditAllow) && !isLockOnEditModeCol(c);
    const needsDivision = headerColumns.some((c) => c.ColName === "DivisionID" && isEditable(c));
    const needsSupplier  = headerColumns.some((c) => c.ColName === "SupplierID" && isEditable(c));
    const needsConfig    = headerColumns.some((c) => c.ColName === "ConfigID" && isEditable(c));
    const needsCostCenter = headerColumns.some((c) => c.ColName === "CostCenterID" && isEditable(c));
    const needsCrCriteria = headerColumns.some((c) => c.ColName === "CreditDaysCriteriaID" && isEditable(c));

    const tasks = [];
    if (needsDivision || needsSupplier) {
      tasks.push(
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PV_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{ prmUserID: DEFAULT_LOGIN_ID, prmCompanyID: DEFAULT_COMPANY_ID, prmYearID: PV_CONFIG.DIVISION_YEAR_ID }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).then((res) => setDivisionOptions((res?.Table || []).map((r) => ({ value: String(r.DivisionID), label: r.DivisionName })))).catch(() => {}),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PV_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([{ PrmDivisionId: 0, PrmLoginId: DEFAULT_LOGIN_ID, PrmYearId: PV_CONFIG.CONFIG_YEAR_ID, PrmPartyType: PV_CONFIG.SUPPLIER_PARTY_TYPE }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).then((res) => {
          const rows = res?.Table || [];
          setSupplierOptions(rows.map((r) => ({ value: String(r.SupplierID ?? r.PartyID), label: r.SupplierName ?? r.PartyName })));
          supplierCurrencyMapRef.current = {};
          rows.forEach((r) => {
            supplierCurrencyMapRef.current[String(r.SupplierID ?? r.PartyID)] = {
              CurrencyID: r.CurrencyID ?? 0, CurrencyName: r.CurrencyName ?? "", CurrencyRate: r.CurrencyRate ?? 0, CrDays: r.CrDays ?? 0,
            };
          });
        }).catch(() => {})
      );
    }
    if (needsConfig && divisionId) tasks.push(fetchPVTypes(divisionId));
    if (needsCostCenter) tasks.push(fetchCostCenters(divisionId, tranDate));
    if (needsCrCriteria) tasks.push(fetchCrDaysCriteria(divisionId, tranDate, configId, supplierId));
    await Promise.all(tasks);
  }, [headerColumns, get, fetchPVTypes, fetchCostCenters, fetchCrDaysCriteria]);

  // ── fetchEditRecord ─────────────────────────────────────────────────
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: PV_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: PV_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: PV_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode: PV_CONFIG.RB_DETAIL,
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

  const clearPvTypes  = useCallback(() => setPvTypeOptions([]), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);
  const getSupplierCurrency = useCallback((supplierId) => supplierCurrencyMapRef.current[String(supplierId)] ?? null, []);

  return {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, pvTypeOptions, supplierOptions, currencyOptions,
    costCenterOptions, crDaysCriteriaOptions,
    isLoadingPvTypes,
    fetchPVTypes, clearPvTypes,
    fetchSupplierInfo, getSupplierCurrency,
    fetchCostCenters, fetchCrDaysCriteria,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fireCellEvent,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    saveTxn: null,
    isSaving, saveError, clearSaveError,
  };
}
