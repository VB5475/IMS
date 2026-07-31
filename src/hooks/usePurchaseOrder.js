// usePurchaseOrder.js — Header meta, detail grid, and filter dropdowns for Purchase Order
// ─────────────────────────────────────────────────────────────────────────────────────
// Mirrors usePurchaseInquiry.js exactly — same three-phase load pattern:
//
//   fetchHeaderMeta  → RB_PurOrderMst → GetDetailColData + Division + Supplier + Currency
//   fetchDetailMeta  → RB_PurOrderDet → GetDetailColData (columns only, no dropdowns)
//   fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (on first Add New)
//
// Additional PO-specific calls:
//   fetchPoTypes(divisionId)          — cascade: Division → PO Type
//   fetchSupplierInfo(supplierId)     — derive CurrencyRate + CrDays from selected Supplier
//   fetchExistingPOs()                — Amend dropdown: list of existing POs
//
// Cascade: Division → PO Type

import { useState, useCallback, useRef } from "react";
import axios from "axios";
import { useApi, getApiClient } from "../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  API_TIMEOUT,
  DEFAULT_SESSION_ID,
} from "../api/constants";
import { getUserSession } from "../session/userSession";
import { PO_CONFIG } from "../pages/purchase-order/constants";
import { fetchDropdownOptions, buildGridColumns, isTruthyApiFlag, isLockOnEditModeCol } from "../utils/gridUtils";
import { withSaveContextFields, buildSaveJsonFields } from "../utils/savePayload";
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

  // PG returns "currency" (not "currencyname") as the display label
  const currencyName = master.currencyname ?? master.currency ?? "";

  return {
    ...master,
    trandate: toDateInput(master.trandate),
    deliverydate: toDateInput(master.deliverydate) || null,
    currencyname: currencyName,
    yearid: getUserSession().yearId,
    funccode: PO_CONFIG.RB_MASTER,
    loginid: getUserSession().loginId,
    sessionid: DEFAULT_SESSION_ID,
  };
}

function mapDetailRowsToGridRows(rows) {
  return (rows || []).map((row, index) => ({
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

// Shared loader: RB code → RBID + SaveProcName → GetDetailColData columns.
async function loadRbDetailGridMeta(get, rbCode, storageKey) {
  const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
    ObjType: 2,
    ObjName: PO_CONFIG.SP_RB_META,
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

export function usePurchaseOrder(baseURL = API_BASE_URL) {
  const { get } = useApi(baseURL);

  // ── Header (master) state ───────────────────────────────────────────
  const [headerColumns, setHeaderColumns] = useState([]);
  const [headerRbMeta, setHeaderRbMeta] = useState(null);
  const [headerFetching, setHeaderFetching] = useState(false);
  const [headerError, setHeaderError] = useState(null);

  const [divisionOptions, setDivisionOptions] = useState([]);
  const [poTypeOptions, setPoTypeOptions] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [existingPOs, setExistingPOs] = useState([]);

  const [isLoadingPoTypes, setIsLoadingPoTypes] = useState(false);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [isLoadingExistingPOs, setIsLoadingExistingPOs] = useState(false);

  // ── Detail grid state ───────────────────────────────────────────────
  const [columns, setColumns] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [eventColumns, setEventColumns] = useState(() => new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const rawDetailColumnsRef = useRef([]);
  const rawDetailRbMetaRef = useRef(null);
  const supplierCurrencyMapRef = useRef({});

  // ── fetchDepartments ───────────────────────────────────────────────
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PO_CONFIG.SP_DEPT,
        JSon: JSON.stringify([{ prmdeptid: 0, prmloginid: getUserSession().loginId }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
          value: r.departmentid,
          label:  String(r.departmentid + " - " +r.departmentname),
      }));
      setDepartmentOptions(opts);
      return opts;
    } catch (err) {
      console.warn("[PO] Department fetch failed:", err);
      setDepartmentOptions([]);
      return [];
    }
  }, [get]);

  // ── fetchUniqueId — generate TranMstGenID on Add New ──────────────
  const fetchUniqueId = useCallback(async () => {
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PO_CONFIG.SP_UNIQUE_ID,
        JSon: JSON.stringify([{ prmidnumber: 0, prmyearid: getUserSession().yearId }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      return (res || [])?.[0]?.uniqueid ?? 0;
    } catch (err) {
      console.warn("[PO] UniqueID fetch failed:", err);
      return 0;
    }
  }, [get]);

  // ── fetchPoTypes — cascade from Division ───────────────────────────
  const fetchPoTypes = useCallback(
    async (divisionId) => {
      if (!divisionId || divisionId === "0") {
        setPoTypeOptions([]);
        return [];
      }
      setIsLoadingPoTypes(true);
      try {
        const session = getUserSession();
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PO_CONFIG.SP_PO_TYPES,
          JSon: JSON.stringify([
            {
              prmcompanyid: session.companyId,
              prmdivisionid: Number(divisionId),
              prmyearid: session.yearId,
              prmuserid: session.loginId,
              prmformtag: PO_CONFIG.FORM_TAG,
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
        setPoTypeOptions(opts);
        return opts;
      } catch (err) {
        console.warn("[PO] PO Type fetch failed:", err);
        setPoTypeOptions([]);
        return [];
      } finally {
        setIsLoadingPoTypes(false);
      }
    },
    [get]
  );

  // ── fetchSupplierInfo — derive currencyid, currencyrate, crdays ────
  const fetchSupplierInfo = useCallback(
    async (supplierId) => {
      if (!supplierId || supplierId === "0") return null;
      try {
        const res = await get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PO_CONFIG.SP_SUPPLIER_INFO,
          JSon: JSON.stringify([{ prmsupplierid: Number(supplierId) }]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        });
        const row = (res || [])?.[0];
        if (!row) return null;
        return {
          currencyid:   row.currencyid   ?? 0,
          currencyname: row.currencyname ?? "",
          currencyrate: row.currencyrate ?? 0,
          crdays:       row.crdays       ?? 0,
        };
      } catch (err) {
        console.warn("[PO] Supplier info fetch failed:", err);
        return null;
      }
    },
    [get]
  );

  // ── fetchExistingPOs — Amend dropdown ──────────────────────────────
  const fetchExistingPOs = useCallback(async () => {
    setIsLoadingExistingPOs(true);
    try {
      const res = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PO_CONFIG.SP_EXISTING_POS,
        JSon: JSON.stringify([
          {
            prmLoginID: getUserSession().loginId,
            prmCompanyID: getUserSession().companyId,
            prmYearID: getUserSession().yearId,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const opts = (res || []).map((r) => ({
        value: String(r.idnumber ?? r.poid ?? r.tranid),
        label: r.trancode ?? r.pono ?? String(r.idnumber),
      }));
      setExistingPOs(opts);
      return opts;
    } catch (err) {
      console.warn("[PO] Existing POs fetch failed:", err);
      setExistingPOs([]);
      return [];
    } finally {
      setIsLoadingExistingPOs(false);
    }
  }, [get]);

  // ── fetchHeaderMeta ─────────────────────────────────────────────────
  const fetchHeaderMeta = useCallback(async ({ skipListDropdowns = false } = {}) => {
    setHeaderFetching(true);
    setHeaderError(null);

    try {
      const metaData = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: 2,
        ObjName: PO_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: PO_CONFIG.RB_MASTER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const tableRow = metaData?.[0];
      if (!tableRow) throw new Error("No PO header RB metadata returned from server.");

      const hdrMeta = { RBID: tableRow.rbid, SaveProcName: tableRow.saveprocname };
      setHeaderRbMeta(hdrMeta);
      localStorage.setItem(PO_CONFIG.STORAGE_HEADER_META, JSON.stringify(hdrMeta));
      console.log("%c[PO] Header meta stored:", "color:#8b5cf6;font-weight:600", hdrMeta);

      const colData = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: hdrMeta.RBID,
        prmLoginID: getUserSession().loginId,
      });

      setHeaderColumns(colData || []);
      console.log(
        "%c[PO] Header columns received:",
        "color:#8b5cf6;font-weight:600",
        (colData || []).length
      );

      // On edit route, skip expensive list dropdowns — they are re-fetched
      // lazily when the user enters edit mode via fetchUnlockedHeaderDropdowns.
      if (skipListDropdowns) {
        setDivisionOptions([]);
        setSupplierOptions([]);
        setDepartmentOptions([]);
        return;
      }

      const headerSession = getUserSession();
      const [divisionData, supplierData, deptData] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PO_CONFIG.SP_DIVISIONS,
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
          console.warn("[PO] Division fetch failed:", err);
          return null;
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PO_CONFIG.SUPPLIER_SP,
          JSon: JSON.stringify([
            {
              prmdivisionid: 0,
              prmloginid: headerSession.loginId,
              prmyearid: headerSession.yearId,
              prmpartytype: PO_CONFIG.SUPPLIER_PARTY_TYPE,
            },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }).catch((err) => {
          console.warn("[PO] Supplier fetch failed:", err);
          return null;
        }),
        get(ENDPOINTS.FN_FETCH_DATA, {
          ObjType: 2,
          ObjName: PO_CONFIG.SP_DEPT,
          JSon: JSON.stringify([
            { prmdeptid: 0, prmloginid: headerSession.loginId },
          ]),
          p_ErrCode: -1,
          p_ErrMsg: "",
        }).catch((err) => {
          console.warn("[PO] Department fetch failed:", err);
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
          currencyid:   r.currencyid   ?? 0,
          currencyname: r.currencyname ?? "",
          currencyrate: r.currencyrate ?? 0,
          crdays:       r.crdays       ?? 0,
        };
      });
      setIsLoadingSuppliers(false);

      setDepartmentOptions(
        (deptData || []).map((r) => ({
          value: r.departmentid,
          label:  String(r.departmentid + " - " +r.departmentname),
        }))
      );
    } catch (err) {
      console.error("[PO] fetchHeaderMeta failed:", err);
      setHeaderError(err?.message || "Failed to load PO header configuration.");
    } finally {
      setHeaderFetching(false);
    }
  }, [get]);

  // ── fetchDetailMeta ─────────────────────────────────────────────────
  const fetchDetailMeta = useCallback(async () => {
    setIsFetching(true);
    setMetaError(null);

    try {
      const { meta, apiColumns } = await loadRbDetailGridMeta(
        get,
        PO_CONFIG.RB_DETAIL,
        PO_CONFIG.STORAGE_ENTRY_META
      );
      rawDetailRbMetaRef.current = meta;
      rawDetailColumnsRef.current = apiColumns;
      const evtSet = buildEventColumnSet(apiColumns, [
        "itemid",
        "itemcode",
        "tranqty",
        "baseqty",
        "unitconvrate",
        "tranrate",
        "baserate",
        "tranunit",
      ]);
      // Force-add amount-driving columns regardless of API iseventreq flags
      [
        "tranqty",
        "baseqty",
        "tranrate",
        "baserate",
        "unitconvrate",
        "discperc",
        "expense",
        "gstperc",
      ].forEach((k) => evtSet.add(k));
      setEventColumns(evtSet);
      setAllColumns(
        apiColumns.map((c) => ({ key: c.colname, colDataType: c.coldatatype || null }))
      );
      console.log(
        "%c[PO] Detail columns received:",
        "color:#6366f1;font-weight:600",
        apiColumns.length
      );
    } catch (err) {
      console.error("[PO] fetchDetailMeta failed:", err);
      setMetaError(err?.message || "Failed to load PO item grid configuration.");
    } finally {
      setIsFetching(false);
    }
  }, [get]);

  // ── fetchGridColumns ────────────────────────────────────────────────
  const fetchGridColumns = useCallback(
    async (divisionID = 0, editOpts = false) => {
      const opts =
        typeof editOpts === "boolean" ? { existingRecordEdit: editOpts } : editOpts || {};
      const { existingRecordEdit = false, masterRow = null, fetchUnlockedDropdowns = true } = opts;

      const apiColumns = rawDetailColumnsRef.current;
      const meta = rawDetailRbMetaRef.current;

      if (!apiColumns.length || !meta) {
        console.warn("[PO] fetchGridColumns called before fetchDetailMeta completed.");
        return [];
      }

      try {
        const colDropdownOptions = await fetchDropdownOptions(get, apiColumns, meta.RBID, {
          funcCode: PO_CONFIG.RB_DETAIL,
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
          "%c[PO] Grid columns built:",
          "color:#22c55e;font-weight:600",
          gridColumns.length
        );
        return gridColumns;
      } catch (err) {
        console.error("[PO] fetchGridColumns failed:", err);
        return [];
      }
    },
    [get]
  );

  // ── saveTxn ─────────────────────────────────────────────────────────
  const saveTxn = useCallback(
    async (headerValues, detailRows, genIDNumber = 0) => {
      setIsSaving(true);
      setSaveError(null);

      try {
        const mstMeta = JSON.parse(localStorage.getItem(PO_CONFIG.STORAGE_HEADER_META) || "null");
        const detMeta = JSON.parse(localStorage.getItem(PO_CONFIG.STORAGE_ENTRY_META) || "null");

        if (!mstMeta || !detMeta) {
          throw new Error("Missing save configuration. Please refresh and try again.");
        }

        const cleanedRows = detailRows.map(({ id, ...rest }) => rest);
        const body = await withSaveContextFields(
          buildSaveJsonFields({
            label: "PO Hook",
            mst: headerValues,
            det: cleanedRows,
            extra: {
              PrmStrMstRBName: PO_CONFIG.RB_MASTER,
              prmstrMasterSaveProcName: mstMeta?.SaveProcName,
              prmstrDetailSaveProcName: detMeta?.SaveProcName,
              PrmStrDetRBName: PO_CONFIG.RB_DETAIL,
              GenIDNumber: genIDNumber,
              p_ErrCode: -1,
              p_ErrMsg: "",
            },
          }),
          { divisionId: headerValues.divisionid, isEdit: genIDNumber > 0 }
        );

        const result = await axios.post(`${baseURL}${ENDPOINTS.RB_MASTER_DETAIL_FORM_SAVE}`, body, {
          timeout: API_TIMEOUT,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        });

        console.log("%c[PO] Save result:", "color:#22c55e;font-weight:600", result.data);
        return result.data;
      } catch (err) {
        console.error("[PO] saveTxn failed:", err);
        setSaveError(err?.message || "Save failed. Please try again.");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [baseURL]
  );

  // ── fireCellEvent — qty / rate column blur → server recalculation ───
  const [isEventFiring, setIsEventFiring] = useState(false);

  const fireCellEvent = useCallback(
    async (colName, rowData, headerValues) => {
      setIsEventFiring(true);
      try {
        const { id, ...rawRowData } = rowData;

        // Grid inputs return strings; coerce numeric columns to Number so the
        // SP receives proper JSON numerics (e.g. tranqty: 124, not "124").
        const colTypeMap = Object.fromEntries(allColumns.map((c) => [c.key, c.colDataType]));
        const newRowData = Object.fromEntries(
          Object.entries(rawRowData).map(([k, v]) => {
            if (isNumericColDataType(colTypeMap[k]) && v !== null && v !== undefined && v !== "") {
              return [k, Number(v)];
            }
            return [k, v];
          })
        );

        const result = await getApiClient(API_BASE_URL_IMS).post(ENDPOINTS.TRAN_FORM_EVENT, {
          prmobjname: PO_CONFIG.SP_GRID_EVENT,
          prmmyeventcol: colName,
          prmdetjson: buildDetJSON([newRowData], colTypeMap),
          prmmstjson: JSON.stringify([headerValues]),
        });
        console.log("%c[PO] CellEvent response:", "color:#f59e0b;font-weight:600", {
          col: colName,
          result,
        });
        return result;
      } catch (err) {
        console.error("[PO] fireCellEvent failed:", err);
        return null;
      } finally {
        setIsEventFiring(false);
      }
    },
    [allColumns]
  );

  // ── seedOptionsFromMaster — seed single-item dropdown options from master fill response ──
  // Master fill returns DivisionName, SupplierName, ConfigName, DeptName, Currency.
  // For non-editable fields (IsEditAllow: false) these are the only options ever needed.
  // For editable fields, fetchUnlockedHeaderDropdowns replaces them with the full list.
  const seedOptionsFromMaster = useCallback((master) => {
    if (master.divisionid != null && master.divisionname) {
      setDivisionOptions([{ value: String(master.divisionid), label: master.divisionname }]);
    }
    if (master.supplierid != null && master.suppliername) {
      setSupplierOptions([{ value: String(master.supplierid), label: master.suppliername }]);
      const sid = String(master.supplierid);
      supplierCurrencyMapRef.current[sid] = {
        currencyid:   master.currencyid   ?? 0,
        currencyname: master.currency ?? master.currencyname ?? "",
        currencyrate: master.currencyrate ?? 0,
        crdays:       master.creditdays   ?? 0,
      };
    }
    if (master.configid != null && master.configname) {
      setPoTypeOptions([{ value: String(master.configid), label: master.configname }]);
    }
    if (master.deptid != null && (master.deptname ?? master.department)) {
      setDepartmentOptions([{ value: String(master.deptid), label: master.deptname ?? master.department }]);
    }
  }, []);

  // ── fetchUnlockedHeaderDropdowns — re-fetch editable dropdowns when entering edit mode ──
  // Called when the user clicks Add on an existing record. Re-fetches dropdowns
  // that were skipped on initial load (skipListDropdowns = true on edit route).
  const fetchUnlockedHeaderDropdowns = useCallback(
    async (divisionId) => {
      if (!headerColumns.length) return;

      // Only fetch dropdowns for fields that are actually editable (IsEditAllow) AND
      // not locked in edit mode (IsLockOnEditModeAllow). Non-editable fields are
      // auto-filled from the master record — no dropdown API call needed.
      const isEditable = (c) => isTruthyApiFlag(c.iseditallow) && !isLockOnEditModeCol(c);

      const needsDivision = headerColumns.some((c) => c.colname === "divisionid" && isEditable(c));
      const needsSupplier = headerColumns.some((c) => c.colname === "supplierid" && isEditable(c));
      const needsConfig = headerColumns.some((c) => c.colname === "configid" && isEditable(c));
      const needsDept = headerColumns.some((c) => c.colname === "deptid" && isEditable(c));

      const tasks = [];

      if (needsDivision || needsSupplier) {
        const unlockedSession = getUserSession();
        tasks.push(
          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: 2,
            ObjName: PO_CONFIG.SP_DIVISIONS,
            JSon: JSON.stringify([{
              prmuserid: unlockedSession.loginId,
              prmcompanyid: unlockedSession.companyId,
              prmyearid: unlockedSession.yearId,
            }]),
            p_ErrCode: -1, p_ErrMsg: "",
          }).then((res) => setDivisionOptions(
            (res || []).map((r) => ({ value: String(r.divisionid), label: r.divisionname }))
          )).catch(() => { }),

          get(ENDPOINTS.FN_FETCH_DATA, {
            ObjType: 2,
            ObjName: PO_CONFIG.SUPPLIER_SP,
            JSon: JSON.stringify([{
              prmdivisionid: 0,
              prmloginid: unlockedSession.loginId,
              prmyearid: unlockedSession.yearId,
              prmpartytype: PO_CONFIG.SUPPLIER_PARTY_TYPE,
            }]),
            p_ErrCode: -1, p_ErrMsg: "",
          }).then((res) => {
            const rows = res || [];
            setSupplierOptions(rows.map((r) => ({
              value: String(r.supplierid ?? r.partyid),
              label: r.suppliername ?? r.partyname,
            })));
            supplierCurrencyMapRef.current = {};
            rows.forEach((r) => {
              const sid = String(r.supplierid ?? r.partyid);
              supplierCurrencyMapRef.current[sid] = {
                currencyid:   r.currencyid   ?? 0,
                currencyname: r.currencyname ?? "",
                currencyrate: r.currencyrate ?? 0,
                crdays:       r.crdays       ?? 0,
              };
            });
          }).catch(() => { })
        );
      }

      if (needsConfig && divisionId) tasks.push(fetchPoTypes(divisionId));
      if (needsDept) tasks.push(fetchDepartments());
      await Promise.all(tasks);
    },
    [headerColumns, get, fetchPoTypes, fetchDepartments]
  );

  // ── fetchEditRecord — load master + detail rows for edit mode ────────
  const fetchEditRecord = useCallback(
    async ({ companyId, yearId, loginId, sessionId, idNumber }) => {
      const prmParameters = buildMasterDataFillParams({
        companyId,
        yearId,
        loginId,
        sessionId,
        idNumber,
      });

      const [mstRes, detRes, indtDetRes] = await Promise.all([
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PO_CONFIG.SP_MASTER_FILL,
          prmParameters,
          prmFuncCode: PO_CONFIG.RB_MASTER,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PO_CONFIG.SP_DETAIL_FILL,
          prmParameters,
          prmFuncCode: PO_CONFIG.RB_DETAIL,
        }),
        get(ENDPOINTS.GET_MASTER_DATA_FILL, {
          prmProcedure: PO_CONFIG.SP_INDT_DETAIL_FILL,
          prmParameters,
          prmFuncCode: PO_CONFIG.RB_INDT_DETAIL,
        }),
      ]);

      const master = mstRes?.[0] ?? null;

      return {
        master,
        headerValues: master ? mapMasterRowToHeaderValues(master) : null,
        details: mapDetailRowsToGridRows(detRes || []),
        indentDetails: indtDetRes || [],
      };
    },
    [get]
  );

  const clearPoTypes = useCallback(() => setPoTypeOptions([]), []);
  const clearSaveError = useCallback(() => setSaveError(null), []);

  const getSupplierCurrency = useCallback(
    (supplierId) => supplierCurrencyMapRef.current[String(supplierId)] ?? null,
    []
  );

  return {
    // header
    headerColumns,
    headerRbMeta,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    // dropdown options
    divisionOptions,
    poTypeOptions,
    supplierOptions,
    departmentOptions,
    existingPOs,
    // loaders
    isLoadingPoTypes,
    isLoadingSuppliers,
    isLoadingExistingPOs,
    // cascade / derive
    fetchPoTypes,
    clearPoTypes,
    fetchSupplierInfo,
    getSupplierCurrency,
    fetchExistingPOs,
    fetchDepartments,
    fetchUniqueId,
    // detail grid
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    // edit flow
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    // cell events
    fireCellEvent,
    isEventFiring,
    // save
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  };
}
