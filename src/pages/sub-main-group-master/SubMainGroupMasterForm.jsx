import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Layers, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import SearchSelect from "../../components/ui/SearchSelect";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID, DEFAULT_SESSION_ID,
} from "../../api/constants";
import { withSaveContextFields } from "../../utils/savePayload";
import { SMGM_CONFIG } from "./constants";

// Fields locked during edit mode (per MRD lock-on-edit spec)
const LOCK_ON_EDIT = new Set(["ItemTypeID", "SubMainGroupCode", "FixedAssetAccountID"]);

// Fields that render as checkbox despite API returning ColCtrlType 1 (textbox)
const CHECKBOX_OVERRIDES = new Set(["UsedInAutoItemCodeGeneration", "ISSrnoControlReq"]);

// Corrected display labels (guards against backend DisplayName typos)
const DISPLAY_OVERRIDES = {
  UsedInAutoItemCodeGeneration: "Used in Auto Item Code Gen.",
  ISSrnoControlReq:             "Is Sr. No Control Req",
  SubMainGroupShortCode:        "Sub Main Group Short Code",
  SubMainGroupShortName:        "Sub Main Group Short Name",
};
function getLabel(field) { return DISPLAY_OVERRIDES[field.ColName] || field.DisplayName; }

function buildEmpty() {
  return {
    IDNumber:                     0,
    ItemTypeID:                   0,
    MainGroupID:                  0,
    SubMainGroupCode:             "",
    SubMainGroupName:             "",
    SubMainGroupShortName:        "",
    UsedInAutoItemCodeGeneration: 0,
    SubMainGroupShortCode:        "",
    ISSrnoControlReq:             0,
    FixedAssetAccountID:          0,
    CompanyID:                    DEFAULT_COMPANY_ID,
    YearID:                       SMGM_CONFIG.CONFIG_YEAR_ID,
    LoginID:                      DEFAULT_LOGIN_ID,
    SessionID:                    DEFAULT_SESSION_ID,
    FuncCode:                     SMGM_CONFIG.RB_MASTER,
  };
}

export default function SubMainGroupMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], defsLoading = false, defsError = null,
  itemTypeOptions = [], mainGroupOptions = [], mainGroupLoading = false,
  fixedAssetAccOptions = [],
  fetchMainGroupByItemType, fetchEditRecord, seedOptionsFromMaster,
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
      yearId:    SMGM_CONFIG.CONFIG_YEAR_ID,
      loginId:   DEFAULT_LOGIN_ID,
      sessionId: DEFAULT_SESSION_ID,
      idNumber:  recordId,
    })
      .then(({ master, headerValues }) => {
        if (!master || !headerValues) { setRecordLoadError("Record not found."); return; }
        seedOptionsFromMaster?.(master);
        setFormValues({ ...buildEmpty(), ...headerValues });
        // Load main group options filtered by the loaded ItemTypeID
        if (headerValues.ItemTypeID) {
          fetchMainGroupByItemType?.(headerValues.ItemTypeID);
        }
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, seedOptionsFromMaster, fetchMainGroupByItemType]);

  // Visible fields sorted by ColSeqNo
  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.IsVisible && f.ColSeqNo < 100)
      .sort((a, b) => a.ColSeqNo - b.ColSeqNo),
  [fieldDefs]);

  // Dropdown options lookup keyed by ColName
  const optionsMap = useMemo(() => ({
    ItemTypeID:          itemTypeOptions,
    MainGroupID:         mainGroupOptions,
    FixedAssetAccountID: fixedAssetAccOptions,
  }), [itemTypeOptions, mainGroupOptions, fixedAssetAccOptions]);

  function isLocked(field) {
    if (!isEditMode) return true;
    if (isAddMode)   return false;
    return LOCK_ON_EDIT.has(field.ColName);
  }

  // Cascade: ItemTypeID change → clear MainGroup + reload options
  //          SubMainGroupCode change → auto-fill SubMainGroupShortCode
  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "SubMainGroupCode") {
        next.SubMainGroupShortCode = value;
      }
      if (key === "ItemTypeID") {
        next.MainGroupID = 0;
      }
      return next;
    });
    if (key === "ItemTypeID") {
      fetchMainGroupByItemType?.(value);
    }
  }, [fetchMainGroupByItemType]);

  function renderControl(field) {
    const key    = field.ColName;
    const locked = isLocked(field);

    // Checkbox override — API returns ColCtrlType 1 for these fields
    if (CHECKBOX_OVERRIDES.has(key)) {
      return (
        <div className="smgm-form-control--checkbox">
          <input
            type="checkbox"
            className="smgm-form-checkbox"
            checked={!!formValues[key]}
            onChange={(e) => handleChange(key, e.target.checked ? 1 : 0)}
            disabled={locked}
          />
          <span className="smgm-form-checkbox-label">
            {formValues[key] ? "Yes" : "No"}
          </span>
        </div>
      );
    }

    // ColCtrlType 4 — Dropdown
    if (field.ColCtrlType === 4) {
      const isMainGroup = key === "MainGroupID";
      return (
        <SearchSelect
          value={formValues[key] ? String(formValues[key]) : ""}
          onChange={(val) => handleChange(key, Number(val) || 0)}
          options={optionsMap[key] || []}
          placeholder={isMainGroup && mainGroupLoading ? "Loading…" : "Select..."}
          disabled={locked || (isMainGroup && mainGroupLoading)}
        />
      );
    }

    // ColCtrlType 1 — TextBox (default; SubMainGroupShortCode is editable auto-fill)
    return (
      <input
        className="smgm-form-input"
        type="text"
        value={formValues[key] || ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}...`}
        readOnly={locked}
      />
    );
  }

  // Validation driven by IsMandatory from API
  const handleSave = useCallback(async () => {
    const missing = visibleFields
      .filter((f) => {
        if (!f.IsMandatory) return false;
        if (CHECKBOX_OVERRIDES.has(f.ColName)) return false;
        const val = formValues[f.ColName];
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
      console.log("%c[SMGM Save] Payload:", "color:#f59e0b;font-weight:700", payload);
      const res    = await fetch(`${API_BASE_URL_IMS}${SMGM_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      alert("Sub Main Group saved successfully!");
      onSaved?.();
    } catch (err) {
      console.error("[SMGM Save] Failed:", err);
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

  const isLoading   = defsLoading || recordLoading;
  const combinedErr = defsError   || recordLoadError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? "New Sub Main Group" : "Edit Sub Main Group"}
      subtitle="Admin › Master › Item › Sub Main Group Master"
      icon={<Layers size={16} strokeWidth={2} />}
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
          <div className="smgm-form">
            {visibleFields.map((field) => (
              <div key={field.ColName} className="smgm-form-row">
                <span className={`smgm-form-label${field.IsMandatory && !CHECKBOX_OVERRIDES.has(field.ColName) ? " smgm-form-label--required" : ""}`}>
                  {getLabel(field)}
                </span>
                <div className={`smgm-form-control${CHECKBOX_OVERRIDES.has(field.ColName) ? " smgm-form-control--checkbox" : ""}`}>
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
