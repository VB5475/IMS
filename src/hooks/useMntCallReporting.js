import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  OBJ_TYPE,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import {
  buildGridColumns,
  fetchDropdownOptions,
  seedMasterDropdownOptions,
} from "../utils/gridUtils";
import {
  mapMasterRowToHeaderValues,
  normalizeDetailColLinks,
  resolveDetailColLinks,
} from "../utils/masterFormUtils";
import { MNT_REPORTING_CONFIG } from "../pages/call-reporting/constants";

function pickCI(obj, key) {
  if (!obj || key == null) return undefined;
  if (key in obj) return obj[key];
  const lower = String(key).toLowerCase();
  const found = Object.keys(obj).find((k) => k.toLowerCase() === lower);
  return found !== undefined ? obj[found] : undefined;
}

function toDateInput(value) {
  if (!value) return "";
  if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

/** Dashboard selected row → prmrbrowid for call-reporting fill SPs. */
export function resolveDashboardRowId(row) {
  return (
    Number(
      pickCI(row, "rbrowid")
      ?? pickCI(row, "RBRowID")
      ?? pickCI(row, "idnumber")
      ?? pickCI(row, "IDNumber")
      ?? pickCI(row, "compuniquekey")
      ?? 0
    ) || 0
  );
}

function mapAllocatedUserRows(rows) {
  return (rows ?? [])
    .map((row) => {
      const value = String(
        pickCI(row, "allocateduserid")
        ?? pickCI(row, "allocatedtoid")
        ?? pickCI(row, "userid")
        ?? ""
      );
      const label = String(
        pickCI(row, "allocatedusername")
        ?? pickCI(row, "allocatedtoname")
        ?? pickCI(row, "username")
        ?? value
      ).trim();
      if (!value) return null;
      return { value, label: label || value };
    })
    .filter(Boolean);
}

function mapViewDropdownRows(rows) {
  return (rows ?? [])
    .map((row) => {
      const keys = Object.keys(row || {});
      if (!keys.length) return null;
      const idKey =
        keys.find((k) => /id$/i.test(k) && !/^err/i.test(k))
        ?? keys.find((k) => /code$/i.test(k))
        ?? keys[0];
      const labelKey =
        keys.find((k) => /(name|desc|label|text)$/i.test(k))
        ?? keys.find((k) => k !== idKey)
        ?? idKey;
      const value = pickCI(row, idKey);
      if (value == null || value === "") return null;
      return {
        value: String(value),
        label: String(pickCI(row, labelKey) ?? value).trim() || String(value),
      };
    })
    .filter(Boolean);
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
    id: String(pickCI(row, "compuniquekey") ?? pickCI(row, "idnumber") ?? `clrpt_${index}`),
  }));
}

function applyReportingDefaults(headerValues) {
  const next = { ...headerValues };
  ["calldate", "expdate"].forEach((key) => {
    if (next[key] != null && next[key] !== "") {
      next[key] = toDateInput(next[key]);
    }
  });
  return next;
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: MNT_REPORTING_CONFIG.LIST_OBJ_TYPE,
    ObjName: MNT_REPORTING_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmRBCode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const metaRows = resolveDetailColLinks(metaData);
  const tableRow = metaRows[0];
  const rbid = tableRow?.RBID ?? tableRow?.rbid;
  if (!rbid) throw new Error(`No RB metadata returned for ${rbCode}.`);

  const meta = {
    RBID: rbid,
    SaveProcName: tableRow?.SaveProcName ?? tableRow?.saveprocname,
  };
  localStorage.setItem(storageKey, JSON.stringify(meta));

  const session = getUserSession();
  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: Number(session.loginId) || DEFAULT_LOGIN_ID,
  });
  return { meta, apiColumns: resolveDetailColLinks(colData) };
}

/**
 * Call Reporting — RB-driven popup (MRD rb_mnt_clrpt).
 * Header + Required Parts / Old Parts grids + item pickers.
 */
export function useMntCallReporting() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [rbId, setRbId] = useState(null);

  const [newPartsColumns, setNewPartsColumns] = useState([]);
  const [oldPartsColumns, setOldPartsColumns] = useState([]);
  const [newPartsAllColumns, setNewPartsAllColumns] = useState([]);
  const [oldPartsAllColumns, setOldPartsAllColumns] = useState([]);
  const [gridsFetching, setGridsFetching] = useState(false);

  const newPartsApiColsRef = useRef([]);
  const oldPartsApiColsRef = useRef([]);
  const newPartsMetaRef = useRef(null);
  const oldPartsMetaRef = useRef(null);

  const fetchViewOptions = useCallback(
    async (viewName) => {
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.VIEW,
          ObjName: viewName,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        return mapViewDropdownRows(resolveDetailColLinks(res));
      } catch (err) {
        console.warn(`[MNT Call Reporting] view ${viewName} fetch failed:`, err);
        return [];
      }
    },
    [get]
  );

  const fetchAllocatedUserOptions = useCallback(
    async ({ divisionId = 0, locationId = 0, deptId = 0 } = {}) => {
      try {
        const session = getUserSession();
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: MNT_REPORTING_CONFIG.LIST_OBJ_TYPE,
          ObjName: MNT_REPORTING_CONFIG.SP_ALLOCATED_USER,
          JSon: JSON.stringify([{
            prmcompanyid: Number(session.companyId) || DEFAULT_COMPANY_ID,
            prmdivisionid: Number(divisionId) || 0,
            prmlocationid: Number(locationId) || 0,
            prmdeptid: Number(deptId) || 0,
          }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        return mapAllocatedUserRows(resolveDetailColLinks(res));
      } catch (err) {
        console.warn(`[MNT Call Reporting] ${MNT_REPORTING_CONFIG.SP_ALLOCATED_USER} failed:`, err);
        return [];
      }
    },
    [get]
  );

  const loadHeaderDropdowns = useCallback(
    async (filterContext = {}) => {
      const [callStatus, brokenReason, partReason, allocatedUsers] = await Promise.all([
        fetchViewOptions(MNT_REPORTING_CONFIG.VIEW_CALL_STATUS),
        fetchViewOptions(MNT_REPORTING_CONFIG.VIEW_BROKEN_CALL_REASON),
        fetchViewOptions(MNT_REPORTING_CONFIG.VIEW_PART_REPLACEMENT_REASON),
        fetchAllocatedUserOptions({
          divisionId: filterContext.divisionid,
          locationId: filterContext.locationid,
          deptId: filterContext.deptid,
        }),
      ]);

      setDropdownOptions((prev) => ({
        ...prev,
        reportingstatusid: callStatus,
        reasonforbrokencallid: brokenReason,
        partreplacementreasonid: partReason,
        [MNT_REPORTING_CONFIG.ALLOCATED_USER_COL]: allocatedUsers,
      }));
    },
    [fetchViewOptions, fetchAllocatedUserOptions]
  );

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const session = getUserSession();
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: MNT_REPORTING_CONFIG.LIST_OBJ_TYPE,
        ObjName: MNT_REPORTING_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: MNT_REPORTING_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const metaRows = resolveDetailColLinks(metaData);
      const tableRow = metaRows[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) {
        throw new Error("No Call Reporting RB metadata returned for rb_mnt_clrpt.");
      }

      const hdrMeta = {
        RBID: rbid,
        SaveProcName: tableRow?.SaveProcName ?? tableRow?.saveprocname,
      };
      localStorage.setItem(MNT_REPORTING_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      setRbId(hdrMeta.RBID);

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: Number(session.loginId) || DEFAULT_LOGIN_ID,
      });
      const links = normalizeDetailColLinks(resolveDetailColLinks(colData));
      setHeaderColumns(links);
      return links;
    } catch (err) {
      console.error("[MNT Call Reporting] fetchHeaderMeta failed:", err);
      setHeaderColumns([]);
      setHeaderError(err?.message || "Failed to load Call Reporting RB controls.");
      throw err;
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchDetailGridMetas = useCallback(async (divisionId = 0) => {
    setGridsFetching(true);
    try {
      const [newMeta, oldMeta] = await Promise.all([
        loadRbDetailGridMeta(
          get,
          MNT_REPORTING_CONFIG.RB_NEW_PARTS_DETAIL,
          MNT_REPORTING_CONFIG.STORAGE_NEW_PARTS_META
        ),
        loadRbDetailGridMeta(
          get,
          MNT_REPORTING_CONFIG.RB_OLD_PARTS_DETAIL,
          MNT_REPORTING_CONFIG.STORAGE_OLD_PARTS_META
        ),
      ]);

      newPartsApiColsRef.current = newMeta.apiColumns;
      oldPartsApiColsRef.current = oldMeta.apiColumns;
      newPartsMetaRef.current = newMeta.meta;
      oldPartsMetaRef.current = oldMeta.meta;

      setNewPartsAllColumns(
        newMeta.apiColumns.map((c) => ({
          key: c.colname,
          colDataType: c.coldatatype || null,
        }))
      );
      setOldPartsAllColumns(
        oldMeta.apiColumns.map((c) => ({
          key: c.colname,
          colDataType: c.coldatatype || null,
        }))
      );

      const [newOpts, oldOpts] = await Promise.all([
        fetchDropdownOptions(get, newMeta.apiColumns, newMeta.meta.RBID, {
          funcCode: MNT_REPORTING_CONFIG.RB_NEW_PARTS_DETAIL,
          divisionID: Number(divisionId) || 0,
        }),
        fetchDropdownOptions(get, oldMeta.apiColumns, oldMeta.meta.RBID, {
          funcCode: MNT_REPORTING_CONFIG.RB_OLD_PARTS_DETAIL,
          divisionID: Number(divisionId) || 0,
        }),
      ]);

      setNewPartsColumns(
        buildGridColumns(newMeta.apiColumns, newOpts, {
          filterable: false,
          allEditable: true,
        })
      );
      setOldPartsColumns(
        buildGridColumns(oldMeta.apiColumns, oldOpts, {
          filterable: false,
          allEditable: true,
        })
      );
    } catch (err) {
      console.error("[MNT Call Reporting] fetchDetailGridMetas failed:", err);
      setNewPartsColumns([]);
      setOldPartsColumns([]);
      throw err;
    } finally {
      setGridsFetching(false);
    }
  }, [get]);

  const fetchFillRows = useCallback(
    async (spName, fillParams) => {
      const fillRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: MNT_REPORTING_CONFIG.LIST_OBJ_TYPE,
        ObjName: spName,
        JSon: JSON.stringify([fillParams]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      return resolveDetailColLinks(fillRes);
    },
    [get]
  );

  const fetchPopupRecord = useCallback(
    async ({ dashboardRow, filterContext, fieldDefs }) => {
      const session = getUserSession();
      const rbRowId = resolveDashboardRowId(dashboardRow);
      const companyId = Number(session.companyId) || DEFAULT_COMPANY_ID;
      const yearId = Number(session.yearId) || MNT_REPORTING_CONFIG.CONFIG_YEAR_ID;
      const loginId = Number(session.loginId) || DEFAULT_LOGIN_ID;
      const sessionId = MNT_REPORTING_CONFIG.DEFAULT_SESSION_ID;
      const masterId =
        Number(pickCI(dashboardRow, "masterid") ?? pickCI(dashboardRow, "MasterID"))
        || MNT_REPORTING_CONFIG.DEFAULT_MASTER_ID;

      if (!rbRowId) {
        throw new Error("Selected maintenance call has no row id for Call Reporting.");
      }

      const fillParams = {
        prmcompanyid: companyId,
        prmyearid: yearId,
        prmloginid: loginId,
        prmsessionid: sessionId,
        prmmasterid: masterId,
        prmrbrowid: rbRowId,
      };

      await loadHeaderDropdowns(filterContext);

      const [masterRows, newPartRows, oldPartRows] = await Promise.all([
        fetchFillRows(MNT_REPORTING_CONFIG.SP_MASTER_FILL, fillParams),
        fetchFillRows(MNT_REPORTING_CONFIG.SP_NEW_PARTS_FILL, fillParams),
        fetchFillRows(MNT_REPORTING_CONFIG.SP_OLD_PARTS_FILL, fillParams),
      ]);

      const master = masterRows[0] ?? null;
      const cols = fieldDefs || [];

      const headerValues = master
        ? applyReportingDefaults(
          mapMasterRowToHeaderValues(master, cols, {
            companyId,
            yearId,
            loginId,
            sessionId,
            idNumber: rbRowId,
            funcCode: MNT_REPORTING_CONFIG.RB_MASTER,
          })
        )
        : null;

      return {
        master,
        headerValues,
        dashboardRowId: rbRowId,
        newParts: mapDetailRowsToGridRows(newPartRows),
        oldParts: mapDetailRowsToGridRows(oldPartRows),
      };
    },
    [fetchFillRows, loadHeaderDropdowns]
  );

  const fetchItemPicker = useCallback(
    async ({ pickerRb, pickerSp, payload }) => {
      const rbRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: MNT_REPORTING_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: pickerRb }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRows = resolveDetailColLinks(rbRes);
      const rbRow = rbRows[0];
      const rbid = rbRow?.RBID ?? rbRow?.rbid;
      if (!rbid) throw new Error("Could not load item picker configuration.");

      const session = getUserSession();
      const colRes = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbid,
        prmLoginID: Number(session.loginId) || DEFAULT_LOGIN_ID,
      });
      const apiColumns = resolveDetailColLinks(colRes);
      const gridColumns = buildGridColumns(apiColumns, {}, {
        filterable: false,
        allEditable: false,
      });

      const rowRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: pickerSp,
        JSon: JSON.stringify([payload]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      return {
        columns: gridColumns,
        items: resolveDetailColLinks(rowRes),
      };
    },
    [get]
  );

  const seedOptionsFromMaster = useCallback((master, fieldDefs = []) => {
    if (!master) return;
    const cols = fieldDefs.length ? fieldDefs : headerColumns;
    setDropdownOptions((prev) => seedMasterDropdownOptions(cols, master, prev));
  }, [headerColumns]);

  const resetMeta = useCallback(() => {
    setHeaderColumns([]);
    setDropdownOptions({});
    setHeaderError(null);
    setRbId(null);
    setNewPartsColumns([]);
    setOldPartsColumns([]);
    setNewPartsAllColumns([]);
    setOldPartsAllColumns([]);
    newPartsApiColsRef.current = [];
    oldPartsApiColsRef.current = [];
    newPartsMetaRef.current = null;
    oldPartsMetaRef.current = null;
  }, []);

  return {
    headerColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    rbId,
    newPartsColumns,
    oldPartsColumns,
    newPartsAllColumns,
    oldPartsAllColumns,
    gridsFetching,
    fetchHeaderMeta,
    fetchDetailGridMetas,
    fetchPopupRecord,
    fetchItemPicker,
    seedOptionsFromMaster,
    resetMeta,
  };
}
