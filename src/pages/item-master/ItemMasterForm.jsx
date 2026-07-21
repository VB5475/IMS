import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Package, Save, Pencil, AlertCircle, Wand2, Calculator } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SearchSelect from "../../components/ui/SearchSelect";
import {
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  getColDefault,
  buildSaveRowFromColumns,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { validateApiColumns } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import {
  IM_CONFIG,
  IM_DROPDOWN_FIELDS,
  IM_SUB_GROUP_FIELDS,
  IM_ITEM_TYPE_CASCADE_RESETS,
  IM_MAIN_GROUP_CASCADE_RESETS,
  IM_SUB_MAIN_GROUP_CASCADE_RESETS,
} from "./constants";
import "./ItemMasterPage.css";

// Fields locked during edit mode (RB colnames — all lowercase)
const LOCK_ON_EDIT = new Set(["itemcode"]);

// Fields rendered as checkbox despite colctrltype=1 (store numeric 0/1)
const CHECKBOX_OVERRIDES = new Set(["isqcreq"]);

const DISPLAY_OVERRIDES = {
  taxabilityid: "Taxability",
  hsncode: "HSN / SAC Code",
  unitconvrate: "Unit Conv. Rate",
};

function getLabel(field) {
  return DISPLAY_OVERRIDES[field.colname] || field.displayname || field.colname;
}

export default function ItemMasterForm({
  isOpen,
  mode,
  onClose,
  onSaved,
  fieldDefs = [],
  allColumns = [],
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
  const notify = useNotification();

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [discardAction, setDiscardAction] = useState(null);

  const buildEmptyFromColumns = useCallback(() => {
    const session = getUserSession();
    const row = {};
    allColumns.forEach(({ key, colDataType }) => { row[key] = getColDefault(colDataType); });
    return {
      ...row,
      yearid: session.yearId,
      loginid: session.loginId,
      sessionid: DEFAULT_SESSION_ID,
      funccode: IM_CONFIG.RB_MASTER,
    };
  }, [allColumns]);

  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setFormErrors([]);
    if (isAddMode) {
      setFormValues(buildEmptyFromColumns());
    } else if (editPrefill?.headerValues) {
      setFormValues({ ...buildEmptyFromColumns(), ...editPrefill.headerValues });
    }
  }, [isOpen, isAddMode, editPrefill, buildEmptyFromColumns]);

  const visibleFields = useMemo(
    () =>
      fieldDefs
        .filter((f) => f.isvisible && f.colseqno < 100)
        .sort((a, b) => a.colseqno - b.colseqno || (Number(a.objdetid) || 0) - (Number(b.objdetid) || 0)),
    [fieldDefs]
  );

  const optionsMap = useMemo(
    () => ({
      itemtypeid: itemTypeOptions,
      maingroupid: mainGroupOptions,
      submaingroupid: subMainGroupOptions,
      taxabilityid: taxOptions,
      tranunitid: tranUnitOptions,
      baseunitid: baseUnitOptions,
      ...Object.fromEntries(IM_SUB_GROUP_FIELDS.map((key) => [key, subGroupOptions])),
    }),
    [itemTypeOptions, mainGroupOptions, subMainGroupOptions, subGroupOptions, taxOptions, tranUnitOptions, baseUnitOptions]
  );

  function isLocked(field) {
    if (!isEditMode) return true;
    if (!isAddMode && LOCK_ON_EDIT.has(field.colname)) return true;
    return false;
  }

  const handleChange = useCallback(
    (key, value) => {
      setFormValues((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "itemtypeid") {
          IM_ITEM_TYPE_CASCADE_RESETS.forEach((k) => { next[k] = IM_DROPDOWN_FIELDS.has(k) ? 0 : ""; });
          onItemTypeChange?.(Number(value) || 0);
        } else if (key === "maingroupid") {
          IM_MAIN_GROUP_CASCADE_RESETS.forEach((k) => { next[k] = IM_DROPDOWN_FIELDS.has(k) ? 0 : ""; });
          onMainGroupChange?.({ itemTypeId: next.itemtypeid, mainGroupId: Number(value) || 0 });
        } else if (key === "submaingroupid") {
          IM_SUB_MAIN_GROUP_CASCADE_RESETS.forEach((k) => { next[k] = IM_DROPDOWN_FIELDS.has(k) ? 0 : ""; });
          onSubMainGroupChange?.({
            itemTypeId: next.itemtypeid,
            mainGroupId: next.maingroupid,
            subMainGroupId: Number(value) || 0,
          });
        }
        return next;
      });
    },
    [onItemTypeChange, onMainGroupChange, onSubMainGroupChange]
  );

  function renderControl(field) {
    const key = field.colname;
    const locked = isLocked(field);

    // Itemcode — always auto-generated, shown as display text
    if (key === "itemcode") {
      return (
        <span className="im-form-value">
          {formValues.itemcode || (isAddMode ? "Auto-generated on save" : "—")}
        </span>
      );
    }

    // Checkbox override — stored as numeric 0/1
    if (CHECKBOX_OVERRIDES.has(key)) {
      return (
        <div className="im-form-control--checkbox">
          <input
            type="checkbox"
            className="im-form-checkbox"
            checked={!!formValues[key]}
            onChange={(e) => handleChange(key, e.target.checked ? 1 : 0)}
            disabled={locked}
          />
          <span className="im-form-checkbox-label">{formValues[key] ? "Yes" : "No"}</span>
        </div>
      );
    }

    // Dropdown (by colctrltype or known dropdown field)
    if (Number(field.colctrltype) === 4 || IM_DROPDOWN_FIELDS.has(key)) {
      return (
        <SearchSelect
          options={optionsMap[key] || []}
          value={String(formValues[key] ?? "")}
          onChange={(val) => handleChange(key, Number(val) || 0)}
          disabled={locked}
          placeholder={`Select ${getLabel(field)}…`}
        />
      );
    }

    // Default — text input
    return (
      <input
        className="im-form-input"
        type="text"
        value={formValues[key] ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`Enter ${getLabel(field)}…`}
        readOnly={locked}
        tabIndex={locked ? -1 : undefined}
      />
    );
  }

  const handleGenerateCode = useCallback(() => {
    notify.success("Generate Code will be available once the code-generation API is connected.");
  }, [notify]);

  const handleGenerateName = useCallback(() => {
    notify.success("Generate Name will be available once the name-generation API is connected.");
  }, [notify]);

  const handleConversionExample = useCallback(() => {
    const conversion = String(formValues.unitconvrate || "").trim();
    const tranUnit =
      tranUnitOptions.find((o) => o.value === String(formValues.tranunitid))?.label || "Tran Unit";
    const baseUnit =
      baseUnitOptions.find((o) => o.value === String(formValues.baseunitid))?.label || "Base Unit";
    if (!conversion) { notify.error("Enter a conversion value first."); return; }
    notify.success(`Example: 1 ${tranUnit} = ${conversion} ${baseUnit}`);
  }, [formValues, tranUnitOptions, baseUnitOptions]);

  const handleSave = useCallback(async () => {
    const fieldsToValidate = visibleFields.filter(
      (f) => f.colname !== "itemcode" && !CHECKBOX_OVERRIDES.has(f.colname)
    );
    const errors = validateApiColumns(formValues, fieldsToValidate);
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
      const result = await post(IM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message);
      setFormValues(buildEmptyFromColumns());
      setFormErrors([]);
      setSaveError(null);
      onSaved?.();
    } catch (err) {
      console.error("[IM Save] Failed:", err);
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

          <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />

          <div className="im-form-scroll">
            <div className="im-form">
              {visibleFields.map((field) => (
                <div
                  key={field.colname}
                  className={[
                    "im-form-row",
                    field.colname === "itemcode" ? "im-form-row--view" : "",
                    CHECKBOX_OVERRIDES.has(field.colname) ? "im-form-row--checkbox" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span
                    className={`im-form-label${field.ismandatory &&
                        !CHECKBOX_OVERRIDES.has(field.colname) &&
                        field.colname !== "itemcode"
                        ? " im-form-label--required"
                        : ""
                      }`}
                  >
                    {getLabel(field)}
                  </span>
                  <div
                    className={`im-form-control${CHECKBOX_OVERRIDES.has(field.colname) ? " im-form-control--checkbox" : ""
                      }`}
                  >
                    {field.colname === "unitconvrate" && isEditMode ? (
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
