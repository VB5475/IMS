import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { UserCheck } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { normalizeListRows, createListActionsColumn } from "../../utils/listGridUtils";
import { useCustomerMaster } from "../../hooks/useCustomerMaster";
import CustomerMasterForm from "./CustomerMasterForm";
import { CM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "../supplier-master/SupplierMasterPage.css";
import { formatTranDate } from "../../utils/dateFormat";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

function buildCustomerMasterReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams() {
  const session = getUserSession();
  const today = formatTranDate(new Date(), { invalidValue: "" });
  return {
    ObjType: CM_CONFIG.LIST_OBJ_TYPE,
    ObjName: CM_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: CM_CONFIG.LIST_DIVISION_ID,
        prmfromdate: today,
        prmtodate: today,
        prmentrytype: CM_CONFIG.ENTRY_TYPE,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

const HIDDEN_COLS = new Set(["idnumber"]);

function buildColumnsFromData(data, onEdit) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k));
  return [
    ...keys.map((key) => ({ key, label: key, filterable: true, align: "left" })),
    createListActionsColumn({
      onEdit: (row) => { if (row.idnumber) onEdit(row.idnumber); },
      getEditLabel: (row) => row.suppliername ?? row.supname ?? "",
      getDeleteLabel: (row) => row.suppliername ?? row.supname ?? "",
    }),
  ];
}

export default function CustomerMasterPage() {
  const { get } = useApi(API_BASE_URL);

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    stateOptions, cityOptions, fetchStateOptions, fetchCityOptions, clearStates, clearCities,
    categoryOptions, accountGroupOptions, countryOptions, registrationTypeOptions,
    currencyOptions, transporterOptions, transporterDestinationOptions,
    deducteeTypeOptions, nopOptions,
    fetchEditRecord,
  } = useCustomerMaster();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStats, setSearchStats] = useState({ matchCount: 0, totalCount: 0 });
  const gridRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  usePageHeader({
    title: "Customer Master",
    subtitle: "Browse customers or create a new one.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    fetchHeaderMeta();
  }, [fetchHeaderMeta]);

  const fetchCustomerList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[CustomerMasterPage] list fetch failed:", err);
      setError(err?.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchCustomerList();
  }, [fetchCustomerList]);

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
    fetchCustomerList();
  }, [fetchCustomerList]);

  const columns = useMemo(() => buildColumnsFromData(data, handleEdit), [data, handleEdit]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, columns, "Customers_export.csv");
  }, []);

  return (
    <div className="workspace-page sm-list-page">
      <section className="sm-list-panel sm-list-panel--compact sm-list-panel--fill">
        <ListPanelHeader
          icon={UserCheck}
          title="Customers"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchCustomerList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["customer-master"],
            buildParams: buildCustomerMasterReportParams,
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
          loaderText="Loading customers…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No customers found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={CM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchCustomerList}
          fill
        />
      </section>

      <CustomerMasterForm
        isOpen={modalOpen}
        mode={modalMode}
        recordId={editRecordId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        headerColumns={headerColumns}
        headerFetching={headerFetching}
        headerError={headerError}
        stateOptions={stateOptions}
        cityOptions={cityOptions}
        fetchStateOptions={fetchStateOptions}
        fetchCityOptions={fetchCityOptions}
        clearStates={clearStates}
        clearCities={clearCities}
        categoryOptions={categoryOptions}
        accountGroupOptions={accountGroupOptions}
        countryOptions={countryOptions}
        registrationTypeOptions={registrationTypeOptions}
        currencyOptions={currencyOptions}
        transporterOptions={transporterOptions}
        transporterDestinationOptions={transporterDestinationOptions}
        deducteeTypeOptions={deducteeTypeOptions}
        nopOptions={nopOptions}
        fetchEditRecord={fetchEditRecord}
      />
    </div>
  );
}
