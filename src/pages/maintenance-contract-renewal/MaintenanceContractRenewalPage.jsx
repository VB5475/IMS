import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import RefreshButton from "../../components/ui/RefreshButton";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { MACR_CONFIG, ENTRY_FORM_LABEL, buildMacrListJsonPayload } from "./constants";
import "./MaintenanceContractRenewalPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { useModuleRights } from "../../hooks/useModuleRights";

function buildListParams() {
  return {
    ObjType: MACR_CONFIG.LIST_OBJ_TYPE,
    ObjName: MACR_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildMacrListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function MaintenanceContractRenewalPage() {
  const { canInsert } = useModuleRights();
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Maintenance Contract Renewal",
    subtitle: "Renew maintenance contracts from prior contract detail.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: MACR_CONFIG.ROUTE_PATH,
        editBtnClass: "macr-list__edit-btn",
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
      console.error("[MACR] list fetch failed:", err);
      setError(err?.message || "Failed to load Maintenance Contract Renewal records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate(`${MACR_CONFIG.ROUTE_PATH}/new`),
    [navigate]
  );

  return (
    <div className="workspace-page macr-list-page">
      <section className="macr-list-panel macr-list-panel--fill">
        <header className="macr-list-panel__header">
          <div className="macr-list-panel__title">
            <RefreshCw size={14} strokeWidth={2} />
            <span>Maintenance Contract Renewal</span>
          </div>
          <div className="macr-list-panel__toolbar">
            {canInsert && (
              <button type="button" className="macr-list-panel__add-btn" onClick={handleAddNew}>
                <Plus size={14} strokeWidth={2.5} />
                {ENTRY_FORM_LABEL}
              </button>
            )}
            <RefreshButton onClick={fetchList} loading={loading} />
            <label htmlFor="macr-list-page-size" className="macr-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="macr-list-page-size"
              className="ng-select macr-list-panel__pagesize-select"
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
          loaderText="Loading Maintenance Contract Renewal records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Maintenance Contract Renewal records found."
          hideHeader
          searchable
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
