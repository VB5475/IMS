import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FileStack, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
import RefreshButton from "../../components/ui/RefreshButton";
import { DEFAULT_SESSION_ID } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDocumentSubTypeMaster } from "../../hooks/useDocumentSubTypeMaster";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createListActionsColumn } from "../../utils/listGridUtils";
import { buildCompanyReportParam } from "../../utils/reportParams";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import DocumentSubTypeMasterForm from "./DocumentSubTypeMasterForm";
import { DOCSUBTYPE_CONFIG } from "./constants";
import "./DocumentSubTypeMasterPage.css";

function buildDocSubTypeReportParams() {
  return [buildCompanyReportParam()];
}

function buildListParams() {
  return {
    ObjType: DOCSUBTYPE_CONFIG.LIST_OBJ_TYPE,
    ObjName: DOCSUBTYPE_CONFIG.SP_LIST,
    JSon: JSON.stringify([{}]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function DocumentSubTypeMasterPage() {
  const {
    fetchHeaderMeta, headerColumns: fieldDefs, headerFetching, headerError,
    departmentOptions, documentTypeOptions, fetchDocumentTypeOptions,
    fetchEditRecord, fetchListRows,
  } = useDocumentSubTypeMaster();

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
    title: "Document SubType Master",
    subtitle: "Browse document subtypes or create a new document subtype record.",
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
      console.error("[DocSubType] List fetch failed:", err);
      setError("Failed to load Document SubType Master list.");
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
    <div className="workspace-page docsubtype-list-page">
      <section className="docsubtype-list-panel docsubtype-list-panel--fill">
        <header className="docsubtype-list-panel__header">
          <div className="docsubtype-list-panel__title">
            <FileStack size={14} strokeWidth={2} />
            <span>Document SubType Master</span>
          </div>
          <div className="docsubtype-list-panel__toolbar">
            <button type="button" className="docsubtype-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} /> Add New
            </button>
            <RefreshButton onClick={fetchList} loading={loading} />
            <PrintReportButton
              reportTitle="DMS Document SubType Master Report"
              reportFileName="TODO_DocumentSubTypeMaster.rpt"
              buildParams={buildDocSubTypeReportParams}
            />
            <label htmlFor="docsubtype-list-page-size" className="docsubtype-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="docsubtype-list-page-size"
              className="ng-select docsubtype-list-panel__pagesize-select"
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
          loaderText="Loading document subtypes…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No document subtypes found."
          hideHeader
          searchable
          onDeleteSuccess={fetchList}
          fill
        />
      </section>

      <DocumentSubTypeMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        fieldDefs={fieldDefs}
        defsLoading={headerFetching}
        defsError={headerError}
        departmentOptions={departmentOptions}
        documentTypeOptions={documentTypeOptions}
        onDepartmentChange={fetchDocumentTypeOptions}
        editPrefill={editPrefill}
        recordLoading={editLoading}
        recordLoadError={editLoadError}
      />
    </div>
  );
}
