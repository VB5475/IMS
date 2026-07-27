// SupplierMasterForm.jsx
// Supplier Master entry form — modal (Add / Edit), matching CompanyForm.jsx's
// two-column sectioned Master-form layout (not tabs): Main + Contacts stack on
// the left, Transporter Detail + TDS Deduction + Bank Information stack on the
// right. (Consignee Detail grid removed — prmStrConsigneeJSON is still sent
// as an empty array on save; see constants.js RB_DETAIL note for why the
// backend-facing constants weren't removed — Customer Master's own grid still
// depends on them.)

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { AlertCircle, Save, Pencil, Truck } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterFormField from "../../components/forms/MasterFormField";
import { useNotification } from "../../context/NotificationContext";
import { useApi } from "../../api/useApi";
import {
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  getColDefault,
  buildSaveRowFromColumns,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { validateApiColumns } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import {
  getMasterFieldLabel,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterToggleField,
} from "../../utils/masterFormUtils";
import {
  SM_CONFIG,
  SM_FORM_LAYOUT,
  SM_CHECKBOX_OVERRIDE_FIELDS,
  SM_LABEL_OVERRIDES,
  resolveSmLayoutField,
  getSmLayoutFieldNames,
  MODAL_TITLE_ADD,
  MODAL_TITLE_EDIT,
  MODAL_SUBTITLE,
  controlTypeMap,
} from "./constants";
import "./SupplierMasterPage.css";

function isTdsChecked(values) {
  const v = values?.tds;
  return v === 1 || v === "1" || v === true;
}

// Deductee Type / NOP stay locked until TDS is checked — business rule from the
// MRD, layered on top of the live RB's own lock rules.
const TDS_GATED_FIELDS = new Set(["deducteetypeid", "nopid"]);

function buildFieldMap(headerColumns) {
  const map = {};
  headerColumns.forEach((f) => {
    if (!f.colname) return;
    // "tds" is a Textbox in the live RB but the MRD requires it as a checkbox
    // gate — same override pattern as ItemMasterForm's CHECKBOX_OVERRIDES.
    if (SM_CHECKBOX_OVERRIDE_FIELDS.has(f.colname)) {
      map[f.colname] = { ...f, colctrltype: controlTypeMap.CHECKBOX };
    } else {
      map[f.colname] = f;
    }
  });
  return map;
}

function resolveLayoutRows(rows, fieldMap) {
  return rows
    .map((row) => row.map((name) => resolveSmLayoutField(fieldMap, name)).filter(Boolean))
    .filter((row) => row.length > 0);
}

export default function SupplierMasterForm({
  isOpen, mode, recordId, onClose, onSaved,
  headerColumns = [], headerFetching = false, headerError = null,
  stateOptions = [], cityOptions = [], fetchStateOptions, fetchCityOptions, clearStates, clearCities,
  categoryOptions = [], accountGroupOptions = [], countryOptions = [], registrationTypeOptions = [],
  currencyOptions = [], transporterOptions = [], transporterDestinationOptions = [],
  deducteeTypeOptions = [], nopOptions = [],
  fetchEditRecord,
}) {
  const isAddMode = mode === "add";
  const notify = useNotification();

  const [formErrors, setFormErrors] = useState([]);
  const { post } = useApi(API_BASE_URL_IMS);

  const session = getUserSession();

  // fieldMap keyed by lowercase colname (PG)
  const fieldMap = useMemo(() => buildFieldMap(headerColumns), [headerColumns]);

  const layout = useMemo(() => ({
    mainRows: resolveLayoutRows(SM_FORM_LAYOUT.left.main.rows, fieldMap),
    transporterRows: resolveLayoutRows(SM_FORM_LAYOUT.right.transporter.rows, fieldMap),
    tdsRows: resolveLayoutRows(SM_FORM_LAYOUT.right.tds.rows, fieldMap),
    bankRows: resolveLayoutRows(SM_FORM_LAYOUT.right.bank.rows, fieldMap),
    contactRows: resolveLayoutRows(SM_FORM_LAYOUT.right.contact.rows, fieldMap),
  }), [fieldMap]);

  // Ordered list of visible fields for validation (from layout definition)
  const visibleFields = useMemo(() => {
    const names = new Set(getSmLayoutFieldNames(fieldMap));
    return headerColumns.filter((f) => names.has(f.colname));
  }, [fieldMap, headerColumns]);

  // Dropdown options keyed by lowercase colname — same source as before,
  // just fed through MasterFormField's `options` prop instead of
  // EnterpriseFilterPanel's `staticFilters`.
  const dropdownOptions = useMemo(() => ({
    catrgoryid: categoryOptions,
    accountgroupid: accountGroupOptions,
    countryid: countryOptions,
    stateid: stateOptions,
    cityid: cityOptions,
    registrationtypeid: registrationTypeOptions,
    currencyid: currencyOptions,
    transporterid: transporterOptions,
    transpoterdestinationid: transporterDestinationOptions,
    deducteetypeid: deducteeTypeOptions,
    nopid: nopOptions,
  }), [
    categoryOptions, accountGroupOptions, countryOptions, stateOptions, cityOptions,
    registrationTypeOptions, currencyOptions, transporterOptions, transporterDestinationOptions,
    deducteeTypeOptions, nopOptions,
  ]);

  const buildEmptyFromColumns = useCallback(() => {
    const row = {};
    headerColumns.forEach(({ colname, coldatatype }) => {
      row[colname] = getColDefault(coldatatype);
    });
    return {
      ...row,
      companyid: session.companyId,
      yearid: session.yearId,
      loginid: session.loginId,
      sessionid: DEFAULT_SESSION_ID,
      funccode: SM_CONFIG.RB_MASTER,
      idnumber: recordId || 0,
    };
  }, [headerColumns, recordId, session.companyId, session.yearId, session.loginId]);

  const [formValues, setFormValues] = useState({});
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(isAddMode);
  const [isSaving, setIsSaving] = useState(false);
  const [discardAction, setDiscardAction] = useState(null);

  // Reset form state each time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setFormErrors([]);
    setRecordLoadError(null);
    setFormValues(buildEmptyFromColumns());
    clearStates?.();
    clearCities?.();
  }, [isOpen, isAddMode, buildEmptyFromColumns, clearStates, clearCities]);

  // Load existing record when opening in edit mode
  useEffect(() => {
    if (!isOpen || isAddMode || !recordId) return;
    setRecordLoading(true);
    setRecordLoadError(null);
    fetchEditRecord({
      companyId: session.companyId,
      yearId: session.yearId,
      loginId: session.loginId,
      sessionId: DEFAULT_SESSION_ID,
      idNumber: recordId,
    })
      .then(({ master, headerValues }) => {
        if (!master || !headerValues) { setRecordLoadError("Record not found."); return; }
        setFormValues({ ...buildEmptyFromColumns(), ...headerValues });
        if (headerValues.countryid) void fetchStateOptions?.(headerValues.countryid);
        if (headerValues.stateid) void fetchCityOptions?.(headerValues.stateid);
      })
      .catch((err) => {
        console.error("[SM] loadEditRecord failed:", err);
        setRecordLoadError(err?.message || "Failed to load record.");
      })
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, buildEmptyFromColumns, fetchStateOptions, fetchCityOptions]);

  // Country → State → City cascade + TDS gate reset
  const handleChange = useCallback((key, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "countryid") {
        next.stateid = 0;
        next.cityid = 0;
      } else if (key === "stateid") {
        next.cityid = 0;
      } else if (key === "tds" && !(value === 1 || value === "1" || value === true)) {
        next.deducteetypeid = 0;
        next.nopid = 0;
      }
      return next;
    });

    if (key === "countryid") {
      clearCities?.();
      if (value && value !== "0") void fetchStateOptions?.(value);
      else clearStates?.();
    } else if (key === "stateid") {
      if (value && value !== "0") void fetchCityOptions?.(value);
      else clearCities?.();
    }
  }, [fetchStateOptions, fetchCityOptions, clearStates, clearCities]);

  function isFieldLocked(field) {
    const baseLocked = isMasterFieldLocked(field, { isAddMode, isEditMode });
    if (baseLocked) return true;
    if (TDS_GATED_FIELDS.has(field.colname) && !isTdsChecked(formValues)) return true;
    return false;
  }

  function renderControl(field) {
    const key = field.colname;
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={isFieldLocked(field)}
        options={dropdownOptions[key] || []}
        labelOverrides={SM_LABEL_OVERRIDES}
        inputClassName="sm-form-input"
        valueClassName="sm-form-value"
        toggleClassName="sm-form-toggle"
      />
    );
  }

  function renderFieldCell(field) {
    return (
      <div key={field.colname} className="sm-form-field">
        <span className={`sm-form-label${field.ismandatory ? " sm-form-label--required" : ""}`}>
          {getMasterFieldLabel(field, SM_LABEL_OVERRIDES)}
        </span>
        <div className={[
          "sm-form-control",
          isMasterToggleField(field) ? "sm-form-control--toggle-wrap" : "",
          isMasterCheckboxField(field) ? "sm-form-control--checkbox" : "",
        ].filter(Boolean).join(" ")}>
          {renderControl(field)}
        </div>
      </div>
    );
  }

  function renderLayoutRow(rowFields, rowKey) {
    if (rowFields.length === 1) {
      return <div key={rowKey} className="sm-form-row">{renderFieldCell(rowFields[0])}</div>;
    }
    return (
      <div key={rowKey} className="sm-form-row sm-form-row--split">
        {rowFields.map((field) => renderFieldCell(field))}
      </div>
    );
  }

  function renderPanelBody(rows, keyPrefix) {
    return rows.map((rowFields, index) => renderLayoutRow(rowFields, `${keyPrefix}-${index}`));
  }

  // ── Save ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setFormErrors([]);
    const headerErrors = validateApiColumns(formValues, visibleFields);

    const allErrors = [...headerErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return false;
    }

    const masterColumnDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype || null,
    }));
    const mstRow = buildSaveRowFromColumns(formValues, masterColumnDefs, {
      loginid: session.loginId,
      sessionid: DEFAULT_SESSION_ID,
      prmentrytype: SM_CONFIG.ENTRY_TYPE,
    });

    // Consignee Detail grid was removed from the UI, but the save proc's
    // parameter contract still expects prmStrConsigneeJSON — sending an
    // empty array rather than omitting the key (per explicit confirmation;
    // omitting it risked an unverified backend contract mismatch).
    const payload = withSaveContextFields(
      buildSaveJsonFields({
        label: SM_CONFIG.FORM_TAG,
        mst: mstRow,
        extra: {
          prmStrConsigneeJSON: JSON.stringify([]),
        },
      }),
      { divisionId: 0, isEdit: !isAddMode }
    );

    setIsSaving(true);
    try {
      const result = await post(SM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      onSaved?.();
      return true;
    } catch (err) {
      console.error("[SM Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [formValues, visibleFields, headerColumns, isAddMode, session, post, notify, onSaved]);

  const handleDiscardConfirm = useCallback(() => {
    const action = discardAction;
    setDiscardAction(null);
    if (action === "close") {
      onClose?.();
    } else {
      if (isAddMode) { onClose?.(); return; }
      setIsEditMode(false);
    }
  }, [discardAction, isAddMode, onClose]);

  const handleClose = useCallback(() => {
    if (!isEditMode) { onClose?.(); return; }
    setDiscardAction("close");
  }, [isEditMode, onClose]);

  const handleCancelEdit = useCallback(() => setDiscardAction("cancel"), []);

  const combinedError = headerError || recordLoadError;
  const isLoading = headerFetching || recordLoading;

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? MODAL_TITLE_ADD : MODAL_TITLE_EDIT}
      subtitle={MODAL_SUBTITLE}
      icon={<Truck size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      dialogClassName="modal-dialog--supplier"
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
      ) : combinedError ? (
        <div className="master-modal-error">
          <AlertCircle size={14} strokeWidth={2} /> {combinedError}
        </div>
      ) : (
        <>
          <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
          <div className="sm-form-scroll">
            <div className="sm-form-layout">
              <div className="sm-form-layout__left">
                <section className="sm-form-section sm-form-section--main">
                  <div className="sm-form-section__body">
                    {renderPanelBody(layout.mainRows, "main")}
                  </div>
                </section>
              </div>
              <div className="sm-form-layout__right">
                <section className="sm-form-section sm-form-section--transporter">
                  <h3 className="sm-form-section__title">{SM_FORM_LAYOUT.right.transporter.title}</h3>
                  <div className="sm-form-section__body">
                    {renderPanelBody(layout.transporterRows, "transporter")}
                  </div>
                </section>
                <section className="sm-form-section sm-form-section--tds">
                  <h3 className="sm-form-section__title">{SM_FORM_LAYOUT.right.tds.title}</h3>
                  <div className="sm-form-section__body">
                    {renderPanelBody(layout.tdsRows, "tds")}
                  </div>
                </section>
                <section className="sm-form-section sm-form-section--bank">
                  <h3 className="sm-form-section__title">{SM_FORM_LAYOUT.right.bank.title}</h3>
                  <div className="sm-form-section__body">
                    {renderPanelBody(layout.bankRows, "bank")}
                  </div>
                </section>
                <section className="sm-form-section sm-form-section--contact">
                  <h3 className="sm-form-section__title">{SM_FORM_LAYOUT.right.contact.title}</h3>
                  <div className="sm-form-section__body">
                    {renderPanelBody(layout.contactRows, "contact")}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
