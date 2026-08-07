import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DoorClosed, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { ARGI_CONFIG, ENTRY_FORM_LABEL, buildArgiListJsonPayload } from "./constants";
import "./AssetsReturnableGatePassInPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

const PRINT_CONFIG = PRINT_REPORT_CONFIG["assets-returnable-gate-pass-in"];
function buildGatePassReportParams() {
  return [buildCompanyReportParam()];
}

function buildListParams() {
  return {
    ObjType: ARGI_CONFIG.LIST_OBJ_TYPE,
    ObjName: ARGI_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildArgiListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsReturnableGatePassInPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Returnable Gate Pass In",
    subtitle: "Receive returnable gate pass out assets.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: ARGI_CONFIG.ROUTE_PATH,
        editBtnClass: "argi-list__edit-btn",
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
      console.error("[ARGI] list fetch failed:", err);
      setError(err?.message || "Failed to load Assets Returnable Gate Pass In records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate(`${ARGI_CONFIG.ROUTE_PATH}/new`),
    [navigate]
  );

  return (
    <div className="workspace-page argi-list-page">
      <section className="argi-list-panel argi-list-panel--fill">
        <header className="argi-list-panel__header">
          <div className="argi-list-panel__title">
            <DoorClosed size={14} strokeWidth={2} />
            <span>Assets Returnable Gate Pass In</span>
          </div>
          <div className="argi-list-panel__toolbar">
            <button type="button" className="argi-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle={PRINT_CONFIG.reportTitle}
              reportFileName={PRINT_CONFIG.reportFileName}
              buildParams={buildGatePassReportParams}
            />
            <label htmlFor="argi-list-page-size" className="argi-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="argi-list-page-size"
              className="ng-select argi-list-panel__pagesize-select"
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
          loaderText="Loading Assets Returnable Gate Pass In records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Returnable Gate Pass In records found."
          hideHeader
          searchable
          deleteProcName={ARGI_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
