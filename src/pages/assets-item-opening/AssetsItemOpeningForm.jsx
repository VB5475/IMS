// AssetsItemOpeningForm.jsx — Assets Item Opening entry form (Add / Edit)
//
// Pattern mirrors AssetsDepreciationForm.jsx:
//   1. fetchHeaderMeta  → RB_AstItemOpeMst → GET_DETAIL_COL_DATA (header metadata — dynamic)
//   2. fetchDetailMeta  → RB_AstItemOpeDet → GET_DETAIL_COL_DATA (grid metadata — dynamic)
//   3. fetchGridColumns → GET_FILTER_DETAIL dropdowns + buildGridColumns (lazy, on first Add New)
//
// AOP vs DPC differences:
//   2-level cascade: DivisionID → ItemGroupID → ItemID (3 header dropdowns depend on parent)
//   AccountID cascades from DivisionID (Fixed Asset A/C)
//   Summary: 2 fields — PurchaseTotalAmt + CurrentTotalAmt  (⚠️ DBA CONFIRM column keys)
//   No item picker SP in MRD — grid rows added manually via "Add New Row"

import React, { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, Package2, Printer, Save, PlusCircle } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EnterpriseSummaryPanel from "../../components/filters/EnterpriseSummaryPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import { useAssetsItemOpening } from "../../hooks/useAssetsItemOpening";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  getColDefault,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import {
  isLockOnEditModeCol,
  isTruthyApiFlag,
  syncHeaderFilterWithApiCol,
} from "../../utils/gridUtils";
import { validateApiColumns, validateGridRows } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import { queryEditableFilterFields, resolveEditLoadParams } from "../../utils/txnFormUtils";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { useTransactionFormReset } from "../../hooks/useTransactionFormReset";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  AOP_CONFIG,
  AOP_MULTI_PASTE_COLUMNS,
  AOP_REMARK_COLUMNS,
  AOP_SUMMARY_FIELDS,
  AOP_GRID_TABS,
  AOP_FILTER_CASCADE_RESETS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
} from "./constants";
import "./AssetsItemOpeningPage.css";

let _aopTempId = -1;
const nextTempId = () => _aopTempId--;

// Summary panel fields — exclude from header filter (already shown in footer EnterpriseSummaryPanel)
const AOP_SUMMARY_COL_NAMES = new Set(AOP_SUMMARY_FIELDS.map((f) => f.SummaryParameterID.toLowerCase()));

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  return {
    trancode:    headerValues.trancode    ?? "",
    divisionid:  String(headerValues.divisionid  ?? ""),
    itemgroupid: String(headerValues.itemgroupid ?? ""),
    itemid:      String(headerValues.itemid      ?? ""),
    accountid:   String(headerValues.accountid   ?? ""),
    remark:      headerValues.remark     ?? "",
    funccode:    headerValues.funccode   ?? "",
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AssetsItemOpeningForm() {
  const { id: routeId } = useParams();
  const location    = useLocation();
  const isNewRoute  = location.pathname.endsWith("/new") || routeId === "new";
  const recordId    = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord  = location.state?.record ?? null;
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const navigate    = useNavigate();

  const itemGridRef          = useRef(null);
  const summaryRef           = useRef(null);
  const filterPanelRef       = useRef(null);
  const addRowBtnRef         = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef        = useRef([]);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, itemGroupOptions, itemOptions, assetsAccOptions,
    fetchItemGroups, clearItemGroupOptions,
    fetchItems,      clearItemOptions,
    fetchAssetsAccByDivision, clearAssetsAccOptions,
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useAssetsItemOpening(API_BASE_URL);

  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const [loadedMasterRow,    setLoadedMasterRow]    = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [recordLoading,      setRecordLoading]      = useState(false);
  const [recordLoadError,    setRecordLoadError]    = useState(null);
  const editRecordLoadedRef = useRef(false);

  const headerValuesRef = useRef({
    trancode:    "",
    divisionid:  0,
    itemgroupid: 0,
    itemid:      0,
    accountid:   0,
    remark:      "",
    funccode:    AOP_CONFIG.RB_MASTER,
    tranmstgenid: 0,
    companyid:   getUserSession().companyId,
    yearid:      getUserSession().yearId,
    loginid:     getUserSession().loginId,
    idnumber:    recordId,
  });

  const filterInitialValues = useMemo(() => loadedFilterValues ?? {}, [loadedFilterValues]);

  const [filterResetKey,     setFilterResetKey]     = useState(0);
  const [activeTab,          setActiveTab]          = useState("items");
  const [itemSelectionCount, setItemSelectionCount] = useState(0);
  const [isGridLoading,      setIsGridLoading]      = useState(false);
  const [gridRows,           setGridRows]           = useState([]);
  const [isSaving,           setIsSaving]           = useState(false);
  const [isEditMode,         setIsEditMode]         = useState(false);

  const [discardOpen,    setDiscardOpen]    = useState(false);
  const [clearRowsOpen,  setClearRowsOpen]  = useState(false);
  const [clearRowsLabel, setClearRowsLabel] = useState("");
  const pendingClearActionRef = useRef(null);

  const focusFirstEditableFilterField = useCallback(() => {
    const fields = queryEditableFilterFields(filterPanelRef.current);
    if (fields.length === 0) return false;
    fields[0].focus();
    return true;
  }, []);

  const focusAddRowButton = useCallback(() => {
    setActiveTab("items");
    addRowBtnRef.current?.focus();
  }, []);

  const enterEditModeWithFocus = useCallback(async () => {
    setIsEditMode(true);
    setActiveTab("items");
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!focusFirstEditableFilterField()) focusAddRowButton();
      }, 80);
    });
  }, [focusFirstEditableFilterField, focusAddRowButton]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  usePageHeader({
    title:    isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then add items via the grid."
      : recordLoading
        ? "Loading record…"
        : recordLoadError
          ? recordLoadError
          : `Entry #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo:   "/assets-item-opening",
  });

  // ── Mount: load metadata ───────────────────────────────────────────────────
  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  // Eager grid column load for new records
  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns, fetchGridColumns, isEditRoute]);

  // Flush queued rows once grid columns are built
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

  // ── Edit flow ─────────────────────────────────────────────────────────────
  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord, {
        idFields: ["aopid"],
      });
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Assets Item Opening record not found.");

      headerValuesRef.current = { ...headerValuesRef.current, ...headerValues };
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      setLoadedFilterValues(mapHeaderValuesToFilterValues(headerValues));
      setFilterResetKey((k) => k + 1);

      const activeCols = await fetchGridColumns(headerValues.divisionid ?? 0, {
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
      console.error("[AOP] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Assets Item Opening record.");
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
    const hv = headerValuesRef.current;
    fetchUnlockedHeaderDropdowns(
      hv.divisionid  ?? loadedMasterRow?.divisionid  ?? 0,
      hv.itemgroupid ?? loadedMasterRow?.itemgroupid ?? 0,
    );
    fetchGridColumns(hv.divisionid ?? 0, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

  const addItemRow = useCallback((row) => {
    if (itemGridRef.current) itemGridRef.current.addRow(row);
    else queuedRowsRef.current.push(row);
  }, []);

  // ── Multi-value paste — Sr. No replication ──────────────────────
  const handleMultiValuePaste = useCallback((sourceRow, colKey, values) => {
    itemGridRef.current?.updateRow?.(sourceRow.id, { [colKey]: values[0] });
    values.slice(1).forEach((val) => {
      addItemRow({ ...sourceRow, id: nextTempId(), [colKey]: val });
    });
  }, [addItemRow]);

  // ── syncedSummaryFields ───────────────────────────────────────────────────
  const syncedSummaryFields = useMemo(() => {
    const colMap = {};
    headerColumns.forEach((col) => { colMap[col.colname] = col; });
    return AOP_SUMMARY_FIELDS.map((f) => ({
      ...f,
      mstKey: f.SummaryParameterID,
      label:  f.label ?? colMap[f.SummaryParameterID]?.displayname ?? f.SummaryParameterID,
    }));
  }, [headerColumns]);

  // ── syncedFilters (fully dynamic from API) ────────────────────────────────
  const DROPDOWN_OPTIONS_BY_COL = useMemo(() => ({
    divisionid:  divisionOptions,
    itemgroupid: itemGroupOptions,
    itemid:      itemOptions,
    accountid:   assetsAccOptions,
  }), [divisionOptions, itemGroupOptions, itemOptions, assetsAccOptions]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible) && !AOP_SUMMARY_COL_NAMES.has(col.colname))
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

  const filterFieldTones = useMemo(() => {
    const tones = {};
    syncedFilters.forEach((f) => {
      let tone = "editable";
      if (!isEditMode)                          tone = "view";
      else if (isEditRoute && f.lockOnEditMode) tone = "frozen";
      tones[f.FilterColName]       = tone;
      if (f.FilterParameterID) tones[f.FilterParameterID] = tone;
    });
    return tones;
  }, [syncedFilters, isEditMode, isEditRoute]);

  // ── Cascade ───────────────────────────────────────────────────────────────
  const requestGridClear = useCallback((fieldLabel, action) => {
    const rows = itemGridRef.current?.getRows?.() ?? [];
    if (rows.length === 0) { action(); return; }
    pendingClearActionRef.current = action;
    setClearRowsLabel(fieldLabel);
    setClearRowsOpen(true);
  }, []);

  const handleFilterChange = useCallback(async (colName, val) => {
    headerValuesRef.current = { ...headerValuesRef.current, [colName]: val };

    if (colName === "divisionid") {
      requestGridClear("Division", async () => {
        headerValuesRef.current.itemgroupid = 0;
        headerValuesRef.current.itemid      = 0;
        headerValuesRef.current.accountid   = 0;
        clearItemGroupOptions();
        clearItemOptions();
        clearAssetsAccOptions();
        itemGridRef.current?.clearRows?.();
        if (val && val !== "0") {
          await Promise.all([
            fetchItemGroups(val),
            fetchAssetsAccByDivision(val),
          ]);
          focusFieldAfterCascade(filterPanelRef, "itemgroupid");
        }
      });
      return;
    }

    if (colName === "itemgroupid") {
      requestGridClear("Item Group", async () => {
        headerValuesRef.current.itemid = 0;
        clearItemOptions();
        itemGridRef.current?.clearRows?.();
        const divId = headerValuesRef.current.divisionid;
        if (val && val !== "0" && divId && divId !== "0") {
          await fetchItems(divId, val);
          focusFieldAfterCascade(filterPanelRef, "itemid");
        }
      });
      return;
    }
  }, [
    requestGridClear,
    clearItemGroupOptions, clearItemOptions, clearAssetsAccOptions,
    fetchItemGroups, fetchItems, fetchAssetsAccByDivision,
  ]);

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

  // ── Add New Row ───────────────────────────────────────────────────────────
  const handleAddNewRow = useCallback(async () => {
    const activeCols = await ensureItemColumns();
    if (!activeCols?.length) return;
    const row = { id: nextTempId() };
    allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
    addItemRow(row);
  }, [ensureItemColumns, allColumns, addItemRow]);

  // ── Delete selected rows ──────────────────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    if (!itemGridRef.current) return;
    const selected = itemGridRef.current.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows?.(selected.map((r) => r.id));
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const buildDefaultHeaderValues = useCallback(() => ({
    trancode: "", divisionid: 0, itemgroupid: 0, itemid: 0, accountid: 0, remark: "",
    funccode: AOP_CONFIG.RB_MASTER, tranmstgenid: 0,
    companyid: getUserSession().companyId, yearid: getUserSession().yearId,
    loginid: getUserSession().loginId, idnumber: 0,
  }), []);

  const { resetFormToInitialState, discardChanges } = useTransactionFormReset({
    storageKeys: [AOP_CONFIG.STORAGE_HEADER_META, AOP_CONFIG.STORAGE_ENTRY_META],
    buildDefaultHeaderValues,
    headerValuesRef,
    queuedRowsRef,
    gridColumnsLoadedRef,
    itemGridRef,
    editRecordLoadedRef,
    isEditRoute,
    loadEditRecord,
    exitEditMode,
    clearSaveError,
    setActiveTab,
    setIsGridLoading,
    setItemSelectionCount,
    setFilterResetKey,
    setLoadedFilterValues,
    setGridRows,
    extraClearFns: [clearItemGroupOptions, clearItemOptions, clearAssetsAccOptions],
  });

  const completeSuccessfulSave = useCallback(() => {
    if (isEditRoute) navigate("/assets-item-opening");
    else resetFormToInitialState();
  }, [isEditRoute, navigate, resetFormToInitialState]);

  const handleSave = useCallback(async ({ skipPostSave = false } = {}) => {
    const headerColsToValidate = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrors  = validateApiColumns(headerValuesRef.current, headerColsToValidate);
    const detailRows    = itemGridRef.current?.getRows?.() ?? [];
    const detailErrors  = validateGridRows(detailRows, columns);

    const allErrors = [...headerErrors, ...detailErrors];
    if (allErrors.length > 0) { setFormErrors(allErrors); return false; }

    const mstRow = {};
    headerColumns.forEach((col) => { mstRow[col.colname] = getColDefault(col.coldatatype); });
    const hv = headerValuesRef.current;
    Object.entries(hv).forEach(([k, v]) => { if (k !== "id") mstRow[k] = v; });
    Object.assign(mstRow, summaryRef.current?.getSummary?.() ?? {});
    mstRow.loginid = getUserSession().loginId;

    const detRows = (itemGridRef.current?.getRows?.() ?? []).map(({ id, ...rest }) => {
      const row = {};
      allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
      return { ...row, ...rest, loginid: getUserSession().loginId };
    });

    const payload = await withSaveContextFields(
      buildSaveJsonFields({ label: AOP_CONFIG.FORM_TAG, mst: mstRow, det: detRows }),
      { divisionId: hv.divisionid, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(AOP_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      if (!skipPostSave) completeSuccessfulSave();
      return true;
    } catch (err) {
      console.error("[AOP Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [headerColumns, allColumns, columns, isEditRoute, completeSuccessfulSave, postSave]);

  const handleSaveAndPrint = useCallback(async () => {
    const saved = await handleSave({ skipPostSave: true });
    if (!saved) return;
    window.print();
    completeSuccessfulSave();
  }, [handleSave, completeSuccessfulSave]);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    discardChanges();
  }, [discardChanges]);

  const handleCancel = useCallback(() => setDiscardOpen(true), []);

  const handleClearRowsConfirm = useCallback(() => {
    setClearRowsOpen(false);
    const fn = pendingClearActionRef.current;
    pendingClearActionRef.current = null;
    fn?.();
  }, []);

  const handleClearRowsCancel = useCallback(() => {
    setClearRowsOpen(false);
    pendingClearActionRef.current = null;
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy      = headerFetching;

  useEntryFormKeyboard({
    blocked:      false,
    isEditMode,
    isSaving,
    addDisabled:  filterBusy,
    onAdd:        enterEditModeWithFocus,
    onSave:       handleSave,
    onSavePrint:  handleSaveAndPrint,
    onCancel:     handleCancel,
    onSelectList: handleAddNewRow,
  });

  const extraButtons = useMemo(() => [
    {
      key: "saveprint", label: "Save & Print", Icon: Printer, variant: "print",
      onClick: handleSaveAndPrint, disabled: isSaving,
      title: FORM_SHORTCUT_TITLES.savePrint,
    },
    {
      key: "save", label: isSaving ? "Saving…" : "Save", Icon: Save, variant: "save",
      onClick: handleSave, disabled: isSaving, loading: isSaving,
      accessKey: "s", title: FORM_SHORTCUT_TITLES.save,
    },
  ], [handleSaveAndPrint, handleSave, isSaving]);

  const itemGridConfig = { columns, pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25, 50] } };
  const combinedError  = metaError || headerError;

  return (
    <div className="workspace-page workspace-page--fill aop-page">
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
        message={`Changing ${clearRowsLabel} will clear all item rows. Proceed?`}
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onConfirm={handleClearRowsConfirm}
        onCancel={handleClearRowsCancel}
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
            title="Asset Item Opening Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            cascadeResets={AOP_FILTER_CASCADE_RESETS}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            onLastFieldTabForward={isEditMode ? focusAddRowButton : null}
          />
        )}
      </section>

      {/* ── Item grid section ─────────────────────────────────────────────── */}
      <section className="aop-grid-section">
        <div className="grid-tabbar">
          <div className="grid-tabbar__tabs">
            {AOP_GRID_TABS.map((t) => (
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
              ref={addRowBtnRef}
              type="button"
              className="eg-tab-btn"
              onClick={handleAddNewRow}
              disabled={!isEditMode || isGridLoading}
              title="Add a new item row"
            >
              <PlusCircle size={12} strokeWidth={2.5} />
              Add New
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

        <div className={`aop-tab-pane${activeTab === "items" ? " aop-tab-pane--active" : ""}`}>
          <EntryGrid
            ref={itemGridRef}
            config={itemGridConfig}
            title=""
            hideBottomPanel
            emptyMessage="No items yet. Click Add New above."
            onSelectionChange={setItemSelectionCount}
            onRowsChange={setGridRows}
            readOnly={isEditRoute && !isEditMode}
            existingRecordEdit={isEditRoute && isEditMode}
            multiValuePasteColumns={AOP_MULTI_PASTE_COLUMNS}
            onMultiValuePaste={handleMultiValuePaste}
            remarkModalColumns={AOP_REMARK_COLUMNS}
          />
        </div>
      </section>

      <EnterpriseSummaryPanel
        ref={summaryRef}
        fields={syncedSummaryFields}
        rows={gridRows}
      />

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
    </div>
  );
}
