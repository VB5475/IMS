// AssetsItemOpeningExcelPage.jsx — Asset Item Opening Excel listing
// Add New → /account/master/asset-item-opening-excel/new

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createDeleteActionColumn } from "../../utils/listGridUtils";
import { AIME_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./AssetsItemOpeningExcelPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import PrintReportButton from "../../components/ui/PrintReportButton";
import { buildCompanyReportParam } from "../../utils/reportParams";

function buildAimeReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatListDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const session = getUserSession();
  return {
    ObjType: AIME_CONFIG.LIST_OBJ_TYPE,
    ObjName: AIME_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: AIME_CONFIG.LIST_DIVISION_ID,
      prmloginid: session.loginId,
      prmyearid: session.yearId,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

const HIDDEN_COLS = new Set(["idnumber"]);

function toLabel(key) {
  return key.replace(/([A-Z])/g, " $1").trim();
}

function buildColumnsFromData(data) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k));
  return [
    ...keys.map((key) => ({
      key,
      label: toLabel(key),
      filterable: true,
      align: "left",
      ...(key.toLowerCase().includes("date") ? { render: (v) => formatListDate(v) } : {}),
    })),
    createDeleteActionColumn({
      getDeleteLabel: (row) => row.trancode ?? "",
    }),
  ];
}

export default function AssetsItemOpeningExcelPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Asset Item Opening Excel",
    subtitle: "Create asset item opening entries from Excel upload.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(() => buildColumnsFromData(data), [data]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(json ?? []);
    } catch (err) {
      console.error("[AIME] list fetch failed:", err);
      setError("Failed to load Asset Item Opening Excel records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate(`${AIME_CONFIG.ROUTE_PATH}/new`),
    [navigate],
  );

  return (
    <div className="workspace-page aop-list-page">
      <section className="aop-list-panel aop-list-panel--fill">
        <header className="aop-list-panel__header">
          <div className="aop-list-panel__title">
            <FileSpreadsheet size={14} strokeWidth={2} />
            <span>Asset Item Opening Excel</span>
          </div>
          <div className="aop-list-panel__toolbar">
            <button type="button" className="aop-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <PrintReportButton
              reportTitle="Asset Item Opening Excel Report"
              reportFileName="TODO_AssetsItemOpeningExcel.rpt"
              buildParams={buildAimeReportParams}
            />
            <label htmlFor="aime-list-page-size" className="aop-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="aime-list-page-size"
              className="ng-select aop-list-panel__pagesize-select"
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
          loaderText="Loading Asset Item Opening Excel records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No records found. Upload a new Excel batch to get started."
          hideHeader
          searchable
          deleteProcName={AIME_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
