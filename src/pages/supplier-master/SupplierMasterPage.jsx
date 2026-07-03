import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, DEFAULT_COMPANY_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { SM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./SupplierMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

function buildListParams() {
  const session = getUserSession();
  return {
    ObjType: SM_CONFIG.LIST_OBJ_TYPE,
    ObjName: SM_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId ?? DEFAULT_COMPANY_ID,
        prmdivisionid: SM_CONFIG.LIST_DIVISION_ID,
        prmfromdate: "",
        prmtodate: "",
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function SupplierMasterPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Supplier Master",
    subtitle: "Browse suppliers or create a new one.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: "/admin/master/supplier-master",
        editBtnClass: "sm-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchSupplierList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[SupplierMasterPage] list fetch failed:", err);
      setError("Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchSupplierList();
  }, [fetchSupplierList]);

  const handleAddNew = useCallback(() => {
    navigate("/admin/master/supplier-master/new");
  }, [navigate]);

  return (
    <div className="workspace-page sm-list-page">
      <section className="sm-list-panel sm-list-panel--compact sm-list-panel--fill">
        <header className="sm-list-panel__header">
          <div className="sm-list-panel__title">
            <Truck size={14} strokeWidth={2} />
            <span>Suppliers</span>
          </div>
          <div className="sm-list-panel__toolbar">
            <button type="button" className="sm-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <label htmlFor="sm-list-page-size" className="sm-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="sm-list-page-size"
              className="ng-select sm-list-panel__pagesize-select"
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
          loaderText="Loading suppliers…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No suppliers found."
          hideHeader
          searchable
          fill
        />
      </section>
    </div>
  );
}
