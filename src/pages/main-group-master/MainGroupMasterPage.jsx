import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Tag, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useMainGroupMaster } from "../../hooks/useMainGroupMaster";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import MainGroupMasterForm from "./MainGroupMasterForm";
import { MGM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./MainGroupMasterPage.css";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { useModuleRights } from "../../hooks/useModuleRights";

function buildMainGroupReportParams() {
  return [buildCompanyReportParam()];
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function todayFormatted() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function buildListParams() {
  const today = todayFormatted();
  const session = getUserSession();
  return {
    ObjType: MGM_CONFIG.LIST_OBJ_TYPE,
    ObjName: MGM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{
      prmcompanyid: session.companyId,
      prmdivisionid: MGM_CONFIG.LIST_DIVISION_ID,
      prmfromdate: today,
      prmtodate: today,
    }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function MainGroupMasterPage() {
  const { canInsert } = useModuleRights();
  const { get } = useApi(API_BASE_URL);

  // Field defs (from GetDetailColData) + dropdown options fetched once — passed down to form
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs, allColumns, headerFetching, headerError,
    itemTypeOptions, fixedAssetAccOptions,
    fetchEditRecord, seedOptionsFromMaster,
  } = useMainGroupMaster();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title: "Main Group Master",
    subtitle: "Browse main groups or create a new one.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(res ?? res ?? []);
    } catch (err) {
      console.error("[MGM] List fetch failed:", err);
      setError("Failed to load Main Group list.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => {
    setModalMode("add");
    setEditRecordId(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((idNumber) => {
    setModalMode("edit");
    setEditRecordId(idNumber);
    setModalOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    setModalOpen(false);
    fetchList();
  }, [fetchList]);

  const columns = useMemo(
    () => [
      ...buildListColumnsFromApi({ data, fieldDefs }),
      createListActionsColumn({
        onEdit: (row) => {
          const id = resolveListRowId(row);
          if (id != null) handleEdit(id);
        },
        getEditLabel: (row) => row.maingroupcode ?? row.maingroupname ?? "",
        getDeleteLabel: (row) => row.maingroupcode ?? row.maingroupname ?? "",
      }),
    ],
    [data, fieldDefs, handleEdit]
  );

  return (
    <div className="workspace-page mgm-list-page">
      <section className="mgm-list-panel mgm-list-panel--fill">
        <header className="mgm-list-panel__header">
          <div className="mgm-list-panel__title">
            <Tag size={14} strokeWidth={2} />
            <span>Main Group Master</span>
          </div>
          <div className="mgm-list-panel__toolbar">
            {canInsert && (
              <button type="button" className="mgm-list-panel__add-btn" onClick={handleAddNew}>
                <Plus size={14} strokeWidth={2.5} /> {ENTRY_FORM_LABEL}
              </button>
            )}
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle="Main Group Master Report"
              reportFileName="RptMainGroupList_PG.rpt"
              buildParams={buildMainGroupReportParams}
            />
            <label htmlFor="mgm-list-page-size" className="mgm-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="mgm-list-page-size"
              className="ng-select mgm-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </header>

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading main groups…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No main groups found."
          hideHeader
          searchable
          deleteProcName={MGM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <MainGroupMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        itemTypeOptions={itemTypeOptions}
        fixedAssetAccOptions={fixedAssetAccOptions}
        fetchEditRecord={fetchEditRecord}
        seedOptionsFromMaster={seedOptionsFromMaster}
      />
    </div>
  );
}
