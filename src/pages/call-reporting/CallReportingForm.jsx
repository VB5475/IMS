import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { ClipboardList, Save, AlertCircle, Package, Trash2 } from "lucide-react";
import Modal from "../../components/ui/Modal";
import MasterFormField from "../../components/forms/MasterFormField";
import EntryGrid from "../../components/grid/EntryGrid";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID,
  DEFAULT_LOGIN_ID,
  DEFAULT_SESSION_ID,
  getColDefault,
} from "../../api/constants";
import { useApi } from "../../api/useApi";
import { useNotification } from "../../context/NotificationContext";
import { withSaveContextFields } from "../../utils/savePayload";
import {
  buildMasterCascadeResets,
  buildMasterFormEmpty,
  finalizeMasterHeaderSaveRow,
  getMasterFieldDefaultValue,
  getMasterFieldLabel,
  getVisibleHeaderFields,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterFieldRequired,
  isMasterToggleField,
  validateMasterFormFields,
} from "../../utils/masterFormUtils";
import {
  useMntCallReporting,
  resolveDashboardRowId,
} from "../../hooks/useMntCallReporting";
import { usePendingCellEventFlush } from "../../hooks/usePendingCellEventFlush";
import {
  MNT_REPORTING_CONFIG,
  MNT_REPORTING_GRID_TABS,
  MODAL_TITLE,
  MODAL_SUBTITLE,
  isReportingGridsReadonly,
  buildCallReportingPickerPayload,
} from "./constants";
import "../account-group-master/AccountGroupMasterPage.css";
import "./CallReportingPage.css";

const OrderItemModal = lazy(() => import("../../components/txn/OrderItemModal"));

let _clrptTempId = -1;
const nextTempId = () => _clrptTempId--;

function buildSaveContext() {
  return {
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: MNT_REPORTING_CONFIG.CONFIG_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    SessionID: DEFAULT_SESSION_ID,
    FuncCode: MNT_REPORTING_CONFIG.RB_MASTER,
  };
}

function mapPickerToItemRow(item, allColumns) {
  const row = { id: nextTempId() };
  allColumns.forEach(({ key, colDataType }) => {
    row[key] = getColDefault(colDataType);
  });
  Object.entries(item || {}).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (lk !== "id" && v != null && Object.prototype.hasOwnProperty.call(row, lk)) {
      row[lk] = v;
    }
  });
  return row;
}

function stripGridRowForSave(row) {
  if (!row || typeof row !== "object") return row;
  const { id, ...rest } = row;
  return rest;
}

/**
 * Call Reporting popup — RB rb_mnt_clrpt + dual part grids (MRD).
 * Opened from Maintenance Dashboard only (no list / add-edit routes).
 */
export default function CallReportingForm({
  isOpen = false,
  onClose,
  onSaved,
  dashboardRow = null,
  filterContext = {},
}) {
  const notify = useNotification();
  const { post } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    newPartsColumns,
    oldPartsColumns,
    newPartsAllColumns,
    oldPartsAllColumns,
    gridsFetching,
    fetchHeaderMeta,
    fetchDetailGridMetas,
    fetchPopupRecord,
    fetchItemPicker,
    seedOptionsFromMaster,
    resetMeta,
  } = useMntCallReporting();

  const newPartsGridRef = useRef(null);
  const oldPartsGridRef = useRef(null);
  const itemGridSectionRef = useRef(null);
  const queuedNewPartsRef = useRef([]);
  const queuedOldPartsRef = useRef([]);
  const { trackCellEvent, flushPendingCellEvents } = usePendingCellEventFlush();

  const [formValues, setFormValues] = useState(() =>
    buildMasterFormEmpty([], buildSaveContext())
  );
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [activeTab, setActiveTab] = useState("new-parts");
  const [gridsReadonly, setGridsReadonly] = useState(true);
  const [newPartsSelectionCount, setNewPartsSelectionCount] = useState(0);
  const [oldPartsSelectionCount, setOldPartsSelectionCount] = useState(0);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalTarget, setItemModalTarget] = useState("new-parts");
  const [itemModalItems, setItemModalItems] = useState([]);
  const [itemModalColumns, setItemModalColumns] = useState([]);
  const [itemModalLoading, setItemModalLoading] = useState(false);
  const [itemModalError, setItemModalError] = useState(null);

  const visibleFields = useMemo(() => getVisibleHeaderFields(headerColumns), [headerColumns]);
  const cascadeResets = useMemo(() => buildMasterCascadeResets(headerColumns), [headerColumns]);

  const newPartsGridConfig = useMemo(
    () => ({
      columns: newPartsColumns,
      pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25] },
    }),
    [newPartsColumns]
  );

  const oldPartsGridConfig = useMemo(
    () => ({
      columns: oldPartsColumns,
      pagination: { pageSize: 10, pageSizeOptions: [5, 10, 25] },
    }),
    [oldPartsColumns]
  );

  const flushQueuedRows = useCallback((gridRef, queuedRef) => {
    if (!gridRef.current || !queuedRef.current.length) return;
    if (typeof gridRef.current.loadRows === "function") {
      gridRef.current.loadRows(queuedRef.current);
    } else {
      queuedRef.current.forEach((r) => gridRef.current.addRow?.(r));
    }
    queuedRef.current = [];
  }, []);

  useEffect(() => {
    flushQueuedRows(newPartsGridRef, queuedNewPartsRef);
  }, [newPartsColumns, flushQueuedRows]);

  useEffect(() => {
    flushQueuedRows(oldPartsGridRef, queuedOldPartsRef);
  }, [oldPartsColumns, flushQueuedRows]);

  const clearBothGrids = useCallback(() => {
    queuedNewPartsRef.current = [];
    queuedOldPartsRef.current = [];
    newPartsGridRef.current?.clearRows?.();
    oldPartsGridRef.current?.clearRows?.();
    setNewPartsSelectionCount(0);
    setOldPartsSelectionCount(0);
  }, []);

  // On each open: RB controls → detail grid metas → fill master + both grids.
  useEffect(() => {
    if (!isOpen) {
      resetMeta();
      setFormValues(buildMasterFormEmpty([], buildSaveContext()));
      setRecordLoadError(null);
      setSaveError(null);
      setRecordLoading(false);
      setActiveTab("new-parts");
      setGridsReadonly(true);
      clearBothGrids();
      return undefined;
    }

    if (!dashboardRow) {
      setRecordLoadError("No maintenance call was selected for Call Reporting.");
      return undefined;
    }

    let cancelled = false;
    const divisionId = filterContext?.divisionid;
    const locationId = filterContext?.locationid;
    const deptId = filterContext?.deptid;

    (async () => {
      setRecordLoading(true);
      setRecordLoadError(null);
      setSaveError(null);

      try {
        const fieldDefs = await fetchHeaderMeta();
        if (cancelled) return;

        await fetchDetailGridMetas(divisionId);
        if (cancelled) return;

        const {
          master,
          headerValues,
          newParts,
          oldParts,
        } = await fetchPopupRecord({
          dashboardRow,
          filterContext: {
            divisionid: divisionId,
            locationid: locationId,
            deptid: deptId,
          },
          fieldDefs,
        });
        if (cancelled) return;

        if (!master || !headerValues) {
          setRecordLoadError("Call reporting data could not be loaded for the selected record.");
          setFormValues(buildMasterFormEmpty(fieldDefs, buildSaveContext()));
          return;
        }

        seedOptionsFromMaster(master, fieldDefs);
        setFormValues({
          ...buildMasterFormEmpty(fieldDefs, buildSaveContext()),
          ...headerValues,
        });
        setGridsReadonly(
          isReportingGridsReadonly(headerValues[MNT_REPORTING_CONFIG.REPORTING_STATUS_COL])
        );

        queuedNewPartsRef.current = newParts || [];
        queuedOldPartsRef.current = oldParts || [];
        flushQueuedRows(newPartsGridRef, queuedNewPartsRef);
        flushQueuedRows(oldPartsGridRef, queuedOldPartsRef);
      } catch (err) {
        if (cancelled) return;
        setRecordLoadError(err?.message || "Failed to load Call Reporting form.");
      } finally {
        if (!cancelled) setRecordLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    dashboardRow,
    filterContext?.divisionid,
    filterContext?.locationid,
    filterContext?.deptid,
  ]);

  const handleChange = useCallback(
    (key, value) => {
      setFormValues((prev) => {
        const next = { ...prev, [key]: value };
        const resetKeys = cascadeResets[key];
        if (resetKeys?.length) {
          resetKeys.forEach((resetKey) => {
            const field = headerColumns.find((f) => f.ColName === resetKey);
            next[resetKey] = field ? getMasterFieldDefaultValue(field) : "";
          });
        }
        return next;
      });

      if (String(key).toLowerCase() === MNT_REPORTING_CONFIG.REPORTING_STATUS_COL) {
        // MRD §3 — clear both grids; status 1 readonly, 2/3 editable.
        clearBothGrids();
        setGridsReadonly(isReportingGridsReadonly(value));
      }
    },
    [cascadeResets, headerColumns, clearBothGrids]
  );

  function renderControl(field) {
    const key = field.ColName;
    const mrdEditable = MNT_REPORTING_CONFIG.EDITABLE_FIELDS.has(String(key || "").toLowerCase());
    const locked =
      !mrdEditable
      || isMasterFieldLocked(field, { isAddMode: true, isEditMode: true });
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={locked}
        options={dropdownOptions[key] || []}
        inputClassName="mntcr-form-input"
        textareaClassName="mntcr-form-textarea"
        valueClassName="mntcr-form-value"
      />
    );
  }

  const handleCellEvent = useCallback(({ rowId, colKey, rowData, gridRef }) => {
    return trackCellEvent(async () => {
      const key = String(colKey).toLowerCase();
      if (key !== "qty" && key !== "rate") return;
      const qty = Number(rowData.qty ?? rowData.Qty) || 0;
      const rate = Number(rowData.rate ?? rowData.Rate) || 0;
      const amount = qty * rate;
      const patch = { amount };
      if ("Amount" in (rowData || {})) patch.Amount = amount;
      gridRef?.current?.updateRow?.(rowId, patch);
    });
  }, [trackCellEvent]);

  const handleSelectItem = useCallback(async () => {
    if (gridsReadonly) return;

    const target = activeTab;
    setItemModalTarget(target);
    setItemModalOpen(true);
    setItemModalItems([]);
    setItemModalColumns([]);
    setItemModalError(null);
    setItemModalLoading(true);

    try {
      const isNew = target === "new-parts";
      const { columns, items } = await fetchItemPicker({
        pickerRb: isNew
          ? MNT_REPORTING_CONFIG.RB_NEW_PARTS_PICKER
          : MNT_REPORTING_CONFIG.RB_OLD_PARTS_PICKER,
        pickerSp: isNew
          ? MNT_REPORTING_CONFIG.SP_NEW_PARTS_PICKER
          : MNT_REPORTING_CONFIG.SP_OLD_PARTS_PICKER,
        payload: buildCallReportingPickerPayload(formValues, filterContext),
      });
      setItemModalColumns(columns);
      setItemModalItems(items);
    } catch (err) {
      console.error("[MNT Call Reporting] Item picker failed:", err);
      setItemModalError(err?.message || "Failed to fetch items.");
    } finally {
      setItemModalLoading(false);
    }
  }, [activeTab, gridsReadonly, fetchItemPicker, formValues, filterContext]);

  const handleInsertItems = useCallback(
    (selectedItems) => {
      if (!selectedItems?.length) return;
      const isNew = itemModalTarget === "new-parts";
      const allCols = isNew ? newPartsAllColumns : oldPartsAllColumns;
      const gridRef = isNew ? newPartsGridRef : oldPartsGridRef;
      const queuedRef = isNew ? queuedNewPartsRef : queuedOldPartsRef;

      selectedItems.forEach((item) => {
        const row = mapPickerToItemRow(item, allCols);
        if (gridRef.current?.addRow) gridRef.current.addRow(row);
        else queuedRef.current.push(row);
      });
      setActiveTab(itemModalTarget);
    },
    [itemModalTarget, newPartsAllColumns, oldPartsAllColumns]
  );

  const handleDeleteSelected = useCallback(() => {
    if (gridsReadonly) return;
    const isNew = activeTab === "new-parts";
    const gridRef = isNew ? newPartsGridRef : oldPartsGridRef;
    const selected = gridRef.current?.getSelectedRows?.() ?? [];
    if (!selected.length) return;
    gridRef.current.removeRows?.(selected.map((r) => r.id));
    if (isNew) setNewPartsSelectionCount(0);
    else setOldPartsSelectionCount(0);
  }, [activeTab, gridsReadonly]);

  const handleSave = useCallback(async () => {
    await flushPendingCellEvents(itemGridSectionRef);

    const validationErrors = validateMasterFormFields(visibleFields, formValues, {
      skipMandatoryFor: new Set(
        visibleFields
          .filter((f) => isMasterToggleField(f) || isMasterCheckboxField(f))
          .map((f) => f.ColName)
      ),
    });
    void validationErrors;

    setSaveError(null);
    setIsSaving(true);
    try {
      const dashboardRowId = resolveDashboardRowId(dashboardRow);
      const saveRow = {
        ...finalizeMasterHeaderSaveRow(headerColumns, formValues, {
          fieldsToFinalize: visibleFields,
        }),
        IDNumber: dashboardRowId,
        idnumber: dashboardRowId,
      };

      const newParts = (newPartsGridRef.current?.getRows?.() ?? []).map(stripGridRowForSave);
      const oldParts = (oldPartsGridRef.current?.getRows?.() ?? []).map(stripGridRowForSave);

      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrNewPartsDetail: JSON.stringify(newParts),
          prmStrOldPartsDetail: JSON.stringify(oldParts),
        },
        {
          divisionId: Number(filterContext?.divisionid) || 0,
          isEdit: false,
        }
      );

      await post(MNT_REPORTING_CONFIG.SAVE_ENDPOINT, payload);
      notify.success("Call reporting saved successfully.");
      onSaved?.();
    } catch (err) {
      console.error("[MNT Call Reporting Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    visibleFields,
    formValues,
    headerColumns,
    filterContext,
    dashboardRow,
    notify,
    onSaved,
    post,
    flushPendingCellEvents,
  ]);

  const handleClose = useCallback(() => {
    if (!window.confirm("Discard changes?")) return;
    onClose?.();
  }, [onClose]);

  const selectionCount =
    activeTab === "new-parts" ? newPartsSelectionCount : oldPartsSelectionCount;

  const footer = useMemo(
    () => (
      <div className="master-modal-footer-actions">
        <button
          type="button"
          className="master-modal-btn master-modal-btn--save"
          onClick={handleSave}
          disabled={isSaving || recordLoading || headerFetching || gridsFetching}
        >
          <Save size={13} strokeWidth={2} />
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="master-modal-btn master-modal-btn--cancel"
          onClick={handleClose}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    ),
    [handleClose, handleSave, isSaving, recordLoading, headerFetching, gridsFetching]
  );

  const isLoading = headerFetching || recordLoading || gridsFetching;
  const combinedErr = headerError || recordLoadError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={MODAL_TITLE}
      subtitle={MODAL_SUBTITLE}
      icon={<ClipboardList size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      footer={footer}
    >
      {isLoading ? (
        <div className="master-modal-loader">Loading call reporting…</div>
      ) : combinedErr ? (
        <div className="master-modal-error">
          <AlertCircle size={14} strokeWidth={2} /> {combinedErr}
        </div>
      ) : (
        <>
          <div className="mntcr-form-scroll">
            <div className="mntcr-form">
              {visibleFields.map((field) => (
                <div
                  key={field.ColName}
                  className={[
                    "mntcr-form-row",
                    isMasterToggleField(field) ? "mntcr-form-row--toggle" : "",
                    isMasterCheckboxField(field) ? "mntcr-form-row--checkbox" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span
                    className={`mntcr-form-label${
                      isMasterFieldRequired(field) ? " mntcr-form-label--required" : ""
                    }`}
                  >
                    {getMasterFieldLabel(field)}
                  </span>
                  <div className="mntcr-form-control">
                    {renderControl(field)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <section className="mntcr-grid-section" ref={itemGridSectionRef}>
            <div className="grid-tabbar">
              <div className="grid-tabbar__tabs">
                {MNT_REPORTING_GRID_TABS.map((t) => (
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
                  type="button"
                  className="eg-tab-btn"
                  onClick={handleSelectItem}
                  disabled={gridsReadonly}
                  title="Pick parts for the active grid"
                >
                  <Package size={12} strokeWidth={2.5} />
                  Select Item
                </button>
                <button
                  type="button"
                  className="eg-tab-btn eg-tab-btn--danger"
                  onClick={handleDeleteSelected}
                  disabled={gridsReadonly || selectionCount === 0}
                  title="Delete selected rows"
                >
                  <Trash2 size={12} strokeWidth={2} />
                  Delete
                </button>
              </div>
            </div>

            <div
              className={`mntcr-tab-pane${activeTab === "new-parts" ? " mntcr-tab-pane--active" : ""}`}
            >
              <EntryGrid
                ref={newPartsGridRef}
                config={newPartsGridConfig}
                title=""
                hideBottomPanel
                emptyMessage="No required parts. Click Select Item above."
                onSelectionChange={setNewPartsSelectionCount}
                onCellEvent={(evt) =>
                  handleCellEvent({ ...evt, gridRef: newPartsGridRef })
                }
                eventColumns={new Set(["qty", "rate", "Qty", "Rate"])}
                readOnly={gridsReadonly}
                loading={false}
              />
            </div>

            <div
              className={`mntcr-tab-pane${activeTab === "old-parts" ? " mntcr-tab-pane--active" : ""}`}
            >
              <EntryGrid
                ref={oldPartsGridRef}
                config={oldPartsGridConfig}
                title=""
                hideBottomPanel
                emptyMessage="No old parts. Click Select Item above."
                onSelectionChange={setOldPartsSelectionCount}
                onCellEvent={(evt) =>
                  handleCellEvent({ ...evt, gridRef: oldPartsGridRef })
                }
                eventColumns={new Set(["qty", "rate", "Qty", "Rate"])}
                readOnly={gridsReadonly}
                loading={false}
              />
            </div>
          </section>

          {saveError && (
            <div className="master-modal-save-error">
              <AlertCircle size={14} strokeWidth={2} /> {saveError}
            </div>
          )}
        </>
      )}

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
    </Modal>
  );
}
