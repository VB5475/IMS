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
import { QTN_CONFIG, formatTranDate, ENTRY_FORM_LABEL } from "./constants";
import "./PurchaseQuotationPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { useModuleRights } from "../../hooks/useModuleRights";

function buildPurchaseQuotationReportParams() {
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
    ObjType: QTN_CONFIG.LIST_OBJ_TYPE,
    ObjName: QTN_CONFIG.SP_QUOTATION_LIST,
    JSon: JSON.stringify([
      {
        // ...buildListDateRange(),
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

export default function PurchaseQuotationPage() {
  const { canInsert } = useModuleRights();
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Purchase Quotation",
    subtitle: "Browse purchase quotations or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: QTN_CONFIG.ROUTE_PATH,
        editBtnClass: "pq-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[PurchaseQuotationPage] list fetch failed:", err);
      setError(err?.message || "Failed to load purchase quotations.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const handleAddNew = useCallback(() => {
    navigate(`${QTN_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  return (
    <div className="workspace-page pq-list-page">
      <section className="pq-list-panel pq-list-panel--compact pq-list-panel--fill">
        <header className="pq-list-panel__header">
          <div className="pq-list-panel__title">
            <ClipboardList size={14} strokeWidth={2} />
            <span>Purchase Quotations</span>
          </div>
          <div className="pq-list-panel__toolbar">
            {canInsert && (
              <button type="button" className="pq-list-panel__add-btn" onClick={handleAddNew}>
                <Plus size={14} strokeWidth={2.5} />
                {ENTRY_FORM_LABEL}
              </button>
            )}
            <RefreshButton onClick={fetchQuotations} loading={loading} />
            <PrintReportButton
              reportTitle="Purchase Quotation Report"
              reportFileName="TODO_PurchaseQuotation.rpt"
              buildParams={buildPurchaseQuotationReportParams}
            />
            <label htmlFor="pq-list-page-size" className="pq-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="pq-list-page-size"
              className="ng-select pq-list-panel__pagesize-select"
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
          loaderText="Loading quotations…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase quotations found."
          hideHeader
          searchable
          deleteProcName={QTN_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchQuotations}
          fill
        />
      </section>
    </div>
  );
}
