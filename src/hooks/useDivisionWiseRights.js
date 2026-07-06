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

// Build grid column subset from normalized links — keyed by lowercase colname
function getUdrGridColumnDefs(links) {
  const byName = Object.fromEntries(
    (links ?? []).map((c) => [c.colname ?? c.ColName, c])
  );
  return UDR_CONFIG.GRID_ROW_COLS.map((name) => byName[name]).filter(Boolean);
}

// Lowercase params — PG SP params are case-insensitive but payload must be consistent
function buildUserListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  return {
    ObjType:   UDR_CONFIG.LIST_OBJ_TYPE,
    ObjName:   UDR_CONFIG.SP_USER_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid:  DEFAULT_COMPANY_ID,
        prmdivisionid: UDR_CONFIG.LIST_DIVISION_ID,
        prmfromdate:   today,
        prmtodate:     today,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

function mapUserOptions(table) {
  return (table ?? [])
    .map((row) => {
      // PG returns lowercase; try both to handle PG and legacy SQL Server
      const value = row.userid ?? row.UserID ?? row.idnumber ?? row.IDNumber;
      if (value == null || value === "") return null;
      const num = Number(value);
      const valueStr = Number.isFinite(num) ? String(Math.round(num)) : String(value);
      return {
        value: valueStr,
        label: String(row.username ?? row.UserName ?? row.name ?? valueStr),
      };
    })
    .filter(Boolean);
}

function buildGridFillParameterString(masterId, tranBook) {
  return [
    Number(DEFAULT_COMPANY_ID) || 0,
    UDR_CONFIG.CONFIG_YEAR_ID,
    Number(DEFAULT_LOGIN_ID)   || 0,
    Number(DEFAULT_SESSION_ID) || 0,
    Number(masterId)           || 0,
    `'${tranBook}'`,
  ].join(",");
}

function mapGridRowFromApi(row, gridColumnDefs, userId, tranBook) {
  // PG returns lowercase keys; pass lowercase overrides for userid/tranbook
  const mapped = mapRowToFieldValues(row, gridColumnDefs, {
    userid:   row.userid   ?? row.UserID   ?? userId,
    tranbook: row.tranbook ?? row.TranBook ?? tranBook,
  });

  gridColumnDefs.forEach((col) => {
    const key = col.colname ?? col.ColName;
    if (!key) return;
    if (isMasterCheckboxField(col) && mapped[key] !== undefined) {
      mapped[key] = getCheckboxValue(mapped[key]);
    }
    if (key === UDR_CONFIG.GRID_ALLOW_COL && mapped[key] !== undefined) {
      mapped[key] = getCheckboxValue(mapped[key]);
    }
    if (key === UDR_CONFIG.GRID_DIVISION_COL && !mapped[key]) {
      mapped[key] = row.divisionname ?? row.DivisionName ?? "";
    }
    if (key === "divisionid" && mapped[key] != null) {
      mapped[key] = Number(mapped[key]) || 0;
    }
  });

  return mapped;
}

export function useDivisionWiseRights() {
  const { get } = useApi(API_BASE_URL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [gridColumns,   setGridColumns]   = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [headerFetching,  setHeaderFetching]  = useState(false);
  const [headerError,     setHeaderError]     = useState(null);

  const fetchUserOptions = useCallback(async () => {
    const res = await get(ENDPOINTS.FN_FETCH_DATA, buildUserListParams()).catch((err) => {
      console.warn("[UDR] User list fetch failed:", err);
      return null;
    });
    // PG returns flat array; legacy SQL Server returned { Table: [...] } or { Links: [...] }
    const table = Array.isArray(res) ? res : (res ?? res ?? []);
    return mapUserOptions(table);
  }, [get]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID (lowercase param key for PG)
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType:   2,
        ObjName:   UDR_CONFIG.SP_RB_META,
        JSon:      JSON.stringify([{ prmrbcode: UDR_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg:  "",
      });
      const tableRow = metaData?.[0];
      // PG returns lowercase keys — fall back to PascalCase for compatibility
      const rbidVal = tableRow?.rbid ?? tableRow?.RBID;
      if (!rbidVal) {
        throw new Error("No Division Wise Rights RB metadata returned.");
      }

      const hdrMeta = {
        RBID:         rbidVal,
        SaveProcName: tableRow.saveprocname ?? tableRow.SaveProcName,
      };
      localStorage.setItem(UDR_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions; PG returns flat array
      const colData  = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID:  DEFAULT_LOGIN_ID,
      });
      const rawLinks = Array.isArray(colData) ? colData : (colData || []);
      const links    = rawLinks.map(normalizeColumn);
      const gridCols = getUdrGridColumnDefs(links);

      setHeaderColumns(links);
      setGridColumns(gridCols);

      // Phase 3 — manual SP call for user dropdown
      const userOptions = await fetchUserOptions();
      setDropdownOptions({ [UDR_CONFIG.HEADER_USER_COL]: userOptions });
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
        prmProcedure:  UDR_CONFIG.SP_MASTER_FILL,
        prmParameters: buildGridFillParameterString(userId, tranBook),
        prmFuncCode:   UDR_CONFIG.RB_MASTER,
      });

      // PG returns flat array; legacy returned { Links: [...] } or { Table: [...] }
      const rows = Array.isArray(mstRes) ? mstRes : (mstRes ?? mstRes ?? []);
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
