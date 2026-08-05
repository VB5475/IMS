import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquareWarning, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { MCR_CONFIG, ENTRY_FORM_LABEL, buildMcrListJsonPayload } from "./constants";
import "./ComplaintRegisterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { useModuleRights } from "../../hooks/useModuleRights";

function buildComplaintRegisterReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: MCR_CONFIG.LIST_OBJ_TYPE,
    ObjName: MCR_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildMcrListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function ComplaintRegisterPage() {
  const { canInsert } = useModuleRights();
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Complaint Register",
    subtitle: "Register and track maintenance complaints.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: MCR_CONFIG.ROUTE_PATH,
        editBtnClass: "mcr-list__edit-btn",
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
      console.error("[MCR] list fetch failed:", err);
      setError(err?.message || "Failed to load Complaint Register records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate(`${MCR_CONFIG.ROUTE_PATH}/new`),
    [navigate]
  );

  return (
    <div className="workspace-page mcr-list-page">
      <section className="mcr-list-panel mcr-list-panel--fill">
        <header className="mcr-list-panel__header">
          <div className="mcr-list-panel__title">
            <MessageSquareWarning size={14} strokeWidth={2} />
            <span>Complaint Register</span>
          </div>
          <div className="mcr-list-panel__toolbar">
            {canInsert && (
              <button type="button" className="mcr-list-panel__add-btn" onClick={handleAddNew}>
                <Plus size={14} strokeWidth={2.5} />
                {ENTRY_FORM_LABEL}
              </button>
            )}
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle="Complaint Register Report"
              reportFileName="TODO_ComplaintRegister.rpt"
              buildParams={buildComplaintRegisterReportParams}
            />
            <label htmlFor="mcr-list-page-size" className="mcr-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="mcr-list-page-size"
              className="ng-select mcr-list-panel__pagesize-select"
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
          loaderText="Loading Complaint Register records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Complaint Register records found."
          hideHeader
          searchable
          deleteProcName={MCR_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
