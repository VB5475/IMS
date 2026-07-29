// PurchaseVoucherPage.jsx
// Purchase Voucher listing / landing page.
// Clicking Add New → /purchase-voucher/new  (PurchaseVoucherForm in new mode)
// Clicking Edit   → /purchase-voucher/:id/edit (PurchaseVoucherForm in edit mode)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { PV_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./PurchaseVoucherPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";

function buildPurchaseVoucherReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  const year = new Date().getFullYear();
  const session = getUserSession();
  return {
    ObjType: PV_CONFIG.LIST_OBJ_TYPE,
    ObjName: PV_CONFIG.SP_PV_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: PV_CONFIG.LIST_DIVISION_ID,
        prmyearid: session.yearId,
        prmfromdate: `01-Jan-${year}`,
        prmtodate: `31-Dec-${year}`,
        prmloginid:      session.loginId,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function PurchaseVoucherPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Purchase Vouchers",
    subtitle: "Browse purchase vouchers or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: PV_CONFIG.ROUTE_PATH,
        editBtnClass: "pv-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[PurchaseVoucherPage] list fetch failed:", err);
      setError(err?.message || "Failed to load purchase vouchers.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const handleAddNew = useCallback(() => navigate(`${PV_CONFIG.ROUTE_PATH}/new`), [navigate]);

  return (
    <div className="workspace-page pv-list-page">
      <section className="pv-list-panel pv-list-panel--fill">
        <header className="pv-list-panel__header">
          <div className="pv-list-panel__title">
            <Receipt size={14} strokeWidth={2} />
            <span>Purchase Vouchers</span>
          </div>
          <div className="pv-list-panel__toolbar">
            <button type="button" className="pv-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <PrintReportButton
              reportTitle="Purchase Voucher Report"
              reportFileName="TODO_PurchaseVoucher.rpt"
              buildParams={buildPurchaseVoucherReportParams}
            />
            <label htmlFor="pv-list-page-size" className="pv-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="pv-list-page-size"
              className="ng-select pv-list-panel__pagesize-select"
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
          loaderText="Loading purchase vouchers…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase vouchers found."
          hideHeader
          searchable
          deleteProcName={PV_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchVouchers}
          fill
        />
      </section>
    </div>
  );
}
