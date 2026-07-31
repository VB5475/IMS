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
//   No amend, no 3rd detail table (simpler than PO)

import { useState, useCallback, useRef } from "react";
import { useApi, getApiClient } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { PV_CONFIG } from "../pages/purchase-voucher/constants";
import { fetchAndBuildGridColumns, isTruthyApiFlag, isLockOnEditModeCol } from "../utils/gridUtils";
import { isNumericColDataType, buildDetJSON } from "../utils/columnValidation";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || getUserSession().companyId,
    Number(yearId) || getUserSession().yearId,
    Number(loginId) || getUserSession().loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(idNumber) || 0,
  ].join(",");
}

function mapMasterRowToHeaderValues(master) {
  const toDateInput = (value) => {
    if (!value) return "";
    if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  return {
    ...master,
    trandate:       toDateInput(master.trandate),
    billdate:       toDateInput(master.billdate) || null,
    creditstartdate: toDateInput(master.creditstartdate) || null,
    yearid:    getUserSession().yearId,
    funccode:  PV_CONFIG.RB_MASTER,
    loginid:   getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
}

function mapDetailRowsToGridRows(rows) {
  return (rows || []).map((row, index) => ({
    ...row,
    id: String(row.compuniquekey ?? row.idnumber ?? row.masterid ?? `edit_${index}`),
  }));
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.iseventreq) || isTruthyApiFlag(col.iseventcol)) set.add(col.colname);
  });
  if (set.size === 0) fallbackKeys.forEach((k) => set.add(k));
  return set;
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: PV_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmrbcode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const tableRow = metaData?.[0];
  if (!tableRow || !tableRow.rbid) {
    throw new Error(tableRow?.ErrMsg || `No RB metadata returned for ${rbCode}.`);
  }
  const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
  localStorage.setItem(storageKey, JSON.stringify(meta));
  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: getUserSession().loginId,
  });
  return { meta, apiColumns: colData || [] };
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
  const [locationOptions, setLocationOptions] = useState([]);

  const [isLoadingPvTypes, setIsLoadingPvTypes] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // ── Detail grid state ───────────────────────────────────────────────
  const [columns, setColumns] = useState([]);
  const columnsRef = useRef([]);
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
          prmcompanyid: getUserSession().companyId,
          prmdivisionid: Number(divisionId),
          prmyearid: getUserSession().yearId,
          prmuserid: getUserSession().loginId,
          prmformtag: PV_CONFIG.FORM_TAG,
          prmreftype: "",
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({ value: String(r.configurationid), label: r.name }));
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
        JSon: JSON.stringify([{ prmsupplierid: Number(supplierId) }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const row = res?.[0];
      if (!row) return null;
      return { CurrencyID: row.currencyid ?? 0, CurrencyName: row.currencyname ?? "", CurrencyRate: row.currencyrate ?? 0, CrDays: row.crdays ?? 0 };
    } catch (err) {
      console.warn("[PV] Supplier info fetch failed:", err);
      return null;
    }
  }, [get]);

  // ── fetchLocationOptions — cascade from Division ───────────────────
  // Division-wise Location — same SP + cascade contract as GRN/Purchase Indent's fetchLocations.
  const fetchLocationOptions = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setLocationOptions([]); return []; }
    setIsLoadingLocations(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PV_CONFIG.SP_LOCATION,
        JSon: JSON.stringify([{
          prmcompanyid: getUserSession().companyId,
          prmdivisionid: Number(divisionId),
          prmlocationtypeid: 1,
          prmloginid: getUserSession().loginId,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.locationid ?? r.locid),
        label: r.locationname ?? r.locname ?? r.location ?? String(r.locationid ?? r.locid),
      }));
      setLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PV] Location fetch failed:", err);
      setLocationOptions([]);
      return [];
    } finally {
      setIsLoadingLocations(false);
    }
  }, [get]);

  const clearLocations = useCallback(() => setLocationOptions([]), []);

  // ── fetchCostCenters ────────────────────────────────────────────────
  const fetchCostCenters = useCallback(async (divisionId, tranDate) => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PV_CONFIG.SP_COST_CENTER,
        JSon: JSON.stringify([{
          prmdivisionid: Number(divisionId) || 0,
          prmtrandate: tranDate || "",
          prmaccountid: 0,
          prmloginid: getUserSession().loginId,
          prmlangcode: 1,
          prmmodulecode: "PU",
          prmismultidiv: 0,
          prmyearid: getUserSession().yearId,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.costcenterid ?? r.costcenterid ?? r.accountid),
        label: r.costcenterac,
      }));
      setCostCenterOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PV] Cost Center fetch failed:", err);
      setCostCenterOptions([]);
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
        JSon: JSON.stringify([{ prmrbcode: PV_CONFIG.RB_MASTER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No PV header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(PV_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      console.log("%c[PV] Header columns received:", "color:#8b5cf6;font-weight:600", (colData || []).length);

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
            prmuserid: getUserSession().loginId,
            prmcompanyid: getUserSession().companyId,
            prmyearid: getUserSession().yearId,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[PV] Division fetch failed:", err); return null; }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PV_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([{
            prmdivisionid: 0,
            prmloginid: getUserSession().loginId,
            prmyearid: getUserSession().yearId,
            prmpartytype: PV_CONFIG.SUPPLIER_PARTY_TYPE,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[PV] Supplier fetch failed:", err); return null; }),
      ]);

      setDivisionOptions(
        (divisionData || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname }))
      );

      const supplierRows = supplierData || [];
      setSupplierOptions(
        supplierRows.map((r) => ({ value: String(r.supplierid ?? r.partyid), label: r.suppliername ?? r.partyname }))
      );
      supplierCurrencyMapRef.current = {};
      supplierRows.forEach((r) => {
        const sid = String(r.supplierid ?? r.partyid);
        supplierCurrencyMapRef.current[sid] = {
          CurrencyID:   r.currencyid ?? 0,
          CurrencyName: r.currencyname ?? "",
          CurrencyRate: r.currencyrate ?? 0,
          CrDays:       r.crdays ?? 0,
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

      const evtSet = buildEventColumnSet(apiColumns, ["tranqty", "baseqty", "tranrate", "baserate", "unitconv", "discperc", "expense", "gstperc"]);
      // Force-add amount-driving columns regardless of API iseventreq flags —
      // "expense" is a real, RB-editable field (confirmed live: rb_purpvdet,
      // ctrltype textbox) that was missing here, so typing a value directly
      // into it and leaving the cell never recalculated CGST/SGST/IGST/
      // Taxable Value/Net Base Amount (client-confirmed gap, 2026-07-24).
      ["tranqty", "baseqty", "tranrate", "baserate", "unitconv", "discperc", "expense", "gstperc"].forEach((k) => evtSet.add(k));
      // Put To Use must never call the qty/rate recalc SP (fn_tbl_rb_purpvdet_event) —
      // it's a pure local flag with no bearing on tax/amount calculation (and,
      // since 2026-07-30, no longer affects the summary panel's totals either —
      // see PV_SUMMARY_FIELDS in constants.js). Explicit exclusion guards
      // against RB later flipping iseventreq/iseventcol on puttouse and
      // silently re-introducing a recalc call for it.
      evtSet.delete("puttouse");
      setEventColumns(evtSet);

      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
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
    const apiColumns = rawDetailColumnsRef.current;
    const meta = rawDetailRbMetaRef.current;
    if (!apiColumns.length || !meta) {
      console.warn("[PV] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      const gridColumns = await fetchAndBuildGridColumns(get, {
        apiColumns,
        rbId: meta.RBID,
        funcCode: PV_CONFIG.RB_DETAIL,
        divisionID,
        editOpts,
        currentColumns: columnsRef.current,
      });
      columnsRef.current = gridColumns;
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
      const { id, ...rawRowData } = rowData;
      const colTypeMap = Object.fromEntries(allColumns.map((c) => [c.key, c.colDataType]));
      const newRowData = Object.fromEntries(
        Object.entries(rawRowData).map(([k, v]) => {
          if (isNumericColDataType(colTypeMap[k]) && v !== null && v !== undefined && v !== "")
            return [k, Number(v)];
          return [k, v];
        })
      );
      const result = await getApiClient(API_BASE_URL_IMS).post(ENDPOINTS.TRAN_FORM_EVENT, {
        prmobjname: PV_CONFIG.SP_GRID_EVENT,
        prmmyeventcol: colName,
        prmdetjson: buildDetJSON([newRowData], colTypeMap),
        prmmstjson: JSON.stringify([headerValues]),
      });
      console.log("%c[PV] CellEvent response:", "color:#f59e0b;font-weight:600", { col: colName, result });
      return result;
    } catch (err) {
      console.error("[PV] fireCellEvent failed:", err);
      return null;
    }
  }, [allColumns]);

  // ── seedOptionsFromMaster ───────────────────────────────────────────
  const seedOptionsFromMaster = useCallback((master) => {
    if (master.divisionid != null && master.divisionname) {
      setDivisionOptions([{ value: String(master.divisionid), label: master.divisionname }]);
    }
    if (master.supplierid != null && master.suppliername) {
      setSupplierOptions([{ value: String(master.supplierid), label: master.suppliername }]);
      const sid = String(master.supplierid);
      supplierCurrencyMapRef.current[sid] = {
        CurrencyID:   master.currencyid ?? 0,
        CurrencyName: master.currencyname ?? master.currency ?? "",
        CurrencyRate: master.currencyrate ?? 0,
      };
    }
    if (master.configid != null && master.configname) {
      setPvTypeOptions([{ value: String(master.configid), label: master.configname }]);
    }
    if (master.costcenterid != null && master.costcentername) {
      setCostCenterOptions([{ value: String(master.costcenterid), label: master.costcentername }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns ────────────────────────────────────
  const fetchUnlockedHeaderDropdowns = useCallback(async (divisionId, tranDate, configId, supplierId) => {
    if (!headerColumns.length) return;
    const isEditable = (c) => isTruthyApiFlag(c.iseditallow) && !isLockOnEditModeCol(c);
    const needsDivision = headerColumns.some((c) => c.colname === "divisionid" && isEditable(c));
    const needsSupplier  = headerColumns.some((c) => c.colname === "supplierid" && isEditable(c));
    const needsConfig    = headerColumns.some((c) => c.colname === "configid" && isEditable(c));
    const needsCostCenter = headerColumns.some((c) => c.colname === "costcenterid" && isEditable(c));

    const tasks = [];
    if (needsDivision || needsSupplier) {
      tasks.push(
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PV_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{ prmuserid: getUserSession().loginId, prmcompanyid: getUserSession().companyId, prmyearid: getUserSession().yearId }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).then((res) => setDivisionOptions((res || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname })))).catch(() => {}),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PV_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([{ prmdivisionid: 0, prmloginid: getUserSession().loginId, prmyearid: getUserSession().yearId, prmpartytype: PV_CONFIG.SUPPLIER_PARTY_TYPE }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).then((res) => {
          const rows = res || [];
          setSupplierOptions(rows.map((r) => ({ value: String(r.supplierid ?? r.partyid), label: r.suppliername ?? r.partyname })));
          supplierCurrencyMapRef.current = {};
          rows.forEach((r) => {
            supplierCurrencyMapRef.current[String(r.supplierid ?? r.partyid)] = {
              CurrencyID: r.currencyid ?? 0, CurrencyName: r.currencyname ?? "", CurrencyRate: r.currencyrate ?? 0, CrDays: r.crdays ?? 0,
            };
          });
        }).catch(() => {})
      );
    }
    if (needsConfig && divisionId) tasks.push(fetchPVTypes(divisionId));
    if (needsCostCenter) tasks.push(fetchCostCenters(divisionId, tranDate));
    await Promise.all(tasks);
  }, [headerColumns, get, fetchPVTypes, fetchCostCenters]);

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
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? mapMasterRowToHeaderValues(master) : null,
      details: mapDetailRowsToGridRows(detRes || []),
    };
  }, [get]);

  const clearPvTypes  = useCallback(() => setPvTypeOptions([]), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);
  const getSupplierCurrency = useCallback((supplierId) => supplierCurrencyMapRef.current[String(supplierId)] ?? null, []);

  return {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, pvTypeOptions, supplierOptions, currencyOptions,
    costCenterOptions,
    locationOptions, isLoadingLocations,
    fetchLocationOptions, clearLocations,
    isLoadingPvTypes,
    fetchPVTypes, clearPvTypes,
    fetchSupplierInfo, getSupplierCurrency,
    fetchCostCenters,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fireCellEvent,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    saveTxn: null,
    isSaving, saveError, clearSaveError,
  };
}
