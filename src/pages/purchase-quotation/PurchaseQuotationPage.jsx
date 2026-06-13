import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { QTN_CONFIG, formatTranDate } from "./constants";
import "./PurchaseQuotationPage.css";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatListDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = MONTH_ABBR[d.getMonth()];
  return `${dd}-${mon}-${d.getFullYear()}`;
}

/** Apr–Mar fiscal window for Fn_tbl_Pur_QtnMst_List (matches API sample). */
function buildListDateRange() {
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    PrmFromDate: formatTranDate(`${fyStartYear}-04-01`),
    PrmToDate: formatTranDate(`${fyStartYear + 1}-03-31`),
  };
}

function buildListParams() {
  const session = getUserSession();
  return {
    ObjType: QTN_CONFIG.LIST_OBJ_TYPE,
    ObjName: QTN_CONFIG.SP_QUOTATION_LIST,
    JSon: JSON.stringify([
      {
        ...buildListDateRange(),
        PrmDivisionID: 0,
        PrmSupplierID: 0,
        PrmQuotationTypeID: 0,
        PrmLoginID: session.loginId,
        PrmCompanyID: session.companyId ?? DEFAULT_COMPANY_ID,
        PrmYearID: session.yearId ?? QTN_CONFIG.CONFIG_YEAR_ID,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function normalizeListRow(row) {
  return {
    ...row,
    IDNUMBER: row.IDNUMBER ?? row.IDNumber,
  };
}

function buildQuotationColumns(navigate) {
  return [
    {
      key: "Quot No",
      label: "Quotation No.",
      width: "13%",
      filterable: true,
      align: "left",
    },
    {
      key: "QuotDate",
      label: "Quotation Date",
      width: "10%",
      filterable: true,
      filterType: "date",
      render: (value) => formatListDate(value),
    },
    {
      key: "ExpiryDate",
      label: "Expiry Date",
      width: "10%",
      filterable: true,
      filterType: "date",
      render: (value) => formatListDate(value),
    },
    {
      key: "Division",
      label: "Division",
      width: "10%",
      filterable: true,
      align: "left",
    },
    {
      key: "Quotation Type",
      label: "Quotation Type",
      width: "12%",
      filterable: true,
      align: "left",
    },
    {
      key: "SupplierName",
      label: "Supplier",
      width: "12%",
      filterable: true,
      align: "left",
    },
    {
      key: "InquiryNo",
      label: "Inquiry No.",
      width: "11%",
      filterable: true,
      align: "left",
    },
    {
      key: "Created By",
      label: "Created By",
      width: "10%",
      filterable: true,
      align: "left",
    },
    {
      key: "Created Date",
      label: "Created Date",
      width: "10%",
      filterable: true,
      filterType: "date",
      render: (value) => formatListDate(value),
    },
    {
      key: "_actions",
      label: "Edit",
      width: "4%",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="pq-list__edit-btn"
          title={`Edit quotation ${row["Quot No"] ?? ""}`}
          aria-label={`Edit quotation ${row["Quot No"] ?? ""}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/purchase-quotation/${row.IDNUMBER}/edit`, { state: { record: row } });
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function PurchaseQuotationPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(8);

  usePageHeader({
    title: "Purchase Quotation",
    subtitle: "Browse purchase quotations or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(() => buildQuotationColumns(navigate), [navigate]);

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData((json?.Table ?? []).map(normalizeListRow));
    } catch (err) {
      console.error("[PurchaseQuotationPage] list fetch failed:", err);
      setError("Failed to load purchase quotations.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const handleAddNew = useCallback(() => {
    navigate("/purchase-quotation/new");
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
            <button type="button" className="pq-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              Add New
            </button>
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
          fill
        />
      </section>
    </div>
  );
}
