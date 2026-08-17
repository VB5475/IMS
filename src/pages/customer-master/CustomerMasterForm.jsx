// CustomerMasterForm.jsx
// Customer Master entry form — clone of SupplierMasterForm.jsx. Customer and
// Supplier share the exact same backend RB codes/SPs/layout (see
// customer-master/constants.js); the only functional difference is the
// prmentrytype discriminator ("C" here vs "S" for Supplier) sent on save.
// (Consignee Detail grid removed — matches Supplier Master; see
// SupplierMasterForm.jsx for the removal rationale. prmStrConsigneeJSON is
// still sent as an empty array since the save proc's parameter contract
// still expects it.)

import React, { useEffect, useState, useCallback, useMemo, lazy, Suspense } from "react";
import { AlertCircle, Save, Pencil, UserCheck, FileText } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterFormField from "../../components/forms/MasterFormField";
const DocumentLogModal = lazy(() => import("../../components/txn/DocumentLogModal"));
import { DOCUMENT_LOG_CONFIG as DOC_LOG_CFG } from "../../components/txn/documentLogConfig";
import { useNotification } from "../../context/NotificationContext";
import { useApi } from "../../api/useApi";
import { useDocumentLogAccess } from "../../hooks/useDocumentLogAccess";
import {
  API_BASE_URL_IMS,
  DEFAULT_SESSION_ID,
  getColDefault,
  buildSaveRowFromColumns,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { validateApiColumnsByField } from "../../utils/columnValidation";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import {
  getMasterFieldLabel,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterToggleField,
} from "../../utils/masterFormUtils";
import {
  CM_CONFIG,
  CM_FORM_LAYOUT,
  CM_CHECKBOX_OVERRIDE_FIELDS,
  resolveCmLayoutField,
  getCmLayoutFieldNames,
  MODAL_TITLE_ADD,
  MODAL_TITLE_EDIT,
  MODAL_SUBTITLE,
  controlTypeMap,
} from "./constants";
import "../supplier-master/SupplierMasterPage.css";

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
    if (CM_CHECKBOX_OVERRIDE_FIELDS.has(f.colname)) {
      map[f.colname] = { ...f, colctrltype: controlTypeMap.CHECKBOX };
    } else {
      map[f.colname] = f;
    }
  });
  return map;
}

function resolveLayoutFields(fields, fieldMap) {
  return fields.map((name) => resolveCmLayoutField(fieldMap, name)).filter(Boolean);
}

export default function CustomerMasterForm({
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
  const [fieldErrors, setFieldErrors] = useState({});

  const [fieldValidationFailed, setFieldValidationFailed] = useState(false);

  // 2026-08-14 (/pm) — fieldValidationFailed (drives the Save button's
  // "Please fix the highlighted field(s) below." tooltip) is only ever SET
  // by handleSave; nothing clears it back to false as the user fixes fields
  // one at a time (the field change handler only clears fieldErrors for the
  // field just edited) — so the blocked/tooltip state can outlive every
  // actual field error. Clear it once fieldErrors is genuinely empty.
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) setFieldValidationFailed(false);
  }, [fieldErrors]);
  const { post } = useApi(API_BASE_URL_IMS);

  const session = getUserSession();

  // fieldMap keyed by lowercase colname (PG)
  const fieldMap = useMemo(() => buildFieldMap(headerColumns), [headerColumns]);

  const layout = useMemo(() => ({
    mainFields: resolveLayoutFields(CM_FORM_LAYOUT.main.fields, fieldMap),
    transporterFields: resolveLayoutFields(CM_FORM_LAYOUT.transporter.fields, fieldMap),
    tdsFields: resolveLayoutFields(CM_FORM_LAYOUT.tds.fields, fieldMap),
    bankFields: resolveLayoutFields(CM_FORM_LAYOUT.bank.fields, fieldMap),
    contactFields: resolveLayoutFields(CM_FORM_LAYOUT.contact.fields, fieldMap),
  }), [fieldMap]);

  // Ordered list of visible fields for validation (from layout definition)
  const visibleFields = useMemo(() => {
    const names = new Set(getCmLayoutFieldNames(fieldMap));
    return headerColumns.filter((f) => names.has(f.colname));
  }, [fieldMap, headerColumns]);

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
      funccode: CM_CONFIG.RB_MASTER,
      idnumber: recordId || 0,
    };
  }, [headerColumns, recordId, session.companyId, session.yearId, session.loginId]);

  const [formValues, setFormValues] = useState({});
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(isAddMode);
  const [isSaving, setIsSaving] = useState(false);
  const [discardAction, setDiscardAction] = useState(null);

  // Document Log ("Documents" button, 2026-08-13 /pm) — recordId is this
  // master's own idnumber, already passed in as a prop (0/falsy for a
  // not-yet-saved Add record, same semantic as a transaction's tranid=0).
  const docLog = useDocumentLogAccess({
    tranTypeId: CM_CONFIG.DM_TRAN_TYPE_ID,
    // Module-wise department id (2026-08-14, /pm) — DM Department Master
    // id=6 for Customer Master, no longer the shared ADMIN_REF_DEPARTMENT_ID.
    refDepartmentId: DOC_LOG_CFG.REF_DEPARTMENT_ID.CUSTOMER_MASTER,
    recordId: Number(recordId) || 0,
    getDivisionId: () => 0, // Customer Master isn't division-scoped (see handleSave's own divisionId: 0)
    isEditMode,
    postSave: post,
    logLabel: "[CustomerMaster]",
  });

  // Reset form state each time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setFormErrors([]);
    setFieldErrors({});
    setFieldValidationFailed(false);
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
        console.error("[CM] loadEditRecord failed:", err);
        setRecordLoadError(err?.message || "Failed to load record.");
      })
      .finally(() => setRecordLoading(false));
  }, [isOpen, isAddMode, recordId, fetchEditRecord, buildEmptyFromColumns, fetchStateOptions, fetchCityOptions]);

  // Country → State → City cascade + TDS gate reset
  const handleChange = useCallback((key, value) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
        inputClassName="sm-form-input"
        valueClassName="sm-form-value"
        toggleClassName="sm-form-toggle"
        error={fieldErrors[key]}
      />
    );
  }

  function renderFieldCell(field) {
    return (
      <div key={field.colname} className="sm-form-field">
        <span className={`sm-form-label${field.ismandatory ? " sm-form-label--required" : ""}`}>
          {getMasterFieldLabel(field)}
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

  // Uniform 5-per-row grid — fields auto-flow and wrap to a new row every 5
  // items (see .sm-form-section__body, shared CSS with Supplier Master),
  // instead of hand-curated 1-or-2-field rows.
  function renderPanelBody(fields) {
    return fields.map((field) => renderFieldCell(field));
  }

  // ── Save ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setFormErrors([]);
    setFieldValidationFailed(false);
    const fieldErrorMap = validateApiColumnsByField(formValues, visibleFields);
    setFieldErrors(fieldErrorMap);

    if (Object.keys(fieldErrorMap).length > 0) {
      setFieldValidationFailed(true);
      setFormErrors([]);
      return false;
    }

    const masterColumnDefs = headerColumns.map((col) => ({
      key: col.colname,
      colDataType: col.coldatatype || null,
    }));
    const mstRow = buildSaveRowFromColumns(formValues, masterColumnDefs, {
      loginid: session.loginId,
      sessionid: DEFAULT_SESSION_ID,
      prmentrytype: CM_CONFIG.ENTRY_TYPE,
    });

    // Consignee Detail grid was removed from the UI, but the save proc's
    // parameter contract still expects prmStrConsigneeJSON — sending an
    // empty array rather than omitting the key (matches Supplier Master).
    const payload = withSaveContextFields(
      buildSaveJsonFields({
        label: CM_CONFIG.FORM_TAG,
        mst: mstRow,
        extra: {
          prmStrConsigneeJSON: JSON.stringify([]),
        },
      }),
      { divisionId: 0, isEdit: !isAddMode }
    );

    setIsSaving(true);
    try {
      const result = await post(CM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message, newId } = parseApiErrMsg(result);
      if (!success) { setFormErrors([message]); return false; }
      notify.success(message);
      // Same Add-mode gap this closes for transaction forms: recordId (the
      // prop) is only the real id on an Edit save; newId is the real saved
      // id either way.
      const savedTranId = newId ?? (!isAddMode ? Number(recordId) || null : null);
      await docLog.finalizeSave(savedTranId);
      onSaved?.();
      return true;
    } catch (err) {
      console.error("[CM Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [formValues, visibleFields, headerColumns, isAddMode, recordId, session, post, notify, onSaved, docLog.finalizeSave]);

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
    // This form's own Modal instance stays mounted across opens (parent
    // page toggles `isOpen`), so the Documents sub-modal must be explicitly
    // closed here — it wouldn't otherwise, and would linger stacked over
    // whatever the parent list page renders once this modal hides.
    docLog.setDocModalOpen(false);
    if (!isEditMode) { onClose?.(); return; }
    setDiscardAction("close");
  }, [isEditMode, onClose, docLog.setDocModalOpen]);

  const handleCancelEdit = useCallback(() => setDiscardAction("cancel"), []);

  const combinedError = headerError || recordLoadError;
  const isLoading = headerFetching || recordLoading;

  // Documents button — hide/show only (2026-08-17 /pm), no disabled state.
  // Rendered only when Document Log is enabled for this login + trantype
  // AND Add/Edit mode is actually active; hidden entirely otherwise.
  const documentsButton = useMemo(
    () =>
      docLog.isDocumentLogEnabled ? (
        <button
          type="button"
          className="master-modal-btn master-modal-btn--secondary"
          onClick={docLog.handleOpenDocuments}
          title="Document Log (F6)"
        >
          <FileText size={13} strokeWidth={2} /> Documents
        </button>
      ) : null,
    [docLog.isDocumentLogEnabled, docLog.handleOpenDocuments]
  );

  const footer = useMemo(() => {
    if (!isEditMode) {
      return (
        <div className="master-modal-footer-actions">
          {documentsButton}
          <button type="button" className="master-modal-btn master-modal-btn--edit"
                  onClick={() => setIsEditMode(true)}>
            <Pencil size={13} strokeWidth={2} /> Edit
          </button>
        </div>
      );
    }
    return (
      <div className="master-modal-footer-actions">
        {documentsButton}
        <button type="button" className="master-modal-btn master-modal-btn--save"
                onClick={handleSave} disabled={isSaving}>
          <Save size={13} strokeWidth={2} />
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="master-modal-btn master-modal-btn--cancel"
                onClick={handleCancelEdit} disabled={isSaving}>
          Cancel
        </button>
      </div>
    );
  }, [isEditMode, isSaving, handleCancelEdit, handleSave, documentsButton]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? MODAL_TITLE_ADD : MODAL_TITLE_EDIT}
      subtitle={MODAL_SUBTITLE}
      icon={<UserCheck size={16} strokeWidth={2} />}
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
          <AlertPanel
            errors={formErrors}
            title={fieldValidationFailed ? "Please fix the highlighted field(s) below." : undefined}
            onDismiss={() => setFormErrors([])}
          />
          <div className="sm-form-scroll">
            <div className="sm-form-layout">
              <section className="sm-form-section sm-form-section--main">
                <div className="sm-form-section__body">
                  {renderPanelBody(layout.mainFields)}
                </div>
              </section>
              <section className="sm-form-section sm-form-section--transporter">
                <h3 className="sm-form-section__title">{CM_FORM_LAYOUT.transporter.title}</h3>
                <div className="sm-form-section__body">
                  {renderPanelBody(layout.transporterFields)}
                </div>
              </section>
              <section className="sm-form-section sm-form-section--tds">
                <h3 className="sm-form-section__title">{CM_FORM_LAYOUT.tds.title}</h3>
                <div className="sm-form-section__body">
                  {renderPanelBody(layout.tdsFields)}
                </div>
              </section>
              <section className="sm-form-section sm-form-section--bank">
                <h3 className="sm-form-section__title">{CM_FORM_LAYOUT.bank.title}</h3>
                <div className="sm-form-section__body">
                  {renderPanelBody(layout.bankFields)}
                </div>
              </section>
              <section className="sm-form-section sm-form-section--contact">
                <h3 className="sm-form-section__title">{CM_FORM_LAYOUT.contact.title}</h3>
                <div className="sm-form-section__body">
                  {renderPanelBody(layout.contactFields)}
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      <Suspense fallback={null}>
        <DocumentLogModal
          ref={docLog.docModalRef}
          isOpen={docLog.docModalOpen}
          onClose={() => docLog.setDocModalOpen(false)}
          tranId={Number(recordId) || 0}
          divisionId={0}
          tranTypeId={CM_CONFIG.DM_TRAN_TYPE_ID}
          refDepartmentId={DOC_LOG_CFG.REF_DEPARTMENT_ID.CUSTOMER_MASTER}
          guid={docLog.docGuid}
        />
      </Suspense>
    </Modal>
  );
}
