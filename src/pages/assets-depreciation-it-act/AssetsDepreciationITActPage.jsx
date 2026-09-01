// AssetsDepreciationITActPage.jsx — Calculate Depreciation IT Act listing / landing page
// Clicking Add New → /assets-depreciation-it-act/new    (AssetsDepreciationITActForm — new mode)
// Clicking Edit   → /assets-depreciation-it-act/:id/edit (AssetsDepreciationITActForm — edit mode)
//
// Mirrors TransporterMasterPage.jsx (shared buildListPageColumns/normalizeListRows
// utilities) rather than the sibling assets-depreciation module's older,
// hand-rolled buildColumnsFromData — both are valid patterns in this app,
// TM's is the newer one this task named as the primary list-page template.

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { DIT_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./AssetsDepreciationITActPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

const PRINT_CONFIG = PRINT_REPORT_CONFIG["assets-depreciation-it-act"];
function buildDitReportParams() {
  return [buildCompanyReportParam()];
}

// SP_LIST's full signature per the MRD is fn_tbl_rb_astdepitmst_list(@prmcompanyid,
// @prmdivisionid, @prmloginid, @prmyearid, @prmfromdate, @prmtodate, @prmaccountid)
// — sending all 7 params (see Transporter Master's own constants.js for a
// documented, DBA-confirmed case where sending fewer than the SP's full
// param list silently broke the list).
function buildListParams() {
  const year = new Date().getFullYear();
  const session = getUserSession();
  return {
    ObjType: DIT_CONFIG.LIST_OBJ_TYPE,
    ObjName: DIT_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: DIT_CONFIG.LIST_DIVISION_ID,
        prmloginid: session.loginId,
        prmyearid: session.yearId,
        prmfromdate: `01-Jan-${year}`,
        prmtodate: `31-Dec-${year}`,
        prmaccountid: 0,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsDepreciationITActPage() {
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
    title: "Calculate Depreciation IT Act",
    subtitle: "Create and manage Assets depreciation.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: DIT_CONFIG.ROUTE_PATH,
        editBtnClass: "dit-list__edit-btn",
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
      console.error("[DIT] list fetch failed:", err);
      setError(err?.message || "Failed to load Depreciation IT Act records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => {
    navigate(`${DIT_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Depreciation_IT_Act_export.csv");
  }, []);

  return (
    <div className="workspace-page dit-list-page">
      <section className="dit-list-panel dit-list-panel--fill">
        <ListPanelHeader
          icon={Calculator}
          title="Calculate Depreciation IT Act"
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
            buildParams: buildDitReportParams,
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
          loaderText="Loading Depreciation IT Act records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Depreciation IT Act records found."
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
