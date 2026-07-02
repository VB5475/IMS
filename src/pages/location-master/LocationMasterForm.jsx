import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MapPin, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SearchSelect from "../../components/ui/SearchSelect";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID, DEFAULT_SESSION_ID,
  getColDefault, buildSaveRowFromColumns,
} from "../../api/constants";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumns } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import { LM_CONFIG, MODAL_TITLE_ADD, MODAL_TITLE_EDIT, MODAL_SUBTITLE } from "./constants";

// Visible dropdown colname for Premises (RB colname = "parentid")
const PREMISES_COL = "parentid";

// Fields locked during edit mode (use RB colnames — all lowercase)
const LOCK_ON_EDIT = new Set(["locationtype", "parentid", "loc_code", "location_name"]);

// Fields cleared when Premises (parentid) changes
const CASCADE_FIELDS = ["loc_code", "location_name", "address1", "city", "state", "country", "zipcode"];

export default function LocationMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], allColumns = [], defsLoading = false, defsError = null,
  locationTypeOptions = [], premisesOptions = [],
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
      companyid: DEFAULT_COMPANY_ID,
      yearid:    LM_CONFIG.CONFIG_YEAR_ID,
      loginid:   DEFAULT_LOGIN_ID,
      sessionid: DEFAULT_SESSION_ID,
      funccode:  LM_CONFIG.RB_MASTER,
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
      yearId:    LM_CONFIG.CONFIG_YEAR_ID,
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

  // Visible fields sorted by colseqno from GetDetailColData response
  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.isvisible && f.colseqno < 100)
      .sort((a, b) => a.colseqno - b.colseqno),
  [fieldDefs]);

  // Dropdown options lookup keyed by RB colname
  const optionsMap = useMemo(() => ({
    locationtype: locationTypeOptions,
    [PREMISES_COL]: premisesOptions,
  }), [locationTypeOptions, premisesOptions]);

  // Returns true if this field should be non-interactive
  function isLocked(field) {
    if (!isEditMode) return true;
    if (isAddMode)   return false;
    return LOCK_ON_EDIT.has(field.colname);
  }

  // Field value change — cascade-clear downstream fields on Premises change
  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === PREMISES_COL) {
        CASCADE_FIELDS.forEach((f) => { next[f] = ""; });
      }
      return next;
    });
  }, []);

  // Render the right control based on colctrltype from API
  function renderControl(field) {
    const key    = field.colname;
    const locked = isLocked(field);

    // colctrltype 4 — Dropdown
    if (field.colctrltype === 4) {
      return (
        <SearchSelect
          value={formValues[key] != null ? String(formValues[key]) : ""}
          onChange={(val) => handleChange(key, Number(val) || 0)}
          options={optionsMap[key] || []}
          placeholder="Select..."
          disabled={locked}
        />
      );
    }

    // colctrltype 2 — Textarea
    if (field.colctrltype === 2) {
      return (
        <textarea
          className="lm-form-textarea"
          value={formValues[key] || ""}
          onChange={(e) => handleChange(key, e.target.value)}
          placeholder={`Enter ${field.displayname || key}...`}
          readOnly={locked}
          tabIndex={locked ? -1 : undefined}
          rows={2}
        />
      );
    }

    // colctrltype 1 — TextBox (default)
    return (
      <input
        className="lm-form-input"
        type="text"
        value={formValues[key] || ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${field.displayname || key}...`}
        readOnly={locked}
        tabIndex={locked ? -1 : undefined}
      />
    );
  }

  // Save — validation from ismandatory, save row seeded from all RB columns
  const handleSave = useCallback(async () => {
    const normalizedValues = Object.fromEntries(
      visibleFields.map((f) => [
        f.colname,
        f.colctrltype === 4 && formValues[f.colname] === 0 ? "" : formValues[f.colname],
      ])
    );
    const errors = validateApiColumns(normalizedValues, visibleFields);
    if (errors.length > 0) { setFormErrors(errors); return; }

    setSaveError(null);
    setIsSaving(true);
    try {
      // Build a complete row with defaults for every RB column, then overlay form values
      const saveRow = buildSaveRowFromColumns(formValues, allColumns);

      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );
      const res    = await fetch(`${API_BASE_URL_IMS}${LM_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message);
      setFormValues(buildEmptyFromColumns());
      setFormErrors([]);
      setSaveError(null);
      onSaved?.();
    } catch (err) {
      console.error("[LM Save] Failed:", err);
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

  let addressDividerShown = false;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? MODAL_TITLE_ADD : MODAL_TITLE_EDIT}
      subtitle={MODAL_SUBTITLE}
      icon={<MapPin size={16} strokeWidth={2} />}
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
          <div className="lm-form">
            {visibleFields.map((field) => {
              const rows = [];

              // Insert "Address Details" section divider before the first address field
              if (field.colname === "address1" && !addressDividerShown) {
                addressDividerShown = true;
                rows.push(
                  <div key="_addressDivider" className="lm-form-section-divider">
                    Address Details
                  </div>
                );
              }

              rows.push(
                <div key={field.colname} className="lm-form-row">
                  <span className={`lm-form-label${field.ismandatory ? " lm-form-label--required" : ""}`}>
                    {field.displayname || field.colname}
                  </span>
                  <div className="lm-form-control">
                    {renderControl(field)}
                  </div>
                </div>
              );

              return rows;
            })}
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
