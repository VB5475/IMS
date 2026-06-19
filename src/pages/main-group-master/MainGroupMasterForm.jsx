import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Tag, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import SearchSelect from "../../components/ui/SearchSelect";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID, DEFAULT_SESSION_ID,
} from "../../api/constants";
import { withSaveContextFields } from "../../utils/savePayload";
import { MGM_CONFIG } from "./constants";

// API ColName → formValues key (only where they differ)
const COL_NAME_MAP = {
  UsedInAutoItemCodeGeneration: "UsedCodeInCodeGeneration",
};
function formKey(colName) { return COL_NAME_MAP[colName] || colName; }

// Corrected display labels (some API DisplayNames have backend typos)
const DISPLAY_OVERRIDES = {
  MainGroupShortCode:           "Main Group Short Code",
  MainGroupShortName:           "Main Group Short Name",
  UsedInAutoItemCodeGeneration: "Used in Code Generation",
};
function getLabel(field) { return DISPLAY_OVERRIDES[field.ColName] || field.DisplayName; }

// Fields locked during edit mode regardless of API IsLockOnEditModeAllow (all false in API)
const LOCK_ON_EDIT = new Set(["ItemTypeID", "MainGroupCode", "FixedAssetAccountID"]);

function buildEmpty() {
  return {
    IDNumber:                 0,
    ItemTypeID:               0,
    MainGroupCode:            "",
    MainGroupName:            "",
    MainGroupShortName:       "",
    UsedCodeInCodeGeneration: false,
    MainGroupShortCode:       "",
    FixedAssetAccountID:      0,
    CompanyID:                DEFAULT_COMPANY_ID,
    YearID:                   MGM_CONFIG.CONFIG_YEAR_ID,
    LoginID:                  DEFAULT_LOGIN_ID,
    SessionID:                DEFAULT_SESSION_ID,
    FuncCode:                 MGM_CONFIG.RB_MASTER,
  };
}

export default function MainGroupMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], defsLoading = false, defsError = null,
  itemTypeOptions = [], fixedAssetAccOptions = [],
  fetchEditRecord, seedOptionsFromMaster,
}) {
  const isAddMode = mode === "add";

  const [isEditMode,      setIsEditMode]      = useState(true);
  const [formValues,      setFormValues]      = useState(buildEmpty());
  const [recordLoading,   setRecordLoading]   = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState(null);

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
      yearId:    MGM_CONFIG.CONFIG_YEAR_ID,
      loginId:   DEFAULT_LOGIN_ID,
      sessionId: DEFAULT_SESSION_ID,
      idNumber:  recordId,
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
    ItemTypeID:          itemTypeOptions,
    FixedAssetAccountID: fixedAssetAccOptions,
  }), [itemTypeOptions, fixedAssetAccOptions]);

  // Returns true if this field should be non-interactive
  function isLocked(field) {
    if (!isEditMode) return true;
    if (isAddMode)   return false;
    return LOCK_ON_EDIT.has(field.ColName);
  }

  // Field value change — includes cascade for MainGroupShortCode auto-fill
  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "UsedCodeInCodeGeneration") {
        next.MainGroupShortCode = value ? (next.MainGroupCode || "") : "";
      }
      return next;
    });
  }, []);

  // Render the right control based on ColCtrlType from API
  function renderControl(field) {
    const key    = formKey(field.ColName);
    const locked = isLocked(field);

    // MainGroupShortCode — always read-only, auto-filled from UsedCodeInCodeGeneration
    if (field.ColName === "MainGroupShortCode") {
      return (
        <span className="mgm-form-value">{formValues[key] || "—"}</span>
      );
    }

    // UsedInAutoItemCodeGeneration — API says ColCtrlType 1 (textbox) but renders as checkbox
    if (field.ColName === "UsedInAutoItemCodeGeneration") {
      return (
        <div className="mgm-form-control--checkbox">
          <input
            type="checkbox"
            className="mgm-form-checkbox"
            checked={!!formValues[key]}
            onChange={(e) => handleChange(key, e.target.checked)}
            disabled={locked}
          />
          <span className="mgm-form-checkbox-label">
            {formValues[key] ? "Yes" : "No"}
          </span>
        </div>
      );
    }

    // ColCtrlType 4 — Dropdown
    if (field.ColCtrlType === 4) {
      return (
        <SearchSelect
          value={formValues[key] ? String(formValues[key]) : ""}
          onChange={(val) => handleChange(key, Number(val) || 0)}
          options={optionsMap[field.ColName] || []}
          placeholder="Select..."
          disabled={locked}
        />
      );
    }

    // ColCtrlType 1 — TextBox (default)
    return (
      <input
        className="mgm-form-input"
        type="text"
        value={formValues[key] || ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}...`}
        readOnly={locked}
      />
    );
  }

  // Save — validation driven by IsMandatory from API
  const handleSave = useCallback(async () => {
    const missing = visibleFields
      .filter((f) => {
        if (!f.IsMandatory) return false;
        if (f.ColName === "MainGroupShortCode")           return false; // auto-fill
        if (f.ColName === "UsedInAutoItemCodeGeneration") return false; // checkbox false is valid
        const val = formValues[formKey(f.ColName)];
        return f.ColCtrlType === 4 ? (!val || val === 0) : !String(val || "").trim();
      })
      .map(getLabel);

    if (missing.length > 0) {
      alert(`Please fill in required fields:\n${missing.join("\n")}`);
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([{ ...formValues }]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );
      console.log("%c[MGM Save] Payload:", "color:#f59e0b;font-weight:700", payload);
      const res    = await fetch(`${API_BASE_URL_IMS}${MGM_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("Main Group saved successfully!");
      onSaved?.();
    } catch (err) {
      console.error("[MGM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, isAddMode, onSaved]);

  const handleClose = useCallback(() => {
    if (isEditMode && !window.confirm("Discard changes?")) return;
    onClose();
  }, [isEditMode, onClose]);

  const handleCancelEdit = useCallback(() => {
    if (!window.confirm("Discard changes?")) return;
    if (isAddMode) { onClose(); return; }
    setIsEditMode(false);
    setSaveError(null);
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

  const isLoading    = defsLoading || recordLoading;
  const combinedErr  = defsError   || recordLoadError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? "New Main Group" : "Edit Main Group"}
      subtitle="Admin › Master › Item › Main Group Master"
      icon={<Tag size={16} strokeWidth={2} />}
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
          <div className="mgm-form">
            {visibleFields.map((field) => (
              <div
                key={field.ColName}
                className={[
                  "mgm-form-row",
                  field.ColName === "MainGroupShortCode" ? "mgm-form-row--view" : "",
                ].join(" ").trim()}
              >
                <span className={`mgm-form-label${field.IsMandatory && field.ColName !== "MainGroupShortCode" && field.ColName !== "UsedInAutoItemCodeGeneration" ? " mgm-form-label--required" : ""}`}>
                  {getLabel(field)}
                </span>
                <div className={`mgm-form-control${field.ColName === "UsedInAutoItemCodeGeneration" ? " mgm-form-control--checkbox" : ""}`}>
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
