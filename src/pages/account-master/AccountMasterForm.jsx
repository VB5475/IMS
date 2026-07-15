import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BookUser, Save, Pencil, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import AlertPanel from "../../components/ui/AlertPanel";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterFormField from "../../components/forms/MasterFormField";
import { API_BASE_URL_IMS, DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { withSaveContextFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { pickApiField } from "../../utils/columnValidation";
import { useNotification } from "../../context/NotificationContext";
import {
  buildMasterCascadeDropdownRefresh,
  buildMasterCascadeResets,
  buildMasterFormEmpty,
  finalizeMasterHeaderSaveRow,
  getMasterFieldDefaultValue,
  getMasterFieldLabel,
  getCheckboxValue,
  getToggleValue,
  getVisibleHeaderFields,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterFieldRequired,
  isMasterToggleField,
  validateMasterFormFields,
} from "../../utils/masterFormUtils";
import { AM_CONFIG } from "./constants";
import { AM_FORM_LAYOUT, buildAccountMasterLayout } from "./formLayout";
import "./AccountMasterPage.css";

/** MRD §3 — bank detail colnames when UpdateKeyColName cascade is not configured in API. */
const BANK_DETAIL_COL_FALLBACK = new Set(["bankname", "accountno", "bankaddress", "ifsccode"]);

function buildSaveContext() {
  const session = getUserSession();
  return {
    companyid: session.companyId,
    yearid: session.yearId,
    loginid: session.loginId,
    sessionid: DEFAULT_SESSION_ID,
    funccode: AM_CONFIG.RB_MASTER,
  };
}

/** Resolve a column key from GET_DETAIL_COL_DATA (case-insensitive). */
function resolveColKey(fieldDefs, ...candidates) {
  const wanted = new Set(candidates.map((c) => String(c).toLowerCase()));
  const hit = (fieldDefs || []).find((f) =>
    wanted.has(String(pickApiField(f, "ColName", "colname") ?? "").toLowerCase())
  );
  return pickApiField(hit, "ColName", "colname") ?? candidates[0] ?? "";
}

/** MRD — "Is Bank Account" flag field from API metadata. */
function findBankFlagField(fieldDefs) {
  return (fieldDefs || []).find((f) => {
    const col = String(pickApiField(f, "ColName", "colname") ?? "").toLowerCase();
    const label = String(pickApiField(f, "DisplayName", "displayname") ?? "").toLowerCase();
    return col === "isdaybook" || label.includes("bank account");
  });
}

function isBankDetailColName(colName, bankFlagCol, cascadeChildNames) {
  const lower = String(colName ?? "").toLowerCase();
  if (cascadeChildNames.length) {
    return cascadeChildNames.some((c) => String(c).toLowerCase() === lower);
  }
  return BANK_DETAIL_COL_FALLBACK.has(lower);
}

function isBankFlagOn(field, formValues, colName) {
  if (!colName) return false;
  const raw = formValues[colName];
  if (field && isMasterCheckboxField(field)) return getCheckboxValue(raw) === 1;
  return getToggleValue(raw) === 1;
}

export default function AccountMasterForm({
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
  const notify = useNotification();

  const [isEditMode, setIsEditMode] = useState(true);
  const [formValues, setFormValues] = useState(() =>
    buildMasterFormEmpty(fieldDefs, buildSaveContext())
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [discardAction, setDiscardAction] = useState(null);

  const visibleFields = useMemo(() => getVisibleHeaderFields(fieldDefs), [fieldDefs]);
  const cascadeResets = useMemo(() => buildMasterCascadeResets(fieldDefs), [fieldDefs]);
  const cascadeDropdownRefresh = useMemo(
    () => buildMasterCascadeDropdownRefresh(fieldDefs),
    [fieldDefs]
  );

  const bankFlagField = useMemo(() => findBankFlagField(fieldDefs), [fieldDefs]);
  const bankFlagCol = bankFlagField?.ColName ?? "";
  const bankCascadeChildNames = useMemo(
    () => (bankFlagCol ? cascadeResets[bankFlagCol] ?? [] : []),
    [bankFlagCol, cascadeResets]
  );

  const countryCol = useMemo(
    () => resolveColKey(fieldDefs, "countryid", "CountryID"),
    [fieldDefs]
  );
  const stateCol = useMemo(() => resolveColKey(fieldDefs, "stated", "StateID"), [fieldDefs]);

  const showBankSection = useMemo(
    () => isBankFlagOn(bankFlagField, formValues, bankFlagCol),
    [bankFlagField, bankFlagCol, formValues]
  );

  const coreFields = useMemo(
    () =>
      visibleFields.filter(
        (f) => !isBankDetailColName(f.ColName, bankFlagCol, bankCascadeChildNames)
      ),
    [visibleFields, bankFlagCol, bankCascadeChildNames]
  );

  const bankFields = useMemo(
    () =>
      visibleFields.filter((f) =>
        isBankDetailColName(f.ColName, bankFlagCol, bankCascadeChildNames)
      ),
    [visibleFields, bankFlagCol, bankCascadeChildNames]
  );

  const bankFlagLabel = bankFlagField
    ? getMasterFieldLabel(bankFlagField)
    : "Is Bank Account";

  const layout = useMemo(
    () => buildAccountMasterLayout(coreFields),
    [coreFields]
  );

  const bankRows2 = useMemo(() => {
    const rows = [];
    for (let i = 0; i < bankFields.length; i += 2) {
      rows.push(bankFields.slice(i, i + 2));
    }
    return rows;
  }, [bankFields]);

  useEffect(() => {
    if (!isOpen) return;
    setIsEditMode(isAddMode);
    setSaveError(null);
    const empty = buildMasterFormEmpty(fieldDefs, buildSaveContext());
    if (isAddMode) {
      setFormValues(empty);
      return;
    }
    if (editPrefill?.headerValues) {
      setFormValues({ ...empty, ...editPrefill.headerValues });

      // State/City are cascading dropdowns — they only load their real,
      // correctly-labeled option list when their parent field changes via
      // handleChange. On edit-load that never fires, so without this they're
      // stuck with seedOptionsFromMaster's single ID-as-label fallback (the
      // master-fill row has stateid/cityid but no statename/cityname).
      if (countryCol) {
        Promise.resolve(onRefreshDropdowns?.(countryCol, editPrefill.headerValues)).then(() => {
          if (stateCol) onRefreshDropdowns?.(stateCol, editPrefill.headerValues);
        });
      }
    }
  }, [isOpen, isAddMode, editPrefill, fieldDefs, countryCol, stateCol, onRefreshDropdowns]);

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

        if (bankFlagCol && key === bankFlagCol && !isBankFlagOn(bankFlagField, { [key]: value }, key)) {
          bankFields.forEach((field) => {
            next[field.ColName] = getMasterFieldDefaultValue(field);
          });
        }

        return next;
      });

      const keyLower = key.toLowerCase();

      if (countryCol && keyLower === countryCol.toLowerCase()) {
        onRefreshDropdowns?.(key, { ...formValues, [key]: value });
        return;
      }
      if (stateCol && keyLower === stateCol.toLowerCase()) {
        onRefreshDropdowns?.(key, { ...formValues, [key]: value });
        return;
      }

      if (cascadeDropdownRefresh[key]?.length) {
        onRefreshDropdowns?.(key);
      }
    },
    [
      cascadeResets,
      cascadeDropdownRefresh,
      fieldDefs,
      onRefreshDropdowns,
      formValues,
      bankFlagCol,
      bankFlagField,
      bankFields,
      countryCol,
      stateCol,
    ]
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
        inputClassName="am-form-input"
        valueClassName="am-form-value"
      />
    );
  }

  const handleSave = useCallback(async () => {
    const fieldsToValidate = visibleFields.filter(
      (f) => showBankSection || !isBankDetailColName(f.ColName, bankFlagCol, bankCascadeChildNames)
    );

    const validationErrors = validateMasterFormFields(fieldsToValidate, formValues, {
      skipMandatoryFor: new Set(
        fieldsToValidate
          .filter((f) => isMasterToggleField(f) || isMasterCheckboxField(f))
          .map((f) => f.ColName)
      ),
    });

    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setFormErrors([]);
    setSaveError(null);
    setIsSaving(true);
    try {
      const saveRow = finalizeMasterHeaderSaveRow(fieldDefs, formValues, {
        fieldsToFinalize: visibleFields,
      });

      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        { divisionId: 0, isEdit: !isAddMode }
      );

      const result = await post(AM_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setSaveError(message);
        return;
      }
      notify.success(message || "Account saved successfully!");
      onSaved?.();
    } catch (err) {
      console.error("[AM Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    visibleFields,
    formValues,
    fieldDefs,
    isAddMode,
    onSaved,
    post,
    notify,
    showBankSection,
    bankFlagCol,
    bankCascadeChildNames,
  ]);

  const handleDiscardConfirm = useCallback(() => {
    const action = discardAction;
    setDiscardAction(null);
    if (action === "close") {
      onClose();
    } else {
      if (isAddMode) {
        onClose();
        return;
      }
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

  function renderGridCell(field) {
    const toggle = isMasterToggleField(field);
    const checkbox = isMasterCheckboxField(field);
    return (
      <div key={field.ColName} className="am-form-cell">
        <span
          className={`am-form-label${isMasterFieldRequired(field) ? " am-form-label--required" : ""
            }`}
        >
          {getMasterFieldLabel(field)}
        </span>
        <div
          className={`am-form-control${toggle ? " am-form-control--toggle-wrap" : ""
            }${checkbox ? " am-form-control--checkbox" : ""}`}
        >
          {renderControl(field)}
        </div>
      </div>
    );
  }

  function renderGridRow(fields, cols, rowKey) {
    if (!fields?.length) return null;
    const pad = Math.max(0, cols - fields.length);
    return (
      <div key={rowKey} className={`am-form-grid-row am-form-grid-row--${cols}`}>
        {fields.map((field) => renderGridCell(field))}
        {pad > 0 &&
          Array.from({ length: pad }).map((_, i) => (
            <div key={`${rowKey}-pad-${i}`} className="am-form-cell am-form-cell--empty" aria-hidden />
          ))}
      </div>
    );
  }

  function renderCheckboxRow(fields) {
    if (!fields?.length) return null;
    const pad = Math.max(0, 4 - fields.length);
    return (
      <div className="am-form-checkbox-row">
        {fields.map((field) => (
          <div key={field.ColName} className="am-form-checkbox-cell">
            <span
              className={`am-form-checkbox-label${isMasterFieldRequired(field) ? " am-form-label--required" : ""
                }`}
            >
              {getMasterFieldLabel(field)}
            </span>
            <div className="am-form-control">{renderControl(field)}</div>
          </div>
        ))}
        {pad > 0 &&
          Array.from({ length: pad }).map((_, i) => (
            <div key={`flag-pad-${i}`} className="am-form-checkbox-cell am-form-cell--empty" aria-hidden />
          ))}
      </div>
    );
  }

  function renderLinkRefSection() {
    const { locationRow3, taxRow3, linkRefRows2 } = layout;
    const hasContent =
      locationRow3.length > 0 || taxRow3.length > 0 || linkRefRows2.length > 0;
    if (!hasContent) return null;

    return (
      <section className="am-form-section">
        <h3 className="am-form-section__title">{AM_FORM_LAYOUT.linkRef.title}</h3>
        <div className="am-form-section__body">
          {renderGridRow(locationRow3, 3, "ref-loc")}
          {renderGridRow(taxRow3, 3, "ref-tax")}
          {linkRefRows2.map((row, i) => renderGridRow(row, 2, `ref-${i}`))}
        </div>
      </section>
    );
  }

  function renderDivisionPanel() {
    const { allDivisionField, divisionFields } = layout;
    if (!allDivisionField && !divisionFields.length) return null;

    return (
      <div className="am-form-division-panel">
        <div className="am-form-division-panel__toolbar">
          <span className="am-form-division-panel__title">Division</span>
          {allDivisionField && (
            <div className="am-form-division-panel__all">
              <span className="am-form-checkbox-label">
                {getMasterFieldLabel(allDivisionField)}
              </span>
              {renderControl(allDivisionField)}
            </div>
          )}
        </div>
        <div className="am-form-division-panel__body">
          {divisionFields.length > 0 ? (
            divisionFields.map((field) => (
              <div key={field.ColName} className="am-form-division-field">
                {renderControl(field)}
              </div>
            ))
          ) : (
            <p className="am-form-division-panel__hint">
              Select divisions for this account when division assignment is enabled.
            </p>
          )}
        </div>
      </div>
    );
  }

  function renderFormSections() {
    return (
      <>
        <section className="am-form-section">
          <h3 className="am-form-section__title">Account Details</h3>
          <div className="am-form-section__body">
            {layout.accountRows2.map((row, i) => renderGridRow(row, 2, `acc-2-${i}`))}
            {renderGridRow(layout.classificationRow3, 3, "acc-3-class")}
          </div>
        </section>

        {renderLinkRefSection()}

        {renderCheckboxRow(layout.flagFields)}

        {layout.remainderRows2.map((row, i) => renderGridRow(row, 2, `rem-${i}`))}

        {renderDivisionPanel()}

        {bankFields.length > 0 && (
          <section className="am-form-section">
            <div className="am-form-section-header">
              Bank Details
              {!showBankSection && ` — enable “${bankFlagLabel}” to edit`}
            </div>
            {showBankSection && (
              <div className="am-form-section__body">
                {bankRows2.map((row, i) => renderGridRow(row, 2, `bank-${i}`))}
              </div>
            )}
          </section>
        )}
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAddMode ? "New Account" : "Edit Account"}
      subtitle="Admin › Account › Account Master"
      icon={<BookUser size={16} strokeWidth={2} />}
      size="xl"
      variant="enterprise"
      dialogClassName="modal-dialog--account-master"
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
          <div className="am-form-scroll">
            <div className="am-form">{renderFormSections()}</div>
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
