import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeftRight, Save, Pencil, AlertCircle } from "lucide-react";
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
  validateMasterFormFields,
} from "../../utils/masterFormUtils";
import { TT2DOCTYPE_CONFIG, IS_ACTIVE_OPTIONS } from "./constants";
import "./DMTT2DocTypeMasterPage.css";

function buildSaveContext() {
  const session = getUserSession();
  return {
    companyid: session.companyId,
    yearid: session.yearId,
    loginid: session.loginId,
    sessionid: DEFAULT_SESSION_ID,
    funccode: TT2DOCTYPE_CONFIG.RB_MASTER,
  };
}

export default function DMTT2DocTypeMasterForm({
  isOpen,
  mode,
  onClose,
  onSaved,
  fieldDefs = [],
  defsLoading = false,
  defsError = null,
  tranTypeOptions = [],
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
  const [discardAction, setDiscardAction] = useState(null);

  const visibleFields = useMemo(() => getVisibleHeaderFields(fieldDefs), [fieldDefs]);
  // Live RB has no real Department field — "departmentid" is configured/labeled
  // as a plain "Is active" dropdown (see constants.js addendum #A), and Tran
  // Type is pre-merged across all departments (addendum #B), so neither
  // dropdown here cascades off the other.
  const dropdownOptions = useMemo(
    () => ({ departmentid: IS_ACTIVE_OPTIONS, ref_trantypeid: tranTypeOptions }),
    [tranTypeOptions]
  );

  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    const empty = buildMasterFormEmpty(fieldDefs, buildSaveContext());
    if (isAddMode) {
      setFormValues(empty);
    } else if (editPrefill?.headerValues) {
      setFormValues({ ...empty, ...editPrefill.headerValues });
    }
  }, [isOpen, isAddMode, editPrefill, fieldDefs]);

  const handleChange = useCallback((key, value) => {
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
        inputClassName="tt2doctype-form-input"
        valueClassName="tt2doctype-form-value"
      />
    );
  }

  const handleSave = useCallback(async () => {
    const validationErrors = validateMasterFormFields(visibleFields, formValues, {
      skipMandatoryFor: new Set(
        visibleFields.filter((f) => isMasterToggleField(f) || isMasterCheckboxField(f)).map((f) => f.ColName)
      ),
    });

    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      return false;
    }

    setFormErrors([]);
    setSaveError(null);
    setIsSaving(true);
    try {
      const mstRow = finalizeMasterHeaderSaveRow(fieldDefs, formValues, { fieldsToFinalize: visibleFields });

      const payload = withSaveContextFields(
        buildSaveJsonFields({ label: TT2DOCTYPE_CONFIG.FORM_TAG, mst: mstRow }),
        { divisionId: 0, isEdit: !isAddMode }
      );

      const result = await post(TT2DOCTYPE_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setSaveError(message);
        return false;
      }
      notify.success(message || "Transaction To Document Type saved successfully!");
      onSaved?.();
      return true;
    } catch (err) {
      console.error("[TT2DocType Save] Failed:", err);
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
      title={isAddMode ? "New Transaction To Document Type" : "Edit Transaction To Document Type"}
      subtitle="Admin › DMS › Transaction To Document Type Master"
      icon={<ArrowLeftRight size={16} strokeWidth={2} />}
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
          <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
          <div className="tt2doctype-form-scroll">
            <div className="tt2doctype-form">
              {visibleFields.map((field) => (
                <div key={field.ColName} className="tt2doctype-form-row">
                  <span className={`tt2doctype-form-label${isMasterFieldRequired(field) ? " tt2doctype-form-label--required" : ""}`}>
                    {getMasterFieldLabel(field)}
                  </span>
                  <div className="tt2doctype-form-control">{renderControl(field)}</div>
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
