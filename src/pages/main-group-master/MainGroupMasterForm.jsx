import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Tag, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import MasterFormField from "../../components/forms/MasterFormField";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID, DEFAULT_SESSION_ID,
} from "../../api/constants";
import { useApi } from "../../api/useApi";
import { withSaveContextFields } from "../../utils/savePayload";
import {
  getCheckboxValue,
  getMasterFieldLabel,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterFieldRequired,
  validateMasterFormFields,
  runAfterFieldBlur,
} from "../../utils/masterFormUtils";
import { MGM_CONFIG } from "./constants";

// API ColName → formValues key (only where they differ)
const COL_NAME_MAP = {
  UsedInAutoItemCodeGeneration: "UsedCodeInCodeGeneration",
};
function formKey(colName) { return COL_NAME_MAP[colName] || colName; }

// Corrected display labels (some API DisplayNames have backend typos)
const DISPLAY_OVERRIDES = {
  MainGroupShortCode: "Main Group Short Code",
  MainGroupShortName: "Main Group Short Name",
  UsedInAutoItemCodeGeneration: "Used in Code Generation",
};
function getLabel(field) { return getMasterFieldLabel(field, DISPLAY_OVERRIDES); }

const READ_ONLY_COLS = new Set(["MainGroupShortCode"]);

function buildEmpty() {
  return {
    IDNumber: 0,
    ItemTypeID: 0,
    MainGroupCode: "",
    MainGroupName: "",
    MainGroupShortName: "",
    UsedCodeInCodeGeneration: 0,
    UsedCodeInCodeGeneration: 0,
    MainGroupShortCode: "",
    FixedAssetAccountID: 0,
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: MGM_CONFIG.CONFIG_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    SessionID: DEFAULT_SESSION_ID,
    FuncCode: MGM_CONFIG.RB_MASTER,
  };
}

export default function MainGroupMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], defsLoading = false, defsError = null,
  itemTypeOptions = [], fixedAssetAccOptions = [],
  fetchEditRecord, seedOptionsFromMaster,
}) {
  const isAddMode = mode === "add";
  const { post } = useApi(API_BASE_URL_IMS);

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState(buildEmpty());
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const [discardAction, setDiscardAction] = useState(null);

  // Reset form each time modal opens
  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setRecordLoadError(null);
    setFormValues(buildEmpty());
  }, [isOpen, isAddMode]);

  // Load existing record when opening in edit mode
  useEffect(() => {
    if (!isOpen || isAddMode || !recordId) return;
    setRecordLoading(true);
    setRecordLoadError(null);
    fetchEditRecord({
      companyId: DEFAULT_COMPANY_ID,
      yearId: MGM_CONFIG.CONFIG_YEAR_ID,
      loginId: DEFAULT_LOGIN_ID,
      sessionId: DEFAULT_SESSION_ID,
      idNumber: recordId,
    })
      .then(({ master, headerValues }) => {
        if (!master || !headerValues) { setRecordLoadError("Record not found."); return; }
        seedOptionsFromMaster?.(master);
        setFormValues({ ...buildEmpty(), ...headerValues });
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, seedOptionsFromMaster]);

  // Visible fields sorted by ColSeqNo from GetDetailColData response
  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.IsVisible && f.ColSeqNo < 100)
      .sort((a, b) => a.ColSeqNo - b.ColSeqNo),
    [fieldDefs]);

  // Dropdown options lookup keyed by ColName
  const optionsMap = useMemo(() => ({
    ItemTypeID: itemTypeOptions,
    FixedAssetAccountID: fixedAssetAccOptions,
  }), [itemTypeOptions, fixedAssetAccOptions]);

  function renderControl(field) {
    const key = formKey(field.ColName);
    const locked = isMasterFieldLocked(field, { isAddMode, isEditMode });

    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={locked}
        options={optionsMap[field.ColName] || []}
        labelOverrides={DISPLAY_OVERRIDES}
        inputClassName="mgm-form-input"
        valueClassName="mgm-form-value"
        customRender={({ field: f }) => {
          if (READ_ONLY_COLS.has(f.ColName)) {
            return <span className="mgm-form-value">{formValues[key] || "—"}</span>;
          }
          return null;
        }}
      />
    );
  }

  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "UsedCodeInCodeGeneration") {
        next.MainGroupShortCode = getCheckboxValue(value) ? (next.MainGroupCode || "") : "";
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const checkboxCols = visibleFields.filter(isMasterCheckboxField).map((f) => f.ColName);
    const validationErrors = validateMasterFormFields(visibleFields, formValues, {
      keyMap: COL_NAME_MAP,
      skipFields: READ_ONLY_COLS,
      skipMandatoryFor: checkboxCols,
    });

    if (validationErrors.length > 0) {
      alert(validationErrors.join("\n"));
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      const saveRow = { ...formValues };
      visibleFields.forEach((f) => {
        if (!isMasterCheckboxField(f)) return;
        const key = formKey(f.ColName);
        if (key in saveRow) saveRow[key] = getCheckboxValue(saveRow[key]);
      });
      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );
      console.log("%c[MGM Save] Payload:", "color:#f59e0b;font-weight:700", payload);
      await post(MGM_CONFIG.SAVE_ENDPOINT, payload);
      alert("Main Group saved successfully!");
      onSaved?.();
    } catch (err) {
      console.error("[MGM Save] Failed:", err);
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
      if (isAddMode) { onClose(); return; }
      setIsEditMode(false);
      setSaveError(null);
    });
  }, [isAddMode, onClose]);

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? MODAL_TITLE_ADD : MODAL_TITLE_EDIT}
      subtitle={MODAL_SUBTITLE}
      icon={<Tag size={16} strokeWidth={2} />}
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
          <div className="mgm-form">
            {visibleFields.map((field) => (
              <div
                key={field.ColName}
                className={[
                  "mgm-form-row",
                  READ_ONLY_COLS.has(field.ColName) ? "mgm-form-row--view" : "",
                ].join(" ").trim()}
              >
                <span
                  className={`mgm-form-label${isMasterFieldRequired(field, {
                    skipFields: READ_ONLY_COLS,
                  })
                      ? " mgm-form-label--required"
                      : ""
                    }`}
                >
                  {getLabel(field)}
                </span>
                <div
                  className={`mgm-form-control${isMasterCheckboxField(field) ? " mgm-form-control--checkbox" : ""
                    }`}
                >
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
