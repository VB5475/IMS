// PurchaseOrderPage.jsx
// Purchase Order listing / landing page.
// Clicking Add New → /purchase-order/new (PurchaseOrderForm in new mode)
// Clicking Edit   → /purchase-order/:id/edit (PurchaseOrderForm in edit mode)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { PO_CONFIG } from "./constants";
import "./PurchaseOrderPage.css";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

function buildListParams() {
  const year = new Date().getFullYear();
  return {
    ObjType: PO_CONFIG.LIST_OBJ_TYPE,
    ObjName: PO_CONFIG.SP_PO_LIST,
    JSon: JSON.stringify([
      {
        PrmCompanyID: DEFAULT_COMPANY_ID,
        prmDivisionID: PO_CONFIG.LIST_DIVISION_ID,
        prmSupplierID: 0,
        prmFromDate: `01-Jan-${year}`,
        prmToDate: `31-Dec-${year}`,
        PrmRefTypeID: 0,
        PrmBasedOn: 0,
        PrmDepartmentId: 0,
        PrmStatus: 0,
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
  const [pageSize, setPageSize] = useState(8);

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
        basePath: "/purchase-order",
        editBtnClass: "po-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json?.Table ?? []));
    } catch (err) {
      console.error("[PurchaseOrderPage] list fetch failed:", err);
      setError("Failed to load purchase orders.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleAddNew = useCallback(() => {
    navigate("/purchase-order/new");
  }, [navigate]);

  return (
    <div className="workspace-page po-list-page">
      <section className="po-list-panel po-list-panel--compact po-list-panel--fill">
        <header className="po-list-panel__header">
          <div className="po-list-panel__title">
            <ShoppingCart size={14} strokeWidth={2} />
            <span>Purchase Orders</span>
          </div>
          <div className="po-list-panel__toolbar">
            <button type="button" className="po-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              Add New
            </button>
            <label htmlFor="po-list-page-size" className="po-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="po-list-page-size"
              className="ng-select po-list-panel__pagesize-select"
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
          loaderText="Loading purchase orders…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase orders found."
          hideHeader
          fill
        />
      </section>
    </div>
  );
}
