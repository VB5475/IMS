// WorkflowDashboard.jsx — multi-level approval dashboard (WKF).
// Modeled on MaintenanceDashboard.jsx (the MRD's own "GREEN — example value"
// column literally copies that module's SPs as its template values).
// Read-only: no Save flow, no per-row actions — MRD Section 5.1 confirms
// "RB Save API: -". Status buttons (Pending/InProcess/Approved) each set a
// prmStatus/prmDecisionStatus pair and reload the SAME grid in place — a
// 2026-08-11 /pm decision resolving the MRD's legacy ASP.NET
// Session.Add+Redirect phrasing (no separate "wkflist" route).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, Workflow } from "lucide-react";
import DashboardFilterPanelV2 from "../../components/filters/DashboardFilterPanelV2";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import { useApi } from "../../api/useApi";
import { API_BASE_URL, API_BASE_URL_IMS, ENDPOINTS, OBJ_TYPE } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useNotification } from "../../context/NotificationContext";
import { usePageHeader } from "../../context/PageHeaderContext";
import { controlTypeMap } from "../../data/dummyData";
import { buildGridColumns, toEnterpriseDataGridColumns } from "../../utils/gridUtils";
import { formatTranDate } from "../../utils/dateFormat";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import { WKF_DASHBOARD_CONFIG, WKF_STATUS_FILTERS, WKF_DEFAULT_STATUS } from "./constants";
import { buildWkfMainSearch } from "../wkf-main/constants";
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
    label: String(row.trantypename ?? row.TranTypeName ?? row.name ?? row.transactionname ?? ""),
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
  const { post } = useApi(API_BASE_URL_IMS);
  const navigate = useNavigate();
  const location = useLocation();
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
  const [refreshing, setRefreshing] = useState(false);
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
    // 2026-08-17 (/pm) — reordered per explicit UI-clarity request: From
    // Date, To Date, Division, Transaction No together in one row, then
    // Transaction Name + Initiate By below. Transaction No switched from
    // TEXTAREA to TEXTBOX — TEXTAREA forced it onto its own full-width row
    // (dfv2-slicer--full) in the dashboard layout, which is what was
    // splitting the first 4 fields across two rows.
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
      FilterParameterID: "divisionid",
      FilterColName: "divisionid",
      FilterCaption: "Division",
      FilterColCtrlType: controlTypeMap.DROPDOWN,
      staticOptions: divisionOptions,
      columnMeta: { displayName: "Division", dataKind: "numeric", isMandatory: true },
    },
    {
      FilterParameterID: "transactionno",
      FilterColName: "transactionno",
      FilterCaption: "Transaction No",
      FilterColCtrlType: controlTypeMap.TEXTBOX,
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

  // "Refresh" button, beside Search (2026-08-14 /pm) — replaces the old
  // bottom-of-grid RefreshButton (removed same day, redundant once this one
  // existed). Calls WKF_RefreshList first, THEN re-runs Search with whatever
  // filter values are currently on screen. Best-effort on the refresh call:
  // a failure there is surfaced but doesn't block Search, since Search is
  // independently useful either way (same "one step failing must never block
  // an already-useful next step" convention as this app's other chained
  // best-effort calls).
  const handleRefresh = useCallback(async (values) => {
    setRefreshing(true);
    try {
      const result = await post(WKF_DASHBOARD_CONFIG.REFRESH_ENDPOINT, {
        prmyearid: Number(session.yearId) || 1,
        prmloginid: Number(session.loginId) || 1,
        prmcomp: "",
      });
      const { success, message } = parseApiErrMsg(result);
      if (!success) notify.error(message || "Refresh failed.");
    } catch (err) {
      console.error("[WorkflowDashboard] refresh failed:", err);
      notify.error(err?.message || "Refresh failed. Please try again.");
    } finally {
      setRefreshing(false);
    }
    runSearch(values ?? filterValues, activeStatus);
  }, [post, session, notify, runSearch, filterValues, activeStatus]);

  const handleStatusClick = useCallback((status) => {
    setActiveStatus(status);
    runSearch(filterValues, status);
  }, [filterValues, runSearch]);

  // Row click -> /wkfmain (2026-08-14 /pm) — MRD's "session('wkfdashkey', ...)"
  // legacy phrasing, ported to query params + router state (see wkf-main's
  // constants.js). `index` must be the row's position in the FULL
  // unpaginated `data` array (confirmed via AskUserQuestion), not the
  // visible page — `data` IS that full array already (EnterpriseDataGrid
  // paginates it client-side), and `row` is the same object reference
  // EnterpriseDataGrid read it from, so a plain indexOf finds it correctly.
  const handleRowClick = useCallback((row) => {
    const index = data.indexOf(row);
    navigate(buildWkfMainSearch(row, index >= 0 ? index : 0), {
      state: { rows: data, filterValues, activeStatus },
    });
  }, [data, navigate, filterValues, activeStatus]);

  // Returning from a successful wkfmain action (2026-08-14 /pm, confirmed
  // via AskUserQuestion) — re-run the same search that was active when the
  // user left, once, so the list reflects the just-actioned record. Guarded
  // by a ref (not just checking location.state) so browser back/forward
  // landing on this same history entry again doesn't re-fire the search.
  const autoRefreshHandledRef = useRef(false);
  useEffect(() => {
    if (autoRefreshHandledRef.current) return;
    if (!location.state?.autoRefresh) return;
    autoRefreshHandledRef.current = true;
    const fv = location.state.filterValues ?? filterValues;
    const st = location.state.activeStatus ?? activeStatus;
    setFilterValues(fv);
    setActiveStatus(st);
    if (fv?.divisionid) runSearch(fv, st);
  }, [location.state, filterValues, activeStatus, runSearch]);

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
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
        >
          {/* 2026-08-17 (/pm) — status buttons moved into the same flex-wrap
              row as the filter fields (was its own section below); see
              EnterpriseFilterPanel's dashboard-layout `children` slot. */}
          <div className="workflow-dashboard__status-group" role="group" aria-label="Approval status">
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
          </div>
        </DashboardFilterPanelV2>
      </section>

      <section className="workspace-page__grid workflow-dashboard__grid">
        <EnterpriseDataGrid
          title="Workflow Approvals"
          icon={<Workflow size={15} strokeWidth={2} />}
          columns={columns}
          data={data}
          onRowClick={handleRowClick}
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
        />
      </section>
    </div>
  );
}
