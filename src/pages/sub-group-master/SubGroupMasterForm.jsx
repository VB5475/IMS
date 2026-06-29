import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Package, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID, DEFAULT_SESSION_ID,
  getColDefault, buildSaveRowFromColumns,
} from "../../api/constants";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumns } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import { SGM_CONFIG, MODAL_TITLE_ADD, MODAL_TITLE_EDIT, MODAL_SUBTITLE } from "./constants";

// Fields locked during edit mode (RB colnames — all lowercase)
const LOCK_ON_EDIT = new Set(["subgroupcode", "subgroupname"]);

// Fields that render as checkbox despite colctrltype=1 (API returns numeric 0/1)
const CHECKBOX_OVERRIDES = new Set(["usedinautoitemcodegeneration"]);

// Corrected display labels
const DISPLAY_OVERRIDES = {
  usedinautoitemcodegeneration: "Used in Auto Item Code Gen.",
  subgroupshortcode:            "Sub Group Short Code",
  subgroupshortname:            "Sub Group Short Name",
};
function getLabel(field) { return DISPLAY_OVERRIDES[field.colname] || field.displayname; }

export default function SubGroupMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], allColumns = [], defsLoading = false, defsError = null,
  fetchEditRecord,
}) {
  const isAddMode = mode === "add";

  const [isEditMode,      setIsEditMode]      = useState(true);
  const [formValues,      setFormValues]      = useState({});
  const [recordLoading,   setRecordLoading]   = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const notify = useNotification();
  const [formErrors,    setFormErrors]    = useState([]);
  const [discardAction, setDiscardAction] = useState(null);

  // Build a blank row seeded from RB column defaults + context fields
  const buildEmptyFromColumns = useCallback(() => {
    const row = {};
    allColumns.forEach(({ key, colDataType }) => {
      row[key] = getColDefault(colDataType);
    });
    return {
      ...row,
      yearid:    SGM_CONFIG.CONFIG_YEAR_ID,
      loginid:   DEFAULT_LOGIN_ID,
      sessionid: DEFAULT_SESSION_ID,
      funccode:  SGM_CONFIG.RB_MASTER,
    };
  }, [allColumns]);

  // Reset form each time modal opens
  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setRecordLoadError(null);
    setFormErrors([]);
    setFormValues(buildEmptyFromColumns());
  }, [isOpen, isAddMode, buildEmptyFromColumns]);

  // Load existing record when opening in edit mode
  useEffect(() => {
    if (!isOpen || isAddMode || !recordId) return;
    setRecordLoading(true);
    setRecordLoadError(null);
    fetchEditRecord({
      companyId: DEFAULT_COMPANY_ID,
      yearId:    SGM_CONFIG.CONFIG_YEAR_ID,
      loginId:   DEFAULT_LOGIN_ID,
      sessionId: DEFAULT_SESSION_ID,
      idNumber:  recordId,
    })
      .then(({ master, headerValues }) => {
        if (!master || !headerValues) { setRecordLoadError("Record not found."); return; }
        setFormValues({ ...buildEmptyFromColumns(), ...headerValues });
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, buildEmptyFromColumns]);

  // Visible fields sorted by colseqno from GetDetailColData
  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.isvisible && f.colseqno < 100)
      .sort((a, b) => a.colseqno - b.colseqno),
  [fieldDefs]);

  function isLocked(field) {
    if (!isEditMode) return true;
    if (isAddMode)   return false;
    return LOCK_ON_EDIT.has(field.colname);
  }

  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  function renderControl(field) {
    const key    = field.colname;
    const locked = isLocked(field);

    // Checkbox override — numeric 0/1 stored but rendered as checkbox
    if (CHECKBOX_OVERRIDES.has(key)) {
      return (
        <div className="sgm-form-control--checkbox">
          <input
            type="checkbox"
            className="sgm-form-checkbox"
            checked={!!formValues[key]}
            onChange={(e) => handleChange(key, e.target.checked ? 1 : 0)}
            disabled={locked}
          />
          <span className="sgm-form-checkbox-label">
            {formValues[key] ? "Yes" : "No"}
          </span>
        </div>
      );
    }

    // colctrltype 1 — TextBox (no dropdowns in Sub Group Master)
    return (
      <input
        className="sgm-form-input"
        type="text"
        value={formValues[key] ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}...`}
        readOnly={locked}
        tabIndex={locked ? -1 : undefined}
      />
    );
  }

  // Validation from RB ismandatory; save row seeded from all RB columns
  const handleSave = useCallback(async () => {
    const errors = validateApiColumns(formValues, visibleFields);
    if (errors.length > 0) { setFormErrors(errors); return; }

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
      const res    = await fetch(`${API_BASE_URL_IMS}${SGM_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message);
      onSaved?.();
    } catch (err) {
      console.error("[SGM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, allColumns, isAddMode, onSaved, notify]);

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
    if (!isEditMode) { onClose(); return; }
    setDiscardAction("close");
  }, [isEditMode, onClose]);

  const handleCancelEdit = useCallback(() => {
    setDiscardAction("cancel");
  }, []);

  const footer = useMemo(() => {
    if (!isEditMode) {
      return (
        <button type="button" className="master-modal-btn master-modal-btn--edit"
                onClick={() => setIsEditMode(true)}>
          <Pencil size={13} strokeWidth={2} /> Edit
        </button>
      );
    }
    return (
      <div className="master-modal-footer-actions">
        <button type="button" className="master-modal-btn master-modal-btn--cancel"
                onClick={handleCancelEdit} disabled={isSaving}>
          Cancel
        </button>
        <button type="button" className="master-modal-btn master-modal-btn--save"
                onClick={handleSave} disabled={isSaving}>
          <Save size={13} strokeWidth={2} />
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    );
  }, [isEditMode, isSaving, handleCancelEdit, handleSave]);

  const isLoading   = defsLoading || recordLoading;
  const combinedErr = defsError   || recordLoadError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? MODAL_TITLE_ADD : MODAL_TITLE_EDIT}
      subtitle={MODAL_SUBTITLE}
      icon={<Package size={16} strokeWidth={2} />}
      size="md"
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
          <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
          <div className="sgm-form">
            {visibleFields.map((field) => (
              <div key={field.colname} className="sgm-form-row">
                <span className={`sgm-form-label${field.ismandatory && !CHECKBOX_OVERRIDES.has(field.colname) ? " sgm-form-label--required" : ""}`}>
                  {getLabel(field)}
                </span>
                <div className={`sgm-form-control${CHECKBOX_OVERRIDES.has(field.colname) ? " sgm-form-control--checkbox" : ""}`}>
                  {renderControl(field)}
                </div>
              </div>
            ))}
          </div>
          {saveError && (
            <div className="master-modal-save-error">
              <AlertCircle size={14} strokeWidth={2} /> {saveError}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
