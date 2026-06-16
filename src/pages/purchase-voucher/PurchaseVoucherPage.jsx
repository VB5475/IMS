// PurchaseVoucherPage.jsx
// Purchase Voucher listing / landing page.
// Mirrors PurchaseIndentPage.jsx — same grid, toolbar, navigation pattern.
// Clicking Add New → /purchase-voucher/new  (PurchaseVoucherForm in new mode)
// Clicking Edit   → /purchase-voucher/:id/edit (PurchaseVoucherForm in edit mode)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_LOGIN_ID, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { PV_CONFIG } from "./constants";
import "./PurchaseVoucherPage.css";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatListDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const year = new Date().getFullYear();
  return {
    ObjType: PV_CONFIG.LIST_OBJ_TYPE,
    ObjName: PV_CONFIG.SP_PV_LIST,
    JSon: JSON.stringify([
      {
        PrmCompanyID:    DEFAULT_COMPANY_ID,
        prmDivisionID:   PV_CONFIG.LIST_DIVISION_ID,
        prmSupplierID:   0,
        prmFromDate:     `01-Jan-${year}`,
        prmToDate:       `31-Dec-${year}`,
        PrmDepartmentId: 0,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

function buildPVColumns(navigate) {
  return [
    { key: "PVNo",        label: "PV No.",        width: "12%", filterable: true,  align: "left" },
    { key: "PVDate",      label: "PV Date",        width: "10%", filterable: true,  filterType: "date", render: (v) => formatListDate(v) },
    { key: "BillNo",      label: "Bill No.",       width: "10%", filterable: true,  align: "left" },
    { key: "BillDate",    label: "Bill Date",      width: "10%", filterable: true,  filterType: "date", render: (v) => formatListDate(v) },
    { key: "Division",    label: "Division",       width: "12%", filterable: true,  align: "left" },
    { key: "PVType",      label: "PV Type",        width: "12%", filterable: true,  align: "left" },
    { key: "SupplierName",label: "Supplier",       width: "14%", filterable: true,  align: "left" },
    { key: "Currency",    label: "Currency",       width: "7%",  filterable: true,  align: "left" },
    { key: "CreatedBy",   label: "Created By",     width: "9%",  filterable: true,  align: "left" },
    { key: "CreatedDate", label: "Created Date",   width: "9%",  filterable: true,  filterType: "date", render: (v) => formatListDate(v) },
    {
      key: "_actions",
      label: "Edit",
      width: "5%",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="pv-list__edit-btn"
          title={`Edit PV ${row.PVNo ?? ""}`}
          aria-label={`Edit PV ${row.PVNo ?? ""}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/purchase-voucher/${row.PVID ?? row.IDNumber}/edit`, { state: { record: row } });
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function PurchaseVoucherPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [pageSize, setPageSize] = useState(8);

  usePageHeader({
    title:    "Purchase Vouchers",
    subtitle: "Browse purchase vouchers or create a new one.",
    showBack: true,
    backTo:   "/",
  });

  const columns = useMemo(() => buildPVColumns(navigate), [navigate]);

  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(json?.Table ?? []);
    } catch (err) {
      console.error("[PurchaseVoucherPage] list fetch failed:", err);
      setError("Failed to load purchase vouchers.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  const handleAddNew = useCallback(() => navigate("/purchase-voucher/new"), [navigate]);

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
              Add New
            </button>
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
                <option key={n} value={n}>{n}</option>
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
          fill
        />
      </section>
    </div>
  );
}
