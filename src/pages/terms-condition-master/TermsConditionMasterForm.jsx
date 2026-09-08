// TermsConditionMasterForm.jsx — Add/Edit modal for Terms and Condition
// Master. Same modal shape as Voucher Type Master's form (Modal + 3-column
// grid layout + RB-driven field list), two real differences:
//  - dropdownOptions is a generic { [colname]: options[] } map from the
//    shared fetchDropdownOptions mechanism, not per-field hardcoded state.
//  - Edit mode loads the record fresh via fetchEditRecord(recordId) on open
//    (fn_tbl_rb_termnconditionmst keyed on idnumber), same load-on-open
//    pattern as Customer Master's form — not seeded from the grid row.
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ScrollText, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SearchSelect from "../../components/ui/SearchSelect";
import { DEFAULT_SESSION_ID, getColDefault } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { validateApiColumnsByField } from "../../utils/columnValidation";
import { isMasterFieldLocked, isMasterCheckboxField, getCheckboxValue } from "../../utils/masterFormUtils";
import { useNotification } from "../../context/NotificationContext";
import { TCM_CONFIG, MODAL_TITLE_ADD, MODAL_TITLE_EDIT, MODAL_SUBTITLE } from "./constants";
import "./TermsConditionMasterPage.css";

function getLabel(field) { return field.displayname; }

export default function TermsConditionMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], allColumns = [], defsLoading = false, defsError = null,
  dropdownOptions = {}, fetchEditRecord,
}) {
  const isAddMode = mode === "add";

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  const [fieldValidationFailed, setFieldValidationFailed] = useState(false);

  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) setFieldValidationFailed(false);
  }, [fieldErrors]);
  const [discardAction, setDiscardAction] = useState(null);

  const buildEmptyFromColumns = useCallback(() => {
    const session = getUserSession();
    const row = {};
    allColumns.forEach(({ key, colDataType }) => {
      row[key] = getColDefault(colDataType);
    });
    return {
      ...row,
      yearid: session.yearId,
      loginid: session.loginId,
      sessionid: session.sessionId || DEFAULT_SESSION_ID,
      funccode: TCM_CONFIG.RB_MASTER,
    };
  }, [allColumns]);

  // Reset each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setFormErrors([]);
    setFieldErrors({});
    setFieldValidationFailed(false);
    setRecordLoadError(null);
    setFormValues(buildEmptyFromColumns());
  }, [isOpen, isAddMode, buildEmptyFromColumns]);

  // Edit mode: load the record fresh via fn_tbl_rb_termnconditionmst
  // (prmmasterid = recordId), not seeded from the grid row.
  useEffect(() => {
    if (!isOpen || isAddMode || !recordId) return;
    setRecordLoading(true);
    setRecordLoadError(null);
    fetchEditRecord(recordId)
      .then((row) => {
        if (!row) { setRecordLoadError("Record not found."); return; }
        setFormValues({ ...buildEmptyFromColumns(), ...row });
      })
      .catch((err) => {
        console.error("[TCM] fetchEditRecord failed:", err);
        setRecordLoadError(err?.message || "Failed to load record.");
      })
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, buildEmptyFromColumns]);

  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.isvisible && f.colseqno < 100)
      .sort((a, b) => a.colseqno - b.colseqno),
  [fieldDefs]);

  function isLocked(field) {
    return isMasterFieldLocked(field, { isAddMode, isEditMode });
  }

  const handleChange = useCallback((key, value) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  function buildControl(field) {
    const key = field.colname;
    const locked = isLocked(field);
    const error = fieldErrors[key];

    if (isMasterCheckboxField(field)) {
      return (
        <input
          type="checkbox"
          className="tcm-form-checkbox"
          checked={getCheckboxValue(formValues[key]) === 1}
          onChange={(e) => handleChange(key, e.target.checked ? 1 : 0)}
          disabled={locked}
        />
      );
    }

    // colctrltype 4 — Dropdown (Terms Type)
    if (Number(field.colctrltype) === 4) {
      const options = dropdownOptions[key] || [];
      return (
        <SearchSelect
          value={formValues[key] ? String(formValues[key]) : ""}
          onChange={(val) => handleChange(key, Number(val) || 0)}
          options={options}
          placeholder="Select..."
          disabled={locked}
          className={error ? "tcm-form-dropdown--error" : undefined}
        />
      );
    }

    // colctrltype 1 — TextBox (Code, Description)
    return (
      <input
        className={`tcm-form-input${error ? " tcm-form-input--error" : ""}`}
        type="text"
        value={formValues[key] ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}...`}
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
        <div className="tcm-form-field-error">{error}</div>
      </>
    );
  }

  // Save endpoint isn't confirmed yet (see constants.js) — validate for real
  // (so the form itself is fully testable), but stop short of posting.
  const handleSave = useCallback(async () => {
    setFormErrors([]);
    setFieldValidationFailed(false);
    const normalizedValues = { ...formValues };
    visibleFields.forEach((f) => {
      if (Number(f.colctrltype) === 4 && (normalizedValues[f.colname] === 0 || normalizedValues[f.colname] === "0")) {
        normalizedValues[f.colname] = "";
      }
      if (isMasterCheckboxField(f)) {
        normalizedValues[f.colname] = getCheckboxValue(normalizedValues[f.colname]);
      }
    });
    const fieldErrorMap = validateApiColumnsByField(normalizedValues, visibleFields);
    setFieldErrors(fieldErrorMap);
    if (Object.keys(fieldErrorMap).length > 0) {
      setFieldValidationFailed(true);
      return;
    }

    // SAVE_ENDPOINT isn't confirmed yet (see constants.js) — swap this for
    // the real post call (buildSaveRowFromColumns + useApi().post, same
    // shape as every other master's handleSave) once it is.
    notify.info("Save is not wired up yet — the API for this is coming separately.");
  }, [visibleFields, formValues, notify]);

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
        <button type="button" className="master-modal-btn master-modal-btn--save"
                onClick={handleSave} disabled={isSaving}>
          <Save size={13} strokeWidth={2} />
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="master-modal-btn master-modal-btn--cancel"
                onClick={handleCancelEdit} disabled={isSaving}>
          Cancel
        </button>
      </div>
    );
  }, [isEditMode, isSaving, handleCancelEdit, handleSave]);

  const isLoading = defsLoading || recordLoading;
  const combinedErr = defsError || recordLoadError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? MODAL_TITLE_ADD : MODAL_TITLE_EDIT}
      subtitle={MODAL_SUBTITLE}
      icon={<ScrollText size={16} strokeWidth={2} />}
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
          <AlertPanel
            errors={formErrors}
            title={fieldValidationFailed ? "Please fix the highlighted field(s) below." : undefined}
            onDismiss={() => setFormErrors([])}
          />
          <div className="tcm-form">
            {visibleFields.map((field) => (
              <div key={field.colname} className="tcm-form-row">
                <span className={`tcm-form-label${field.ismandatory ? " tcm-form-label--required" : ""}`}>
                  {getLabel(field)}
                </span>
                <div className="tcm-form-control">
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
