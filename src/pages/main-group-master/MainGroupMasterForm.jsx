import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Tag, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SearchSelect from "../../components/ui/SearchSelect";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID, DEFAULT_SESSION_ID,
  getColDefault, buildSaveRowFromColumns,
} from "../../api/constants";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumns } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import { MGM_CONFIG, MODAL_TITLE_ADD, MODAL_TITLE_EDIT, MODAL_SUBTITLE } from "./constants";

// Fields locked during edit mode (RB colnames — all lowercase)
const LOCK_ON_EDIT = new Set(["itemtypeid", "maingroupcode", "fixedassetaccountid"]);

// maingroupshortcode is always read-only — auto-filled from usedinautoitemcodegeneration
const READONLY_AUTO = new Set(["maingroupshortcode"]);

// Corrected display labels (guards against backend displayname typos)
const DISPLAY_OVERRIDES = {
  maingroupshortcode:           "Main Group Short Code",
  maingroupshortname:           "Main Group Short Name",
  usedinautoitemcodegeneration: "Used in Code Generation",
};
function getLabel(field) { return DISPLAY_OVERRIDES[field.colname] || field.displayname; }

export default function MainGroupMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], allColumns = [], defsLoading = false, defsError = null,
  itemTypeOptions = [], fixedAssetAccOptions = [],
  fetchEditRecord, seedOptionsFromMaster,
}) {
  const isAddMode = mode === "add";

  const [isEditMode,      setIsEditMode]      = useState(true);
  const [formValues,      setFormValues]      = useState({});
  const [recordLoading,   setRecordLoading]   = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const notify = useNotification();
  const [formErrors,    setFormErrors]    = useState([]);
  const [discardAction, setDiscardAction] = useState(null);

  // Build a blank row seeded from RB column defaults + context fields
  const buildEmptyFromColumns = useCallback(() => {
    const row = {};
    allColumns.forEach(({ key, colDataType }) => {
      row[key] = getColDefault(colDataType);
    });
    return {
      ...row,
      yearid:    MGM_CONFIG.CONFIG_YEAR_ID,
      loginid:   DEFAULT_LOGIN_ID,
      sessionid: DEFAULT_SESSION_ID,
      funccode:  MGM_CONFIG.RB_MASTER,
    };
  }, [allColumns]);

  // Reset form each time modal opens
  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setRecordLoadError(null);
    setFormErrors([]);
    setFormValues(buildEmptyFromColumns());
  }, [isOpen, isAddMode, buildEmptyFromColumns]);

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
        setFormValues({ ...buildEmptyFromColumns(), ...headerValues });
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, seedOptionsFromMaster, buildEmptyFromColumns]);

  // Visible fields sorted by colseqno from GetDetailColData
  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.isvisible && f.colseqno < 100)
      .sort((a, b) => a.colseqno - b.colseqno),
  [fieldDefs]);

  // Dropdown options keyed by RB colname
  const optionsMap = useMemo(() => ({
    itemtypeid:          itemTypeOptions,
    fixedassetaccountid: fixedAssetAccOptions,
  }), [itemTypeOptions, fixedAssetAccOptions]);

  function isLocked(field) {
    if (!isEditMode)                return true;
    if (READONLY_AUTO.has(field.colname)) return true;
    if (isAddMode)                  return false;
    return LOCK_ON_EDIT.has(field.colname);
  }

  // Cascade: usedinautoitemcodegeneration checked → auto-fill maingroupshortcode from maingroupcode
  //          maingroupcode change → keep maingroupshortcode in sync if code-gen is on
  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "usedinautoitemcodegeneration") {
        next.maingroupshortcode = value ? (prev.maingroupcode || "") : "";
      }
      if (key === "maingroupcode" && prev.usedinautoitemcodegeneration) {
        next.maingroupshortcode = value;
      }
      return next;
    });
  }, []);

  function renderControl(field) {
    const key    = field.colname;
    const locked = isLocked(field);

    // maingroupshortcode — always a read-only display value
    if (READONLY_AUTO.has(key)) {
      return <span className="mgm-form-value">{formValues[key] || "—"}</span>;
    }

    // usedinautoitemcodegeneration — numeric 0/1 stored but rendered as checkbox
    if (key === "usedinautoitemcodegeneration") {
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
          options={optionsMap[key] || []}
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
        value={formValues[key] ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}...`}
        readOnly={locked}
        tabIndex={locked ? -1 : undefined}
      />
    );
  }

  // Validation from RB ismandatory; save row seeded from all RB columns
  const handleSave = useCallback(async () => {
    // Skip maingroupshortcode in validation — it's auto-filled, not user-entered
    const fieldsToValidate = visibleFields.filter((f) => !READONLY_AUTO.has(f.colname));
    const normalizedValues = Object.fromEntries(
      fieldsToValidate.map((f) => [
        f.colname,
        f.colctrltype === 4 && formValues[f.colname] === 0 ? "" : formValues[f.colname],
      ])
    );
    const errors = validateApiColumns(normalizedValues, fieldsToValidate);
    if (errors.length > 0) { setFormErrors(errors); return; }

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
      const res    = await fetch(`${API_BASE_URL_IMS}${MGM_CONFIG.SAVE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.message || `HTTP ${res.status}`);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message);
      setFormValues(buildEmptyFromColumns());
      setFormErrors([]);
      setSaveError(null);
      onSaved?.();
    } catch (err) {
      console.error("[MGM Save] Failed:", err);
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
                  READONLY_AUTO.has(field.colname) ? "mgm-form-row--view" : "",
                ].join(" ").trim()}
              >
                <span className={`mgm-form-label${field.ismandatory && !READONLY_AUTO.has(field.colname) && field.colname !== "usedinautoitemcodegeneration" ? " mgm-form-label--required" : ""}`}>
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
