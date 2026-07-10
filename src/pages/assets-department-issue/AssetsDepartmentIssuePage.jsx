import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { ADI_CONFIG, ENTRY_FORM_LABEL, buildAdiListJsonPayload } from "./constants";
import "./AssetsDepartmentIssuePage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

function buildListParams() {
  return {
    ObjType: ADI_CONFIG.LIST_OBJ_TYPE,
    ObjName: ADI_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildAdiListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsDepartmentIssuePage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Department Issue",
    subtitle: "Issue assets and items to departments.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: "/assets-department-issue",
        editBtnClass: "adi-list__edit-btn",
      }),
    [data, navigate]
  );

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[ADI] list fetch failed:", err);
      setError("Failed to load Assets Department Issue records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(() => navigate("/assets-department-issue/new"), [navigate]);

  return (
    <div className="workspace-page adi-list-page">
      <section className="adi-list-panel adi-list-panel--fill">
        <header className="adi-list-panel__header">
          <div className="adi-list-panel__title">
            <Building2 size={14} strokeWidth={2} />
            <span>Assets Department Issue</span>
          </div>
          <div className="adi-list-panel__toolbar">
            <button type="button" className="adi-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <label htmlFor="adi-list-page-size" className="adi-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="adi-list-page-size"
              className="ng-select adi-list-panel__pagesize-select"
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
          loaderText="Loading Assets Department Issue records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Department Issue records found."
          hideHeader
          searchable
          deleteProcName={ADI_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
