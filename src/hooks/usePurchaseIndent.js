// usePurchaseIndent.js — Header meta, detail grid, and filter dropdowns for Purchase Indent
// ─────────────────────────────────────────────────────────────────────────────────────────
// Mirrors usePurchaseOrder.js — same three-phase load pattern:
//
//   fetchHeaderMeta  → RB_PurIndtMst → GetDetailColData + Division + Dept (parallel)
//   fetchDetailMeta  → RB_PurIndentDet → GetDetailColData (columns only)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy on first Add New)
//
// Indent-specific vs PO:
//   fetchIndentTypes(divisionId)  — cascade: Division → Indent Type
//   fetchLocations(divisionId)    — fn_gen_fetchastisslocationmaster (add + edit unlock)
//   No supplier, currency, amend, or 3rd detail table (simpler than PO)

import { useState, useCallback, useRef } from "react";
import axios from "axios";
import { useApi, getApiClient } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  API_TIMEOUT,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { IND_CONFIG } from "../pages/purchase-indent/constants";
import { fetchDropdownOptions, buildGridColumns, isTruthyApiFlag, isLockOnEditModeCol, isVisibleApiCol, hasVisibleCol } from "../utils/gridUtils";
import { withSaveContextFields, buildSaveJsonFields } from "../utils/savePayload";
import { isNumericColDataType, buildDetJSON } from "../utils/columnValidation";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  const session = getUserSession();
  return [
    Number(companyId) || session.companyId,
    Number(yearId) || session.yearId,
    Number(loginId) || session.loginId,
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
    // Date fields need normalisation from ISO → date-input format
    trandate: toDateInput(master.trandate),
    expecteddate: toDateInput(master.expecteddate ?? master.expdate) || null,
    // Context fields: always use live values, not stale DB values
    yearid: getUserSession().yearId,
    funccode: IND_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
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
    if (isTruthyApiFlag(col.iseventreq) || isTruthyApiFlag(col.iseventcol)) {
      set.add(col.colname);
    }
  });
  if (set.size === 0) fallbackKeys.forEach((k) => set.add(k));
  return set;
}

// Shared loader: RB code → RBID + SaveProcName → GetDetailColData columns.
async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: IND_CONFIG.SP_RB_META,
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
    prmLoginID: getUserSession().loginId,
  });
  const apiColumns = colData || [];
  return { meta, apiColumns };
}

export function usePurchaseIndent(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Header (master) state ───────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [indentTypeOptions, setIndentTypeOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [itemMainGroupOptions, setItemMainGroupOptions] = useState([]);
  const [itemSubMainGroupOptions, setItemSubMainGroupOptions] = useState([]);

  const [isLoadingIndentTypes, setIsLoadingIndentTypes] = useState(false);

  // ── Detail grid state ───────────────────────────────────────────────
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isEventFiring, setIsEventFiring] = useState(false);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  // ── fetchLocations ──────────────────────────────────────────────────
  const fetchLocations = useCallback(async (divisionId = 0) => {
    if (!divisionId || divisionId === "0") {
      setLocationOptions([]);
      return [];
    }
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IND_CONFIG.SP_LOCATION,
        JSon: JSON.stringify([{
          prmcompanyid: session.companyId,
          prmdivisionid: Number(divisionId) || 0,
          prmloginid: session.loginId,
          prmlocationtype: "",
          prmfrmtype: String(IND_CONFIG.FRM_TYPE),
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.locationid ?? r.locid),
        label: r.locationname ?? r.locname ?? r.location ?? String(r.locationid ?? r.locid),
      }));
      setLocationOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[Indent] Location fetch failed:", err);
      setLocationOptions([]);
      return [];
    }
  }, [get]);

  // ── Select Item popup filters (Direct mode only) ─────────────────────
  // prmitemtype live-verified as a no-op across 0/1/2/7 (identical rows
  // returned each time) for this company/division — passing 0 (this app's
  // usual "unspecified" sentinel) rather than a guessed real item-type id.
  const fetchItemMainGroupOptions = useCallback(async ({ divisionId, configId }) => {
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IND_CONFIG.SP_ITEM_MAIN_GROUP,
        JSon: JSON.stringify([{
          prmcompanyid: session.companyId,
          prmdivisionid: Number(divisionId) || 0,
          prmyearid: session.yearId,
          prmloginid: session.loginId,
          prmitemtype: 0,
          prmconfigid: Number(configId) || 0,
          prmfrmtype: IND_CONFIG.FORM_TAG,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.maingroupid),
        label: r.maingroup ?? String(r.maingroupid),
      }));
      setItemMainGroupOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[Indent] Item Main Group fetch failed:", err);
      setItemMainGroupOptions([]);
      return [];
    }
  }, [get]);

  // Sub Main Group response shape is unverified against real data (every
  // main group tried returned [] live — see constants.js note); field-name
  // guesses below are best-effort and should be checked once real rows exist.
  const fetchItemSubMainGroupOptions = useCallback(async ({ divisionId, configId, mainGroupId }) => {
    if (!mainGroupId) {
      setItemSubMainGroupOptions([]);
      return [];
    }
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IND_CONFIG.SP_ITEM_SUB_MAIN_GROUP,
        JSon: JSON.stringify([{
          prmcompanyid: session.companyId,
          prmdivisionid: Number(divisionId) || 0,
          prmyearid: session.yearId,
          prmloginid: session.loginId,
          prmitemtype: 0,
          prmconfigid: Number(configId) || 0,
          prmfrmtype: IND_CONFIG.FORM_TAG,
          prmmaingroupid: Number(mainGroupId),
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.submaingroupid ?? r.subgroupid ?? r.id),
        label: r.submaingroup ?? r.subgroup ?? String(r.submaingroupid ?? r.subgroupid ?? r.id),
      }));
      setItemSubMainGroupOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[Indent] Item Sub Main Group fetch failed:", err);
      setItemSubMainGroupOptions([]);
      return [];
    }
  }, [get]);

  const clearItemSubMainGroupOptions = useCallback(() => setItemSubMainGroupOptions([]), []);

  // ── fetchDepartments ────────────────────────────────────────────────
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IND_CONFIG.SP_DEPT,
        JSon: JSON.stringify([{ prmdeptid: 0, prmloginid: getUserSession().loginId }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.deptid ?? r.departmentid),
        label: r.deptname ?? r.departmentname,
      }));
      setDepartmentOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[Indent] Department fetch failed:", err);
      setDepartmentOptions([]);
      return [];
    }
  }, [get]);

  // ── fetchIndentTypes — cascade from Division ────────────────────────
  const fetchIndentTypes = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setIndentTypeOptions([]);
        return [];
      }
      setIsLoadingIndentTypes(true);
      try {
        const session = getUserSession();
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: IND_CONFIG.SP_INDENT_TYPES,
          JSon: JSON.stringify([
            {
              prmcompanyid: session.companyId,
              prmdivisionid: Number(divisionId),
              prmyearid: session.yearId,
              prmuserid: session.loginId,
              prmformtag: IND_CONFIG.FORM_TAG,
              prmreftype: "",
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = (res || []).map((r) => ({
          value: String(r.configurationid),
          label: r.name,
        }));
        setIndentTypeOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[Indent] Indent Type fetch failed:", err);
        setIndentTypeOptions([]);
        return [];
      } finally {
        setIsLoadingIndentTypes(false);
      }
    },
    [get]
  );

  // ── fetchHeaderMeta ─────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);

    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: IND_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: IND_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Indent header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      setHeaderRbMeta(hdrMeta);
      localStorage.setItem(IND_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      console.log("%c[Indent] Header meta stored:", "color:#8b5cf6;font-weight:600", hdrMeta);

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const cols = colData || [];
      setHeaderColumns(cols);
      console.log(
        "%c[Indent] Header columns received:",
        "color:#8b5cf6;font-weight:600",
        cols.length
      );

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setDepartmentOptions([]);
        setLocationOptions([]);
        return;
      }

      const needDivision = hasVisibleCol(cols, "divisionid");
      const needDept = hasVisibleCol(cols, "deptid");

      const tasks = [];
      if (needDivision) {
        tasks.push(
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: 2,
            ObjName: IND_CONFIG.SP_DIVISIONS,
            JSon: JSON.stringify([
              {
                prmuserid: getUserSession().loginId,
                prmcompanyid: getUserSession().companyId,
                prmyearid: getUserSession().yearId,
              },
            ]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          })
            .then((divisionData) => {
              setDivisionOptions(
                (divisionData || []).map((r) => ({
                  value: String(r.divisionid),
                  label: r.divisionname,
                }))
              );
            })
            .catch((err) => {
              console.warn("[Indent] Division fetch failed:", err);
              setDivisionOptions([]);
            })
        );
      }
      if (needDept) {
        tasks.push(
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: 2,
            ObjName: IND_CONFIG.SP_DEPT,
            JSon: JSON.stringify([{ prmdeptid: 0, prmloginid: getUserSession().loginId }]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          })
            .then((deptData) => {
              setDepartmentOptions(
                (deptData || []).map((r) => ({
                  value: String(r.deptid ?? r.departmentid),
                  label: r.deptname ?? r.departmentname,
                }))
              );
            })
            .catch((err) => {
              console.warn("[Indent] Department fetch failed:", err);
              setDepartmentOptions([]);
            })
        );
      }

      await Promise.all(tasks);
    } catch (err) {
      console.error("[Indent] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Indent header configuration.");
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
        get,
        IND_CONFIG.RB_DETAIL,
        IND_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;

      const evtSet = buildEventColumnSet(apiColumns, ["tranqty", "baseqty", "tranrate", "unitconvrate"]);
      // Force-add quantity and rate columns that drive Amount recalculation
      ["tranqty", "baseqty", "tranrate", "unitconvrate"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);

      setAllColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
      console.log(
        "%c[Indent] Detail columns received:",
        "color:#6366f1;font-weight:600",
        apiColumns.length
      );
    } catch (err) {
      console.error("[Indent] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load Indent item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns ────────────────────────────────────────────────
  const fetchGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts =
        typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      const apiColumns = rawDetailColumnsRef.current;
      const meta = rawDetailRbMetaRef.current;

      if (!apiColumns.length || !meta) {
        console.warn("[Indent] fetchGridColumns called before fetchDetailMeta completed.");
        return [];
      }

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
          funcCode: IND_CONFIG.RB_DETAIL,
          divisionID: Number(divisionID) || 0,
          existingRecordEdit,
          rowData: masterRow,
          fetchUnlockedDropdowns,
        });
        const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
          filterable: false,
          allEditable: true,
          existingRecordEdit,
        });
        setColumns(gridColumns);
        console.log(
          "%c[Indent] Grid columns built:",
          "color:#22c55e;font-weight:600",
          gridColumns.length
        );
        return gridColumns;
      } catch (err) {
        console.error("[Indent] fetchGridColumns failed:", err);
        return [];
      }
    },
    [get]
  );

  // ── fireCellEvent — Qty / Rate column blur → server recalculation ───
  const fireCellEvent = useCallback(
    async (colName, rowData, headerValues) => {
      setIsEventFiring(true);
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
          prmobjname: IND_CONFIG.SP_GRID_EVENT,
          prmmyeventcol: colName,
          prmdetjson: buildDetJSON([newRowData], colTypeMap),
          prmmstjson: JSON.stringify([headerValues]),
        });
        console.log("%c[Indent] CellEvent response:", "color:#f59e0b;font-weight:600", {
          col: colName,
          result,
        });
        return result;
      } catch (err) {
        console.error("[Indent] fireCellEvent failed:", err);
        return null;
      } finally {
        setIsEventFiring(false);
      }
    },
    [allColumns]
  );

  // ── saveTxn ─────────────────────────────────────────────────────────
  const saveTxn = useCallback(
    async (headerValues, detailRows) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const mstMeta = JSON.parse(localStorage.getItem(IND_CONFIG.STORAGE_HEADER_META) || "null");
        const detMeta = JSON.parse(localStorage.getItem(IND_CONFIG.STORAGE_ENTRY_META) || "null");

        if (!mstMeta || !detMeta) {
          throw new Error("Missing save configuration. Please refresh and try again.");
        }

        const cleanedRows = detailRows.map(({ id, ...rest }) => rest);
        const isEdit = Number(headerValues.tranmstgenid) > 0 || Number(headerValues.idnumber) > 0;
        const body = await withSaveContextFields(
          buildSaveJsonFields({
            label: "Indent Hook",
            mst: headerValues,
            det: cleanedRows,
            extra: {
              PrmStrMstRBName: IND_CONFIG.RB_MASTER,
              prmstrMasterSaveProcName: mstMeta?.SaveProcName,
              prmstrDetailSaveProcName: detMeta?.SaveProcName,
              PrmStrDetRBName: IND_CONFIG.RB_DETAIL,
              p_ErrCode: -1,
              p_ErrMsg: "",
            },
          }),
          { divisionId: headerValues.divisionid, isEdit }
        );

        const result = await axios.post(`${baseURL}${ENDPOINTS.RB_MASTER_DETAIL_FORM_SAVE}`, body, {
          timeout: API_TIMEOUT,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        console.log("%c[Indent] Save result:", "color:#22c55e;font-weight:600", result.data);
        return result.data;
      } catch (err) {
        console.error("[Indent] saveTxn failed:", err);
        setSaveError(err?.message || "Save failed. Please try again.");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [baseURL]
  );

  // ── seedOptionsFromMaster — seed single-item options from master fill response ──
  // API returns display names as: DivisionName, ConfigName, Department (not DeptName),
  // location_name (not Location/LocationName — confirmed via live GetMasterDataFill dump,
  // the one field in this response that uses a snake_case name).
  const seedOptionsFromMaster = useCallback((master) => {
    if (master.divisionid != null && master.divisionname) {
      setDivisionOptions([{ value: String(master.divisionid), label: master.divisionname }]);
    }
    if (master.configid != null && master.configname) {
      setIndentTypeOptions([{ value: String(master.configid), label: master.configname }]);
    }
    const deptLabel = master.deptname ?? master.department;
    if (master.deptid != null && master.deptid !== 0 && deptLabel) {
      setDepartmentOptions([{ value: String(master.deptid), label: deptLabel }]);
    }
    const locLabel = master.locationname ?? master.location_name ?? master.location;
    if (master.locationid != null && master.locationid !== 0 && locLabel) {
      setLocationOptions([{ value: String(master.locationid), label: locLabel }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns — re-fetch editable dropdowns when entering edit mode ──
  const fetchUnlockedHeaderDropdowns = useCallback(
    async (divisionId) => {
      if (!headerColumns.length) return;

      const needsCol = (colname) =>
        headerColumns.some(
          (c) =>
            String(c.colname).toLowerCase() === String(colname).toLowerCase()
            && isVisibleApiCol(c)
            && isTruthyApiFlag(c.iseditallow)
            && !isLockOnEditModeCol(c)
        );

      const tasks = [];

      if (needsCol("divisionid")) {
        tasks.push(
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: 2,
            ObjName: IND_CONFIG.SP_DIVISIONS,
            JSon: JSON.stringify([{
              prmUserID: getUserSession().loginId,
              prmCompanyID: getUserSession().companyId,
              prmYearID: getUserSession().yearId,
            }]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          }).then((res) =>
            setDivisionOptions(
              (res || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname }))
            )
          ).catch(() => { })
        );
      }
      if (needsCol("configid") && divisionId) tasks.push(fetchIndentTypes(divisionId));
      if (needsCol("deptid")) tasks.push(fetchDepartments());
      if (needsCol("locationid") && divisionId) tasks.push(fetchLocations(divisionId));
      await Promise.all(tasks);
    },
    [headerColumns, get, fetchIndentTypes, fetchDepartments, fetchLocations]
  );

  // ── fetchEditRecord — load master + detail rows for edit mode ────────
  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({
        companyId,
        yearId,
        loginId,
        sessionId,
        idNumber,
      });

      const [mstRes, detRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: IND_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: IND_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: IND_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: IND_CONFIG.RB_DETAIL,
        }),
      ]);

      const master = mstRes?.[0] ?? null;

      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master) : null,
        details: mapDetailRowsToGridRows(detRes || []),
      };
    },
    [get]
  );

  const clearIndentTypes = useCallback(() => setIndentTypeOptions([]), []);
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
    indentTypeOptions,
    departmentOptions,
    locationOptions,
    itemMainGroupOptions,
    itemSubMainGroupOptions,
    // loaders
    isLoadingIndentTypes,
    // cascade
    fetchIndentTypes,
    clearIndentTypes,
    fetchDepartments,
    fetchLocations,
    fetchItemMainGroupOptions,
    fetchItemSubMainGroupOptions,
    clearItemSubMainGroupOptions,
    // detail grid
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    // cell events
    fireCellEvent,
    isEventFiring,
    // edit flow
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    // save
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  };
}
