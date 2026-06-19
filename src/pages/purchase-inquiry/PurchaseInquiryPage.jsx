import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { PI_CONFIG } from "./constants";
import "./PurchaseInquiryPage.css";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

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

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: "/purchase-inquiry",
        editBtnClass: "pi-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchInquiries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json?.Table ?? []));
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
