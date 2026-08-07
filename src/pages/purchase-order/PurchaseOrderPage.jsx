// PurchaseOrderPage.jsx
// Purchase Order listing / landing page.
// Clicking Add New → /purchase-order/new (PurchaseOrderForm in new mode)
// Clicking Edit   → /purchase-order/:id/edit (PurchaseOrderForm in edit mode)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { PO_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./PurchaseOrderPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";

function buildPurchaseOrderReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  const year = new Date().getFullYear();
  const session = getUserSession();
  return {
    ObjType: PO_CONFIG.LIST_OBJ_TYPE,
    ObjName: PO_CONFIG.SP_PO_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: PO_CONFIG.LIST_DIVISION_ID,
        prmyearid: session.yearId,
        prmfromdate: `01-Jan-${year}`,
        prmtodate: `31-Dec-${year}`,
        prmloginid: session.loginId,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function PurchaseOrderPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Purchase Orders",
    subtitle: "Browse purchase orders or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: PO_CONFIG.ROUTE_PATH,
        editBtnClass: "po-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[PurchaseOrderPage] list fetch failed:", err);
      setError(err?.message || "Failed to load purchase orders.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleAddNew = useCallback(() => {
    navigate(`${PO_CONFIG.ROUTE_PATH}/new`);
  }, [navigate]);

  return (
    <div className="workspace-page po-list-page">
      <section className="po-list-panel po-list-panel--compact po-list-panel--fill">
        <ListPanelHeader
          icon={ShoppingCart}
          title="Purchase Orders"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchOrders}
          refreshing={loading}
          print={{
            reportTitle: "Purchase Order Report",
            reportFileName: "TODO_PurchaseOrder.rpt",
            buildParams: buildPurchaseOrderReportParams,
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
          loaderText="Loading purchase orders…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase orders found."
          hideHeader
          searchable
          deleteProcName={PO_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchOrders}
          fill
        />
      </section>
    </div>
  );
}
