import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Layers, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useSubMainGroupMaster } from "../../hooks/useSubMainGroupMaster";
import SubMainGroupMasterForm from "./SubMainGroupMasterForm";
import { SMGM_CONFIG } from "./constants";
import "./SubMainGroupMasterPage.css";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const today = todayFormatted();
  return {
    ObjType: SMGM_CONFIG.LIST_OBJ_TYPE,
    ObjName: SMGM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      PrmCompanyID:  DEFAULT_COMPANY_ID,
      prmDivisionID: SMGM_CONFIG.LIST_DIVISION_ID,
      prmFromDate:   today,
      prmToDate:     today,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

function buildListColumns(onEdit) {
  return [
    { key: "ItemTypeName",        label: "Item Type",         width: "15%", filterable: true, align: "left" },
    { key: "MainGroupName",       label: "Main Group",        width: "18%", filterable: true, align: "left" },
    { key: "SubMainGroupCode",    label: "Code",              width: "13%", filterable: true, align: "left" },
    { key: "SubMainGroupName",    label: "Sub Main Group",    width: "28%", filterable: true, align: "left" },
    { key: "SubMainGroupShortName", label: "Short Name",      width: "18%", filterable: true, align: "left" },
    {
      key: "_actions",
      label: "Edit",
      width: "8%",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="smgm-list__edit-btn"
          title={`Edit ${row.SubMainGroupCode ?? ""}`}
          aria-label={`Edit ${row.SubMainGroupCode ?? ""}`}
          onClick={(e) => { e.stopPropagation(); onEdit(row.IDNumber); }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function SubMainGroupMasterPage() {
  const { get } = useApi(API_BASE_URL);

  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, headerFetching, headerError,
    itemTypeOptions, mainGroupOptions, mainGroupLoading, fixedAssetAccOptions,
    fetchMainGroupByItemType, fetchEditRecord, seedOptionsFromMaster,
  } = useSubMainGroupMaster();

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(8);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalMode,    setModalMode]    = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title:    "Sub Main Group Master",
    subtitle: "Browse sub main groups or create a new one.",
    showBack: true,
    backTo:   "/",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(res?.Table ?? res?.Links ?? []);
    } catch (err) {
      console.error("[SMGM] List fetch failed:", err);
      setError("Failed to load Sub Main Group list.");
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

  const columns = useMemo(() => buildListColumns(handleEdit), [handleEdit]);

  return (
    <div className="workspace-page smgm-list-page">
      <section className="smgm-list-panel smgm-list-panel--fill">
        <header className="smgm-list-panel__header">
          <div className="smgm-list-panel__title">
            <Layers size={14} strokeWidth={2} />
            <span>Sub Main Group Master</span>
          </div>
          <div className="smgm-list-panel__toolbar">
            <button type="button" className="smgm-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> Add New
            </button>
            <label htmlFor="smgm-list-page-size" className="smgm-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="smgm-list-page-size"
              className="ng-select smgm-list-panel__pagesize-select"
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
          loaderText="Loading sub main groups…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No sub main groups found."
          hideHeader
          fill
        />
      </section>

      <SubMainGroupMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        defsLoading={headerFetching}
        defsError={headerError}
        itemTypeOptions={itemTypeOptions}
        mainGroupOptions={mainGroupOptions}
        mainGroupLoading={mainGroupLoading}
        fixedAssetAccOptions={fixedAssetAccOptions}
        fetchMainGroupByItemType={fetchMainGroupByItemType}
        fetchEditRecord={fetchEditRecord}
        seedOptionsFromMaster={seedOptionsFromMaster}
      />
    </div>
  );
}
