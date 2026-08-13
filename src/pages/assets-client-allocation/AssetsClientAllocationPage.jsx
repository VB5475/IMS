import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Handshake } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { exportRowsToCsv } from "../../utils/csvExport";
import { ACA_CONFIG, ENTRY_FORM_LABEL, buildAcaListJsonPayload } from "./constants";
import "./AssetsClientAllocationPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

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
  const gridRef = useRef(null);

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
      setError(err?.message || "Failed to load Assets Client Allocation records.");
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

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Assets_Client_Allocation_export.csv");
  }, []);

  return (
    <div className="workspace-page aca-list-page">
      <section className="aca-list-panel aca-list-panel--fill">
        <ListPanelHeader
          icon={Handshake}
          title="Assets Client Allocation"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            ...PRINT_REPORT_CONFIG["assets-client-allocation"],
            buildParams: buildAcaReportParams,
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
