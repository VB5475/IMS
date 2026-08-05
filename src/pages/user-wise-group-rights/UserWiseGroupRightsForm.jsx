import React, { useCallback, useMemo, useState } from "react";
import { AlertCircle, RotateCcw, Save, Search } from "lucide-react";
import MasterFormField from "../../components/forms/MasterFormField";
import SearchSelect from "../../components/ui/SearchSelect";
import AlertPanel from "../../components/ui/AlertPanel";
import { API_BASE_URL_IMS } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import {
  getMasterFieldLabel,
  isMasterFieldRequired,
  validateMasterFormFields,
} from "../../utils/masterFormUtils";
import { controlTypeMap } from "../../data/dummyData";
import { useNotification } from "../../context/NotificationContext";
import { UWGR_CONFIG, UWGR_REPORT_RIGHTS, UWGR_TRANSACTION_RIGHTS } from "./constants";
import "./UserWiseGroupRightsPage.css";

const LABEL_OVERRIDES = {
  [UWGR_CONFIG.HEADER_GROUP_COL]: "Group Name",
  [UWGR_CONFIG.HEADER_MODULE_COL]: "Module",
  [UWGR_CONFIG.HEADER_TYPE_COL]: "Type",
};

function buildEmptyHeaderValues() {
  return {
    [UWGR_CONFIG.HEADER_GROUP_COL]: 0,
    [UWGR_CONFIG.HEADER_MODULE_COL]: 0,
    [UWGR_CONFIG.HEADER_TYPE_COL]: 0,
  };
}

// The RB reports these three as plain textboxes; every one of them is a
// lookup on screen, so the control type is overridden before the fields are
// used for BOTH rendering and validation (same approach as DMS Group Rights).
function asDropdownField(col) {
  return col ? { ...col, ColCtrlType: controlTypeMap.DROPDOWN } : null;
}

/** One rights grid — a read-only Function Name column plus a checkbox column
 *  per right, each with a select-all toggle in the grid header. */
function RightsGrid({ title, rows, rightDefs, disabled, emptyMessage, onToggleAll, onToggleRow }) {
  const allChecked = useMemo(
    () =>
      Object.fromEntries(
        rightDefs.map((def) => [
          def.key,
          rows.length > 0 && rows.every((row) => row.values[def.key] === 1),
        ])
      ),
    [rows, rightDefs]
  );

  return (
    <section className="uwgr-grid">
      <header className="uwgr-grid__header">
        <span className="uwgr-grid__title">{title}</span>
        <div className="uwgr-grid__toggles">
          {rightDefs.map((def) => (
            <label key={def.key} className="uwgr-grid__toggle">
              <input
                type="checkbox"
                checked={allChecked[def.key]}
                onChange={(e) => onToggleAll(def.key, e.target.checked)}
                disabled={disabled || rows.length === 0}
              />
              {def.toggleLabel}
            </label>
          ))}
        </div>
      </header>

      <div className="uwgr-grid__table-wrap">
        {rows.length === 0 ? (
          <div className="uwgr-grid__empty">{emptyMessage}</div>
        ) : (
          <table className="uwgr-grid__table">
            <thead>
              <tr>
                <th>Function Name</th>
                {rightDefs.map((def) => (
                  <th key={def.key} className="uwgr-grid__checkbox-col">
                    {def.columnLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name || "—"}</td>
                  {rightDefs.map((def) => (
                    <td key={def.key} className="uwgr-grid__checkbox-col">
                      <input
                        type="checkbox"
                        checked={row.values[def.key] === 1}
                        onChange={(e) => onToggleRow(row.id, def.key, e.target.checked)}
                        disabled={disabled}
                        aria-label={`${def.columnLabel} — ${row.name || row.id}`}
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

export default function UserWiseGroupRightsForm({
  headerColumns = [],
  groupOptions = [],
  moduleOptions = [],
  typeOptions = [],
  headerFetching = false,
  headerError = null,
  onSearch,
}) {
  const { post } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [headerValues, setHeaderValues] = useState(buildEmptyHeaderValues);
  const [functionFilter, setFunctionFilter] = useState("");
  const [transactionRows, setTransactionRows] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [gridsLoading, setGridsLoading] = useState(false);
  const [gridsError, setGridsError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState([]);

  const effectiveHeaderColumns = useMemo(
    () => headerColumns.map(asDropdownField).filter(Boolean),
    [headerColumns]
  );

  const fieldsByCol = useMemo(() => {
    const byName = Object.fromEntries(effectiveHeaderColumns.map((c) => [c.ColName, c]));
    return {
      group: byName[UWGR_CONFIG.HEADER_GROUP_COL] ?? null,
      module: byName[UWGR_CONFIG.HEADER_MODULE_COL] ?? null,
      type: byName[UWGR_CONFIG.HEADER_TYPE_COL] ?? null,
    };
  }, [effectiveHeaderColumns]);

  const selectedGroupId = headerValues[UWGR_CONFIG.HEADER_GROUP_COL];
  const groupName = useMemo(
    () => groupOptions.find((opt) => String(opt.value) === String(selectedGroupId))?.label ?? "",
    [groupOptions, selectedGroupId]
  );

  const loadGrids = useCallback(
    async (groupId, name) => {
      if (!Number(groupId)) return;
      setGridsLoading(true);
      setGridsError(null);
      try {
        const { transaction, report } = await onSearch({ groupId, groupName: name });
        setTransactionRows(transaction);
        setReportRows(report);
        setHasSearched(true);
      } catch (err) {
        console.error("[UserWiseGroupRights] Search failed:", err);
        setGridsError(err?.message || "Failed to load rights for this group.");
        setTransactionRows([]);
        setReportRows([]);
      } finally {
        setGridsLoading(false);
      }
    },
    [onSearch]
  );

  // Changing Group invalidates whatever is on screen; changing Module reloads
  // both grids straight away (MRD: "In Module button selected index change
  // event call these function for Grid 1 / Grid 2").
  const handleHeaderChange = useCallback(
    (colName, value) => {
      setHeaderValues((prev) => ({ ...prev, [colName]: value }));
      setFunctionFilter("");

      if (colName === UWGR_CONFIG.HEADER_GROUP_COL) {
        setTransactionRows([]);
        setReportRows([]);
        setHasSearched(false);
        return;
      }
      if (colName === UWGR_CONFIG.HEADER_MODULE_COL && Number(selectedGroupId)) {
        loadGrids(selectedGroupId, groupName);
      }
    },
    [selectedGroupId, groupName, loadGrids]
  );

  const functionNameOptions = useMemo(() => {
    const names = [...new Set(transactionRows.map((r) => r.name).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }));
  }, [transactionRows]);

  // Only Function Name can narrow a grid — the grid functions return no
  // module/type column to filter on (see constants.js CONFIRM note 1).
  const visibleTransactionRows = useMemo(
    () => transactionRows.filter((row) => !functionFilter || row.name === functionFilter),
    [transactionRows, functionFilter]
  );

  const makeToggleAll = useCallback(
    (setRows, visibleRows) => (rightKey, checked) => {
      const visibleIds = new Set(visibleRows.map((r) => r.id));
      setRows((prev) =>
        prev.map((row) =>
          visibleIds.has(row.id)
            ? { ...row, values: { ...row.values, [rightKey]: checked ? 1 : 0 } }
            : row
        )
      );
    },
    []
  );

  const makeToggleRow = useCallback(
    (setRows) => (rowId, rightKey, checked) => {
      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? { ...row, values: { ...row.values, [rightKey]: checked ? 1 : 0 } }
            : row
        )
      );
    },
    []
  );

  // Each row goes back as the server sent it, with only this grid's own rights
  // columns overwritten — the other grid's rights, funccode, funcidnumber and
  // the group columns all pass through untouched.
  const buildSaveRows = useCallback(
    (rows, rightDefs, context) =>
      rows.map((row) => {
        const rights = Object.fromEntries(
          rightDefs.map((def) => [def.column, row.values[def.key]])
        );
        return { ...row.raw, ...rights, ...context };
      }),
    []
  );

  const handleSave = useCallback(async () => {
    const headerErrors = validateMasterFormFields(effectiveHeaderColumns, headerValues);
    if (headerErrors.length > 0) {
      setFormErrors(headerErrors);
      return;
    }
    if (transactionRows.length === 0 && reportRows.length === 0) {
      setFormErrors(["Click Search to load this group's rights before saving."]);
      return;
    }

    setFormErrors([]);
    setIsSaving(true);
    try {
      const session = getUserSession();
      const keys = UWGR_CONFIG.SAVE_CONTEXT_KEYS;
      const context = {
        [keys.module]: Number(headerValues[UWGR_CONFIG.HEADER_MODULE_COL]) || 0,
        [keys.type]: Number(headerValues[UWGR_CONFIG.HEADER_TYPE_COL]) || 0,
        companyid: session.companyId,
        yearid: session.yearId,
        loginid: session.loginId,
      };

      // Both grids return the same columns, so they share the single
      // prmStrMstJSON array the save proc expects.
      const rows = [
        ...buildSaveRows(transactionRows, UWGR_TRANSACTION_RIGHTS, context),
        ...buildSaveRows(reportRows, UWGR_REPORT_RIGHTS, context),
      ];

      const payload = withSaveContextFields(
        buildSaveJsonFields({ label: UWGR_CONFIG.FORM_TAG, mst: rows }),
        { divisionId: 0, isEdit: false }
      );

      const result = await post(UWGR_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        notify.error(message);
        return;
      }
      notify.success(message || "Group rights saved successfully.");
      await loadGrids(selectedGroupId, groupName);
    } catch (err) {
      console.error("[UserWiseGroupRights Save] Failed:", err);
      notify.error(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    effectiveHeaderColumns,
    headerValues,
    transactionRows,
    reportRows,
    selectedGroupId,
    groupName,
    buildSaveRows,
    post,
    notify,
    loadGrids,
  ]);

  const handleCancel = useCallback(() => {
    setHeaderValues(buildEmptyHeaderValues());
    setFunctionFilter("");
    setTransactionRows([]);
    setReportRows([]);
    setHasSearched(false);
    setGridsError(null);
    setFormErrors([]);
  }, []);

  const renderHeaderField = (key, field, colName, options) => (
    <div className="uwgr-field" key={key}>
      <span className={`uwgr-field__label${isMasterFieldRequired(field) ? " uwgr-field__label--required" : ""}`}>
        {getMasterFieldLabel(field, LABEL_OVERRIDES)}
      </span>
      <div className="uwgr-field__control">
        <MasterFormField
          field={field}
          value={headerValues[colName]}
          onChange={(val) => handleHeaderChange(colName, val)}
          options={options}
        />
      </div>
    </div>
  );

  const emptyMessage = hasSearched
    ? "No rights rows returned for this selection."
    : "Pick a Group and click Search to load its rights.";

  if (headerFetching) return <div className="master-modal-loader">Loading…</div>;
  if (headerError) {
    return (
      <div className="master-modal-error">
        <AlertCircle size={14} strokeWidth={2} /> {headerError}
      </div>
    );
  }

  return (
    <div className="workspace-page uwgr-page">
      <section className="uwgr-panel">
        <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />

        <div className="uwgr-body">
          <div className="uwgr-filter-bar">
            {fieldsByCol.group &&
              renderHeaderField("group", fieldsByCol.group, UWGR_CONFIG.HEADER_GROUP_COL, groupOptions)}
            {fieldsByCol.module &&
              renderHeaderField("module", fieldsByCol.module, UWGR_CONFIG.HEADER_MODULE_COL, moduleOptions)}
            {fieldsByCol.type &&
              renderHeaderField("type", fieldsByCol.type, UWGR_CONFIG.HEADER_TYPE_COL, typeOptions)}

            <div className="uwgr-field">
              <span className="uwgr-field__label">Function Name</span>
              <div className="uwgr-field__control">
                <SearchSelect
                  value={functionFilter}
                  onChange={setFunctionFilter}
                  options={functionNameOptions}
                  placeholder="All functions"
                  ariaLabel="Function Name"
                />
              </div>
            </div>

            <button
              type="button"
              className="uwgr-search-btn"
              onClick={() => loadGrids(selectedGroupId, groupName)}
              disabled={!Number(selectedGroupId) || gridsLoading}
            >
              <Search size={13} strokeWidth={2} />
              {gridsLoading ? "Loading…" : "Search"}
            </button>
          </div>

          {gridsError && (
            <div className="master-modal-error">
              <AlertCircle size={14} strokeWidth={2} /> {gridsError}
            </div>
          )}

          <RightsGrid
            title="Transaction Rights"
            rows={visibleTransactionRows}
            rightDefs={UWGR_TRANSACTION_RIGHTS}
            disabled={gridsLoading}
            emptyMessage={emptyMessage}
            onToggleAll={makeToggleAll(setTransactionRows, visibleTransactionRows)}
            onToggleRow={makeToggleRow(setTransactionRows)}
          />

          <RightsGrid
            title="Report Rights"
            rows={reportRows}
            rightDefs={UWGR_REPORT_RIGHTS}
            disabled={gridsLoading}
            emptyMessage={emptyMessage}
            onToggleAll={makeToggleAll(setReportRows, reportRows)}
            onToggleRow={makeToggleRow(setReportRows)}
          />
        </div>

        <footer className="uwgr-footer">
          <button
            type="button"
            className="master-modal-btn master-modal-btn--cancel"
            onClick={handleCancel}
            disabled={isSaving || gridsLoading}
          >
            <RotateCcw size={13} strokeWidth={2} />
            Cancel
          </button>
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
    </div>
  );
}
