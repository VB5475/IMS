import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Package, Save, Pencil, AlertCircle, Wand2, Calculator } from "lucide-react";
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
  buildMasterFormEmpty,
  getCheckboxValue,
  getMasterFieldLabel,
  getToggleValue,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterFieldRequired,
  isMasterToggleField,
  validateMasterFormFields,
  alertMasterFormValidationErrors,
  runAfterFieldBlur,
} from "../../utils/masterFormUtils";
import {
  IM_CONFIG,
  IM_DROPDOWN_FIELDS,
  IM_SUB_GROUP_FIELDS,
  IM_ITEM_TYPE_CASCADE_RESETS,
  IM_MAIN_GROUP_CASCADE_RESETS,
  IM_SUB_MAIN_GROUP_CASCADE_RESETS,
} from "./constants";

const DISPLAY_OVERRIDES = {
  TaxabilityID: "Taxability",
  HSNCode: "HSN / SAC Code",
};

function buildSaveContext() {
  return {
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: IM_CONFIG.CONFIG_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    SessionID: DEFAULT_SESSION_ID,
    FuncCode: IM_CONFIG.RB_MASTER,
  };
}

function getLabel(field) {
  return getMasterFieldLabel(field, DISPLAY_OVERRIDES);
}

export default function ItemMasterForm({
  isOpen,
  mode,
  onClose,
  onSaved,
  fieldDefs = [],
  defsLoading = false,
  defsError = null,
  itemTypeOptions = [],
  mainGroupOptions = [],
  subMainGroupOptions = [],
  subGroupOptions = [],
  taxOptions = [],
  tranUnitOptions = [],
  baseUnitOptions = [],
  editPrefill = null,
  recordLoading = false,
  recordLoadError = null,
  onItemTypeChange,
  onMainGroupChange,
  onSubMainGroupChange,
}) {
  const isAddMode = mode === "add";
  const { post } = useApi(API_BASE_URL_IMS);

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState(() =>
    buildMasterFormEmpty(fieldDefs, buildSaveContext())
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    if (isAddMode) {
      setFormValues(buildMasterFormEmpty(fieldDefs, buildSaveContext()));
    } else if (editPrefill?.headerValues) {
      setFormValues({
        ...buildMasterFormEmpty(fieldDefs, buildSaveContext()),
        ...editPrefill.headerValues,
      });
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

  const visibleFields = useMemo(
    () =>
      fieldDefs
        .filter((f) => f.IsVisible && f.ColSeqNo < 100)
        .sort(
          (a, b) =>
            a.ColSeqNo - b.ColSeqNo ||
            (Number(a.ObjDetID) || 0) - (Number(b.ObjDetID) || 0)
        ),
    [fieldDefs]
  );

  const optionsMap = useMemo(
    () => ({
      ItemTypeID: itemTypeOptions,
      MainGroupID: mainGroupOptions,
      SubMainGroupID: subMainGroupOptions,
      TaxabilityID: taxOptions,
      TranUnitID: tranUnitOptions,
      BaseUnitID: baseUnitOptions,
      ...Object.fromEntries(IM_SUB_GROUP_FIELDS.map((key) => [key, subGroupOptions])),
    }),
    [
      itemTypeOptions,
      mainGroupOptions,
      subMainGroupOptions,
      subGroupOptions,
      taxOptions,
      tranUnitOptions,
      baseUnitOptions,
    ]
  );

  function renderControl(field) {
    const key = field.ColName;
    const locked = isMasterFieldLocked(field, { isAddMode, isEditMode });

    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={locked}
        options={optionsMap[key] || []}
        labelOverrides={DISPLAY_OVERRIDES}
        inputClassName="im-form-input"
        textareaClassName="im-form-textarea"
        valueClassName="im-form-value"
        customRender={({ field: f }) => {
          if (f.ColName === "Itemcode") {
            return (
              <span className="im-form-value">
                {formValues.Itemcode || (isAddMode ? "Auto-generated on save" : "—")}
              </span>
            );
          }
          return null;
        }}
      />
    );
  }

  const applyCascadeResets = useCallback((next, resetKeys) => {
    resetKeys.forEach((key) => {
      next[key] = IM_DROPDOWN_FIELDS.has(key) ? 0 : "";
    });
  }, []);

  const handleChange = useCallback(
    (key, value) => {
      setFormValues((prev) => {
        const next = { ...prev, [key]: value };

        if (key === "ItemTypeID") {
          applyCascadeResets(next, IM_ITEM_TYPE_CASCADE_RESETS);
          onItemTypeChange?.(Number(value) || 0);
        } else if (key === "MainGroupID") {
          applyCascadeResets(next, IM_MAIN_GROUP_CASCADE_RESETS);
          onMainGroupChange?.({
            itemTypeId: next.ItemTypeID,
            mainGroupId: Number(value) || 0,
          });
        } else if (key === "SubMainGroupID") {
          applyCascadeResets(next, IM_SUB_MAIN_GROUP_CASCADE_RESETS);
          onSubMainGroupChange?.({
            itemTypeId: next.ItemTypeID,
            mainGroupId: next.MainGroupID,
            subMainGroupId: Number(value) || 0,
          });
        }

        return next;
      });
    },
    [applyCascadeResets, onItemTypeChange, onMainGroupChange, onSubMainGroupChange]
  );

  const handleGenerateCode = useCallback(() => {
    alert("Generate Code will call the Item Master code-generation API once connected.");
  }, []);

  const handleGenerateName = useCallback(() => {
    alert("Generate Name will call the Item Master name-generation API once connected.");
  }, []);

  const handleConversionExample = useCallback(() => {
    const conversion = String(formValues.UnitConvRate || "").trim();
    const tranUnit =
      tranUnitOptions.find((o) => o.value === String(formValues.TranUnitID))?.label ||
      "Tran Unit";
    const baseUnit =
      baseUnitOptions.find((o) => o.value === String(formValues.BaseUnitID))?.label ||
      "Base Unit";
    if (!conversion) {
      alert("Enter a conversion value first.");
      return;
    }
    alert(`Example: 1 ${tranUnit} = ${conversion} ${baseUnit}`);
  }, [formValues, tranUnitOptions, baseUnitOptions]);

  const handleSave = useCallback(async () => {
    const validationErrors = validateMasterFormFields(visibleFields, formValues, {
      labelOverrides: DISPLAY_OVERRIDES,
      skipFields: new Set(["Itemcode"]),
      skipMandatoryFor: new Set([
        ...visibleFields.filter(isMasterCheckboxField).map((f) => f.ColName),
        ...visibleFields.filter(isMasterToggleField).map((f) => f.ColName),
      ]),
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

      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );

      console.log("%c[IM Save] Save row:", "color:#f59e0b;font-weight:700", saveRow);
      console.log("%c[IM Save] Payload:", "color:#f59e0b;font-weight:700", payload);

      await post(IM_CONFIG.SAVE_ENDPOINT, payload);
      alert("Item saved successfully!");
      onSaved?.();
    } catch (err) {
      console.error("[IM Save] Failed:", err);
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
      title={isAddMode ? "New Item" : "Edit Item"}
      subtitle="Admin › Item › Item Master"
      icon={<Package size={16} strokeWidth={2} />}
      size="xl"
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
          {isEditMode && (
            <div className="im-form-actions">
              <button type="button" className="im-form-action-btn" onClick={handleGenerateCode}>
                <Wand2 size={13} strokeWidth={2} /> Generate Code
              </button>
              <button type="button" className="im-form-action-btn" onClick={handleGenerateName}>
                <Wand2 size={13} strokeWidth={2} /> Generate Name
              </button>
            </div>
          )}

          <div className="im-form-scroll">
            <div className="im-form">
              {visibleFields.map((field) => (
                <div
                  key={field.ColName}
                  className={[
                    "im-form-row",
                    field.ColName === "Itemcode" ? "im-form-row--view" : "",
                    isMasterCheckboxField(field) ? "im-form-row--checkbox" : "",
                    isMasterToggleField(field) ? "im-form-row--toggle" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span
                    className={`im-form-label${
                      isMasterFieldRequired(field, {
                        skipFields: new Set(["Itemcode"]),
                      })
                        ? " im-form-label--required"
                        : ""
                    }`}
                  >
                    {getLabel(field)}
                  </span>
                  <div
                    className={`im-form-control${
                      isMasterCheckboxField(field)
                        ? " im-form-control--checkbox"
                        : ""
                    }${isMasterToggleField(field) ? " im-form-control--toggle-wrap" : ""}`}
                  >
                    {field.ColName === "UnitConvRate" && isEditMode ? (
                      <div className="im-form-inline">
                        {renderControl(field)}
                        <button
                          type="button"
                          className="im-form-action-btn im-form-action-btn--inline"
                          onClick={handleConversionExample}
                        >
                          <Calculator size={13} strokeWidth={2} /> Example
                        </button>
                      </div>
                    ) : (
                      renderControl(field)
                    )}
                  </div>
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
