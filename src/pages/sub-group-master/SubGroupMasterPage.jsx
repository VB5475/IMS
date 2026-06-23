import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Package, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useSubGroupMaster } from "../../hooks/useSubGroupMaster";
import SubGroupMasterForm from "./SubGroupMasterForm";
import { SGM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./SubGroupMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const today = todayFormatted();
  return {
    ObjType: SGM_CONFIG.LIST_OBJ_TYPE,
    ObjName: SGM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      PrmCompanyID:  DEFAULT_COMPANY_ID,
      prmDivisionID: SGM_CONFIG.LIST_DIVISION_ID,
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
  ShortName:     "Short Name",
  ShortCode:     "Short Code",
};

function toLabel(key) {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  return key.replace(/([A-Z])/g, " $1").trim();
}

function buildColumnsFromData(data, onEdit) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k));
  return [
    ...keys.map((key) => ({
      key,
      label:      toLabel(key),
      filterable: true,
      align:      "left",
    })),
    {
      key:   "_actions",
      label: "Edit",
      width: "80px",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="sgm-list__edit-btn"
          title={`Edit ${row.Code ?? ""}`}
          aria-label={`Edit ${row.Code ?? ""}`}
          onClick={(e) => { e.stopPropagation(); onEdit(row.IDNumber); }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function SubGroupMasterPage() {
  const { get } = useApi(API_BASE_URL);

  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, headerFetching, headerError,
    fetchEditRecord,
  } = useSubGroupMaster();

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalMode,    setModalMode]    = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title:    "Sub Group Master",
    subtitle: "Browse sub groups or create a new one.",
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
      console.error("[SGM] List fetch failed:", err);
      setError("Failed to load Sub Group list.");
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
    <div className="workspace-page sgm-list-page">
      <section className="sgm-list-panel sgm-list-panel--fill">
        <header className="sgm-list-panel__header">
          <div className="sgm-list-panel__title">
            <Package size={14} strokeWidth={2} />
            <span>Sub Group Master</span>
          </div>
          <div className="sgm-list-panel__toolbar">
            <button type="button" className="sgm-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> {ENTRY_FORM_LABEL}
            </button>
            <label htmlFor="sgm-list-page-size" className="sgm-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="sgm-list-page-size"
              className="ng-select sgm-list-panel__pagesize-select"
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
          loaderText="Loading sub groups…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No sub groups found."
          hideHeader
          searchable
          fill
        />
      </section>

      <SubGroupMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        defsLoading={headerFetching}
        defsError={headerError}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
