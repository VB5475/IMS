// usePurchaseInquiry.js — Header meta, detail grid, and filter dropdowns for Purchase Inquiry
// ─────────────────────────────────────────────────────────────────────
// On mount:
//   fetchHeaderMeta  → RB_PurInquiryMst → GetDetailColData + Division + Department
//   fetchDetailMeta  → RB_PurInquiryDet → GetDetailColData (columns only, no dropdowns)
//
// Edit route:
//   fetchEditRecord  → GET_MASTER_DATA_FILL (master + detail + indent detail)
//
// On first "Add New" / supplier insert:
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns
//
// Cascading filters (page onFilterChange):
//   Division → Inquiry Type → Indent

import { useState, useCallback, useRef } from "react";
import { useApi } from "../api/useApi";
import { getUserSession } from "../session/userSession";
import {
  ENDPOINTS,
  API_BASE_URL,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { parseApiErrMsg } from "../utils/apiResponse";
import { PI_CONFIG } from "../pages/purchase-inquiry/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
} from "../utils/gridUtils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** API expects e.g. "02-Jun-2026" */
export function formatPiTranDate(dateVal) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    return `${dd}-${MONTHS[now.getMonth()]}-${now.getFullYear()}`;
  }
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function uniqueIndentOptions(rows) {
  const seen = new Set();
  const opts = [];
  for (const row of rows) {
    const id = String(row.IndentID);
    if (seen.has(id)) continue;
    seen.add(id);
    opts.push({ value: id, label: row.IndentNo || id });
  }
  // return opts;
  return rows;
}

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || DEFAULT_COMPANY_ID,
    Number(yearId) || PI_CONFIG.CONFIG_YEAR_ID,
    Number(loginId) || getUserSession().loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(idNumber) || 0,
  ].join(",");
}

function mapMasterRowToHeaderValues(master, params) {
  const toDateInput = (value) => {
    if (!value) return "";
    if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  return {
    TranCode: master.TranCode != null ? String(master.TranCode) : "",
    TranDate: toDateInput(master.TranDate),
    DivisionID: master.DivisionID != null ? Number(master.DivisionID) : 0,
    ConfigID: master.ConfigID != null ? Number(master.ConfigID) : 0,
    ExpectedDate: toDateInput(master.ExpectedDate) || null,
    DeptID: master.DeptID != null ? Number(master.DeptID) : 0,
    BasedOnID: master.BasedOnID != null ? String(master.BasedOnID) : "0",
    Remarks: master.Remarks ?? "",
    CompanyID: Number(params.companyId) || DEFAULT_COMPANY_ID,
    YearID: Number(params.yearId) || PI_CONFIG.CONFIG_YEAR_ID,
    LoginID: Number(params.loginId) || getUserSession().loginId,
    SessionID: Number(master.SessionID ?? params.sessionId) || DEFAULT_SESSION_ID,
    IDNumber: Number(master.IDNumber ?? params.idNumber) || 0,
    UserID: getUserSession().userId,
  };
}

function mapDetailRowsToGridRows(rows) {
  return (rows || []).map((row, index) => ({
    ...row,
    id: String(row.CompUniqueKey ?? row.IDNumber ?? row.MasterID ?? `edit_${index}`),
  }));
}

/** Group indent detail rows under each parent item grid row (edit load). */
function mapIndentRowsToChildRowsMap(detailRows, indtRows) {
  const childRowsMap = {};
  if (!indtRows?.length || !detailRows?.length) return childRowsMap;

  detailRows.forEach((parent) => {
    const parentItemId = String(Math.round(Number(parent.ItemID)));
    const children = indtRows.filter(
      (c) => String(Math.round(Number(c.ChildFKey))) === parentItemId
    );
    if (children.length > 0) {
      childRowsMap[String(parent.id)] = children;
    }
  });
  return childRowsMap;
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.IsEventReq) || isTruthyApiFlag(col.IsEventCol)) {
      set.add(col.ColName);
    }
  });
  if (set.size === 0) {
    fallbackKeys.forEach((k) => set.add(k));
  }
  return set;
}

// Shared loader: RB code → RBID + SaveProcName → GetDetailColData columns.
// Used by both the item-detail and supplier grids (same backend pattern,
// only the RB code + storage key change).
async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: OBJ_TYPE.FUNCTION,
    ObjName: PI_CONFIG.SP_RB_META,
    JSon: JSON.stringify([{ prmRBCode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const tableRow = metaData?.Table?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);

  const meta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
  localStorage.setItem(storageKey, JSON.stringify(meta));

  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: getUserSession().loginId,
  });
  const apiColumns = colData?.Links || [];
  return { meta, apiColumns };
}

export function usePurchaseInquiry(baseURL = API_BASE_URL) {
  const { get, post } = useApi(baseURL);

  // ── Header (master) state ─────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [inquiryTypeOptions, setInquiryTypeOptions] = useState([]);
  const [indentOptions, setIndentOptions] = useState([]);
  const [isLoadingInquiryTypes, setIsLoadingInquiryTypes] = useState(false);
  const [isLoadingIndents, setIsLoadingIndents] = useState(false);

  // ── Detail grid state ─────────────────────────────────────────────
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [allIndentColumns, setAllIndentColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const fetchInquiryTypes = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setInquiryTypeOptions([]);
        return [];
      }

      setIsLoadingInquiryTypes(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_INQUIRY_TYPES,
          JSon: JSON.stringify([
            {
              PrmCompanyId: DEFAULT_COMPANY_ID,
              PrmDivisionId: Number(divisionId),
              PrmYearId: PI_CONFIG.CONFIG_YEAR_ID,
              PrmUserId: getUserSession().loginId,
              PrmFormTag: PI_CONFIG.FORM_TAG,
              PrmRefType: "",
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = (res?.Table || []).map((r) => ({
          value: String(r.ConfigurationId),
          label: r.Name,
        }));
        setInquiryTypeOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[PI] Inquiry Type fetch failed:", err);
        setInquiryTypeOptions([]);
        return [];
      } finally {
        setIsLoadingInquiryTypes(false);
      }
    },
    [get]
  );

  const fetchIndents = useCallback(
    async ({ divisionId, configId, tranDate, supplierId = 0, frmOption = 0 }) => {
      if (!divisionId || divisionId === "0" || !configId || configId === "0") {
        setIndentOptions([]);
        return [];
      }

      setIsLoadingIndents(true);
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_INDENTS,
          JSon: JSON.stringify([
            {
              prmDivisionID: Number(divisionId),
              prmYearID: PI_CONFIG.CONFIG_YEAR_ID,
              prmLoginID: getUserSession().loginId,
              prmTranDate: formatPiTranDate(tranDate),
              prmConfigID: Number(configId),
              prmSupplierID: Number(supplierId) || 0,
              prmTranBook: PI_CONFIG.TRAN_BOOK,
              prmFrmOption: Number(frmOption) || 0,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = uniqueIndentOptions(res?.Table || []);
        // console.log(see opts)
        console.log("SEE OPTIONS:", res?.Table);
        setIndentOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[PI] Indent fetch failed:", err);
        setIndentOptions([]);
        return [];
      } finally {
        setIsLoadingIndents(false);
      }
    },
    [get]
  );

  const fetchHeaderMeta = useCallback(
    async ({ skipListDropdowns = false } = {}) => {
      setHeaderFetching(true);
      setHeaderError(null);

      try {
        const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_RB_META,
          JSon: JSON.stringify([{ prmRBCode: PI_CONFIG.RB_MASTER }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const tableRow = metaData?.Table?.[0];
        if (!tableRow) throw new Error("No PI header RB metadata returned from server.");

        const hdrMeta = { RBID: tableRow.RBID, SaveProcName: tableRow.SaveProcName };
        setHeaderRbMeta(hdrMeta);
        localStorage.setItem(PI_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
        console.log("%c[PI] Header meta stored:", "color:#8b5cf6;font-weight:600", hdrMeta);

        const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: hdrMeta.RBID,
          prmLoginID: getUserSession().loginId,
        });
        const apiColumns = colData?.Links || [];
        setHeaderColumns(apiColumns);
        console.log(
          "%c[PI] Header columns received:",
          "color:#8b5cf6;font-weight:600",
          apiColumns.length
        );

        if (skipListDropdowns) {
          setDivisionOptions([]);
          setDepartmentOptions([]);
          return apiColumns;
        }

        const [divisionData, departmentData] = await Promise.all([
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: OBJ_TYPE.FUNCTION,
            ObjName: PI_CONFIG.SP_DIVISIONS,
            JSon: JSON.stringify([
              {
                prmUserID: getUserSession().loginId,
                prmCompanyID: DEFAULT_COMPANY_ID,
                prmYearID: PI_CONFIG.DIVISION_YEAR_ID,
              },
            ]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          }).catch((err) => {
            console.warn("[PI] Division fetch failed:", err);
            return null;
          }),
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: OBJ_TYPE.PROCEDURE,
            ObjName: PI_CONFIG.SP_DEPARTMENTS,
            JSon: JSON.stringify([{ PrmDeptID: 0 }]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          }).catch((err) => {
            console.warn("[PI] Department fetch failed:", err);
            return null;
          }),
        ]);

        setDivisionOptions(
          (divisionData?.Table || []).map((r) => ({
            value: String(r.DivisionID),
            label: r.DivisionName,
          }))
        );

        setDepartmentOptions(
          (departmentData?.Table || []).map((r) => ({
            value: String(r.DepartmentID),
            label: r.DepartmentName,
          }))
        );

        return apiColumns;
      } catch (err) {
        console.error("[PI] fetchHeaderMeta failed:", err);
        setHeaderError(err?.message || "Failed to load header configuration.");
        return [];
      } finally {
        setHeaderFetching(false);
      }
    },
    [get]
  );

  const fetchDivisionOptions = useCallback(async () => {
    try {
      const divisionData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_DIVISIONS,
        JSon: JSON.stringify([
          {
            prmUserID: getUserSession().loginId,
            prmCompanyID: DEFAULT_COMPANY_ID,
            prmYearID: PI_CONFIG.DIVISION_YEAR_ID,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setDivisionOptions(
        (divisionData?.Table || []).map((r) => ({
          value: String(r.DivisionID),
          label: r.DivisionName,
        }))
      );
    } catch (err) {
      console.warn("[PI] Division fetch failed:", err);
      setDivisionOptions([]);
    }
  }, [get]);

  const fetchDepartmentOptions = useCallback(async () => {
    try {
      const departmentData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.PROCEDURE,
        ObjName: PI_CONFIG.SP_DEPARTMENTS,
        JSon: JSON.stringify([{ PrmDeptID: 0 }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setDepartmentOptions(
        (departmentData?.Table || []).map((r) => ({
          value: String(r.DepartmentID),
          label: r.DepartmentName,
        }))
      );
    } catch (err) {
      console.warn("[PI] Department fetch failed:", err);
      setDepartmentOptions([]);
    }
  }, [get]);

  /**
   * Edit flow — when user enters edit mode, load list APIs only for header
   * dropdowns where IsLockOnEditModeAllow is false.
   * Locked dropdowns use GET_MASTER_DATA_FILL instead (handled in the form).
   */
  const fetchUnlockedHeaderDropdowns = useCallback(
    async (divisionId) => {
      if (!headerColumns.length) return;

      const needsDivision = headerColumns.some(
        (c) => c.ColName === "DivisionID" && !isLockOnEditModeCol(c)
      );
      const needsDept = headerColumns.some(
        (c) => c.ColName === "DeptID" && !isLockOnEditModeCol(c)
      );
      const needsConfig = headerColumns.some(
        (c) => c.ColName === "ConfigID" && !isLockOnEditModeCol(c)
      );

      const tasks = [];
      if (needsDivision) tasks.push(fetchDivisionOptions());
      if (needsDept) tasks.push(fetchDepartmentOptions());
      if (needsConfig && divisionId) tasks.push(fetchInquiryTypes(divisionId));
      await Promise.all(tasks);
    },
    [headerColumns, fetchDivisionOptions, fetchDepartmentOptions, fetchInquiryTypes]
  );

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);

    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        PI_CONFIG.RB_DETAIL,
        PI_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;
      setEventColumns(
        buildEventColumnSet(apiColumns, [
          "ItemID",
          "TranQty",
          "BaseQty",
          "BaseRate",
          "TranRate",
          "DiscPerc",
          "Expense",
          "GSTPerc",
        ])
      );
      setAllColumns(
        apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null }))
      );
      console.log(
        "%c[PI] Detail columns received:",
        "color:#6366f1;font-weight:600",
        apiColumns.length
      );
    } catch (err) {
      console.error("[PI] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  const fetchGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts =
        typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      const apiColumns = rawDetailColumnsRef.current;
      const meta = rawDetailRbMetaRef.current;

      if (!apiColumns.length || !meta) {
        console.warn("[PI] fetchGridColumns called before fetchDetailMeta completed.");
        return [];
      }

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
          funcCode: PI_CONFIG.RB_DETAIL,
          divisionID: Number(divisionID) || 0,
          existingRecordEdit,
          rowData: masterRow,
          fetchUnlockedDropdowns,
        });
        const gridColumns = buildGridColumns(apiColumns, colDropdownOptions, {
          filterable: false,
          allEditable: true,
          existingRecordEdit,
        });
        setColumns(gridColumns);
        console.log(
          "%c[PI] Grid columns built:",
          "color:#22c55e;font-weight:600",
          gridColumns.length
        );
        return gridColumns;
      } catch (err) {
        console.error("[PI] fetchGridColumns failed:", err);
        return [];
      }
    },
    [get]
  );

  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({
        companyId,
        yearId,
        loginId,
        sessionId,
        idNumber,
      });

      const [mstRes, detRes, indtRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PI_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: PI_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PI_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: PI_CONFIG.RB_DETAIL,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PI_CONFIG.SP_INDT_FILL,
          prmParameters,
          prmFuncCode: PI_CONFIG.RB_INDT_DETAIL,
        }),
      ]);

      const master = mstRes?.Links?.[0] ?? null;
      const params = { companyId, yearId, loginId, sessionId, idNumber };
      const details = mapDetailRowsToGridRows(detRes?.Links || []);
      const indentDetails = indtRes?.Links || [];

      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master, params) : null,
        details,
        indentDetails,
        childRowsMap: mapIndentRowsToChildRowsMap(details, indentDetails),
      };
    },
    [get]
  );

  const fetchIndentDetailColumns = useCallback(async () => {
    const { apiColumns } = await loadRbDetailGridMeta(
      get,
      PI_CONFIG.RB_INDT_DETAIL,
      PI_CONFIG.STORAGE_INDT_META
    );
    setAllIndentColumns(
      apiColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType || null }))
    );
    return buildGridColumns(apiColumns, {}, { filterable: false, allEditable: false });
  }, [get]);

  const clearIndentDetailMeta = useCallback(() => {
    setAllIndentColumns([]);
  }, []);

  const [isEventFiring, setIsEventFiring] = useState(false);

  const fireCellEvent = useCallback(
    async (colName, rowData, headerValues) => {
      setIsEventFiring(true);
      try {
        const { id, ...newRowData } = rowData;
        const result = await get(ENDPOINTS.FN_TBL_RB_GRID_EVENT, {
          GridEventFuncName: PI_CONFIG.SP_GRID_EVENT,
          EventColName: colName,
          DetJSON: JSON.stringify([newRowData]),
          MstJSon: JSON.stringify([headerValues]),
        });
        console.log("%c[PI] CellEvent response:", "color:#f59e0b;font-weight:600", {
          col: colName,
          result,
        });
        return result;
      } catch (err) {
        console.error("[PI] fireCellEvent failed:", err);
        return null;
      } finally {
        setIsEventFiring(false);
      }
    },
    [get]
  );

  const saveTxn = useCallback(
    async (headerValues, detailRows, genIDNumber = 0) => {
      setIsSaving(true);
      setSaveError(null);

      try {
        const mstMeta = JSON.parse(localStorage.getItem(PI_CONFIG.STORAGE_HEADER_META) || "null");
        const detMeta = JSON.parse(localStorage.getItem(PI_CONFIG.STORAGE_ENTRY_META) || "null");

        if (!mstMeta || !detMeta) {
          throw new Error("Missing save configuration. Please refresh and try again.");
        }

        const cleanedRows = detailRows.map(({ id, ...rest }) => rest);
        const body = {
          PrmStrMstRBName: PI_CONFIG.RB_MASTER,
          prmStrMstJSON: JSON.stringify([headerValues]),
          prmstrMasterSaveProcName: mstMeta?.SaveProcName,
          prmstrDetailSaveProcName: detMeta?.SaveProcName,
          PrmStrDetRBName: PI_CONFIG.RB_DETAIL,
          prmStrDetJSON: JSON.stringify(cleanedRows),
          GenIDNumber: genIDNumber,
          p_ErrCode: -1,
          p_ErrMsg: "",
        };

        const result = await post(ENDPOINTS.RB_MASTER_DETAIL_FORM_SAVE, body);

        console.log("%c[PI] Save result:", "color:#22c55e;font-weight:600", result);
        const { success, message } = parseApiErrMsg(result);
        if (!success) throw new Error(message);
        return { ...result, saveMessage: message };
      } catch (err) {
        console.error("[PI] saveTxn failed:", err);
        setSaveError(err?.message || "Save failed. Please try again.");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [post]
  );

  const clearInquiryTypes = useCallback(() => setInquiryTypeOptions([]), []);
  const clearIndents = useCallback(() => setIndentOptions([]), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchUnlockedHeaderDropdowns,
    divisionOptions,
    departmentOptions,
    inquiryTypeOptions,
    indentOptions,
    fetchInquiryTypes,
    fetchIndents,
    clearInquiryTypes,
    clearIndents,
    isLoadingInquiryTypes,
    isLoadingIndents,
    columns,
    allColumns,
    allIndentColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fetchEditRecord,
    fetchIndentDetailColumns,
    clearIndentDetailMeta,
    fireCellEvent,
    isEventFiring,
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  };
}
