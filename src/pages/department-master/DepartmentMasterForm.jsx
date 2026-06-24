import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Building2, Save, Pencil, AlertCircle } from "lucide-react";
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
import {
  buildMasterCascadeDropdownRefresh,
  buildMasterCascadeResets,
  buildMasterFormEmpty,
  getCheckboxValue,
  getMasterFieldDefaultValue,
  getMasterFieldLabel,
  getToggleValue,
  getVisibleHeaderFields,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterFieldRequired,
  isMasterToggleField,
  validateMasterFormFields,
  alertMasterFormValidationErrors,
  runAfterFieldBlur,
} from "../../utils/masterFormUtils";
import { DM_CONFIG } from "./constants";
import "./DepartmentMasterPage.css";

function buildSaveContext() {
  return {
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: DM_CONFIG.CONFIG_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    SessionID: DEFAULT_SESSION_ID,
    FuncCode: DM_CONFIG.RB_MASTER,
  };
}

export default function DepartmentMasterForm({
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

  const visibleFields = useMemo(() => getVisibleHeaderFields(fieldDefs), [fieldDefs]);
  const cascadeResets = useMemo(() => buildMasterCascadeResets(fieldDefs), [fieldDefs]);
  const cascadeDropdownRefresh = useMemo(
    () => buildMasterCascadeDropdownRefresh(fieldDefs),
    [fieldDefs]
  );

  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    const empty = buildMasterFormEmpty(fieldDefs, buildSaveContext());
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
        if (isMasterCheckboxField(f) && next[f.ColName] === undefined) {
          next[f.ColName] = 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [isOpen, fieldDefs]);

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

  function renderControl(field) {
    const key = field.ColName;
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
      />
    );
  }

  const handleSave = useCallback(async () => {
    const validationErrors = validateMasterFormFields(visibleFields, formValues, {
      skipMandatoryFor: new Set(
        visibleFields
          .filter((f) => isMasterToggleField(f) || isMasterCheckboxField(f))
          .map((f) => f.ColName)
      ),
    });

    if (alertMasterFormValidationErrors(validationErrors)) return;

    setSaveError(null);
    setIsSaving(true);
    try {
      const saveRow = { ...formValues };
      visibleFields.forEach((f) => {
        if (isMasterToggleField(f) && f.ColName in saveRow) {
          saveRow[f.ColName] = getToggleValue(saveRow[f.ColName]);
        }
        if (isMasterCheckboxField(f) && f.ColName in saveRow) {
          saveRow[f.ColName] = getCheckboxValue(saveRow[f.ColName]);
        }
      });

      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );

      await post(DM_CONFIG.SAVE_ENDPOINT, payload);
      alert("Department saved successfully!");
      onSaved?.();
    } catch (err) {
      console.error("[DM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, isAddMode, onSaved, post]);

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
      {isLoading ? (
        <div className="master-modal-loader">Loading…</div>
      ) : combinedErr ? (
        <div className="master-modal-error">
          <AlertCircle size={14} strokeWidth={2} /> {combinedErr}
        </div>
      ) : (
        <>
          <div className="dm-form-scroll">
            <div className="dm-form">
              {visibleFields.map((field) => (
              <div
                key={field.ColName}
                className={[
                  "dm-form-row",
                  isMasterToggleField(field) ? "dm-form-row--toggle" : "",
                  isMasterCheckboxField(field) ? "dm-form-row--checkbox" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span
                  className={`dm-form-label${
                    isMasterFieldRequired(field) ? " dm-form-label--required" : ""
                  }`}
                >
                  {getMasterFieldLabel(field)}
                </span>
                <div
                  className={`dm-form-control${
                    isMasterToggleField(field) ? " dm-form-control--toggle-wrap" : ""
                  }${isMasterCheckboxField(field) ? " dm-form-control--checkbox" : ""}`}
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
    </Modal>
  );
}
