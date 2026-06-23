// PurchaseIndentPage.jsx
// Purchase Indent listing / landing page.
// Clicking Add New → /purchase-indent/new  (PurchaseIndentForm in new mode)
// Clicking Edit   → /purchase-indent/:id/edit (PurchaseIndentForm in edit mode)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { IND_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./PurchaseIndentPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

function buildListParams() {
  const year = new Date().getFullYear();
  return {
    ObjType: IND_CONFIG.LIST_OBJ_TYPE,
    ObjName: IND_CONFIG.SP_INDENT_LIST,
    JSon: JSON.stringify([
      {
        PrmCompanyID: DEFAULT_COMPANY_ID,
        prmDivisionID: IND_CONFIG.LIST_DIVISION_ID,
        prmFromDate: `01-Jan-${year}`,
        prmToDate: `31-Dec-${year}`,
        PrmDepartmentId: 0,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function PurchaseIndentPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Purchase Indents",
    subtitle: "Browse purchase indents or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: "/purchase-indent",
        editBtnClass: "ind-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchIndents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json?.Table ?? []));
    } catch (err) {
      console.error("[PurchaseIndentPage] list fetch failed:", err);
      setError("Failed to load purchase indents.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchIndents();
  }, [fetchIndents]);

  const handleAddNew = useCallback(() => {
    navigate("/purchase-indent/new");
  }, [navigate]);

  return (
    <div className="workspace-page ind-list-page">
      <section className="ind-list-panel ind-list-panel--fill">
        <header className="ind-list-panel__header">
          <div className="ind-list-panel__title">
            <ClipboardList size={14} strokeWidth={2} />
            <span>Purchase Indents</span>
          </div>
          <div className="ind-list-panel__toolbar">
            <button type="button" className="ind-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <label htmlFor="ind-list-page-size" className="ind-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="ind-list-page-size"
              className="ng-select ind-list-panel__pagesize-select"
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
          loaderText="Loading purchase indents…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No purchase indents found."
          hideHeader
          searchable
          fill
        />
      </section>
    </div>
  );
}
