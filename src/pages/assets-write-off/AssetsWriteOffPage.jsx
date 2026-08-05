// AssetsWriteOffPage.jsx — Assets Write Off listing page

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileX, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
} from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { AWF_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./AssetsWriteOffPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { buildCompanyReportParam } from "../../utils/reportParams";

function buildAwfReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  const year = new Date().getFullYear();
  const session = getUserSession();
  return {
    ObjType: AWF_CONFIG.LIST_OBJ_TYPE,
    ObjName: AWF_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: AWF_CONFIG.LIST_DIVISION_ID,
      prmloginid: session.loginId,
      prmyearid: session.yearId,
      prmfromdate: `01-Jan-${year}`,
      prmtodate: `31-Dec-${year}`,
      prmaccountid: 0,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsWriteOffPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Write Off",
    subtitle: "Create and manage asset write-off entries.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: AWF_CONFIG.ROUTE_PATH,
        editBtnClass: "awf-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[AWF] list fetch failed:", err);
      setError(err?.message || "Failed to load Assets Write Off records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(() => navigate(`${AWF_CONFIG.ROUTE_PATH}/new`), [navigate]);

  return (
    <div className="workspace-page awf-list-page">
      <section className="awf-list-panel awf-list-panel--fill">
        <header className="awf-list-panel__header">
          <div className="awf-list-panel__title">
            <FileX size={14} strokeWidth={2} />
            <span>Assets Write Off</span>
          </div>
          <div className="awf-list-panel__toolbar">
            <button type="button" className="awf-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle="Assets Write Off Report"
              reportFileName="TODO_AssetsWriteOff.rpt"
              buildParams={buildAwfReportParams}
            />
            <label htmlFor="awf-list-page-size" className="awf-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="awf-list-page-size"
              className="ng-select awf-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </header>

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading Assets Write Off records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Write Off records found."
          hideHeader
          searchable
          deleteProcName={AWF_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
