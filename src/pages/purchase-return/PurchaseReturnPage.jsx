// PurchaseReturnPage.jsx
// Purchase Return listing / landing page.
// Clicking Add New → /purchase-return/new  (PurchaseReturnForm in new mode)
// Clicking Edit   → /purchase-return/:id/edit (PurchaseReturnForm in edit mode)

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { PR_CONFIG, ENTRY_FORM_LABEL, buildPurchaseReturnReportParams } from "./constants";
import "./PurchaseReturnPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

function buildListParams() {
  const year = new Date().getFullYear();
  const session = getUserSession();
  return {
    ObjType: PR_CONFIG.LIST_OBJ_TYPE,
    ObjName: PR_CONFIG.SP_PR_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: PR_CONFIG.LIST_DIVISION_ID,
        prmyearid: session.yearId,
        prmfromdate: `${year}-01-01`,
        prmtodate: `${year}-12-31`,
        prmloginid: session.loginId,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function PurchaseReturnPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStats, setSearchStats] = useState({ matchCount: 0, totalCount: 0 });
  const gridRef = useRef(null);

  usePageHeader({
    title: "Purchase Returns",
    subtitle: "Browse purchase returns or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: PR_CONFIG.ROUTE_PATH,
        editBtnClass: "pr-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[PurchaseReturnPage] list fetch failed:", err);
      setError(err?.message || "Failed to load purchase returns.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleAddNew = useCallback(() => {
    navigate(`${PR_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Purchase_Returns_export.csv");
  }, []);

  return (
    <div className="workspace-page pr-list-page">
      <section className="pr-list-panel pr-list-panel--fill">
        <ListPanelHeader
          icon={RotateCcw}
          title="Purchase Returns"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchReturns}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["purchase-return"],
            buildParams: buildPurchaseReturnReportParams,
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
          loaderText="Loading purchase returns…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase returns found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={PR_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchReturns}
          fill
        />
      </section>
    </div>
  );
}
