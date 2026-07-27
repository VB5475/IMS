import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Tag, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SearchSelect from "../../components/ui/SearchSelect";
import {
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  getColDefault, buildSaveRowFromColumns,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumns } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import { MGM_CONFIG, MODAL_TITLE_ADD, MODAL_TITLE_EDIT, MODAL_SUBTITLE } from "./constants";
import "./MainGroupMasterPage.css";

// Compare against RB colnames case-insensitively (API now returns PascalCase).
const LOCK_ON_EDIT = new Set(["itemtypeid", "maingroupcode", "fixedassetaccountid"]);

// MainGroupShortCode is always read-only — auto-filled from UsedInAutoItemCodeGeneration
const READONLY_AUTO = new Set(["maingroupshortcode"]);

const DISPLAY_OVERRIDES = {
  maingroupshortcode: "Main Group Short Code",
  maingroupshortname: "Main Group Short Name",
  usedinautoitemcodegeneration: "Used in Code Generation",
};

function colKey(name) {
  return String(name || "").toLowerCase();
}

function getLabel(field) {
  return DISPLAY_OVERRIDES[colKey(field.colname)] || field.displayname;
}

function pickFormValue(values, ...keys) {
  if (!values) return undefined;
  for (const key of keys) {
    if (values[key] !== undefined && values[key] !== null) return values[key];
    const found = Object.keys(values).find((k) => colKey(k) === colKey(key));
    if (found !== undefined) return values[found];
  }
  return undefined;
}

function setFormKey(values, key, value) {
  const existing = Object.keys(values).find((k) => colKey(k) === colKey(key));
  return { ...values, [existing || key]: value };
}

export default function MainGroupMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], allColumns = [], defsLoading = false, defsError = null,
  itemTypeOptions = [], fixedAssetAccOptions = [],
  fetchEditRecord, seedOptionsFromMaster,
}) {
  const isAddMode = mode === "add";
  const { post } = useApi(API_BASE_URL_IMS);

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
    const session = getUserSession();
    return {
      ...row,
      yearid:    session.yearId,
      loginid:   session.loginId,
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
    const session = getUserSession();
    fetchEditRecord({
      companyId: session.companyId,
      yearId:    session.yearId,
      loginId:   session.loginId,
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

  // Dropdown options keyed by lowercase RB colname (API may return PascalCase)
  const optionsMap = useMemo(() => ({
    itemtypeid: itemTypeOptions,
    fixedassetaccountid: fixedAssetAccOptions,
  }), [itemTypeOptions, fixedAssetAccOptions]);

  function resolveOptions(fieldName) {
    return optionsMap[colKey(fieldName)] || [];
  }

  function isLocked(field) {
    const key = colKey(field.colname);
    if (!isEditMode) return true;
    if (READONLY_AUTO.has(key)) return true;
    if (isAddMode) return false;
    return LOCK_ON_EDIT.has(key);
  }

  // Cascade: UsedInAutoItemCodeGeneration checked → auto-fill MainGroupShortCode from MainGroupCode
  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => {
      let next = setFormKey(prev, key, value);
      const lowered = colKey(key);
      if (lowered === "usedinautoitemcodegeneration") {
        const code = pickFormValue(next, "MainGroupCode", "maingroupcode") || "";
        next = setFormKey(next, "MainGroupShortCode", value ? code : "");
      }
      if (lowered === "maingroupcode") {
        const codeGenOn = !!pickFormValue(next, "UsedInAutoItemCodeGeneration", "usedinautoitemcodegeneration");
        if (codeGenOn) next = setFormKey(next, "MainGroupShortCode", value);
      }
      return next;
    });
  }, []);

  function renderControl(field) {
    const key = field.colname;
    const lowered = colKey(key);
    const locked = isLocked(field);
    const currentValue = pickFormValue(formValues, key);

    // MainGroupShortCode — always a read-only display value
    if (READONLY_AUTO.has(lowered)) {
      return <span className="mgm-form-value">{currentValue || "—"}</span>;
    }

    // UsedInAutoItemCodeGeneration — numeric 0/1 stored but rendered as checkbox
    if (lowered === "usedinautoitemcodegeneration") {
      return (
        <div className="mgm-form-control--checkbox">
          <input
            type="checkbox"
            className="mgm-form-checkbox"
            checked={!!currentValue}
            onChange={(e) => handleChange(key, e.target.checked ? 1 : 0)}
            disabled={locked}
          />
          <span className="mgm-form-checkbox-label">
            {currentValue ? "Yes" : "No"}
          </span>
        </div>
      );
    }

    // colctrltype 4 — Dropdown
    if (Number(field.colctrltype) === 4) {
      const options = resolveOptions(key);
      return (
        <SearchSelect
          value={currentValue ? String(currentValue) : ""}
          onChange={(val) => handleChange(key, Number(val) || 0)}
          options={options}
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
        value={currentValue ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}...`}
        readOnly={locked}
        tabIndex={locked ? -1 : undefined}
      />
    );
  }

  // Validation from RB ismandatory; save row seeded from all RB columns
  const handleSave = useCallback(async () => {
    // Skip MainGroupShortCode in validation — it's auto-filled, not user-entered
    const fieldsToValidate = visibleFields.filter((f) => !READONLY_AUTO.has(colKey(f.colname)));
    const normalizedValues = Object.fromEntries(
      fieldsToValidate.map((f) => {
        const value = pickFormValue(formValues, f.colname);
        return [
          f.colname,
          Number(f.colctrltype) === 4 && (value === 0 || value === "0") ? "" : value,
        ];
      })
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
      const result = await post(MGM_CONFIG.SAVE_ENDPOINT, payload);
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
  }, [visibleFields, formValues, allColumns, isAddMode, onSaved, notify, post, buildEmptyFromColumns]);

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
            {visibleFields.map((field) => {
              const lowered = colKey(field.colname);
              return (
              <div
                key={field.colname}
                className={[
                  "mgm-form-row",
                  READONLY_AUTO.has(lowered) ? "mgm-form-row--view" : "",
                ].join(" ").trim()}
              >
                <span className={`mgm-form-label${field.ismandatory && !READONLY_AUTO.has(lowered) && lowered !== "usedinautoitemcodegeneration" ? " mgm-form-label--required" : ""}`}>
                  {getLabel(field)}
                </span>
                <div className={`mgm-form-control${lowered === "usedinautoitemcodegeneration" ? " mgm-form-control--checkbox" : ""}`}>
                  {renderControl(field)}
                </div>
              </div>
              );
            })}
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
