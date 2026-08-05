import React, { useState, useCallback, useRef } from "react";
import { Save, AlertCircle } from "lucide-react";
import MasterFormField from "../../components/forms/MasterFormField";
import EntryGrid from "../../components/grid/EntryGrid";
import AlertPanel from "../../components/ui/AlertPanel";
import { API_BASE_URL_IMS, DEFAULT_SESSION_ID, buildSaveRowFromColumns } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useApi } from "../../api/useApi";
import { withSaveContextFields, buildSaveJsonFields } from "../../utils/savePayload";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { getMasterFieldLabel, isMasterFieldRequired } from "../../utils/masterFormUtils";
import { useNotification } from "../../context/NotificationContext";
import { TTLINK_CONFIG } from "./constants";
import "../division-wise-rights/DivisionWiseRightsPage.css";
import "../../components/grid/EntryGrid.css";

export default function DMTranTypeLinkForm({
  headerColumns = [],
  defsLoading = false,
  defsError = null,
  allColumns = [],
  gridColumns = [],
  tranTypeOptions = [],
  onFromTranTypeChange,
}) {
  const { post } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [fromTranTypeId, setFromTranTypeId] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [formErrors, setFormErrors] = useState([]);

  const gridRef = useRef(null);
  const queuedRowsRef = useRef(null);

  const registerGridRef = useCallback((el) => {
    gridRef.current = el;
    if (el && queuedRowsRef.current) {
      el.loadRows(queuedRowsRef.current);
      setRowCount(queuedRowsRef.current.length);
      queuedRowsRef.current = null;
    }
  }, []);

  const headerField = headerColumns[0];

  const handleFromChange = useCallback(
    async (value) => {
      const normalized = Number(value) || 0;
      setFromTranTypeId(normalized);
      setSaveError(null);
      setFormErrors([]);

      if (gridRef.current) {
        gridRef.current.clearRows();
        setRowCount(0);
      } else {
        queuedRowsRef.current = [];
      }

      if (!normalized || !onFromTranTypeChange) return;

      setGridLoading(true);
      setGridError(null);
      try {
        const rows = await onFromTranTypeChange(normalized);
        if (gridRef.current) {
          gridRef.current.loadRows(rows);
          setRowCount(rows.length);
        } else {
          queuedRowsRef.current = rows;
        }
      } catch (err) {
        setGridError(err?.message || "Failed to load linked Tran Types.");
      } finally {
        setGridLoading(false);
      }
    },
    [onFromTranTypeChange]
  );

  const handleSave = useCallback(async () => {
    const rows = gridRef.current?.getRows?.() ?? [];
    const errors = [];
    if (!fromTranTypeId) errors.push("From Tran Type is required.");
    if (fromTranTypeId && rows.length === 0) errors.push("Add at least one linked Tran Type.");
    if (errors.length) {
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);
    setSaveError(null);
    setIsSaving(true);
    try {
      const session = getUserSession();
      const saveContext = {
        companyid: session.companyId,
        yearid: session.yearId,
        loginid: session.loginId,
        sessionid: DEFAULT_SESSION_ID,
        funccode: TTLINK_CONFIG.RB_MASTER,
      };
      const mstRows = rows.map((row) =>
        buildSaveRowFromColumns({ ...row, [TTLINK_CONFIG.HEADER_FROM_COL]: fromTranTypeId }, allColumns, saveContext)
      );

      const payload = withSaveContextFields(
        buildSaveJsonFields({ label: TTLINK_CONFIG.FORM_TAG, mst: mstRows }),
        { divisionId: 0, isEdit: false }
      );

      const result = await post(TTLINK_CONFIG.SAVE_ENDPOINT, payload);
      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setSaveError(message);
        return;
      }
      notify.success(message || `Saved ${rows.length} Tran Type link(s).`);
    } catch (err) {
      console.error("[TTLink Save] Failed:", err);
      setSaveError(err?.message || "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [fromTranTypeId, allColumns, post, notify]);

  const isLoading = defsLoading;
  const combinedErr = defsError || gridError;

  return (
    <div className="workspace-page dwr-page">
      <section className="dwr-panel dwr-panel--fill">
        {isLoading ? (
          <div className="master-modal-loader">Loading…</div>
        ) : combinedErr && !fromTranTypeId ? (
          <div className="master-modal-error dwr-panel__error">
            <AlertCircle size={14} strokeWidth={2} /> {combinedErr}
          </div>
        ) : (
          <>
            <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />
            <div className="dwr-form ttlink-header-form">
              {headerField && (
                <div className="dwr-form-row">
                  <span
                    className={`dwr-form-label${isMasterFieldRequired(headerField) ? " dwr-form-label--required" : ""}`}
                  >
                    {getMasterFieldLabel(headerField, TTLINK_CONFIG.LABEL_OVERRIDES)}
                  </span>
                  <div className="dwr-form-control">
                    <MasterFormField
                      field={headerField}
                      value={fromTranTypeId}
                      onChange={handleFromChange}
                      locked={gridLoading}
                      options={tranTypeOptions}
                      inputClassName="dwr-form-input"
                      valueClassName="dwr-form-value"
                    />
                  </div>
                </div>
              )}
            </div>

            <section className="ttlink-grid-section">
              <div className="ttlink-grid-section__header">
                <span className="ttlink-grid-section__title">Linked Tran Types ({rowCount})</span>
              </div>
              <EntryGrid
                ref={registerGridRef}
                config={{ columns: gridColumns, pagination: { pageSize: 25 } }}
                title=""
                hideBottomPanel
                hidePagination={false}
                readOnly={!fromTranTypeId}
                emptyMessage={
                  fromTranTypeId
                    ? "No linked Tran Types found."
                    : "Select a From Tran Type to view its linked Tran Types."
                }
              />
            </section>

            <footer className="dwr-page-footer">
              <button
                type="button"
                className="master-modal-btn master-modal-btn--save"
                onClick={handleSave}
                disabled={isSaving || gridLoading || defsLoading || !fromTranTypeId}
              >
                <Save size={13} strokeWidth={2} />
                {isSaving ? "Saving…" : "Save"}
              </button>
            </footer>

            {(saveError || (combinedErr && fromTranTypeId)) && (
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
