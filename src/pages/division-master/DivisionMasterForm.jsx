import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Network, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterFormField from "../../components/forms/MasterFormField";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID,
  DEFAULT_LOGIN_ID,
  DEFAULT_SESSION_ID,
  getColDefault,
  buildSaveRowFromColumns,
} from "../../api/constants";
import { useApi } from "../../api/useApi";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumns } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import {
  getMasterFieldLabel,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterToggleField,
} from "../../utils/masterFormUtils";
import {
  DV_CONFIG,
  DV_FORM_LAYOUT,
  DV_CASCADE_RESETS,
  DV_CASCADE_DROPDOWN_REFRESH,
  MODAL_TITLE_ADD,
  MODAL_TITLE_EDIT,
  MODAL_SUBTITLE,
} from "./constants";
import "./DivisionMasterPage.css";

// ---------------------------------------------------------------------------
// Layout helpers — DV_FORM_LAYOUT names are lowercase PG colnames already,
// but resolve case-insensitively for resilience (mirrors CompanyForm.jsx).
// ---------------------------------------------------------------------------
function buildFieldMap(fieldDefs) {
  const map = {};
  fieldDefs.forEach((f) => {
    const key = f.colname ?? f.ColName ?? "";
    if (!key) return;
    map[key] = f;
  });
  return map;
}

function resolveField(fieldMap, layoutName) {
  if (!layoutName) return null;
  return fieldMap[layoutName] ?? fieldMap[layoutName.toLowerCase()] ?? null;
}

function resolveLayoutRows(rows, fieldMap) {
  return rows
    .map((row) => row.map((name) => resolveField(fieldMap, name)).filter(Boolean))
    .filter((row) => row.length > 0);
}

// Premises Name — shown in the screen design but absent from the MRD's Header
// Fields table (no Field ID / control type / SP given). Per PM sign-off this
// renders as a plain UI-only checkbox: local state, NOT part of formValues,
// NOT sent in the save payload. Flagged for DBA follow-up if it needs to persist.
const PREMISES_LOCAL_LABEL = "Premises Name";

export default function DivisionMasterForm({
  isOpen,
  mode,
  recordId,
  onClose,
  onSaved,
  fieldDefs = [],
  allColumns = [],
  defsLoading = false,
  defsError = null,
  dropdownOptions = {},
  onRefreshDropdowns,
  fetchEditRecord,
  seedOptionsFromMaster,
}) {
  const isAddMode = mode === "add";
  const { post } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [isEditMode,      setIsEditMode]      = useState(true);
  const [formValues,      setFormValues]      = useState({});
  const [recordLoading,   setRecordLoading]   = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState(null);
  const [formErrors,      setFormErrors]      = useState([]);
  const [discardAction,   setDiscardAction]   = useState(null);
  const [premisesChecked, setPremisesChecked] = useState(false);

  const fieldMap = useMemo(() => buildFieldMap(fieldDefs), [fieldDefs]);

  const layout = useMemo(() => ({
    mainRows: resolveLayoutRows(DV_FORM_LAYOUT.main.rows, fieldMap),
    bankRows: resolveLayoutRows(DV_FORM_LAYOUT.bank.rows, fieldMap),
  }), [fieldMap]);

  const visibleFields = useMemo(() => {
    const seen = new Set();
    const fields = [];
    const collect = (rows) => {
      rows.forEach((row) => {
        row.forEach((f) => {
          if (!seen.has(f.colname)) { seen.add(f.colname); fields.push(f); }
        });
      });
    };
    collect(layout.mainRows);
    collect(layout.bankRows);
    return fields;
  }, [layout]);

  const buildEmptyFromColumns = useCallback(() => {
    const row = {};
    allColumns.forEach(({ key, colDataType }) => {
      row[key] = getColDefault(colDataType);
    });
    return {
      ...row,
      yearid:    DV_CONFIG.CONFIG_YEAR_ID,
      loginid:   DEFAULT_LOGIN_ID,
      sessionid: DEFAULT_SESSION_ID,
      funccode:  DV_CONFIG.RB_MASTER,
    };
  }, [allColumns]);

  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setFormErrors([]);
    setRecordLoadError(null);
    setPremisesChecked(false);
    setFormValues(buildEmptyFromColumns());
  }, [isOpen, isAddMode, buildEmptyFromColumns]);

  useEffect(() => {
    if (!isOpen || isAddMode || !recordId) return;
    setRecordLoading(true);
    setRecordLoadError(null);
    fetchEditRecord?.({
      companyId: DEFAULT_COMPANY_ID,
      yearId:    DV_CONFIG.CONFIG_YEAR_ID,
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

  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      const resetKeys = DV_CASCADE_RESETS[key];
      if (resetKeys?.length) {
        resetKeys.forEach((rk) => { next[rk] = 0; });
      }
      return next;
    });
    if (DV_CASCADE_DROPDOWN_REFRESH[key]?.length) {
      onRefreshDropdowns?.(key, { [key]: value });
    }
  }, [onRefreshDropdowns]);

  function renderControl(field) {
    const key = field.colname;
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={isMasterFieldLocked(field, { isAddMode, isEditMode })}
        options={dropdownOptions[key] || []}
        inputClassName="dv-form-input"
        valueClassName="dv-form-value"
        toggleClassName="dv-form-toggle"
      />
    );
  }

  function renderFieldCell(field) {
    return (
      <div key={field.colname} className="dv-form-field">
        <span className={`dv-form-label${field.ismandatory ? " dv-form-label--required" : ""}`}>
          {getMasterFieldLabel(field)}
        </span>
        <div className={[
          "dv-form-control",
          isMasterToggleField(field)   ? "dv-form-control--toggle-wrap" : "",
          isMasterCheckboxField(field) ? "dv-form-control--checkbox"    : "",
        ].filter(Boolean).join(" ")}>
          {renderControl(field)}
        </div>
      </div>
    );
  }

  function renderLayoutRow(rowFields, rowKey) {
    if (rowFields.length === 1) {
      return <div key={rowKey} className="dv-form-row">{renderFieldCell(rowFields[0])}</div>;
    }
    return (
      <div key={rowKey} className="dv-form-row dv-form-row--split">
        {rowFields.map((field) => renderFieldCell(field))}
      </div>
    );
  }

  function renderPanelBody(rows, keyPrefix) {
    return rows.map((rowFields, index) => renderLayoutRow(rowFields, `${keyPrefix}-${index}`));
  }

  const handleSave = useCallback(async () => {
    const errors = validateApiColumns(formValues, visibleFields);
    if (errors.length > 0) { setFormErrors(errors); return; }

    setFormErrors([]);
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
      const result = await post(DV_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message || "Division saved successfully.");
      setFormValues(buildEmptyFromColumns());
      setFormErrors([]);
      setSaveError(null);
      setPremisesChecked(false);
      onSaved?.();
    } catch (err) {
      console.error("[DV Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, allColumns, isAddMode, onSaved, post, notify, buildEmptyFromColumns]);

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

  const handleCancelEdit = useCallback(() => { setDiscardAction("cancel"); }, []);

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
      icon={<Network size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      dialogClassName="modal-dialog--division"
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
          <div className="dv-form-scroll">
            <div className="dv-form-layout">
              <section className="dv-form-section dv-form-section--main">
                <div className="dv-form-section__body">
                  {renderPanelBody(layout.mainRows, "main")}
                  <div className="dv-form-row">
                    <div className="dv-form-field">
                      <span className="dv-form-label">Premises</span>
                      <div className="dv-form-control dv-form-control--checkbox">
                        <label className="dv-form-premises-checkbox">
                          <input
                            type="checkbox"
                            checked={premisesChecked}
                            onChange={(e) => setPremisesChecked(e.target.checked)}
                            disabled={!isEditMode}
                          />
                          {PREMISES_LOCAL_LABEL}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <section className="dv-form-section dv-form-section--bank">
                <h3 className="dv-form-section__title">{DV_FORM_LAYOUT.bank.title}</h3>
                <div className="dv-form-section__body">
                  {renderPanelBody(layout.bankRows, "bank")}
                </div>
              </section>
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
