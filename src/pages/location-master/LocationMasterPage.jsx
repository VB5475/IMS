import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MapPin, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useLocationMaster } from "../../hooks/useLocationMaster";
import LocationMasterForm from "./LocationMasterForm";
import { LM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./LocationMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

function buildListParams() {
  return {
    ObjType: LM_CONFIG.LIST_OBJ_TYPE,
    ObjName: LM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: getUserSession().companyId,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

const HIDDEN_COLS = new Set(["idnumber", "systemconfigured"]);

const LABEL_MAP = {
  RegName: "Reg Name",
};

function toLabel(key) {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  return key.replace(/([A-Z_])/g, " $1").replace(/_/g, "").trim();
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
          className="lm-list__edit-btn"
          title={`Edit ${row.Location_Code ?? row.Loc_Code ?? ""}`}
          aria-label={`Edit ${row.Location_Code ?? row.Loc_Code ?? ""}`}
          disabled={!row.idnumber}
          onClick={(e) => { e.stopPropagation(); onEdit(row.idnumber); }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function LocationMasterPage() {
  const { get } = useApi(API_BASE_URL);

  // Field defs (from GetDetailColData) + dropdown options fetched once — passed down to form
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, allColumns, headerFetching, headerError,
    locationTypeOptions, premisesOptions,
    fetchEditRecord,
  } = useLocationMaster();

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalMode,    setModalMode]    = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title:    "Location Master",
    subtitle: "Browse locations or create a new one.",
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

  const handleSaved = useCallback(() => {
    setModalOpen(false);
    fetchList();
  }, [fetchList]);

  const columns = useMemo(() => buildColumnsFromData(data, handleEdit), [data, handleEdit]);

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
              {ENTRY_FORM_LABEL}
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
          searchable
          fill
        />
      </section>

      <LocationMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        locationTypeOptions={locationTypeOptions}
        premisesOptions={premisesOptions}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
