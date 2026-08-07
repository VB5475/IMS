import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Handshake, Save, AlertCircle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import MasterFormField from "../../components/forms/MasterFormField";
import {
  API_BASE_URL_IMS,
  DEFAULT_COMPANY_ID,
  DEFAULT_LOGIN_ID,
  DEFAULT_SESSION_ID,
} from "../../api/constants";
import { useApi } from "../../api/useApi";
import { useNotification } from "../../context/NotificationContext";
import { withSaveContextFields } from "../../utils/savePayload";
import {
  buildMasterCascadeResets,
  buildMasterFormEmpty,
  finalizeMasterHeaderSaveRow,
  getMasterFieldDefaultValue,
  getMasterFieldLabel,
  getVisibleHeaderFields,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterFieldRequired,
  isMasterToggleField,
  validateMasterFormFields,
  // alertMasterFormValidationErrors,
  // runAfterFieldBlur,
} from "../../utils/masterFormUtils";
import { useMntCallFollowUp, resolveDashboardRowId } from "../../hooks/useMntCallFollowUp";
import { MNT_FOLLOWUP_CONFIG, MODAL_TITLE, MODAL_SUBTITLE } from "./constants";
import "../account-group-master/AccountGroupMasterPage.css";
import "./CallFollowUpPage.css";

function buildSaveContext() {
  return {
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: MNT_FOLLOWUP_CONFIG.CONFIG_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    SessionID: DEFAULT_SESSION_ID,
    FuncCode: MNT_FOLLOWUP_CONFIG.RB_MASTER,
  };
}

/**
 * Call Follow Up popup — controls from RB rb_mntfollowup, values from fn_tbl_rb_mntfollowup.
 * Open sequence (MRD §5 / §5.1):
 *   1. Fn_Fetch_RBDetailByRBCode + GetDetailColData → form controls
 *   2. fn_tbl_rb_mntfollowup → fill header values
 */
export default function CallFollowUpForm({
  isOpen = false,
  onClose,
  onSaved,
  dashboardRow = null,
  filterContext = {},
}) {
  const notify = useNotification();
  const { post } = useApi(API_BASE_URL_IMS);

  const {
    headerColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchPopupRecord,
    seedOptionsFromMaster,
    resetMeta,
  } = useMntCallFollowUp();

  const [formValues, setFormValues] = useState(() =>
    buildMasterFormEmpty([], buildSaveContext())
  );
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const visibleFields = useMemo(() => getVisibleHeaderFields(headerColumns), [headerColumns]);
  const cascadeResets = useMemo(() => buildMasterCascadeResets(headerColumns), [headerColumns]);

  useEffect(() => {
    if (!isOpen) {
      resetMeta();
      setFormValues(buildMasterFormEmpty([], buildSaveContext()));
      setRecordLoadError(null);
      setSaveError(null);
      setRecordLoading(false);
      return undefined;
    }

    if (!dashboardRow) {
      setRecordLoadError("No maintenance call was selected for Vendor Follow Up.");
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setRecordLoading(true);
      setRecordLoadError(null);
      setSaveError(null);

      try {
        const fieldDefs = await fetchHeaderMeta();
        if (cancelled) return;

        const { master, headerValues } = await fetchPopupRecord({
          dashboardRow,
          fieldDefs,
        });
        if (cancelled) return;

        if (!master || !headerValues) {
          setRecordLoadError("Follow-up data could not be loaded for the selected record.");
          setFormValues(buildMasterFormEmpty(fieldDefs, buildSaveContext()));
          return;
        }

        seedOptionsFromMaster(master, fieldDefs);
        setFormValues({
          ...buildMasterFormEmpty(fieldDefs, buildSaveContext()),
          ...headerValues,
        });
      } catch (err) {
        if (cancelled) return;
        setRecordLoadError(err?.message || "Failed to load Vendor Follow Up form.");
      } finally {
        if (!cancelled) setRecordLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dashboardRow]);

  const handleChange = useCallback(
    (key, value) => {
      setFormValues((prev) => {
        const next = { ...prev, [key]: value };
        const resetKeys = cascadeResets[key];
        if (resetKeys?.length) {
          resetKeys.forEach((resetKey) => {
            const field = headerColumns.find((f) => f.ColName === resetKey);
            next[resetKey] = field ? getMasterFieldDefaultValue(field) : "";
          });
        }
        return next;
      });
    },
    [cascadeResets, headerColumns]
  );

  function renderControl(field) {
    const key = field.ColName;
    const mrdEditable = MNT_FOLLOWUP_CONFIG.EDITABLE_FIELDS.has(String(key || "").toLowerCase());
    const locked =
      !mrdEditable
      || isMasterFieldLocked(field, { isAddMode: true, isEditMode: true });
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={locked}
        options={dropdownOptions[key] || []}
        inputClassName="mfu-form-input"
        textareaClassName="mfu-form-textarea"
        valueClassName="mfu-form-value"
      />
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

    // if (alertMasterFormValidationErrors(validationErrors)) return;

    setSaveError(null);
    setIsSaving(true);
    try {
      const dashboardRowId = resolveDashboardRowId(dashboardRow);
      const saveRow = {
        ...finalizeMasterHeaderSaveRow(headerColumns, formValues, {
          fieldsToFinalize: visibleFields,
        }),
        IDNumber: dashboardRowId,
        idnumber: dashboardRowId,
      };

      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([saveRow]),
          prmStrDetJSON: JSON.stringify([]),
        },
        {
          divisionId: Number(filterContext?.divisionid) || 0,
          isEdit: false,
        }
      );

      await post(MNT_FOLLOWUP_CONFIG.SAVE_ENDPOINT, payload);
      notify.success("Vendor follow-up saved successfully.");
      onSaved?.();
    } catch (err) {
      console.error("[MNT Call Follow Up Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [visibleFields, formValues, headerColumns, filterContext, dashboardRow, notify, onSaved, post]);

  const handleClose = useCallback(() => {
    // runAfterFieldBlur(() => {
    //   if (!window.confirm("Discard changes?")) return;
    //   onClose?.();
    // });
    if (!window.confirm("Discard changes?")) return;
    onClose?.();
  }, [onClose]);

  const footer = useMemo(
    () => (
      <div className="master-modal-footer-actions">
        <button
          type="button"
          className="master-modal-btn master-modal-btn--save"
          onClick={handleSave}
          disabled={isSaving || recordLoading || headerFetching}
        >
          <Save size={13} strokeWidth={2} />
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="master-modal-btn master-modal-btn--cancel"
          onClick={handleClose}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    ),
    [handleClose, handleSave, isSaving, recordLoading, headerFetching]
  );

  const isLoading = headerFetching || recordLoading;
  const combinedErr = headerError || recordLoadError;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={MODAL_TITLE}
      subtitle={MODAL_SUBTITLE}
      icon={<Handshake size={16} strokeWidth={2} />}
      size="lg"
      variant="enterprise"
      footer={footer}
    >
      {isLoading ? (
        <div className="master-modal-loader">Loading vendor follow-up…</div>
      ) : combinedErr ? (
        <div className="master-modal-error">
          <AlertCircle size={14} strokeWidth={2} /> {combinedErr}
        </div>
      ) : (
        <>
          <div className="mfu-form-scroll">
            <div className="mfu-form">
              {visibleFields.map((field) => (
                <div
                  key={field.ColName}
                  className={[
                    "mfu-form-row",
                    isMasterToggleField(field) ? "mfu-form-row--toggle" : "",
                    isMasterCheckboxField(field) ? "mfu-form-row--checkbox" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span
                    className={`mfu-form-label${isMasterFieldRequired(field) ? " mfu-form-label--required" : ""
                      }`}
                  >
                    {getMasterFieldLabel(field)}
                  </span>
                  <div className="mfu-form-control">
                    {renderControl(field)}
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
