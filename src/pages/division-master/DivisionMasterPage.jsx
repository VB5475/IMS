import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Network, Plus, Pencil } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { DEFAULT_COMPANY_ID } from "../../api/constants";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDivisionMaster } from "../../hooks/useDivisionMaster";
import { formatTranDate } from "../../utils/dateFormat";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import DivisionMasterForm from "./DivisionMasterForm";
import { DV_CONFIG } from "./constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import "./DivisionMasterPage.css";

function buildListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  return {
    ObjType: DV_CONFIG.LIST_OBJ_TYPE,
    ObjName: DV_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid:  DEFAULT_COMPANY_ID,
        prmdivisionid: DV_CONFIG.LIST_DIVISION_ID,
        prmfromdate:   today,
        prmtodate:     today,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

export default function DivisionMasterPage() {
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
  } = useDivisionMaster();

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalMode,    setModalMode]    = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title:    "Division Master",
    subtitle: "Browse divisions or create a new division record.",
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
      console.error("[DV] List fetch failed:", err);
      setError("Failed to load Division Master list.");
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
            className="dv-list__edit-btn"
            title={`Edit ${row.divisionname ?? row.DivisionName ?? row.divisioncode ?? ""}`}
            aria-label={`Edit ${row.divisionname ?? row.DivisionName ?? row.divisioncode ?? ""}`}
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
    <div className="workspace-page dv-list-page">
      <section className="dv-list-panel dv-list-panel--fill">
        <header className="dv-list-panel__header">
          <div className="dv-list-panel__title">
            <Network size={14} strokeWidth={2} />
            <span>Division Master</span>
          </div>
          <div className="dv-list-panel__toolbar">
            <button type="button" className="dv-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> Add New
            </button>
            <label htmlFor="dv-list-page-size" className="dv-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="dv-list-page-size"
              className="ng-select dv-list-panel__pagesize-select"
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
          loaderText="Loading divisions…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No divisions found."
          searchable
          hideHeader
          fill
        />
      </section>

      <DivisionMasterForm
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
