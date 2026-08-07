import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Building2, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDepartmentMaster } from "../../hooks/useDepartmentMaster";
import { useUserMaster } from "../../hooks/useUserMaster";
import { formatTranDate } from "../../utils/dateFormat";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import DepartmentMasterForm from "./DepartmentMasterForm";
import UserMasterForm from "../user-master/UserMasterForm";
import { DM_CONFIG } from "./constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import "./DepartmentMasterPage.css";

import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";

const PRINT_CONFIG = PRINT_REPORT_CONFIG["department-master"];
function buildDepartmentMasterReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  const session = getUserSession();
  return {
    ObjType: DM_CONFIG.LIST_OBJ_TYPE,
    ObjName: DM_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid:  session.companyId,
        prmdivisionid: DM_CONFIG.LIST_DIVISION_ID,
        prmfromdate:   today,
        prmtodate:     today,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

export default function DepartmentMasterPage() {
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs,
    allColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchEditRecord,
    fetchListRows,
    fetchDeptHeadOptions,
    refreshDropdownOptions,
    seedOptionsFromMaster,
  } = useDepartmentMaster();

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalMode,    setModalMode]    = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  // Quick-add source for the Department Head (User) dropdown — User Master
  // owns its own metadata; fetched lazily the first time its "+" is used.
  const userMaster = useUserMaster();
  const [userMetaLoaded, setUserMetaLoaded] = useState(false);
  const [userQuickAddOpen, setUserQuickAddOpen] = useState(false);

  const handleOpenUserQuickAdd = useCallback(() => {
    if (!userMetaLoaded) {
      userMaster.fetchHeaderMeta();
      setUserMetaLoaded(true);
    }
    setUserQuickAddOpen(true);
  }, [userMetaLoaded, userMaster]);

  const handleUserQuickAddSaved = useCallback(() => {
    setUserQuickAddOpen(false);
    fetchDeptHeadOptions();
  }, [fetchDeptHeadOptions]);

  usePageHeader({
    title:    "Department Master",
    subtitle: "Browse departments or create a new department record.",
    showBack: true,
    backTo:   "/",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchListRows(buildListParams());
      setData(rows);
    } catch (err) {
      console.error("[DM] List fetch failed:", err);
      setError("Failed to load Department Master list.");
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
        getEditLabel: (row) => row.deptname ?? row.DeptName ?? row.deptcode ?? "",
        getDeleteLabel: (row) => row.deptname ?? row.DeptName ?? row.deptcode ?? "",
      }),
    ],
    [data, fieldDefs, handleEdit]
  );

  return (
    <div className="workspace-page dm-list-page">
      <section className="dm-list-panel dm-list-panel--fill">
        <header className="dm-list-panel__header">
          <div className="dm-list-panel__title">
            <Building2 size={14} strokeWidth={2} />
            <span>Department Master</span>
          </div>
          <div className="dm-list-panel__toolbar">
            <button type="button" className="dm-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> Add New
            </button>
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle={PRINT_CONFIG.reportTitle}
              reportFileName={PRINT_CONFIG.reportFileName}
              buildParams={buildDepartmentMasterReportParams}
            />
            <label htmlFor="dm-list-page-size" className="dm-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="dm-list-page-size"
              className="ng-select dm-list-panel__pagesize-select"
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
          loaderText="Loading departments…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No departments found."
          searchable
          hideHeader
          deleteProcName={DM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <DepartmentMasterForm
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
        onRefreshDropdowns={refreshDropdownOptions}
        onRefreshDeptHead={fetchDeptHeadOptions}
        onQuickAddDeptHead={handleOpenUserQuickAdd}
        fetchEditRecord={fetchEditRecord}
        seedOptionsFromMaster={seedOptionsFromMaster}
      />

      <UserMasterForm
        isOpen={userQuickAddOpen}
        mode="add"
        recordId={null}
        onClose={() => setUserQuickAddOpen(false)}
        onSaved={handleUserQuickAddSaved}
        fieldDefs={userMaster.headerColumns}
        allColumns={userMaster.allColumns}
        defsLoading={userMaster.headerFetching}
        defsError={userMaster.headerError}
        dropdownOptions={userMaster.dropdownOptions}
        onRefreshDropdowns={userMaster.refreshDropdownOptions}
        onRefreshField={userMaster.refreshDropdownField}
      />
    </div>
  );
}
