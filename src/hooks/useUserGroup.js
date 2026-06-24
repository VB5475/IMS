import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { fetchDropdownOptions } from "../utils/gridUtils";
import { getVisibleHeaderFields } from "../utils/masterFormUtils";
import { UG_CONFIG } from "../pages/user-group/constants";

/**
 * Maps fn_tbl_RB_GenUserGroupMst / GetMasterDataFill Links[0] to form values
 * using visible GET_DETAIL_COL_DATA columns.
 */
function mapMasterRowToHeaderValues(master, fieldDefs, params) {
  const header = {
    IDNumber: Number(master.IDNumber ?? params.idNumber) || 0,
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(master.YearID ?? params.yearId) || UG_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(master.LoginID ?? params.loginId) || DEFAULT_LOGIN_ID,
    SessionID: Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    FuncCode: master.FuncCode ?? UG_CONFIG.RB_MASTER,
  };

  getVisibleHeaderFields(fieldDefs).forEach((field) => {
    const key = field.ColName;
    if (!key || master[key] === undefined) return;
    header[key] = master[key];
  });

  return header;
}

export function useUserGroup() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: UG_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: UG_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No User Group RB metadata returned.");

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(UG_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const links = colData?.Links || [];
      setHeaderColumns(links);

      const headerCols = links.filter((c) => c.ColSeqNo < 100 && c.IsVisible);
      const dropdownOpts = await fetchDropdownOptions(get, headerCols, hdrMeta.RBID, {
        funcCode: UG_CONFIG.RB_MASTER,
        divisionID: UG_CONFIG.LIST_DIVISION_ID,
      });
      setDropdownOptions(dropdownOpts);

      if (process.env.NODE_ENV !== "production") {
        console.log("[UG] GetDetailColData sample:", colData?.Links?.[0]);
      }
    } catch (err) {
      console.error("[UG] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load User Group configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = [
        Number(companyId) || DEFAULT_COMPANY_ID,
        Number(yearId) || UG_CONFIG.CONFIG_YEAR_ID,
        Number(loginId) || DEFAULT_LOGIN_ID,
        Number(sessionId) || DEFAULT_SESSION_ID,
        Number(idNumber) || 0,
      ].join(",");

      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: UG_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: UG_CONFIG.RB_MASTER,
      });
      const master = mstRes?.Links?.[0] ?? null;
      return {
        master,
        headerValues: master
          ? mapMasterRowToHeaderValues(master, headerColumns, {
              companyId,
              yearId,
              loginId,
              sessionId,
              idNumber,
            })
          : null,
      };
    },
    [get, headerColumns]
  );

  /** List rows from Fn_tbl_Gen_GroupMaster_List (MRD SP_LIST). */
  const fetchListRows = useCallback(async (listParams) => {
    const listRes = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
    return listRes?.Table ?? listRes?.Links ?? [];
  }, [get]);

  return {
    headerColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchEditRecord,
    fetchListRows,
  };
}
