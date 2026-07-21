import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Network } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDivisionMaster } from "../../hooks/useDivisionMaster";
import { formatTranDate } from "../../utils/dateFormat";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createEditActionColumn } from "../../utils/listGridUtils";
import DivisionMasterForm from "./DivisionMasterForm";
import { DV_CONFIG } from "./constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import "./DivisionMasterPage.css";

function buildListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  const session = getUserSession();
  return {
    ObjType: DV_CONFIG.LIST_OBJ_TYPE,
    ObjName: DV_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid:  session.companyId,
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
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title:    "Division Master",
    subtitle: "Browse and update division records.",
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

  const handleEdit = useCallback((idNumber) => {
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
      createEditActionColumn({
        onEdit: (row) => {
          const id = resolveListRowId(row);
          if (id != null) handleEdit(id);
        },
        getEditLabel: (row) => row.divisionname ?? row.DivisionName ?? row.divisioncode ?? "",
      }),
    ],
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
        mode="edit"
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
