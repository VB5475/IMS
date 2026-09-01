import { useState, useCallback, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
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
import { MNT_FOLLOWUP_CONFIG } from "../pages/call-follow-up/constants";

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

/** Dashboard selected row → prmrbrowid for fn_tbl_rb_mntfollowup. */
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

function applyFollowUpDefaults(headerValues) {
  const next = { ...headerValues };
  const dateKeys = [
    "amcdate",
    "periodfromdate",
    "periodtodate",
    "dateofcall",
    "expdate",
  ];
  dateKeys.forEach((key) => {
    if (next[key] != null && next[key] !== "") {
      next[key] = toDateInput(next[key]);
    }
  });
  if (!next.expdate) next.expdate = todayIsoDate();
  return next;
}

/**
 * Call Follow Up — RB-driven popup (MRD rb_mntfollowup).
 * Controls: Fn_Fetch_RBDetailByRBCode → GetDetailColData
 * Fill:     fn_tbl_rb_mntfollowup via FN_Fetch_Data
 */
export function useMntCallFollowUp() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [rbId, setRbId] = useState(null);

  /**
   * MRD §5 / §5.1 — Master Data RB rb_mntfollowup
   * 1) Fn_Fetch_RBDetailByRBCode → RBID
   * 2) GetDetailColData → header controls for the popup
   */
  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const session = getUserSession();
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: MNT_FOLLOWUP_CONFIG.LIST_OBJ_TYPE,
        ObjName: MNT_FOLLOWUP_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: MNT_FOLLOWUP_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const metaRows = resolveDetailColLinks(metaData);
      const tableRow = metaRows[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) throw new Error("No Call Follow Up RB metadata returned for rb_mntfollowup.");

      const hdrMeta = {
        RBID: rbid,
        SaveProcName: tableRow?.SaveProcName ?? tableRow?.saveprocname,
      };
      localStorage.setItem(MNT_FOLLOWUP_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      setRbId(hdrMeta.RBID);

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: Number(session.loginId) || DEFAULT_LOGIN_ID,
      });
      const links = normalizeDetailColLinks(resolveDetailColLinks(colData));
      setHeaderColumns(links);
      return links;
    } catch (err) {
      console.error("[MNT FollowUp] fetchHeaderMeta failed:", err);
      setHeaderColumns([]);
      setHeaderError(err?.message || "Failed to load Call Follow Up RB controls.");
      throw err;
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  /**
   * MRD §5 — fn_tbl_rb_mntfollowup loads popup form data.
   * Params mirror Call Allocation: companyid, yearid, loginid, sessionid, masterid, rbrowid
   */
  const fetchPopupRecord = useCallback(
    async ({ dashboardRow, fieldDefs }) => {
      const session = getUserSession();
      const rbRowId = resolveDashboardRowId(dashboardRow);
      const companyId = Number(session.companyId) || DEFAULT_COMPANY_ID;
      const yearId = Number(session.yearId) || MNT_FOLLOWUP_CONFIG.CONFIG_YEAR_ID;
      const loginId = Number(session.loginId) || DEFAULT_LOGIN_ID;
      const sessionId = MNT_FOLLOWUP_CONFIG.DEFAULT_SESSION_ID;
      const masterId =
        Number(pickCI(dashboardRow, "masterid") ?? pickCI(dashboardRow, "MasterID"))
        || MNT_FOLLOWUP_CONFIG.DEFAULT_MASTER_ID;

      if (!rbRowId) {
        throw new Error("Selected maintenance call has no row id for Call Follow Up.");
      }

      const fillRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: MNT_FOLLOWUP_CONFIG.LIST_OBJ_TYPE,
        ObjName: MNT_FOLLOWUP_CONFIG.SP_MASTER_FILL,
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

      const headerValues = master
        ? applyFollowUpDefaults(
          mapMasterRowToHeaderValues(master, cols, {
            companyId,
            yearId,
            loginId,
            sessionId,
            idNumber: rbRowId,
            funcCode: MNT_FOLLOWUP_CONFIG.RB_MASTER,
          })
        )
        : null;

      return { master, headerValues, dashboardRowId: rbRowId };
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
  }, []);

  return {
    headerColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    rbId,
    fetchHeaderMeta,
    fetchPopupRecord,
    seedOptionsFromMaster,
    resetMeta,
  };
}
