import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { PI_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./PurchaseInquiryPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

function buildPurchaseInquiryReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  const year = new Date().getFullYear();
  const session = getUserSession();
  return {
    ObjType: PI_CONFIG.LIST_OBJ_TYPE,
    ObjName: PI_CONFIG.SP_INQUIRY_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: PI_CONFIG.LIST_DIVISION_ID,
        prmyearid: session.yearId,
        prmfromdate: `${year}-01-01`,
        prmtodate: `${year}-12-31`,
        prmloginid: session.loginId,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function PurchaseInquiryPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Purchase Inquiry",
    subtitle: "Browse purchase inquiries or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: PI_CONFIG.ROUTE_PATH,
        editBtnClass: "pi-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchInquiries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[PurchaseInquiryPage] list fetch failed:", err);
      setError(err?.message || "Failed to load purchase inquiries.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleAddNew = useCallback(() => {
    navigate(`${PI_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  return (
    <div className="workspace-page pi-list-page">
      <section className="pi-list-panel pi-list-panel--compact pi-list-panel--fill">
        <ListPanelHeader
          icon={ClipboardList}
          title="Purchase Inquiries"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchInquiries}
          refreshing={loading}
          print={{
            ...PRINT_REPORT_CONFIG["purchase-inquiry"],
            buildParams: buildPurchaseInquiryReportParams,
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
          loaderText="Loading inquiries…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase inquiries found."
          hideHeader
          searchable
          deleteProcName={PI_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchInquiries}
          fill
        />
      </section>
    </div>
  );
}
