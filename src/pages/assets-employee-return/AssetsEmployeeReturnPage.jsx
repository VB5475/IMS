import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
} from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { AER_CONFIG, ENTRY_FORM_LABEL, buildAerListJsonPayload } from "./constants";
import "./AssetsEmployeeReturnPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { exportRowsToCsv } from "../../utils/csvExport";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

function buildAerReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: AER_CONFIG.LIST_OBJ_TYPE,
    ObjName: AER_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildAerListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsEmployeeReturnPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const gridRef = useRef(null);

  usePageHeader({
    title: "Assets Employee Return",
    subtitle: "Return assets and issued items from employees.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: AER_CONFIG.ROUTE_PATH,
        editBtnClass: "aer-list__edit-btn",
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
      console.error("[AER] list fetch failed:", err);
      setError(err?.message || "Failed to load Assets Employee Return records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(() => navigate(`${AER_CONFIG.ROUTE_PATH}/new`), [navigate]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Assets_Employee_Return_export.csv");
  }, []);

  return (
    <div className="workspace-page aer-list-page">
      <section className="aer-list-panel aer-list-panel--fill">
        <ListPanelHeader
          icon={RotateCcw}
          title="Assets Employee Return"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            ...PRINT_REPORT_CONFIG["assets-employee-return"],
            buildParams: buildAerReportParams,
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
          loaderText="Loading Assets Employee Return records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Employee Return records found."
          hideHeader
          searchable
          deleteProcName={AER_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
