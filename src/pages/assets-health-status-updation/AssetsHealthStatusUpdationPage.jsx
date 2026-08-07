import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { HeartPulse, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { AHS_CONFIG, ENTRY_FORM_LABEL, buildAhsListJsonPayload } from "./constants";
import "./AssetsHealthStatusUpdationPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { buildCompanyReportParam } from "../../utils/reportParams";

import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

const PRINT_CONFIG = PRINT_REPORT_CONFIG["assets-health-status-updation"];
function buildAhsReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: AHS_CONFIG.LIST_OBJ_TYPE,
    ObjName: AHS_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildAhsListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsHealthStatusUpdationPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Health Status Updation",
    subtitle: "Update asset item health status records.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: AHS_CONFIG.ROUTE_PATH,
        editBtnClass: "ahs-list__edit-btn",
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
      console.error("[AHS] list fetch failed:", err);
      setError(err?.message || "Failed to load Assets Health Status Updation records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate(`${AHS_CONFIG.ROUTE_PATH}/new`),
    [navigate]
  );

  return (
    <div className="workspace-page ahs-list-page">
      <section className="ahs-list-panel ahs-list-panel--fill">
        <header className="ahs-list-panel__header">
          <div className="ahs-list-panel__title">
            <HeartPulse size={14} strokeWidth={2} />
            <span>Assets Health Status Updation</span>
          </div>
          <div className="ahs-list-panel__toolbar">
            <button type="button" className="ahs-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle={PRINT_CONFIG.reportTitle}
              reportFileName={PRINT_CONFIG.reportFileName}
              buildParams={buildAhsReportParams}
            />
            <label htmlFor="ahs-list-page-size" className="ahs-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="ahs-list-page-size"
              className="ng-select ahs-list-panel__pagesize-select"
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
          loaderText="Loading Assets Health Status Updation records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Health Status Updation records found."
          hideHeader
          searchable
          deleteProcName={AHS_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
