import React, { useState, useCallback, useMemo } from "react";
import { Save, AlertCircle, Search } from "lucide-react";
import MasterFormField from "../../components/forms/MasterFormField";
import AlertPanel from "../../components/ui/AlertPanel";
import { API_BASE_URL_IMS, buildSaveRowFromColumns } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import {
  getCheckboxValue,
  getMasterFieldLabel,
  isMasterFieldRequired,
  validateMasterFormFields,
} from "../../utils/masterFormUtils";
import { validateApiColumns } from "../../utils/columnValidation";
import { controlTypeMap } from "../../data/dummyData";
import { useNotification } from "../../context/NotificationContext";
import { DMGR_CONFIG } from "./constants";
import "./DMGroupRightsPage.css";

function asDropdownField(col) {
  if (!col) return null;
  return { ...col, ColCtrlType: controlTypeMap.DROPDOWN };
}

// issystemdefine/isuserdefine come back as ColCtrlType 12 (unmapped in this
// codebase's control-type set) — forced to CHECKBOX here; mutual exclusivity
// (only one of the pair "on") is enforced in handleHeaderChange below, since
// the RB metadata doesn't encode that itself (they're 2 independent columns,
// not one shared radio-group column).
function asCheckboxField(col) {
  if (!col) return null;
  return { ...col, ColCtrlType: controlTypeMap.CHECKBOX };
}

function buildEmptyHeaderValues() {
  return {
    [DMGR_CONFIG.HEADER_GROUP_COL]: 0,
    [DMGR_CONFIG.HEADER_DEPARTMENT_COL]: 0,
    [DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL]: 0,
    [DMGR_CONFIG.HEADER_USER_DEFINE_COL]: 0,
  };
}

/** Upload/View/Delete column defs, in display order — shared by the grid's
 *  per-column select-all headers and the page footer's blanket select-all. */
function getCheckboxCols(gridColumnDefs) {
  return [
    gridColumnDefs.find((c) => c.ColName === DMGR_CONFIG.GRID_UPLOAD_COL),
    gridColumnDefs.find((c) => c.ColName === DMGR_CONFIG.GRID_VIEW_COL),
    gridColumnDefs.find((c) => c.ColName === DMGR_CONFIG.GRID_DELETE_COL),
  ].filter(Boolean);
}

function isColumnAllChecked(rows, colName) {
  return rows.length > 0 && rows.every((row) => getCheckboxValue(row[colName]) === 1);
}

function setColumnForAllRows(rows, colName, checked) {
  return rows.map((row) => ({ ...row, [colName]: checked ? 1 : 0 }));
}

/** Blanket select-all — every checkbox column, every row. Used by the page
 *  footer's "Select All" control (moved out of the grid card itself). */
function setAllCheckboxCols(rows, checkboxCols, checked) {
  return rows.map((row) => {
    const next = { ...row };
    checkboxCols.forEach((col) => {
      next[col.ColName] = checked ? 1 : 0;
    });
    return next;
  });
}

function RightsGrid({ rows, gridColumnDefs, onRowsChange, disabled }) {
  const doctypeCol = gridColumnDefs.find((c) => c.ColName === DMGR_CONFIG.GRID_DOCTYPE_COL);
  const subtypeCol = gridColumnDefs.find((c) => c.ColName === DMGR_CONFIG.GRID_SUBTYPE_COL);
  const checkboxCols = getCheckboxCols(gridColumnDefs);

  const handleColumnSelectAll = useCallback(
    (colName, checked) => onRowsChange(setColumnForAllRows(rows, colName, checked)),
    [rows, onRowsChange]
  );

  const handleRowCheckbox = useCallback(
    (index, colName, value) => {
      onRowsChange(
        rows.map((row, i) => (i === index ? { ...row, [colName]: getCheckboxValue(value) } : row))
      );
    },
    [rows, onRowsChange]
  );

  return (
    <section className="dmgr-grid">
      <header className="dmgr-grid__header">
        <span className="dmgr-grid__title">Document Rights</span>
      </header>

      <div className="dmgr-grid__table-wrap">
        {rows.length === 0 ? (
          <div className="dmgr-grid__empty">
            Click <strong>Get Detail</strong> above to load document types for this Group.
          </div>
        ) : (
          <table className="dmgr-grid__table">
            <thead>
              <tr>
                {doctypeCol && <th>{getMasterFieldLabel(doctypeCol, { [doctypeCol.ColName]: "Document Type" })}</th>}
                {subtypeCol && <th>{getMasterFieldLabel(subtypeCol, { [subtypeCol.ColName]: "Document Sub Type" })}</th>}
                {checkboxCols.map((col) => (
                  <th key={col.ColName} className="dmgr-grid__checkbox-col">
                    <label className="dmgr-grid__col-select-all">
                      <input
                        type="checkbox"
                        checked={isColumnAllChecked(rows, col.ColName)}
                        onChange={(e) => handleColumnSelectAll(col.ColName, e.target.checked)}
                        disabled={disabled}
                        aria-label={`Select all ${getMasterFieldLabel(col)}`}
                      />
                      {getMasterFieldLabel(col)}
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id ?? index}>
                  {doctypeCol && <td>{row._doctypeLabel || "—"}</td>}
                  {subtypeCol && <td>{row._subtypeLabel || "—"}</td>}
                  {checkboxCols.map((col) => (
                    <td key={col.ColName} className="dmgr-grid__checkbox-col">
                      <input
                        type="checkbox"
                        checked={getCheckboxValue(row[col.ColName]) === 1}
                        onChange={(e) => handleRowCheckbox(index, col.ColName, e.target.checked)}
                        disabled={disabled}
                        aria-label={`${getMasterFieldLabel(col)} — row ${index + 1}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function DMGroupRightsForm({
  allColumns = [],
  headerColumns = [],
  gridColumns = [],
  groupOptions = [],
  departmentOptions = [],
  headerFetching = false,
  headerError = null,
  onGetDetail,
  // Called with "system" | "user" | null (null when neither checkbox is
  // checked) whenever the System Defined / User Define checkboxes toggle —
  // swaps the Department dropdown's data source, see useDMGroupRights.js's
  // refreshDepartmentOptions.
  onDefineModeChange,
}) {
  const { post } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [headerValues, setHeaderValues] = useState(buildEmptyHeaderValues);
  const [gridRows, setGridRows] = useState([]);
  const [gridsLoading, setGridsLoading] = useState(false);
  const [gridsError, setGridsError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState([]);

  // Overrides applied once, then reused for BOTH rendering and validation —
  // headerColumns' raw ColCtrlType is 1 (textbox) for group/department and
  // 12 (unmapped in this codebase) for the system/user-define pair, none of
  // which match how these fields actually behave on screen.
  const effectiveHeaderColumns = useMemo(
    () =>
      headerColumns.map((col) => {
        if (col.ColName === DMGR_CONFIG.HEADER_GROUP_COL) return asDropdownField(col);
        if (col.ColName === DMGR_CONFIG.HEADER_DEPARTMENT_COL) return asDropdownField(col);
        if (col.ColName === DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL) return asCheckboxField(col);
        if (col.ColName === DMGR_CONFIG.HEADER_USER_DEFINE_COL) return asCheckboxField(col);
        return col;
      }),
    [headerColumns]
  );

  const fieldsByCol = useMemo(() => {
    const byName = Object.fromEntries(effectiveHeaderColumns.map((c) => [c.ColName, c]));
    return {
      group: byName[DMGR_CONFIG.HEADER_GROUP_COL] ?? null,
      department: byName[DMGR_CONFIG.HEADER_DEPARTMENT_COL] ?? null,
      systemDefine: byName[DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL] ?? null,
      userDefine: byName[DMGR_CONFIG.HEADER_USER_DEFINE_COL] ?? null,
    };
  }, [effectiveHeaderColumns]);

  const handleHeaderChange = useCallback(
    (colName, value) => {
      setHeaderValues((prev) => {
        const next = { ...prev, [colName]: value };
        // Mutual exclusivity — 2 independent columns, not one radio-group
        // column, so enforced here rather than by the RB metadata itself.
        if (colName === DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL && getCheckboxValue(value) === 1) {
          next[DMGR_CONFIG.HEADER_USER_DEFINE_COL] = 0;
        }
        if (colName === DMGR_CONFIG.HEADER_USER_DEFINE_COL && getCheckboxValue(value) === 1) {
          next[DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL] = 0;
        }

        // The checkbox pair swaps which catalog feeds the Department
        // dropdown — the previously-selected department may not exist in
        // the new catalog, so clear it rather than leave a stale selection.
        if (colName === DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL || colName === DMGR_CONFIG.HEADER_USER_DEFINE_COL) {
          const systemOn = getCheckboxValue(next[DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL]) === 1;
          const userOn = getCheckboxValue(next[DMGR_CONFIG.HEADER_USER_DEFINE_COL]) === 1;
          next[DMGR_CONFIG.HEADER_DEPARTMENT_COL] = 0;
          onDefineModeChange?.(systemOn ? "system" : userOn ? "user" : null);
        }
        return next;
      });
    },
    [onDefineModeChange]
  );

  // Department's option list already swaps by define-type (see
  // handleHeaderChange/onDefineModeChange above) — this additionally keeps
  // the dropdown disabled until one of the two is actually chosen, so a
  // Department can't be picked from the baseline catalog by accident.
  const isDefineTypeChosen =
    getCheckboxValue(headerValues[DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL]) === 1 ||
    getCheckboxValue(headerValues[DMGR_CONFIG.HEADER_USER_DEFINE_COL]) === 1;

  const canGetDetail =
    Number(headerValues[DMGR_CONFIG.HEADER_GROUP_COL]) > 0 &&
    Number(headerValues[DMGR_CONFIG.HEADER_DEPARTMENT_COL]) > 0;

  // Shared by the manual Save button AND the automatic post-Get-Detail save
  // below — both must build the exact same payload from a given rows array.
  // `silent` skips the success/error toast (used for the automatic trigger,
  // which isn't a user-initiated click).
  const persistRows = useCallback(
    async (rows, { silent = false } = {}) => {
      const session = getUserSession();
      const saveColumnDefs = allColumns.map((c) => ({ key: c.ColName, colDataType: c.ColDataType }));
      const context = {
        [DMGR_CONFIG.HEADER_GROUP_COL]: Number(headerValues[DMGR_CONFIG.HEADER_GROUP_COL]) || 0,
        [DMGR_CONFIG.HEADER_DEPARTMENT_COL]: Number(headerValues[DMGR_CONFIG.HEADER_DEPARTMENT_COL]) || 0,
        [DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL]: getCheckboxValue(headerValues[DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL]),
        [DMGR_CONFIG.HEADER_USER_DEFINE_COL]: getCheckboxValue(headerValues[DMGR_CONFIG.HEADER_USER_DEFINE_COL]),
        companyid: session.companyId,
        yearid: session.yearId,
        loginid: session.loginId,
        funccode: DMGR_CONFIG.FORM_TAG,
      };

      const detRows = rows.map(({ id, _doctypeLabel, _subtypeLabel, ...rest }) =>
        buildSaveRowFromColumns(rest, saveColumnDefs, context)
      );

      const payload = withSaveContextFields(
        buildSaveJsonFields({ label: DMGR_CONFIG.FORM_TAG, mst: detRows }),
        { divisionId: 0, isEdit: false }
      );

      const result = await post(DMGR_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        if (!silent) notify.error(message);
        return { success: false, message };
      }
      if (!silent) notify.success(message || "Group rights saved successfully.");
      return { success: true, message };
    },
    [allColumns, headerValues, post, notify]
  );

  // `skipPreSave` — handleSave's own success path calls this to refresh the
  // grid after ITS OWN (non-silent, validated) save already ran; without the
  // flag that refresh would trigger a second, redundant silent save of the
  // same data. The Get Detail button's own onClick (no args) always runs the
  // full pre-save-then-fetch sequence below.
  const handleGetDetail = useCallback(async ({ skipPreSave = false } = {}) => {
    if (!canGetDetail) return;
    setGridsLoading(true);
    setGridsError(null);
    try {
      // Save first — whatever's currently on screen (e.g. unsaved checkbox
      // edits from before this click), THEN fetch. Silent: not a
      // user-clicked Save, and failure here must not block the fetch below.
      if (!skipPreSave) {
        try {
          await persistRows(gridRows, { silent: true });
        } catch (err) {
          console.error("[DMGroupRights] Pre-fetch auto-save failed:", err);
        }
      }

      const rows = await onGetDetail(
        headerValues[DMGR_CONFIG.HEADER_DEPARTMENT_COL],
        headerValues[DMGR_CONFIG.HEADER_GROUP_COL],
        gridColumns
      );
      const mapped = (rows || []).map((r, i) => ({ ...r, id: r.idnumber ?? r.IDNumber ?? `_row_${i}` }));
      setGridRows(mapped);
    } catch (err) {
      console.error("[DMGroupRights] Get Detail failed:", err);
      setGridsError(err?.message || "Failed to load document rights.");
      setGridRows([]);
    } finally {
      setGridsLoading(false);
    }
  }, [canGetDetail, onGetDetail, headerValues, gridColumns, persistRows, gridRows]);

  const handleSave = useCallback(async () => {
    const headerErrors = validateMasterFormFields(effectiveHeaderColumns, headerValues);
    const gridErrors = [];
    gridRows.forEach((row, idx) => {
      validateApiColumns(row, gridColumns).forEach((msg) => {
        gridErrors.push(`Row ${idx + 1}: ${msg}`);
      });
    });
    const allErrors = [...headerErrors, ...gridErrors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return;
    }
    if (gridRows.length === 0) {
      setFormErrors(["Click Get Detail and set at least one document right before saving."]);
      return;
    }

    setFormErrors([]);
    setIsSaving(true);
    try {
      const result = await persistRows(gridRows);
      if (!result.success) return;
      await handleGetDetail({ skipPreSave: true });
    } catch (err) {
      console.error("[DMGroupRights Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [effectiveHeaderColumns, headerValues, gridRows, gridColumns, persistRows, handleGetDetail, notify]);

  // Blanket select-all — moved out of the grid card into the footer beside
  // Save (per-column select-all now lives in the grid's own column headers).
  const footerCheckboxCols = useMemo(() => getCheckboxCols(gridColumns), [gridColumns]);
  const allRightsChecked = useMemo(
    () => gridRows.length > 0 && footerCheckboxCols.every((col) => isColumnAllChecked(gridRows, col.ColName)),
    [gridRows, footerCheckboxCols]
  );
  const handleSelectAllRows = useCallback(
    (checked) => setGridRows((rows) => setAllCheckboxCols(rows, footerCheckboxCols, checked)),
    [footerCheckboxCols]
  );

  const combinedError = headerError || gridsError;

  return (
    <div className="workspace-page dmgr-page">
      {headerFetching ? (
        <div className="master-modal-loader">Loading…</div>
      ) : headerError ? (
        <div className="master-modal-error">
          <AlertCircle size={14} strokeWidth={2} /> {headerError}
        </div>
      ) : (
        <section className="dmgr-panel">
          <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />

          <div className="dmgr-form">
            <div className="dmgr-form-row">
              <span className={`dmgr-form-label${isMasterFieldRequired(fieldsByCol.group) ? " dmgr-form-label--required" : ""}`}>
                {getMasterFieldLabel(fieldsByCol.group, { [DMGR_CONFIG.HEADER_GROUP_COL]: "Group" })}
              </span>
              <div className="dmgr-form-control">
                <MasterFormField
                  field={fieldsByCol.group}
                  value={headerValues[DMGR_CONFIG.HEADER_GROUP_COL]}
                  onChange={(val) => handleHeaderChange(DMGR_CONFIG.HEADER_GROUP_COL, val)}
                  options={groupOptions}
                />
              </div>

              <span className="dmgr-form-radio">
                <label>
                  <input
                    type="checkbox"
                    checked={getCheckboxValue(headerValues[DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL]) === 1}
                    onChange={(e) => handleHeaderChange(DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL, e.target.checked ? 1 : 0)}
                  />
                  {getMasterFieldLabel(fieldsByCol.systemDefine, { [DMGR_CONFIG.HEADER_SYSTEM_DEFINE_COL]: "System Defined" })}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={getCheckboxValue(headerValues[DMGR_CONFIG.HEADER_USER_DEFINE_COL]) === 1}
                    onChange={(e) => handleHeaderChange(DMGR_CONFIG.HEADER_USER_DEFINE_COL, e.target.checked ? 1 : 0)}
                  />
                  {getMasterFieldLabel(fieldsByCol.userDefine, { [DMGR_CONFIG.HEADER_USER_DEFINE_COL]: "User Define" })}
                </label>
              </span>
            </div>

            <div className="dmgr-form-row">
              <span className={`dmgr-form-label${isMasterFieldRequired(fieldsByCol.department) ? " dmgr-form-label--required" : ""}`}>
                {getMasterFieldLabel(fieldsByCol.department, { [DMGR_CONFIG.HEADER_DEPARTMENT_COL]: "Department" })}
              </span>
              <div className="dmgr-form-control">
                <MasterFormField
                  field={fieldsByCol.department}
                  value={headerValues[DMGR_CONFIG.HEADER_DEPARTMENT_COL]}
                  onChange={(val) => handleHeaderChange(DMGR_CONFIG.HEADER_DEPARTMENT_COL, val)}
                  options={departmentOptions}
                  disabled={!isDefineTypeChosen}
                  placeholder={isDefineTypeChosen ? undefined : "Select System Defined or User Define first"}
                />
              </div>

              <button
                type="button"
                className="dmgr-get-detail-btn"
                onClick={handleGetDetail}
                disabled={!canGetDetail || gridsLoading}
              >
                <Search size={13} strokeWidth={2} />
                {gridsLoading ? "Loading…" : "Get Detail"}
              </button>
            </div>

            {combinedError && (
              <div className="master-modal-error">
                <AlertCircle size={14} strokeWidth={2} /> {combinedError}
              </div>
            )}

            <RightsGrid
              rows={gridRows}
              gridColumnDefs={gridColumns}
              onRowsChange={setGridRows}
              disabled={gridsLoading}
            />
          </div>

          <footer className="dmgr-page-footer">
            {gridRows.length > 0 && (
              <label className="dmgr-footer-select-all">
                <input
                  type="checkbox"
                  checked={allRightsChecked}
                  onChange={(e) => handleSelectAllRows(e.target.checked)}
                  disabled={gridsLoading}
                />
                Select All
              </label>
            )}
            <button
              type="button"
              className="master-modal-btn master-modal-btn--save"
              onClick={handleSave}
              disabled={isSaving || gridsLoading}
            >
              <Save size={13} strokeWidth={2} />
              {isSaving ? "Saving…" : "Save"}
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
