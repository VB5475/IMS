// AssetsEmployeeIssuePage.jsx — Assets Employee Issue listing page

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
} from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { AEI_CONFIG, ENTRY_FORM_LABEL, buildAeiListJsonPayload } from "./constants";
import "./AssetsEmployeeIssuePage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";

function buildListParams() {
  return {
    ObjType: AEI_CONFIG.LIST_OBJ_TYPE,
    ObjName: AEI_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildAeiListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsEmployeeIssuePage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Employee Issue",
    subtitle: "Issue assets and items to employees.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: AEI_CONFIG.ROUTE_PATH,
        editBtnClass: "aei-list__edit-btn",
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
      console.error("[AEI] list fetch failed:", err);
      setError("Failed to load Assets Employee Issue records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(() => navigate(`${AEI_CONFIG.ROUTE_PATH}/new`), [navigate]);

  return (
    <div className="workspace-page aei-list-page">
      <section className="aei-list-panel aei-list-panel--fill">
        <header className="aei-list-panel__header">
          <div className="aei-list-panel__title">
            <UserRound size={14} strokeWidth={2} />
            <span>Assets Employee Issue</span>
          </div>
          <div className="aei-list-panel__toolbar">
            <button type="button" className="aei-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <label htmlFor="aei-list-page-size" className="aei-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="aei-list-page-size"
              className="ng-select aei-list-panel__pagesize-select"
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
          loaderText="Loading Assets Employee Issue records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Employee Issue records found."
          hideHeader
          searchable
          deleteProcName={AEI_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
