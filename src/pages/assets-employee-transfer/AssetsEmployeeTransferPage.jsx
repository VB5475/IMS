// AssetsEmployeeTransferPage.jsx — Assets Employee Transfer listing page

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
} from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { buildListPageColumns, normalizeListRows } from "../../utils/listGridUtils";
import { AET_CONFIG, ENTRY_FORM_LABEL, buildAetListJsonPayload } from "./constants";
import "./AssetsEmployeeTransferPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import PrintReportButton from "../../components/ui/PrintReportButton";
import { buildCompanyReportParam } from "../../utils/reportParams";

function buildAetReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: AET_CONFIG.LIST_OBJ_TYPE,
    ObjName: AET_CONFIG.SP_LIST,
    JSon: JSON.stringify([buildAetListJsonPayload()]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AssetsEmployeeTransferPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  usePageHeader({
    title: "Assets Employee Transfer",
    subtitle: "Transfer employee-held assets between locations and departments.",
    showBack: true,
    backTo: "/",
  });

  const columns = useMemo(
    () =>
      buildListPageColumns(data, {
        navigate,
        basePath: AET_CONFIG.ROUTE_PATH,
        editBtnClass: "aet-list__edit-btn",
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
      console.error("[AET] list fetch failed:", err);
      setError("Failed to load Assets Employee Transfer records.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(() => navigate(`${AET_CONFIG.ROUTE_PATH}/new`), [navigate]);

  return (
    <div className="workspace-page aet-list-page">
      <section className="aet-list-panel aet-list-panel--fill">
        <header className="aet-list-panel__header">
          <div className="aet-list-panel__title">
            <ArrowLeftRight size={14} strokeWidth={2} />
            <span>Assets Employee Transfer</span>
          </div>
          <div className="aet-list-panel__toolbar">
            <button type="button" className="aet-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <PrintReportButton
              reportTitle="Assets Employee Transfer Report"
              reportFileName="TODO_AssetsEmployeeTransfer.rpt"
              buildParams={buildAetReportParams}
            />
            <label htmlFor="aet-list-page-size" className="aet-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="aet-list-page-size"
              className="ng-select aet-list-panel__pagesize-select"
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
          loaderText="Loading Assets Employee Transfer records…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No Assets Employee Transfer records found."
          hideHeader
          searchable
          deleteProcName={AET_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>
    </div>
  );
}
