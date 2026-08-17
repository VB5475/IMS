// usePurchaseRateContract.js — Header meta, item + terms grids for Purchase Rate Contract
// Mirrors usePurchaseOrder (supplier + currency) + Inquiry terms detail pattern.
// MRD_Template4PurchaseRateContract.docx (Richa, 03-Jul-2026).

import { useState, useCallback, useRef } from "react";
import { useApi, getApiClient } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { PRC_CONFIG } from "../pages/purchase-rate-contract/constants";
import {
  fetchDropdownOptions,
  buildGridColumns,
  isTruthyApiFlag,
  isLockOnEditModeCol,
} from "../utils/gridUtils";
import { isNumericColDataType, buildDetJSON } from "../utils/columnValidation";

function buildMasterDataFillParams({ companyId, yearId, loginId, sessionId, idNumber }) {
  const session = getUserSession();
  return [
    Number(companyId) || session.companyId,
    Number(yearId) || session.yearId,
    Number(loginId) || session.loginId,
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

  const currencyName = master.currencyname ?? master.currency ?? "";

  return {
    ...master,
    trandate: toDateInput(master.trandate),
    expirydate: toDateInput(master.expirydate) || null,
    currencyname: currencyName,
    yearid: getUserSession().yearId,
    funccode: PRC_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
}

// 2026-08-17 (/pm) — project-wide sentinel-row fix (see usePurchaseInquiry.js
// for the original bug write-up). A detail-fill SP with nothing to return
// sends a single {ErrCode, ErrMsg} "no data" row instead of an empty array;
// without this guard it was loaded as one phantom blank grid row instead of
// showing the grid's emptyMessage.
import { isErrorOnlyRow } from "../utils/apiResponse";

function mapDetailRowsToGridRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 1 && isErrorOnlyRow(list[0])) return [];
  return list.map((row, index) => ({
    ...row,
    id: String(row.compuniquekey ?? row.idnumber ?? row.masterid ?? `edit_${index}`),
  }));
}

function buildEventColumnSet(apiColumns, fallbackKeys = []) {
  const set = new Set();
  apiColumns.forEach((col) => {
    if (isTruthyApiFlag(col.iseventreq) || isTruthyApiFlag(col.iseventcol)) {
      set.add(col.colname);
    }
  });
  if (set.size === 0) fallbackKeys.forEach((k) => set.add(k));
  return set;
}

async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: PRC_CONFIG.SP_RB_META,
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
  return { meta, apiColumns: colData || [] };
}

export function usePurchaseRateContract(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const supplierCurrencyMapRef = useRef({});

  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);

  const [termsColumns, setTermsColumns] = useState([]);
  const [allTermsColumns, setAllTermsColumns] = useState([]);
  const rawTermsColumnsRef = useRef([]);
  const rawTermsRbMetaRef = useRef(null);

  const [isEventFiring, setIsEventFiring] = useState(false);

  const fetchSupplierInfo = useCallback(
    async (supplierId) => {
      if (!supplierId || supplierId === "0") return null;
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PRC_CONFIG.SP_SUPPLIER_INFO,
          JSon: JSON.stringify([{ prmsupplierid: Number(supplierId) }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const row = (res || [])?.[0];
        if (!row) return null;
        return {
          currencyid: row.currencyid ?? 0,
          currencyname: row.currencyname ?? "",
          currencyrate: row.currencyrate ?? 0,
          crdays: row.crdays ?? 0,
        };
      } catch (err) {
        console.warn("[PRC] Supplier info fetch failed:", err);
        return null;
      }
    },
    [get]
  );

  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);

    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PRC_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: PRC_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No PRC header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      setHeaderRbMeta(hdrMeta);
      localStorage.setItem(PRC_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });
      setHeaderColumns(colData || []);

      if (skipListDropdowns) {
        setDivisionOptions([]);
        setSupplierOptions([]);
        return;
      }

      const headerSession = getUserSession();
      const [divisionData, supplierData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PRC_CONFIG.SP_DIVISIONS,
          JSon: JSON.stringify([
            {
              prmuserid: headerSession.loginId,
              prmcompanyid: headerSession.companyId,
              prmyearid: headerSession.yearId,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }).catch((err) => {
          console.warn("[PRC] Division fetch failed:", err);
          return null;
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PRC_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([
            {
              prmdivisionid: 0,
              prmloginid: headerSession.loginId,
              prmyearid: headerSession.yearId,
              prmpartytype: PRC_CONFIG.SUPPLIER_PARTY_TYPE,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }).catch((err) => {
          console.warn("[PRC] Supplier fetch failed:", err);
          return null;
        }),
      ]);

      setDivisionOptions(
        (divisionData || []).map((r) => ({
          value: String(r.divisionid),
          label: r.divisionname,
        }))
      );

      setIsLoadingSuppliers(true);
      const supplierRows = supplierData || [];
      setSupplierOptions(
        supplierRows.map((r) => ({
          value: String(r.supplierid ?? r.partyid),
          label: r.suppliername ?? r.partyname,
        }))
      );
      supplierCurrencyMapRef.current = {};
      supplierRows.forEach((r) => {
        const sid = String(r.supplierid ?? r.partyid);
        supplierCurrencyMapRef.current[sid] = {
          currencyid: r.currencyid ?? 0,
          currencyname: r.currencyname ?? "",
          currencyrate: r.currencyrate ?? 0,
          crdays: r.crdays ?? 0,
        };
      });
      setIsLoadingSuppliers(false);
    } catch (err) {
      console.error("[PRC] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load header configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        PRC_CONFIG.RB_DETAIL,
        PRC_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;
      const evtSet = buildEventColumnSet(apiColumns, ["itemid", "itemcode", "qty", "rate"]);
      ["qty", "rate", "tranqty", "tranrate"].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);
      setAllColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
    } catch (err) {
      console.error("[PRC] fetchDetailMeta failed:", err);
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
      if (!apiColumns.length || !meta) return [];

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
          funcCode: PRC_CONFIG.RB_DETAIL,
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
        return gridColumns;
      } catch (err) {
        console.error("[PRC] fetchGridColumns failed:", err);
        return [];
      }
    },
    [get]
  );

  const fetchTermsDetailMeta = useCallback(async () => {
    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        PRC_CONFIG.RB_TERMS_DETAIL,
        PRC_CONFIG.STORAGE_TERMS_META
      );
      rawTermsRbMetaRef.current = meta;
      rawTermsColumnsRef.current = apiColumns;
      setAllTermsColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
    } catch (err) {
      console.error("[PRC] fetchTermsDetailMeta failed:", err);
    }
  }, [get]);

  const fetchTermsGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts =
        typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;
      const apiColumns = rawTermsColumnsRef.current;
      const meta = rawTermsRbMetaRef.current;
      if (!apiColumns.length || !meta) return [];

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
          funcCode: PRC_CONFIG.RB_TERMS_DETAIL,
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
        console.error("[PRC] fetchTermsGridColumns failed:", err);
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

      const [mstRes, detRes, termsRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PRC_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: PRC_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PRC_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: PRC_CONFIG.RB_DETAIL,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PRC_CONFIG.SP_TERMS_DETAIL_FILL,
          prmParameters,
          prmFuncCode: PRC_CONFIG.RB_TERMS_DETAIL,
        }),
      ]);

      const master = mstRes?.[0] ?? null;
      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master) : null,
        details: mapDetailRowsToGridRows(detRes || []),
        termsDetails: mapDetailRowsToGridRows(termsRes || []),
      };
    },
    [get]
  );

  const seedOptionsFromMaster = useCallback((master) => {
    if (master.divisionid != null && master.divisionname) {
      setDivisionOptions([{ value: String(master.divisionid), label: master.divisionname }]);
    }
    if (master.supplierid != null && master.suppliername) {
      setSupplierOptions([{ value: String(master.supplierid), label: master.suppliername }]);
      const sid = String(master.supplierid);
      supplierCurrencyMapRef.current[sid] = {
        currencyid: master.currencyid ?? 0,
        currencyname: master.currency ?? master.currencyname ?? "",
        currencyrate: master.currencyrate ?? 0,
        crdays: master.creditdays ?? 0,
      };
    }
  }, []);

  const fetchUnlockedHeaderDropdowns = useCallback(
    async () => {
      if (!headerColumns.length) return;
      const isEditable = (c) => isTruthyApiFlag(c.iseditallow) && !isLockOnEditModeCol(c);
      const needsDivision = headerColumns.some((c) => c.colname === "divisionid" && isEditable(c));
      const needsSupplier = headerColumns.some((c) => c.colname === "supplierid" && isEditable(c));
      if (!needsDivision && !needsSupplier) return;

      const session = getUserSession();
      const tasks = [];
      if (needsDivision) {
        tasks.push(
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: 2,
            ObjName: PRC_CONFIG.SP_DIVISIONS,
            JSon: JSON.stringify([{
              prmuserid: session.loginId,
              prmcompanyid: session.companyId,
              prmyearid: session.yearId,
            }]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          })
            .then((res) =>
              setDivisionOptions(
                (res || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname }))
              )
            )
            .catch(() => {})
        );
      }
      if (needsSupplier) {
        tasks.push(
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: 2,
            ObjName: PRC_CONFIG.SUPPLIER_SP,
            JSon: JSON.stringify([{
              prmdivisionid: 0,
              prmloginid: session.loginId,
              prmyearid: session.yearId,
              prmpartytype: PRC_CONFIG.SUPPLIER_PARTY_TYPE,
            }]),
            p_ErrCode: -1,
            p_ErrMsg: "",
          })
            .then((res) => {
              const rows = res || [];
              setSupplierOptions(
                rows.map((r) => ({
                  value: String(r.supplierid ?? r.partyid),
                  label: r.suppliername ?? r.partyname,
                }))
              );
              supplierCurrencyMapRef.current = {};
              rows.forEach((r) => {
                const sid = String(r.supplierid ?? r.partyid);
                supplierCurrencyMapRef.current[sid] = {
                  currencyid: r.currencyid ?? 0,
                  currencyname: r.currencyname ?? "",
                  currencyrate: r.currencyrate ?? 0,
                  crdays: r.crdays ?? 0,
                };
              });
            })
            .catch(() => {})
        );
      }
      await Promise.all(tasks);
    },
    [headerColumns, get]
  );

  const fireCellEvent = useCallback(
    async (colName, rowData, headerValues) => {
      setIsEventFiring(true);
      try {
        const { id, ...rawRowData } = rowData;
        const colTypeMap = Object.fromEntries(allColumns.map((c) => [c.key, c.colDataType]));
        const newRowData = Object.fromEntries(
          Object.entries(rawRowData).map(([k, v]) => {
            if (isNumericColDataType(colTypeMap[k]) && v !== null && v !== undefined && v !== "") {
              return [k, Number(v)];
            }
            return [k, v];
          })
        );

        // SP fn_tbl_rb_purratecontmst_event(@prmmyeventcol, @prmjson, @prmmstjson)
        // — detail rows go in prmjson (not the usual prmdetjson key).
        return await getApiClient(API_BASE_URL_IMS).post(ENDPOINTS.TRAN_FORM_EVENT, {
          prmobjname: PRC_CONFIG.SP_GRID_EVENT,
          prmmyeventcol: colName,
          prmjson: buildDetJSON([newRowData], colTypeMap),
          prmmstjson: JSON.stringify([headerValues]),
        });
      } catch (err) {
        console.error("[PRC] fireCellEvent failed:", err);
        return null;
      } finally {
        setIsEventFiring(false);
      }
    },
    [allColumns]
  );

  const getSupplierCurrency = useCallback(
    (supplierId) => supplierCurrencyMapRef.current[String(supplierId)] ?? null,
    []
  );

  return {
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    supplierOptions,
    isLoadingSuppliers,
    fetchSupplierInfo,
    getSupplierCurrency,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    termsColumns,
    allTermsColumns,
    fetchTermsDetailMeta,
    fetchTermsGridColumns,
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    fireCellEvent,
    isEventFiring,
  };
}
