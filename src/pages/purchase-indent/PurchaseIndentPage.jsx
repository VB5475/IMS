// PurchaseIndentPage.jsx
// Purchase Indent listing / landing page.
// Mirrors PurchaseOrderPage.jsx — same grid, toolbar, navigation pattern.
// Clicking Add New → /purchase-indent/new  (PurchaseIndentForm in new mode)
// Clicking Edit   → /purchase-indent/:id   (PurchaseIndentForm in edit mode)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_LOGIN_ID, DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { IND_CONFIG } from "./constants";
import "./PurchaseIndentPage.css";

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
    ObjType: IND_CONFIG.LIST_OBJ_TYPE,
    ObjName: IND_CONFIG.SP_INDENT_LIST,
    JSon: JSON.stringify([
      {
        PrmCompanyID: DEFAULT_COMPANY_ID,
        prmDivisionID: IND_CONFIG.LIST_DIVISION_ID,
        prmFromDate: `01-Jan-${year}`,
        prmToDate: `31-Dec-${year}`,
        PrmDepartmentId: 0
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function buildIndentColumns(navigate) {
  return [
    {
      key: "IndentNo",
      label: "Indent No.",
      width: "13%",
      filterable: true,
      align: "left",
    },
    {
      key: "IndentDate",
      label: "Indent Date",
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
      width: "13%",
      filterable: true,
      align: "left",
    },
    {
      key: "IndentType",
      label: "Indent Type",
      width: "14%",
      filterable: true,
      align: "left",
    },
    {
      key: "Department",
      label: "Department",
      width: "13%",
      filterable: true,
      align: "left",
    },
    {
      key: "CreatedBy",
      label: "Created By",
      width: "12%",
      filterable: true,
      align: "left",
    },
    {
      key: "CreatedDate",
      label: "Created Date",
      width: "10%",
      filterable: true,
      filterType: "date",
      render: (value) => formatListDate(value),
    },
    {
      key: "_actions",
      label: "Edit",
      width: "5%",
      align: "center",
      render: (_value, row) => (
        <button
          type="button"
          className="ind-list__edit-btn"
          title={`Edit Indent ${row.IndentNo ?? ""}`}
          aria-label={`Edit Indent ${row.IndentNo ?? ""}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/purchase-indent/${row.IndentID ?? row.IDNumber}/edit`, {
              state: { record: row },
            });
          }}
        >
          <Pencil size={13} strokeWidth={2} />
        </button>
      ),
    },
  ];
}

export default function PurchaseIndentPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(8);

  usePageHeader({
    title: "Purchase Indents",
    subtitle: "Browse purchase indents or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(() => buildIndentColumns(navigate), [navigate]);

  const fetchIndents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(json?.Table ?? []);
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
              Add New
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
          fill
        />
      </section>
    </div>
  );
}
