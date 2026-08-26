// BomMasterForm.jsx — Assets BOM Master entry form (Add / Edit)

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));
import { useBomMaster } from "../../hooks/useBomMaster";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  getColDefault,
  buildSaveRowFromColumns,
  OBJ_TYPE,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import {
  buildGridColumns,
  isLockOnEditModeCol,
  isTruthyApiFlag,
  syncHeaderFilterWithApiCol,
} from "../../utils/gridUtils";
import { validateApiColumnsByField, validateGridRowsDetailed } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { queryEditableFilterFields } from "../../utils/txnFormUtils";
import { focusAndSelect } from "../../utils/focusUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { completeTransactionSave } from "../../hooks/useTransactionFormReset";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import {
  BOM_CONFIG,
  BOM_GRID_TABS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  buildBomItemPickerJsonPayload,
  buildBomCascadeResets,
  resolveBomColKey,
  sortBomHeaderFilters,
} from "./constants";
import "../../components/grid/EntryGrid.css";
import "./BomMasterPage.css";

let _bomTempId = -1;
const nextTempId = () => _bomTempId--;

function mapHeaderValuesToFilterValues(headerValues, allColumns) {
  if (!headerValues) return null;
  const out = {};
  allColumns.forEach(({ key, colDataType }) => {
    const raw = headerValues[key];
    const isNumeric = colDataType && /numeric|int|float|decimal/i.test(colDataType);
    const isCheckbox = colDataType && /bit|bool|checkbox/i.test(String(colDataType));
    if (isCheckbox) out[key] = raw ? 1 : 0;
    else out[key] = isNumeric ? Number(raw) || 0 : (raw ?? "");
  });
  return out;
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

export default function BomMasterForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const notify = useNotification();

  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [detailCellErrors, setDetailCellErrors] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [activeTab, setActiveTab] = useState("items");

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  const [clearRowsOpen, setClearRowsOpen] = useState(false);
  const pendingClearActionRef = useRef(null);

  const headerValuesRef = useRef({});
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [filterResetKey, setFilterResetKey] = useState(0);

  const itemGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectItemBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const editRecordLoadedRef = useRef(false);

  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();
  const { post: postSave } = useApi(API_BASE_URL_IMS);
  const { get: getLive } = useApi(API_BASE_URL);

  const {
    headerColumns, headerAllColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, bomItemOptions, fetchBomItems, clearBomItemOptions, getBomItemSelection,
    detailColumns, detailAllColumns, detailFetching, detailMetaError, eventColumns,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, clearSaveError,
  } = useBomMaster(API_BASE_URL);

  const cascadeResets = useMemo(() => buildBomCascadeResets(headerColumns), [headerColumns]);

  const buildDefaultHeaderValues = useCallback(() => {
    const session = getUserSession();
    const row = {};
    headerAllColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
    return {
      ...row,
      companyid: session.companyId,
      yearid: session.yearId,
      loginid: session.loginId,
      funccode: BOM_CONFIG.RB_MASTER,
    };
  }, [headerAllColumns]);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading record…"
        : recordLoadError
          ? recordLoadError
          : `BOM #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: BOM_CONFIG.ROUTE_PATH,
  });

  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  useEffect(() => {
    if (isEditRoute || headerAllColumns.length === 0) return;
    headerValuesRef.current = buildDefaultHeaderValues();
    setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValuesRef.current, headerAllColumns));
    setFilterResetKey((k) => k + 1);
  }, [isEditRoute, headerAllColumns, buildDefaultHeaderValues]);

  useEffect(() => {
    if (detailAllColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [detailAllColumns, fetchGridColumns, isEditRoute]);

  useEffect(() => {
    if (detailColumns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      itemGridRef.current.loadRows?.(queuedRowsRef.current);
      queuedRowsRef.current = [];
    }
  }, [detailColumns]);

  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const session = getUserSession();
      const { master, headerValues, detailRows } = await fetchEditRecord({
        companyId: session.companyId,
        yearId: session.yearId,
        loginId: session.loginId,
        sessionId: DEFAULT_SESSION_ID,
        idNumber: recordId,
      });
      if (!master || !headerValues) throw new Error("Assets BOM Master record not found.");

      editRecordLoadedRef.current = true;
      headerValuesRef.current = { ...buildDefaultHeaderValues(), ...headerValues };
      await seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValuesRef.current, headerAllColumns));
      setFilterResetKey((k) => k + 1);

      const divId = headerValues.divisionid ?? 0;
      const cols = await fetchGridColumns(divId, { existingRecordEdit: true, masterRow: master, fetchUnlockedDropdowns: false });
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;

      if (itemGridRef.current?.loadRows) itemGridRef.current.loadRows(detailRows);
      else queuedRowsRef.current = detailRows;
    } catch (err) {
      console.error("[BOM] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Assets BOM Master record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, fetchEditRecord, fetchGridColumns, buildDefaultHeaderValues, headerAllColumns, seedOptionsFromMaster]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || headerColumns.length === 0 || detailAllColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, headerColumns.length, detailAllColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !editRecordLoadedRef.current) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0, {
      existingRecordEdit: true,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, fetchGridColumns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current?.addRow) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  const ensureDetailColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && detailColumns.length > 0) return detailColumns;
    if (detailAllColumns.length === 0) return [];
    const divId = headerValuesRef.current?.divisionid ?? 0;
    const cols = await fetchGridColumns(divId);
    if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    return cols;
  }, [detailColumns, detailAllColumns, fetchGridColumns]);

  const requestGridClear = useCallback((action) => {
    const rows = itemGridRef.current?.getRows?.() ?? [];
    if (rows.length === 0) {
      action();
      return;
    }
    pendingClearActionRef.current = action;
    setClearRowsOpen(true);
  }, []);

  const syncHeaderToFilterPanel = useCallback((hv) => {
    setLoadedFilterValues(mapHeaderValuesToFilterValues(hv, headerAllColumns));
    setFilterResetKey((k) => k + 1);
  }, [headerAllColumns]);

  const focusHeaderField = useCallback((fieldColName) => {
    if (!fieldColName) return;
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        const panel = filterPanelRef.current;
        if (!panel) return;
        const selectTrigger = panel.querySelector(`#efq-${fieldColName} .search-select__trigger`);
        if (selectTrigger) {
          selectTrigger.focus();
          return;
        }
        const input = panel.querySelector(`#efq-${fieldColName}`);
        if (input) focusAndSelect(input);
      }, 0);
    });
  }, []);

  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };
    setFieldErrors((prev) => {
      if (!prev[colName]) return prev;
      const next = { ...prev };
      delete next[colName];
      return next;
    });

    const col = String(colName).toLowerCase();
    const hv = headerValuesRef.current;
    const bomItemKey = resolveBomColKey(headerColumns, "bomitemid");
    const unitKey = resolveBomColKey(headerColumns, "unit");
    const unitIdKey = resolveBomColKey(headerColumns, "unitidnumber");
    const bomNameKey = resolveBomColKey(headerColumns, "bomname");

    if (col === "divisionid") {
      requestGridClear(async () => {
        if (bomItemKey) hv[bomItemKey] = 0;
        if (unitKey) hv[unitKey] = "";
        if (unitIdKey) hv[unitIdKey] = 0;
        clearBomItemOptions();
        itemGridRef.current?.clearRows?.();
        if (Number(val) > 0) await fetchBomItems(val);
        syncHeaderToFilterPanel(hv);
        if (Number(val) > 0 && bomItemKey) {
          focusHeaderField(bomItemKey);
        }
      });
      return;
    }

    if (bomItemKey && col === String(bomItemKey).toLowerCase()) {
      const { unit, unitidnumber } = getBomItemSelection(val);
      if (unitKey) hv[unitKey] = unit;
      if (unitIdKey) hv[unitIdKey] = unitidnumber;
      syncHeaderToFilterPanel(hv);
      if (val && String(val) !== "0" && bomNameKey) {
        focusHeaderField(bomNameKey);
      }
    }
  }, [
    headerColumns,
    requestGridClear,
    clearBomItemOptions,
    fetchBomItems,
    getBomItemSelection,
    syncHeaderToFilterPanel,
    focusHeaderField,
  ]);

  const handleCellEvent = useCallback(({ rowId, colKey, rowData }) => {
    return trackCellEvent(async () => {
      const key = String(colKey).toLowerCase();
      if (key === "qty" || key === "rate") {
        const qty = Number(rowData.qty ?? rowData.Qty) || 0;
        const rate = Number(rowData.rate ?? rowData.Rate) || 0;
        const patch = { amount: qty * rate };
        if ("Amount" in rowData) patch.Amount = qty * rate;
        itemGridRef.current?.updateRow?.(rowId, patch);
      }
    });
  }, [trackCellEvent]);

  const handleSelectItem = useCallback(async () => {
    const headerValues = headerValuesRef.current;
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValues, headerColsToValidate);
    setFieldErrors(headerErrorMap);
    if (Object.keys(headerErrorMap).length > 0) {
      setFormErrors(["Please fix the highlighted field(s) below."]);
      return;
    }
    setFormErrors([]);

    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      await ensureDetailColumns();

      const rbRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: BOM_CONFIG.SP_RB_META,
        JSon: JSON.stringify([{ prmrbcode: BOM_CONFIG.RB_ITEM_PICKER }]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      const rbRow = rbRes?.[0];
      if (!rbRow) throw new Error("Could not load item picker configuration.");

      const colRes = await getLive(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbRow.rbid,
        prmLoginID: getUserSession().loginId,
      });
      setItemModalColumns(buildGridColumns(colRes || [], {}, {
        filterable: false,
        allEditable: false,
      }));

      const rowRes = await getLive(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: BOM_CONFIG.SP_ITEM_PICKER,
        JSon: JSON.stringify([buildBomItemPickerJsonPayload(headerValues)]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });
      setItemModalItems(Array.isArray(rowRes) ? rowRes : []);
    } catch (err) {
      console.error("[BOM] Item picker fetch failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [getLive, headerColumns, ensureDetailColumns]);

  const handleInsertItems = useCallback(async (selectedItems) => {
    if (!selectedItems?.length) return;
    setActiveTab("items");
    const activeCols = await ensureDetailColumns();
    if (!activeCols?.length) return;
    selectedItems.forEach((item) => addItemRow(mapPickerToItemRow(item, detailAllColumns)));
  }, [ensureDetailColumns, detailAllColumns, addItemRow]);

  const handleDeleteSelected = useCallback(() => {
    const selected = itemGridRef.current?.getSelectedRows?.() ?? [];
    if (!selected.length) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  const resetFormToInitialState = useCallback(() => {
    clearSaveError();
    headerValuesRef.current = buildDefaultHeaderValues();
    setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValuesRef.current, headerAllColumns));
    setFilterResetKey((k) => k + 1);
    clearBomItemOptions();
    itemGridRef.current?.clearRows?.();
    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;
    editRecordLoadedRef.current = false;
    setFieldErrors({});
    setDetailCellErrors(null);
    setFormErrors([]);
    setItemSelectionCount(0);
    setItemModalOpen(false);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalLoading(false);
    setItemModalError(null);
  }, [buildDefaultHeaderValues, headerAllColumns, clearBomItemOptions, clearSaveError]);

  const discardChanges = useCallback(() => {
    resetFormToInitialState();
    if (isEditRoute) {
      setIsEditMode(false);
      editRecordLoadedRef.current = false;
      loadEditRecord();
      return;
    }
    setIsEditMode(false);
  }, [resetFormToInitialState, isEditRoute, loadEditRecord]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  const completeSuccessfulSave = useCallback(() => {
    completeTransactionSave({
      isEditRoute,
      loadEditRecord,
      exitEditMode,
      editRecordLoadedRef,
      resetNewEntry: resetFormToInitialState,
    });
  }, [isEditRoute, loadEditRecord, exitEditMode, resetFormToInitialState]);

  const handleSave = useCallback(async () => {
    await flushPendingCellEvents(itemGridSectionRef);
    setFormErrors([]);
    const visibleHeaderFields = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, visibleHeaderFields);
    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const { cellErrors: detailFieldErrors } = validateGridRowsDetailed(detailRows, detailColumns, { requireAtLeastOne: true });

    setFieldErrors(headerErrorMap);
    setDetailCellErrors(detailFieldErrors);
    if (Object.keys(headerErrorMap).length > 0 || detailFieldErrors.size > 0) return;

    const mstRow = buildSaveRowFromColumns(headerValuesRef.current, headerAllColumns);
    const detRows = detailRows.map((row) =>
      buildSaveRowFromColumns(row, detailAllColumns, { funccode: BOM_CONFIG.RB_DETAIL })
    );

    const payload = withSaveContextFields(
      buildSaveJsonFields({
        label: BOM_CONFIG.FORM_TAG,
        mst: mstRow,
        extra: { [BOM_CONFIG.SAVE_DETAIL_JSON_KEY]: detRows },
      }),
      { divisionId: headerValuesRef.current?.divisionid ?? 0, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(BOM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return;
      }
      notify.success(message || "Assets BOM Master saved successfully.");
      completeSuccessfulSave();
    } catch (err) {
      console.error("[BOM Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    headerColumns, headerAllColumns, detailColumns, detailAllColumns, isEditRoute,
    postSave, notify, completeSuccessfulSave, flushPendingCellEvents,
  ]);

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

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleSelectItem();
  }, [activeTab, handleSelectItem]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);
  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    discardChanges();
  }, [discardChanges]);

  const handleClearRowsConfirm = useCallback(() => {
    setClearRowsOpen(false);
    pendingClearActionRef.current?.();
    pendingClearActionRef.current = null;
  }, []);

  const dropdownSources = useMemo(() => {
    const bomItemKey = resolveBomColKey(headerColumns, "bomitemid");
    return {
      divisionid: divisionOptions,
      [bomItemKey]: bomItemOptions,
    };
  }, [headerColumns, divisionOptions, bomItemOptions]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    const filters = headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible))
      .map((col) => {
        const lockOnEditMode = isLockOnEditModeCol(col);
        const staticOptions = dropdownSources[String(col.colname).toLowerCase()]
          ?? dropdownSources[col.colname];
        const base = {
          FilterParameterID: col.colname,
          FilterColName: col.colname,
          FilterCaption: col.displayname ?? col.colname,
          FilterColCtrlType: col.colctrltype ?? 0,
          ...(staticOptions ? { staticOptions } : {}),
        };
        return syncHeaderFilterWithApiCol(base, col, { lockOnEditMode });
      });
    return sortBomHeaderFilters(filters);
  }, [headerColumns, dropdownSources]);

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

  const filterInitialValues = useMemo(() => loadedFilterValues ?? {}, [loadedFilterValues]);
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const combinedError = headerError || detailMetaError;
  const rowReadOnly = isEditRoute && !isEditMode;

  useEntryFormKeyboard({
    blocked: itemModalOpen,
    isEditMode,
    isSaving,
    addDisabled: !headerMetaReady,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
  });

  const itemGridConfig = {
    columns: detailColumns,
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] },
  };

  const extraButtons = useMemo(() => [{
    key: "save",
    label: isSaving ? "Saving…" : "Save",
    Icon: Save,
    variant: "save",
    onClick: handleSave,
    disabled: isSaving,
    loading: isSaving,
    accessKey: "s",
    title: "Save (Alt+S)",
  }], [handleSave, isSaving]);

  return (
    <div className="workspace-page bom-page">
      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
      <ConfirmDialog
        isOpen={discardOpen}
        message="Discard changes and reset the form?"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />
      <ConfirmDialog
        isOpen={clearRowsOpen}
        type="warning"
        message="Changing Division will clear all item rows. Proceed?"
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onConfirm={handleClearRowsConfirm}
        onCancel={() => { setClearRowsOpen(false); pendingClearActionRef.current = null; }}
      />

      <section className="workspace-page__filters">
        {combinedError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{combinedError}</span>
            <button type="button" onClick={() => { fetchHeaderMeta(); fetchDetailMeta(); }}>Retry</button>
          </div>
        ) : (
          <EnterpriseFilterPanel
            key={filterResetKey}
            panelRef={filterPanelRef}
            title="Assets BOM Master Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={cascadeResets}
            onFilterChange={handleFilterChange}
            isSearching={headerFetching || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={headerFetching || !headerMetaReady}
            fieldTones={filterFieldTones}
            fieldErrors={fieldErrors}
            onLastFieldTabForward={isEditMode ? focusSelectItemButton : null}
          />
        )}
      </section>

      <section className="bom-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={BOM_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              <button
                ref={selectItemBtnRef}
                type="button"
                className="eg-tab-btn"
                onClick={handleSelectItem}
                disabled={!isEditMode || itemModalLoading}
                title="Pick items from asset list (Tab here after header fields)"
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
            </>
          }
          hideBottomPanel
          emptyMessage="No items yet. Click Select Item above."
          onSelectionChange={setItemSelectionCount}
          cellErrors={detailCellErrors}
          onCellEvent={handleCellEvent}
          eventColumns={eventColumns}
          readOnly={rowReadOnly}
          existingRecordEdit={isEditRoute && isEditMode}
          loading={detailFetching}
        />
      </section>

      <ActionBar
        alignEnd
        isEditMode={isEditMode}
        onAdd={enterEditModeWithFocus}
        onCancel={handleCancel}
        addLabel={isEditRoute ? "Edit" : "Add"}
        addAccessKey="a"
        cancelAccessKey="n"
        extraButtons={extraButtons}
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
