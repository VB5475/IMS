import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Building, Save, Pencil, AlertCircle } from "lucide-react";
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
  CO_CONFIG,
  CO_FORM_LAYOUT,
  CO_LABEL_OVERRIDES,
} from "./constants";
import "./CompanyPage.css";

// ---------------------------------------------------------------------------
// Cascade maps — lowercase colnames (PG)
// ---------------------------------------------------------------------------
const CO_CASCADE_RESETS_LC = {
  countryid:           ["stateid", "cityid"],
  stateid:             ["cityid"],
  respersoncountryid:  ["respersonstateid", "respersoncityid"],
  respersonstateid:    ["respersoncityid"],
};

const CO_CASCADE_REFRESH_LC = {
  countryid:           ["stateid"],
  stateid:             ["cityid"],
  respersoncountryid:  ["respersonstateid"],
  respersonstateid:    ["respersoncityid"],
};

// ---------------------------------------------------------------------------
// Layout helpers — CO_FORM_LAYOUT uses PascalCase names; PG columns are lowercase.
// resolveField tries both exact and lowercase match.
// ---------------------------------------------------------------------------
function buildFieldMap(fieldDefs) {
  const map = {};
  fieldDefs.forEach((f) => {
    const key = f.colname ?? f.ColName ?? "";
    if (!key) return;
    map[key] = f;
    // Currency alias: BasCurrencyID ↔ BaseCurrencyID (RB has both spellings)
    if (key === "bascurrencyid")  map["basecurrencyid"] = f;
    if (key === "basecurrencyid") map["bascurrencyid"]  = f;
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

// ---------------------------------------------------------------------------
// Form component
// ---------------------------------------------------------------------------
export default function CompanyForm({
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

  // fieldMap keyed by lowercase colname (PG)
  const fieldMap = useMemo(() => buildFieldMap(fieldDefs), [fieldDefs]);

  // Layout resolved with case-insensitive lookup (CO_FORM_LAYOUT uses PascalCase)
  const layout = useMemo(() => ({
    mainRows:        resolveLayoutRows(CO_FORM_LAYOUT.left.main.rows,          fieldMap),
    contactRows:     resolveLayoutRows(CO_FORM_LAYOUT.left.contact.rows,       fieldMap),
    responsibleRows: resolveLayoutRows(CO_FORM_LAYOUT.right.responsible.rows,  fieldMap),
  }), [fieldMap]);

  // Ordered list of visible fields for validation (from layout definition)
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
    collect(layout.contactRows);
    collect(layout.responsibleRows);
    return fields;
  }, [layout]);

  // Build empty row seeded from ALL RB columns + context fields (all lowercase)
  const buildEmptyFromColumns = useCallback(() => {
    const row = {};
    allColumns.forEach(({ key, colDataType }) => {
      row[key] = getColDefault(colDataType);
    });
    return {
      ...row,
      yearid:    CO_CONFIG.CONFIG_YEAR_ID,
      loginid:   DEFAULT_LOGIN_ID,
      sessionid: DEFAULT_SESSION_ID,
      funccode:  CO_CONFIG.RB_MASTER,
    };
  }, [allColumns]);

  // Reset on modal open
  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    setFormErrors([]);
    setRecordLoadError(null);
    setFormValues(buildEmptyFromColumns());
  }, [isOpen, isAddMode, buildEmptyFromColumns]);

  // Load edit record when modal opens in edit mode
  useEffect(() => {
    if (!isOpen || isAddMode || !recordId) return;
    setRecordLoading(true);
    setRecordLoadError(null);
    fetchEditRecord?.({
      companyId: DEFAULT_COMPANY_ID,
      yearId:    CO_CONFIG.CONFIG_YEAR_ID,
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
      // Reset dependent dropdowns to default
      const resetKeys = CO_CASCADE_RESETS_LC[key];
      if (resetKeys?.length) {
        resetKeys.forEach((rk) => { next[rk] = 0; });
      }
      return next;
    });
    // Refresh child dropdown options — pass only the changed key/value since
    // each child binding's parentCol IS the changed field itself.
    if (CO_CASCADE_REFRESH_LC[key]?.length) {
      onRefreshDropdowns?.(key, { [key]: value });
    }
  }, [onRefreshDropdowns]);

  function renderControl(field) {
    const key = field.colname; // lowercase (PG)
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
      <div key={field.colname} className="co-form-field">
        <span className={`co-form-label${field.ismandatory ? " co-form-label--required" : ""}`}>
          {getMasterFieldLabel(field, CO_LABEL_OVERRIDES)}
        </span>
        <div className={[
          "co-form-control",
          isMasterToggleField(field)   ? "co-form-control--toggle-wrap" : "",
          isMasterCheckboxField(field) ? "co-form-control--checkbox"    : "",
        ].filter(Boolean).join(" ")}>
          {renderControl(field)}
        </div>
      </div>
    );
  }

  function renderLayoutRow(rowFields, rowKey) {
    if (rowFields.length === 1) {
      return <div key={rowKey} className="co-form-row">{renderFieldCell(rowFields[0])}</div>;
    }
    return (
      <div key={rowKey} className="co-form-row co-form-row--split">
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

      console.log("prmStrMstJSON",saveRow);
      console.log("prmStrDetJSON",{});
      console.log("payload",payload);
      const result = await post(CO_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return; }
      notify.success(message || "Company saved successfully.");
      onSaved?.();
    } catch (err) {
      console.error("[CO Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, allColumns, isAddMode, onSaved, post, notify]);

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
      title={isAddMode ? "New Company" : "Edit Company"}
      subtitle="Admin › Master › Company"
      icon={<Building size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      dialogClassName="modal-dialog--company"
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
