import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Shield, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SearchSelect from "../../components/ui/SearchSelect";
import {
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  getColDefault, buildSaveRowFromColumns,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumnsByField } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import { UG_CONFIG } from "./constants";
import "./UserGroupPage.css";

// Fields rendered as checkbox despite colctrltype=1 (store numeric 0/1)
// Populate after RB column data is confirmed with DBA.
const CHECKBOX_OVERRIDES = new Set([]);

function getLabel(field) { return field.displayname || field.colname; }

export default function UserGroupForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], allColumns = [], defsLoading = false, defsError = null,
  dropdownOptions = {},
  fetchEditRecord,
}) {
  const isAddMode = mode === "add";
  const { post } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState({});
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [discardAction, setDiscardAction] = useState(null);

  // Build a blank row seeded from RB column defaults + context fields
  const buildEmptyFromColumns = useCallback(() => {
    const row = {};
    allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
    const session = getUserSession();
    return {
      ...row,
      yearid: session.yearId,
      loginid: session.loginId,
      sessionid: DEFAULT_SESSION_ID,
      funccode: UG_CONFIG.RB_MASTER,
    };
  }, [allColumns]);

  // Reset form each time modal opens
  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setRecordLoadError(null);
    setFormErrors([]);
    setFieldErrors({});
    setFormValues(buildEmptyFromColumns());
  }, [isOpen, isAddMode, buildEmptyFromColumns]);

  // Load existing record when opening in edit mode
  useEffect(() => {
    if (!isOpen || isAddMode || !recordId) return;
    setRecordLoading(true);
    setRecordLoadError(null);
    const session = getUserSession();
    fetchEditRecord({
      companyId: session.companyId,
      yearId: session.yearId,
      loginId: session.loginId,
      sessionId: DEFAULT_SESSION_ID,
      idNumber: recordId,
    })
      .then(({ master, headerValues }) => {
        if (!master || !headerValues) { setRecordLoadError("Record not found."); return; }
        setFormValues({ ...buildEmptyFromColumns(), ...headerValues });
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, buildEmptyFromColumns]);

  // Visible fields sorted by RB colseqno (PG returns lowercase meta keys)
  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.isvisible && f.colseqno < 100)
      .sort((a, b) => a.colseqno - b.colseqno),
    [fieldDefs]);

  function isLocked(field) {
    if (!isEditMode) return true;
    return false;
  }

  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  function renderControl(field) {
    const key = field.colname;
    const locked = isLocked(field);

    // Checkbox override — numeric 0/1 stored but rendered as checkbox
    if (CHECKBOX_OVERRIDES.has(key)) {
      return (
        <div className="ug-form-control--checkbox">
          <input
            type="checkbox"
            className="ug-form-checkbox"
            checked={!!formValues[key]}
            onChange={(e) => handleChange(key, e.target.checked ? 1 : 0)}
            disabled={locked}
          />
          <span className="ug-form-checkbox-label">{formValues[key] ? "Yes" : "No"}</span>
        </div>
      );
    }

    // colctrltype 4 — Dropdown (options keyed by RB colname — lowercase)
    if (Number(field.colctrltype) === 4) {
      return (
        <SearchSelect
          options={dropdownOptions[key] || []}
          value={formValues[key] > 0 ? String(formValues[key]) : ""}
          onChange={(val) => handleChange(key, Number(val) || 0)}
          disabled={locked}
          placeholder={`Select ${getLabel(field)}…`}
        />
      );
    }

    // Default — TextBox
    return (
      <input
        className="ug-form-input"
        type="text"
        value={formValues[key] ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}…`}
        readOnly={locked}
        tabIndex={locked ? -1 : undefined}
      />
    );
  }

  // Validation from RB ismandatory; save row seeded from all RB columns
  const handleSave = useCallback(async () => {
    setFormErrors([]);
    const fieldsToValidate = visibleFields.filter((f) => !CHECKBOX_OVERRIDES.has(f.colname));
    const fieldErrorMap = validateApiColumnsByField(formValues, fieldsToValidate);
    setFieldErrors(fieldErrorMap);
    if (Object.keys(fieldErrorMap).length > 0) return;

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
      const result = await post(UG_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message);
      setFormValues(buildEmptyFromColumns());
      setFormErrors([]);
      setSaveError(null);
      onSaved?.();
    } catch (err) {
      console.error("[UG Save] Failed:", err);
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
      title={isAddMode ? "New User Group" : "Edit User Group"}
      subtitle="Admin › Files › User Group"
      icon={<Shield size={16} strokeWidth={2} />}
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
          <div className="ug-form">
            {visibleFields.map((field) => (
              <div
                key={field.colname}
                className={[
                  "ug-form-row",
                  CHECKBOX_OVERRIDES.has(field.colname) ? "ug-form-row--checkbox" : "",
                ].filter(Boolean).join(" ")}
              >
                <span className={`ug-form-label${field.ismandatory && !CHECKBOX_OVERRIDES.has(field.colname) ? " ug-form-label--required" : ""}`}>
                  {getLabel(field)}
                </span>
                <div className={`ug-form-control${CHECKBOX_OVERRIDES.has(field.colname) ? " ug-form-control--checkbox" : ""}`}>
                  {renderControl(field)}
                </div>
                {fieldErrors[field.colname] && (
                  <span className="ug-form-error">{fieldErrors[field.colname]}</span>
                )}
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
