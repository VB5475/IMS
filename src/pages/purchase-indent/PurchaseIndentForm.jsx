// PurchaseIndentForm.jsx
// Purchase Indent entry form (add / edit).
// Mirrors PurchaseOrderForm.jsx — same three-phase load, edit-mode gate, item grid.
//
// Simplified vs PO (removed): Amend strip, Supplier, Currency, CreditDays,
//   BasedOnID, Terms tab, EnterpriseSummaryPanel, cell-event, 3rd detail table.
// Added vs PO: ExpDate (Expiry Date), LocationID (pending SP from DBA).
//
// Layout (top → bottom):
//   1. EnterpriseFilterPanel  — header fields (Indent No, Date, Division, Indent Type,
//                               Expiry Date, Department, Location, Remarks)
//   2. ind-grid-section       — single-tab wrapper
//        • Item Grid tab  → EntryGrid (API columns, RB_PurIndentDet)
//                           buttons: Add New | Select Item | Delete
//   3. ActionBar              — Add / Save / Cancel / Close (Alt shortcuts)

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save, LogOut } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import OrderItemModal from "../../components/txn/OrderItemModal";
import { usePurchaseIndent } from "../../hooks/usePurchaseIndent";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_LOGIN_ID,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
  getColDefault,
  OBJ_TYPE,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { buildGridColumns, isLockOnEditModeCol } from "../../utils/gridUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import {
  IND_CONFIG,
  IND_HEADER_FILTERS,
  IND_GRID_TABS,
  IND_FILTER_CASCADE_RESETS,
  IND_SHORTCUT_CONFIG,
  formatIndentTranDate,
} from "./constants";
import "./PurchaseIndentPage.css";

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _indTempId = -1;
const nextTempId = () => _indTempId--;

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.CompanyID ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.YearID ?? session.yearId ?? IND_CONFIG.CONFIG_YEAR_ID,
    loginId: listRecord?.LoginID ?? session.loginId,
    sessionId: listRecord?.SessionID ?? listRecord?.SessionId ?? DEFAULT_SESSION_ID,
    idNumber: listRecord?.IndentID ?? listRecord?.IDNumber ?? recordId,
  };
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    TranCode: headerValues.TranCode ?? "",
    TranDate: headerValues.TranDate ?? "",
    DivisionID: String(headerValues.DivisionID ?? ""),
    ConfigID: String(headerValues.ConfigID ?? ""),
    ExpDate: headerValues.ExpDate ?? "",
    DeptID: String(headerValues.DeptID ?? ""),
    LocationID: String(headerValues.LocationID ?? ""),
    Remarks: headerValues.Remarks ?? "",
    IndentRefrenceNo: headerValues.IndentRefrenceNo ?? "",
  };
}

function queryEditableFilterFields(panel) {
  if (!panel) return [];
  return [
    ...panel.querySelectorAll(
      "input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), .search-select__trigger:not([disabled])"
    ),
  ].filter((el) => el.offsetParent !== null);
}

function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => {
    row[key] = getColDefault(colDataType);
  });
  Object.entries(item).forEach(([k, v]) => {
    if (k !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, k)) row[k] = v;
  });
  return row;
}

// ── Component ──────────────────────────────────────────────────────────

export default function PurchaseIndentForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const navigate = useNavigate();

  const itemGridRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const { get: getLive } = useApi(API_BASE_URL);

  const {
    headerColumns,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    divisionOptions,
    indentTypeOptions,
    departmentOptions,
    locationOptions,
    fetchIndentTypes,
    clearIndentTypes,
    isLoadingIndentTypes,
    columns,
    allColumns,
    eventColumns,
    isFetching,
    metaError,
    fetchDetailMeta,
    fetchGridColumns,
    fetchEditRecord,
    seedOptionsFromMaster,
    fetchUnlockedHeaderDropdowns,
    fireCellEvent,
    saveTxn,
    isSaving,
    saveError,
    clearSaveError,
  } = usePurchaseIndent(API_BASE_URL);

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const editRecordLoadedRef = useRef(false);

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const headerValuesRef = useRef({
    TranCode: "",
    TranDate: todayISO,
    DivisionID: 0,
    ConfigID: 0,
    ExpDate: null,
    DeptID: 0,
    LocationID: 0,
    Remarks: "",
    IndentRefrenceNo: "",
    TranMstGenID: 0,
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: IND_CONFIG.DIVISION_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    IDNumber: recordId,
    FuncCode: IND_CONFIG.RB_MASTER,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { TranDate: todayISO };
  }, [loadedFilterValues, todayISO]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [isGridLoading, setIsGridLoading] = useState(false);

  // Item picker modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  // ── Edit-mode gate ─────────────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);

  const focusFirstEditableFilterField = useCallback(() => {
    const fields = queryEditableFilterFields(filterPanelRef.current);
    if (fields.length === 0) return false;
    fields[0].focus();
    return true;
  }, []);

  const focusSelectItemButton = useCallback(() => {
    setActiveTab("items");
    selectItemBtnRef.current?.focus();
  }, []);

  const enterEditModeWithFocus = useCallback(() => {
    setIsEditMode(true);
    setActiveTab("items");
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!focusFirstEditableFilterField()) focusSelectItemButton();
      }, 80);
    });
  }, [focusFirstEditableFilterField, focusSelectItemButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  usePageHeader({
    title: isNewRoute ? "New Purchase Indent" : "Purchase Indent",
    subtitle: isNewRoute
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading purchase indent…"
        : recordLoadError
          ? recordLoadError
          : `Indent #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: "/purchase-indent",
  });

  // ── Mount: load metadata ───────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  // Phase 3 (new route only): pre-load grid columns after detail meta loads
  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

  // Flush any queued rows once columns are ready
  useEffect(() => {
    if (columns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      if (itemGridRef.current.loadRows) {
        itemGridRef.current.loadRows(queuedRowsRef.current);
      } else {
        queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      }
      queuedRowsRef.current = [];
    }
  }, [columns]);

  // ── Edit flow: load existing record ───────────────────────────────
  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord);
      const { master, headerValues, details } = await fetchEditRecord(params);

      if (!master || !headerValues) {
        throw new Error("Purchase Indent record not found.");
      }

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const activeCols = await fetchGridColumns(headerValues.DivisionID ?? 0, {
        existingRecordEdit: true,
        masterRow: master,
        fetchUnlockedDropdowns: false,
      });
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      if (itemGridRef.current?.loadRows) {
        itemGridRef.current.loadRows(details);
      } else {
        queuedRowsRef.current = details;
      }
    } catch (err) {
      console.error("[Indent] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load purchase indent record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !loadedMasterRow) return;
    const divisionId = headerValuesRef.current?.DivisionID ?? loadedMasterRow?.DivisionID ?? 0;
    fetchUnlockedHeaderDropdowns(divisionId);
    fetchGridColumns(divisionId, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── syncedFilters — inject dynamic options ─────────────────────────
  const syncedFilters = useMemo(() => {
    const injectOptions = (filter) => {
      switch (filter.FilterParameterID) {
        case "DivisionID":
          return { ...filter, staticOptions: divisionOptions };
        case "ConfigID":
          return { ...filter, staticOptions: indentTypeOptions };
        case "DeptID":
          return { ...filter, staticOptions: departmentOptions };
        case "LocationID":
          return { ...filter, staticOptions: locationOptions };
        default:
          return filter;
      }
    };

    if (headerColumns.length === 0) return IND_HEADER_FILTERS.map(injectOptions);

    const apiColMap = {};
    headerColumns.forEach((col) => { apiColMap[col.ColName] = col; });

    return IND_HEADER_FILTERS.map((filter) => {
      const withOpts = injectOptions(filter);
      const apiCol = apiColMap[filter.FilterParameterID] || apiColMap[filter.FilterColName];
      if (!apiCol) return withOpts;
      return {
        ...withOpts,
        FilterColName: apiCol.ColName,
        lockOnEditMode: isLockOnEditModeCol(apiCol),
      };
    });
  }, [headerColumns, divisionOptions, indentTypeOptions, departmentOptions, locationOptions]);

  // ── filterFieldTones — per-field visual state ──────────────────────
  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      if (!isEditMode) tones[f.FilterColName] = "view";
      else if (isEditRoute && f.lockOnEditMode) tones[f.FilterColName] = "frozen";
      else tones[f.FilterColName] = "editable";
    });
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

  // ── Filter change / cascade ────────────────────────────────────────
  const handleFilterChange = useCallback(
    async (colName, val) => {
      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

      if (colName === "DivisionID") {
        headerValuesRef.current.ConfigID = 0;
        clearIndentTypes();
        itemGridRef.current?.clearRows?.();
        if (val && val !== "0") await fetchIndentTypes(val);
      }
    },
    [fetchIndentTypes, clearIndentTypes]
  );

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchGridColumns(headerValuesRef.current?.DivisionID ?? 0);
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;
      return activeCols;
    } finally {
      setIsGridLoading(false);
    }
  }, [columns, allColumns, fetchGridColumns]);

  // ── Cell event — Qty / Rate recalculation ─────────────────────────
  const handleCellEvent = useCallback(
    async ({ rowId, colKey, rowData }) => {
      const result = await fireCellEvent(colKey, rowData, headerValuesRef.current);
      if (!result || !itemGridRef.current) return;
      const responseRow = result?.Links?.[0];
      if (!responseRow) return;
      const errCode = responseRow.ErrCode;
      if (errCode !== 1 && errCode !== 1.0) {
        console.warn("[Indent] Cell-event error:", responseRow.ErrMsg ?? `ErrCode ${errCode}`);
        return;
      }
      const { ErrCode, ErrMsg, ...updatedFields } = responseRow;
      itemGridRef.current.updateRow?.(rowId, updatedFields);
    },
    [fireCellEvent]
  );

  // ── Select Item ────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const { DivisionID, ConfigID, TranDate } = headerValuesRef.current;
    const divisionID = DivisionID ?? 0;
    if (!divisionID || divisionID === "0" || divisionID === 0) {
      alert("Please select a Division before selecting items.");
      return;
    }

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      // Indent always uses Direct mode (BasedOnID = 0 / prmFrmOption = 0) per MRD
      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: IND_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmRBCode: IND_CONFIG.RB_DETAIL_SELECT }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.Table?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.RBID,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const gridColumns = buildGridColumns(colRes?.Links || [], {}, {
        filterable: false,
        allEditable: false,
      });
      setItemModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: IND_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([
          {
            prmDivisionID: Number(divisionID),
            prmYearID: IND_CONFIG.CONFIG_YEAR_ID,
            prmLoginID: DEFAULT_LOGIN_ID,
            prmTranDate: formatIndentTranDate(TranDate),
            prmConfigID: Number(ConfigID ?? 0),
            prmSupplierId : 0,
            prmTranBook: IND_CONFIG.TRAN_BOOK,
            prmFrmOption: 0,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes?.Table || []);
    } catch (err) {
      console.error("[Indent] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive]);

  const handleInsertItems = useCallback(
    async (selectedItems) => {
      if (!selectedItems?.length) return;
      setActiveTab("items");
      const activeCols = await ensureItemColumns();
      if (!activeCols?.length) return;
      selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, allColumns)));
    },
    [ensureItemColumns, allColumns, addItemRow]
  );

  // ── Delete selected rows ───────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  // ── Save ───────────────────────────────────────────────────────────
  const [isSavingIndent, setIsSavingIndent] = useState(false);

  const handleSave = useCallback(async () => {
    const mstRow = {};
    headerColumns.forEach((col) => {
      mstRow[col.ColName] = getColDefault(col.ColDataType);
    });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => {
      if (k !== "id") mstRow[k] = v;
    });
    mstRow.LoginID = DEFAULT_LOGIN_ID;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => {
        row[key] = getColDefault(colDataType);
      });
      return { ...row, ...rest, LoginID: DEFAULT_LOGIN_ID };
    });

    console.log("Indt Mst:",mstRow);
    console.log("Indt Det:",detRows);
    const payload = {
      prmStrMstJSON: JSON.stringify([mstRow]),
      prmStrDetJSON: JSON.stringify(detRows),
    };

    console.log("%c[Indent Save] Payload:", "color:#f59e0b;font-weight:700", payload);

    setIsSavingIndent(true);
    try {
      const res = await fetch(`${API_BASE_URL_IMS}${IND_CONFIG.SAVE_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      console.log("%c[Indent Save] Response:", "color:#22c55e;font-weight:700", result);
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("Purchase Indent saved successfully!");
    } catch (err) {
      console.error("[Indent Save] Failed:", err);
      alert(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSavingIndent(false);
    }
  }, [headerColumns, allColumns]);

  const handleSaveAndPrint = useCallback(async () => {
    await handleSave();
    window.print();
  }, [handleSave]);

  const handleCancel = useCallback(() => {
    if (!window.confirm("Discard changes and reset the form?")) return;

    localStorage.removeItem(IND_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(IND_CONFIG.STORAGE_ENTRY_META);

    headerValuesRef.current = {
      TranCode: "",
      TranDate: todayISO,
      DivisionID: 0,
      ConfigID: 0,
      ExpDate: null,
      DeptID: 0,
      LocationID: 0,
      Remarks: "",
      IndentRefrenceNo: "",
      TranMstGenID: 0,
      CompanyID: DEFAULT_COMPANY_ID,
      YearID: IND_CONFIG.DIVISION_YEAR_ID,
      LoginID: DEFAULT_LOGIN_ID,
      IDNumber: 0,
      FuncCode: IND_CONFIG.RB_MASTER,
    };

    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;

    clearIndentTypes();
    clearSaveError();

    setActiveTab("items");
    setIsGridLoading(false);
    setItemSelectionCount(0);
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);

    itemGridRef.current?.clearRows?.();
    setFilterResetKey((k) => k + 1);
    exitEditMode();
  }, [clearIndentTypes, clearSaveError, exitEditMode, todayISO]);

  const handleClose = useCallback(() => navigate("/purchase-indent"), [navigate]);

  // ── Keyboard shortcuts — Alt+A Add | Alt+S Save | Alt+N Cancel | Alt+C Close ──
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isLoadingIndentTypes;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (itemModalOpen) return;
      const key = e.key.toLowerCase();
      switch (key) {
        case "a":
          if (!isEditMode && !filterBusy) { e.preventDefault(); enterEditModeWithFocus(); }
          break;
        case "s":
          if (isEditMode && !isSavingIndent) { e.preventDefault(); handleSave(); }
          break;
        case "n":
          if (isEditMode) { e.preventDefault(); handleCancel(); }
          break;
        case "c":
          e.preventDefault();
          handleClose();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditMode, filterBusy, isSavingIndent, itemModalOpen, enterEditModeWithFocus, handleSave, handleCancel, handleClose]);

  // ── Extra ActionBar buttons ────────────────────────────────────────
  const indExtraButtons = useMemo(
    () => [
      {
        key: "saveprint",
        label: "Save & Print",
        Icon: Printer,
        variant: "print",
        onClick: handleSaveAndPrint,
        disabled: isSavingIndent,
      },
      {
        key: "save",
        label: isSavingIndent ? "Saving…" : "Save",
        Icon: Save,
        variant: "save",
        onClick: handleSave,
        disabled: isSavingIndent,
        loading: isSavingIndent,
        accessKey: "s",
        title: IND_SHORTCUT_CONFIG.s.title,
      },
      { key: "sep1", separator: true },
      {
        key: "close",
        label: "Close",
        Icon: LogOut,
        variant: "close",
        onClick: handleClose,
        showAlways: true,
        accessKey: "c",
        title: IND_SHORTCUT_CONFIG.c.title,
      },
    ],
    [handleSaveAndPrint, isSavingIndent, handleSave, handleClose]
  );

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;

  return (
    <div className="workspace-page ind-page">
      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button
              type="button"
              onClick={() => {
                fetchHeaderMeta();
                fetchDetailMeta();
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Purchase Indent Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={IND_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      {/* ── Single-tab grid section ───────────────────────────────────── */}
      <section className="ind-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {IND_GRID_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`grid-tab ${activeTab === t.id ? "grid-tab--active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid-tabbar__controls">
            <button
              ref={selectItemBtnRef}
              type="button"
              className="ind-tab-action-btn"
              onClick={handleSelectItem}
              disabled={!isEditMode}
              title="Pick items from list (Tab here after header fields)"
            >
              <Package size={12} strokeWidth={2.5} />
              Select Item
            </button>

            <button
              type="button"
              className="ind-tab-delete-btn"
              onClick={handleDeleteSelected}
              disabled={!isEditMode || itemSelectionCount === 0}
              title="Delete selected rows"
            >
              <Trash2 size={12} strokeWidth={2} />
              Delete
            </button>
          </div>
        </div>

        <div className={`ind-tab-pane${activeTab === "items" ? " ind-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Select Item above."
            onSelectionChange={setItemSelectionCount}
            onCellEvent={handleCellEvent}
            eventColumns={eventColumns}
            readOnly={isEditRoute && !isEditMode}
            existingRecordEdit={isEditRoute && isEditMode}
          />
        </div>
      </section>

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={indExtraButtons}
      />

      <OrderItemModal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        items={itemModalItems}
        columns={itemModalColumns}
        isLoading={itemModalLoading}
        error={itemModalError}
        onInsert={handleInsertItems}
      />
    </div>
  );
}
