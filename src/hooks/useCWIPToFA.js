// useCWIPToFA.js — Header meta, detail grid, and filter dropdowns for CWIP To FA
// ───────────────────────────────────────────────────────────────────────────────
// Same 3-phase load pattern as usePurchaseVoucher.js:
//
//   fetchHeaderMeta  → RB_AstCWIP2FAMst → GET_DETAIL_COL_DATA + Division (parallel)
//   fetchDetailMeta  → RB_AstCWIP2FADet → GET_DETAIL_COL_DATA (columns only)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Add New)
//
// C2F-specific vs PV:
//   No SupplierID, no BasedOnID, no EnterpriseSummaryPanel
//   fetchLocations(divisionId)               — Location cascade from Division
//   fetchCostCenters(divisionId, tranDate)   — Cost Center dropdown (same SP, module="C2F")
//   seedOptionsFromMaster handles: Division, Location, CWIPAccID, CostCenter

import { useState, useCallback, useRef, useMemo } from "react";
import { useApi, getApiClient } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { C2F_CONFIG } from "../pages/cwip-to-fa/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
} from "../utils/gridUtils";
import { isNumericColDataType, buildDetJSON } from "../utils/columnValidation";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  const session = getUserSession();
  return [
    Number(companyId)  || session.companyId,
    Number(yearId)     || session.yearId,
    Number(loginId)    || session.loginId,
    Number(sessionId)  || DEFAULT_SESSION_ID,
    Number(idNumber)   || 0,
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
    // Date fields need normalisation from ISO → date-input format
    trandate:        toDateInput(master.trandate),
    puttouseinstdate: toDateInput(master.puttouseinstdate) || null,
    // Context fields: always use live values, not stale DB values
    yearid:    getUserSession().yearId,
    funccode:  C2F_CONFIG.RB_MASTER,
    loginid:   getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
}

// 2026-08-17 (/pm) — project-wide sentinel-row fix (see usePurchaseInquiry.js
// for the original bug write-up). A detail-fill SP with nothing to return
// sends a single {ErrCode, ErrMsg} "no data" row instead of an empty array;
// without this guard it was loaded as one phantom blank grid row instead of
// showing the grid's emptyMessage.
import { isErrorOnlyRow } from "../utils/apiResponse";

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

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: C2F_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmrbcode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const tableRow = metaData?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);
  const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
  localStorage.setItem(storageKey, JSON.stringify(meta));
  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID:  getUserSession().loginId,
  });
  return { meta, apiColumns: colData || [] };
}

// Fields that RB_AstCWIP2FADet incorrectly includes as detail columns but belong
// to the master header. Filtered out before building grid columns or allColumns.
// Long-term fix: DBA should set IsVisible=0 for these in the RB detail config.
const DETAIL_HEADER_FIELDS = new Set(["NetTotal"]);

export function useCWIPToFA(baseURL = API_BASE_URL) {
  const { get: rawGet } = useApi(baseURL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  // ── Header (master) state ──────────────────────────────────────────────────
  const [headerColumns,   setHeaderColumns]   = useState([]);
  const [headerFetching,  setHeaderFetching]  = useState(false);
  const [headerError,     setHeaderError]     = useState(null);

  const [divisionOptions,   setDivisionOptions]   = useState([]);
  const [locationOptions,   setLocationOptions]   = useState([]);
  const [cWIPAccOptions,    setCWIPAccOptions]    = useState([]);
  const [costCenterOptions, setCostCenterOptions] = useState([]);
  const [assetItemOptions,  setAssetItemOptions]  = useState([]);

  // ── Detail grid state ──────────────────────────────────────────────────────
  const [columns,    setColumns]    = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching,  setIsFetching]  = useState(false);
  const [metaError,   setMetaError]   = useState(null);
  const [saveError,   setSaveError]   = useState(null);

  const rawDetailColumnsRef  = useRef([]);
  const rawDetailRbMetaRef   = useRef(null);

  // ── fetchCWIPAccByDivision — cascade from Division ────────────────────────
  const fetchCWIPAccByDivision = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setCWIPAccOptions([]); return []; }
    if (!C2F_CONFIG.SP_CWIP_ACC) return [];
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: C2F_CONFIG.SP_CWIP_ACC,
        JSon: JSON.stringify([{
          prmdivisionid:    Number(divisionId),
          prmacmaingroupid: 7,           // ⚠️ CONFIRM with DBA — Main Group ID for CWIP accounts
          prmloginid:       session.loginId,
          prmcompanyid:     session.companyId,
          prmyearid:        session.yearId,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: r.accountid ?? 0,
        label: `${r.accode ?? ""} | ${r.acname ?? ""}`,
      }));
      setCWIPAccOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[C2F] CWIP A/C fetch failed:", err);
      setCWIPAccOptions([]);
      return [];
    }
  }, [get]);

  const clearCWIPAccOptions     = useCallback(() => setCWIPAccOptions([]), []);
  const clearCostCenterOptions  = useCallback(() => setCostCenterOptions([]), []);

  // ── fetchUniqueId — generate TranMstGenID on Add New (mirrors PO pattern) ──
  const fetchUniqueId = useCallback(async () => {
    if (!C2F_CONFIG.SP_UNIQUE_ID) return 0;
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 1,
        ObjName: C2F_CONFIG.SP_UNIQUE_ID,
        JSon: JSON.stringify([{ prmidnumber: 0, prmyearid: getUserSession().yearId }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      return res?.[0]?.uniqueid ?? 0;
    } catch (err) {
      console.warn("[C2F] UniqueID fetch failed:", err);
      return 0;
    }
  }, [get]);

  // ── fetchLocations — cascade from Division ─────────────────────────────────
  const fetchLocations = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setLocationOptions([]); return []; }
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: C2F_CONFIG.SP_LOCATION,
        JSon: JSON.stringify([{
          prmcompanyid:    session.companyId,
          prmdivisionid:   Number(divisionId) || 0,
          prmloginid:      session.loginId,
          prmlocationtype: "",
          prmfrmtype:      String(C2F_CONFIG.FRM_TYPE),
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
      console.warn("[C2F] Location fetch failed:", err);
      setLocationOptions([]);
      return [];
    }
  }, [get]);

  // ── fetchCostCenters ───────────────────────────────────────────────────────
  const fetchCostCenters = useCallback(async (divisionId, tranDate) => {
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: C2F_CONFIG.SP_COST_CENTER,
        JSon: JSON.stringify([{
          prmdivisionid:  Number(divisionId) || 0,
          prmtrandate:    tranDate || "",
          prmaccountid:   0,
          prmloginid:     session.loginId,
          prmlangcode:    1,
          prmmodulecode:  "C2F",
          prmismultidiv:  0,
          prmyearid:      session.yearId,
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
      console.warn("[C2F] Cost Center fetch failed:", err);
      setCostCenterOptions([]);
      return [];
    }
  }, [get]);

  // ── fetchAssetItemOptions — Asset Item dropdown (Item Master), only relevant
  // when ConvTypeID = C2F_SINGLE_ASSET_CONV_TYPE ("Single Asset from all Line
  // Items"). Calls SP_ASSET_ITEM (fn_fetch_assetitem) — DBA-confirmed
  // signature (2026-08-27): prmcompanyid/prmdivisionid/prmyearid/prmloginid/
  // prmmaingroupid/prmsubmaingroupid. No Location/CWIP A/C/date params —
  // this form has no Main Group/Sub Main Group selector, so those go as 0
  // ("no filter"), confirmed live to return the full division-wide item list.
  const fetchAssetItemOptions = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") { setAssetItemOptions([]); return []; }
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: C2F_CONFIG.SP_ASSET_ITEM,
        JSon: JSON.stringify([{
          prmcompanyid:      session.companyId,
          prmdivisionid:     Number(divisionId) || 0,
          prmyearid:         session.yearId,
          prmloginid:        session.loginId,
          prmmaingroupid:    0,
          prmsubmaingroupid: 0,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const opts = (res || [])
        .map((r) => {
          const id = r.itemid ?? r.assetitemid ?? r.ItemID ?? r.AssetItemID;
          if (id == null) return null;
          const code = r.itemcode ?? r.ItemCode ?? "";
          const name = r.itemname ?? r.ItemName ?? "";
          return { value: String(id), label: code ? `${code} | ${name}` : String(name || id) };
        })
        .filter(Boolean);
      setAssetItemOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[C2F] Asset Item fetch failed:", err);
      setAssetItemOptions([]);
      return [];
    }
  }, [get]);

  const clearAssetItemOptions = useCallback(() => setAssetItemOptions([]), []);

  // ── fetchHeaderMeta ────────────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const session = getUserSession();
      // Phase 1 — fetch RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: C2F_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: C2F_CONFIG.RB_MASTER }]),
        p_ErrCode: -1, p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No C2F header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(C2F_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — fetch header column definitions (master field metadata — dynamic)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  session.loginId,
      });
      const hdrApiColumns = colData || [];
      setHeaderColumns(hdrApiColumns);
      console.log("%c[C2F] Header columns received:", "color:#8b5cf6;font-weight:600", hdrApiColumns.length);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setLocationOptions([]);
        setCWIPAccOptions([]);
        setCostCenterOptions([]);
        return;
      }

      // Phase 3 — Division only. CWIP A/C is cascade-driven: loaded by fetchCWIPAccByDivision
      // when user selects a Division (not pre-loaded at page open).
      const divisionData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: C2F_CONFIG.SP_DIVISIONS,
        JSon: JSON.stringify([{
          prmuserid:    session.loginId,
          prmcompanyid: session.companyId,
          prmyearid:    session.yearId,
        }]),
        p_ErrCode: -1, p_ErrMsg: "",
      }).catch((err) => { console.warn("[C2F] Division fetch failed:", err); return null; });

      setDivisionOptions(
        (divisionData || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname }))
      );
    } catch (err) {
      console.error("[C2F] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load C2F header configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchDetailMeta ────────────────────────────────────────────────────────
  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns: rawApiColumns } = await loadRbDetailGridMeta(
        get,
        C2F_CONFIG.RB_DETAIL,
        C2F_CONFIG.STORAGE_ENTRY_META
      );
      // Strip out master-level fields the RB erroneously includes in detail columns
      const apiColumns = rawApiColumns.filter((c) => !DETAIL_HEADER_FIELDS.has(c.colname));
      rawDetailRbMetaRef.current  = meta;
      rawDetailColumnsRef.current = apiColumns;

      // Build event column set from RB metadata (iseventreq/iseventcol flags).
      // No SP_GRID_EVENT configured for CWIP today, so this is empty until one is added.
      setEventColumns(buildEventColumnSet(apiColumns));

      setAllColumns(apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null })));
      console.log("%c[C2F] Detail columns received:", "color:#6366f1;font-weight:600", apiColumns.length);
    } catch (err) {
      console.error("[C2F] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load C2F item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns — lazy, called on first Add New or edit load ──────────
  const fetchGridColumns = useCallback(async (divisionID = 0, editOpts = false) => {
    const opts = typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
    const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

    const apiColumns = rawDetailColumnsRef.current;
    const meta       = rawDetailRbMetaRef.current;
    if (!apiColumns.length || !meta) {
      console.warn("[C2F] fetchGridColumns called before fetchDetailMeta completed.");
      return [];
    }

    try {
      // All colctrltype=4 columns (including CWIPAccID if in detail) auto-resolved
      // via GET_FILTER_DETAIL using each column's objdetid — fully dynamic.
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode:              C2F_CONFIG.RB_DETAIL,
        divisionID:            Number(divisionID) || 0,
        existingRecordEdit,
        rowData:               masterRow,
        fetchUnlockedDropdowns,
      });

      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable:          false,
        allEditable:         true,
        existingRecordEdit,
      });
      setColumns(gridColumns);
      console.log("%c[C2F] Grid columns built:", "color:#22c55e;font-weight:600", gridColumns.length);
      return gridColumns;
    } catch (err) {
      console.error("[C2F] fetchGridColumns failed:", err);
      return [];
    }
  }, [get]);

  // ── fireCellEvent — Qty / Rate → Amount recalc ────────────────────────────
  const fireCellEvent = useCallback(async (colName, rowData, headerValues) => {
    if (!C2F_CONFIG.SP_GRID_EVENT) return null;
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
        prmobjname:   C2F_CONFIG.SP_GRID_EVENT,
        prmmyeventcol: colName,
        prmdetjson:   buildDetJSON([newRowData], colTypeMap),
        prmmstjson:   JSON.stringify([headerValues]),
      });
      console.log("%c[C2F] CellEvent response:", "color:#f59e0b;font-weight:600", { col: colName, result });
      return result;
    } catch (err) {
      console.error("[C2F] fireCellEvent failed:", err);
      return null;
    }
  }, [allColumns]);

  // ── seedOptionsFromMaster — edit mode: pre-fill dropdowns from saved record ─
  // Live GET_MASTER_DATA_FILL response for fn_tbl_rb_astcwip2famst (verified
  // 2026-08-27 /pm against a real saved record) actually names these display
  // columns "division"/"cwipaccount"/"costcenteraccount" — NOT
  // "divisionname"/"cwipaccname"/"costcentername" as originally guessed. That
  // mismatch meant Division/CWIP A/C/Cost Center silently never seeded in
  // edit mode (rendered as blank "Select…" despite the record having real
  // saved values) — only Location happened to match by coincidence. Kept the
  // originally-guessed names as a fallback in case a different environment's
  // SP names these columns differently.
  const seedOptionsFromMaster = useCallback((master) => {
    const divisionLabel = master.division ?? master.divisionname;
    if (master.divisionid != null && divisionLabel) {
      setDivisionOptions([{ value: String(master.divisionid), label: divisionLabel }]);
    }
    const locationLabel = master.locationname ?? master.location;
    if (master.locationid != null && locationLabel) {
      setLocationOptions([{ value: String(master.locationid), label: locationLabel }]);
    }
    const cwipAccLabel = master.cwipaccount ?? master.cwipaccname;
    if (master.cwipaccid != null && cwipAccLabel) {
      setCWIPAccOptions([{ value: String(master.cwipaccid), label: cwipAccLabel }]);
    }
    const costCenterLabel = master.costcenteraccount ?? master.costcentername;
    if (master.costcenteraccid != null && costCenterLabel) {
      setCostCenterOptions([{ value: String(master.costcenteraccid), label: costCenterLabel }]);
    }
    const assetItemLabel = master.assetitemname ?? master.assetitem;
    if (master.assetitemid != null && assetItemLabel) {
      setAssetItemOptions([{ value: String(master.assetitemid), label: assetItemLabel }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns — enter edit mode: reload editable dropdowns
  const fetchUnlockedHeaderDropdowns = useCallback(async (divisionId, tranDate) => {
    if (!headerColumns.length) return;
    const isEditable  = (c) => isTruthyApiFlag(c.iseditallow) && !isLockOnEditModeCol(c);
    const needsDivision   = headerColumns.some((c) => c.colname === "divisionid"      && isEditable(c));
    const needsLocation   = headerColumns.some((c) => c.colname === "locationid"      && isEditable(c));
    const needsCWIPAcc    = headerColumns.some((c) => c.colname === "cwipaccid"       && isEditable(c));
    const needsCostCenter = headerColumns.some((c) => c.colname === "costcenteraccid" && isEditable(c));

    const tasks = [];
    if (needsDivision) {
      const session = getUserSession();
      tasks.push(
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: C2F_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([{
            prmuserid:    session.loginId,
            prmcompanyid: session.companyId,
            prmyearid:    session.yearId,
          }]),
          p_ErrCode: -1, p_ErrMsg: "",
        })
          .then((res) => setDivisionOptions((res || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname }))))
          .catch(() => {})
      );
    }
    if (needsLocation  && divisionId) tasks.push(fetchLocations(divisionId));
    if (needsCWIPAcc   && divisionId) tasks.push(fetchCWIPAccByDivision(divisionId));
    if (needsCostCenter)              tasks.push(fetchCostCenters(divisionId, tranDate));
    await Promise.all(tasks);
  }, [headerColumns, get, fetchLocations, fetchCWIPAccByDivision, fetchCostCenters]);

  // ── fetchEditRecord ────────────────────────────────────────────────────────
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber });
    const [mstRes, detRes] = await Promise.all([
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: C2F_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode:  C2F_CONFIG.RB_MASTER,
      }),
      get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: C2F_CONFIG.SP_DETAIL_FILL,
        prmParameters,
        prmFuncCode:  C2F_CONFIG.RB_DETAIL,
      }),
    ]);
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? mapMasterRowToHeaderValues(master) : null,
      details:      mapDetailRowsToGridRows(detRes || []),
    };
  }, [get]);

  const clearLocations  = useCallback(() => setLocationOptions([]), []);
  const clearSaveError  = useCallback(() => setSaveError(null), []);

  return {
    // Header
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, locationOptions, cWIPAccOptions, costCenterOptions, assetItemOptions,
    fetchLocations, clearLocations,
    fetchCWIPAccByDivision, clearCWIPAccOptions,
    fetchCostCenters, clearCostCenterOptions,
    fetchAssetItemOptions, clearAssetItemOptions,
    fetchUniqueId,
    // Detail grid
    columns, allColumns, eventColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fireCellEvent,
    // Edit
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    // Save
    saveError, clearSaveError,
  };
}
