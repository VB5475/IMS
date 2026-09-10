import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Layers } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useAccountGroupMaster } from "../../hooks/useAccountGroupMaster";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import AccountGroupMasterForm from "./AccountGroupMasterForm";
import { AGM_CONFIG } from "./constants";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import "./AccountGroupMasterPage.css";

import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

const PRINT_CONFIG = PRINT_REPORT_CONFIG["account-group-master"];
function buildAccountGroupMasterReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: AGM_CONFIG.LIST_OBJ_TYPE,
    ObjName: AGM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{}]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AccountGroupMasterPage() {
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchEditRecord,
    fetchListRows,
    loadMainGroupOptions,
    refreshDropdownOptions,
    seedOptionsFromMaster,
  } = useAccountGroupMaster();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStats, setSearchStats] = useState({ matchCount: 0, totalCount: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editPrefill, setEditPrefill] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editLoadError, setEditLoadError] = useState(null);

  usePageHeader({
    title: "Account Group Master",
    subtitle: "Browse account groups or create a new group record.",
  });

  useEffect(() => {
    fetchHeaderMeta();
  }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchListRows(buildListParams());
      setData(rows);
    } catch (err) {
      console.error("[AGM] List fetch failed:", err);
      setError("Failed to load Account Group Master list.");
    } finally {
      setLoading(false);
    }
  }, [fetchListRows]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddNew = useCallback(() => {
    setModalMode("add");
    setEditPrefill(null);
    setEditLoadError(null);
    setModalOpen(true);
    loadMainGroupOptions();
  }, [loadMainGroupOptions]);

  const handleEdit = useCallback(
    async (row) => {
      const idNumber = resolveListRowId(row);
      setModalMode("edit");
      setEditPrefill(null);
      setEditLoadError(null);
      setModalOpen(true);
      setEditLoading(true);
      try {
        const session = getUserSession();
        const result = await fetchEditRecord({
          companyId: session.companyId,
          yearId: session.yearId,
          loginId: session.loginId,
          sessionId: DEFAULT_SESSION_ID,
          idNumber,
        });
        if (!result.master || !result.headerValues) {
          setEditLoadError("Record not found.");
          return;
        }
        seedOptionsFromMaster(result.master);
        setEditPrefill(result);
      } catch (err) {
        setEditLoadError(err?.message || "Failed to load record.");
      } finally {
        setEditLoading(false);
      }
    },
    [fetchEditRecord, seedOptionsFromMaster]
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditPrefill(null);
    setEditLoadError(null);
  }, []);

  const handleSaved = useCallback(() => {
    handleCloseModal();
    fetchList();
  }, [fetchList, handleCloseModal]);

  const columns = useMemo(
    () => [
      ...buildListColumnsFromApi({ data, fieldDefs }),
      createListActionsColumn({
        onEdit: handleEdit,
        getEditLabel: (row) => row.GrpName ?? row.acname ?? row.grpcode ?? "",
        getDeleteLabel: (row) => row.GrpName ?? row.acname ?? row.grpcode ?? "",
      }),
    ],
    [data, fieldDefs, handleEdit]
  );

  return (
    <div className="workspace-page agm-list-page">
      <section className="agm-list-panel agm-list-panel--fill">
        <ListPanelHeader
          icon={Layers}
          title="Account Group Master"
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            reportTitle: PRINT_CONFIG.reportTitle,
            reportFileName: PRINT_CONFIG.reportFileName,
            buildParams: buildAccountGroupMasterReportParams,
          }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <EnterpriseDataGrid
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading account groups…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No account groups found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={AGM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <AccountGroupMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        defsLoading={headerFetching}
        defsError={headerError}
        dropdownOptions={dropdownOptions}
        onRefreshDropdowns={refreshDropdownOptions}
        editPrefill={editPrefill}
        recordLoading={editLoading}
        recordLoadError={editLoadError}
      />
    </div>
  );
}
