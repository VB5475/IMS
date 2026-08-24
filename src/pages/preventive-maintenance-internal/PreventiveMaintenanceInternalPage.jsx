import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { exportRowsToCsv } from "../../utils/csvExport";
import { PMI_CONFIG, ENTRY_FORM_LABEL, buildPmiListJsonPayload } from "./constants";
import "./PreventiveMaintenanceInternalPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import ListPanelHeader from "../../components/list/ListPanelHeader";

function buildListParams() {
  return {
    ObjType: PMI_CONFIG.LIST_OBJ_TYPE,
    ObjName: PMI_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildPmiListJsonPayload({ divisionId: 0 })]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function PreventiveMaintenanceInternalPage() {
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
    title: "Preventive Maintenance Internal",
    subtitle: "Manage internal preventive maintenance contracts for asset items.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: PMI_CONFIG.ROUTE_PATH,
        editBtnClass: "pmi-list__edit-btn",
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
      console.error("[PMI] list fetch failed:", err);
      setError("Failed to load Preventive Maintenance Internal records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate(`${PMI_CONFIG.ROUTE_PATH}/new`),
    [navigate]
  );

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Preventive_Maintenance_Internal_export.csv");
  }, []);

  return (
    <div className="workspace-page pmi-list-page">
      <section className="pmi-list-panel pmi-list-panel--fill">
        <ListPanelHeader
          icon={RefreshCw}
          title="Preventive Maintenance Internal"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
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
          loaderText="Loading Preventive Maintenance Internal records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Preventive Maintenance Internal records found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
