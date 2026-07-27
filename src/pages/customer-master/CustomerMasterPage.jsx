import React, { useState, useEffect, useMemo, useCallback } from "react";
import { UserCheck, Plus } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import PrintReportButton from "../../components/ui/PrintReportButton";
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
    detailColumns, detailAllColumns, detailFetching, detailError, fetchDetailMeta,
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
    fetchDetailMeta();
  }, [fetchHeaderMeta, fetchDetailMeta]);

  const fetchCustomerList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams());
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[CustomerMasterPage] list fetch failed:", err);
      setError("Failed to load customers.");
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

  return (
    <div className="workspace-page sm-list-page">
      <section className="sm-list-panel sm-list-panel--compact sm-list-panel--fill">
        <header className="sm-list-panel__header">
          <div className="sm-list-panel__title">
            <UserCheck size={14} strokeWidth={2} />
            <span>Customers</span>
          </div>
          <div className="sm-list-panel__toolbar">
            <button type="button" className="sm-list-panel__add-btn" onClick={handleAddNew}>
              <Plus size={14} strokeWidth={2.5} />
              {ENTRY_FORM_LABEL}
            </button>
            <PrintReportButton
              reportTitle="Customer Master Report"
              reportFileName="TODO_CustomerMaster.rpt"
              buildParams={buildCustomerMasterReportParams}
            />
            <label htmlFor="cm-list-page-size" className="sm-list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id="cm-list-page-size"
              className="ng-select sm-list-panel__pagesize-select"
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
          loaderText="Loading customers…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No customers found."
          hideHeader
          searchable
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
        detailColumns={detailColumns}
        detailAllColumns={detailAllColumns}
        detailFetching={detailFetching}
        detailError={detailError}
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
