// usePurchaseReturn.js — Header meta, detail grid, and filter dropdowns for Purchase Return
// ──────────────────────────────────────────────────────────────────────────────────────────
// Mirrors usePurchaseVoucher.js — same three-phase load pattern:
//
//   fetchHeaderMeta  → RB_PurPRMst → GetDetailColData + Division + Supplier (parallel)
//   fetchDetailMeta  → RB_PurPRDet → GetDetailColData (columns only)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Select Item)
//
// PR-specific vs PV:
//   fetchReturnTypes(divisionId)                 — cascade: Division → PR Type (@prmformtag="PURRET")
//   fetchReturnAccountOptions(divisionId, deptId) — Return Account dropdown
//   fetchCityOptions()                            — Transporter City (no params)
//   fetchTransporterOptions(cityId)                — cascade: City → Transporter
//   fetchDestinationOptions(transporterId)         — cascade: Transporter → Destination
//   fetchDriverStateOptions()                      — Driver State (no params)
//   No Cost Center, no Location — those fields don't exist on this module's header.

import { useState, useCallback, useRef } from "react";
import { useApi, getApiClient } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { PR_CONFIG } from "../pages/purchase-return/constants";
import { fetchAndBuildGridColumns, isTruthyApiFlag, isLockOnEditModeCol } from "../utils/gridUtils";
import { isNumericColDataType, buildDetJSON } from "../utils/columnValidation";
import { isErrorOnlyRow } from "../utils/apiResponse";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || getUserSession().companyId,
    Number(yearId) || getUserSession().yearId,
    Number(loginId) || getUserSession().loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(idNumber) || 0,
  ].join(",");
}

function toDateInput(value) {
  if (!value) return "";
  if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function mapMasterRowToHeaderValues(master) {
  return {
    ...master,
    trandate: toDateInput(master.trandate),
    lrrrdt: toDateInput(master.lrrrdt) || null,
    yearid: getUserSession().yearId,
    funccode: PR_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
}

function mapDetailRowsToGridRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 1 && isErrorOnlyRow(list[0])) return [];
  return list.map((row, index) => ({
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

function mapTableToOptions(rows, valueKey, labelKey) {
  return (rows || []).map((r) => ({
    value: String(r[valueKey] ?? r.IDNumber ?? r.IdNumber ?? ""),
    label: String(r[labelKey] ?? r.Name ?? r[valueKey] ?? ""),
  }));
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: OBJ_TYPE.FUNCTION,
    ObjName: PR_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmrbcode: rbCode }]),
    p_ErrCode: -1, p_ErrMsg: "",
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

export function usePurchaseReturn(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Header (master) state ───────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [prTypeOptions, setPrTypeOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [returnAccountOptions, setReturnAccountOptions] = useState([]);
  const [transporterCityOptions, setTransporterCityOptions] = useState([]);
  const [transporterOptions, setTransporterOptions] = useState([]);
  const [transporterDestinationOptions, setTransporterDestinationOptions] = useState([]);
  const [driverStateOptions, setDriverStateOptions] = useState([]);

  const [isLoadingPrTypes, setIsLoadingPrTypes] = useState(false);
  const [isLoadingReturnAccounts, setIsLoadingReturnAccounts] = useState(false);
  const [isLoadingTransporterCities, setIsLoadingTransporterCities] = useState(false);
  const [isLoadingTransporters, setIsLoadingTransporters] = useState(false);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
  const [isLoadingDriverStates, setIsLoadingDriverStates] = useState(false);

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

  // ── fetchReturnTypes — cascade from Division ───────────────────────
  const fetchReturnTypes = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setPrTypeOptions([]); return []; }
    setIsLoadingPrTypes(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PR_CONFIG.SP_PR_TYPES,
        JSon: JSON.stringify([{
          prmcompanyid: getUserSession().companyId,
          prmdivisionid: Number(divisionId),
          prmyearid: getUserSession().yearId,
          prmuserid: getUserSession().loginId,
          prmformtag: PR_CONFIG.CONFIG_FORM_TAG,
          prmreftype: "",
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({ value: String(r.configurationid), label: r.name }));
      setPrTypeOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PR] PR Type fetch failed:", err);
      setPrTypeOptions([]);
      return [];
    } finally {
      setIsLoadingPrTypes(false);
    }
  }, [get]);

  // ── fetchSupplierInfo — derive CurrencyID/CurrencyRate for auto-fill ──
  const fetchSupplierInfo = useCallback(async (supplierId) => {
    if (!supplierId || supplierId === "0") return null;
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.PROCEDURE,
        ObjName: "fn_tbl_fetchsuppliercurrencyinfo",
        JSon: JSON.stringify([{ prmsupplierid: Number(supplierId) }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const row = res?.[0];
      if (!row) return null;
      return { CurrencyID: row.currencyid ?? 0, CurrencyName: row.currencyname ?? "", CurrencyRate: row.currencyrate ?? 0 };
    } catch (err) {
      console.warn("[PR] Supplier info fetch failed:", err);
      return null;
    }
  }, [get]);

  // ── fetchReturnAccountOptions ───────────────────────────────────────
  // fn_tbl_fetchexpenseacdetail(@prmdivisionid, @prmloginid, @prmdeptid,
  // @prmrbcode) — no Department field exists on this module's header, so
  // prmdeptid is sent as 0. ⚠️ CONFIRM with DBA (see constants.js note).
  const fetchReturnAccountOptions = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setReturnAccountOptions([]); return []; }
    setIsLoadingReturnAccounts(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PR_CONFIG.SP_RETURN_ACCOUNT,
        JSon: JSON.stringify([{
          prmdivisionid: Number(divisionId),
          prmloginid: getUserSession().loginId,
          prmdeptid: 0,
          prmrbcode: PR_CONFIG.RB_MASTER,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = mapTableToOptions(res, "accountid", "accountname");
      setReturnAccountOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PR] Return Account fetch failed:", err);
      setReturnAccountOptions([]);
      return [];
    } finally {
      setIsLoadingReturnAccounts(false);
    }
  }, [get]);

  // ── Transporter City / Transporter / Destination cascade ───────────
  // No division scoping — this module's own SPs (verified against MRD
  // Section 3): City has no params at all.
  const fetchTransporterCityOptions = useCallback(async () => {
    setIsLoadingTransporterCities(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PR_CONFIG.SP_TRANSPORTER_CITY,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = mapTableToOptions(res, "cityid", "cityname");
      setTransporterCityOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PR] Transporter City fetch failed:", err);
      setTransporterCityOptions([]);
      return [];
    } finally {
      setIsLoadingTransporterCities(false);
    }
  }, [get]);

  const fetchTransporterOptions = useCallback(async (cityId) => {
    if (!cityId || cityId === "0") { setTransporterOptions([]); return []; }
    setIsLoadingTransporters(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PR_CONFIG.SP_TRANSPORTER,
        JSon: JSON.stringify([{ prmcityid: Number(cityId) }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = mapTableToOptions(res, "transporterid", "transportername");
      setTransporterOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PR] Transporter fetch failed:", err);
      setTransporterOptions([]);
      return [];
    } finally {
      setIsLoadingTransporters(false);
    }
  }, [get]);

  const fetchTransporterDestinationOptions = useCallback(async (transporterId) => {
    if (!transporterId || transporterId === "0") { setTransporterDestinationOptions([]); return []; }
    setIsLoadingDestinations(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PR_CONFIG.SP_TRANSPORTER_DESTINATION,
        JSon: JSON.stringify([{ prmtransporterid: Number(transporterId) }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = mapTableToOptions(res, "destinationid", "destinationname");
      setTransporterDestinationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PR] Transporter Destination fetch failed:", err);
      setTransporterDestinationOptions([]);
      return [];
    } finally {
      setIsLoadingDestinations(false);
    }
  }, [get]);

  const fetchDriverStateOptions = useCallback(async () => {
    setIsLoadingDriverStates(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PR_CONFIG.SP_DRIVER_STATE,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = mapTableToOptions(res, "stateid", "statename");
      setDriverStateOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PR] Driver State fetch failed:", err);
      setDriverStateOptions([]);
      return [];
    } finally {
      setIsLoadingDriverStates(false);
    }
  }, [get]);

  const clearTransporters = useCallback(() => setTransporterOptions([]), []);
  const clearTransporterDestinations = useCallback(() => setTransporterDestinationOptions([]), []);

  // ── fetchHeaderMeta ─────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PR_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: PR_CONFIG.RB_MASTER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No PR header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(PR_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      console.log("%c[PR] Header columns received:", "color:#8b5cf6;font-weight:600", (colData || []).length);

      // Transporter City / Driver State have no cascading params — safe to
      // load unconditionally alongside Division/Supplier.
      const tasks = [
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PR_CONFIG.SP_TRANSPORTER_CITY,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).then((res) => setTransporterCityOptions(mapTableToOptions(res, "cityid", "cityname")))
          .catch((err) => { console.warn("[PR] Transporter City fetch failed:", err); setTransporterCityOptions([]); }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PR_CONFIG.SP_DRIVER_STATE,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).then((res) => setDriverStateOptions(mapTableToOptions(res, "stateid", "statename")))
          .catch((err) => { console.warn("[PR] Driver State fetch failed:", err); setDriverStateOptions([]); }),
      ];

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setSupplierOptions([]);
        await Promise.all(tasks);
        return;
      }

      const [divisionData, supplierData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PR_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmuserid: getUserSession().loginId,
            prmcompanyid: getUserSession().companyId,
            prmyearid: getUserSession().yearId,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[PR] Division fetch failed:", err); return null; }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PR_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([{
            prmdivisionid: 0,
            prmloginid: getUserSession().loginId,
            prmyearid: getUserSession().yearId,
            prmpartytype: PR_CONFIG.SUPPLIER_PARTY_TYPE,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[PR] Supplier fetch failed:", err); return null; }),
        ...tasks,
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
          CurrencyID: r.currencyid ?? 0,
          CurrencyName: r.currencyname ?? "",
          CurrencyRate: r.currencyrate ?? 0,
        };
      });
    } catch (err) {
      console.error("[PR] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load PR header configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchDetailMeta ─────────────────────────────────────────────────
  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(get, PR_CONFIG.RB_DETAIL, PR_CONFIG.STORAGE_ENTRY_META);
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;

      const evtSet = buildEventColumnSet(apiColumns, ["qty", "rate"]);
      evtSet.add("qty");
      evtSet.add("rate");
      setEventColumns(evtSet);

      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
      console.log("%c[PR] Detail columns received:", "color:#6366f1;font-weight:600", apiColumns.length);
    } catch (err) {
      console.error("[PR] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load PR item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns ────────────────────────────────────────────────
  const fetchGridColumns = useCallback(async (divisionID = 0, editOpts = false) => {
    const apiColumns = rawDetailColumnsRef.current;
    const meta = rawDetailRbMetaRef.current;
    if (!apiColumns.length || !meta) {
      console.warn("[PR] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      const gridColumns = await fetchAndBuildGridColumns(get, {
        apiColumns,
        rbId: meta.RBID,
        funcCode: PR_CONFIG.RB_DETAIL,
        divisionID,
        editOpts,
        currentColumns: columnsRef.current,
      });
      columnsRef.current = gridColumns;
      setColumns(gridColumns);
      console.log("%c[PR] Grid columns built:", "color:#22c55e;font-weight:600", gridColumns.length);
      return gridColumns;
    } catch (err) {
      console.error("[PR] fetchGridColumns failed:", err);
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
        prmobjname: PR_CONFIG.SP_GRID_EVENT,
        prmmyeventcol: colName,
        prmdetjson: buildDetJSON([newRowData], colTypeMap),
        prmmstjson: JSON.stringify([headerValues]),
      });
      console.log("%c[PR] CellEvent response:", "color:#f59e0b;font-weight:600", { col: colName, result });
      return result;
    } catch (err) {
      console.error("[PR] fireCellEvent failed:", err);
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
        CurrencyID: master.currencyid ?? 0,
        CurrencyName: master.currencyname ?? master.currency ?? "",
        CurrencyRate: master.currencyrate ?? 0,
      };
    }
    if (master.configid != null && master.configname) {
      setPrTypeOptions([{ value: String(master.configid), label: master.configname }]);
    }
    if (master.returnaccountid != null && master.returnaccountname) {
      setReturnAccountOptions([{ value: String(master.returnaccountid), label: master.returnaccountname }]);
    }
    if (master.transportercityid != null && master.transportercityname) {
      setTransporterCityOptions((prev) => (prev.length ? prev : [{ value: String(master.transportercityid), label: master.transportercityname }]));
    }
    if (master.transporterid != null && master.transportername) {
      setTransporterOptions([{ value: String(master.transporterid), label: master.transportername }]);
    }
    if (master.transporterdestinationid != null && master.transporterdestinationname) {
      setTransporterDestinationOptions([{ value: String(master.transporterdestinationid), label: master.transporterdestinationname }]);
    }
    if (master.driverstateid != null && master.driverstatename) {
      setDriverStateOptions((prev) => (prev.length ? prev : [{ value: String(master.driverstateid), label: master.driverstatename }]));
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns ────────────────────────────────────
  const fetchUnlockedHeaderDropdowns = useCallback(async (divisionId, cityId, transporterId) => {
    if (!headerColumns.length) return;
    const isEditable = (c) => isTruthyApiFlag(c.iseditallow) && !isLockOnEditModeCol(c);
    const needsDivision = headerColumns.some((c) => c.colname === "divisionid" && isEditable(c));
    const needsSupplier = headerColumns.some((c) => c.colname === "supplierid" && isEditable(c));
    const needsConfig = headerColumns.some((c) => c.colname === "configid" && isEditable(c));
    const needsReturnAccount = headerColumns.some((c) => c.colname === "returnaccountid" && isEditable(c));

    const tasks = [];
    if (needsDivision || needsSupplier) {
      tasks.push(
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PR_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{ prmuserid: getUserSession().loginId, prmcompanyid: getUserSession().companyId, prmyearid: getUserSession().yearId }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).then((res) => setDivisionOptions((res || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname })))).catch(() => {}),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PR_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([{ prmdivisionid: 0, prmloginid: getUserSession().loginId, prmyearid: getUserSession().yearId, prmpartytype: PR_CONFIG.SUPPLIER_PARTY_TYPE }]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).then((res) => {
          const rows = res || [];
          setSupplierOptions(rows.map((r) => ({ value: String(r.supplierid ?? r.partyid), label: r.suppliername ?? r.partyname })));
          supplierCurrencyMapRef.current = {};
          rows.forEach((r) => {
            supplierCurrencyMapRef.current[String(r.supplierid ?? r.partyid)] = {
              CurrencyID: r.currencyid ?? 0, CurrencyName: r.currencyname ?? "", CurrencyRate: r.currencyrate ?? 0,
            };
          });
        }).catch(() => {})
      );
    }
    if (needsConfig && divisionId) tasks.push(fetchReturnTypes(divisionId));
    if (needsReturnAccount && divisionId) tasks.push(fetchReturnAccountOptions(divisionId));
    if (cityId) tasks.push(fetchTransporterOptions(cityId));
    if (transporterId) tasks.push(fetchTransporterDestinationOptions(transporterId));
    await Promise.all(tasks);
  }, [headerColumns, get, fetchReturnTypes, fetchReturnAccountOptions, fetchTransporterOptions, fetchTransporterDestinationOptions]);

  // ── fetchEditRecord ─────────────────────────────────────────────────
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: PR_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: PR_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: PR_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode: PR_CONFIG.RB_DETAIL,
      }),
    ]);
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? mapMasterRowToHeaderValues(master) : null,
      details: mapDetailRowsToGridRows(detRes || []),
    };
  }, [get]);

  const clearPrTypes = useCallback(() => setPrTypeOptions([]), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);
  const getSupplierCurrency = useCallback((supplierId) => supplierCurrencyMapRef.current[String(supplierId)] ?? null, []);

  return {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, prTypeOptions, supplierOptions, returnAccountOptions,
    transporterCityOptions, transporterOptions, transporterDestinationOptions, driverStateOptions,
    isLoadingPrTypes, isLoadingReturnAccounts,
    isLoadingTransporterCities, isLoadingTransporters, isLoadingDestinations, isLoadingDriverStates,
    fetchReturnTypes, clearPrTypes,
    fetchReturnAccountOptions,
    fetchTransporterCityOptions, fetchTransporterOptions, fetchTransporterDestinationOptions, fetchDriverStateOptions,
    clearTransporters, clearTransporterDestinations,
    fetchSupplierInfo, getSupplierCurrency,
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fireCellEvent,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    saveTxn: null,
    isSaving, saveError, clearSaveError,
  };
}
