import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DoorOpen, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { ARGO_CONFIG, ENTRY_FORM_LABEL, buildArgoListJsonPayload } from "./constants";
import "./AssetsReturnableGatePassOutPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

function buildListParams() {
  return {
    ObjType: ARGO_CONFIG.LIST_OBJ_TYPE,
    ObjName: ARGO_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildArgoListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsReturnableGatePassOutPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Returnable Gate Pass Out",
    subtitle: "Issue assets for returnable gate pass out.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: "/assets-returnable-gate-pass-out",
        editBtnClass: "argo-list__edit-btn",
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
      console.error("[ARGO] list fetch failed:", err);
      setError("Failed to load Assets Returnable Gate Pass Out records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate("/assets-returnable-gate-pass-out/new"),
    [navigate]
  );

  return (
    <div className="workspace-page argo-list-page">
      <section className="argo-list-panel argo-list-panel--fill">
        <header className="argo-list-panel__header">
          <div className="argo-list-panel__title">
            <DoorOpen size={14} strokeWidth={2} />
            <span>Assets Returnable Gate Pass Out</span>
          </div>
          <div className="argo-list-panel__toolbar">
            <button type="button" className="argo-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <label htmlFor="argo-list-page-size" className="argo-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="argo-list-page-size"
              className="ng-select argo-list-panel__pagesize-select"
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
          loaderText="Loading Assets Returnable Gate Pass Out records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Returnable Gate Pass Out records found."
          hideHeader
          searchable
          deleteProcName={ARGO_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
