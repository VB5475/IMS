import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LayoutList, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createListActionsColumn } from "../../utils/listGridUtils";
import { useAssetItemMaster } from "../../hooks/useAssetItemMaster";
import AssetItemMasterForm from "./AssetItemMasterForm";
import { AIM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./AssetItemMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

function buildListParams() {
  const session = getUserSession();
  return {
    ObjType:   AIM_CONFIG.LIST_OBJ_TYPE,
    ObjName:   AIM_CONFIG.SP_LIST,
    JSon:      JSON.stringify([{ prmcompanyid: session.companyId }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

const HIDDEN_COLS = new Set(["idnumber", "systemconfigured"]);

function toLabel(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
}

function buildColumnsFromData(data, onEdit) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k));
  return [
    ...keys.map((key) => ({ key, label: toLabel(key), filterable: true, align: "left" })),
    createListActionsColumn({
      onEdit: (row) => { if (row.idnumber) onEdit(row.idnumber); },
      getEditLabel: (row) => row.itemcode ?? row.itemname ?? "",
      getDeleteLabel: (row) => row.itemcode ?? row.itemname ?? "",
    }),
  ];
}

export default function AssetItemMasterPage() {
  const { get } = useApi(API_BASE_URL);

  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, allColumns, headerFetching, headerError,
    itemGroupOptions, accountOptions, tranUnitOptions,
    fetchEditRecord,
  } = useAssetItemMaster();

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalMode,    setModalMode]    = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title:    "Asset Item Master",
    subtitle: "Browse asset items or create a new one.",
    showBack: true,
    backTo:   "/",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(res ?? []);
    } catch (err) {
      console.error("[AIM] List fetch failed:", err);
      setError("Failed to load Asset Item list.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => {
    setModalMode("add");
    setEditRecordId(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((idNumber) => {
    setModalMode("edit");
    setEditRecordId(idNumber);
    setModalOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    setModalOpen(false);
    fetchList();
  }, [fetchList]);

  const columns = useMemo(() => buildColumnsFromData(data, handleEdit), [data, handleEdit]);

  return (
    <div className="workspace-page aim-list-page">
      <section className="aim-list-panel aim-list-panel--fill">
        <header className="aim-list-panel__header">
          <div className="aim-list-panel__title">
            <LayoutList size={14} strokeWidth={2} />
            <span>Asset Item Master</span>
          </div>
          <div className="aim-list-panel__toolbar">
            <button type="button" className="aim-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <label htmlFor="aim-list-page-size" className="aim-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="aim-list-page-size"
              className="ng-select aim-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </header>

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading asset items…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No asset items found."
          hideHeader
          searchable
          deleteProcName={AIM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <AssetItemMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        itemGroupOptions={itemGroupOptions}
        accountOptions={accountOptions}
        tranUnitOptions={tranUnitOptions}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
