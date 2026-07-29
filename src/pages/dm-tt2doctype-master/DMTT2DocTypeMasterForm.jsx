import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Save, AlertCircle } from "lucide-react";
import MasterFormField from "../../components/forms/MasterFormField";
import AlertPanel from "../../components/ui/AlertPanel";
import { API_BASE_URL_IMS, DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import {
  buildMasterFormEmpty,
  finalizeMasterHeaderSaveRow,
  getMasterFieldLabel,
  getVisibleHeaderFields,
  isMasterFieldLocked,
  isMasterFieldRequired,
} from "../../utils/masterFormUtils";
import { useNotification } from "../../context/NotificationContext";
import { TT2DOCTYPE_CONFIG } from "./constants";
import "../division-wise-rights/DivisionWiseRightsPage.css";
import "./DMTT2DocTypeMasterPage.css";

const LABEL_OVERRIDES = { [TT2DOCTYPE_CONFIG.HEADER_DEPARTMENT_COL]: "Department" };

function buildSaveContext() {
  const session = getUserSession();
  return {
    companyid: session.companyId,
    yearid: session.yearId,
    loginid: session.loginId,
    sessionid: DEFAULT_SESSION_ID,
    funccode: TT2DOCTYPE_CONFIG.RB_MASTER,
  };
}

function getHeaderFields(fieldDefs) {
  const order = [TT2DOCTYPE_CONFIG.HEADER_DEPARTMENT_COL, TT2DOCTYPE_CONFIG.HEADER_TRANTYPE_COL];
  const byName = new Map(getVisibleHeaderFields(fieldDefs).map((f) => [f.ColName, f]));
  return order.map((name) => byName.get(name)).filter(Boolean);
}

function allRowsChecked(rows) {
  return rows.length > 0 && rows.every((r) => r.checked);
}

function DocumentTypeGrid({ rows, onRowsChange, disabled }) {
  const selectAll = allRowsChecked(rows);

  const handleSelectAll = useCallback(() => {
    const checked = !selectAll;
    onRowsChange(rows.map((r) => ({ ...r, checked })));
  }, [rows, onRowsChange, selectAll]);

  const handleRowCheck = useCallback(
    (index, checked) => {
      onRowsChange(rows.map((r, i) => (i === index ? { ...r, checked } : r)));
    },
    [rows, onRowsChange]
  );

  return (
    <section className="dwr-rights-grid dwr-rights-grid--transaction">
      <header className="dwr-rights-grid__header">
        <div className="dwr-rights-grid__title-wrap">
          <span className="dwr-rights-grid__title-accent" aria-hidden />
          <span className="dwr-rights-grid__title">Document Types</span>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            className={`tt2doctype-select-all-btn${selectAll ? " tt2doctype-select-all-btn--active" : ""}`}
            onClick={handleSelectAll}
            disabled={disabled}
          >
            {selectAll ? "Deselect All" : "Select All"}
          </button>
        )}
      </header>

      <div
        className={`dwr-rights-grid__table-wrap${rows.length === 0 ? " dwr-rights-grid__table-wrap--empty" : ""}`}
      >
        {rows.length === 0 ? (
          <div className="dwr-rights-grid__empty">
            <span className="dwr-rights-grid__empty-icon" aria-hidden>
              —
            </span>
            Select a department to load document types
          </div>
        ) : (
          <table className="dwr-rights-grid__table">
            <thead>
              <tr>
                <th className="dwr-rights-grid__allow-col">Check</th>
                <th className="dwr-rights-grid__division-col">Document Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.documenttypeid}>
                  <td className="dwr-rights-grid__allow-col">
                    <div className="dwr-rights-grid__checkbox-wrap">
                      <input
                        type="checkbox"
                        className="master-form-checkbox"
                        checked={!!row.checked}
                        onChange={(e) => handleRowCheck(index, e.target.checked)}
                        disabled={disabled}
                      />
                    </div>
                  </td>
                  <td className="dwr-rights-grid__division-col">
                    <span className="dwr-rights-grid__division-name">{row.documenttype}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function DMTT2DocTypeMasterForm({
  fieldDefs = [],
  defsLoading = false,
  defsError = null,
  departmentOptions = [],
  onDepartmentChange,
}) {
  const { post } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [headerValues, setHeaderValues] = useState(() => buildMasterFormEmpty(fieldDefs, buildSaveContext()));
  const [tranTypeOptions, setTranTypeOptions] = useState([]);
  const [rows, setRows] = useState([]);
  const [gridsLoading, setGridsLoading] = useState(false);
  const [gridsError, setGridsError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [formErrors, setFormErrors] = useState([]);

  const headerFields = useMemo(() => getHeaderFields(fieldDefs), [fieldDefs]);
  const dropdownOptions = useMemo(
    () => ({
      [TT2DOCTYPE_CONFIG.HEADER_DEPARTMENT_COL]: departmentOptions,
      [TT2DOCTYPE_CONFIG.HEADER_TRANTYPE_COL]: tranTypeOptions,
    }),
    [departmentOptions, tranTypeOptions]
  );

  useEffect(() => {
    if (!fieldDefs.length) return;
    setHeaderValues(buildMasterFormEmpty(fieldDefs, buildSaveContext()));
    setTranTypeOptions([]);
    setRows([]);
    setSaveError(null);
    setGridsError(null);
  }, [fieldDefs]);

  const handleDepartmentChange = useCallback(
    async (departmentId) => {
      const normalized = Number(departmentId) || 0;
      const label = departmentOptions.find((o) => o.value === String(normalized))?.label ?? "";

      setHeaderValues((prev) => ({
        ...prev,
        [TT2DOCTYPE_CONFIG.HEADER_DEPARTMENT_COL]: normalized,
        [TT2DOCTYPE_CONFIG.HEADER_TRANTYPE_COL]: 0,
      }));
      setTranTypeOptions([]);
      setRows([]);
      setSaveError(null);

      if (!normalized || !onDepartmentChange) return;

      setGridsLoading(true);
      setGridsError(null);
      try {
        const { tranTypeOptions: options, documentTypeRows } = await onDepartmentChange(normalized, label);
        setTranTypeOptions(options ?? []);
        setRows(documentTypeRows ?? []);
      } catch (err) {
        setGridsError(err?.message || "Failed to load document types.");
      } finally {
        setGridsLoading(false);
      }
    },
    [onDepartmentChange, departmentOptions]
  );

  const handleHeaderChange = useCallback(
    (field, value) => {
      const key = field.ColName;
      if (key === TT2DOCTYPE_CONFIG.HEADER_DEPARTMENT_COL) {
        handleDepartmentChange(value);
        return;
      }
      setHeaderValues((prev) => ({ ...prev, [key]: value }));
    },
    [handleDepartmentChange]
  );

  const handleSave = useCallback(async () => {
    const departmentId = Number(headerValues[TT2DOCTYPE_CONFIG.HEADER_DEPARTMENT_COL]) || 0;
    const tranTypeId = Number(headerValues[TT2DOCTYPE_CONFIG.HEADER_TRANTYPE_COL]) || 0;
    const checkedRows = rows.filter((r) => r.checked);

    const errors = [];
    if (!departmentId) errors.push("Department is required.");
    if (!tranTypeId) errors.push("Tran Type is required.");
    if (departmentId && tranTypeId && checkedRows.length === 0) {
      errors.push("Select at least one Document Type.");
    }
    if (errors.length) {
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);
    setSaveError(null);
    setIsSaving(true);
    try {
      const mstRows = checkedRows.map((row) =>
        finalizeMasterHeaderSaveRow(fieldDefs, {
          ...headerValues,
          [TT2DOCTYPE_CONFIG.HEADER_DEPARTMENT_COL]: departmentId,
          [TT2DOCTYPE_CONFIG.HEADER_TRANTYPE_COL]: tranTypeId,
          [TT2DOCTYPE_CONFIG.GRID_DOCTYPE_COL]: row.documenttypeid,
        })
      );

      const payload = withSaveContextFields(
        buildSaveJsonFields({ label: TT2DOCTYPE_CONFIG.FORM_TAG, mst: mstRows }),
        { divisionId: 0, isEdit: false }
      );

      const result = await post(TT2DOCTYPE_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setSaveError(message);
        return;
      }
      notify.success(message || `Saved ${checkedRows.length} document type mapping(s).`);
    } catch (err) {
      console.error("[TT2DocType Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [headerValues, rows, fieldDefs, post, notify]);

  const isLoading = defsLoading;
  const combinedErr = defsError || gridsError;
  const departmentSelected = !!headerValues[TT2DOCTYPE_CONFIG.HEADER_DEPARTMENT_COL];

  return (
    <div className="workspace-page dwr-page">
      <section className="dwr-panel dwr-panel--fill">
        {isLoading ? (
          <div className="master-modal-loader">Loading…</div>
        ) : combinedErr && !departmentSelected ? (
          <div className="master-modal-error dwr-panel__error">
            <AlertCircle size={14} strokeWidth={2} /> {combinedErr}
          </div>
        ) : (
          <>
            <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
            <div className="dwr-form">
              {headerFields.map((field) => {
                const key = field.ColName;
                const isTranType = key === TT2DOCTYPE_CONFIG.HEADER_TRANTYPE_COL;
                return (
                  <div key={key} className="dwr-form-row">
                    <span
                      className={`dwr-form-label${isMasterFieldRequired(field) ? " dwr-form-label--required" : ""}`}
                    >
                      {getMasterFieldLabel(field, LABEL_OVERRIDES)}
                    </span>
                    <div className="dwr-form-control">
                      <MasterFormField
                        field={field}
                        value={headerValues[key]}
                        onChange={(val) => handleHeaderChange(field, val)}
                        locked={
                          isMasterFieldLocked(field, { isAddMode: true, isEditMode: true }) ||
                          (isTranType && !departmentSelected) ||
                          gridsLoading
                        }
                        options={dropdownOptions[key] || []}
                        inputClassName="dwr-form-input"
                        valueClassName="dwr-form-value"
                      />
                    </div>
                  </div>
                );
              })}

              <div className="dwr-grids-slot">
                {gridsLoading && (
                  <div className="dwr-grids-slot__loading" aria-live="polite">
                    Loading document types…
                  </div>
                )}
                <div className={`tt2doctype-grid-body${gridsLoading ? " dwr-grids--loading" : ""}`}>
                  <DocumentTypeGrid rows={rows} onRowsChange={setRows} disabled={gridsLoading} />
                </div>
              </div>
            </div>

            <footer className="dwr-page-footer">
              <button
                type="button"
                className="master-modal-btn master-modal-btn--save"
                onClick={handleSave}
                disabled={isSaving || gridsLoading || defsLoading}
              >
                <Save size={13} strokeWidth={2} />
                {isSaving ? "Saving…" : "Save"}
              </button>
            </footer>

            {(saveError || (combinedErr && departmentSelected)) && (
              <div className="master-modal-save-error">
                <AlertCircle size={14} strokeWidth={2} /> {saveError || combinedErr}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
