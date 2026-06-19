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
import "../../components/masters/master-form-panel.css";

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

  // Field change — handles cascade for MainGroupShortCode auto-fill
  const handleChange = useCallback((field, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "UsedCodeInCodeGeneration") {
        next.MainGroupShortCode = value ? (next.MainGroupCode || "") : "";
      }
      return next;
    });
  }, []);

  // Returns true if the field should be non-editable
  const isLocked = (lockOnEditMode = false) => {
    if (!isEditMode) return true;
    if (isAddMode)   return false;
    return lockOnEditMode;
  };

  // Save
  const handleSave = useCallback(async () => {
    const missing = [];
    if (!formValues.ItemTypeID || formValues.ItemTypeID === 0) missing.push("Item Type");
    if (!formValues.MainGroupCode?.trim())                     missing.push("Main Group Code");
    if (!formValues.MainGroupName?.trim())                     missing.push("Main Group Name");
    if (!formValues.MainGroupShortName?.trim())                missing.push("Main Group Short Name");
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
  }, [formValues, isAddMode, onSaved]);

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
      {recordLoading ? (
        <div className="master-modal-loader">Loading…</div>
      ) : recordLoadError ? (
        <div className="master-modal-error">
          <AlertCircle size={14} strokeWidth={2} /> {recordLoadError}
        </div>
      ) : (
        <>
          <div className="mgm-form">

            <div className="mgm-form-row">
              <span className="mgm-form-label mgm-form-label--required">Item Type</span>
              <div className="mgm-form-control">
                <SearchSelect
                  value={formValues.ItemTypeID ? String(formValues.ItemTypeID) : ""}
                  onChange={(val) => handleChange("ItemTypeID", Number(val) || 0)}
                  options={itemTypeOptions}
                  placeholder="Select..."
                  disabled={isLocked(true)}
                />
              </div>
            </div>

            <div className="mgm-form-row">
              <span className="mgm-form-label mgm-form-label--required">Main Group Code</span>
              <div className="mgm-form-control">
                <input
                  className="mgm-form-input"
                  type="text"
                  value={formValues.MainGroupCode}
                  onChange={(e) => handleChange("MainGroupCode", e.target.value)}
                  placeholder="Enter Main Group Code..."
                  readOnly={isLocked(true)}
                />
              </div>
            </div>

            <div className="mgm-form-row">
              <span className="mgm-form-label mgm-form-label--required">Main Group Name</span>
              <div className="mgm-form-control">
                <input
                  className="mgm-form-input"
                  type="text"
                  value={formValues.MainGroupName}
                  onChange={(e) => handleChange("MainGroupName", e.target.value)}
                  placeholder="Enter Main Group Name..."
                  readOnly={isLocked(false)}
                />
              </div>
            </div>

            <div className="mgm-form-row">
              <span className="mgm-form-label mgm-form-label--required">Main Group Short Name</span>
              <div className="mgm-form-control">
                <input
                  className="mgm-form-input"
                  type="text"
                  value={formValues.MainGroupShortName}
                  onChange={(e) => handleChange("MainGroupShortName", e.target.value)}
                  placeholder="Enter Main Group Short Name..."
                  readOnly={isLocked(false)}
                />
              </div>
            </div>

            <div className="mgm-form-row">
              <span className="mgm-form-label">Used in Code Generation</span>
              <div className="mgm-form-control mgm-form-control--checkbox">
                <input
                  type="checkbox"
                  className="mgm-form-checkbox"
                  checked={!!formValues.UsedCodeInCodeGeneration}
                  onChange={(e) => handleChange("UsedCodeInCodeGeneration", e.target.checked)}
                  disabled={isLocked(false)}
                />
                <span className="mgm-form-checkbox-label">
                  {formValues.UsedCodeInCodeGeneration ? "Yes" : "No"}
                </span>
              </div>
            </div>

            {/* Always read-only — auto-filled from UsedCodeInCodeGeneration */}
            <div className="mgm-form-row mgm-form-row--view">
              <span className="mgm-form-label">Main Group Short Code</span>
              <div className="mgm-form-control">
                <span className="mgm-form-value">
                  {formValues.MainGroupShortCode || "—"}
                </span>
              </div>
            </div>

            <div className="mgm-form-row">
              <span className="mgm-form-label">Fixed Assets Account</span>
              <div className="mgm-form-control">
                <SearchSelect
                  value={formValues.FixedAssetAccountID ? String(formValues.FixedAssetAccountID) : ""}
                  onChange={(val) => handleChange("FixedAssetAccountID", Number(val) || 0)}
                  options={fixedAssetAccOptions}
                  placeholder="Select..."
                  disabled={isLocked(true)}
                />
              </div>
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
