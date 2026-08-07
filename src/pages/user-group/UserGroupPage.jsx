import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Shield } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useUserGroup } from "../../hooks/useUserGroup";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import UserGroupForm from "./UserGroupForm";
import { UG_CONFIG } from "./constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import "./UserGroupPage.css";
import ListPanelHeader from "../../components/list/ListPanelHeader";

function buildUserGroupReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: UG_CONFIG.LIST_OBJ_TYPE,
    ObjName: UG_CONFIG.SP_LIST,
    JSon: JSON.stringify([{}]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function UserGroupPage() {
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs,
    allColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchEditRecord,
    fetchListRows,
  } = useUserGroup();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title: "User Group",
    subtitle: "Browse groups or create a new user access group.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchListRows(buildListParams());
      setData(rows);
    } catch (err) {
      console.error("[UG] List fetch failed:", err);
      setError("Failed to load User Group list.");
    } finally {
      setLoading(false);
    }
  }, [fetchListRows]);

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
        getEditLabel: (row) => row.groupcode ?? row.groupname ?? "",
        getDeleteLabel: (row) => row.groupcode ?? row.groupname ?? "",
      }),
    ],
    [data, fieldDefs, handleEdit]
  );

  return (
    <div className="workspace-page ug-list-page">
      <section className="ug-list-panel ug-list-panel--fill">
        <ListPanelHeader
          icon={Shield}
          title="User Group"
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            reportTitle: "User Group Report",
            reportFileName: "TODO_UserGroup.rpt",
            buildParams: buildUserGroupReportParams,
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
          loaderText="Loading user groups…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No user groups found."
          searchable
          hideHeader
          deleteProcName={UG_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <UserGroupForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        dropdownOptions={dropdownOptions}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
