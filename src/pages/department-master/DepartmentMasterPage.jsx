import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Building2, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDepartmentMaster } from "../../hooks/useDepartmentMaster";
import { formatTranDate } from "../../utils/dateFormat";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import DepartmentMasterForm from "./DepartmentMasterForm";
import { DM_CONFIG } from "./constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import "./DepartmentMasterPage.css";

function buildListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  return {
    ObjType: DM_CONFIG.LIST_OBJ_TYPE,
    ObjName: DM_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid:  DEFAULT_COMPANY_ID,
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
    () =>
      buildListColumnsFromApi({
        data,
        fieldDefs,
        onEdit: (row) => {
          const id = resolveListRowId(row);
          if (id != null) handleEdit(id);
        },
        renderEditCell: (row, onEdit) => (
          <button
            type="button"
            className="dm-list__edit-btn"
            title={`Edit ${row.deptname ?? row.DeptName ?? row.deptcode ?? ""}`}
            aria-label={`Edit ${row.deptname ?? row.DeptName ?? row.deptcode ?? ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(row);
            }}
          >
            <Pencil size={13} strokeWidth={2} />
          </button>
        ),
      }),
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
        fetchEditRecord={fetchEditRecord}
        seedOptionsFromMaster={seedOptionsFromMaster}
      />
    </div>
  );
}
