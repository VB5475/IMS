import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Users } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useUserMaster } from "../../hooks/useUserMaster";
import { useUserGroup } from "../../hooks/useUserGroup";
import { useDepartmentMaster } from "../../hooks/useDepartmentMaster";
import { formatTranDate } from "../../utils/dateFormat";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import UserMasterForm from "./UserMasterForm";
import UserGroupForm from "../user-group/UserGroupForm";
import DepartmentMasterForm from "../department-master/DepartmentMasterForm";
import { UM_CONFIG } from "./constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import "./UserMasterPage.css";

function buildUserMasterReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  const session = getUserSession();
  return {
    ObjType: UM_CONFIG.LIST_OBJ_TYPE,
    ObjName: UM_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid:  session.companyId,
        prmdivisionid: UM_CONFIG.LIST_DIVISION_ID,
        prmfromdate:   today,
        prmtodate:     today,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function UserMasterPage() {
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs,
    allColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchEditRecord,
    fetchListRows,
    refreshDropdownOptions,
    refreshDropdownField,
    seedOptionsFromMaster,
  } = useUserMaster();

  // Quick-add sources for the Group / Department dropdowns — each master
  // module owns its own metadata; fetched lazily the first time its "+" is used.
  const userGroup = useUserGroup();
  const departmentMaster = useDepartmentMaster();
  const [groupMetaLoaded, setGroupMetaLoaded] = useState(false);
  const [deptMetaLoaded, setDeptMetaLoaded] = useState(false);
  const [groupQuickAddOpen, setGroupQuickAddOpen] = useState(false);
  const [deptQuickAddOpen, setDeptQuickAddOpen] = useState(false);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editPrefill, setEditPrefill] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editLoadError, setEditLoadError] = useState(null);

  usePageHeader({
    title: "User Master",
    subtitle: "Browse users or create a new system login.",
    showBack: true,
    backTo: "/",
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
      console.error("[UM] List fetch failed:", err);
      setError("Failed to load User Master list.");
    } finally {
      setLoading(false);
    }
  }, [fetchListRows]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleOpenGroupQuickAdd = useCallback(() => {
    if (!groupMetaLoaded) {
      userGroup.fetchHeaderMeta();
      setGroupMetaLoaded(true);
    }
    setGroupQuickAddOpen(true);
  }, [groupMetaLoaded, userGroup]);

  const handleOpenDeptQuickAdd = useCallback(() => {
    if (!deptMetaLoaded) {
      departmentMaster.fetchHeaderMeta();
      setDeptMetaLoaded(true);
    }
    setDeptQuickAddOpen(true);
  }, [deptMetaLoaded, departmentMaster]);

  const handleGroupQuickAddSaved = useCallback(() => {
    setGroupQuickAddOpen(false);
    refreshDropdownField("groupid");
  }, [refreshDropdownField]);

  const handleDeptQuickAddSaved = useCallback(() => {
    setDeptQuickAddOpen(false);
    refreshDropdownField("deptid");
  }, [refreshDropdownField]);

  const handleAddNew = useCallback(() => {
    setModalMode("add");
    setEditPrefill(null);
    setEditLoadError(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback(
    async (idNumber) => {
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
        onEdit: (row) => {
          const id = resolveListRowId(row);
          if (id != null) handleEdit(id);
        },
        getEditLabel: (row) => row.userid ?? row.username ?? "",
        getDeleteLabel: (row) => row.userid ?? row.username ?? "",
      }),
    ],
    [data, fieldDefs, handleEdit]
  );

  return (
    <div className="workspace-page um-list-page">
      <section className="um-list-panel um-list-panel--fill">
        <ListPanelHeader
          icon={Users}
          title="User Master"
          onAdd={handleAddNew}
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            reportTitle: "User Master Report",
            reportFileName: "TODO_UserMaster.rpt",
            buildParams: buildUserMasterReportParams,
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
          loaderText="Loading users…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No users found."
          searchable
          hideHeader
          deleteProcName={UM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <UserMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        allColumns={allColumns}
        defsLoading={headerFetching}
        defsError={headerError}
        dropdownOptions={dropdownOptions}
        onRefreshDropdowns={refreshDropdownOptions}
        onRefreshField={refreshDropdownField}
        onQuickAddGroup={handleOpenGroupQuickAdd}
        onQuickAddDepartment={handleOpenDeptQuickAdd}
        editPrefill={editPrefill}
        recordLoading={editLoading}
        recordLoadError={editLoadError}
      />

      <UserGroupForm
        isOpen={groupQuickAddOpen}
        mode="add"
        recordId={null}
        onClose={() => setGroupQuickAddOpen(false)}
        onSaved={handleGroupQuickAddSaved}
        fieldDefs={userGroup.headerColumns}
        allColumns={userGroup.allColumns}
        defsLoading={userGroup.headerFetching}
        defsError={userGroup.headerError}
        dropdownOptions={userGroup.dropdownOptions}
        fetchEditRecord={userGroup.fetchEditRecord}
      />

      <DepartmentMasterForm
        isOpen={deptQuickAddOpen}
        mode="add"
        recordId={null}
        onClose={() => setDeptQuickAddOpen(false)}
        onSaved={handleDeptQuickAddSaved}
        fieldDefs={departmentMaster.headerColumns}
        allColumns={departmentMaster.allColumns}
        defsLoading={departmentMaster.headerFetching}
        defsError={departmentMaster.headerError}
        dropdownOptions={departmentMaster.dropdownOptions}
        onRefreshDropdowns={departmentMaster.refreshDropdownOptions}
        fetchEditRecord={departmentMaster.fetchEditRecord}
        seedOptionsFromMaster={departmentMaster.seedOptionsFromMaster}
      />
    </div>
  );
}
