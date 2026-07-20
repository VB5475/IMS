import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { seedMasterDropdownOptions } from "../utils/gridUtils";
import {
  mapMasterRowToHeaderValues,
  normalizeDetailColLinks,
  resolveDetailColLinks,
} from "../utils/masterFormUtils";
import { MNT_CALL_CONFIG } from "../pages/call-allocation/constants";

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

function todayIsoDate() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Dashboard selected row → prmrbrowid for fn_tbl_rb_mntallocation. */
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
      const value = String(pickCI(row, "allocateduserid") ?? "");
      const label = String(pickCI(row, "allocatedusername") ?? value).trim();
      if (!value) return null;
      return {
        value,
        label: label || value,
        allocatedusercode: pickCI(row, "allocatedusercode") ?? "",
        isadminuser: Number(pickCI(row, "isadminuser")) || 0,
        userdeptid: Number(pickCI(row, "userdeptid")) || 0,
      };
    })
    .filter(Boolean);
}

function applyAllocationDefaults(headerValues) {
  const next = { ...headerValues };
  next.trandate = toDateInput(next.trandate) || todayIsoDate();
  next.expecteddate = toDateInput(next.expecteddate) || todayIsoDate();
  return next;
}

/**
 * Call Allocation — RB-driven popup (MRD rb_mntallocation).
 * Controls: Fn_Fetch_RBDetailByRBCode → GetDetailColData
 * Fill:     fn_tbl_rb_mntallocation via FN_Fetch_Data
 */
export function useMntCallAllocation() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [rbId, setRbId] = useState(null);

  const fetchAllocatedUserOptions = useCallback(
    async ({ divisionId = 0, locationId = 0, deptId = 0 } = {}) => {
      try {
        const session = getUserSession();
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: MNT_CALL_CONFIG.LIST_OBJ_TYPE,
          ObjName: MNT_CALL_CONFIG.SP_ALLOCATED_USER,
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
        console.warn(`[MNT Call] ${MNT_CALL_CONFIG.SP_ALLOCATED_USER} fetch failed:`, err);
        return [];
      }
    },
    [get]
  );

  const loadAllocatedUserOptions = useCallback(
    async (filterContext = {}) => {
      const opts = await fetchAllocatedUserOptions({
        divisionId: filterContext.divisionid,
        locationId: filterContext.locationid,
        deptId: filterContext.deptid,
      });
      setDropdownOptions((prev) => ({
        ...prev,
        [MNT_CALL_CONFIG.ALLOCATED_USER_COL]: opts,
      }));
      return opts;
    },
    [fetchAllocatedUserOptions]
  );

  /**
   * MRD §5 / §5.1 — Master Data RB rb_mntallocation
   * 1) Fn_Fetch_RBDetailByRBCode → RBID
   * 2) GetDetailColData → header controls for the popup
   */
  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const session = getUserSession();
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: MNT_CALL_CONFIG.LIST_OBJ_TYPE,
        ObjName: MNT_CALL_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: MNT_CALL_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const metaRows = resolveDetailColLinks(metaData);
      const tableRow = metaRows[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) throw new Error("No Call Allocation RB metadata returned for rb_mntallocation.");

      const hdrMeta = {
        RBID: rbid,
        SaveProcName: tableRow?.SaveProcName ?? tableRow?.saveprocname,
      };
      localStorage.setItem(MNT_CALL_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      setRbId(hdrMeta.RBID);

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: Number(session.loginId) || DEFAULT_LOGIN_ID,
      });
      const links = normalizeDetailColLinks(resolveDetailColLinks(colData));
      setHeaderColumns(links);
      return links;
    } catch (err) {
      console.error("[MNT Call] fetchHeaderMeta failed:", err);
      setHeaderColumns([]);
      setHeaderError(err?.message || "Failed to load Call Allocation RB controls.");
      throw err;
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  /**
   * MRD §5 — fn_tbl_rb_mntallocation loads popup form data.
   * Params: companyid, yearid, loginid, sessionid, masterid, rbrowid
   */
  const fetchPopupRecord = useCallback(
    async ({ dashboardRow, filterContext, fieldDefs }) => {
      const session = getUserSession();
      const rbRowId = resolveDashboardRowId(dashboardRow);
      const companyId = Number(session.companyId) || DEFAULT_COMPANY_ID;
      const yearId = Number(session.yearId) || MNT_CALL_CONFIG.CONFIG_YEAR_ID;
      const loginId = Number(session.loginId) || DEFAULT_LOGIN_ID;
      const sessionId = MNT_CALL_CONFIG.DEFAULT_SESSION_ID;
      const masterId =
        Number(pickCI(dashboardRow, "masterid") ?? pickCI(dashboardRow, "MasterID"))
        || MNT_CALL_CONFIG.DEFAULT_MASTER_ID;

      if (!rbRowId) {
        throw new Error("Selected maintenance call has no row id for Call Allocation.");
      }

      const fillRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: MNT_CALL_CONFIG.LIST_OBJ_TYPE,
        ObjName: MNT_CALL_CONFIG.SP_MASTER_FILL,
        JSon: JSON.stringify([{
          prmcompanyid: companyId,
          prmyearid: yearId,
          prmloginid: loginId,
          prmsessionid: sessionId,
          prmmasterid: masterId,
          prmrbrowid: rbRowId,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const master = resolveDetailColLinks(fillRes)[0] ?? null;
      const cols = fieldDefs || [];

      await loadAllocatedUserOptions(filterContext);

      const headerValues = master
        ? applyAllocationDefaults(
          mapMasterRowToHeaderValues(master, cols, {
            companyId,
            yearId,
            loginId,
            sessionId,
            // Always use the dashboard selected record id for save (MRD popup from grid).
            idNumber: rbRowId,
            funcCode: MNT_CALL_CONFIG.RB_MASTER,
          })
        )
        : null;

      return { master, headerValues, dashboardRowId: rbRowId };
    },
    [get, loadAllocatedUserOptions]
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
  }, []);

  return {
    headerColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    rbId,
    fetchHeaderMeta,
    fetchPopupRecord,
    loadAllocatedUserOptions,
    seedOptionsFromMaster,
    resetMeta,
  };
}
