// AssetDepreciationPercentagePage.jsx — single-page RB config grid. Loads
// every ledger Account's depreciation rate config on mount, edits happen
// inline in the grid, one Save button posts the full row set back.

import React, { useCallback, useEffect, useState } from "react";
import { Percent, Save } from "lucide-react";
import EntryGrid from "../../components/grid/EntryGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import Loader from "../../components/ui/Loader";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useNotification } from "../../context/NotificationContext";
import { useAssetDepreciationPercentage } from "../../hooks/useAssetDepreciationPercentage";
import { PAGE_TITLE } from "./constants";
import "./AssetDepreciationPercentagePage.css";

export default function AssetDepreciationPercentagePage() {
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const [gridRows, setGridRows] = useState([]);

  const {
    columns, isLoadingMeta, metaError, fetchColumns,
    rows, isLoadingRows, rowsError, fetchRows,
    saveRows, isSaving,
  } = useAssetDepreciationPercentage();

  usePageHeader({
    title: PAGE_TITLE,
    subtitle: "Configure Company Act, Income Tax Act, and Management Act depreciation rates per account.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    fetchColumns();
    fetchRows();
  }, [fetchColumns, fetchRows]);

  const handleSave = useCallback(async () => {
    if (gridRows.length === 0) {
      setFormErrors(["No accounts to save."]);
      return;
    }
    setFormErrors([]);
    try {
      const { message } = await saveRows(gridRows);
      notify.success(message || "Depreciation percentages saved.");
    } catch (err) {
      notify.error(err?.message || "Couldn't save. Try again.");
    }
  }, [gridRows, saveRows, notify]);

  const isLoading = isLoadingMeta || isLoadingRows;
  const loadError = metaError || rowsError;

  return (
    <div className="workspace-page workspace-page--fill adp-page">
      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />

      <section className="adp-panel adp-panel--fill">
        <header className="adp-panel__header">
          <div className="adp-panel__title">
            <span className="adp-panel__icon">
              <Percent size={16} strokeWidth={2.25} />
            </span>
            <div className="adp-panel__title-text">
              <h1>{PAGE_TITLE}</h1>
              <p>Company Act, Income Tax Act &amp; Management Act rates per ledger account</p>
            </div>
          </div>
          {!isLoading && !loadError && (
            <span className="adp-panel__count">
              {rows.length} account{rows.length === 1 ? "" : "s"}
            </span>
          )}
        </header>

        {isLoading ? (
          <Loader text="Loading depreciation percentage configuration…" />
        ) : loadError ? (
          <div className="workspace-error">{loadError}</div>
        ) : (
          <EntryGrid
            config={{ columns }}
            title={null}
            initialRows={rows}
            hideBottomPanel
            onRowsChange={setGridRows}
          />
        )}
      </section>

      <ActionBar
        showAddCancel={false}
        alignEnd
        extraButtons={[
          {
            key: "save",
            label: isSaving ? "Saving…" : "Save",
            Icon: Save,
            variant: "save",
            onClick: handleSave,
            disabled: isLoading || isSaving,
            loading: isSaving,
            showAlways: true,
          },
        ]}
      />
    </div>
  );
}
