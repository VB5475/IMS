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
//   Division → Inquiry Type

import { useState, useCallback, useRef, useMemo } from "react";
import { useApi, getApiClient } from "../api/useApi";
import { withGetRetry } from "../utils/apiRetry";
import { getUserSession } from "../session/userSession";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  OBJ_TYPE,
} from "../api/constants";
import { parseApiErrMsg, isErrorOnlyRow } from "../utils/apiResponse";
import { withSaveContextFields, buildSaveJsonFields } from "../utils/savePayload";
import { isNumericColDataType, buildDetJSON } from "../utils/columnValidation";
import { PI_CONFIG } from "../pages/purchase-inquiry/constants";
import { BASED_ON } from "../constants/purchaseCommon";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
} from "../utils/gridUtils";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  return [
    Number(companyId) || getUserSession().companyId,
    Number(yearId) || getUserSession().yearId,
    Number(loginId) || getUserSession().loginId,
    Number(sessionId) || DEFAULT_SESSION_ID,
    Number(idNumber) || 0,
  ].join(",");
}

function mapMasterRowToHeaderValues(master) {
  const toDateInput = (value) => {
    if (!value) return "";
    if (typeof value === "string" && value.includes("T")) return value.split("T")[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  return {
    ...master,
    trandate:     toDateInput(master.trandate),
    expecteddate: toDateInput(master.expecteddate ?? master.expdate) || null,
    yearid:    getUserSession().yearId,
    funccode:  PI_CONFIG.RB_MASTER,
    loginid:   getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
}

// 2026-08-17 (/pm) — a detail-fill SP with nothing to return (Direct-based
// PI with no linked Terms, a fresh record with no Supplier rows, etc.)
// returns a single {ErrCode, ErrMsg} "no data" sentinel row instead of an
// empty array — mapping it verbatim used to load one blank/dash-filled
// phantom row into the grid instead of showing its emptyMessage. Same
// isErrorOnlyRow guard already used by useDMGroupRights/useDocumentLog/
// useUserWiseGroupRights.
function mapDetailRowsToGridRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 1 && isErrorOnlyRow(list[0])) return [];
  return list.map((row, index) => ({
    ...row,
    id: String(row.compuniquekey ?? row.idnumber ?? row.masterid ?? `edit_${index}`),
  }));
}

/** Group indent detail rows under each parent item grid row (edit load). */
function mapIndentRowsToChildRowsMap(detailRows, indtRows) {
  const childRowsMap = {};
  if (!indtRows?.length || !detailRows?.length) return childRowsMap;

  detailRows.forEach((parent) => {
    // PG returns lowercase; guard both cases.
    const parentItemId = String(Math.round(Number(parent.itemid ?? parent.ItemID)));
    const children = indtRows.filter(
      (c) => String(Math.round(Number(c.childfkey ?? c.ChildFKey))) === parentItemId
    );
    if (children.length > 0) {
      childRowsMap[String(parent.id)] = children.map((c) => ({ ...c }));
    }
  });
  return childRowsMap;
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.iseventreq) || isTruthyApiFlag(col.iseventcol)) {
      set.add(col.colname);
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
    JSon: JSON.stringify([{ prmrbcode: rbCode }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  });
  const tableRow = metaData?.[0];
  if (!tableRow) throw new Error(`No RB metadata returned for ${rbCode}.`);

  const meta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
  localStorage.setItem(storageKey, JSON.stringify(meta));

  const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
    prmMasterID: meta.RBID,
    prmLoginID: getUserSession().loginId,
  });
  const apiColumns = colData || [];
  return { meta, apiColumns };
}

export function usePurchaseInquiry(baseURL = API_BASE_URL) {
  const { get: rawGet, post } = useApi(baseURL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  // ── Header (master) state ─────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [inquiryTypeOptions, setInquiryTypeOptions] = useState([]);
  const [isLoadingInquiryTypes, setIsLoadingInquiryTypes] = useState(false);

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

  // ── Tab-2 Supplier Detail (rb_purinqsuppdet) + Tab-3 Terms & Conditions
  // (rb_purinqtncdet) grid state — same RB-driven pattern as the item detail
  // grid above (loadRbDetailGridMeta + fetchDropdownOptions + buildGridColumns).
  const [supplierColumns, setSupplierColumns] = useState([]);
  const [allSupplierColumns, setAllSupplierColumns] = useState([]);
  const rawSupplierColumnsRef = useRef([]);
  const rawSupplierRbMetaRef = useRef(null);

  const [termsColumns, setTermsColumns] = useState([]);
  const [allTermsColumns, setAllTermsColumns] = useState([]);
  const rawTermsColumnsRef = useRef([]);
  const rawTermsRbMetaRef = useRef(null);

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
              prmcompanyid: getUserSession().companyId,
              prmdivisionid: Number(divisionId),
              prmyearid: getUserSession().yearId,
              prmuserid: getUserSession().loginId,
              prmformtag: PI_CONFIG.FORM_TAG,
              prmreftype: "",
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const opts = (res || []).map((r) => ({
          value: String(r.configurationid),
          label: r.name,
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

  const fetchHeaderMeta = useCallback(
    async ({ skipListDropdowns = false } = {}) => {
      setHeaderFetching(true);
      setHeaderError(null);

      try {
        const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: OBJ_TYPE.FUNCTION,
          ObjName: PI_CONFIG.SP_RB_META,
          JSon: JSON.stringify([{ prmrbcode: PI_CONFIG.RB_MASTER }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const tableRow = metaData?.[0];
        if (!tableRow) throw new Error("No PI header RB metadata returned from server.");

        const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
        setHeaderRbMeta(hdrMeta);
        localStorage.setItem(PI_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
        console.log("%c[PI] Header meta stored:", "color:#8b5cf6;font-weight:600", hdrMeta);

        const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
          prmMasterID: hdrMeta.RBID,
          prmLoginID: getUserSession().loginId,
        });
        const apiColumns = colData || [];
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
                prmuserid: getUserSession().loginId,
                prmcompanyid: getUserSession().companyId,
                prmyearid: getUserSession().yearId,
              },
            ]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          }).catch((err) => {
            console.warn("[PI] Division fetch failed:", err);
            return null;
          }),
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: OBJ_TYPE.FUNCTION,
            ObjName: PI_CONFIG.SP_DEPARTMENTS,
            JSon: JSON.stringify([{ prmdeptid: 0 ,prmloginid: getUserSession().loginId }]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          }).catch((err) => {
            console.warn("[PI] Department fetch failed:", err);
            return null;
          }),
        ]);

        setDivisionOptions(
          (divisionData || []).map((r) => ({
            value: String(r.divisionid),
            label: r.divisionname,
          }))
        );

        setDepartmentOptions(
          (departmentData || []).map((r) => ({
            value: String(r.departmentid ?? r.deptid),
            label: r.departmentname ?? r.deptname,
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
            prmuserid: getUserSession().loginId,
            prmcompanyid: getUserSession().companyId,
            prmyearid: getUserSession().yearId,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setDivisionOptions(
        (divisionData || []).map((r) => ({
          value: String(r.divisionid),
          label: r.divisionname,
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
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: PI_CONFIG.SP_DEPARTMENTS,
        JSon: JSON.stringify([{ prmdeptid: 0, prmloginid: getUserSession().loginId }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setDepartmentOptions(
        (departmentData || []).map((r) => ({
          value: String(r.departmentid ?? r.deptid),
          label: r.departmentname ?? r.deptname,
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
        (c) => c.colname === "divisionid" && !isLockOnEditModeCol(c)
      );
      const needsDept = headerColumns.some(
        (c) => c.colname === "deptid" && !isLockOnEditModeCol(c)
      );
      const needsConfig = headerColumns.some(
        (c) => c.colname === "configid" && !isLockOnEditModeCol(c)
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
      // Fallback keys match the live rb_purinquirydet schema (lowercase) — verified
      // via GetDetailColData; "expense"/"gstperc" don't exist as columns in this RB.
      setEventColumns(
        buildEventColumnSet(apiColumns, [
          "itemid",
          "tranqty",
          "baseqty",
          "baserate",
          "tranrate",
          "discperc",
        ])
      );
      setAllColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
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

  const fetchSupplierDetailMeta = useCallback(async () => {
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        PI_CONFIG.RB_SUPP_DETAIL,
        PI_CONFIG.STORAGE_SUPP_META
      );
      rawSupplierRbMetaRef.current = meta;
      rawSupplierColumnsRef.current = apiColumns;
      setAllSupplierColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
      console.log("%c[PI] Supplier detail columns received:", "color:#0ea5e9;font-weight:600", apiColumns.length);
    } catch (err) {
      console.error("[PI] fetchSupplierDetailMeta failed:", err);
    }
  }, [get]);

  const fetchSupplierGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts =
        typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      const apiColumns = rawSupplierColumnsRef.current;
      const meta = rawSupplierRbMetaRef.current;
      if (!apiColumns.length || !meta) {
        console.warn("[PI] fetchSupplierGridColumns called before fetchSupplierDetailMeta completed.");
        return [];
      }

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
          funcCode: PI_CONFIG.RB_SUPP_DETAIL,
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
        setSupplierColumns(gridColumns);
        return gridColumns;
      } catch (err) {
        console.error("[PI] fetchSupplierGridColumns failed:", err);
        return [];
      }
    },
    [get]
  );

  const fetchTermsDetailMeta = useCallback(async () => {
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        PI_CONFIG.RB_TERMS_DETAIL,
        PI_CONFIG.STORAGE_TERMS_META
      );
      rawTermsRbMetaRef.current = meta;
      rawTermsColumnsRef.current = apiColumns;
      setAllTermsColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
      console.log("%c[PI] Terms detail columns received:", "color:#0ea5e9;font-weight:600", apiColumns.length);
    } catch (err) {
      console.error("[PI] fetchTermsDetailMeta failed:", err);
    }
  }, [get]);

  const fetchTermsGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts =
        typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      const apiColumns = rawTermsColumnsRef.current;
      const meta = rawTermsRbMetaRef.current;
      if (!apiColumns.length || !meta) {
        console.warn("[PI] fetchTermsGridColumns called before fetchTermsDetailMeta completed.");
        return [];
      }

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
          funcCode: PI_CONFIG.RB_TERMS_DETAIL,
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
        setTermsColumns(gridColumns);
        return gridColumns;
      } catch (err) {
        console.error("[PI] fetchTermsGridColumns failed:", err);
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

      const [mstRes, detRes, indtRes, suppRes, termsRes] = await Promise.all([
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
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PI_CONFIG.SP_SUPP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: PI_CONFIG.RB_SUPP_DETAIL,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PI_CONFIG.SP_TERMS_DETAIL_FILL,
          prmParameters,
          prmFuncCode: PI_CONFIG.RB_TERMS_DETAIL,
        }),
      ]);

      const master = mstRes?.[0] ?? null;
      const details = mapDetailRowsToGridRows(detRes || []);
      const indentDetails = indtRes || [];
      const supplierDetails = mapDetailRowsToGridRows(suppRes || []);
      const termsDetails = mapDetailRowsToGridRows(termsRes || []);

      // Direct-based PIs have no indent linkage at all. The indent-detail
      // fetch above joins purely by ItemID (see mapIndentRowsToChildRowsMap),
      // not by any actual indent reference on this record — so it can
      // spuriously match an unrelated indent that happens to contain the
      // same item, even for a Direct PI. Gate on basedonid explicitly
      // rather than trusting an empty join result.
      const isDirectBase = String(master?.basedonid ?? "") === BASED_ON.DIRECT.value;

      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master) : null,
        details,
        indentDetails,
        childRowsMap: isDirectBase ? {} : mapIndentRowsToChildRowsMap(details, indentDetails),
        supplierDetails,
        termsDetails,
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
      apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
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
        const { id, ...rawRowData } = rowData;
        const colTypeMap = Object.fromEntries(allColumns.map((c) => [c.key, c.colDataType]));
        const newRowData = Object.fromEntries(
          Object.entries(rawRowData).map(([k, v]) => {
            if (isNumericColDataType(colTypeMap[k]) && v !== null && v !== undefined && v !== "")
              return [k, Number(v)];
            return [k, v];
          })
        );
        const result = await getApiClient(API_BASE_URL_IMS).post(ENDPOINTS.TRAN_FORM_EVENT, {
          prmobjname: PI_CONFIG.SP_GRID_EVENT,
          prmmyeventcol: colName,
          prmdetjson: buildDetJSON([newRowData], colTypeMap),
          prmmstjson: JSON.stringify([headerValues]),
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
    [allColumns]
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
        const body = await withSaveContextFields(
          buildSaveJsonFields({
            label: "PI Hook",
            mst: headerValues,
            det: cleanedRows,
            extra: {
              PrmStrMstRBName: PI_CONFIG.RB_MASTER,
              prmstrMasterSaveProcName: mstMeta?.SaveProcName,
              prmstrDetailSaveProcName: detMeta?.SaveProcName,
              PrmStrDetRBName: PI_CONFIG.RB_DETAIL,
              GenIDNumber: genIDNumber,
              p_ErrCode: -1,
              p_ErrMsg: "",
            },
          }),
          { divisionId: headerValues.divisionid, isEdit: genIDNumber > 0 }
        );

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
    fetchInquiryTypes,
    clearInquiryTypes,
    isLoadingInquiryTypes,
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
    supplierColumns,
    allSupplierColumns,
    fetchSupplierDetailMeta,
    fetchSupplierGridColumns,
    termsColumns,
    allTermsColumns,
    fetchTermsDetailMeta,
    fetchTermsGridColumns,
  };
}
