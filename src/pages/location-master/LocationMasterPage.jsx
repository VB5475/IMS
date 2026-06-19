import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useLocationMaster } from "../../hooks/useLocationMaster";
import LocationMasterModal from "./LocationMasterModal";
import { LM_CONFIG } from "./constants";
import "./LocationMasterPage.css";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

function buildListParams() {
  return {
    ObjType: LM_CONFIG.LIST_OBJ_TYPE,
    ObjName: LM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      PrmCompanyID: DEFAULT_COMPANY_ID,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

function buildListColumns(onEdit) {
  return [
    { key: "Premises",      label: "Premises",      width: "25%", filterable: true, align: "left" },
    { key: "Location_Code", label: "Location Code", width: "20%", filterable: true, align: "left" },
    { key: "Location_Name", label: "Location Name", width: "35%", filterable: true, align: "left" },
    {
      key: "_actions",
      label: "Edit",
      width: "20%",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="lm-list__edit-btn"
          title={`Edit ${row["Location_Code"] ?? ""}`}
          aria-label={`Edit ${row["Location_Code"] ?? ""}`}
          disabled={!row.IDNumber}  // ⚠️ IDNumber missing from SP — DBA must add it
          onClick={(e) => {
            e.stopPropagation();
            onEdit(row.IDNumber);
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function LocationMasterPage() {
  const { get } = useApi(API_BASE_URL);

  // ── Hook lifted to page level so dropdown options are fetched once ─────────
  const {
    headerFetching, headerError, fetchHeaderMeta,
    locationTypeOptions, premisesOptions,
    fetchEditRecord,
  } = useLocationMaster();

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(8);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalMode,    setModalMode]    = useState("add");   // "add" | "edit"
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title:    "Location Master",
    subtitle: "Browse locations or create a new one.",
    showBack: true,
    backTo:   "/",
  });

  // Fetch dropdown meta once on mount
  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(res?.Table ?? res?.Links ?? []);
    } catch (err) {
      console.error("[LM] List fetch failed:", err);
      setError("Failed to load Location list.");
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

  const handleModalClose = useCallback(() => setModalOpen(false), []);

  const handleSaved = useCallback(() => {
    setModalOpen(false);
    fetchList();
  }, [fetchList]);

  const columns = useMemo(() => buildListColumns(handleEdit), [handleEdit]);

  return (
    <div className="workspace-page lm-list-page">
      <section className="lm-list-panel lm-list-panel--fill">
        <header className="lm-list-panel__header">
          <div className="lm-list-panel__title">
            <MapPin size={14} strokeWidth={2} />
            <span>Location Master</span>
          </div>
          <div className="lm-list-panel__toolbar">
            <button type="button" className="lm-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              Add New
            </button>
            <label htmlFor="lm-list-page-size" className="lm-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="lm-list-page-size"
              className="ng-select lm-list-panel__pagesize-select"
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
          loaderText="Loading locations…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No locations found."
          hideHeader
          fill
        />
      </section>

      <LocationMasterModal
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={handleModalClose}
        onSaved={handleSaved}
        headerFetching={headerFetching}
        headerError={headerError}
        locationTypeOptions={locationTypeOptions}
        premisesOptions={premisesOptions}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
