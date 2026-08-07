// DopMasterPage.jsx — DOP Master listing / landing page.
// Clicking Add New → /admin/dop-master/new
// Clicking Edit   → /admin/dop-master/:id/edit

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { DOP_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./DopMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";

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
        <ListPanelHeader
          icon={ShieldCheck}
          title="DOP Master"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            reportTitle: "DOP Master Report",
            reportFileName: "TODO_DopMaster.rpt",
            buildParams: buildDopMasterReportParams,
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
