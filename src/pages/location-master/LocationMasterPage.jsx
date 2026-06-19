import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { LM_CONFIG } from "./constants";
import "./LocationMasterPage.css";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const today = todayFormatted();
  return {
    ObjType: LM_CONFIG.LIST_OBJ_TYPE,
    ObjName: LM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      PrmCompanyID:  DEFAULT_COMPANY_ID,
      prmDivisionID: LM_CONFIG.LIST_DIVISION_ID,
      prmFromDate:   today,
      prmToDate:     today,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

function buildListColumns(navigate) {
  return [
    { key: "LocationTypeName", label: "Location Type", width: "15%", filterable: true, align: "left" }, // ⚠️ CONFIRM col name with DBA
    { key: "PremisesName",     label: "Premises",      width: "20%", filterable: true, align: "left" }, // ⚠️ CONFIRM col name with DBA
    { key: "Location_Name",    label: "Location Name", width: "25%", filterable: true, align: "left" },
    { key: "Loc_Code",         label: "Location Code", width: "14%", filterable: true, align: "left" },
    { key: "City",             label: "City",          width: "14%", filterable: true, align: "left" },
    {
      key: "_actions",
      label: "Edit",
      width: "12%",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="lm-list__edit-btn"
          title={`Edit ${row.Loc_Code ?? ""}`}
          aria-label={`Edit ${row.Loc_Code ?? ""}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/company/location-master/${row.IDNumber}/edit`, { state: { record: row } });
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function LocationMasterPage() {
  const navigate  = useNavigate();
  const { get }   = useApi(API_BASE_URL);

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(8);

  usePageHeader({
    title:    "Location Master",
    subtitle: "Browse locations or create a new one.",
    showBack: true,
    backTo:   "/",
  });

  const columns = useMemo(() => buildListColumns(navigate), [navigate]);

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

  const handleAddNew = useCallback(
    () => navigate("/admin/company/location-master/new"),
    [navigate]
  );

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
    </div>
  );
}
