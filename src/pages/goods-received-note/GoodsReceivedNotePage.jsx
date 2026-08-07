import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { GRN_CONFIG, formatTranDate, ENTRY_FORM_LABEL } from "./constants";
import "./GoodsReceivedNotePage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";

import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

const PRINT_CONFIG = PRINT_REPORT_CONFIG["goods-received-note"];
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
        <header className="grn-list-panel__header">
          <div className="grn-list-panel__title">
            <ClipboardList size={14} strokeWidth={2} />
            <span>Goods Received Notes</span>
          </div>
          <div className="grn-list-panel__toolbar">
            <button type="button" className="grn-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <RefreshButton onClick={fetchGrnList} loading={loading} />
            <PrintReportButton
              reportTitle={PRINT_CONFIG.reportTitle}
              reportFileName={PRINT_CONFIG.reportFileName}
              buildParams={buildGoodsReceivedNoteReportParams}
            />
            <label htmlFor="grn-list-page-size" className="grn-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="grn-list-page-size"
              className="ng-select grn-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </header>

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
