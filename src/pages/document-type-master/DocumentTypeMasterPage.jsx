import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FileText, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDocumentTypeMaster } from "../../hooks/useDocumentTypeMaster";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import DocumentTypeMasterForm from "./DocumentTypeMasterForm";
import { DOCTYPE_CONFIG } from "./constants";
import "./DocumentTypeMasterPage.css";

function buildDocTypeReportParams() {
  return [buildCompanyReportParam()];
}

function buildListParams() {
  return {
    ObjType: DOCTYPE_CONFIG.LIST_OBJ_TYPE,
    ObjName: DOCTYPE_CONFIG.SP_LIST,
    JSon: JSON.stringify([{}]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function DocumentTypeMasterPage() {
  const {
    fetchHeaderMeta, headerColumns: fieldDefs, headerFetching, headerError,
    departmentOptions, fetchEditRecord, fetchListRows,
  } = useDocumentTypeMaster();

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
    title: "Document Type Master",
    subtitle: "Browse document types or create a new document type record.",
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
      console.error("[DocType] List fetch failed:", err);
      setError("Failed to load Document Type Master list.");
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
    <div className="workspace-page doctype-list-page">
      <section className="doctype-list-panel doctype-list-panel--fill">
        <header className="doctype-list-panel__header">
          <div className="doctype-list-panel__title">
            <FileText size={14} strokeWidth={2} />
            <span>Document Type Master</span>
          </div>
          <div className="doctype-list-panel__toolbar">
            <button type="button" className="doctype-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> Add New
            </button>
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle="DMS Document Type Master Report"
              reportFileName="TODO_DocumentTypeMaster.rpt"
              buildParams={buildDocTypeReportParams}
            />
            <label htmlFor="doctype-list-page-size" className="doctype-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="doctype-list-page-size"
              className="ng-select doctype-list-panel__pagesize-select"
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
          loaderText="Loading document types…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No document types found."
          hideHeader
          searchable
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <DocumentTypeMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        defsLoading={headerFetching}
        defsError={headerError}
        departmentOptions={departmentOptions}
        editPrefill={editPrefill}
        recordLoading={editLoading}
        recordLoadError={editLoadError}
      />
    </div>
  );
}
