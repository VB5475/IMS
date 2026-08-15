import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Building2, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterFormField from "../../components/forms/MasterFormField";
import {
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  getColDefault,
  buildSaveRowFromColumns,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumnsByField } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import {
  getMasterFieldLabel,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterToggleField,
} from "../../utils/masterFormUtils";
import { DM_CONFIG } from "./constants";
import "./DepartmentMasterPage.css";

export default function DepartmentMasterForm({
  isOpen,
  mode,
  recordId,
  onClose,
  onSaved,
  fieldDefs = [],
  allColumns = [],
  defsLoading = false,
  defsError = null,
  dropdownOptions = {},
  onRefreshDropdowns,
  onRefreshDeptHead,
  onQuickAddDeptHead,
  fetchEditRecord,
  seedOptionsFromMaster,
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

  // Build a blank row seeded from ALL RB columns (not just visible) + system context fields
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
      sessionid: DEFAULT_SESSION_ID,
      funccode: DM_CONFIG.RB_MASTER,
    };
  }, [allColumns]);

  // Visible header fields sorted by colseqno — driven entirely by RB response
  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.isvisible && Number(f.colseqno) < 100)
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno)),
    [fieldDefs]);

  // Cascade: parent colname → child colnames to reset on change
  const cascadeResets = useMemo(() => {
    const map = {};
    fieldDefs.forEach((f) => {
      const parent = String(f.updatekeycolname ?? "").trim();
      if (!parent || !f.colname) return;
      (map[parent] ??= []).push(f.colname);
    });
    return map;
  }, [fieldDefs]);

  // Cascade: parent colname → child colnames whose dropdowns need refreshing
  const cascadeDropdownRefresh = useMemo(() => {
    const map = {};
    fieldDefs.forEach((f) => {
      if (Number(f.colctrltype) !== 4) return;
      const parent = String(f.updatekeycolname ?? "").trim();
      if (!parent || !f.colname) return;
      (map[parent] ??= []).push(f.colname);
    });
    return map;
  }, [fieldDefs]);

  // Reset form each time modal opens
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

  // Load existing record when opening in edit mode
  useEffect(() => {
    if (!isOpen || isAddMode || !recordId) return;
    setRecordLoading(true);
    setRecordLoadError(null);
    const session = getUserSession();
    fetchEditRecord?.({
      companyId: session.companyId,
      yearId: session.yearId,
      loginId: session.loginId,
      sessionId: DEFAULT_SESSION_ID,
      idNumber: recordId,
    })
      .then(({ master, headerValues }) => {
        if (!master || !headerValues) { setRecordLoadError("Record not found."); return; }
        seedOptionsFromMaster?.(master);
        setFormValues({ ...buildEmptyFromColumns(), ...headerValues });
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, seedOptionsFromMaster, buildEmptyFromColumns]);

  const handleChange = useCallback((key, value) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      const resetKeys = cascadeResets[key];
      if (resetKeys?.length) {
        resetKeys.forEach((rk) => { next[rk] = 0; });
      }
      return next;
    });
    if (cascadeDropdownRefresh[key]?.length) {
      onRefreshDropdowns?.(key);
    }
  }, [cascadeResets, cascadeDropdownRefresh, onRefreshDropdowns]);

  function renderControl(field) {
    const key = field.colname;
    const isDeptHead = key === String(DM_CONFIG.DEPT_HEAD_COL).toLowerCase();
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={isMasterFieldLocked(field, { isAddMode, isEditMode })}
        options={dropdownOptions[key] || []}
        inputClassName="dm-form-input"
        valueClassName="dm-form-value"
        toggleClassName="dm-form-toggle"
        onRefresh={isDeptHead ? onRefreshDeptHead : undefined}
        quickAdd={isDeptHead && onQuickAddDeptHead ? { label: "User", onAdd: onQuickAddDeptHead } : null}
        error={fieldErrors[key]}
      />
    );
  }

  const handleSave = useCallback(async () => {
    setFieldValidationFailed(false);
    const fieldErrorMap = validateApiColumnsByField(formValues, visibleFields);
    setFieldErrors(fieldErrorMap);
    if (Object.keys(fieldErrorMap).length > 0) {
      setFieldValidationFailed(true);
      setFormErrors([]);
      return;
    }

    setFormErrors([]);
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
      console.log("prmStrMstJSON Payload", saveRow);
      console.log("prmStrDetJSON Payload", {});
      console.log("Department Payload", payload);
      const result = await post(DM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message || "Department saved successfully.");
      setFormValues(buildEmptyFromColumns());
      setFormErrors([]);
      setSaveError(null);
      onSaved?.();
    } catch (err) {
      console.error("[DM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, allColumns, isAddMode, onSaved, post, notify]);

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
      title={isAddMode ? "New Department" : "Edit Department"}
      subtitle="Admin › Master › Company › Department Master"
      icon={<Building2 size={16} strokeWidth={2} />}
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
          <div className="dm-form-scroll">
            <div className="dm-form">
              {visibleFields.map((field) => (
                <div
                  key={field.colname}
                  className={[
                    "dm-form-row",
                    isMasterToggleField(field) ? "dm-form-row--toggle" : "",
                    isMasterCheckboxField(field) ? "dm-form-row--checkbox" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <span className={`dm-form-label${field.ismandatory ? " dm-form-label--required" : ""}`}>
                    {getMasterFieldLabel(field)}
                  </span>
                  <div className={[
                    "dm-form-control",
                    isMasterToggleField(field) ? "dm-form-control--toggle-wrap" : "",
                    isMasterCheckboxField(field) ? "dm-form-control--checkbox" : "",
                  ].filter(Boolean).join(" ")}>
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
    </Modal>
  );
}
