import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Handshake, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { ACA_CONFIG, ENTRY_FORM_LABEL, buildAcaListJsonPayload } from "./constants";
import "./AssetsClientAllocationPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import PrintReportButton from "../../components/ui/PrintReportButton";
import { buildCompanyReportParam } from "../../utils/reportParams";

function buildAcaReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: ACA_CONFIG.LIST_OBJ_TYPE,
    ObjName: ACA_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildAcaListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsClientAllocationPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Client Allocation",
    subtitle: "Allocate and issue assets to clients.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: ACA_CONFIG.ROUTE_PATH,
        editBtnClass: "aca-list__edit-btn",
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
      console.error("[ACA] list fetch failed:", err);
      setError("Failed to load Assets Client Allocation records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate(`${ACA_CONFIG.ROUTE_PATH}/new`),
    [navigate]
  );

  return (
    <div className="workspace-page aca-list-page">
      <section className="aca-list-panel aca-list-panel--fill">
        <header className="aca-list-panel__header">
          <div className="aca-list-panel__title">
            <Handshake size={14} strokeWidth={2} />
            <span>Assets Client Allocation</span>
          </div>
          <div className="aca-list-panel__toolbar">
            <button type="button" className="aca-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <PrintReportButton
              reportTitle="Assets Client Allocation Report"
              reportFileName="TODO_AssetsClientAllocation.rpt"
              buildParams={buildAcaReportParams}
            />
            <label htmlFor="aca-list-page-size" className="aca-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="aca-list-page-size"
              className="ng-select aca-list-panel__pagesize-select"
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
          loaderText="Loading Assets Client Allocation records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Client Allocation records found."
          hideHeader
          searchable
          deleteProcName={ACA_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
