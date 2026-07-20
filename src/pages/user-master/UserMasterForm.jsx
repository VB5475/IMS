import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Users, Save, Pencil, AlertCircle } from "lucide-react";
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
import { validateApiColumns } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import {
  getMasterFieldLabel,
  isMasterFieldLocked,
  isMasterFieldRequired,
  isMasterCheckboxField,
  isMasterToggleField,
} from "../../utils/masterFormUtils";
import { UM_CONFIG } from "./constants";

/** Synthetic VerifyPWD column — mirrors the Pwd RB column but is never saved. */
function buildVerifyPasswordField(pwdField) {
  if (!pwdField) return null;
  return {
    ...pwdField,
    colname: "verifypwd",
    ColName: "verifypwd",
    displayname: "Verify Password",
    DisplayName: "Verify Password",
  };
}

export default function UserMasterForm({
  isOpen,
  mode,
  onClose,
  onSaved,
  fieldDefs = [],
  allColumns = [],
  defsLoading = false,
  defsError = null,
  dropdownOptions = {},
  onRefreshDropdowns,
  editPrefill = null,
  recordLoading = false,
  recordLoadError = null,
}) {
  const isAddMode = mode === "add";
  const { post } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [discardAction, setDiscardAction] = useState(null);

  // Seed blank row from ALL RB columns (lowercase) + context + synthetic password fields
  const buildEmptyFromColumns = useCallback(() => {
    const row = {};
    allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
    const session = getUserSession();
    return {
      ...row,
      yearid: session.yearId,
      loginid: session.loginId,
      sessionid: DEFAULT_SESSION_ID,
      funccode: UM_CONFIG.RB_MASTER,
      pwd: "",
      verifypwd: "",
    };
  }, [allColumns]);

  // PG returns lowercase colnames — find password field by lowercase colname
  const pwdField = useMemo(() => fieldDefs.find((f) => f.colname === "pwd"), [fieldDefs]);
  const verifyField = useMemo(() => buildVerifyPasswordField(pwdField), [pwdField]);

  // Visible fields sorted by colseqno — exclude pwd (rendered separately below)
  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.isvisible && Number(f.colseqno) < 100 && f.colname !== "pwd")
      .sort((a, b) => Number(a.colseqno) - Number(b.colseqno)),
    [fieldDefs]);

  // Cascade: parent colname → child colnames to reset (from RB updatekeycolname)
  const cascadeResets = useMemo(() => {
    const map = {};
    fieldDefs.forEach((f) => {
      const parent = String(f.updatekeycolname ?? "").trim();
      if (!parent || !f.colname) return;
      (map[parent] ??= []).push(f.colname);
    });
    return map;
  }, [fieldDefs]);

  // Cascade: parent colname → child dropdown colnames that need refresh
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

  // Reset form each time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setFormErrors([]);
    if (isAddMode) {
      setFormValues(buildEmptyFromColumns());
    } else if (editPrefill?.headerValues) {
      setFormValues({ ...buildEmptyFromColumns(), ...editPrefill.headerValues });
    }
  }, [isOpen, isAddMode, editPrefill, buildEmptyFromColumns]);

  const handleChange = useCallback((key, value) => {
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

  function renderSecretField(field, valueKey, locked) {
    return (
      <MasterFormField
        field={field}
        value={formValues[valueKey] || ""}
        onChange={(val) => handleChange(valueKey, val)}
        locked={locked}
        inputClassName="um-form-input"
        valueClassName="um-form-value"
        inputType="password"
        maskWhenLocked
        autoComplete="new-password"
        placeholder={`Enter ${getMasterFieldLabel(field)}...`}
      />
    );
  }

  function renderControl(field) {
    const key = field.colname;
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={isMasterFieldLocked(field, { isAddMode, isEditMode })}
        options={dropdownOptions[key] || []}
        inputClassName="um-form-input"
        valueClassName="um-form-value"
      />
    );
  }

  const handleSave = useCallback(async () => {
    const errors = validateApiColumns(formValues, visibleFields);

    // Password validation
    if (isAddMode) {
      if (pwdField && !String(formValues.pwd ?? "").trim())
        errors.push("Password is required.");
      if (verifyField && !String(formValues.verifypwd ?? "").trim())
        errors.push("Verify Password is required.");
    } else if (pwdField && String(formValues.pwd || "").trim()) {
      // Edit mode — validate format only if password is being changed
      const pwdErrors = validateApiColumns({ pwd: formValues.pwd }, [pwdField]);
      errors.push(...pwdErrors);
    }

    if (isAddMode && formValues.pwd !== formValues.verifypwd) {
      errors.push("Password and Verify Password do not match.");
    }

    if (errors.length > 0) { setFormErrors(errors); return; }

    setFormErrors([]);
    setSaveError(null);
    setIsSaving(true);
    try {
      // buildSaveRowFromColumns only includes RB columns — verifypwd excluded automatically
      const saveRow = buildSaveRowFromColumns(formValues, allColumns);
      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );
      const result = await post(UM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message || "User saved successfully.");
      setFormValues(buildEmptyFromColumns());
      setFormErrors([]);
      setSaveError(null);
      onSaved?.();
    } catch (err) {
      console.error("[UM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, allColumns, isAddMode, pwdField, verifyField, onSaved, post, notify]);

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

  const isLoading = defsLoading || recordLoading;
  const combinedErr = defsError || recordLoadError;
  const showVerify = isAddMode && verifyField;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? "New User" : "Edit User"}
      subtitle="Admin › Files › User Master"
      icon={<Users size={16} strokeWidth={2} />}
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
          <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
          <div className="um-form-layout">
            <div className="um-form">
              {visibleFields.map((field) => (
                <div
                  key={field.colname}
                  className={`um-form-row${isMasterToggleField(field) ? " um-form-row--toggle" : ""}`}
                >
                  <span className={`um-form-label${isMasterFieldRequired(field) ? " um-form-label--required" : ""}`}>
                    {getMasterFieldLabel(field)}
                  </span>
                  <div className={`um-form-control${isMasterToggleField(field) ? " um-form-control--toggle-wrap" : ""}`}>
                    {renderControl(field)}
                  </div>
                </div>
              ))}

              {pwdField && (
                <div className="um-form-row">
                  <span className={`um-form-label${isMasterFieldRequired(pwdField) && isAddMode ? " um-form-label--required" : ""}`}>
                    {getMasterFieldLabel(pwdField)}
                  </span>
                  <div className="um-form-control">
                    {renderSecretField(pwdField, "pwd", isMasterFieldLocked(pwdField, { isAddMode, isEditMode }))}
                  </div>
                </div>
              )}

              {showVerify && (
                <div className="um-form-row">
                  <span className={`um-form-label${isMasterFieldRequired(verifyField) ? " um-form-label--required" : ""}`}>
                    {getMasterFieldLabel(verifyField)}
                  </span>
                  <div className="um-form-control">
                    {renderSecretField(verifyField, "verifypwd", !isEditMode)}
                  </div>
                </div>
              )}
            </div>

            <aside className="um-hierarchy-panel">
              <div className="um-hierarchy-panel__title">User / Group Hierarchy</div>
              <p className="um-hierarchy-panel__hint">
                Group-wise hierarchy for the selected user will appear here once the hierarchy API
                is connected.
              </p>
            </aside>
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
