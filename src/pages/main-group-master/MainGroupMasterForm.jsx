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

// API colname → formValues key (only where they differ)
// Key is the lowercase PG colname returned from the API; value is the internal formValues key
const COL_NAME_MAP = {
  usedinautoitemcodegeneration: "usedcodeincodegen",
};
function formKey(colName) { return COL_NAME_MAP[colName] || colName; }

// Corrected display labels (some API DisplayNames have backend typos)
// Keys are lowercased to match field.colname (PG returns column names in lowercase)
const DISPLAY_OVERRIDES = {
  maingroupshortcode:           "Main Group Short Code",
  maingroupshortname:           "Main Group Short Name",
  usedinautoitemcodegeneration: "Used in Code Generation",
};
function getLabel(field) { return DISPLAY_OVERRIDES[field.colname] || field.displayname; }

// Fields locked during edit mode regardless of API islockoneditmodeallow (all false in API)
const LOCK_ON_EDIT = new Set(["itemtypeid", "maingroupcode", "fixedassetaccountid"]);

function buildEmpty() {
  return {
    idnumber:                 0,
    itemtypeid:               0,
    maingroupcode:            "",
    maingroupname:            "",
    maingroupshortname:       "",
    usedcodeincodegen:        0,
    maingroupshortcode:       "",
    fixedassetaccountid:      0,
    companyid:                DEFAULT_COMPANY_ID,
    yearid:                   MGM_CONFIG.CONFIG_YEAR_ID,
    loginid:                  DEFAULT_LOGIN_ID,
    sessionid:                DEFAULT_SESSION_ID,
    funccode:                 MGM_CONFIG.RB_MASTER,
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

  // Visible fields sorted by colseqno from GetDetailColData response
  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.isvisible && f.colseqno < 100)
      .sort((a, b) => a.colseqno - b.colseqno),
  [fieldDefs]);

  // Dropdown options lookup keyed by colname
  const optionsMap = useMemo(() => ({
    itemtypeid:          itemTypeOptions,
    fixedassetaccountid: fixedAssetAccOptions,
  }), [itemTypeOptions, fixedAssetAccOptions]);

  // Returns true if this field should be non-interactive
  function isLocked(field) {
    if (!isEditMode) return true;
    if (isAddMode)   return false;
    return LOCK_ON_EDIT.has(field.colname);
  }

  // Field value change — includes cascade for maingroupshortcode auto-fill
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
      if (key === "usedcodeincodegen") {
        next.maingroupshortcode = value ? (next.maingroupcode || "") : "";
      }
      return next;
    });
  }, []);

  // Render the right control based on colctrltype from API
  function renderControl(field) {
    const key    = formKey(field.colname);
    const locked = isLocked(field);

    // maingroupshortcode — always read-only, auto-filled from usedcodeincodegen
    if (field.colname === "maingroupshortcode") {
      return (
        <span className="mgm-form-value">{formValues[key] || "—"}</span>
      );
    }

    // usedinautoitemcodegeneration — API says colctrltype 1 (textbox) but renders as checkbox
    if (field.colname === "usedinautoitemcodegeneration") {
      return (
        <div className="mgm-form-control--checkbox">
          <input
            type="checkbox"
            className="mgm-form-checkbox"
            checked={!!formValues[key]}
            onChange={(e) => handleChange(key, e.target.checked ? 1 : 0)}
            disabled={locked}
          />
          <span className="mgm-form-checkbox-label">
            {formValues[key] ? "Yes" : "No"}
          </span>
        </div>
      );
    }

    // colctrltype 4 — Dropdown
    if (field.colctrltype === 4) {
      return (
        <SearchSelect
          value={formValues[key] ? String(formValues[key]) : ""}
          onChange={(val) => handleChange(key, Number(val) || 0)}
          options={optionsMap[field.colname] || []}
          placeholder="Select..."
          disabled={locked}
        />
      );
    }

    // colctrltype 1 — TextBox (default)
    return (
      <input
        className="mgm-form-input"
        type="text"
        value={formValues[key] || ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}...`}
        readOnly={locked}
        tabIndex={locked ? -1 : undefined}
      />
    );
  }

  // Save — validation driven by ismandatory from API
  const handleSave = useCallback(async () => {
    const fieldsToValidate = visibleFields.filter((f) => f.colname !== "maingroupshortcode");
    const normalizedValues = Object.fromEntries(
      fieldsToValidate.map((f) => {
        const val = formValues[formKey(f.colname)];
        return [f.colname, f.colctrltype === 4 && val === 0 ? "" : val];
      })
    );
    const errors = validateApiColumns(normalizedValues, fieldsToValidate);
    if (errors.length > 0) { setFormErrors(errors); return; }

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
          prmStrMstJSON: JSON.stringify([Object.fromEntries(Object.entries(formValues).map(([k, v]) => [k, v]))]),
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
                key={field.colname}
                className={[
                  "mgm-form-row",
                  field.colname === "maingroupshortcode" ? "mgm-form-row--view" : "",
                ].join(" ").trim()}
              >
                <span className={`mgm-form-label${field.ismandatory && field.colname !== "maingroupshortcode" && field.colname !== "usedinautoitemcodegeneration" ? " mgm-form-label--required" : ""}`}>
                  {getLabel(field)}
                </span>
                <div className={`mgm-form-control${field.colname === "usedinautoitemcodegeneration" ? " mgm-form-control--checkbox" : ""}`}>
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
