// useAssetDepreciationPercentage.js — RB metadata, grid columns, row fetch,
// and bulk save for the Asset Depreciation Percentage (AstDepPerc) config
// screen. Single flat grid, no master/detail split, no division cascade —
// GetMasterDataFill(idNumber=0) already returns every ledger Account row.

import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { buildSaveJsonFields, withSaveContextFields } from "../utils/savePayload";
import { parseApiErrMsg, isErrorOnlyRow } from "../utils/apiResponse";
import { buildGridColumns, fetchDropdownOptions } from "../utils/gridUtils";
import { ADP_CONFIG, ADP_RB_SHIM } from "../pages/asset-depreciation-percentage/constants";

function buildMasterDataFillParams() {
  const session = getUserSession();
  return [
    session.companyId || 0,
    session.yearId || 0,
    session.loginId || 0,
    DEFAULT_SESSION_ID,
    0, // idNumber — fixed row set (fn_tbl_rb_astdepPerc returns every Account regardless)
  ].join(",");
}

// 2026-08-17 (/pm) — project-wide sentinel-row fix (see usePurchaseInquiry.js
// for the original bug write-up). A "no rows" result comes back as a single
// {ErrCode, ErrMsg} row instead of an empty array; without this guard it was
// loaded as one phantom blank grid row instead of showing the empty state.
function mapRowsToGridRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 1 && isErrorOnlyRow(list[0])) return [];
  return list.map((row, index) => ({
    ...row,
    id: String(row.compuniquekey ?? row.idnumber ?? `adp_${index}`),
  }));
}

export function useAssetDepreciationPercentage() {
  const { get } = useApi(API_BASE_URL);
  const { post } = useApi(API_BASE_URL_IMS);

  const [columns, setColumns] = useState([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState(null);

  const [rows, setRows] = useState([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const rbMetaRef = useRef(null);

  // ── Phase 1+2 — RB metadata (RBID/SaveProcName) + column definitions ──────
  const fetchColumns = useCallback(async () => {
    setIsLoadingMeta(true);
    setMetaError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: ADP_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: ADP_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No Asset Depreciation Percentage RB metadata returned.");

      const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      rbMetaRef.current = meta;
      localStorage.setItem(ADP_CONFIG.STORAGE_HEADER_META, JSON.stringify(meta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: meta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      // TEMPORARY — see ADP_RB_SHIM in constants.js. Corrects colctrltype /
      // iseditallow on the raw column list for the columns the live RB has
      // misconfigured, before buildGridColumns() consumes them. Remove this
      // .map() once DBA applies the real RB fix (objdetid list in constants.js).
      const apiColumns = (colData || []).map((col) => {
        const fix = ADP_RB_SHIM[col.colname];
        return fix ? { ...col, ...fix } : col;
      });

      // depsaccid/accudepsaccid are now shimmed to ColCtrlType=4 (Dropdown) —
      // fetch their option lists the same way every other RB-driven dropdown
      // column in the app does (GET_FILTER_DETAIL keyed by objdetid).
      const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
        funcCode: ADP_CONFIG.RB_MASTER,
      });

      // allEditable:false — respect each column's own iseditallow + colctrltype
      // (post-shim) rather than forcing every column editable.
      // Drop the "cb" selection checkbox column — this is a flat config grid,
      // rows aren't picked/copied so there's nothing to select.
      const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
        filterable: false,
        allEditable: false,
      }).filter((col) => col.key !== "cb");
      setColumns(gridColumns);
    } catch (err) {
      console.error("[ADP] fetchColumns failed:", err);
      setMetaError(err?.message || "Failed to load configuration columns.");
    } finally {
      setIsLoadingMeta(false);
    }
  }, [get]);

  // ── Row fetch — one row per ledger Account ─────────────────────────────────
  const fetchRows = useCallback(async () => {
    setIsLoadingRows(true);
    setRowsError(null);
    try {
      const res = await get(ENDPOINTS.GET_MASTER_DATA_FILL, {
        prmProcedure: ADP_CONFIG.SP_MASTER_FILL,
        prmParameters: buildMasterDataFillParams(),
        prmFuncCode: ADP_CONFIG.RB_MASTER,
      });
      setRows(mapRowsToGridRows(res));
    } catch (err) {
      console.error("[ADP] fetchRows failed:", err);
      setRowsError(err?.message || "Failed to load depreciation percentage data.");
      setRows([]);
    } finally {
      setIsLoadingRows(false);
    }
  }, [get]);

  // ── Save — full row set back, backend upserts by idnumber (0 = insert) ─────
  const saveRows = useCallback(
    async (editedRows) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const session = getUserSession();
        const detRows = editedRows.map(({ id, ...row }) => ({
          ...row,
          loginid: session.loginId,
          sessionid: DEFAULT_SESSION_ID,
        }));

        const payload = await withSaveContextFields(
          buildSaveJsonFields({ label: "ADP", det: detRows }),
          { divisionId: 0, isEdit: true }
        );

        const result = await post(ADP_CONFIG.SAVE_ENDPOINT, payload);
        const { success, message } = parseApiErrMsg(result);
        if (!success) throw new Error(message);
        return { success: true, message };
      } catch (err) {
        const message = err?.message || "Save failed. Please try again.";
        setSaveError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [post]
  );

  return {
    columns, isLoadingMeta, metaError, fetchColumns,
    rows, isLoadingRows, rowsError, fetchRows,
    saveRows, isSaving, saveError,
  };
}
