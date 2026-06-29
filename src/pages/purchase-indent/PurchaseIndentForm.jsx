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

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Printer, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
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
  buildSaveRowFromColumns,
  OBJ_TYPE,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { buildGridColumns, isLockOnEditModeCol, isTruthyApiFlag, syncHeaderFilterWithApiCol, editRecordGridColumnOpts, syncEditGridDropdownValues } from "../../utils/gridUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  IND_CONFIG,
  IND_GRID_TABS,
  IND_FILTER_CASCADE_RESETS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  formatIndentTranDate,
  getMissingItemPickerHeaderFields,
} from "./constants";
import "./PurchaseIndentPage.css";

// ── Temp-ID generator (negative → never clash with real IDs) ──────────
let _indTempId = -1;
const nextTempId = () => _indTempId--;

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.companyid ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.yearid ?? session.yearId ?? IND_CONFIG.CONFIG_YEAR_ID,
    loginId: listRecord?.loginid ?? session.loginId,
    sessionId: listRecord?.sessionid ?? DEFAULT_SESSION_ID,
    idNumber: listRecord?.indentid ?? listRecord?.idnumber ?? recordId,
  };
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode:         headerValues.trancode         ?? "",
    trandate:         headerValues.trandate         ?? "",
    divisionid:       String(headerValues.divisionid       ?? ""),
    configid:         String(headerValues.configid         ?? ""),
    expecteddate:     headerValues.expecteddate     ?? "",
    deptid:           String(headerValues.deptid           ?? ""),
    locationid:       String(headerValues.locationid       ?? ""),
    remarks:          headerValues.remarks          ?? "",
    indentrefrenceno: headerValues.indentrefrenceno ?? "",
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
    const lk = k.toLowerCase();
    if (lk !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, lk)) row[lk] = v;
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
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
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
    trancode:         "",
    trandate:         todayISO,
    divisionid:       0,
    configid:         0,
    expecteddate:     null,
    deptid:           0,
    locationid:       0,
    remarks:          "",
    indentrefrenceno: "",
    tranmstgenid:     0,
    companyid:        DEFAULT_COMPANY_ID,
    yearid:           IND_CONFIG.DIVISION_YEAR_ID,
    loginid:          DEFAULT_LOGIN_ID,
    idnumber:         recordId,
    funccode:         IND_CONFIG.RB_MASTER,
  });

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { trandate: todayISO };
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
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
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
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
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

      const activeCols = await fetchGridColumns(headerValues.divisionid ?? 0, editRecordGridColumnOpts(master));
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);

      if (itemGridRef.current?.loadRows) {
        itemGridRef.current.loadRows(syncedDetails);
      } else {
        queuedRowsRef.current = syncedDetails;
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
    const divisionId = headerValuesRef.current?.divisionid ?? loadedMasterRow?.divisionid ?? 0;
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

  // ── syncedFilters — built purely from API headerColumns (fully dynamic) ────
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid: divisionOptions,
    configid:   indentTypeOptions,
    deptid:     departmentOptions,
    locationid: locationOptions,
  }), [divisionOptions, indentTypeOptions, departmentOptions, locationOptions]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible))
      .map((col) => {
        const lockOnEditMode = isLockOnEditModeCol(col);
        const staticOptions  = DROPDOWN_OPTIONS_BY_COL[col.colname];
        const base = {
          FilterParameterID: col.colname,
          FilterColName:     col.colname,
          FilterCaption:     col.displayname ?? col.colname,
          FilterColCtrlType: col.colctrltype ?? 0,
          ...(staticOptions ? { staticOptions } : {}),
        };
        return syncHeaderFilterWithApiCol(base, col, { lockOnEditMode });
      });
  }, [headerColumns, DROPDOWN_OPTIONS_BY_COL]);

  // ── filterFieldTones — per-field visual state ──────────────────────
  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode) tone = "view";
      else if (isEditRoute && f.lockOnEditMode) tone = "frozen";
      tones[f.FilterColName] = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

  // ── Filter change / cascade ────────────────────────────────────────
  const handleFilterChange = useCallback(
    async (colName, val) => {
      headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

      if (colName === "divisionid") {
        headerValuesRef.current.configid = 0;
        clearIndentTypes();
        itemGridRef.current?.clearRows?.();
        if (val && val !== "0") {
          await fetchIndentTypes(val);
          requestAnimationFrame(() =>
            filterPanelRef.current
              ?.querySelector("#efq-configid .search-select__trigger")
              ?.focus()
          );
        }
        return;
      }

      if (colName === "configid") {
        itemGridRef.current?.clearRows?.();
      }
    },
    [fetchIndentTypes, clearIndentTypes]
  );

  const ensureItemColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    setIsGridLoading(true);
    try {
      const activeCols = await fetchGridColumns(headerValuesRef.current?.divisionid ?? 0);
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
      const responseRow = result?.[0];
      if (!responseRow) return;
      const errCode = responseRow.errcode;
      if (errCode !== 1 && errCode !== 1.0) {
        console.warn("[Indent] Cell-event error:", responseRow.errmsg ?? `ErrCode ${errCode}`);
        return;
      }
      const { errcode, errmsg, ...updatedFields } = responseRow;
      itemGridRef.current.updateRow?.(rowId, updatedFields);
    },
    [fireCellEvent]
  );

  // ── Select Item ────────────────────────────────────────────────────
  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const missingFields = getMissingItemPickerHeaderFields(headerValues);
    if (missingFields.length > 0) {
      setFormErrors(missingFields);
      return;
    }
    const { divisionid, configid, trandate } = headerValues;
    const divisionID = divisionid ?? 0;

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
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: DEFAULT_LOGIN_ID,
      });
      const gridColumns = buildGridColumns(colRes || [], {}, {
        filterable: false,
        allEditable: false,
      });
      setItemModalColumns(gridColumns);

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: IND_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([
          {
            prmdivisionid: Number(divisionID),
            prmyearid: IND_CONFIG.CONFIG_YEAR_ID,
            prmloginid: DEFAULT_LOGIN_ID,
            prmtrandate: formatIndentTranDate(trandate),
            prmconfigid: Number(configid ?? 0),
            prmsupplierid: 0,
            prmtranbook: IND_CONFIG.TRAN_BOOK,
            prmfrmoption: 0,
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(rowRes || []);
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

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
  }, [activeTab, handleSelectItem]);

  const handleToggleCollapsible = useCallback(() => {
    itemGridRef.current?.toggleFocusedRowCollapsible?.();
  }, []);

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
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrors = validateApiColumns(headerValuesRef.current, headerColsToValidate);

    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const detailErrors = validateGridRows(detailRows, columns);

    const allErrors = [...headerErrors, ...detailErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const mstRow = {};
    headerColumns.forEach((col) => {
      mstRow[col.colname] = getColDefault(col.coldatatype);
    });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => {
      if (k !== "id") mstRow[k] = v;
    });
    mstRow.loginid = DEFAULT_LOGIN_ID;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { loginid: DEFAULT_LOGIN_ID })
    );

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: "Indent", mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSavingIndent(true);
    try {
      const res = await fetch(`${API_BASE_URL_IMS}${IND_CONFIG.SAVE_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
    } catch (err) {
      console.error("[Indent Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSavingIndent(false);
    }
  }, [headerColumns, allColumns, columns, isEditRoute]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;
    window.print();
  }, [handleSave]);

  const [discardOpen, setDiscardOpen] = useState(false);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);

    localStorage.removeItem(IND_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(IND_CONFIG.STORAGE_ENTRY_META);

    headerValuesRef.current = {
      trancode:         "",
      trandate:         todayISO,
      divisionid:       0,
      configid:         0,
      expecteddate:     null,
      deptid:           0,
      locationid:       0,
      remarks:          "",
      indentrefrenceno: "",
      tranmstgenid:     0,
      companyid:        DEFAULT_COMPANY_ID,
      yearid:           IND_CONFIG.DIVISION_YEAR_ID,
      loginid:          DEFAULT_LOGIN_ID,
      idnumber:         0,
      funccode:         IND_CONFIG.RB_MASTER,
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

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isLoadingIndentTypes;

  useEntryFormKeyboard({
    blocked: itemModalOpen,
    isEditMode,
    isSaving: isSavingIndent,
    addDisabled: filterBusy,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onSavePrint: handleSaveAndPrint,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
    onToggleCollapsible: handleToggleCollapsible,
  });

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
        title: FORM_SHORTCUT_TITLES.savePrint,
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
        title: FORM_SHORTCUT_TITLES.save,
      },
    ],
    [handleSaveAndPrint, isSavingIndent, handleSave]
  );

  const itemGridConfig = {
    columns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };
  const combinedError = metaError || headerError;

  return (
    <div className="workspace-page ind-page">
      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
      <ConfirmDialog
        isOpen={discardOpen}
        message="Discard changes and reset the form?"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />

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
              className="eg-tab-btn"
              onClick={handleSelectItem}
              disabled={!isEditMode}
              title="Pick items from list (Tab here after header fields)"
            >
              <Package size={12} strokeWidth={2.5} />
              Select Item
            </button>

            <button
              type="button"
              className="eg-tab-btn eg-tab-btn--danger"
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
        addLabel={isEditRoute ? "Edit" : "Add"}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={indExtraButtons}
      />

      <Suspense fallback={null}>
        <OrderItemModal
          isOpen={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          items={itemModalItems}
          columns={itemModalColumns}
          isLoading={itemModalLoading}
          error={itemModalError}
          onInsert={handleInsertItems}
        />
      </Suspense>
    </div>
  );
}
