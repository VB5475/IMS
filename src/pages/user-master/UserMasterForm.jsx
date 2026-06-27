import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Users, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import MasterFormField from "../../components/forms/MasterFormField";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID,
  DEFAULT_LOGIN_ID,
  DEFAULT_SESSION_ID,
} from "../../api/constants";
import { useApi } from "../../api/useApi";
import { withSaveContextFields } from "../../utils/savePayload";
import { validateColumnValue } from "../../utils/columnValidation";
import {
  buildMasterCascadeResets,
  buildMasterCascadeDropdownRefresh,
  buildMasterFormEmpty,
  getMasterFieldDefaultValue,
  getMasterFieldLabel,
  getToggleValue,
  getVisibleHeaderFields,
  isMasterFieldLocked,
  isMasterFieldRequired,
  isMasterToggleField,
  validateMasterFormFields,
  alertMasterFormValidationErrors,
  runAfterFieldBlur,
} from "../../utils/masterFormUtils";
import { UM_CONFIG } from "./constants";

/** Only non-API field — mirrors GET_DETAIL_COL_DATA Pwd column for confirm entry. */
function buildVerifyPasswordField(pwdField) {
  if (!pwdField) return null;
  return {
    ...pwdField,
    ColName: "VerifyPWD",
    DisplayName: "Verify Password",
  };
}

function buildSaveContext() {
  return {
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: UM_CONFIG.CONFIG_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    SessionID: DEFAULT_SESSION_ID,
    FuncCode: UM_CONFIG.RB_MASTER,
  };
}

export default function UserMasterForm({
  isOpen,
  mode,
  onClose,
  onSaved,
  fieldDefs = [],
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

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState(() =>
    buildMasterFormEmpty(fieldDefs, buildSaveContext())
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const pwdField = useMemo(() => fieldDefs.find((f) => f.ColName === "Pwd"), [fieldDefs]);
  const verifyField = useMemo(() => buildVerifyPasswordField(pwdField), [pwdField]);

  const visibleFields = useMemo(
    () => getVisibleHeaderFields(fieldDefs).filter((f) => f.ColName !== "Pwd"),
    [fieldDefs]
  );

  const cascadeResets = useMemo(() => buildMasterCascadeResets(fieldDefs), [fieldDefs]);
  const cascadeDropdownRefresh = useMemo(
    () => buildMasterCascadeDropdownRefresh(fieldDefs),
    [fieldDefs]
  );

  const handleChange = useCallback(
    (key, value) => {
      setFormValues((prev) => {
        const next = { ...prev, [key]: value };
        const resetKeys = cascadeResets[key];
        if (resetKeys?.length) {
          resetKeys.forEach((resetKey) => {
            const field = fieldDefs.find((f) => f.ColName === resetKey);
            next[resetKey] = field ? getMasterFieldDefaultValue(field) : "";
          });
        }
        return next;
      });

      if (cascadeDropdownRefresh[key]?.length) {
        onRefreshDropdowns?.(key);
      }
    },
    [cascadeResets, cascadeDropdownRefresh, fieldDefs, onRefreshDropdowns]
  );

  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    const empty = buildMasterFormEmpty(fieldDefs, buildSaveContext());
    empty.VerifyPWD = "";
    if (isAddMode) {
      setFormValues(empty);
    } else if (editPrefill?.headerValues) {
      setFormValues({ ...empty, ...editPrefill.headerValues });
    }
  }, [isOpen, isAddMode, editPrefill, fieldDefs]);

  useEffect(() => {
    if (!isOpen || !fieldDefs.length) return;
    setFormValues((prev) => {
      const next = { ...prev };
      let changed = false;
      fieldDefs.forEach((f) => {
        if (isMasterToggleField(f) && next[f.ColName] === undefined) {
          next[f.ColName] = 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [isOpen, fieldDefs]);

  function renderSecretField(field, valueKey, locked) {
    const label = getMasterFieldLabel(field);
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
        placeholder={`Enter ${label}...`}
      />
    );
  }

  function renderControl(field) {
    const key = field.ColName;
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={isMasterFieldLocked(field, { isAddMode, isEditMode })}
        options={dropdownOptions[key] || []}
        inputClassName="um-form-input"
        valueClassName="um-form-value"
        toggleClassName="um-form-toggle"
      />
    );
  }

  const handleSave = useCallback(async () => {
    const validationErrors = validateMasterFormFields(visibleFields, formValues, {
      skipMandatoryFor: new Set(
        visibleFields.filter(isMasterToggleField).map((f) => f.ColName)
      ),
    });

    if (isAddMode) {
      if (pwdField) {
        validationErrors.push(...validateMasterFormFields([pwdField], formValues));
      }
      if (verifyField) {
        validationErrors.push(...validateMasterFormFields([verifyField], formValues));
      }
    } else if (pwdField && String(formValues.Pwd || "").trim()) {
      const pwdResult = validateColumnValue(formValues.Pwd, pwdField);
      if (!pwdResult.valid) validationErrors.push(pwdResult.message);
    }

    if (alertMasterFormValidationErrors(validationErrors)) return;

    if (isAddMode && formValues.Pwd !== formValues.VerifyPWD) {
      alert("Password and Verify Password do not match.");
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      const { VerifyPWD: _verify, ...saveRow } = formValues;
      visibleFields.forEach((f) => {
        if (isMasterToggleField(f) && f.ColName in saveRow) {
          saveRow[f.ColName] = getToggleValue(saveRow[f.ColName]);
        }
      });

      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );

      await post(UM_CONFIG.SAVE_ENDPOINT, payload);
      alert("User saved successfully!");
      onSaved?.();
    } catch (err) {
      console.error("[UM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, isAddMode, pwdField, verifyField, onSaved, post]);

  const handleClose = useCallback(() => {
    runAfterFieldBlur(() => {
      if (isEditMode && !window.confirm("Discard changes?")) return;
      onClose();
    });
  }, [isEditMode, onClose]);

  const handleCancelEdit = useCallback(() => {
    runAfterFieldBlur(() => {
      if (!window.confirm("Discard changes?")) return;
      if (isAddMode) {
        onClose();
        return;
      }
      setIsEditMode(false);
      setSaveError(null);
    });
  }, [isAddMode, onClose]);

  const footer = useMemo(() => {
    if (!isEditMode) {
      return (
        <button
          type="button"
          className="master-modal-btn master-modal-btn--edit"
          onClick={() => setIsEditMode(true)}
        >
          <Pencil size={13} strokeWidth={2} /> Edit
        </button>
      );
    }
    return (
      <div className="master-modal-footer-actions">
        <button
          type="button"
          className="master-modal-btn master-modal-btn--cancel"
          onClick={handleCancelEdit}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="master-modal-btn master-modal-btn--save"
          onClick={handleSave}
          disabled={isSaving}
        >
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
      {isLoading ? (
        <div className="master-modal-loader">Loading…</div>
      ) : combinedErr ? (
        <div className="master-modal-error">
          <AlertCircle size={14} strokeWidth={2} /> {combinedErr}
        </div>
      ) : (
        <>
          <div className="um-form-layout">
            <div className="um-form">
              {visibleFields.map((field) => (
                <div
                  key={field.ColName}
                  className={`um-form-row${
                    isMasterToggleField(field) ? " um-form-row--toggle" : ""
                  }`}
                >
                  <span
                    className={`um-form-label${
                      isMasterFieldRequired(field) ? " um-form-label--required" : ""
                    }`}
                  >
                    {getMasterFieldLabel(field)}
                  </span>
                  <div
                    className={`um-form-control${
                      isMasterToggleField(field) ? " um-form-control--toggle-wrap" : ""
                    }`}
                  >
                    {renderControl(field)}
                  </div>
                </div>
              ))}

              {pwdField && (
                <div className="um-form-row">
                  <span
                    className={`um-form-label${
                      isMasterFieldRequired(pwdField) && isAddMode
                        ? " um-form-label--required"
                        : ""
                    }`}
                  >
                    {getMasterFieldLabel(pwdField)}
                  </span>
                  <div className="um-form-control">
                    {renderSecretField(
                      pwdField,
                      "Pwd",
                      isMasterFieldLocked(pwdField, { isAddMode, isEditMode })
                    )}
                  </div>
                </div>
              )}

              {showVerify && (
                <div className="um-form-row">
                  <span
                    className={`um-form-label${
                      isMasterFieldRequired(verifyField) ? " um-form-label--required" : ""
                    }`}
                  >
                    {getMasterFieldLabel(verifyField)}
                  </span>
                  <div className="um-form-control">
                    {renderSecretField(verifyField, "VerifyPWD", !isEditMode)}
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
