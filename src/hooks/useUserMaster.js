import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { seedMasterDropdownOptions } from "../utils/gridUtils";
import { getVisibleHeaderFields } from "../utils/masterFormUtils";
import { UM_CONFIG } from "../pages/user-master/constants";

const EMPTY_JSON = JSON.stringify([{}]);

/** MRD dropdown columns → documented FN_Fetch_Data SP. */
const UM_DROPDOWN_SP = {
  DesgID: UM_CONFIG.SP_DESIGNATION,
  GroupID: UM_CONFIG.SP_GROUP,
  DeptID: UM_CONFIG.SP_DEPARTMENT,
};

function mapDesignationOptions(table) {
  return (table ?? [])
    .map((row) => {
      const value = row.DesgID ?? row.Idnumber ?? row.IDNumber;
      if (value == null || value === "") return null;
      return {
        value: String(Math.round(Number(value))),
        label: String(
          row.Desgination ?? row.DesgName ?? row.Designation ?? row.Name ?? value
        ),
      };
    })
    .filter(Boolean);
}

function mapGroupOptions(table) {
  return (table ?? [])
    .map((row) => {
      const value = row.GroupID ?? row.Idnumber ?? row.IDNumber;
      if (value == null || value === "") return null;
      return {
        value: String(Math.round(Number(value))),
        label: String(row.GroupName ?? row.Group ?? row.Code ?? row.Name ?? value),
      };
    })
    .filter(Boolean);
}

function mapDepartmentOptions(table) {
  return (table ?? [])
    .map((row) => {
      const value = row.DeptID ?? row.Idnumber ?? row.IDNumber;
      if (value == null || value === "") return null;
      return {
        value: String(Math.round(Number(value))),
        label: String(
          row.Department ?? row.DeptName ?? row.DepartmentName ?? row.Code ?? row.Name ?? value
        ),
      };
    })
    .filter(Boolean);
}

function mapDropdownTable(colName, table) {
  if (colName === "DesgID") return mapDesignationOptions(table);
  if (colName === "GroupID") return mapGroupOptions(table);
  if (colName === "DeptID") return mapDepartmentOptions(table);
  return [];
}

function mapMasterRowToHeaderValues(master, fieldDefs, params) {
  const header = {
    IDNumber: Number(master.IDNumber ?? params.idNumber) || 0,
    Pwd: "",
    VerifyPWD: "",
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(master.YearID ?? params.yearId) || UM_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(master.LoginID ?? params.loginId) || DEFAULT_LOGIN_ID,
    SessionID: Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    FuncCode: master.FuncCode ?? UM_CONFIG.RB_MASTER,
  };

  getVisibleHeaderFields(fieldDefs).forEach((field) => {
    const key = field.ColName;
    if (!key || key === "Pwd" || master[key] === undefined) return;
    header[key] = master[key];
  });

  return header;
}

export function useUserMaster() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const fetchSpTable = useCallback(
    async (spName) => {
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
      return res?.Table ?? res?.Links ?? [];
    },
    [get]
  );

  const fetchDropdownsForCols = useCallback(
    async (colNames) => {
      const uniqueCols = [...new Set(colNames)].filter((col) => UM_DROPDOWN_SP[col]);
      if (!uniqueCols.length) return {};

      const entries = await Promise.all(
        uniqueCols.map(async (colName) => {
          const table = await fetchSpTable(UM_DROPDOWN_SP[colName]);
          return [colName, mapDropdownTable(colName, table)];
        })
      );

      return Object.fromEntries(entries);
    },
    [fetchSpTable]
  );

  const fetchAllDropdowns = useCallback(async () => {
    return fetchDropdownsForCols(Object.keys(UM_DROPDOWN_SP));
  }, [fetchDropdownsForCols]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: UM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: UM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.Table?.[0];
      if (!tableRow) throw new Error("No User Master RB metadata returned.");

      const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
      localStorage.setItem(UM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const links = colData?.Links || [];
      setHeaderColumns(links);

      const dropdownOpts = await fetchAllDropdowns();
      setDropdownOptions(dropdownOpts);
    } catch (err) {
      console.error("[UM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load User Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get, fetchAllDropdowns]);

  /** MRD cascade — when Designation changes, reload Group + Department options. */
  const refreshDropdownOptions = useCallback(
    async (parentColName) => {
      if (parentColName !== "DesgID") return;

      const refreshed = await fetchDropdownsForCols(["GroupID", "DeptID"]);
      setDropdownOptions((prev) => ({ ...prev, ...refreshed }));
    },
    [fetchDropdownsForCols]
  );

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = [
        Number(companyId) || DEFAULT_COMPANY_ID,
        Number(yearId) || UM_CONFIG.CONFIG_YEAR_ID,
        Number(loginId) || DEFAULT_LOGIN_ID,
        Number(sessionId) || DEFAULT_SESSION_ID,
        Number(idNumber) || 0,
      ].join(",");

      const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: UM_CONFIG.SP_MASTER_FILL,
        prmParameters,
        prmFuncCode: UM_CONFIG.RB_MASTER,
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

  const fetchListRows = useCallback(
    async (listParams) => {
      const listRes = await get(ENDPOINTS.FN_FETCH_DATA, listParams);
      return listRes?.Table ?? listRes?.Links ?? [];
    },
    [get]
  );

  const seedOptionsFromMaster = useCallback(
    (master) => {
      if (!master) return;
      setDropdownOptions((prev) => {
        let next = seedMasterDropdownOptions(headerColumns, master, prev);

        if (master.DesgID != null && (master.DesgName || master.Desgination)) {
          const opt = {
            value: String(master.DesgID),
            label: String(master.DesgName ?? master.Desgination ?? ""),
          };
          if (!next.DesgID?.some((o) => o.value === opt.value)) {
            next = { ...next, DesgID: [opt, ...(next.DesgID || [])] };
          }
        }
        if (master.GroupID != null && master.GroupName) {
          const opt = { value: String(master.GroupID), label: String(master.GroupName) };
          if (!next.GroupID?.some((o) => o.value === opt.value)) {
            next = { ...next, GroupID: [opt, ...(next.GroupID || [])] };
          }
        }
        if (master.DeptID != null && master.DeptName) {
          const opt = { value: String(master.DeptID), label: String(master.DeptName) };
          if (!next.DeptID?.some((o) => o.value === opt.value)) {
            next = { ...next, DeptID: [opt, ...(next.DeptID || [])] };
          }
        }
        if (master.DeptID != null && master.Department && !master.DeptName) {
          const opt = { value: String(master.DeptID), label: String(master.Department) };
          if (!next.DeptID?.some((o) => o.value === opt.value)) {
            next = { ...next, DeptID: [opt, ...(next.DeptID || [])] };
          }
        }

        return next;
      });
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
    refreshDropdownOptions,
    seedOptionsFromMaster,
  };
}
