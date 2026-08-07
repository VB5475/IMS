import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DoorClosed } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { ARGI_CONFIG, ENTRY_FORM_LABEL, buildArgiListJsonPayload } from "./constants";
import "./AssetsReturnableGatePassInPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import ListPanelHeader from "../../components/list/ListPanelHeader";

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
        <ListPanelHeader
          icon={DoorClosed}
          title="Assets Returnable Gate Pass In"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            reportTitle: "Returnable Gate Pass In Report",
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
