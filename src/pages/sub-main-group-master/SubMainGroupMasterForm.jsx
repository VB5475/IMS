import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Layers, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SearchSelect from "../../components/ui/SearchSelect";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID, DEFAULT_LOGIN_ID, DEFAULT_SESSION_ID,
  getColDefault, buildSaveRowFromColumns,
} from "../../api/constants";
import { useApi } from "../../api/useApi";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumns } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import { SMGM_CONFIG, MODAL_TITLE_ADD, MODAL_TITLE_EDIT, MODAL_SUBTITLE } from "./constants";

// Fields locked during edit mode (RB colnames — all lowercase)
const LOCK_ON_EDIT = new Set(["itemtypeid", "submaingroupcode", "fixedassetaccountid"]);

// Fields that render as checkbox despite colctrltype=1 (API returns numeric 0/1)
const CHECKBOX_OVERRIDES = new Set(["usedinautoitemcodegeneration", "issrnocontrolreq"]);

// Corrected display labels (guards against backend displayname typos)
const DISPLAY_OVERRIDES = {
  usedinautoitemcodegeneration: "Used in Auto Item Code Gen.",
  issrnocontrolreq:             "Is Sr. No Control Req",
  submaingroupshortcode:        "Sub Main Group Short Code",
  submaingroupshortname:        "Sub Main Group Short Name",
};
function getLabel(field) { return DISPLAY_OVERRIDES[field.colname] || field.displayname; }

export default function SubMainGroupMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  fieldDefs = [], allColumns = [], defsLoading = false, defsError = null,
  itemTypeOptions = [], mainGroupOptions = [], mainGroupLoading = false,
  fixedAssetAccOptions = [],
  fetchMainGroupByItemType, fetchEditRecord, seedOptionsFromMaster,
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
    return {
      ...row,
      yearid:    SMGM_CONFIG.CONFIG_YEAR_ID,
      loginid:   DEFAULT_LOGIN_ID,
      sessionid: DEFAULT_SESSION_ID,
      funccode:  SMGM_CONFIG.RB_MASTER,
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
      yearId:    SMGM_CONFIG.CONFIG_YEAR_ID,
      loginId:   DEFAULT_LOGIN_ID,
      sessionId: DEFAULT_SESSION_ID,
      idNumber:  recordId,
    })
      .then(({ master, headerValues }) => {
        if (!master || !headerValues) { setRecordLoadError("Record not found."); return; }
        seedOptionsFromMaster?.(master);
        setFormValues({ ...buildEmptyFromColumns(), ...headerValues });
        // Cascade: load main group options filtered by the loaded item type
        if (headerValues.itemtypeid) {
          fetchMainGroupByItemType?.(headerValues.itemtypeid);
        }
      })
      .catch((err) => setRecordLoadError(err?.message || "Failed to load record."))
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, seedOptionsFromMaster, fetchMainGroupByItemType, buildEmptyFromColumns]);

  // Visible fields sorted by colseqno from GetDetailColData
  const visibleFields = useMemo(() =>
    fieldDefs
      .filter((f) => f.isvisible && f.colseqno < 100)
      .sort((a, b) => a.colseqno - b.colseqno),
  [fieldDefs]);

  // Dropdown options keyed by RB colname
  const optionsMap = useMemo(() => ({
    itemtypeid:          itemTypeOptions,
    maingroupid:         mainGroupOptions,
    fixedassetaccountid: fixedAssetAccOptions,
  }), [itemTypeOptions, mainGroupOptions, fixedAssetAccOptions]);

  function isLocked(field) {
    if (!isEditMode) return true;
    if (isAddMode)   return false;
    return LOCK_ON_EDIT.has(field.colname);
  }

  // Cascade: itemtypeid → clear maingroupid + reload options
  // Auto-fill: submaingroupcode → submaingroupshortcode
  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "submaingroupcode") {
        next.submaingroupshortcode = value;
      }
      if (key === "itemtypeid") {
        next.maingroupid = 0;
      }
      return next;
    });
    if (key === "itemtypeid") {
      fetchMainGroupByItemType?.(value);
    }
  }, [fetchMainGroupByItemType]);

  function renderControl(field) {
    const key    = field.colname;
    const locked = isLocked(field);

    // Checkbox override — numeric 0/1 stored but rendered as checkbox
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

    // colctrltype 4 — Dropdown
    if (field.colctrltype === 4) {
      const isMainGroup = key === "maingroupid";
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

    // colctrltype 1 — TextBox (default)
    return (
      <input
        className="smgm-form-input"
        type="text"
        value={formValues[key] ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}...`}
        readOnly={locked}
        tabIndex={locked ? -1 : undefined}
      />
    );
  }

  // Validation from RB ismandatory; save row seeded from all RB columns via buildSaveRowFromColumns
  const handleSave = useCallback(async () => {
    const normalizedValues = Object.fromEntries(
      visibleFields.map((f) => [
        f.colname,
        f.colctrltype === 4 && formValues[f.colname] === 0 ? "" : formValues[f.colname],
      ])
    );
    const errors = validateApiColumns(normalizedValues, visibleFields);
    if (errors.length > 0) { setFormErrors(errors); return; }

    setSaveError(null);
    setIsSaving(true);
    try {
      // Complete row with RB-driven defaults for every column, overlaid with form values
      const saveRow = buildSaveRowFromColumns(formValues, allColumns);

      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );
      const result = await post(SMGM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message);
      setFormValues(buildEmptyFromColumns());
      setFormErrors([]);
      setSaveError(null);
      onSaved?.();
    } catch (err) {
      console.error("[SMGM Save] Failed:", err);
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
      icon={<Layers size={16} strokeWidth={2} />}
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
          <div className="smgm-form">
            {visibleFields.map((field) => (
              <div key={field.colname} className="smgm-form-row">
                <span className={`smgm-form-label${field.ismandatory && !CHECKBOX_OVERRIDES.has(field.colname) ? " smgm-form-label--required" : ""}`}>
                  {getLabel(field)}
                </span>
                <div className={`smgm-form-control${CHECKBOX_OVERRIDES.has(field.colname) ? " smgm-form-control--checkbox" : ""}`}>
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
