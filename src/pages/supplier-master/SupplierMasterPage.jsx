import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Truck, Send } from "lucide-react";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { withGetRetry } from "../../utils/apiRetry";
import { ENDPOINTS, API_BASE_URL, API_BASE_URL_IMS, OBJ_TYPE } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useNotification } from "../../context/NotificationContext";
import { normalizeListRows, createListActionsColumn, isAlwaysHiddenColumnKey } from "../../utils/listGridUtils";
import { resolveListRowId } from "../../utils/listColumns";
import { resolveRowFieldValue } from "../../utils/gridUtils";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { useApprovalRowStatus } from "../../hooks/useApprovalRowStatus";
import { useSupplierMaster } from "../../hooks/useSupplierMaster";
import SupplierMasterForm from "./SupplierMasterForm";
import { SM_CONFIG, ENTRY_FORM_LABEL } from "./constants";
import "./SupplierMasterPage.css";
import { formatTranDate } from "../../utils/dateFormat";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { buildCompanyReportParam } from "../../utils/reportParams";
import ListPanelHeader from "../../components/list/ListPanelHeader";
import { PRINT_REPORT_CONFIG } from "../../constants/printReportConfig";
import { exportRowsToCsv } from "../../utils/csvExport";

function buildSupplierMasterReportParams() {
  return [
    buildCompanyReportParam(),
  ];
}

function buildListParams(divisionId) {
  const session = getUserSession();
  const today = formatTranDate(new Date(), { invalidValue: "" });
  return {
    ObjType: SM_CONFIG.LIST_OBJ_TYPE,
    ObjName: SM_CONFIG.SP_LIST,
    JSon: JSON.stringify([
      {
        prmcompanyid: session.companyId,
        prmdivisionid: divisionId,
        prmfromdate: today,
        prmtodate: today,
        prmentrytype: SM_CONFIG.ENTRY_TYPE,
      },
    ]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

const HIDDEN_COLS = new Set(["idnumber"]);

function buildColumnsFromData(data, onEdit) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLS.has(k) && !isAlwaysHiddenColumnKey(k));
  return [
    ...keys.map((key) => ({ key, label: key, filterable: true, align: "left" })),
    createListActionsColumn({
      onEdit: (row) => { if (row.idnumber) onEdit(row.idnumber); },
      getEditLabel: (row) => row.suppliername ?? row.supname ?? "",
      getDeleteLabel: (row) => row.suppliername ?? row.supname ?? "",
    }),
  ];
}

export default function SupplierMasterPage() {
  const { get: rawGet } = useApi(API_BASE_URL);
  const get = useMemo(() => withGetRetry(rawGet), [rawGet]);
  const { post: postWkf } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const {
    headerColumns, headerFetching, headerError, fetchHeaderMeta,
    stateOptions, cityOptions, fetchStateOptions, fetchCityOptions, clearStates, clearCities,
    categoryOptions, accountGroupOptions, countryOptions, registrationTypeOptions,
    currencyOptions, transporterOptions, transporterDestinationOptions,
    deducteeTypeOptions, nopOptions,
    fetchEditRecord,
  } = useSupplierMaster();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStats, setSearchStats] = useState({ matchCount: 0, totalCount: 0 });
  const gridRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editRecordId, setEditRecordId] = useState(null);

  // "Approval Initiator" button (WKF) — visibility is a per-login,
  // per-trantype backend flag, same pattern as Purchase Order/Purchase
  // Quotation's. Defaults to "NO" (safe default-deny) until the fetch resolves.
  const [wkfBtnVisible, setWkfBtnVisible] = useState("NO");
  const [sendingApproval, setSendingApproval] = useState(false);

  // The division this page actually uses everywhere it needs one (list fetch
  // + WKF send) — resolved dynamically from the logged-in user's own real
  // division(s) via fn_tbl_fetchuserwsdivision (same SP/pattern PQ, PO,
  // Purchase Indent, CWIP To FA etc. all already use), 2026-08-27 /pm.
  // SM_CONFIG.LIST_DIVISION_ID stays as the seed/fallback value — used
  // immediately on mount (no flash of empty data) and kept if the fetch
  // fails or the user genuinely has no divisions.
  const [effectiveDivisionId, setEffectiveDivisionId] = useState(SM_CONFIG.LIST_DIVISION_ID);

  // appstatusid-driven row color + Edit/Delete lock, per src/config/approvalStatusConfig.js.
  const getRowState = useApprovalRowStatus("supplier-master");

  useEffect(() => {
    const session = getUserSession();
    postWkf(ENDPOINTS.WKF_HANDLE_BUTTON_VISIBILITY, {
      prmref_is_trantypeid: SM_CONFIG.WKF_TRAN_TYPE_ID,
      prmloginid: session.loginId,
    })
      .then((res) => {
        const row = Array.isArray(res) ? res[0] : res;
        setWkfBtnVisible(row?.iswkfbtnvisible === "YES" ? "YES" : "NO");
      })
      .catch((err) => {
        console.warn("[SupplierMasterPage] WKF button visibility fetch failed:", err);
        setWkfBtnVisible("NO");
      });

    get(ENDPOINTS.FN_FETCH_DATA, {
      ObjType: OBJ_TYPE.FUNCTION,
      ObjName: "fn_tbl_fetchuserwsdivision",
      JSon: JSON.stringify([{
        prmuserid: session.loginId,
        prmcompanyid: session.companyId,
        prmyearid: session.yearId,
      }]),
      p_ErrCode: -1,
      p_ErrMsg: "",
    })
      .then((rows) => {
        const first = (rows || [])[0];
        const id = first ? resolveRowFieldValue(first, "divisionid") : null;
        if (id != null) setEffectiveDivisionId(Number(id));
      })
      .catch((err) => console.warn("[SupplierMasterPage] User division fetch failed:", err));
  }, [postWkf, get]);

  // Supplier Master's list rows carry no per-row division field (confirmed
  // live — company-wide admin master, unlike PQ/PO's division-scoped
  // transactions) — effectiveDivisionId (the resolved user division, see
  // above) is the only "division" this module has, used here too.
  const handleSendForApproval = useCallback(async () => {
    if (!selectedId) {
      notify.error("Select a supplier before sending it for approval.");
      return;
    }
    const session = getUserSession();
    setSendingApproval(true);
    try {
      const result = await postWkf(ENDPOINTS.WKF_SEND_FOR_APPROVAL, {
        prmref_is_trantypeid: SM_CONFIG.WKF_TRAN_TYPE_ID,
        prmtranid: Number(selectedId),
        prmcolnamesoftranid: "idnumber",
        prmyearid: session.yearId,
        prmloginid: session.loginId,
        prmdivisionid: effectiveDivisionId,
      });
      const { success, message } = parseApiErrMsg(result);
      if (!success) { notify.error(message); return; }
      notify.success(message);
    } catch (err) {
      console.error("[SupplierMasterPage] Send for approval failed:", err);
      notify.error(err?.message || "Failed to send for approval. Please try again.");
    } finally {
      setSendingApproval(false);
    }
  }, [selectedId, effectiveDivisionId, postWkf, notify]);

  usePageHeader({
    title: "Supplier Master",
    subtitle: "Browse suppliers or create a new one.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    fetchHeaderMeta();
  }, [fetchHeaderMeta]);

  const fetchSupplierList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await get(ENDPOINTS.FN_FETCH_DATA, buildListParams(effectiveDivisionId));
      setData(normalizeListRows(json ?? []));
    } catch (err) {
      console.error("[SupplierMasterPage] list fetch failed:", err);
      setError(err?.message || "Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  }, [get, effectiveDivisionId]);

  useEffect(() => {
    fetchSupplierList();
  }, [fetchSupplierList]);

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
    fetchSupplierList();
  }, [fetchSupplierList]);

  const columns = useMemo(() => buildColumnsFromData(data, handleEdit), [data, handleEdit]);

  const handleExportCsv = useCallback(() => {
    const { rows, columns: exportCols } = gridRef.current?.getExportData() ?? {};
    exportRowsToCsv(rows, exportCols, "Supplier_Master_export.csv");
  }, []);

  return (
    <div className="workspace-page sm-list-page">
      <section className="sm-list-panel sm-list-panel--compact sm-list-panel--fill">
        <ListPanelHeader
          icon={Truck}
          title="Suppliers"
          addLabel={ENTRY_FORM_LABEL}
          onAdd={handleAddNew}
          onRefresh={fetchSupplierList}
          refreshing={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={searchStats.matchCount}
          totalCount={searchStats.totalCount}
          print={{
            ...PRINT_REPORT_CONFIG["supplier-master"],
            buildParams: buildSupplierMasterReportParams,
          }}
          onExportCsv={handleExportCsv}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        >
          {wkfBtnVisible === "YES" && (
            <button
              type="button"
              className="sm-list__wkf-btn"
              onClick={handleSendForApproval}
              disabled={!selectedId || sendingApproval}
              title="Select a supplier, then send it for approval"
            >
              <Send size={13} strokeWidth={2.5} />
              {sendingApproval ? "Sending…" : "Approval Initiator"}
            </button>
          )}
        </ListPanelHeader>

        <EnterpriseDataGrid
          ref={gridRef}
          title=""
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          loaderText="Loading suppliers…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage="No suppliers found."
          hideHeader
          searchable
          hideSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchStats={setSearchStats}
          deleteProcName={SM_CONFIG.DELETE_PROC_NAME}
          onDeleteSuccess={fetchSupplierList}
          fill
          selectable
          singleSelect
          selectedRowKeys={selectedId != null ? [String(selectedId)] : []}
          onSelectionChange={(keys) => setSelectedId(keys[0] != null ? keys[0] : null)}
          getRowKey={(row) => String(resolveListRowId(row) ?? "")}
          getRowState={getRowState}
        />
      </section>

      <SupplierMasterForm
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
