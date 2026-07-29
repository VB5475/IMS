import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ArrowLeftRight, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import { DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDMTT2DocTypeMaster } from "../../hooks/useDMTT2DocTypeMaster";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import DMTT2DocTypeMasterForm from "./DMTT2DocTypeMasterForm";
import { TT2DOCTYPE_CONFIG } from "./constants";
import "./DMTT2DocTypeMasterPage.css";

function buildTT2DocTypeReportParams() {
  return [buildCompanyReportParam()];
}

function buildListParams() {
  return {
    ObjType: TT2DOCTYPE_CONFIG.LIST_OBJ_TYPE,
    ObjName: TT2DOCTYPE_CONFIG.SP_LIST,
    JSon: JSON.stringify([{}]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function DMTT2DocTypeMasterPage() {
  const {
    fetchHeaderMeta, headerColumns: fieldDefs, headerFetching, headerError,
    tranTypeOptions, fetchEditRecord, fetchListRows,
  } = useDMTT2DocTypeMaster();

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
    title: "Transaction To Document Type Master",
    subtitle: "Browse department/tran-type to document-type mappings or create a new one.",
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
      console.error("[TT2DocType] List fetch failed:", err);
      setError(err?.message || "Failed to load Transaction To Document Type Master list.");
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
    <div className="workspace-page tt2doctype-list-page">
      <section className="tt2doctype-list-panel tt2doctype-list-panel--fill">
        <header className="tt2doctype-list-panel__header">
          <div className="tt2doctype-list-panel__title">
            <ArrowLeftRight size={14} strokeWidth={2} />
            <span>Transaction To Document Type Master</span>
          </div>
          <div className="tt2doctype-list-panel__toolbar">
            <button type="button" className="tt2doctype-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> Add New
            </button>
            <PrintReportButton
              reportTitle="DMS Transaction To Document Type Master Report"
              reportFileName="TODO_DMTT2DocTypeMaster.rpt"
              buildParams={buildTT2DocTypeReportParams}
            />
            <label htmlFor="tt2doctype-list-page-size" className="tt2doctype-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="tt2doctype-list-page-size"
              className="ng-select tt2doctype-list-panel__pagesize-select"
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
          loaderText="Loading transaction to document type mappings…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No transaction to document type mappings found."
          hideHeader
          searchable
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <DMTT2DocTypeMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        defsLoading={headerFetching}
        defsError={headerError}
        tranTypeOptions={tranTypeOptions}
        editPrefill={editPrefill}
        recordLoading={editLoading}
        recordLoadError={editLoadError}
      />
    </div>
  );
}
