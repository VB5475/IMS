import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { GRN_CONFIG, formatTranDate, ENTRY_FORM_LABEL } from "./constants";
import "./GoodsReceivedNotePage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

function buildGoodsReceivedNoteReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListDateRange() {
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    prmfromdate: formatTranDate(`${fyStartYear}-04-01`),
    prmtodate: formatTranDate(`${fyStartYear + 1}-03-31`),
  };
}

function buildListParams() {
  const session = getUserSession();
  return {
    ObjType: GRN_CONFIG.LIST_OBJ_TYPE,
    ObjName: GRN_CONFIG.SP_GRN_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: 0,
        prmyearid: session.yearId,
        ...buildListDateRange(),
        prmloginid: session.loginId,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function GoodsReceivedNotePage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Goods Received Note",
    subtitle: "Browse goods received notes or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: GRN_CONFIG.ROUTE_PATH,
        editBtnClass: "grn-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchGrnList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[GoodsReceivedNotePage] list fetch failed:", err);
      setError(err?.message || "Failed to load goods received notes.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchGrnList();
  }, [fetchGrnList]);

  const handleAddNew = useCallback(() => {
    navigate(`${GRN_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  return (
    <div className="workspace-page grn-list-page">
      <section className="grn-list-panel grn-list-panel--compact grn-list-panel--fill">
        <ListPanelHeader
          icon={ClipboardList}
          title="Goods Received Notes"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchGrnList}
          refreshing={loading}
          print={{
            ...PRINT_REPORT_CONFIG["goods-received-note"],
            buildParams: buildGoodsReceivedNoteReportParams,
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
          loaderText="Loading goods received notes…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No goods received notes found."
          hideHeader
          searchable
          deleteProcName={GRN_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchGrnList}
          fill
        />
      </section>
    </div>
  );
}
