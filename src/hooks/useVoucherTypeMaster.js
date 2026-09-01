import { useState, useCallback, useMemo } from "react";
import { useApi } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { VTM_CONFIG } from "../pages/voucher-type-master/constants";

function pickFirst(row, keys, fallback = "") {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") {
      return row[key];
    }
  }
  return fallback;
}

function mapTableToOptions(rows, valueKeys, labelKeys) {
  return (rows || [])
    .map((r) => ({
      value: String(pickFirst(r, valueKeys, "")),
      label: String(pickFirst(r, labelKeys, "")),
    }))
    .filter((o) => o.value !== "");
}

export function useVoucherTypeMaster() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [moduleOptions, setModuleOptions] = useState([]);
  const [levyFormulaOptions, setLevyFormulaOptions] = useState([]);

  const fetchHeaderMeta = useCallback(async () => {
    setHeaderFetching(true);
    setHeaderError(null);
    try {
      // Phase 1 — RB metadata → RBID
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: VTM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: VTM_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Voucher Type Master RB metadata returned.");
      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      localStorage.setItem(VTM_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      // Phase 2 — column definitions (drives form fields, defaults, and save row)
      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      setHeaderColumns(colData || []);
      setAllColumns(
        (colData || []).map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );

      // Phase 3 — Module + Levy Formula dropdowns in parallel (both static,
      // zero-param, no cascade between them — per MRD §2 screen notes).
      const [moduleData, levyData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: VTM_CONFIG.SP_MODULE,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[VTM] Module fetch failed:", err); return null; }),

        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: VTM_CONFIG.SP_LEVY_FORMULA,
          JSon: JSON.stringify([{}]),
          p_ErrCode: -1, p_ErrMsg: "",
        }).catch((err) => { console.warn("[VTM] Levy Formula fetch failed:", err); return null; }),
      ]);

      setModuleOptions(
        mapTableToOptions(
          moduleData,
          ["idnumber", "IDNumber", "IDNUMBER", "moduleid", "ModuleID"],
          ["modulename", "ModuleName", "LookupDesc", "lookupdesc", "name", "Name","moduledesc"]
        )
      );
      setLevyFormulaOptions(
        mapTableToOptions(
          levyData,
          ["idnumber", "IDNumber", "IDNUMBER", "levyid", "LevyID"],
          ["levyname", "LevyName", "LookupDesc", "lookupdesc", "name", "Name"]
        )
      );
    } catch (err) {
      console.error("[VTM] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load Voucher Type Master configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // Returns master spread directly (PG returns lowercase keys matching RB colnames).
  // System context fields are overlaid so the save SP always gets consistent values.
  const fetchEditRecord = useCallback(async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
    const session = getUserSession();
    const prmParameters = [
      Number(companyId) || session.companyId,
      Number(yearId) || session.yearId,
      Number(loginId) || session.loginId,
      Number(sessionId) || DEFAULT_SESSION_ID,
      Number(idNumber) || 0,
    ].join(",");

    const mstRes = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
      prmProcedure: VTM_CONFIG.SP_MASTER_FILL,
      prmParameters,
      prmFuncCode: VTM_CONFIG.RB_MASTER,
    });
    const master = mstRes?.[0] ?? null;
    return {
      master,
      headerValues: master ? {
        ...master,
        yearid: session.yearId,
        funccode: VTM_CONFIG.RB_MASTER,
        loginid: Number(master.loginid ?? loginId) || session.loginId,
        sessionid: Number(master.sessionid ?? sessionId) || DEFAULT_SESSION_ID,
      } : null,
    };
  }, [get]);

  return {
    headerColumns, allColumns, headerFetching, headerError, fetchHeaderMeta,
    moduleOptions, levyFormulaOptions,
    fetchEditRecord,
  };
}
