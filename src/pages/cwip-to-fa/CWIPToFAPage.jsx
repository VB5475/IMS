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
import { C2F_CONFIG } from "./constants";
import "./CWIPToFAPage.css";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

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
      prmDivisionID: C2F_CONFIG.LIST_DIVISION_ID,
      prmFromDate:   `01-Jan-${year}`,
      prmToDate:     `31-Dec-${year}`,
      PrmLoginID:    DEFAULT_LOGIN_ID,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

function buildListColumns(navigate) {
  return [
    { key: "TranNo",          label: "Tran No",         width: "10%", filterable: true,  align: "left" },
    { key: "TranDate",        label: "Tran Date",        width: "10%", filterable: true,  filterType: "date", render: (v) => formatListDate(v) },
    { key: "PutToUseInstDate",label: "Put To Use Date",  width: "12%", filterable: true,  filterType: "date", render: (v) => formatListDate(v) },
    { key: "Division",        label: "Division",         width: "12%", filterable: true,  align: "left" },
    { key: "Location",        label: "Location",         width: "12%", filterable: true,  align: "left" },
    { key: "CWIPAccount",     label: "CWIP A/C",         width: "14%", filterable: true,  align: "left" },
    { key: "ConvType",        label: "Conv. Type",       width: "10%", filterable: true,  align: "left" },
    { key: "NetTotal",        label: "Net Total",        width: "8%",  filterable: false, align: "right" },
    { key: "CreatedBy",       label: "Created By",       width: "8%",  filterable: true,  align: "left" },
    {
      key: "_actions",
      label: "Edit",
      width: "4%",
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
  const [pageSize, setPageSize] = useState(8);

  usePageHeader({
    title:    "CWIP To FA",
    subtitle: "Capital Work In Progress to Fixed Assets conversions.",
    showBack: true,
    backTo:   "/",
  });

  const columns = useMemo(() => buildListColumns(navigate), [navigate]);

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
              Add New
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
          fill
        />
      </section>
    </div>
  );
}
