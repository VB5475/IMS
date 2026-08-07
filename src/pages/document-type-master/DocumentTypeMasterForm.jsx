import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterFormField from "../../components/forms/MasterFormField";
import { API_BASE_URL_IMS, DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { useNotification } from "../../context/NotificationContext";
import {
  buildMasterFormEmpty,
  finalizeMasterHeaderSaveRow,
  getMasterFieldLabel,
  getVisibleHeaderFields,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterFieldRequired,
  isMasterToggleField,
  validateMasterFormFieldsByField,
} from "../../utils/masterFormUtils";
import { DOCTYPE_CONFIG } from "./constants";
import "./DocumentTypeMasterPage.css";

function buildSaveContext() {
  const session = getUserSession();
  return {
    companyid: session.companyId,
    yearid: session.yearId,
    loginid: session.loginId,
    sessionid: DEFAULT_SESSION_ID,
    funccode: DOCTYPE_CONFIG.RB_MASTER,
  };
}

export default function DocumentTypeMasterForm({
  isOpen,
  mode,
  onClose,
  onSaved,
  fieldDefs = [],
  defsLoading = false,
  defsError = null,
  departmentOptions = [],
  editPrefill = null,
  recordLoading = false,
  recordLoadError = null,
}) {
  const isAddMode = mode === "add";
  const { post } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState(() => buildMasterFormEmpty(fieldDefs, buildSaveContext()));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldValidationFailed, setFieldValidationFailed] = useState(false);
  const [discardAction, setDiscardAction] = useState(null);

  const visibleFields = useMemo(() => getVisibleHeaderFields(fieldDefs), [fieldDefs]);
  const dropdownOptions = useMemo(() => ({ departmentid: departmentOptions }), [departmentOptions]);

  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setFormErrors([]);
    setFieldErrors({});
    setFieldValidationFailed(false);
    const empty = buildMasterFormEmpty(fieldDefs, buildSaveContext());
    if (isAddMode) {
      setFormValues(empty);
    } else if (editPrefill?.headerValues) {
      setFormValues({ ...empty, ...editPrefill.headerValues });
    }
  }, [isOpen, isAddMode, editPrefill, fieldDefs]);

  const handleChange = useCallback((key, value) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  function renderControl(field) {
    const key = field.ColName;
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={isMasterFieldLocked(field, { isAddMode, isEditMode })}
        options={dropdownOptions[key] || []}
        inputClassName="doctype-form-input"
        valueClassName="doctype-form-value"
        error={fieldErrors[key]}
      />
    );
  }

  const handleSave = useCallback(async () => {
    setFieldValidationFailed(false);
    const fieldErrorMap = validateMasterFormFieldsByField(visibleFields, formValues, {
      skipMandatoryFor: new Set(
        visibleFields.filter((f) => isMasterToggleField(f) || isMasterCheckboxField(f)).map((f) => f.ColName)
      ),
    });
    setFieldErrors(fieldErrorMap);

    if (Object.keys(fieldErrorMap).length > 0) {
      setFieldValidationFailed(true);
      setFormErrors([]);
      return false;
    }

    setFormErrors([]);
    setSaveError(null);
    setIsSaving(true);
    try {
      const mstRow = finalizeMasterHeaderSaveRow(fieldDefs, formValues, { fieldsToFinalize: visibleFields });

      const payload = withSaveContextFields(
        buildSaveJsonFields({ label: DOCTYPE_CONFIG.FORM_TAG, mst: mstRow }),
        { divisionId: 0, isEdit: !isAddMode }
      );

      const result = await post(DOCTYPE_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setSaveError(message);
        return false;
      }
      notify.success(message || "Document Type saved successfully!");
      onSaved?.();
      return true;
    } catch (err) {
      console.error("[DocType Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, fieldDefs, isAddMode, onSaved, post, notify]);

  const handleDiscardConfirm = useCallback(() => {
    const action = discardAction;
    setDiscardAction(null);
    if (action === "close") {
      onClose();
    } else if (isAddMode) {
      onClose();
    } else {
      setIsEditMode(false);
      setSaveError(null);
    }
  }, [discardAction, isAddMode, onClose]);

  const handleClose = useCallback(() => {
    if (!isEditMode) {
      onClose();
      return;
    }
    setDiscardAction("close");
  }, [isEditMode, onClose]);

  const handleCancelEdit = useCallback(() => setDiscardAction("cancel"), []);

  const footer = useMemo(() => {
    if (!isEditMode) {
      return (
        <button type="button" className="master-modal-btn master-modal-btn--edit" onClick={() => setIsEditMode(true)}>
          <Pencil size={13} strokeWidth={2} /> Edit
        </button>
      );
    }
    return (
      <div className="master-modal-footer-actions">
        <button type="button" className="master-modal-btn master-modal-btn--save" onClick={handleSave} disabled={isSaving}>
          <Save size={13} strokeWidth={2} />
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="master-modal-btn master-modal-btn--cancel" onClick={handleCancelEdit} disabled={isSaving}>
          Cancel
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
      title={isAddMode ? "New Document Type" : "Edit Document Type"}
      subtitle="Admin › DMS › Document Type Master"
      icon={<FileText size={16} strokeWidth={2} />}
      size="md"
      variant="enterprise"
      footer={footer}
    >
      <ConfirmDialog
        isOpen={discardAction !== null}
        message="Discard changes?"
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
          <AlertPanel
            errors={formErrors}
            title={fieldValidationFailed ? "Please fix the highlighted field(s) below." : undefined}
            onDismiss={() => setFormErrors([])}
          />
          <div className="doctype-form-scroll">
            <div className="doctype-form">
              {visibleFields.map((field) => (
                <div key={field.ColName} className="doctype-form-row">
                  <span className={`doctype-form-label${isMasterFieldRequired(field) ? " doctype-form-label--required" : ""}`}>
                    {getMasterFieldLabel(field)}
                  </span>
                  <div className="doctype-form-control">{renderControl(field)}</div>
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
