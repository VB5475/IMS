import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FileStack, Save, Pencil, AlertCircle } from "lucide-react";
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
import { DOCSUBTYPE_CONFIG } from "./constants";
import "./DocumentSubTypeMasterPage.css";

function buildSaveContext() {
  const session = getUserSession();
  return {
    companyid: session.companyId,
    yearid: session.yearId,
    loginid: session.loginId,
    sessionid: DEFAULT_SESSION_ID,
    funccode: DOCSUBTYPE_CONFIG.RB_MASTER,
  };
}

export default function DocumentSubTypeMasterForm({
  isOpen,
  mode,
  onClose,
  onSaved,
  fieldDefs = [],
  defsLoading = false,
  defsError = null,
  departmentOptions = [],
  documentTypeOptions = [],
  onDepartmentChange,
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
  const dropdownOptions = useMemo(
    () => ({ departmentid: departmentOptions, documenttypeid: documentTypeOptions }),
    [departmentOptions, documentTypeOptions]
  );

  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setFormErrors([]);
    setFieldErrors({});
    setFieldValidationFailed(false);
    const empty = buildMasterFormEmpty(fieldDefs, buildSaveContext());
    let deptId = 0;
    if (isAddMode) {
      setFormValues(empty);
    } else if (editPrefill?.headerValues) {
      setFormValues({ ...empty, ...editPrefill.headerValues });
      deptId = editPrefill.headerValues.departmentid;
    }
    // Document Type cascades off Department — (re)fetch its options for
    // whatever Department this form opened with (0 clears them for Add mode).
    onDepartmentChange?.(deptId);
  }, [isOpen, isAddMode, editPrefill, fieldDefs, onDepartmentChange]);

  const handleChange = useCallback(
    (key, value) => {
      setFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setFormValues((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "departmentid") {
          // Stale Document Type from the previous Department no longer applies.
          next.documenttypeid = 0;
        }
        return next;
      });
      if (key === "departmentid") {
        onDepartmentChange?.(value);
      }
    },
    [onDepartmentChange]
  );

  function renderControl(field) {
    const key = field.ColName;
    const needsDepartmentFirst = key === "documenttypeid" && !formValues.departmentid;
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={isMasterFieldLocked(field, { isAddMode, isEditMode })}
        options={dropdownOptions[key] || []}
        placeholder={needsDepartmentFirst ? "Select Department first" : undefined}
        inputClassName="docsubtype-form-input"
        valueClassName="docsubtype-form-value"
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
        buildSaveJsonFields({ label: DOCSUBTYPE_CONFIG.FORM_TAG, mst: mstRow }),
        { divisionId: 0, isEdit: !isAddMode }
      );

      const result = await post(DOCSUBTYPE_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setSaveError(message);
        return false;
      }
      notify.success(message || "Document SubType saved successfully!");
      onSaved?.();
      return true;
    } catch (err) {
      console.error("[DocSubType Save] Failed:", err);
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
        <button type="button" className="master-modal-btn master-modal-btn--cancel" onClick={handleCancelEdit} disabled={isSaving}>
          Cancel
        </button>
        <button type="button" className="master-modal-btn master-modal-btn--save" onClick={handleSave} disabled={isSaving}>
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
      title={isAddMode ? "New Document SubType" : "Edit Document SubType"}
      subtitle="Admin › DMS › Document SubType Master"
      icon={<FileStack size={16} strokeWidth={2} />}
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
          <div className="docsubtype-form-scroll">
            <div className="docsubtype-form">
              {visibleFields.map((field) => (
                <div key={field.ColName} className="docsubtype-form-row">
                  <span className={`docsubtype-form-label${isMasterFieldRequired(field) ? " docsubtype-form-label--required" : ""}`}>
                    {getMasterFieldLabel(field)}
                  </span>
                  <div className="docsubtype-form-control">{renderControl(field)}</div>
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
