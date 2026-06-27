import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { formatTranDate } from "../utils/dateFormat";
import { mapRowToFieldValues } from "../utils/gridUtils";
import {
  getCheckboxValue,
  isMasterCheckboxField,
} from "../utils/masterFormUtils";
import { UDR_CONFIG } from "../pages/division-wise-rights/constants";

function getUdrGridColumnDefs(links) {
  const byName = Object.fromEntries((links ?? []).map((c) => [c.ColName, c]));
  return UDR_CONFIG.GRID_ROW_COLS.map((name) => byName[name]).filter(Boolean);
}

function buildUserListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  return {
    ObjType: UDR_CONFIG.LIST_OBJ_TYPE,
    ObjName: UDR_CONFIG.SP_USER_LIST,
    JSon: JSON.stringify([
      {
        PrmCompanyID: DEFAULT_COMPANY_ID,
        prmDivisionID: UDR_CONFIG.LIST_DIVISION_ID,
        prmFromDate: today,
        prmToDate: today,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function mapUserOptions(table) {
  return (table ?? [])
    .map((row) => {
      const value = row.UserID ?? row.IDNumber ?? row.Idnumber;
      if (value == null || value === "") return null;
      const num = Number(value);
      const valueStr = Number.isFinite(num) ? String(Math.round(num)) : String(value);
      return {
        value: valueStr,
        label: String(row.UserName ?? row.Name ?? row.UserID ?? valueStr),
      };
    })
    .filter(Boolean);
}

function buildGridFillParameterString(masterId, tranBook) {
  return [
    Number(DEFAULT_COMPANY_ID) || 0,
    UDR_CONFIG.CONFIG_YEAR_ID,
    Number(DEFAULT_LOGIN_ID) || 0,
    Number(DEFAULT_SESSION_ID) || 0,
    Number(masterId) || 0,
    `'${tranBook}'`,
  ].join(",");
}

function mapGridRowFromApi(row, gridColumnDefs, userId, tranBook) {
  const mapped = mapRowToFieldValues(row, gridColumnDefs, {
    UserID: row.UserID ?? userId,
    TranBook: row.TranBook ?? tranBook,
  });

  gridColumnDefs.forEach((col) => {
    const key = col.ColName;
    if (!key) return;
    if (isMasterCheckboxField(col) && mapped[key] !== undefined) {
      mapped[key] = getCheckboxValue(mapped[key]);
    }
    if (key === UDR_CONFIG.GRID_ALLOW_COL && mapped[key] !== undefined) {
      mapped[key] = getCheckboxValue(mapped[key]);
    }
    if (key === "Division" && !mapped[key] && row.DivisionName) {
      mapped[key] = row.DivisionName;
    }
    if (key === "DivisionID" && mapped[key] != null) {
      mapped[key] = Number(mapped[key]) || 0;
    }
  });

  return mapped;
}

export function useDivisionWiseRights() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [gridColumns, setGridColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const fetchUserOptions = useCallback(async () => {
    const res = await get(ENDPOINTS.FN_FETCH_DATA, buildUserListParams()).catch((err) => {
      console.warn("[UDR] User list fetch failed:", err);
      return null;
    });
    return mapUserOptions(res?.Table ?? res?.Links);
  }, [get]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: UDR_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: UDR_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow?.RBID) {
        throw new Error("No Division Wise Rights RB metadata returned.");
      }

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(UDR_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const links = colData?.Links || [];
      const gridCols = getUdrGridColumnDefs(links);

      setHeaderColumns(links);
      setGridColumns(gridCols);

      const userOptions = await fetchUserOptions();
      setDropdownOptions({ UserID: userOptions });
    } catch (err) {
      console.error("[UDR] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Division Wise Rights configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchUserOptions]);

  const fetchGridRows = useCallback(
    async ({ userId, tranBook, gridColumnDefs = gridColumns }) => {
      if (!userId) return [];

      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: UDR_CONFIG.SP_MASTER_FILL,
        prmParameters: buildGridFillParameterString(userId, tranBook),
        prmFuncCode: UDR_CONFIG.RB_MASTER,
      });

      const rows = mstRes?.Links ?? mstRes?.Table ?? [];
      return rows.map((row) => mapGridRowFromApi(row, gridColumnDefs, userId, tranBook));
    },
    [get, gridColumns]
  );

  return {
    headerColumns,
    gridColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchGridRows,
  };
}
