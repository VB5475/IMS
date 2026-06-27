import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Tag, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useMainGroupMaster } from "../../hooks/useMainGroupMaster";
import MainGroupMasterForm from "./MainGroupMasterForm";
import { MGM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./MainGroupMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const today = todayFormatted();
  return {
    ObjType: MGM_CONFIG.LIST_OBJ_TYPE,
    ObjName: MGM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      PrmCompanyID:  DEFAULT_COMPANY_ID,
      prmDivisionID: MGM_CONFIG.LIST_DIVISION_ID,
      prmFromDate:   today,
      prmToDate:     today,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

const HIDDEN_COLS = new Set(["IDNumber", "SystemConfigured"]);

const LABEL_MAP = {
  ISAutoCodeGen: "Auto Code Gen",
  RegName:       "Reg Name",
};

function toLabel(key) {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  return key.replace(/([A-Z])/g, " $1").trim();
}

function buildColumnsFromData(data, onEdit) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k));
  return [
    ...keys.map((key) => ({ key, label: toLabel(key), filterable: true, align: "left" })),
    {
      key:   "_actions",
      label: "Edit",
      width: "80px",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="mgm-list__edit-btn"
          title={`Edit ${row.MainGroupCode ?? row.Code ?? ""}`}
          aria-label={`Edit ${row.MainGroupCode ?? row.Code ?? ""}`}
          onClick={(e) => { e.stopPropagation(); onEdit(row.IDNumber); }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function MainGroupMasterPage() {
  const { get } = useApi(API_BASE_URL);

  // Field defs (from GetDetailColData) + dropdown options fetched once — passed down to form
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, headerFetching, headerError,
    itemTypeOptions, fixedAssetAccOptions,
    fetchEditRecord, seedOptionsFromMaster,
  } = useMainGroupMaster();

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalMode,    setModalMode]    = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title:    "Main Group Master",
    subtitle: "Browse main groups or create a new one.",
    showBack: true,
    backTo:   "/",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(res ?? res ?? []);
    } catch (err) {
      console.error("[MGM] List fetch failed:", err);
      setError("Failed to load Main Group list.");
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
    <div className="workspace-page mgm-list-page">
      <section className="mgm-list-panel mgm-list-panel--fill">
        <header className="mgm-list-panel__header">
          <div className="mgm-list-panel__title">
            <Tag size={14} strokeWidth={2} />
            <span>Main Group Master</span>
          </div>
          <div className="mgm-list-panel__toolbar">
            <button type="button" className="mgm-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> {ENTRY_FORM_LABEL}
            </button>
            <label htmlFor="mgm-list-page-size" className="mgm-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="mgm-list-page-size"
              className="ng-select mgm-list-panel__pagesize-select"
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
          loaderText="Loading main groups…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No main groups found."
          hideHeader
          searchable
          fill
        />
      </section>

      <MainGroupMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        defsLoading={headerFetching}
        defsError={headerError}
        itemTypeOptions={itemTypeOptions}
        fixedAssetAccOptions={fixedAssetAccOptions}
        fetchEditRecord={fetchEditRecord}
        seedOptionsFromMaster={seedOptionsFromMaster}
      />
    </div>
  );
}
