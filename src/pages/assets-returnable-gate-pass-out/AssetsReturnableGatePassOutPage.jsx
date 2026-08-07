import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DoorOpen } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { ARGO_CONFIG, ENTRY_FORM_LABEL, buildArgoListJsonPayload } from "./constants";
import "./AssetsReturnableGatePassOutPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import ListPanelHeader from "../../components/list/ListPanelHeader";

function buildGatePassReportParams() {
  return [buildCompanyReportParam()];
}

function buildListParams() {
  return {
    ObjType: ARGO_CONFIG.LIST_OBJ_TYPE,
    ObjName: ARGO_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildArgoListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsReturnableGatePassOutPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Returnable Gate Pass Out",
    subtitle: "Issue assets for returnable gate pass out.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: ARGO_CONFIG.ROUTE_PATH,
        editBtnClass: "argo-list__edit-btn",
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
      console.error("[ARGO] list fetch failed:", err);
      setError(err?.message || "Failed to load Assets Returnable Gate Pass Out records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate(`${ARGO_CONFIG.ROUTE_PATH}/new`),
    [navigate]
  );

  return (
    <div className="workspace-page argo-list-page">
      <section className="argo-list-panel argo-list-panel--fill">
        <ListPanelHeader
          icon={DoorOpen}
          title="Assets Returnable Gate Pass Out"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            reportTitle: "Returnable Gate Pass Out Report",
            reportFileName: "Rpt_ReturnableGatePass_PG.rpt",
            buildParams: buildGatePassReportParams,
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
          loaderText="Loading Assets Returnable Gate Pass Out records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Returnable Gate Pass Out records found."
          hideHeader
          searchable
          deleteProcName={ARGO_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
