import React, { useState, useEffect, useCallback, useMemo } from "react";
import { PhoneForwarded, Save, AlertCircle } from "lucide-react";
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
import { useMntCallAllocation, resolveDashboardRowId } from "../../hooks/useMntCallAllocation";
import { MNT_CALL_CONFIG, MODAL_TITLE, MODAL_SUBTITLE } from "./constants";
import "../account-group-master/AccountGroupMasterPage.css";
import "./CallAllocationPage.css";

function buildSaveContext() {
  return {
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: MNT_CALL_CONFIG.CONFIG_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    SessionID: DEFAULT_SESSION_ID,
    FuncCode: MNT_CALL_CONFIG.RB_MASTER,
  };
}

/**
 * Call Allocation popup — controls from RB rb_mntallocation, values from fn_tbl_rb_mntallocation.
 * Open sequence (MRD §5 / §5.1):
 *   1. Fn_Fetch_RBDetailByRBCode + GetDetailColData → form controls
 *   2. fn_tbl_rb_mntallocation → fill header values
 */
export default function CallAllocationForm({
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
  } = useMntCallAllocation();

  const [formValues, setFormValues] = useState(() =>
    buildMasterFormEmpty([], buildSaveContext())
  );
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordLoadError, setRecordLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const visibleFields = useMemo(() => getVisibleHeaderFields(headerColumns), [headerColumns]);
  const cascadeResets = useMemo(() => buildMasterCascadeResets(headerColumns), [headerColumns]);

  // On each open: load RB controls, then fill from selected dashboard row.
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
      setRecordLoadError("No maintenance call was selected for Call Allocation.");
      return undefined;
    }

    let cancelled = false;
    const divisionId = filterContext?.divisionid;
    const locationId = filterContext?.locationid;
    const deptId = filterContext?.deptid;

    (async () => {
      setRecordLoading(true);
      setRecordLoadError(null);
      setSaveError(null);

      try {
        // 1) RB structure → controls
        const fieldDefs = await fetchHeaderMeta();
        if (cancelled) return;

        // 2) Fill popup from selected dashboard row
        const { master, headerValues } = await fetchPopupRecord({
          dashboardRow,
          filterContext: {
            divisionid: divisionId,
            locationid: locationId,
            deptid: deptId,
          },
          fieldDefs,
        });
        if (cancelled) return;

        if (!master || !headerValues) {
          setRecordLoadError("Call allocation data could not be loaded for the selected record.");
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
        setRecordLoadError(err?.message || "Failed to load Call Allocation form.");
      } finally {
        if (!cancelled) setRecordLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally keyed to open + selected row + filter ids (not callback identities).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    dashboardRow,
    filterContext?.divisionid,
    filterContext?.locationid,
    filterContext?.deptid,
  ]);

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
    return (
      <MasterFormField
        field={field}
        value={formValues[key]}
        onChange={(val) => handleChange(key, val)}
        locked={isMasterFieldLocked(field, { isAddMode: true, isEditMode: true })}
        options={dropdownOptions[key] || []}
        inputClassName="mca-form-input"
        textareaClassName="mca-form-textarea"
        valueClassName="mca-form-value"
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

      await post(MNT_CALL_CONFIG.SAVE_ENDPOINT, payload);
      notify.success("Call allocation saved successfully.");
      onSaved?.();
    } catch (err) {
      console.error("[MNT Call Allocation Save] Failed:", err);
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
      icon={<PhoneForwarded size={16} strokeWidth={2} />}
      size="lg"
      variant="enterprise"
      footer={footer}
    >
      {isLoading ? (
        <div className="master-modal-loader">Loading call allocation…</div>
      ) : combinedErr ? (
        <div className="master-modal-error">
          <AlertCircle size={14} strokeWidth={2} /> {combinedErr}
        </div>
      ) : (
        <>
          <div className="mca-form-scroll">
            <div className="mca-form">
              {visibleFields.map((field) => (
                <div
                  key={field.ColName}
                  className={[
                    "mca-form-row",
                    isMasterToggleField(field) ? "mca-form-row--toggle" : "",
                    isMasterCheckboxField(field) ? "mca-form-row--checkbox" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span
                    className={`mca-form-label${isMasterFieldRequired(field) ? " mca-form-label--required" : ""
                      }`}
                  >
                    {getMasterFieldLabel(field)}
                  </span>
                  <div className="mca-form-control">
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
