// AssetsItemOpeningPage.jsx — Assets Item Opening listing / landing page
// Clicking Add New → /assets-item-opening/new
// Clicking Edit   → /assets-item-opening/:id/edit

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Package2, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { createListActionsColumn } from "../../utils/listGridUtils";
import { AOP_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./AssetsItemOpeningPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

function buildAopReportParams() {
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
    ObjType: AOP_CONFIG.LIST_OBJ_TYPE,
    ObjName: AOP_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: AOP_CONFIG.LIST_DIVISION_ID,
      prmloginid: session.loginId,
      prmyearid: session.yearId,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

const HIDDEN_COLS = new Set(["idnumber", "aopid"]);

function toLabel(key) {
  return key.replace(/([A-Z])/g, " $1").trim();
}

function buildColumnsFromData(data, navigate) {
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
    {
      key: "_actions",
      label: "Edit",
      width: "60px",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="aop-list__edit-btn"
          title={`Edit ${row.trancode ?? ""}`}
          aria-label={`Edit ${row.trancode ?? ""}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(
              `/rb_astitemopemst/${row.aopid ?? row.idnumber}/edit`,
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

export default function AssetsItemOpeningPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Item Opening",
    subtitle: "Create and manage asset item opening entries.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(() => buildColumnsFromData(data, navigate), [data, navigate]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(json ?? []);
    } catch (err) {
      console.error("[AOP] list fetch failed:", err);
      setError("Failed to load Assets Item Opening records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => navigate(`${AOP_CONFIG.ROUTE_PATH}/new`), [navigate]);

  return (
    <div className="workspace-page aop-list-page">
      <section className="aop-list-panel aop-list-panel--fill">
        <ListPanelHeader
          icon={Package2}
          title="Assets Item Opening"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            ...PRINT_REPORT_CONFIG["assets-item-opening"],
            buildParams: buildAopReportParams,
          }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading Assets Item Opening records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Item Opening records found."
          hideHeader
          searchable
          deleteProcName={AOP_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
