import React, { useState, useEffect, useMemo, useCallback } from "react";
import { BookUser, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import { DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useAccountMaster } from "../../hooks/useAccountMaster";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import AccountMasterForm from "./AccountMasterForm";
import { AM_CONFIG } from "./constants";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import "./AccountMasterPage.css";

function buildAccountMasterReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  return {
    ObjType: AM_CONFIG.LIST_OBJ_TYPE,
    ObjName: AM_CONFIG.SP_LIST,
    JSon: JSON.stringify([{}]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function AccountMasterPage() {
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchEditRecord,
    fetchListRows,
    refreshDropdownOptions,
    seedOptionsFromMaster,
  } = useAccountMaster();

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
    title: "Account Master",
    subtitle: "Browse accounts or create a new account record.",
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
      console.error("[AM] List fetch failed:", err);
      setError("Failed to load Account Master list.");
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

  /**
   * Forwarded to AccountMasterForm so it can trigger Country→State or
   * State→City cascade reloads. The hook's refreshDropdownOptions accepts
   * (parentColName, currentValues) for the geo-cascade case.
   */
  const handleRefreshDropdowns = useCallback(
    (parentColName, currentValues) => {
      return refreshDropdownOptions(parentColName, currentValues);
    },
    [refreshDropdownOptions]
  );

  const columns = useMemo(
    () => [
      ...buildListColumnsFromApi({ data, fieldDefs }),
      createListActionsColumn({
        onEdit: handleEdit,
        getEditLabel: (row) => row.acname ?? row.AcName ?? row.accode ?? "",
        getDeleteLabel: (row) => row.acname ?? row.AcName ?? row.accode ?? "",
      }),
    ],
    [data, fieldDefs, handleEdit]
  );

  return (
    <div className="workspace-page am-list-page">
      <section className="am-list-panel am-list-panel--fill">
        <header className="am-list-panel__header">
          <div className="am-list-panel__title">
            <BookUser size={14} strokeWidth={2} />
            <span>Account Master</span>
          </div>
          <div className="am-list-panel__toolbar">
            <button type="button" className="am-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> Add New
            </button>
            <PrintReportButton
              reportTitle="Account Master Report"
              reportFileName="TODO_AccountMaster.rpt"
              buildParams={buildAccountMasterReportParams}
            />
            <label htmlFor="am-list-page-size" className="am-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="am-list-page-size"
              className="ng-select am-list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
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
          loaderText="Loading accounts…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No accounts found."
          hideHeader
          searchable
          deleteProcName={AM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <AccountMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        defsLoading={headerFetching}
        defsError={headerError}
        dropdownOptions={dropdownOptions}
        onRefreshDropdowns={handleRefreshDropdowns}
        editPrefill={editPrefill}
        recordLoading={editLoading}
        recordLoadError={editLoadError}
      />
    </div>
  );
}
