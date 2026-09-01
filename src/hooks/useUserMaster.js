import { useState, useCallback, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { UM_CONFIG } from "../pages/user-master/constants";

const EMPTY_JSON = JSON.stringify([{}]);

// ---------------------------------------------------------------------------
// Dual-case normalization — PG returns lowercase; MasterFormField needs ColName
// ---------------------------------------------------------------------------
function normalizeColumn(col) {
  const colname               = col.colname               ?? "";
  const colseqno              = col.colseqno              ?? 999;
  const isvisible             = col.isvisible             ?? false;
  const colctrltype           = col.colctrltype           ?? 0;
  const updatekeycolname      = col.updatekeycolname      ?? "";
  const displayname           = col.displayname           ?? colname;
  const iseditallow           = col.iseditallow           ?? false;
  const islockoneditmodeallow = col.islockoneditmodeallow ?? false;
  const objdetid              = col.objdetid              ?? null;
  const ismandatory           = col.ismandatory           ?? false;
  const coldatatype           = col.coldatatype           ?? null;
  const ctrlvaluecol          = col.ctrlvaluecol          ?? colname;
  const ctrldisplaycol        = col.ctrldisplaycol        ?? colname;
  return {
    ...col,
    colname, colseqno, isvisible, colctrltype, updatekeycolname,
    displayname, iseditallow, islockoneditmodeallow, objdetid,
    ismandatory, coldatatype, ctrlvaluecol, ctrldisplaycol,
    ColName: colname,
    ColSeqNo: colseqno,
    IsVisible: isvisible,
    ColCtrlType: colctrltype,
    UpdateKeyColName: updatekeycolname,
    DisplayName: displayname,
    IsEditAllow: iseditallow,
    IsLockOnEditModeAllow: islockoneditmodeallow,
    ObjDetID: objdetid,
    IsMandatory: ismandatory,
    ColDataType: coldatatype,
  };
}

// ---------------------------------------------------------------------------
// Dropdown SP map — keyed by lowercase PG colname
// ---------------------------------------------------------------------------
const UM_DROPDOWN_SP = {
  desgid: UM_CONFIG.SP_DESIGNATION,
  groupid: UM_CONFIG.SP_GROUP,
  deptid: UM_CONFIG.SP_DEPARTMENT,
};

// ---------------------------------------------------------------------------
// Option mappers — try PG lowercase keys first, fall back to PascalCase
// ---------------------------------------------------------------------------
function mapDesignationOptions(table) {
  return (table ?? []).map((row) => {
    const value = row.desgid ?? row.DesgID ?? row.idnumber ?? row.IDNumber;
    if (value == null || value === "") return null;
    return {
      value: String(Math.round(Number(value))),
      label: String(row.desgination ?? row.Desgination ?? row.desgname ?? row.DesgName ?? row.name ?? value),
    };
  }).filter(Boolean);
}

function mapGroupOptions(table) {
  return (table ?? []).map((row) => {
    const value = row.groupid ?? row.GroupID ?? row.idnumber ?? row.IDNumber;
    if (value == null || value === "") return null;
    return {
      value: String(Math.round(Number(value))),
      label: String(row.groupname ?? row.GroupName ?? row.group ?? row.Group ?? row.name ?? value),
    };
  }).filter(Boolean);
}

function mapDepartmentOptions(table) {
  return (table ?? []).map((row) => {
    const value = row.deptid ?? row.DeptID ?? row.idnumber ?? row.IDNumber;
    if (value == null || value === "") return null;
    return {
      value: String(Math.round(Number(value))),
      label: String(row.department ?? row.Department ?? row.deptname ?? row.DeptName ?? row.name ?? value),
    };
  }).filter(Boolean);
}

function mapDropdownTable(colName, table) {
  if (colName === "desgid") return mapDesignationOptions(table);
  if (colName === "groupid") return mapGroupOptions(table);
  if (colName === "deptid") return mapDepartmentOptions(table);
  return [];
}

function mapLocationOptions(table) {
  return (table ?? []).map((row) => {
    const value = row.locationid ?? row.LocationID ?? row.idnumber ?? row.IDNumber;
    if (value == null || value === "") return null;
    return {
      value: String(Math.round(Number(value))),
      label: String(row.locationname ?? row.LocationName ?? row.location ?? row.Location ?? row.name ?? value),
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useUserMaster() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const fetchSpTable = useCallback(async (spName) => {
    const res = await get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 2,
      ObjName: spName,
      JSon: EMPTY_JSON,
      p_ErrCode: -1,
      p_ErrMsg: "",
    }).catch((err) => {
      console.warn(`[UM] ${spName} fetch failed:`, err);
      return null;
    });
    // PG returns flat array; legacy SQL Server returned { Table: [...] } or { Links: [...] }
    return Array.isArray(res) ? res : (res?.Table ?? res?.Links ?? []);
  }, [get]);

  const fetchDropdownsForCols = useCallback(async (colNames) => {
    const uniqueCols = [...new Set(colNames)].filter((col) => UM_DROPDOWN_SP[col]);
    if (!uniqueCols.length) return {};
    const entries = await Promise.all(
      uniqueCols.map(async (colName) => {
        const table = await fetchSpTable(UM_DROPDOWN_SP[colName]);
        return [colName, mapDropdownTable(colName, table)];
      })
    );
    return Object.fromEntries(entries);
  }, [fetchSpTable]);

  // Location takes real params (company/login/type) — doesn't fit the no-arg
  // UM_DROPDOWN_SP/fetchSpTable pattern above, so it's fetched separately.
  const fetchLocationOptions = useCallback(async () => {
    const session = getUserSession();
    const res = await get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: 2,
      ObjName: UM_CONFIG.SP_LOCATION,
      JSon: JSON.stringify([{
        prmcompanyid: session.companyId,
        prmloginid: session.loginId,
        prmlocationtype: "",
      }]),
      p_ErrCode: -1,
      p_ErrMsg: "",
    }).catch((err) => {
      console.warn(`[UM] ${UM_CONFIG.SP_LOCATION} fetch failed:`, err);
      return null;
    });
    const table = Array.isArray(res) ? res : (res?.Table ?? res?.Links ?? []);
    return mapLocationOptions(table);
  }, [get]);

  const fetchAllDropdowns = useCallback(async () => {
    const [genericOpts, locationOpts] = await Promise.all([
      fetchDropdownsForCols(Object.keys(UM_DROPDOWN_SP)),
      fetchLocationOptions(),
    ]);
    return { ...genericOpts, locationid: locationOpts };
  }, [fetchDropdownsForCols, fetchLocationOptions]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID (lowercase param key for PG)
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: UM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: UM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No User Master RB metadata returned.");

      // PG returns lowercase keys — fall back to PascalCase for compatibility
      const rbidVal = tableRow.rbid ?? tableRow.RBID;
      if (!rbidVal) throw new Error("No User Master RB metadata returned.");

      const hdrMeta = {
        RBID: rbidVal,
        SaveProcName: tableRow.saveprocname ?? tableRow.SaveProcName,
      };
      localStorage.setItem(UM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions; PG returns flat array (not { Links: [...] })
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      const rawLinks = Array.isArray(colData) ? colData : (colData?.Links || []);
      const links = rawLinks.map(normalizeColumn);
      setHeaderColumns(links);
      setAllColumns(links.map((c) => ({ key: c.colname, colDataType: c.coldatatype ?? null })));

      // Phase 3 — manual SP calls for all dropdowns (Designation, Group, Department)
      const dropdownOpts = await fetchAllDropdowns();
      setDropdownOptions(dropdownOpts);
    } catch (err) {
      console.error("[UM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load User Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchAllDropdowns]);

  // MRD cascade — when desgid changes, refresh groupid + deptid options
  const refreshDropdownOptions = useCallback(async (parentColName) => {
    if (parentColName !== "desgid") return;
    const refreshed = await fetchDropdownsForCols(["groupid", "deptid"]);
    setDropdownOptions((prev) => ({ ...prev, ...refreshed }));
  }, [fetchDropdownsForCols]);

  // Manual per-field refresh — e.g. a "refresh" button next to a dropdown, or
  // after a quick-add modal (Group/Department) saves a new record.
  const refreshDropdownField = useCallback(async (colName) => {
    if (colName === "locationid") {
      const opts = await fetchLocationOptions();
      setDropdownOptions((prev) => ({ ...prev, locationid: opts }));
      return;
    }
    const refreshed = await fetchDropdownsForCols([colName]);
    setDropdownOptions((prev) => ({ ...prev, ...refreshed }));
  }, [fetchDropdownsForCols, fetchLocationOptions]);

  // PG returns lowercase keys — spread master directly; clear password fields.
  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const session = getUserSession();
      const prmParameters = [
        Number(companyId) || session.companyId,
        Number(yearId) || session.yearId,
        Number(loginId) || session.loginId,
        Number(sessionId) || DEFAULT_SESSION_ID,
        Number(idNumber) || 0,
      ].join(",");

      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: UM_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: UM_CONFIG.RB_MASTER,
      });
      const master = Array.isArray(mstRes) ? mstRes[0] : (mstRes?.[0] ?? null);
      return {
        master,
        headerValues: master ? {
          ...master,
          yearid: Number(master.yearid ?? yearId) || session.yearId,
          loginid: Number(master.loginid ?? loginId) || session.loginId,
          sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
          funccode: master.funccode ?? UM_CONFIG.RB_MASTER,
          // fn_tbl_rb_genusermst returns this field under a misspelled key
          // ("locatoinid", letters transposed) — DBA-confirmed live 2026-08-07.
          // Fall back to it so Edit mode still fills the Location dropdown
          // until the backend SP is corrected.
          locationid: master.locationid ?? master.locatoinid,
          pwd: "",       // never prefill password from API
          verifypwd: "",       // synthetic confirm field
        } : null,
      };
    },
    [get]
  );

  const fetchListRows = useCallback(async (listParams) => {
    const res = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
    return Array.isArray(res) ? res : (res?.Table ?? res?.Links ?? []);
  }, [get]);

  // Ensure the selected option for each dropdown appears even if inactive
  // and not returned by the SP (e.g. an archived designation).
  const seedOptionsFromMaster = useCallback((master) => {
    if (!master) return;
    setDropdownOptions((prev) => {
      let next = { ...prev };

      const desgId = master.desgid ?? master.DesgID;
      const desgLabel = master.desgination ?? master.Desgination ?? master.desgname ?? master.DesgName;
      if (desgId != null && desgLabel) {
        const opt = { value: String(desgId), label: String(desgLabel) };
        if (!next.desgid?.some((o) => o.value === opt.value))
          next = { ...next, desgid: [opt, ...(next.desgid || [])] };
      }

      const groupId = master.groupid ?? master.GroupID;
      const groupLabel = master.groupname ?? master.GroupName;
      if (groupId != null && groupLabel) {
        const opt = { value: String(groupId), label: String(groupLabel) };
        if (!next.groupid?.some((o) => o.value === opt.value))
          next = { ...next, groupid: [opt, ...(next.groupid || [])] };
      }

      const deptId = master.deptid ?? master.DeptID;
      const deptLabel = master.deptname ?? master.DeptName ?? master.department ?? master.Department;
      if (deptId != null && deptLabel) {
        const opt = { value: String(deptId), label: String(deptLabel) };
        if (!next.deptid?.some((o) => o.value === opt.value))
          next = { ...next, deptid: [opt, ...(next.deptid || [])] };
      }

      // "locatoinid" fallback — see the same-named comment in fetchEditRecord above.
      const locationId = master.locationid ?? master.LocationID ?? master.locatoinid;
      const locationLabel = master.locationname ?? master.LocationName ?? master.location ?? master.Location;
      if (locationId != null && locationLabel) {
        const opt = { value: String(locationId), label: String(locationLabel) };
        if (!next.locationid?.some((o) => o.value === opt.value))
          next = { ...next, locationid: [opt, ...(next.locationid || [])] };
      }

      return next;
    });
  }, []);

  return {
    headerColumns,
    allColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchEditRecord,
    fetchListRows,
    refreshDropdownOptions,
    refreshDropdownField,
    seedOptionsFromMaster,
  };
}
