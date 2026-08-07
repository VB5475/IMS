import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MapPin, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterFormField from "../../components/forms/MasterFormField";
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
import { getMasterFieldLabel } from "../../utils/masterFormUtils";
import { isLockOnEditModeCol } from "../../utils/gridUtils";
import { useNotification } from "../../context/NotificationContext";
import { LM_CONFIG, MODAL_TITLE_ADD, MODAL_TITLE_EDIT, MODAL_SUBTITLE } from "./constants";
import "./LocationMasterPage.css";

// Visible dropdown colname for Premises (live RB colname, confirmed via GetDetailColData)
const PREMISES_COL = "parentidnumber";

// Fields cleared when Premises (parentidnumber) changes
const CASCADE_FIELDS = ["loc_code", "location_name", "address1", "city", "state", "country", "zipcode"];

export default function LocationMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], allColumns = [], defsLoading = false, defsError = null,
  locationTypeOptions = [], premisesOptions = [], divisionOptions = [],
  parentLocationOptions = [], fetchParentLocationOptions, clearParentLocationOptions,
  fetchEditRecord,
}) {
  const isAddMode = mode === "add";
  const { post } = useApi(API_BASE_URL_IMS);

  const [isEditMode,      setIsEditMode]      = useState(true);
  const [formValues,      setFormValues]      = useState({});
  const [recordLoading,   setRecordLoading]   = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const notify = useNotification();
  const [formErrors,    setFormErrors]    = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldValidationFailed, setFieldValidationFailed] = useState(false);
  const [discardAction, setDiscardAction] = useState(null);

  // Build a blank row seeded from RB column defaults + context fields
  const buildEmptyFromColumns = useCallback(() => {
    const session = getUserSession();
    const row = {};
    allColumns.forEach(({ key, colDataType }) => {
      row[key] = getColDefault(colDataType);
    });
    return {
      ...row,
      // Live RB's real column is "companyidnumber" (not the "companyid" name
      // most other modules use) — confirmed via GetDetailColData. Setting
      // only "companyid" left the real column at its numeric default (0),
      // which is what actually gets sent to the save SP. Kept "companyid"
      // too since it's harmless and something else might reference it.
      companyidnumber: session.companyId,
      companyid: session.companyId,
      yearid:    session.yearId,
      loginid:   session.loginId,
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
    setFieldErrors({});
    setFieldValidationFailed(false);
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
      yearId:    session.yearId,
      loginId:   session.loginId,
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
    divisionid: divisionOptions,
    locationtype: locationTypeOptions,
    [PREMISES_COL]: premisesOptions,
    parentlocationid: parentLocationOptions,
  }), [divisionOptions, locationTypeOptions, premisesOptions, parentLocationOptions]);

  // Parent Location cascades off Location Type — reload its options whenever
  // Location Type's value changes, covering both an interactive Add-mode
  // change AND the initial value arriving from an edit-mode record load.
  useEffect(() => {
    if (!isOpen) return;
    const locationTypeId = formValues.locationtype;
    if (locationTypeId) {
      fetchParentLocationOptions?.(locationTypeId);
    } else {
      clearParentLocationOptions?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, formValues.locationtype]);

  // Returns true if this field should be non-interactive.
  // View mode (not yet clicked "Edit"): whole form locked.
  // Add mode: always editable.
  // Edit mode: locked purely by the RB's own IsLockOnEditModeAllow flag
  // (isLockOnEditModeCol — the same helper EntryGrid itself uses for this
  // exact flag), not IsEditAllow and not a hardcoded field list. Location
  // Master's live RB sets IsEditAllow=false on mandatory fields (divisionid,
  // loc_code, location_name) for reasons unrelated to this form's own edit
  // lock, so IsEditAllow is intentionally NOT consulted here — confirmed
  // with the user 2026-08-03, scoped to Location Master only.
  function isLocked(field) {
    if (isAddMode) return false;
    if (!isEditMode) return true;
    return isLockOnEditModeCol(field);
  }

  // Field value change — cascade-clear downstream fields on Premises change,
  // and reset Parent Location whenever Location Type changes (its options
  // depend entirely on the selected Location Type — an old value almost
  // certainly won't belong to the new one's list).
  const handleChange = useCallback((key, value) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === PREMISES_COL) {
        CASCADE_FIELDS.forEach((f) => { next[f] = ""; });
      }
      if (key === "locationtype") {
        next.parentlocationid = "";
      }
      return next;
    });
  }, []);

  // Render the right control for this field — control type, locked/editable
  // display, and per-type validation (dropdown/toggle/checkbox/date/numeric/
  // text) all come from the shared MasterFormField, driven entirely by the
  // RB's own ColCtrlType/ColDataType/range/length metadata — same component
  // every other master form (Division, Company, Account, ...) uses, so this
  // module renders and validates whatever the RB defines instead of a fixed
  // set of control types.
  function renderControl(field) {
    const key = field.colname;
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={isLocked(field)}
        options={optionsMap[key] || []}
        inputClassName="lm-form-input"
        textareaClassName="lm-form-textarea"
        valueClassName="lm-form-value"
        error={fieldErrors[key]}
      />
    );
  }

  // Save — validation driven entirely by RB column metadata (mandatory,
  // dropdown-zero-is-empty, length/range/date rules all handled inside
  // validateApiColumns), save row seeded from all RB columns
  const handleSave = useCallback(async () => {
    setFormErrors([]);
    setFieldValidationFailed(false);
    const fieldErrorMap = validateApiColumnsByField(formValues, visibleFields);
    setFieldErrors(fieldErrorMap);
    if (Object.keys(fieldErrorMap).length > 0) {
      setFieldValidationFailed(true);
      return;
    }

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
      const result = await post(LM_CONFIG.SAVE_ENDPOINT, payload);
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
          <AlertPanel
            errors={formErrors}
            title={fieldValidationFailed ? "Please fix the highlighted field(s) below." : undefined}
            onDismiss={() => setFormErrors([])}
          />
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
                    {getMasterFieldLabel(field)}
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
