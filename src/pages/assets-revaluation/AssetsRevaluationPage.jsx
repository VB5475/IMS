import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { ARV_CONFIG, ENTRY_FORM_LABEL, buildArvListJsonPayload } from "./constants";
import "./AssetsRevaluationPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";

function buildArvReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: ARV_CONFIG.LIST_OBJ_TYPE,
    ObjName: ARV_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildArvListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsRevaluationPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Revaluation",
    subtitle: "Update asset item revaluation records.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: ARV_CONFIG.ROUTE_PATH,
        editBtnClass: "arv-list__edit-btn",
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
      console.error("[ARV] list fetch failed:", err);
      setError(err?.message || "Failed to load Assets Revaluation records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate(`${ARV_CONFIG.ROUTE_PATH}/new`),
    [navigate]
  );

  return (
    <div className="workspace-page arv-list-page">
      <section className="arv-list-panel arv-list-panel--fill">
        <ListPanelHeader
          icon={FileText}
          title="Assets Revaluation"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            reportTitle: "Assets Revaluation Report",
            reportFileName: "TODO_AssetsRevaluation.rpt",
            buildParams: buildArvReportParams,
          }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading Assets Revaluation records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Revaluation records found."
          hideHeader
          searchable
          deleteProcName={ARV_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
