import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Building2, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDMDepartmentMaster } from "../../hooks/useDMDepartmentMaster";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import DMDepartmentMasterForm from "./DMDepartmentMasterForm";
import { DMDEPT_CONFIG } from "./constants";
import "./DMDepartmentMasterPage.css";
import { useModuleRights } from "../../hooks/useModuleRights";

function buildDMDeptReportParams() {
  return [buildCompanyReportParam()];
}

function buildListParams() {
  return {
    ObjType: DMDEPT_CONFIG.LIST_OBJ_TYPE,
    ObjName: DMDEPT_CONFIG.SP_LIST,
    JSon: JSON.stringify([{}]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function DMDepartmentMasterPage() {
  const { canInsert } = useModuleRights();
  const {
    fetchHeaderMeta, headerColumns: fieldDefs, headerFetching, headerError,
    fetchEditRecord, fetchListRows,
  } = useDMDepartmentMaster();

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
    title: "Department Master",
    subtitle: "Browse DMS departments or create a new department record.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => { fetchHeaderMeta(); }, [fetchHeaderMeta]);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await fetchListRows(buildListParams()));
    } catch (err) {
      console.error("[DMDept] List fetch failed:", err);
      setError("Failed to load Department Master list.");
    } finally {
      setLoading(false);
    }
  }, [fetchListRows]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleAddNew = useCallback(() => {
    setModalMode("add");
    setEditPrefill(null);
    setEditLoadError(null);
    setModalOpen(true);
  }, []);

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
          companyId: session.companyId, yearId: session.yearId,
          loginId: session.loginId, sessionId: DEFAULT_SESSION_ID, idNumber,
        });
        if (!result.master || !result.headerValues) {
          setEditLoadError("Record not found.");
          return;
        }
        setEditPrefill(result);
      } catch (err) {
        setEditLoadError(err?.message || "Failed to load record.");
      } finally {
        setEditLoading(false);
      }
    },
    [fetchEditRecord]
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
        getEditLabel: (row) => row.Name ?? row.name ?? "",
        getDeleteLabel: (row) => row.Name ?? row.name ?? "",
      }),
    ],
    [data, fieldDefs, handleEdit]
  );

  return (
    <div className="workspace-page dmdept-list-page">
      <section className="dmdept-list-panel dmdept-list-panel--fill">
        <header className="dmdept-list-panel__header">
          <div className="dmdept-list-panel__title">
            <Building2 size={14} strokeWidth={2} />
            <span>Department Master</span>
          </div>
          <div className="dmdept-list-panel__toolbar">
            {canInsert && (
              <button type="button" className="dmdept-list-panel__add-btn" onClick={handleAddNew}>
                <Plus size={14} strokeWidth={2.5} /> Add New
              </button>
            )}
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle="DMS Department Master Report"
              reportFileName="TODO_DMDepartmentMaster.rpt"
              buildParams={buildDMDeptReportParams}
            />
            <label htmlFor="dmdept-list-page-size" className="dmdept-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="dmdept-list-page-size"
              className="ng-select dmdept-list-panel__pagesize-select"
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
          loaderText="Loading departments…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No departments found."
          hideHeader
          searchable
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <DMDepartmentMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        defsLoading={headerFetching}
        defsError={headerError}
        editPrefill={editPrefill}
        recordLoading={editLoading}
        recordLoadError={editLoadError}
      />
    </div>
  );
}
