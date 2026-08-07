// DopMasterPage.jsx — DOP Master listing / landing page.
// Clicking Add New → /admin/dop-master/new
// Clicking Edit   → /admin/dop-master/:id/edit

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { DOP_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./DopMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";

import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

const PRINT_CONFIG = PRINT_REPORT_CONFIG["dop-master"];
function buildDopMasterReportParams() {
  return [buildCompanyReportParam()];
}

function buildListParams() {
  const session = getUserSession();
  return {
    ObjType: DOP_CONFIG.LIST_OBJ_TYPE,
    ObjName: DOP_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: DOP_CONFIG.LIST_DIVISION_ID,
        prmloginid: session.loginId,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function DopMasterPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "DOP Master",
    subtitle: "Browse delegation-of-power records or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: DOP_CONFIG.ROUTE_PATH,
        editBtnClass: "dop-list__edit-btn",
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
      console.error("[DOP] list fetch failed:", err);
      setError(err?.message || "Failed to load DOP Master records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => {
    navigate(`${DOP_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  return (
    <div className="workspace-page dop-list-page">
      <section className="dop-list-panel dop-list-panel--fill">
        <header className="dop-list-panel__header">
          <div className="dop-list-panel__title">
            <ShieldCheck size={14} strokeWidth={2} />
            <span>DOP Master</span>
          </div>
          <div className="dop-list-panel__toolbar">
            <button type="button" className="dop-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle={PRINT_CONFIG.reportTitle}
              reportFileName={PRINT_CONFIG.reportFileName}
              buildParams={buildDopMasterReportParams}
            />
            <label htmlFor="dop-list-page-size" className="dop-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="dop-list-page-size"
              className="ng-select dop-list-panel__pagesize-select"
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
          loaderText="Loading DOP Master records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No DOP Master records found."
          hideHeader
          searchable
          fill
        />
      </section>
    </div>
  );
}
