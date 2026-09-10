// usePOExcessQty.js — Division/Supplier filter options, RB-driven grid
// columns, and Get Details fetch for the PO Excess Qty browse page.
// Sibling of usePOShortCloseQty.js — same architecture, see that file's
// header comment for the full rationale (RB pipeline for columns, Supplier
// cascades off real Division, etc.).
import { useState, useCallback } from "react";
import { useApi } from "../api/useApi";
import { ENDPOINTS, OBJ_TYPE, API_BASE_URL_IMS, DEFAULT_SESSION_ID } from "../api/constants";
import { getUserSession } from "../session/userSession";
import { buildGridColumns } from "../utils/gridUtils";
import { buildSaveJsonFields, withSaveContextFields } from "../utils/savePayload";
import { isErrorOnlyRow, parseApiErrMsg } from "../utils/apiResponse";
import { POEQ_CONFIG } from "../pages/po-excess-qty/constants";

function mapDetailRowsToGridRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 1 && isErrorOnlyRow(list[0])) return [];
  return list.map((row, index) => ({
    ...row,
    id: String(row.podetid ?? row.compuniquekey ?? row.idnumber ?? index),
  }));
}

export function usePOExcessQty() {
  const { get } = useApi();
  const { post } = useApi(API_BASE_URL_IMS);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);

  const [supplierOptions, setSupplierOptions] = useState([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);

  const [columns, setColumns] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsError, setColumnsError] = useState(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const fetchGridColumns = useCallback(async () => {
    setColumnsLoading(true);
    setColumnsError(null);
    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: POEQ_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: POEQ_CONFIG.RB_CODE }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error(`No RB metadata returned for ${POEQ_CONFIG.RB_CODE}.`);
      const rbid = tableRow.rbid;

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbid,
        prmLoginID: getUserSession().loginId,
      });
      const gridColumns = buildGridColumns(colData || [], {}, {
        filterable: true,
        allEditable: false,
      });
      setColumns(gridColumns);
      return gridColumns;
    } catch (err) {
      console.warn("[POExcessQty] Grid column meta fetch failed:", err);
      setColumnsError(err?.message || "Failed to load grid column definitions.");
      setColumns([]);
      return [];
    } finally {
      setColumnsLoading(false);
    }
  }, [get]);

  const fetchDivisionOptions = useCallback(async () => {
    setIsLoadingDivisions(true);
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: POEQ_CONFIG.SP_DIVISIONS,
        JSon: JSON.stringify([{
          prmuserid: session.loginId,
          prmcompanyid: session.companyId,
          prmyearid: session.yearId,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.divisionid),
        label: r.divisionname,
      }));
      setDivisionOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[POExcessQty] Division fetch failed:", err);
      setDivisionOptions([]);
      return [];
    } finally {
      setIsLoadingDivisions(false);
    }
  }, [get]);

  const fetchSupplierOptions = useCallback(async (divisionId) => {
    if (!divisionId || divisionId === "0") {
      setSupplierOptions([]);
      return [];
    }
    setIsLoadingSuppliers(true);
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: POEQ_CONFIG.SP_SUPPLIERS,
        JSon: JSON.stringify([{
          prmdivisionid: Number(divisionId),
          prmloginid: session.loginId,
          prmyearid: session.yearId,
          prmpartytype: POEQ_CONFIG.SUPPLIER_PARTY_TYPE,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(Math.round(Number(r.supplierid))),
        label: r.suppliername,
      }));
      setSupplierOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[POExcessQty] Supplier fetch failed:", err);
      setSupplierOptions([]);
      return [];
    } finally {
      setIsLoadingSuppliers(false);
    }
  }, [get]);

  const fetchDetails = useCallback(async ({ divisionId, supplierId }) => {
    setLoading(true);
    setError(null);
    try {
      const session = getUserSession();
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: POEQ_CONFIG.SP_GET_DETAILS,
        JSon: JSON.stringify([{
          prmdivisionid: Number(divisionId),
          prmsupplierid: Number(supplierId),
          prmcompanyid: session.companyId,
          prmyearid: session.yearId,
        }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setRows(mapDetailRowsToGridRows(res));
    } catch (err) {
      console.warn("[POExcessQty] Get Details fetch failed:", err);
      setError(err?.message || "Failed to load PO Excess Qty data.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [get]);

  const resetDetails = useCallback(() => {
    setRows([]);
    setError(null);
  }, []);

  // Save — full edited row set back, backend upserts (single-RB save, bound
  // to prmStrMstJSON — this endpoint reads the rows as the master JSON, not
  // prmStrDetJSON, confirmed by the user after prmStrDetJSON came through
  // blank server-side).
  const saveRows = useCallback(async (editedRows, { divisionId } = {}) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const session = getUserSession();
      const mstRows = editedRows.map(({ id, ...row }) => ({
        ...row,
        loginid: session.loginId,
        sessionid: session.sessionId || DEFAULT_SESSION_ID,
      }));

      const payload = withSaveContextFields(
        buildSaveJsonFields({ label: "POExcessQty", mst: mstRows }),
        { divisionId, isEdit: true }
      );

      const result = await post(POEQ_CONFIG.SAVE_ENDPOINT, payload);
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
  }, [post]);

  return {
    divisionOptions, isLoadingDivisions, fetchDivisionOptions,
    supplierOptions, isLoadingSuppliers, fetchSupplierOptions,
    columns, columnsLoading, columnsError, fetchGridColumns,
    rows, loading, error, fetchDetails, resetDetails,
    saveRows, isSaving, saveError,
  };
}
