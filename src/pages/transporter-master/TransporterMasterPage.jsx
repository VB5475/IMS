// TransporterMasterPage.jsx — Transporter Master listing / landing page.
// Clicking Add New → /admin/master/transporter-master/new
// Clicking Edit   → /admin/master/transporter-master/:id/edit

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import RefreshButton from "../../components/ui/RefreshButton";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { formatTranDate } from "../../utils/dateFormat";
import { TM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./TransporterMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";

import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

const PRINT_CONFIG = PRINT_REPORT_CONFIG["transporter-master"];
function buildTransporterMasterReportParams() {
  return [buildCompanyReportParam()];
}

// SP_LIST's real signature (DBA-confirmed 2026-08-04) is
// fn_tbl_rb_transportermst_list(@prmcompanyid, @prmdivisionid, @prmyearid,
// @prmfromdate, @prmtodate, @prmloginid) — the previous call only sent 3 of
// the 6 params (missing prmyearid/prmfromdate/prmtodate), which is why the
// list never resolved live (see project_transporter_master memory).
function buildListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  const session = getUserSession();
  return {
    ObjType: TM_CONFIG.LIST_OBJ_TYPE,
    ObjName: TM_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: TM_CONFIG.LIST_DIVISION_ID,
        prmyearid: session.yearId,
        prmfromdate: today,
        prmtodate: today,
        prmloginid: session.loginId,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function TransporterMasterPage() {
  const navigate = useNavigate();
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStats, setSearchStats] = useState({ matchCount: 0, totalCount: 0 });
  const gridRef = useRef(null);

  usePageHeader({
    title: "Transporter Master",
    subtitle: "Browse transporters or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: TM_CONFIG.ROUTE_PATH,
        editBtnClass: "tm-list__edit-btn",
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
      console.error("[TM] list fetch failed:", err);
      setError(err?.message || "Failed to load Transporter Master records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => {
    navigate(`${TM_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Transporter_Master_export.csv");
  }, []);

  return (
    <div className="workspace-page tm-list-page">
      <section className="tm-list-panel tm-list-panel--fill">
        <ListPanelHeader
          icon={Truck}
          title="Transporter Master"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_CONFIG,
            buildParams: buildTransporterMasterReportParams,
          }}
          onExportCsv={handleExportCsv}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <EnterpriseDataGrid
          ref={gridRef}
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading Transporter Master records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Transporter Master records found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          fill
        />
      </section>
    </div>
  );
}
