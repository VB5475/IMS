import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Building } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useCompanyMaster } from "../../hooks/useCompanyMaster";
import { formatTranDate } from "../../utils/dateFormat";
import { buildListColumnsFromApi, resolveListRowId } from "../../utils/listColumns";
import { createEditActionColumn } from "../../utils/listGridUtils";
import CompanyForm from "./CompanyForm";
import { CO_CONFIG } from "./constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import "./CompanyPage.css";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

function buildCompanyReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  const today = formatTranDate(new Date(), { invalidValue: "" });
  const session = getUserSession();
  return {
    ObjType: CO_CONFIG.LIST_OBJ_TYPE,
    ObjName: CO_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid:  session.companyId,
        prmdivisionid: CO_CONFIG.LIST_DIVISION_ID,
        prmfromdate:   today,
        prmtodate:     today,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg:  "",
  };
}

export default function CompanyPage() {
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
  } = useCompanyMaster();

  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const gridRef = useRef(null);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title:    "Company",
    subtitle: "Browse and update company records.",
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
      console.error("[CO] List fetch failed:", err);
      setError("Failed to load Company list.");
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
        getEditLabel: (row) => row.name ?? row.Name ?? row.code ?? row.Code ?? "",
      }),
    ],
    [data, fieldDefs, handleEdit]
  );

  const handleExportCsv = useCallback(() => {
    const { rows, columns: exportCols } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, exportCols, "Company_export.csv");
  }, []);

  return (
    <div className="workspace-page co-list-page">
      <section className="co-list-panel co-list-panel--fill">
        <ListPanelHeader
          icon={Building}
          title="Company"
          onRefresh={fetchList}
          refreshing={loading}
          print={{
            ...PRINT_REPORT_CONFIG["company"],
            buildParams: buildCompanyReportParams,
          }}
          onExportCsv={handleExportCsv}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <EnterpriseDataGrid
          ref={gridRef}
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading companies…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No companies found."
          searchable
          hideHeader
          fill
        />
      </section>

      <CompanyForm
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
