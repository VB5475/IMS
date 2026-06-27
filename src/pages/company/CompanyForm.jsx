import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Building, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import MasterFormField from "../../components/forms/MasterFormField";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID,
  DEFAULT_LOGIN_ID,
  DEFAULT_SESSION_ID,
} from "../../api/constants";
import { useApi } from "../../api/useApi";
import { withSaveContextFields } from "../../utils/savePayload";
import {
  buildMasterCascadeDropdownRefresh,
  buildMasterCascadeResets,
  buildMasterFormEmpty,
  getCheckboxValue,
  getMasterFieldDefaultValue,
  getMasterFieldLabel,
  getToggleValue,
  getVisibleHeaderFields,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterFieldRequired,
  isMasterToggleField,
  validateMasterFormFields,
  alertMasterFormValidationErrors,
  runAfterFieldBlur,
} from "../../utils/masterFormUtils";
import {
  CO_CONFIG,
  CO_CASCADE_DROPDOWN_REFRESH,
  CO_CASCADE_RESETS,
  CO_FORM_LAYOUT,
  CO_LABEL_OVERRIDES,
  getCoLayoutFieldNames,
  resolveCoLayoutField,
} from "./constants";
import "./CompanyPage.css";

function buildSaveContext() {
  return {
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: CO_CONFIG.CONFIG_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    SessionID: DEFAULT_SESSION_ID,
    FuncCode: CO_CONFIG.RB_MASTER,
  };
}

function buildFieldMap(fieldDefs) {
  return Object.fromEntries(
    getVisibleHeaderFields(fieldDefs).map((field) => [field.ColName, field])
  );
}

function resolveLayoutRows(rows, fieldMap) {
  return rows
    .map((row) =>
      row.map((name) => resolveCoLayoutField(fieldMap, name)).filter(Boolean)
    )
    .filter((row) => row.length > 0);
}

export default function CompanyForm({
  isOpen,
  mode,
  onClose,
  onSaved,
  fieldDefs = [],
  defsLoading = false,
  defsError = null,
  dropdownOptions = {},
  onRefreshDropdowns,
  editPrefill = null,
  recordLoading = false,
  recordLoadError = null,
}) {
  const isAddMode = mode === "add";
  const { post } = useApi(API_BASE_URL_IMS);

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState(() =>
    buildMasterFormEmpty(fieldDefs, buildSaveContext())
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const fieldMap = useMemo(() => buildFieldMap(fieldDefs), [fieldDefs]);

  const layout = useMemo(
    () => ({
      mainRows: resolveLayoutRows(CO_FORM_LAYOUT.left.main.rows, fieldMap),
      contactRows: resolveLayoutRows(CO_FORM_LAYOUT.left.contact.rows, fieldMap),
      responsibleRows: resolveLayoutRows(
        CO_FORM_LAYOUT.right.responsible.rows,
        fieldMap
      ),
    }),
    [fieldMap]
  );

  const visibleFields = useMemo(() => {
    const names = getCoLayoutFieldNames(fieldMap);
    return names.map((name) => fieldMap[name]).filter(Boolean);
  }, [fieldMap]);

  const cascadeResets = useMemo(() => {
    const fromApi = buildMasterCascadeResets(fieldDefs);
    return { ...fromApi, ...CO_CASCADE_RESETS };
  }, [fieldDefs]);

  const cascadeDropdownRefresh = useMemo(() => {
    const fromApi = buildMasterCascadeDropdownRefresh(fieldDefs);
    return { ...fromApi, ...CO_CASCADE_DROPDOWN_REFRESH };
  }, [fieldDefs]);

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

  useEffect(() => {
    if (!isOpen || !fieldDefs.length) return;
    setFormValues((prev) => {
      const next = { ...prev };
      let changed = false;
      fieldDefs.forEach((f) => {
        if (isMasterToggleField(f) && next[f.ColName] === undefined) {
          next[f.ColName] = 0;
          changed = true;
        }
        if (isMasterCheckboxField(f) && next[f.ColName] === undefined) {
          next[f.ColName] = 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [isOpen, fieldDefs]);

  const handleChange = useCallback(
    (key, value) => {
      setFormValues((prev) => {
        const next = { ...prev, [key]: value };
        const resetKeys = cascadeResets[key];
        if (resetKeys?.length) {
          resetKeys.forEach((resetKey) => {
            const field = fieldDefs.find((f) => f.ColName === resetKey);
            next[resetKey] = field ? getMasterFieldDefaultValue(field) : "";
          });
        }
        if (cascadeDropdownRefresh[key]?.length) {
          onRefreshDropdowns?.(key, next);
        }
        return next;
      });
    },
    [cascadeResets, cascadeDropdownRefresh, fieldDefs, onRefreshDropdowns]
  );

  function renderControl(field) {
    const key = field.ColName;
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={isMasterFieldLocked(field, { isAddMode, isEditMode })}
        options={dropdownOptions[key] || []}
        labelOverrides={CO_LABEL_OVERRIDES}
        inputClassName="co-form-input"
        valueClassName="co-form-value"
        toggleClassName="co-form-toggle"
      />
    );
  }

  function renderFieldCell(field) {
    return (
      <div key={field.ColName} className="co-form-field">
        <span
          className={`co-form-label${isMasterFieldRequired(field) ? " co-form-label--required" : ""
            }`}
        >
          {getMasterFieldLabel(field, CO_LABEL_OVERRIDES)}
        </span>
        <div className="co-form-control">{renderControl(field)}</div>
      </div>
    );
  }

  function renderLayoutRow(rowFields, rowKey) {
    if (rowFields.length === 1) {
      return (
        <div key={rowKey} className="co-form-row">
          {renderFieldCell(rowFields[0])}
        </div>
      );
    }

    return (
      <div key={rowKey} className="co-form-row co-form-row--split">
        {rowFields.map((field) => renderFieldCell(field))}
      </div>
    );
  }

  function renderPanelBody(rows, keyPrefix) {
    return rows.map((rowFields, index) =>
      renderLayoutRow(rowFields, `${keyPrefix}-${index}`)
    );
  }

  const handleSave = useCallback(async () => {
    const validationErrors = validateMasterFormFields(visibleFields, formValues, {
      skipMandatoryFor: new Set(
        visibleFields
          .filter((f) => isMasterToggleField(f) || isMasterCheckboxField(f))
          .map((f) => f.ColName)
      ),
    });

    if (alertMasterFormValidationErrors(validationErrors)) return;

    setSaveError(null);
    setIsSaving(true);
    try {
      const saveRow = { ...formValues };
      visibleFields.forEach((f) => {
        if (isMasterToggleField(f) && f.ColName in saveRow) {
          saveRow[f.ColName] = getToggleValue(saveRow[f.ColName]);
        }
        if (isMasterCheckboxField(f) && f.ColName in saveRow) {
          saveRow[f.ColName] = getCheckboxValue(saveRow[f.ColName]);
        }
      });
      console.log("see the saveroow:", saveRow)
      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );

      await post(CO_CONFIG.SAVE_ENDPOINT, payload);
      alert("Company saved successfully!");
      onSaved?.();
    } catch (err) {
      console.error("[CO Save] Failed:", err);
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
      if (isAddMode) {
        onClose();
        return;
      }
      setIsEditMode(false);
      setSaveError(null);
    });
  }, [isAddMode, onClose]);

  const footer = useMemo(() => {
    if (!isEditMode) {
      return (
        <button
          type="button"
          className="master-modal-btn master-modal-btn--edit"
          onClick={() => setIsEditMode(true)}
        >
          <Pencil size={13} strokeWidth={2} /> Edit
        </button>
      );
    }
    return (
      <div className="master-modal-footer-actions">
        <button
          type="button"
          className="master-modal-btn master-modal-btn--cancel"
          onClick={handleCancelEdit}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="master-modal-btn master-modal-btn--save"
          onClick={handleSave}
          disabled={isSaving}
        >
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
      title={isAddMode ? "New Company" : "Edit Company"}
      subtitle="Admin › Master › Company"
      icon={<Building size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      dialogClassName="modal-dialog--company"
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
          <div className="co-form-scroll">
            <div className="co-form-layout">
              <div className="co-form-layout__left">
                <section className="co-form-section co-form-section--main">
                  <div className="co-form-section__body">
                    {renderPanelBody(layout.mainRows, "main")}
                  </div>
                </section>

                <section className="co-form-section co-form-section--contact">
                  <h3 className="co-form-section__title">
                    {CO_FORM_LAYOUT.left.contact.title}
                  </h3>
                  <div className="co-form-section__body">
                    {renderPanelBody(layout.contactRows, "contact")}
                  </div>
                </section>
              </div>

              <div className="co-form-layout__right">
                <section className="co-form-section co-form-section--responsible">
                  <h3 className="co-form-section__title">
                    {CO_FORM_LAYOUT.right.responsible.title}
                  </h3>
                  <div className="co-form-section__body">
                    {renderPanelBody(layout.responsibleRows, "responsible")}
                  </div>
                </section>
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
