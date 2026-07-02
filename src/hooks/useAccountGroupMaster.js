import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import {
  fetchDropdownOptions,
  isTruthyApiFlag,
  seedMasterDropdownOptions,
} from "../utils/gridUtils";
import {
  getVisibleHeaderFields,
  normalizeDetailColLinks,
} from "../utils/masterFormUtils";
import { AGM_CONFIG } from "../pages/account-group-master/constants";

function pickCI(obj, key) {
  if (!obj || key == null) return undefined;
  if (key in obj) return obj[key];
  const lower = key.toLowerCase();
  const found = Object.keys(obj).find((k) => k.toLowerCase() === lower);
  return found !== undefined ? obj[found] : undefined;
}

function mapMasterRowToHeaderValues(master, fieldDefs, params) {
  const header = {
    IDNumber: Number(pickCI(master, "IDNumber") ?? params.idNumber) || 0,
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(pickCI(master, "YearID") ?? params.yearId) || AGM_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(pickCI(master, "LoginID") ?? params.loginId) || DEFAULT_LOGIN_ID,
    SessionID: Number(pickCI(master, "SessionID") ?? params.sessionId) || DEFAULT_SESSION_ID,
    FuncCode: pickCI(master, "FuncCode") ?? AGM_CONFIG.RB_MASTER,
  };

  getVisibleHeaderFields(fieldDefs).forEach((field) => {
    const key = field.ColName;
    if (!key) return;
    const val = pickCI(master, key);
    if (val !== undefined) header[key] = val;
  });

  return header;
}

function buildMasterFillParameterString({ companyId, yearId, loginId, sessionId, masterId }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || AGM_CONFIG.CONFIG_YEAR_ID,
    Number(loginId) || DEFAULT_LOGIN_ID,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(masterId) || 0,
  ].join(",");
}

/** Fn_tbl_AccountGroup — [{ idnumber, grpname }, …] */
function mapMainGroupRows(table) {
  return (table ?? [])
    .map((row) => {
      const rawId = pickCI(row, "idnumber");
      if (rawId == null || rawId === "") return null;
      const value = String(Number(rawId) || rawId);
      const label = String(pickCI(row, "grpname") ?? value).trim();
      return { value, label: label || value };
    })
    .filter(Boolean);
}

function resolveLinks(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.Links)) return payload.Links;
  if (Array.isArray(payload?.Table)) return payload.Table;
  return [];
}

function isMainGroupCol(col) {
  const name = String(col.ColName ?? col.colname ?? "").toLowerCase();
  if (name === AGM_CONFIG.MAIN_GROUP_COL.toLowerCase()) return true;
  const label = String(col.DisplayName ?? col.displayname ?? "").toLowerCase();
  return label === "main group";
}

function findMainGroupColumn(links) {
  return (links || []).find((col) => isMainGroupCol(col));
}

function getMainGroupColKey(links) {
  return findMainGroupColumn(links)?.ColName ?? AGM_CONFIG.MAIN_GROUP_COL;
}

function isVisibleHeaderCol(col) {
  const seq = Number(col.ColSeqNo ?? col.colseqno);
  const visible = col.IsVisible ?? col.isvisible;
  return isTruthyApiFlag(visible) && seq < 100;
}

export function useAccountGroupMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [rbId, setRbId] = useState(null);

  /** Main Group — FN_Fetch_Data with ObjName Fn_tbl_AccountGroup, JSon [{}] (MRD §3). */
  const fetchMainGroupOptions = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: AGM_CONFIG.LIST_OBJ_TYPE,
        ObjName: AGM_CONFIG.SP_MAIN_GROUP,
        JSon: JSON.stringify([{}]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rows = Array.isArray(res) ? res : resolveLinks(res);
      const mapped = mapMainGroupRows(rows);
      return mapped;
    } catch (err) {
      console.warn(`[AGM] ${AGM_CONFIG.SP_MAIN_GROUP} fetch failed:`, err);
      return [];
    }
  }, [get]);

  const loadMainGroupOptions = useCallback(async () => {
    const opts = await fetchMainGroupOptions();
    const colKey = getMainGroupColKey(headerColumns);
    setDropdownOptions((prev) => ({ ...prev, [colKey]: opts }));
    return opts;
  }, [fetchMainGroupOptions, headerColumns]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: AGM_CONFIG.LIST_OBJ_TYPE,
        ObjName: AGM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: AGM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const metaRows = resolveLinks(metaData);
      const tableRow = metaRows[0];
      const rbid = tableRow?.RBID ?? tableRow?.rbid;
      if (!rbid) throw new Error("No Account Group Master RB metadata returned.");

      const hdrMeta = {
        RBID: rbid,
        SaveProcName: tableRow?.SaveProcName ?? tableRow?.saveprocname,
      };
      localStorage.setItem(AGM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      setRbId(hdrMeta.RBID);

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const links = normalizeDetailColLinks(colData?.Links ?? resolveLinks(colData));
      setHeaderColumns(links);

      const mainGroupColKey = getMainGroupColKey(links);
      const visibleHeaderCols = links.filter(
        (col) => isVisibleHeaderCol(col) && !isMainGroupCol(col)
      );

      const [stdDropdownOpts, mainGroupOpts] = await Promise.all([
        fetchDropdownOptions(get, visibleHeaderCols, hdrMeta.RBID, {
          funcCode: AGM_CONFIG.RB_MASTER,
          divisionID: AGM_CONFIG.LIST_DIVISION_ID,
        }),
        fetchMainGroupOptions(),
      ]);

      const mergedDropdownOptions = {
        ...stdDropdownOpts,
        [mainGroupColKey]: mainGroupOpts,
      };
      setDropdownOptions(mergedDropdownOptions);
    } catch (err) {
      console.error("[AGM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Account Group Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchMainGroupOptions]);

  const refreshDropdownOptions = useCallback(
    async (parentColName) => {
      if (!rbId) return;

      const mainGroupColKey = getMainGroupColKey(headerColumns);
      const parentLower = String(parentColName ?? "").toLowerCase();
      if (parentLower === mainGroupColKey.toLowerCase()) {
        const mainGroupOpts = await fetchMainGroupOptions();
        setDropdownOptions((prev) => ({
          ...prev,
          [mainGroupColKey]: mainGroupOpts,
        }));
        return;
      }

      const childNames = (headerColumns ?? [])
        .filter((c) => String(c.UpdateKeyColName ?? c.updatekeycolname ?? "").trim() === parentColName)
        .map((c) => c.ColName ?? c.colname)
        .filter(Boolean);
      if (!childNames.length) return;

      const colsToRefresh = headerColumns.filter((c) =>
        childNames.includes(c.ColName ?? c.colname)
      );
      const refreshed = await fetchDropdownOptions(get, colsToRefresh, rbId, {
        funcCode: AGM_CONFIG.RB_MASTER,
        divisionID: AGM_CONFIG.LIST_DIVISION_ID,
      });
      setDropdownOptions((prev) => ({ ...prev, ...refreshed }));
    },
    [get, fetchMainGroupOptions, headerColumns, rbId]
  );

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: AGM_CONFIG.SP_MASTER_FILL,
        prmParameters: buildMasterFillParameterString({
          companyId,
          yearId,
          loginId,
          sessionId,
          masterId: idNumber,
        }),
        prmFuncCode: AGM_CONFIG.RB_MASTER,
      });

      const master = resolveLinks(mstRes)[0] ?? null;

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

  const fetchListRows = useCallback(
    async (listParams) => {
      const listRes = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
      return resolveLinks(listRes);
    },
    [get]
  );

  const seedOptionsFromMaster = useCallback(
    (master) => {
      if (!master) return;
      setDropdownOptions((prev) => seedMasterDropdownOptions(headerColumns, master, prev));
    },
    [headerColumns]
  );

  return {
    headerColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchEditRecord,
    fetchListRows,
    loadMainGroupOptions,
    refreshDropdownOptions,
    seedOptionsFromMaster,
  };
}
