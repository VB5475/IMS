import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { AST_CONFIG, ENTRY_FORM_LABEL, buildAstListJsonPayload } from "./constants";
import "./AssetsStockTransferPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

function buildListParams() {
  return {
    ObjType: AST_CONFIG.LIST_OBJ_TYPE,
    ObjName: AST_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildAstListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsStockTransferPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Stock Transfer",
    subtitle: "Transfer assets between divisions and locations.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: "/assets-stock-transfer",
        editBtnClass: "ast-list__edit-btn",
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
      console.error("[AST] list fetch failed:", err);
      setError("Failed to load Assets Stock Transfer records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(
    () => navigate("/assets-stock-transfer/new"),
    [navigate]
  );

  return (
    <div className="workspace-page ast-list-page">
      <section className="ast-list-panel ast-list-panel--fill">
        <header className="ast-list-panel__header">
          <div className="ast-list-panel__title">
            <ArrowLeftRight size={14} strokeWidth={2} />
            <span>Assets Stock Transfer</span>
          </div>
          <div className="ast-list-panel__toolbar">
            <button type="button" className="ast-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <label htmlFor="ast-list-page-size" className="ast-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="ast-list-page-size"
              className="ng-select ast-list-panel__pagesize-select"
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
          loaderText="Loading Assets Stock Transfer records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Stock Transfer records found."
          hideHeader
          searchable
          deleteProcName={AST_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
