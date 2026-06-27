import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Save, AlertCircle } from "lucide-react";
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
  getVisibleHeaderFields,
  isMasterCheckboxField,
  isMasterFieldLocked,
  isMasterFieldRequired,
  alertMasterFormValidationErrors,
} from "../../utils/masterFormUtils";
import { controlTypeMap } from "../../data/dummyData";
import { validateApiColumns, validateColumnValue } from "../../utils/columnValidation";
import { UDR_CONFIG } from "./constants";

function buildSaveContext() {
  return {
    CompanyID: DEFAULT_COMPANY_ID,
    YearID: UDR_CONFIG.CONFIG_YEAR_ID,
    LoginID: DEFAULT_LOGIN_ID,
    SessionID: DEFAULT_SESSION_ID,
    FuncCode: UDR_CONFIG.RB_MASTER,
  };
}

function getUdrHeaderFields(fieldDefs) {
  const visible = getVisibleHeaderFields(fieldDefs).filter(
    (f) => f.ColName === UDR_CONFIG.HEADER_USER_COL
  );
  if (visible.length) return visible;
  const userCol = (fieldDefs ?? []).find((f) => f.ColName === UDR_CONFIG.HEADER_USER_COL);
  return userCol ? [userCol] : [];
}

/** Validate header on Save — same GET_DETAIL_COL_DATA rules as detail (validateColumnValue). */
function validateUdrHeaderFields(headerFields, headerValues) {
  const errors = [];
  (headerFields ?? []).forEach((apiCol) => {
    const key = apiCol.ColName;
    if (!key) return;
    const result = validateColumnValue(headerValues[key], apiCol);
    if (!result.valid) errors.push(result.message);
  });
  return errors;
}

function isUdrAllowColumn(col) {
  return col?.ColName === UDR_CONFIG.GRID_ALLOW_COL;
}

function asAllowCheckboxField(col) {
  if (!col) return null;
  return { ...col, ColCtrlType: controlTypeMap.CHECKBOX };
}

/** MRD §2 — Division + Allow only; TranBook / UserID / DivisionID stay in save payload. */
function getUdrGridDisplayCols(gridColumnDefs) {
  const hidden = new Set(UDR_CONFIG.GRID_HIDDEN_COLS);
  const cols = (gridColumnDefs ?? []).filter((c) => c.ColName && !hidden.has(c.ColName));

  const divisionCol = cols.find((c) => c.ColName === UDR_CONFIG.GRID_DIVISION_COL);
  const allowCol = asAllowCheckboxField(
    cols.find((c) => c.ColName === UDR_CONFIG.GRID_ALLOW_COL)
  );

  return {
    allowCol,
    textCols: divisionCol ? [divisionCol] : [],
  };
}

function allRowsAllowed(rows, allowColName) {
  return rows.length > 0 && rows.every((row) => getCheckboxValue(row[allowColName]) === 1);
}

function RightsGrid({ title, variant, rows, gridColumnDefs, onRowsChange, disabled = false }) {
  const displayCols = useMemo(
    () => getUdrGridDisplayCols(gridColumnDefs),
    [gridColumnDefs]
  );

  const allowKey = displayCols.allowCol?.ColName ?? "Allow";
  const selectAll = allRowsAllowed(rows, allowKey);

  const handleSelectAll = useCallback(
    (checked) => {
      onRowsChange(rows.map((row) => ({ ...row, [allowKey]: checked ? 1 : 0 })));
    },
    [rows, onRowsChange, allowKey]
  );

  const handleRowAllow = useCallback(
    (index, value) => {
      onRowsChange(
        rows.map((row, i) =>
          i === index ? { ...row, [allowKey]: getCheckboxValue(value) } : row
        )
      );
    },
    [rows, onRowsChange, allowKey]
  );

  if (!displayCols.allowCol && displayCols.textCols.length === 0) return null;

  return (
    <section className={`dwr-rights-grid dwr-rights-grid--${variant}`}>
      <header className="dwr-rights-grid__header">
        <div className="dwr-rights-grid__title-wrap">
          <span className="dwr-rights-grid__title-accent" aria-hidden />
          <span className="dwr-rights-grid__title">{title}</span>
        </div>
        {displayCols.allowCol && rows.length > 0 && (
          <div className="dwr-rights-grid__select-all">
            <span className="dwr-rights-grid__select-all-text">Select all</span>
            <MasterFormField
              field={{ ...displayCols.allowCol, DisplayName: "Select all" }}
              value={selectAll ? 1 : 0}
              onChange={(val) => handleSelectAll(getCheckboxValue(val) === 1)}
              locked={disabled}
              valueClassName="dwr-form-value"
            />
          </div>
        )}
      </header>

      <div
        className={`dwr-rights-grid__table-wrap${rows.length === 0 ? " dwr-rights-grid__table-wrap--empty" : ""
          }`}
      >
        {rows.length === 0 ? (
          <div className="dwr-rights-grid__empty">
            <span className="dwr-rights-grid__empty-icon" aria-hidden>
              —
            </span>
            Select a user to load divisions
          </div>
        ) : (
          <table className="dwr-rights-grid__table">
            <thead>
              <tr>
                {displayCols.textCols.map((col) => (
                  <th key={col.ColName} className="dwr-rights-grid__division-col">
                    {getMasterFieldLabel(col)}
                  </th>
                ))}
                {displayCols.allowCol && (
                  <th className="dwr-rights-grid__allow-col">
                    {getMasterFieldLabel(displayCols.allowCol)}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.DivisionID ?? ""}-${row.TranBook ?? ""}-${index}`}>
                  {displayCols.textCols.map((col) => (
                    <td key={col.ColName} className="dwr-rights-grid__division-col">
                      <span className="dwr-rights-grid__division-name">
                        {row[col.ColName] ?? "—"}
                      </span>
                    </td>
                  ))}
                  {displayCols.allowCol && (
                    <td className="dwr-rights-grid__allow-col">
                      <div className="dwr-rights-grid__checkbox-wrap">
                        <MasterFormField
                          field={displayCols.allowCol}
                          value={row[allowKey]}
                          onChange={(val) => handleRowAllow(index, val)}
                          locked={disabled}
                          valueClassName="dwr-form-value"
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function buildUdrRowValues(row, gridColumnDefs, headerValues) {
  const saveRow = {};
  gridColumnDefs.forEach((col) => {
    const key = col.ColName;
    if (!key) return;
    if (isUdrAllowColumn(col) || isMasterCheckboxField(col)) {
      saveRow[key] = getCheckboxValue(row[key]);
    } else if (key === "UserID") {
      saveRow[key] = headerValues.UserID;
    } else {
      saveRow[key] = row[key] ?? "";
    }
  });
  return saveRow;
}

function buildDetailSaveRows(rows, gridColumnDefs, headerValues) {
  if (!gridColumnDefs.length) return [];
  return rows.map((row) => buildUdrRowValues(row, gridColumnDefs, headerValues));
}

/** Validate grid rows on Save using GET_DETAIL_COL_DATA column rules. */
function validateUdrGridRows(rows, gridColumnDefs, headerValues, sectionLabel) {
  if (!gridColumnDefs?.length) return [];

  const errors = [];
  (rows ?? []).forEach((row, rowIdx) => {
    const values = buildUdrRowValues(row, gridColumnDefs, headerValues);
    validateApiColumns(values, gridColumnDefs).forEach((msg) => {
      errors.push(`${sectionLabel} — Row ${rowIdx + 1}: ${msg}`);
    });
  });
  return errors;
}

export default function DivisionWiseRightsForm({
  fieldDefs = [],
  gridColumnDefs = [],
  defsLoading = false,
  defsError = null,
  dropdownOptions = {},
  onUserChange,
}) {
  const { post } = useApi(API_BASE_URL_IMS);

  const [headerValues, setHeaderValues] = useState(() =>
    buildMasterFormEmpty(fieldDefs, buildSaveContext())
  );
  const [transactionRows, setTransactionRows] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [gridsLoading, setGridsLoading] = useState(false);
  const [gridsError, setGridsError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const headerFields = useMemo(() => getUdrHeaderFields(fieldDefs), [fieldDefs]);

  useEffect(() => {
    if (!fieldDefs.length) return;
    setHeaderValues(buildMasterFormEmpty(fieldDefs, buildSaveContext()));
    setTransactionRows([]);
    setReportRows([]);
    setSaveError(null);
    setGridsError(null);
  }, [fieldDefs]);

  const reloadGridsForUser = useCallback(
    async (userId) => {
      const normalized = Number(userId) || 0;
      if (!normalized || !onUserChange) {
        setTransactionRows([]);
        setReportRows([]);
        return;
      }

      setGridsLoading(true);
      setGridsError(null);
      try {
        const { transactionRows: txn, reportRows: rpt } = await onUserChange(normalized);
        setTransactionRows(txn ?? []);
        setReportRows(rpt ?? []);
      } catch (err) {
        setGridsError(err?.message || "Failed to load division rights.");
        setTransactionRows([]);
        setReportRows([]);
      } finally {
        setGridsLoading(false);
      }
    },
    [onUserChange]
  );

  const handleUserChange = useCallback(
    async (userId) => {
      const normalized = Number(userId) || 0;
      setHeaderValues((prev) => ({ ...prev, UserID: normalized }));
      await reloadGridsForUser(normalized);
    },
    [reloadGridsForUser]
  );

  const handleHeaderChange = useCallback(
    (field, value) => {
      const key = field.ColName;
      if (key === "UserID") {
        handleUserChange(value);
        return;
      }
      setHeaderValues((prev) => ({ ...prev, [key]: value }));
    },
    [handleUserChange]
  );

  const handleSave = useCallback(async () => {
    const validationErrors = [
      ...validateUdrHeaderFields(headerFields, headerValues),
      ...validateUdrGridRows(
        transactionRows,
        gridColumnDefs,
        headerValues,
        UDR_CONFIG.GRID_TITLE_TRANSACTION
      ),
      ...validateUdrGridRows(
        reportRows,
        gridColumnDefs,
        headerValues,
        UDR_CONFIG.GRID_TITLE_REPORT
      ),
    ];

    if (alertMasterFormValidationErrors(validationErrors)) return;

    setSaveError(null);
    setIsSaving(true);
    try {
      const detRows = [
        ...buildDetailSaveRows(transactionRows, gridColumnDefs, headerValues),
        ...buildDetailSaveRows(reportRows, gridColumnDefs, headerValues),
      ];
      const payload = withSaveContextFields(
        {
          prmStrMstJSON: JSON.stringify([...detRows]),
        },
        { divisionId: 0, isEdit: Number(headerValues.UserID) > 0 }
      );

      await post(UDR_CONFIG.SAVE_ENDPOINT, payload);
      alert("Division wise rights saved successfully!");
      await reloadGridsForUser(headerValues.UserID);
    } catch (err) {
      console.error("[UDR Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    headerFields,
    headerValues,
    transactionRows,
    reportRows,
    gridColumnDefs,
    post,
    reloadGridsForUser,
  ]);

  const isLoading = defsLoading;
  const combinedErr = defsError || gridsError;

  return (
    <div className="workspace-page dwr-page">
      <section className="dwr-panel dwr-panel--fill">
        {isLoading ? (
          <div className="master-modal-loader">Loading…</div>
        ) : combinedErr && !headerValues.UserID ? (
          <div className="master-modal-error dwr-panel__error">
            <AlertCircle size={14} strokeWidth={2} /> {combinedErr}
          </div>
        ) : (
          <>
            <div className="dwr-form">
              {headerFields.map((field) => (
                <div key={field.ColName} className="dwr-form-row">
                  <span
                    className={`dwr-form-label${isMasterFieldRequired(field) ? " dwr-form-label--required" : ""
                      }`}
                  >
                    {getMasterFieldLabel(field)}
                  </span>
                  <div className="dwr-form-control">
                    <MasterFormField
                      field={field}
                      value={headerValues[field.ColName]}
                      onChange={(val) => handleHeaderChange(field, val)}
                      locked={
                        isMasterFieldLocked(field, { isAddMode: true, isEditMode: true }) ||
                        gridsLoading
                      }
                      options={dropdownOptions[field.ColName] || []}
                      inputClassName="dwr-form-input"
                      valueClassName="dwr-form-value"
                    />
                  </div>
                </div>
              ))}

              <div className="dwr-grids-slot">
                {gridsLoading && (
                  <div className="dwr-grids-slot__loading" aria-live="polite">
                    Loading division rights…
                  </div>
                )}
                <div className={`dwr-grids${gridsLoading ? " dwr-grids--loading" : ""}`}>
                  <RightsGrid
                    variant="transaction"
                    title={UDR_CONFIG.GRID_TITLE_TRANSACTION}
                    rows={transactionRows}
                    gridColumnDefs={gridColumnDefs}
                    onRowsChange={setTransactionRows}
                    disabled={gridsLoading}
                  />
                  <RightsGrid
                    variant="report"
                    title={UDR_CONFIG.GRID_TITLE_REPORT}
                    rows={reportRows}
                    gridColumnDefs={gridColumnDefs}
                    onRowsChange={setReportRows}
                    disabled={gridsLoading}
                  />
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

            {(saveError || (combinedErr && headerValues.UserID)) && (
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
