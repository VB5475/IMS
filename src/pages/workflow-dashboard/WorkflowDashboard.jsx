// WorkflowDashboard.jsx — multi-level approval dashboard (WKF).
// Modeled on MaintenanceDashboard.jsx (the MRD's own "GREEN — example value"
// column literally copies that module's SPs as its template values).
// Read-only: no Save flow, no per-row actions — MRD Section 5.1 confirms
// "RB Save API: -". Status buttons (Pending/InProcess/Approved) each set a
// prmStatus/prmDecisionStatus pair and reload the SAME grid in place — a
// 2026-08-11 /pm decision resolving the MRD's legacy ASP.NET
// Session.Add+Redirect phrasing (no separate "wkflist" route).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Workflow } from "lucide-react";
import DashboardFilterPanelV2 from "../../components/filters/DashboardFilterPanelV2";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import RefreshButton from "../../components/ui/RefreshButton";
import { useApi } from "../../api/useApi";
import { API_BASE_URL, ENDPOINTS, OBJ_TYPE } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useNotification } from "../../context/NotificationContext";
import { usePageHeader } from "../../context/PageHeaderContext";
import { controlTypeMap } from "../../data/dummyData";
import { buildGridColumns, toEnterpriseDataGridColumns } from "../../utils/gridUtils";
import { formatTranDate } from "../../utils/dateFormat";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { WKF_DASHBOARD_CONFIG, WKF_STATUS_FILTERS, WKF_DEFAULT_STATUS } from "./constants";
import "./WorkflowDashboard.css";

// Live-confirmed 2026-08-11: pr_WKF_Get_Dashboard_List_COM_APP errors
// ("Conversion from string "" to type 'Date' is not valid") when
// prmFromDate/prmToDate are empty — even though the MRD marks both as NOT
// required. Default to the current fiscal year (Apr 1 → today), same
// convention as Purchase Quotation's list-range default, so a bare Search
// with no dates picked still works.
function defaultFiscalYearRange() {
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const pad = (n) => String(n).padStart(2, "0");
  return {
    fromdate: `${fyStartYear}-04-01`,
    todate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
}

function ensureRows(result, sourceName) {
  const rows = Array.isArray(result) ? result : [];
  const errorRow = rows.find((row) => String(row?.ErrCode ?? row?.errcode ?? "") === "-1");
  if (errorRow) {
    throw new Error(errorRow.ErrMsg ?? errorRow.errmsg ?? `Failed to load ${sourceName}.`);
  }
  return rows;
}

function uniqueOptions(options) {
  const seen = new Set();
  return options.filter((option) => {
    const key = String(option.value ?? "");
    if (!key || !option.label || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapDivisionOptions(rows) {
  return uniqueOptions(rows.map((row) => ({
    value: String(row.divisionid ?? row.DivisionID ?? 0),
    label: String(row.divisionname ?? row.division ?? row.DivisionName ?? ""),
  })));
}

// ⚠️ DBA-pending — MRD doesn't specify this SP's response column names;
// guessed from the sibling dropdown SPs' own conventions in this codebase.
function mapTransactionNameOptions(rows) {
  return uniqueOptions(rows.map((row) => ({
    value: String(row.trantypeid ?? row.TranTypeID ?? row.idnumber ?? 0),
    label: String(row.trantypename ?? row.TranTypeName ?? row.name ?? ""),
  })));
}

function mapInitiateByOptions(rows) {
  return uniqueOptions(rows.map((row) => ({
    value: String(row.userid ?? row.UserID ?? row.loginid ?? 0),
    label: String(row.username ?? row.UserName ?? row.name ?? ""),
  })));
}

function buildFetchParams(objName, jsonRow, objType = OBJ_TYPE.FUNCTION) {
  return {
    ObjType: objType,
    ObjName: objName,
    JSon: JSON.stringify([jsonRow]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function WorkflowDashboard() {
  const { get } = useApi(API_BASE_URL);
  const notify = useNotification();
  const session = useMemo(() => getUserSession(), []);
  const initialValues = useMemo(() => ({
    divisionid: "",
    transactionno: "",
    transactionname: "",
    initiateby: "",
    ...defaultFiscalYearRange(),
  }), []);

  const [filterValues, setFilterValues] = useState(initialValues);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [transactionNameOptions, setTransactionNameOptions] = useState([]);
  const [initiateByOptions, setInitiateByOptions] = useState([]);
  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [activeStatus, setActiveStatus] = useState(WKF_DEFAULT_STATUS);

  usePageHeader({
    title: "Workflow Dashboard",
    subtitle: "Track multi-level approval status across transactions.",
    showBack: true,
    backTo: "/",
  });

  const fetchFunction = useCallback(async (objName, jsonRow, sourceName, objType) => {
    const result = await get(ENDPOINTS.FN_FETCH_DATA, buildFetchParams(objName, jsonRow, objType));
    return ensureRows(result, sourceName);
  }, [get]);

  const loadColumns = useCallback(async () => {
    setLoadingColumns(true);
    try {
      const rbRows = await fetchFunction(
        WKF_DASHBOARD_CONFIG.SP_RB_META,
        { prmRBCode: WKF_DASHBOARD_CONFIG.RB_DETAIL },
        "workflow dashboard metadata"
      );
      const rbId = rbRows[0]?.rbid ?? rbRows[0]?.RBID;
      if (!rbId) throw new Error("Workflow dashboard RB metadata was not returned.");

      const apiColumns = await get(ENDPOINTS.GET_DETAIL_COL_DATA, {
        prmMasterID: rbId,
        prmLoginID: Number(session.loginId) || 1,
      });
      const gridColumns = buildGridColumns(apiColumns || [], {}, {
        filterable: true,
        allEditable: false,
      });
      setColumns(toEnterpriseDataGridColumns(gridColumns));
    } catch (err) {
      console.error("[WorkflowDashboard] metadata fetch failed:", err);
      setColumns([]);
      setError(err?.message || "Failed to load dashboard column configuration.");
    } finally {
      setLoadingColumns(false);
    }
  }, [fetchFunction, get, session.loginId]);

  const loadDivisions = useCallback(async () => {
    const rows = await fetchFunction(
      WKF_DASHBOARD_CONFIG.SP_DIVISION,
      {
        prmuserid: Number(session.loginId) || 1,
        prmcompanyid: Number(session.companyId) || 1,
        prmyearid: Number(session.yearId) || 1,
      },
      "divisions"
    );
    setDivisionOptions(mapDivisionOptions(rows));
  }, [fetchFunction, session]);

  const loadTransactionNames = useCallback(async (divisionId) => {
    if (!divisionId) {
      setTransactionNameOptions([]);
      return;
    }
    try {
      const rows = await fetchFunction(
        WKF_DASHBOARD_CONFIG.SP_TRANSACTION_NAME,
        {
          prmcompanyid: Number(session.companyId) || 1,
          prmdivisonid: Number(divisionId) || 0,
          prmloginid: Number(session.loginId) || 1,
        },
        "transaction names"
      );
      setTransactionNameOptions(mapTransactionNameOptions(rows));
    } catch (err) {
      console.warn("[WorkflowDashboard] transaction name fetch failed:", err);
      setTransactionNameOptions([]);
    }
  }, [fetchFunction, session]);

  const loadInitiateBy = useCallback(async (divisionId) => {
    if (!divisionId) {
      setInitiateByOptions([]);
      return;
    }
    try {
      const rows = await fetchFunction(
        WKF_DASHBOARD_CONFIG.SP_INITIATE_BY,
        {
          prmcompanyid: Number(session.companyId) || 1,
          prmdivisonid: Number(divisionId) || 0,
          prmloginid: Number(session.loginId) || 1,
        },
        "initiators"
      );
      setInitiateByOptions(mapInitiateByOptions(rows));
    } catch (err) {
      console.warn("[WorkflowDashboard] initiate-by fetch failed:", err);
      setInitiateByOptions([]);
    }
  }, [fetchFunction, session]);

  useEffect(() => {
    loadColumns();
    loadDivisions().catch((err) => {
      console.error("[WorkflowDashboard] division fetch failed:", err);
      setError(err?.message || "Failed to load division options.");
    });
  }, [loadColumns, loadDivisions]);

  const filters = useMemo(() => [
    {
      FilterParameterID: "divisionid",
      FilterColName: "divisionid",
      FilterCaption: "Division",
      FilterColCtrlType: controlTypeMap.DROPDOWN,
      staticOptions: divisionOptions,
      columnMeta: { displayName: "Division", dataKind: "numeric", isMandatory: true },
    },
    {
      FilterParameterID: "fromdate",
      FilterColName: "fromdate",
      FilterCaption: "From Date",
      FilterColCtrlType: controlTypeMap.DATE,
      columnMeta: { displayName: "From Date", dataKind: "date", isMandatory: false },
    },
    {
      FilterParameterID: "todate",
      FilterColName: "todate",
      FilterCaption: "To Date",
      FilterColCtrlType: controlTypeMap.DATE,
      columnMeta: { displayName: "To Date", dataKind: "date", isMandatory: false },
    },
    {
      FilterParameterID: "transactionno",
      FilterColName: "transactionno",
      FilterCaption: "Transaction No",
      FilterColCtrlType: controlTypeMap.TEXTAREA,
      columnMeta: { displayName: "Transaction No", dataKind: "text", isMandatory: false },
    },
    {
      FilterParameterID: "transactionname",
      FilterColName: "transactionname",
      FilterCaption: "Transaction Name",
      FilterColCtrlType: controlTypeMap.DROPDOWN,
      staticOptions: transactionNameOptions,
      columnMeta: { displayName: "Transaction Name", dataKind: "numeric", isMandatory: false },
    },
    {
      FilterParameterID: "initiateby",
      FilterColName: "initiateby",
      FilterCaption: "Initiate By",
      FilterColCtrlType: controlTypeMap.DROPDOWN,
      staticOptions: initiateByOptions,
      columnMeta: { displayName: "Initiate By", dataKind: "numeric", isMandatory: false },
    },
  ], [divisionOptions, transactionNameOptions, initiateByOptions]);

  const handleFilterChange = useCallback((colName, value) => {
    setFilterValues((prev) => ({ ...prev, [colName]: value }));
    if (colName === "divisionid") {
      setTransactionNameOptions([]);
      setInitiateByOptions([]);
      setFilterValues((prev) => ({ ...prev, transactionname: "", initiateby: "" }));
      if (value) {
        loadTransactionNames(value).catch((err) => {
          console.error("[WorkflowDashboard] transaction name fetch failed:", err);
          notify.error(err?.message || "Failed to load transaction names.");
        });
        loadInitiateBy(value).catch((err) => {
          console.error("[WorkflowDashboard] initiate-by fetch failed:", err);
          notify.error(err?.message || "Failed to load initiators.");
        });
      }
    }
  }, [loadTransactionNames, loadInitiateBy, notify]);

  const runSearch = useCallback(async (values, status) => {
    if (!values.divisionid) {
      notify.error("Select Division before searching.");
      return;
    }
    const statusCfg = WKF_STATUS_FILTERS[status] ?? WKF_STATUS_FILTERS[WKF_DEFAULT_STATUS];
    try {
      setSearching(true);
      setError(null);
      setData([]);
      const rows = await fetchFunction(
        WKF_DASHBOARD_CONFIG.SP_DATA,
        {
          prmstatus: statusCfg.prmStatus,
          prmdecisionstatus: statusCfg.prmDecisionStatus,
          prmuserid: Number(session.loginId) || 1,
          // Live-confirmed 2026-08-11 — the SP errors on an empty date
          // string ("Conversion from string "" to type 'Date' is not
          // valid"), so these always carry a value (defaulted above) rather
          // than "" when the user hasn't touched the date pickers.
          prmfromdate: formatTranDate(values.fromdate, { fallbackToToday: true }),
          prmtodate: formatTranDate(values.todate, { fallbackToToday: true }),
          // ⚠️ DBA-pending — no UI field maps to prmComp/prmDept/prmDocType/
          // prmFrom per the MRD; sent empty until clarified.
          prmcomp: String(session.companyId ?? ""),
          prmdiv: String(values.divisionid ?? ""),
          prmdept: "",
          prmdoctype: "",
          prmfrom: "",
          prmininame: values.initiateby ?? "",
          prmrefno: values.transactionno ?? "",
          prmsubject: "",
          prmtrantype4disp: values.transactionname ?? "",
          // The SP declares these as its own OUTPUT params (separate from the
          // wrapper's own p_ErrCode/p_ErrMsg) — live-confirmed 2026-08-11 the
          // call 500s ("There is no row at position 14") without placeholder
          // values present for them in the JSON row.
          prmerrnum: 0,
          prmerrmsg: "",
        },
        "workflow dashboard data",
        WKF_DASHBOARD_CONFIG.DATA_OBJ_TYPE
      );
      setData(rows);
    } catch (err) {
      console.error("[WorkflowDashboard] search failed:", err);
      setData([]);
      setError(err?.message || "Failed to load workflow dashboard data.");
    } finally {
      setSearching(false);
    }
  }, [fetchFunction, notify, session]);

  const handleSearch = useCallback((values) => {
    runSearch(values, activeStatus);
  }, [runSearch, activeStatus]);

  const handleStatusClick = useCallback((status) => {
    setActiveStatus(status);
    runSearch(filterValues, status);
  }, [filterValues, runSearch]);

  return (
    <div className="workspace-page workspace-page--fill workflow-dashboard">
      <section className="workspace-page__filters">
        <DashboardFilterPanelV2
          title="Workflow Dashboard"
          staticFilters={filters}
          initialValues={initialValues}
          externalValues={filterValues}
          onFilterChange={handleFilterChange}
          onSearch={handleSearch}
          isSearching={searching}
          actionLabel="Search"
          ActionIcon={Search}
        />
      </section>

      <section className="workflow-dashboard__status-bar" aria-label="Approval status">
        {Object.entries(WKF_STATUS_FILTERS).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            className={`workflow-dashboard__status-btn${activeStatus === key ? " workflow-dashboard__status-btn--active" : ""}`}
            aria-pressed={activeStatus === key}
            onClick={() => handleStatusClick(key)}
          >
            {cfg.label}
          </button>
        ))}
      </section>

      <section className="workspace-page__grid workflow-dashboard__grid">
        <EnterpriseDataGrid
          title="Workflow Approvals"
          icon={<Workflow size={15} strokeWidth={2} />}
          columns={columns}
          data={data}
          loading={loadingColumns || searching}
          error={error}
          loaderText={
            loadingColumns
              ? "Loading dashboard column configuration…"
              : "Loading workflow approvals…"
          }
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage={
            columns.length === 0 && !loadingColumns
              ? "Workflow dashboard columns could not be loaded."
              : "Select Division and click Search to load approvals."
          }
          searchable
          fill
          variant="dashboard-v2"
          getRowKey={(row, index) =>
            String(row.idnumber ?? row.compuniquekey ?? `workflow-${index}`)
          }
          bottomPanelExtras={
            <RefreshButton
              onClick={() => runSearch(filterValues, activeStatus)}
              loading={searching}
              title="Re-run the last search"
            />
          }
        />
      </section>
    </div>
  );
}
