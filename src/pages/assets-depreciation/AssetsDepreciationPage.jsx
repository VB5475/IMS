// AssetsDepreciationPage.jsx — Company Act Depreciation listing / landing page
// Clicking Add New → /assets-depreciation/new    (AssetsDepreciationForm — new mode)
// Clicking Edit   → /assets-depreciation/:id/edit (AssetsDepreciationForm — edit mode)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createListActionsColumn } from "../../utils/listGridUtils";
import { DPC_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./AssetsDepreciationPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import PrintReportButton from "../../components/ui/PrintReportButton";
import { buildCompanyReportParam } from "../../utils/reportParams";

function buildDpcReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

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
  const session = getUserSession();
  return {
    ObjType: DPC_CONFIG.LIST_OBJ_TYPE,
    ObjName: DPC_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid:  session.companyId,
      prmdivisionid: DPC_CONFIG.LIST_DIVISION_ID,
      prmloginid:    session.loginId,
      prmyearid:     session.yearId,
      prmfromdate:   `01-Jan-${year}`,
      prmtodate:     `31-Dec-${year}`,
      prmaccountid:  0,
    }]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

const HIDDEN_COLS = new Set(["astdepid", "idnumber"]);

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
          title={`Edit Depreciation ${row.trancode ?? ""}`}
          aria-label={`Edit Depreciation ${row.trancode ?? ""}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(
              `/rb_astdepcamst/${row.astdepid ?? row.idnumber}/edit`,
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
    title:    "Company Act Depreciation",
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
      setData(json ?? []);
    } catch (err) {
      console.error("[AssetsDepreciation] list fetch failed:", err);
      setError("Failed to load Company Act Depreciation records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => navigate(`${DPC_CONFIG.ROUTE_PATH}/new`), [navigate]);

  return (
    <div className="workspace-page dpc-list-page">
      <section className="dpc-list-panel dpc-list-panel--fill">
        <header className="dpc-list-panel__header">
          <div className="dpc-list-panel__title">
            <Layers size={14} strokeWidth={2} />
            <span>Company Act Depreciation</span>
          </div>
          <div className="dpc-list-panel__toolbar">
            <button type="button" className="dpc-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <PrintReportButton
              reportTitle="Company Act Depreciation Report"
              reportFileName="TODO_AssetsDepreciation.rpt"
              buildParams={buildDpcReportParams}
            />
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
          loaderText="Loading Company Act Depreciation records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Company Act Depreciation records found."
          hideHeader
          searchable
          deleteProcName={DPC_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
