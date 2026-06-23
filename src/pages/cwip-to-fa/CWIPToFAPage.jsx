// CWIPToFAPage.jsx — CWIP To FA listing / landing page
// Clicking Add New → /cwip-to-fa/new    (CWIPToFAForm — new mode)
// Clicking Edit   → /cwip-to-fa/:id/edit (CWIPToFAForm — edit mode)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_LOGIN_ID, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { C2F_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./CWIPToFAPage.css";
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
    ObjType: C2F_CONFIG.LIST_OBJ_TYPE,
    ObjName: C2F_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      PrmCompanyID:  DEFAULT_COMPANY_ID,
      PrmDivisionID: C2F_CONFIG.LIST_DIVISION_ID,
      PrmLocationID: 0,
      PrmLoginID:    DEFAULT_LOGIN_ID,
      PrmYearID:     C2F_CONFIG.CONFIG_YEAR_ID,
      PrmFromDate:   `01-Jan-${year}`,
      PrmToDate:     `31-Dec-${year}`,
      PrmConvTypeID: 0,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

const HIDDEN_COLS = new Set(["C2FID", "IDNumber"]);

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
          className="c2f-list__edit-btn"
          title={`Edit C2F ${row.TranNo ?? ""}`}
          aria-label={`Edit C2F ${row.TranNo ?? ""}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/cwip-to-fa/${row.C2FID ?? row.IDNumber}/edit`, { state: { record: row } });
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function CWIPToFAPage() {
  const navigate = useNavigate();
  const { get }  = useApi(API_BASE_URL);

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title:    "CWIP To FA",
    subtitle: "Capital Work In Progress to Fixed Assets conversions.",
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
      console.error("[CWIPToFAPage] list fetch failed:", err);
      setError("Failed to load CWIP To FA records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => navigate("/cwip-to-fa/new"), [navigate]);

  return (
    <div className="workspace-page c2f-list-page">
      <section className="c2f-list-panel c2f-list-panel--fill">
        <header className="c2f-list-panel__header">
          <div className="c2f-list-panel__title">
            <Layers size={14} strokeWidth={2} />
            <span>CWIP To FA</span>
          </div>
          <div className="c2f-list-panel__toolbar">
            <button type="button" className="c2f-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <label htmlFor="c2f-list-page-size" className="c2f-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="c2f-list-page-size"
              className="ng-select c2f-list-panel__pagesize-select"
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
          loaderText="Loading CWIP To FA records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No CWIP To FA records found."
          hideHeader
          searchable
          fill
        />
      </section>
    </div>
  );
}
