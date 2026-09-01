import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Tag } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
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
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

function buildMainGroupReportParams(selectedId) {
  const params = [buildCompanyReportParam()];
  return params;
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
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStats, setSearchStats] = useState({ matchCount: 0, totalCount: 0 });
  const gridRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

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

  const handlePrintParams = useCallback(
    () => buildMainGroupReportParams(selectedId),
    [selectedId]
  );

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Main_Group_Master_export.csv");
  }, []);

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
        <ListPanelHeader
          icon={Tag}
          title="Main Group Master"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["main-group-master"],
            buildParams: handlePrintParams,
          }}
          onExportCsv={handleExportCsv}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <EnterpriseDataGrid
          ref={gridRef}
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
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={MGM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
          selectable
          singleSelect
          selectedRowKeys={selectedId != null ? [String(selectedId)] : []}
          onSelectionChange={(keys) => setSelectedId(keys[0] != null ? keys[0] : null)}
          getRowKey={(row) => String(resolveListRowId(row) ?? "")}
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
