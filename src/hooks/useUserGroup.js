import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { UG_CONFIG } from "../pages/user-group/constants";

// ---------------------------------------------------------------------------
// Dual-case normalization — PG returns lowercase; legacy utilities need ColName
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
    ColName:               colname,
    ColSeqNo:              colseqno,
    IsVisible:             isvisible,
    ColCtrlType:           colctrltype,
    UpdateKeyColName:      updatekeycolname,
    DisplayName:           displayname,
    IsEditAllow:           iseditallow,
    IsLockOnEditModeAllow: islockoneditmodeallow,
    ObjDetID:              objdetid,
    IsMandatory:           ismandatory,
    ColDataType:           coldatatype,
  };
}

export function useUserGroup() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns,   setHeaderColumns]   = useState([]);
  const [allColumns,      setAllColumns]      = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching,  setHeaderFetching]  = useState(false);
  const [headerError,     setHeaderError]     = useState(null);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID (lowercase param key for PG)
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   UG_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmrbcode: UG_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No User Group RB metadata returned.");

      // PG returns lowercase keys — fall back to PascalCase for compatibility
      const rbidVal = tableRow.rbid ?? tableRow.RBID;
      if (!rbidVal) throw new Error("No User Group RB metadata returned.");

      const hdrMeta = {
        RBID:         rbidVal,
        SaveProcName: tableRow.saveprocname ?? tableRow.SaveProcName,
      };
      localStorage.setItem(UG_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions; PG returns flat array (not { Links: [...] })
      const colData  = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      const rawLinks = Array.isArray(colData) ? colData : (colData || []);
      const links    = rawLinks.map(normalizeColumn);
      setHeaderColumns(links);
      setAllColumns(links.map((c) => ({ key: c.colname, colDataType: c.coldatatype ?? null })));

      // Phase 3 — User Group has no dropdown fields; dropdownOptions stays empty
      setDropdownOptions({});
    } catch (err) {
      console.error("[UG] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load User Group configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // PG returns lowercase keys — spread master directly as headerValues.
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const prmParameters = [
      Number(companyId)  || DEFAULT_COMPANY_ID,
      Number(yearId)     || UG_CONFIG.CONFIG_YEAR_ID,
      Number(loginId)    || DEFAULT_LOGIN_ID,
      Number(sessionId)  || DEFAULT_SESSION_ID,
      Number(idNumber)   || 0,
    ].join(",");

    const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
      prmProcedure: UG_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode:  UG_CONFIG.RB_MASTER,
    });
    const master = Array.isArray(mstRes) ? mstRes[0] : (mstRes?.[0] ?? null);
    return {
      master,
      headerValues: master ? {
        ...master,
        yearid:    UG_CONFIG.CONFIG_YEAR_ID,
        funccode:  UG_CONFIG.RB_MASTER,
        loginid:   Number(master.loginid   ?? loginId)   || DEFAULT_LOGIN_ID,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
      } : null,
    };
  }, [get]);

  const fetchListRows = useCallback(async (listParams) => {
    const res = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
    return Array.isArray(res) ? res : (res ?? res ?? []);
  }, [get]);

  return {
    headerColumns,
    allColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchEditRecord,
    fetchListRows,
  };
}
