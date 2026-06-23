// AssetsDepreciationPage.jsx — Assets Depreciation listing / landing page
// Clicking Add New → /assets-depreciation/new    (AssetsDepreciationForm — new mode)
// Clicking Edit   → /assets-depreciation/:id/edit (AssetsDepreciationForm — edit mode)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_LOGIN_ID, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { DPC_CONFIG } from "./constants";
import "./AssetsDepreciationPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

const MONTH_ABBR = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

function formatListDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2,"0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const year = new Date().getFullYear();
  return {
    ObjType: DPC_CONFIG.LIST_OBJ_TYPE,
    ObjName: DPC_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      PrmCompanyID:  DEFAULT_COMPANY_ID,
      PrmDivisionID: DPC_CONFIG.LIST_DIVISION_ID,
      PrmLoginID:    DEFAULT_LOGIN_ID,
      PrmYearID:     DPC_CONFIG.CONFIG_YEAR_ID,
      PrmFromDate:   `01-Jan-${year}`,
      PrmToDate:     `31-Dec-${year}`,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

const HIDDEN_COLS = new Set(["AstDepID", "IDNumber"]);

function toLabel(key) {
  return key.replace(/([A-Z])/g, " $1").trim();
}

function buildColumnsFromData(data, navigate) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k));
  return [
    ...keys.map((key) => ({
      key,
      label:      toLabel(key),
      filterable: true,
      align:      "left",
      ...(key.toLowerCase().includes("date") ? { render: (v) => formatListDate(v) } : {}),
    })),
    {
      key:   "_actions",
      label: "Edit",
      width: "60px",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="dpc-list__edit-btn"
          title={`Edit Depreciation ${row.TranCode ?? ""}`}
          aria-label={`Edit Depreciation ${row.TranCode ?? ""}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(
              `/assets-depreciation/${row.AstDepID ?? row.IDNumber}/edit`,
              { state: { record: row } }
            );
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function AssetsDepreciationPage() {
  const navigate = useNavigate();
  const { get }  = useApi(API_BASE_URL);

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title:    "Assets Depreciation",
    subtitle: "Create and manage asset depreciation entries.",
    showBack: true,
    backTo:   "/",
  });

  const columns = useMemo(() => buildColumnsFromData(data, navigate), [data, navigate]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(json?.Table ?? []);
    } catch (err) {
      console.error("[AssetsDepreciation] list fetch failed:", err);
      setError("Failed to load Assets Depreciation records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => navigate("/assets-depreciation/new"), [navigate]);

  return (
    <div className="workspace-page dpc-list-page">
      <section className="dpc-list-panel dpc-list-panel--fill">
        <header className="dpc-list-panel__header">
          <div className="dpc-list-panel__title">
            <Layers size={14} strokeWidth={2} />
            <span>Assets Depreciation</span>
          </div>
          <div className="dpc-list-panel__toolbar">
            <button type="button" className="dpc-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              Add New
            </button>
            <label htmlFor="dpc-list-page-size" className="dpc-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="dpc-list-page-size"
              className="ng-select dpc-list-panel__pagesize-select"
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
          loaderText="Loading Assets Depreciation records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Depreciation records found."
          hideHeader
          fill
        />
      </section>
    </div>
  );
}
