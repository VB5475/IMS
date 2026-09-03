// AssetPartsIndentDetailForm.jsx — Asset Parts Indent Detail entry form (Add / Edit)

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { AlertCircle, Trash2, PlusCircle, Save } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useNotification } from "../../context/NotificationContext";
import { useAstPartIndent } from "../../hooks/useAstPartIndent";
import { useApi } from "../../api/useApi";
import {
  API_BASE_URL,
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID,
  DEFAULT_SESSION_ID,
  getColDefault,
  buildSaveRowFromColumns,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import {
  isLockOnEditModeCol,
  isTruthyApiFlag,
  syncHeaderFilterWithApiCol,
  editRecordGridColumnOpts,
  syncEditGridDropdownValues,
} from "../../utils/gridUtils";
import { validateApiColumnsByField, validateGridRowsDetailed } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { queryEditableFilterFields } from "../../utils/txnFormUtils";
import { focusAndSelect } from "../../utils/focusUtils";
import { getTodayDateInputValue } from "../../utils/dateFormat";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useEntryFormKeyboard } from "../../hooks/useEntryFormKeyboard";
import { completeTransactionSave } from "../../hooks/useTransactionFormReset";
import { FORM_SHORTCUT_TITLES } from "../../constants/formShortcuts";
import {
  APID_CONFIG,
  APID_GRID_TABS,
  PAGE_TITLE,
  PAGE_TITLE_NEW,
  applyApidHardcodedHeaderValues,
  parseAssetSrScan,
  resolveApidColKey,
  buildApidCascadeResets,
} from "./constants";
import "../../components/grid/EntryGrid.css";
import "./AssetPartsIndentDetailPage.css";

let _apidTempId = -1;
const nextTempId = () => _apidTempId--;

function resolveEditLoadParams(recordId, listRecord) {
  const session = getUserSession();
  return {
    companyId: listRecord?.companyid ?? listRecord?.CompanyID ?? session.companyId ?? DEFAULT_COMPANY_ID,
    yearId: listRecord?.yearid ?? listRecord?.YearID ?? session.yearId ?? APID_CONFIG.CONFIG_YEAR_ID,
    loginId: listRecord?.loginid ?? listRecord?.LoginID ?? session.loginId,
    sessionId: listRecord?.sessionid ?? listRecord?.SessionID ?? listRecord?.SessionId ?? DEFAULT_SESSION_ID,
    idNumber:
      listRecord?.astindentmstid
      ?? listRecord?.AstIndentMstID
      ?? listRecord?.idnumber
      ?? listRecord?.IDNumber
      ?? recordId,
  };
}

function mapHeaderValuesToFilterValues(headerValues) {
  if (!headerValues) return null;
  const str = (v) => (v == null || v === "" ? "" : String(v));
  return {
    trancode: str(headerValues.trancode),
    trandate: headerValues.trandate ?? "",
    divisionid: str(headerValues.divisionid),
    astitemid: str(headerValues.astitemid),
    astsrno: headerValues.astsrno ?? "",
    asttagid: headerValues.asttagid ?? "",
    mln: headerValues.mln ?? "",
  };
}

export default function AssetPartsIndentDetailForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const isNewRoute = location.pathname.endsWith("/new") || routeId === "new";
  const recordId = isNewRoute ? 0 : Number(routeId) || 0;
  const isEditRoute = !isNewRoute && recordId > 0;
  const listRecord = location.state?.record ?? null;
  const notify = useNotification();
  const todayISO = getTodayDateInputValue();

  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [detailCellErrors, setDetailCellErrors] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [clearRowsOpen, setClearRowsOpen] = useState(false);
  const [clearRowsLabel, setClearRowsLabel] = useState("Division");
  const [activeTab, setActiveTab] = useState("items");
  const [detailRowCount, setDetailRowCount] = useState(0);

  const headerValuesRef = useRef(applyApidHardcodedHeaderValues({
    trancode: "",
    trandate: todayISO,
    divisionid: 0,
    astitemid: 0,
    astsrno: "",
    asttagid: "",
    mln: "",
    companyid: getUserSession().companyId,
    yearid: getUserSession().yearId,
    loginid: getUserSession().loginId,
    idnumber: recordId,
    funccode: APID_CONFIG.RB_MASTER,
  }));

  const [loadedMasterRow, setLoadedMasterRow] = useState(null);
  const [loadedFilterValues, setLoadedFilterValues] = useState(null);
  const [filterResetKey, setFilterResetKey] = useState(0);
  // Routine cascade updates (division / asset item / scan fields) patch the
  // mounted panel via externalValues — NOT filterResetKey. Remounting on every
  // pick re-triggers the panel's single-option auto-select and loops API calls
  // when only one division (or asset item) exists.
  const [externalValues, setExternalValues] = useState(null);

  const itemGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const filterPanelRef = useRef(null);
  const addDetailBtnRef = useRef(null);
  const gridColumnsLoadedRef = useRef(false);
  const queuedRowsRef = useRef([]);
  const editRecordLoadedRef = useRef(false);
  const editModePreparedRef = useRef(false);
  const pendingClearActionRef = useRef(null);

  const { post: postSave } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    divisionOptions, astItemOptions, fetchAstItems,
    columns, allColumns, isFetching, metaError,
    fetchDetailMeta, fetchGridColumns,
    fetchEditRecord, seedOptionsFromMaster, fetchUnlockedHeaderDropdowns,
    clearSaveError,
  } = useAstPartIndent(API_BASE_URL);

  const cascadeResets = useMemo(() => buildApidCascadeResets(headerColumns), [headerColumns]);

  const filterInitialValues = useMemo(() => {
    if (loadedFilterValues) return loadedFilterValues;
    return { trandate: todayISO };
  }, [loadedFilterValues, todayISO]);

  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) {
      setFormErrors((prev) => prev.filter((m) => m !== "Please fix the highlighted field(s) below."));
    }
  }, [fieldErrors]);

  usePageHeader({
    title: isNewRoute ? PAGE_TITLE_NEW : PAGE_TITLE,
    subtitle: isNewRoute
      ? "Fill in the header fields, then add item detail rows."
      : recordLoading
        ? "Loading record…"
        : recordLoadError
          ? recordLoadError
          : `Indent #${recordId || routeId || "—"} — click Add (Alt+A) to edit.`,
    showBack: true,
    backTo: APID_CONFIG.ROUTE_PATH,
    backLabel: "APID",
  });

  useEffect(() => {
    fetchHeaderMeta({ skipListDropdowns: isEditRoute });
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta, isEditRoute]);

  useEffect(() => {
    if (allColumns.length === 0 || gridColumnsLoadedRef.current || isEditRoute) return;
    fetchGridColumns(headerValuesRef.current?.divisionid ?? 0).then((cols) => {
      if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    });
  }, [allColumns.length, fetchGridColumns, isEditRoute]);

  useEffect(() => {
    if (columns.length > 0 && itemGridRef.current && queuedRowsRef.current.length > 0) {
      if (itemGridRef.current.loadRows) itemGridRef.current.loadRows(queuedRowsRef.current);
      else queuedRowsRef.current.forEach((r) => itemGridRef.current.addRow(r));
      queuedRowsRef.current = [];
    }
  }, [columns]);

  const pushExternalValues = useCallback((hv) => {
    setExternalValues(mapHeaderValuesToFilterValues(hv));
  }, []);

  const remountFilterPanel = useCallback((hv) => {
    setLoadedFilterValues(mapHeaderValuesToFilterValues(hv));
    setExternalValues(null);
    setFilterResetKey((k) => k + 1);
  }, []);

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

  const requestGridClear = useCallback((label, action) => {
    const rows = itemGridRef.current?.getRows?.() ?? [];
    if (rows.length === 0) {
      action();
      return;
    }
    setClearRowsLabel(label);
    pendingClearActionRef.current = action;
    setClearRowsOpen(true);
  }, []);

  const loadEditRecord = useCallback(async () => {
    setRecordLoading(true);
    setRecordLoadError(null);
    try {
      const params = resolveEditLoadParams(recordId, listRecord);
      const { master, headerValues, details } = await fetchEditRecord(params);
      if (!master || !headerValues) throw new Error("Asset Parts Indent Detail record not found.");

      headerValuesRef.current = applyApidHardcodedHeaderValues({
        ...headerValuesRef.current,
        ...headerValues,
      });
      setLoadedMasterRow(master);
      editRecordLoadedRef.current = true;

      seedOptionsFromMaster(master);
      remountFilterPanel(headerValuesRef.current);

      const divId = headerValues.divisionid ?? 0;
      const activeCols = await fetchGridColumns(divId, editRecordGridColumnOpts(master));
      if (activeCols?.length > 0) gridColumnsLoadedRef.current = true;

      const syncedDetails = syncEditGridDropdownValues(details, activeCols || []);
      setDetailRowCount(syncedDetails.length);
      if (itemGridRef.current?.loadRows) itemGridRef.current.loadRows(syncedDetails);
      else queuedRowsRef.current = syncedDetails;
    } catch (err) {
      console.error("[APID] Edit record load failed:", err);
      setRecordLoadError(err?.message || "Failed to load Asset Parts Indent Detail record.");
    } finally {
      setRecordLoading(false);
    }
  }, [recordId, listRecord, fetchEditRecord, seedOptionsFromMaster, fetchGridColumns, remountFilterPanel]);

  const resetNewEntry = useCallback(() => {
    localStorage.removeItem(APID_CONFIG.STORAGE_HEADER_META);
    localStorage.removeItem(APID_CONFIG.STORAGE_ENTRY_META);
    headerValuesRef.current = applyApidHardcodedHeaderValues({
      trancode: "",
      trandate: todayISO,
      divisionid: 0,
      astitemid: 0,
      astsrno: "",
      asttagid: "",
      mln: "",
      funccode: APID_CONFIG.RB_MASTER,
      companyid: getUserSession().companyId,
      yearid: getUserSession().yearId,
      loginid: getUserSession().loginId,
      idnumber: 0,
    });
    queuedRowsRef.current = [];
    gridColumnsLoadedRef.current = false;
    clearSaveError();
    setActiveTab("items");
    setDetailRowCount(0);
    itemGridRef.current?.clearRows?.();
    setLoadedFilterValues(null);
    setExternalValues(null);
    setFilterResetKey((k) => k + 1);
    setFormErrors([]);
    setFieldErrors({});
    setDetailCellErrors(null);
    setIsEditMode(false);
  }, [clearSaveError, todayISO]);

  const exitEditMode = useCallback(() => setIsEditMode(false), []);

  const completeSuccessfulSave = useCallback(() => {
    completeTransactionSave({
      isEditRoute,
      loadEditRecord,
      exitEditMode,
      editRecordLoadedRef,
      resetNewEntry,
    });
  }, [isEditRoute, loadEditRecord, exitEditMode, resetNewEntry]);

  useEffect(() => {
    if (!isEditRoute || editRecordLoadedRef.current || allColumns.length === 0) return;
    loadEditRecord();
  }, [isEditRoute, allColumns.length, loadEditRecord]);

  useEffect(() => {
    if (!isEditMode) {
      editModePreparedRef.current = false;
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditRoute || !isEditMode || !editRecordLoadedRef.current || editModePreparedRef.current) return;
    editModePreparedRef.current = true;
    const divisionId = headerValuesRef.current?.divisionid ?? loadedMasterRow?.divisionid ?? 0;
    fetchUnlockedHeaderDropdowns(headerValuesRef.current);
    fetchGridColumns(divisionId, {
      existingRecordEdit: true,
      masterRow: loadedMasterRow,
      fetchUnlockedDropdowns: true,
    });
  }, [isEditRoute, isEditMode, loadedMasterRow, fetchUnlockedHeaderDropdowns, fetchGridColumns]);

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
    const astItemKey = resolveApidColKey(headerColumns, "astitemid");
    const srNoKey = resolveApidColKey(headerColumns, "astsrno");
    const tagIdKey = resolveApidColKey(headerColumns, "asttagid");
    const mlnKey = resolveApidColKey(headerColumns, "mln");

    if (col === "divisionid") {
      requestGridClear("Division", async () => {
        if (astItemKey) hv[astItemKey] = 0;
        if (srNoKey) hv[srNoKey] = "";
        if (tagIdKey) hv[tagIdKey] = "";
        if (mlnKey) hv[mlnKey] = "";
        await fetchAstItems(0);
        itemGridRef.current?.clearRows?.();
        setDetailRowCount(0);
        if (Number(val) > 0) await fetchAstItems(val);
        pushExternalValues(hv);
        if (Number(val) > 0 && astItemKey) focusHeaderField(astItemKey);
      });
      return;
    }

    if (astItemKey && col === String(astItemKey).toLowerCase()) {
      pushExternalValues(hv);
      if (val && String(val) !== "0" && srNoKey) focusHeaderField(srNoKey);
      return;
    }

    if (srNoKey && col === String(srNoKey).toLowerCase()) {
      const trimmed = String(val ?? "").trim();
      if (trimmed.startsWith("{")) {
        const parsed = parseAssetSrScan(trimmed);
        if (parsed) {
          hv[srNoKey] = parsed.astsrno || trimmed;
          if (tagIdKey && parsed.asttagid) hv[tagIdKey] = parsed.asttagid;
          if (mlnKey && parsed.mln) hv[mlnKey] = parsed.mln;
          pushExternalValues(hv);
          if (mlnKey && parsed.mln) focusHeaderField(mlnKey);
          else if (tagIdKey && parsed.asttagid) focusHeaderField(tagIdKey);
        }
      }
    }
  }, [
    headerColumns,
    requestGridClear,
    fetchAstItems,
    pushExternalValues,
    focusHeaderField,
  ]);

  const handleDetailRowsChange = useCallback((rows) => {
    setDetailRowCount(rows.length);
    if (!detailCellErrors || detailCellErrors.size === 0) return;
    setDetailCellErrors(validateGridRowsDetailed(rows, columns).cellErrors);
  }, [detailCellErrors, columns]);

  const dropdownSources = useMemo(() => ({
    divisionid: divisionOptions,
    astitemid: astItemOptions,
  }), [divisionOptions, astItemOptions]);

  const dropdownOptionsByCol = useMemo(() => {
    const map = { ...dropdownSources };
    headerColumns.forEach((col) => {
      const key = col.colname;
      if (!key) return;
      const opts = dropdownSources[String(key).toLowerCase()];
      if (opts) map[key] = opts;
    });
    return map;
  }, [headerColumns, dropdownSources]);

  const syncedFilters = useMemo(() => {
    if (headerColumns.length === 0) return [];
    return headerColumns
      .filter((col) => isTruthyApiFlag(col.isvisible))
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno))
      .map((col) => {
        const lockOnEditMode = isLockOnEditModeCol(col);
        const staticOptions = dropdownOptionsByCol[col.colname];
        const base = {
          FilterParameterID: col.colname,
          FilterColName: col.colname,
          FilterCaption: col.displayname ?? col.colname,
          FilterColCtrlType: col.colctrltype ?? 0,
          ...(staticOptions ? { staticOptions } : {}),
        };
        return syncHeaderFilterWithApiCol(base, col, { lockOnEditMode });
      });
  }, [headerColumns, dropdownOptionsByCol]);

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

  const ensureDetailColumns = useCallback(async () => {
    if (gridColumnsLoadedRef.current && columns.length > 0) return columns;
    if (allColumns.length === 0) return [];
    const divId = headerValuesRef.current?.divisionid ?? 0;
    const cols = await fetchGridColumns(divId);
    if (cols?.length > 0) gridColumnsLoadedRef.current = true;
    return cols;
  }, [columns, allColumns, fetchGridColumns]);

  const handleAddDetailRow = useCallback(async () => {
    const cols = await ensureDetailColumns();
    if (!cols?.length) return;
    const row = { id: nextTempId() };
    allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
    itemGridRef.current?.addRow(row);
    setDetailRowCount((n) => n + 1);
  }, [ensureDetailColumns, allColumns]);

  const handleDeleteDetailRows = useCallback(() => {
    const selected = itemGridRef.current?.getSelectedRows?.() ?? [];
    if (selected.length === 0) return;
    itemGridRef.current.removeRows(selected.map((r) => r.id));
    setDetailRowCount((n) => Math.max(0, n - selected.length));
  }, []);

  const discardChanges = useCallback(() => {
    if (isEditRoute) {
      setIsEditMode(false);
      editRecordLoadedRef.current = false;
      loadEditRecord();
      return;
    }
    resetNewEntry();
  }, [isEditRoute, loadEditRecord, resetNewEntry]);

  const handleSave = useCallback(async () => {
    setFormErrors([]);
    const visibleHeaderFields = headerColumns.filter((c) => isTruthyApiFlag(c.isvisible));
    const headerErrorMap = validateApiColumnsByField(headerValuesRef.current, visibleHeaderFields);
    const detailRows = itemGridRef.current?.getRows?.() ?? [];
    const { cellErrors: detailFieldErrors } = validateGridRowsDetailed(detailRows, columns, { requireAtLeastOne: true });

    setFieldErrors(headerErrorMap);
    setDetailCellErrors(detailFieldErrors);
    setFormErrors(
      Object.keys(headerErrorMap).length > 0 || detailFieldErrors.size > 0
        ? ["Please fix the highlighted field(s) below."]
        : []
    );
    if (Object.keys(headerErrorMap).length > 0 || detailFieldErrors.size > 0) return;

    const hv = applyApidHardcodedHeaderValues(headerValuesRef.current);
    headerValuesRef.current = hv;
    const headerColDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype,
    }));
    const mstRow = buildSaveRowFromColumns(hv, headerColDefs, {
      loginid: getUserSession().loginId,
    });

    const detRows = detailRows.map(({ id, ...rest }) =>
      buildSaveRowFromColumns(rest, allColumns, { funccode: APID_CONFIG.RB_DETAIL })
    );

    const payload = withSaveContextFields(
      buildSaveJsonFields({
        label: APID_CONFIG.FORM_TAG,
        mst: mstRow,
        extra: { [APID_CONFIG.SAVE_DETAIL_JSON_KEY]: detRows },
      }),
      { divisionId: hv?.divisionid ?? 0, isEdit: isEditRoute }
    );

    setIsSaving(true);
    try {
      const result = await postSave(APID_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormErrors([message]);
        return;
      }
      notify.success(message || "Asset Parts Indent Detail saved successfully.");
      completeSuccessfulSave();
    } catch (err) {
      console.error("[APID Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    headerColumns, columns, allColumns, isEditRoute,
    postSave, notify, completeSuccessfulSave,
  ]);

  const focusFirstEditableFilterField = useCallback(() => {
    const fields = queryEditableFilterFields(filterPanelRef.current);
    if (fields.length === 0) return false;
    fields[0].focus();
    return true;
  }, []);

  const focusAddDetailRowButton = useCallback(() => {
    setActiveTab("items");
    addDetailBtnRef.current?.focus();
  }, []);

  const enterEditModeWithFocus = useCallback(() => {
    setIsEditMode(true);
    setActiveTab("items");
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!focusFirstEditableFilterField()) focusAddDetailRowButton();
      }, 80);
    });
  }, [focusFirstEditableFilterField, focusAddDetailRowButton]);

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

  const handleClearRowsCancel = useCallback(() => {
    setClearRowsOpen(false);
    pendingClearActionRef.current = null;
  }, []);

  const handleSelectListShortcut = useCallback(() => {
    if (activeTab === "items") handleAddDetailRow();
  }, [activeTab, handleAddDetailRow]);

  const headerMetaReady = headerColumns.length > 0 && !headerFetching;
  const filterBusy = headerFetching || isFetching;
  const combinedError = metaError || headerError;
  const rowReadOnly = isEditRoute && !isEditMode;

  useEntryFormKeyboard({
    blocked: false,
    isEditMode,
    isSaving,
    addDisabled: !headerMetaReady,
    onAdd: enterEditModeWithFocus,
    onSave: handleSave,
    onCancel: handleCancel,
    onSelectList: handleSelectListShortcut,
  });

  const itemGridConfig = {
    columns,
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
    title: FORM_SHORTCUT_TITLES.save,
  }], [handleSave, isSaving]);

  return (
    <div className="workspace-page workspace-page--fill apid-page">
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
        message={`Changing ${clearRowsLabel} will clear all item detail rows. Proceed?`}
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
            title="Asset Parts Indent Detail"
            staticFilters={syncedFilters}
            initialValues={filterInitialValues}
            externalValues={externalValues}
            cascadeResets={cascadeResets}
            onFilterChange={handleFilterChange}
            isSearching={filterBusy || recordLoading}
            isMetaLoading={!headerMetaReady || recordLoading}
            disabled={filterBusy || !headerMetaReady}
            fieldTones={filterFieldTones}
            fieldErrors={fieldErrors}
            onLastFieldTabForward={isEditMode ? focusAddDetailRowButton : null}
          />
        )}
      </section>

      <section className="apid-grid-section" ref={itemGridSectionRef}>
        <EntryGrid
          ref={itemGridRef}
          config={itemGridConfig}
          tabs={APID_GRID_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          headerControls={
            <>
              <button
                ref={addDetailBtnRef}
                type="button"
                className="eg-tab-btn"
                onClick={handleAddDetailRow}
                disabled={!isEditMode || isFetching}
                title={FORM_SHORTCUT_TITLES.selectList}
              >
                <PlusCircle size={12} strokeWidth={2.5} />
                Add Row
              </button>
              <button
                type="button"
                className="eg-tab-btn eg-tab-btn--danger"
                onClick={handleDeleteDetailRows}
                disabled={!isEditMode}
                title="Delete selected rows"
              >
                <Trash2 size={12} strokeWidth={2} />
                Delete
              </button>
            </>
          }
          title=""
          hideBottomPanel
          readOnly={rowReadOnly}
          existingRecordEdit={isEditRoute && isEditMode}
          emptyMessage="No item detail rows yet. Click Add Row above."
          cellErrors={detailCellErrors}
          onRowsChange={handleDetailRowsChange}
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
    </div>
  );
}
