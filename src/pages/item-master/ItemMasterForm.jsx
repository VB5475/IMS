import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { Package, Save, Pencil, AlertCircle, RefreshCw, Plus, FileText } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SearchSelect from "../../components/ui/SearchSelect";
const DocumentLogModal = lazy(() => import("../../components/txn/DocumentLogModal"));
import { DOCUMENT_LOG_CONFIG as DOC_LOG_CFG } from "../../components/txn/documentLogConfig";
import {
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  getColDefault,
  buildSaveRowFromColumns,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { useDocumentLogAccess } from "../../hooks/useDocumentLogAccess";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumnsByField } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import {
  IM_CONFIG,
  IM_DROPDOWN_FIELDS,
  IM_SUB_GROUP_FIELDS,
  IM_ITEM_TYPE_CASCADE_RESETS,
  IM_MAIN_GROUP_CASCADE_RESETS,
  IM_SUB_MAIN_GROUP_CASCADE_RESETS,
} from "./constants";
import "../../components/forms/MasterFormField.css";
import "./ItemMasterPage.css";

// Fields locked during edit mode (RB colnames — all lowercase)
const LOCK_ON_EDIT = new Set(["itemcode"]);

// Fields rendered as checkbox despite colctrltype=11 (Numeric Yes/No; store
// numeric 0/1) — isdirectpoallow is isqcreq's sibling field (same
// colctrltype/coldatatype, sequential objdetid) that never got this same
// override added.
const CHECKBOX_OVERRIDES = new Set(["isqcreq", "isdirectpoallow"]);

const DISPLAY_OVERRIDES = {
  taxabilityid: "Taxability",
  hsncode: "HSN / SAC Code",
  unitconvrate: "Unit Conv. Rate",
};

function getLabel(field) {
  return DISPLAY_OVERRIDES[field.colname] || field.displayname || field.colname;
}

export default function ItemMasterForm({
  isOpen,
  mode,
  onClose,
  onSaved,
  fieldDefs = [],
  allColumns = [],
  defsLoading = false,
  defsError = null,
  itemTypeOptions = [],
  mainGroupOptions = [],
  subMainGroupOptions = [],
  subGroupOptions = [],
  taxOptions = [],
  tranUnitOptions = [],
  baseUnitOptions = [],
  editPrefill = null,
  recordLoading = false,
  recordLoadError = null,
  onItemTypeChange,
  onMainGroupChange,
  onSubMainGroupChange,
  onRefreshItemType,
  onRefreshMainGroup,
  onRefreshSubMainGroup,
  onRefreshSubGroup,
  onRefreshStatic,
  onQuickAddMainGroup,
  onQuickAddSubMainGroup,
  onQuickAddSubGroup,
}) {
  const isAddMode = mode === "add";
  const { post } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  const [fieldValidationFailed, setFieldValidationFailed] = useState(false);

  // 2026-08-14 (/pm) — fieldValidationFailed (drives the Save button's
  // "Please fix the highlighted field(s) below." tooltip) is only ever SET
  // by handleSave; nothing clears it back to false as the user fixes fields
  // one at a time (the field change handler only clears fieldErrors for the
  // field just edited) — so the blocked/tooltip state can outlive every
  // actual field error. Clear it once fieldErrors is genuinely empty.
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) setFieldValidationFailed(false);
  }, [fieldErrors]);
  const [discardAction, setDiscardAction] = useState(null);

  // Document Log ("Documents" button, 2026-08-13 /pm) — this master's own
  // idnumber IS its "tranId" (0/blank before the first save, same semantic
  // as a transaction's unsaved tranid=0). No separate reset wiring is
  // needed for a fresh Add after save: resetting formValues below already
  // drives idnumber back to 0, and useDocumentLogAccess's own internal
  // effect (keyed on recordId) re-issues a fresh docGuid automatically.
  const docLog = useDocumentLogAccess({
    tranTypeId: IM_CONFIG.DM_TRAN_TYPE_ID,
    // Module-wise department id (2026-08-14, /pm) — DM Department Master
    // id=1 for Item Master, no longer the shared ADMIN_REF_DEPARTMENT_ID.
    refDepartmentId: DOC_LOG_CFG.REF_DEPARTMENT_ID.ITEM_MASTER,
    recordId: Number(formValues.idnumber) || 0,
    getDivisionId: () => 0, // Item Master isn't division-scoped (see handleSave's own divisionId: 0)
    isEditMode,
    postSave: post,
    logLabel: "[ItemMaster]",
  });

  const buildEmptyFromColumns = useCallback(() => {
    const session = getUserSession();
    const row = {};
    allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
    return {
      ...row,
      yearid: session.yearId,
      loginid: session.loginId,
      sessionid: DEFAULT_SESSION_ID,
      funccode: IM_CONFIG.RB_MASTER,
    };
  }, [allColumns]);

  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setFormErrors([]);
    setFieldErrors({});
    setFieldValidationFailed(false);
    if (isAddMode) {
      setFormValues(buildEmptyFromColumns());
    } else if (editPrefill?.headerValues) {
      setFormValues({ ...buildEmptyFromColumns(), ...editPrefill.headerValues });
    }
  }, [isOpen, isAddMode, editPrefill, buildEmptyFromColumns]);

  const visibleFields = useMemo(
    () =>
      fieldDefs
        .filter((f) => f.isvisible && f.colseqno < 100)
        .sort((a, b) => a.colseqno - b.colseqno || (Number(a.objdetid) || 0) - (Number(b.objdetid) || 0)),
    [fieldDefs]
  );

  const optionsMap = useMemo(
    () => ({
      itemtypeid: itemTypeOptions,
      maingroupid: mainGroupOptions,
      submaingroupid: subMainGroupOptions,
      taxabilityid: taxOptions,
      tranunitid: tranUnitOptions,
      baseunitid: baseUnitOptions,
      ...Object.fromEntries(IM_SUB_GROUP_FIELDS.map((key) => [key, subGroupOptions])),
    }),
    [itemTypeOptions, mainGroupOptions, subMainGroupOptions, subGroupOptions, taxOptions, tranUnitOptions, baseUnitOptions]
  );

  function isLocked(field) {
    if (!isEditMode) return true;
    if (!isAddMode && LOCK_ON_EDIT.has(field.colname)) return true;
    return false;
  }

  const handleChange = useCallback(
    (key, value) => {
      setFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setFormValues((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "itemtypeid") {
          IM_ITEM_TYPE_CASCADE_RESETS.forEach((k) => { next[k] = IM_DROPDOWN_FIELDS.has(k) ? 0 : ""; });
          onItemTypeChange?.(Number(value) || 0);
        } else if (key === "maingroupid") {
          IM_MAIN_GROUP_CASCADE_RESETS.forEach((k) => { next[k] = IM_DROPDOWN_FIELDS.has(k) ? 0 : ""; });
          onMainGroupChange?.({ itemTypeId: next.itemtypeid, mainGroupId: Number(value) || 0 });
        } else if (key === "submaingroupid") {
          IM_SUB_MAIN_GROUP_CASCADE_RESETS.forEach((k) => { next[k] = IM_DROPDOWN_FIELDS.has(k) ? 0 : ""; });
          onSubMainGroupChange?.({
            itemTypeId: next.itemtypeid,
            mainGroupId: next.maingroupid,
            subMainGroupId: Number(value) || 0,
          });
        }
        return next;
      });
    },
    [onItemTypeChange, onMainGroupChange, onSubMainGroupChange]
  );

  // Refresh + quick-add wiring per dropdown — Main Group / Sub Main Group /
  // Sub Group have their own master module to quick-add into; Item Type,
  // Taxability, Tran Unit, and Base Unit don't (yet), so those get a refresh
  // icon only.
  function dropdownActionsFor(key) {
    const itemTypeId = formValues.itemtypeid;
    const mainGroupId = formValues.maingroupid;
    const subMainGroupId = formValues.submaingroupid;

    if (key === "itemtypeid") {
      return { onRefresh: () => onRefreshItemType?.(), quickAdd: null };
    }
    if (key === "maingroupid") {
      return {
        onRefresh: () => onRefreshMainGroup?.(itemTypeId),
        quickAdd: onQuickAddMainGroup
          ? { label: "Main Group", onAdd: () => onQuickAddMainGroup(itemTypeId) }
          : null,
      };
    }
    if (key === "submaingroupid") {
      return {
        onRefresh: () => onRefreshSubMainGroup?.({ itemTypeId, mainGroupId }),
        quickAdd: onQuickAddSubMainGroup
          ? { label: "Sub Main Group", onAdd: () => onQuickAddSubMainGroup({ itemTypeId, mainGroupId }) }
          : null,
      };
    }
    if (IM_SUB_GROUP_FIELDS.includes(key)) {
      return {
        onRefresh: () => onRefreshSubGroup?.({ itemTypeId, mainGroupId, subMainGroupId }),
        quickAdd: onQuickAddSubGroup
          ? { label: "Sub Group", onAdd: () => onQuickAddSubGroup({ itemTypeId, mainGroupId, subMainGroupId }) }
          : null,
      };
    }
    if (key === "taxabilityid" || key === "tranunitid" || key === "baseunitid") {
      return { onRefresh: () => onRefreshStatic?.(), quickAdd: null };
    }
    return { onRefresh: null, quickAdd: null };
  }

  function buildControl(field) {
    const key = field.colname;
    const locked = isLocked(field);
    const error = fieldErrors[key];

    // Itemcode — always auto-generated, shown as display text
    if (key === "itemcode") {
      return (
        <span className="im-form-value">
          {formValues.itemcode || (isAddMode ? "Auto-generated on save" : "—")}
        </span>
      );
    }

    // Checkbox override — stored as numeric 0/1 (never validated, see handleSave).
    // Rendered as a toggle switch (per /pm, to match account-group-master's
    // style), reusing MasterFormField's shared master-form-toggle* classes —
    // MasterFormField.css is already imported into this file. No extra
    // wrapper div here beyond master-form-control--toggle itself: the
    // row-render loop below already puts "im-form-control
    // im-form-control--checkbox" on ITS wrapper around this control, which
    // is the real flex container (see .im-form-control--checkbox in
    // ItemMasterPage.css).
    if (CHECKBOX_OVERRIDES.has(key)) {
      const on = !!formValues[key];
      return (
        <div className="master-form-control--toggle">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={getLabel(field)}
            className={`master-form-toggle${on ? " master-form-toggle--on" : ""}`}
            onClick={() => handleChange(key, on ? 0 : 1)}
            disabled={locked}
          />
          <span className="master-form-toggle-label">{on ? "Yes" : "No"}</span>
        </div>
      );
    }

    // Dropdown (by colctrltype or known dropdown field)
    if (Number(field.colctrltype) === 4 || IM_DROPDOWN_FIELDS.has(key)) {
      const control = (
        <SearchSelect
          options={optionsMap[key] || []}
          value={String(formValues[key] ?? "")}
          onChange={(val) => handleChange(key, Number(val) || 0)}
          disabled={locked}
          placeholder={`Select ${getLabel(field)}…`}
          className={error ? "im-form-dropdown--error" : undefined}
        />
      );

      if (locked) return control;
      const { onRefresh, quickAdd } = dropdownActionsFor(key);
      if (!onRefresh && !quickAdd) return control;

      return (
        <div className="master-form-dropdown-row">
          {control}
          {onRefresh && (
            <button
              type="button"
              className="master-form-icon-btn"
              tabIndex={-1}
              onClick={onRefresh}
              title={`Refresh ${getLabel(field)} options`}
              aria-label={`Refresh ${getLabel(field)} options`}
            >
              <RefreshCw size={12} strokeWidth={2.5} />
            </button>
          )}
          {quickAdd && (
            <button
              type="button"
              className="master-form-icon-btn"
              tabIndex={-1}
              onClick={quickAdd.onAdd}
              title={`Add new ${quickAdd.label}`}
              aria-label={`Add new ${quickAdd.label}`}
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
      );
    }

    // Default — text input
    return (
      <input
        className={`im-form-input${error ? " im-form-input--error" : ""}`}
        type="text"
        value={formValues[key] ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}…`}
        readOnly={locked}
        tabIndex={locked ? -1 : undefined}
      />
    );
  }

  function renderControl(field) {
    const error = fieldErrors[field.colname];
    const control = buildControl(field);
    if (!error) return control;
    return (
      <>
        {control}
        <div className="master-form-field-error">{error}</div>
      </>
    );
  }

  const handleSave = useCallback(async () => {
    setFormErrors([]);
    setFieldValidationFailed(false);
    const fieldsToValidate = visibleFields.filter(
      (f) => f.colname !== "itemcode" && !CHECKBOX_OVERRIDES.has(f.colname)
    );
    const fieldErrorMap = validateApiColumnsByField(formValues, fieldsToValidate);
    setFieldErrors(fieldErrorMap);
    if (Object.keys(fieldErrorMap).length > 0) {
      setFieldValidationFailed(true);
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      const saveRow = buildSaveRowFromColumns(formValues, allColumns);
      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );
      const result = await post(IM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message, newId } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message);
      // Same Add-mode gap this closes for transaction forms: idnumber is
      // only known on an Edit save (Add is 0 here, formValues hasn't been
      // reset yet), but newId is the real saved id either way.
      const savedTranId = newId ?? (!isAddMode ? Number(formValues.idnumber) || null : null);
      await docLog.finalizeSave(savedTranId);
      setFormValues(buildEmptyFromColumns());
      setFormErrors([]);
      setSaveError(null);
      onSaved?.();
    } catch (err) {
      console.error("[IM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, allColumns, isAddMode, onSaved, notify, docLog.finalizeSave]);

  const handleDiscardConfirm = useCallback(() => {
    const action = discardAction;
    setDiscardAction(null);
    if (action === "close") {
      onClose();
    } else {
      if (isAddMode) { onClose(); return; }
      setIsEditMode(false);
      setSaveError(null);
    }
  }, [discardAction, isAddMode, onClose]);

  const handleClose = useCallback(() => {
    // This form's own Modal instance stays mounted across opens (parent
    // page toggles `isOpen`), so the Documents sub-modal must be explicitly
    // closed here — it wouldn't otherwise, and would linger stacked over
    // whatever the parent list page renders once this modal hides.
    docLog.setDocModalOpen(false);
    if (!isEditMode) { onClose(); return; }
    setDiscardAction("close");
  }, [isEditMode, onClose, docLog.setDocModalOpen]);

  const handleCancelEdit = useCallback(() => {
    setDiscardAction("cancel");
  }, []);

  // Documents button — hide/show only (2026-08-17 /pm), no disabled state.
  // Rendered only when Document Log is enabled for this login + trantype
  // AND Add/Edit mode is actually active; hidden entirely otherwise.
  const documentsButton = useMemo(
    () =>
      docLog.isDocumentLogEnabled ? (
        <button
          type="button"
          className="master-modal-btn master-modal-btn--secondary"
          onClick={docLog.handleOpenDocuments}
          title="Document Log (F6)"
        >
          <FileText size={13} strokeWidth={2} /> Documents
        </button>
      ) : null,
    [docLog.isDocumentLogEnabled, docLog.handleOpenDocuments]
  );

  const footer = useMemo(() => {
    if (!isEditMode) {
      return (
        <div className="master-modal-footer-actions">
          {documentsButton}
          <button
            type="button"
            className="master-modal-btn master-modal-btn--edit"
            onClick={() => setIsEditMode(true)}
          >
            <Pencil size={13} strokeWidth={2} /> Edit
          </button>
        </div>
      );
    }
    return (
      <div className="master-modal-footer-actions">
        {documentsButton}
        <button
          type="button"
          className="master-modal-btn master-modal-btn--save"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save size={13} strokeWidth={2} />
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="master-modal-btn master-modal-btn--cancel"
          onClick={handleCancelEdit}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    );
  }, [isEditMode, isSaving, handleCancelEdit, handleSave, documentsButton]);

  const isLoading = defsLoading || recordLoading;
  const combinedErr = defsError || recordLoadError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? "New Item" : "Edit Item"}
      subtitle="Admin › Item › Item Master"
      icon={<Package size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      footer={footer}
    >
      <ConfirmDialog
        isOpen={discardAction !== null}
        message="Discard unsaved changes?"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setDiscardAction(null)}
      />
      {isLoading ? (
        <div className="master-modal-loader">Loading…</div>
      ) : combinedErr ? (
        <div className="master-modal-error">
          <AlertCircle size={14} strokeWidth={2} /> {combinedErr}
        </div>
      ) : (
        <>
          <AlertPanel
            errors={formErrors}
            title={fieldValidationFailed ? "Please fix the highlighted field(s) below." : undefined}
            onDismiss={() => setFormErrors([])}
          />

          <div className="im-form-scroll">
            <div className="im-form">
              {visibleFields.map((field) => (
                <div
                  key={field.colname}
                  className={[
                    "im-form-row",
                    field.colname === "itemcode" ? "im-form-row--view" : "",
                    CHECKBOX_OVERRIDES.has(field.colname) ? "im-form-row--checkbox" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span
                    className={`im-form-label${field.ismandatory &&
                        !CHECKBOX_OVERRIDES.has(field.colname) &&
                        field.colname !== "itemcode"
                        ? " im-form-label--required"
                        : ""
                      }`}
                  >
                    {getLabel(field)}
                  </span>
                  <div
                    className={`im-form-control${CHECKBOX_OVERRIDES.has(field.colname) ? " im-form-control--checkbox" : ""
                      }`}
                  >
                    {renderControl(field)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {saveError && (
            <div className="master-modal-save-error">
              <AlertCircle size={14} strokeWidth={2} /> {saveError}
            </div>
          )}
        </>
      )}

      <Suspense fallback={null}>
        <DocumentLogModal
          ref={docLog.docModalRef}
          isOpen={docLog.docModalOpen}
          onClose={() => docLog.setDocModalOpen(false)}
          tranId={Number(formValues.idnumber) || 0}
          divisionId={0}
          tranTypeId={IM_CONFIG.DM_TRAN_TYPE_ID}
          refDepartmentId={DOC_LOG_CFG.REF_DEPARTMENT_ID.ITEM_MASTER}
          guid={docLog.docGuid}
        />
      </Suspense>
    </Modal>
  );
}
