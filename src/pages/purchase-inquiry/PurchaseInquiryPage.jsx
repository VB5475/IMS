import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID, OBJ_TYPE } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { PI_CONFIG } from "./constants";
import "./PurchaseInquiryPage.css";

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

function buildListParams() {
  const year = new Date().getFullYear();
  return {
    ObjType: PI_CONFIG.LIST_OBJ_TYPE,
    ObjName: PI_CONFIG.SP_INQUIRY_LIST,
    JSon: JSON.stringify([
      {
        prmCompanyID: DEFAULT_COMPANY_ID,
        prmDivisionID: PI_CONFIG.LIST_DIVISION_ID,
        prmFroDate: `${year}-01-01`,
        prmToDate: `${year}-12-31`,
        prmLoginID: getUserSession().loginId,
        prmYearID: PI_CONFIG.CONFIG_YEAR_ID,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function buildInquiryColumns(navigate) {
  return [
    {
      key: "InquiryNo",
      label: "Inquiry No.",
      width: "14%",
      filterable: true,
      align: "left",
    },
    {
      key: "InquiryDate",
      label: "Inquiry Date",
      width: "11%",
      filterable: true,
      filterType: "date",
      render: (value) => formatListDate(value),
    },
    {
      key: "ExpectedDate",
      label: "Expected Date",
      width: "11%",
      filterable: true,
      filterType: "date",
      render: (value) => formatListDate(value),
    },
    {
      key: "Division",
      label: "Division",
      width: "12%",
      filterable: true,
      align: "left",
    },
    {
      key: "InquiryType",
      label: "Inquiry Type",
      width: "14%",
      filterable: true,
      align: "left",
    },
    {
      key: "BasedOn",
      label: "Based On",
      width: "12%",
      filterable: true,
      align: "left",
    },
    {
      key: "CreatedBy",
      label: "Created By",
      width: "11%",
      filterable: true,
      align: "left",
    },
    {
      key: "CreatedDate",
      label: "Created Date",
      width: "11%",
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
          className="pi-list__edit-btn"
          title={`Edit inquiry ${row.InquiryNo ?? ""}`}
          aria-label={`Edit inquiry ${row.InquiryNo ?? ""}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/purchase-inquiry/${row.IDNUMBER}/edit`, { state: { record: row } });
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function PurchaseInquiryPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(8);

  usePageHeader({
    title: "Purchase Inquiry",
    subtitle: "Browse purchase inquiries or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(() => buildInquiryColumns(navigate), [navigate]);

  const fetchInquiries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(json?.Table ?? []);
    } catch (err) {
      console.error("[PurchaseInquiryPage] list fetch failed:", err);
      setError("Failed to load purchase inquiries.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleAddNew = useCallback(() => {
    navigate("/purchase-inquiry/new");
  }, [navigate]);

  return (
    <div className="workspace-page pi-list-page">
      <section className="pi-list-panel pi-list-panel--compact pi-list-panel--fill">
        <header className="pi-list-panel__header">
          <div className="pi-list-panel__title">
            <ClipboardList size={14} strokeWidth={2} />
            <span>Purchase Inquiries</span>
          </div>
          <div className="pi-list-panel__toolbar">
            <button type="button" className="pi-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              Add New
            </button>
            <label htmlFor="pi-list-page-size" className="pi-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="pi-list-page-size"
              className="ng-select pi-list-panel__pagesize-select"
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
          loaderText="Loading inquiries…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase inquiries found."
          hideHeader
          fill
        />
      </section>
    </div>
  );
}
