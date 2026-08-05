import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Wrench } from "lucide-react";
import CallAllocationForm from "../call-allocation/CallAllocationForm";
import CallFollowUpForm from "../call-follow-up/CallFollowUpForm";
import CallReportingForm from "../call-reporting/CallReportingForm";
import DashboardFilterPanelV2 from "../../components/filters/DashboardFilterPanelV2";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import RefreshButton from "../../components/ui/RefreshButton";
import { useApi } from "../../api/useApi";
import { API_BASE_URL, ENDPOINTS } from "../../api/constants";
import { getUserSession } from "../../session/userSession";
import { useNotification } from "../../context/NotificationContext";
import { usePageHeader } from "../../context/PageHeaderContext";
import { controlTypeMap } from "../../data/dummyData";
import {
  buildGridColumns,
  toEnterpriseDataGridColumns,
} from "../../utils/gridUtils";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import {
  MAINTENANCE_DASHBOARD_ACTIONS,
  MAINTENANCE_DASHBOARD_CONFIG,
  MAINTENANCE_DASHBOARD_FILTER_RESETS,
} from "./constants";
import "./MaintenanceDashboard.css";

function addOneMonthIso() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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

function mapLocationOptions(rows) {
  return uniqueOptions(rows.map((row) => ({
    value: String(row.locationid ?? row.LocationID ?? 0),
    label: String(row.locationname ?? row.location ?? row.LocationName ?? ""),
  })));
}

function mapDepartmentOptions(rows) {
  return uniqueOptions(rows.map((row) => ({
    value: String(row.deptid ?? row.DeptID ?? row.departmentid ?? 0),
    label: String(row.deptname ?? row.department ?? row.DeptName ?? ""),
  })));
}

function mapAssetTypeOptions(rows) {
  return uniqueOptions(rows.map((row) => ({
    value: String(row.maingroupid ?? row.MainGroupID ?? row.groupcode ?? 0),
    label: String(row.maingroupname ?? row.MainGroupName ?? row.groupname ?? ""),
  })));
}

function buildFetchParams(objName, jsonRow, objType = MAINTENANCE_DASHBOARD_CONFIG.OBJ_TYPE) {
  return {
    ObjType: objType,
    ObjName: objName,
    JSon: JSON.stringify([jsonRow]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

export default function MaintenanceDashboard() {
  const { get } = useApi(API_BASE_URL);
  const notify = useNotification();
  const session = useMemo(() => getUserSession(), []);
  const initialValues = useMemo(() => ({
    asondate: addOneMonthIso(),
    divisionid: "",
    locationid: "",
    deptid: "",
    typeofcalls: "",
    assetstype: "",
  }), []);

  const [filterValues, setFilterValues] = useState(initialValues);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [callTypeOptions, setCallTypeOptions] = useState([]);
  const [assetTypeOptions, setAssetTypeOptions] = useState([]);
  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [activeAction, setActiveAction] = useState("");
  const [callAllocationOpen, setCallAllocationOpen] = useState(false);
  const [callAllocationRow, setCallAllocationRow] = useState(null);
  const [callFollowUpOpen, setCallFollowUpOpen] = useState(false);
  const [callFollowUpRow, setCallFollowUpRow] = useState(null);
  const [callReportingOpen, setCallReportingOpen] = useState(false);
  const [callReportingRow, setCallReportingRow] = useState(null);

  usePageHeader({
    title: "Maintenance Dashboard",
    subtitle: "Track and review maintenance calls against asset items.",
    showBack: true,
    backTo: "/",
  });

  const fetchFunction = useCallback(async (objName, jsonRow, sourceName, objType) => {
    const result = await get(
      ENDPOINTS.FN_FETCH_DATA,
      buildFetchParams(objName, jsonRow, objType)
    );
    return ensureRows(result, sourceName);
  }, [get]);

  const loadColumns = useCallback(async () => {
    setLoadingColumns(true);
    try {
      const rbRows = await fetchFunction(
        MAINTENANCE_DASHBOARD_CONFIG.SP_RB_META,
        { prmRBCode: MAINTENANCE_DASHBOARD_CONFIG.RB_CODE },
        "dashboard metadata"
      );
      const rbId = rbRows[0]?.rbid ?? rbRows[0]?.RBID;
      if (!rbId) throw new Error("Maintenance dashboard RB metadata was not returned.");

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
      console.error("[MaintenanceDashboard] metadata fetch failed:", err);
      setColumns([]);
      setError(err?.message || "Failed to load dashboard column configuration.");
    } finally {
      setLoadingColumns(false);
    }
  }, [fetchFunction, get, session.loginId]);

  const loadDivisions = useCallback(async () => {
    const rows = await fetchFunction(
      MAINTENANCE_DASHBOARD_CONFIG.SP_DIVISION,
      {
        prmuserid: Number(session.loginId) || 1,
        prmcompanyid: Number(session.companyId) || 1,
        prmyearid: Number(session.yearId) || 1,
      },
      "divisions"
    );
    setDivisionOptions(mapDivisionOptions(rows));
  }, [fetchFunction, session]);

  const loadLocations = useCallback(async (divisionId = 0) => {
    if (!divisionId) {
      setLocationOptions([]);
      return;
    }
    const rows = await fetchFunction(
      MAINTENANCE_DASHBOARD_CONFIG.SP_LOCATION,
      {
        prmcompanyid: Number(session.companyId) || 1,
        prmdivisionid: Number(divisionId) || 0,
        prmloginid: Number(session.loginId) || 1,
        prmlocationtype: "",
        prmfrmtype: String(MAINTENANCE_DASHBOARD_CONFIG.FRM_TYPE),
      },
      "locations"
    );
    setLocationOptions(mapLocationOptions(rows));
  }, [fetchFunction, session]);

  const loadDepartments = useCallback(async () => {
    const rows = await fetchFunction(
      MAINTENANCE_DASHBOARD_CONFIG.SP_DEPARTMENT,
      {
        prmcompanyid: Number(session.companyId) || 1,
        prmloginid: Number(session.loginId) || 1,
      },
      "departments"
    );
    setDepartmentOptions(mapDepartmentOptions(rows));
  }, [fetchFunction, session]);

  const loadCallTypes = useCallback(async () => {
    try {
      const rows = await fetchFunction(
        MAINTENANCE_DASHBOARD_CONFIG.SP_CALL_TYPE,
        {},
        "call types",
        MAINTENANCE_DASHBOARD_CONFIG.CALL_TYPE_OBJ_TYPE
      );
      setCallTypeOptions(rows);
    } catch (err) {
      console.warn("[MaintenanceDashboard] call type fetch failed:", err);
      setCallTypeOptions([]);
    }
  }, [fetchFunction]);

  const loadAssetTypes = useCallback(async (values) => {
    const selectedCallType = callTypeOptions.find(
      (row) => String(row.idnumber) === String(values.typeofcalls)
    );
    const callTypeId = Number(selectedCallType?.idnumber) || 0;
    if (!values.divisionid || !values.deptid || !callTypeId) {
      setAssetTypeOptions([]);
      return;
    }

    try {
      const rows = await fetchFunction(
        MAINTENANCE_DASHBOARD_CONFIG.SP_ASSET_TYPE,
        {
          prmdivisionid: Number(values.divisionid) || 0,
          prmloginid: Number(session.loginId) || 1,
          prmdeptid: Number(values.deptid) || 0,
          prmcalltypeid: callTypeId,
        },
        "asset types"
      );
      setAssetTypeOptions(mapAssetTypeOptions(rows));
    } catch (err) {
      console.warn("[MaintenanceDashboard] asset type fetch failed:", err);
      setAssetTypeOptions([]);
    }
  }, [callTypeOptions, fetchFunction, session.loginId]);

  useEffect(() => {
    loadColumns();
    loadDivisions().catch((err) => {
      console.error("[MaintenanceDashboard] division fetch failed:", err);
      setError(err?.message || "Failed to load division options.");
    });
    loadCallTypes();
  }, [loadCallTypes, loadColumns, loadDivisions]);

  const filters = useMemo(() => [
    {
      FilterParameterID: "asondate",
      FilterColName: "asondate",
      FilterCaption: "As on Date",
      FilterColCtrlType: controlTypeMap.DATE,
      columnMeta: { displayName: "As on Date", dataKind: "date", isMandatory: true },
    },
    {
      FilterParameterID: "typeofcalls",
      FilterColName: "typeofcalls",
      FilterCaption: "Type of Calls",
      FilterColCtrlType: controlTypeMap.DROPDOWN,
      staticOptions: callTypeOptions.map((row) => ({
        value: String(row.idnumber),
        label: String(row.calltype ?? ""),
      })),
      columnMeta: { displayName: "Type of Calls", dataKind: "numeric", isMandatory: true },
    },
    {
      FilterParameterID: "assetstype",
      FilterColName: "assetstype",
      FilterCaption: "Asset Type",
      FilterColCtrlType: controlTypeMap.DROPDOWN,
      staticOptions: assetTypeOptions,
      columnMeta: { displayName: "Asset Type", dataKind: "numeric", isMandatory: false },
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
      FilterParameterID: "locationid",
      FilterColName: "locationid",
      FilterCaption: "Location",
      FilterColCtrlType: controlTypeMap.DROPDOWN,
      staticOptions: locationOptions,
      columnMeta: { displayName: "Location", dataKind: "numeric", isMandatory: true },
    },
    {
      FilterParameterID: "deptid",
      FilterColName: "deptid",
      FilterCaption: "Department",
      FilterColCtrlType: controlTypeMap.DROPDOWN,
      staticOptions: departmentOptions,
      columnMeta: { displayName: "Department", dataKind: "numeric", isMandatory: true },
    },
  ], [
    assetTypeOptions,
    callTypeOptions,
    departmentOptions,
    divisionOptions,
    locationOptions,
  ]);

  const handleFilterChange = useCallback((colName, value) => {
    setData([]);
    setError(null);
    setSelectedRowKeys([]);
    setActiveAction("");
    const next = { ...filterValues, [colName]: value };
    (MAINTENANCE_DASHBOARD_FILTER_RESETS[colName] || []).forEach((field) => {
      next[field] = "";
    });
    setFilterValues(next);

    if (colName === "divisionid") {
      setLocationOptions([]);
      setDepartmentOptions([]);
      setAssetTypeOptions([]);
      if (value) {
        loadLocations(value).catch((err) => {
          console.error("[MaintenanceDashboard] location fetch failed:", err);
          notify.error(err?.message || "Failed to load locations.");
        });
      }
    } else if (colName === "locationid") {
      setDepartmentOptions([]);
      setAssetTypeOptions([]);
      if (value) {
        loadDepartments().catch((err) => {
          console.error("[MaintenanceDashboard] department fetch failed:", err);
          notify.error(err?.message || "Failed to load departments.");
        });
      }
    } else if (colName === "deptid" || colName === "typeofcalls") {
      setAssetTypeOptions([]);
      loadAssetTypes(next);
    }
  }, [filterValues, loadAssetTypes, loadDepartments, loadLocations, notify]);

  const handleSearch = useCallback(async (values) => {
    const missing = [
      ["asondate", "As on Date"],
      ["divisionid", "Division"],
      ["locationid", "Location"],
      ["deptid", "Department"],
    ]
      .filter(([key]) => !values[key])
      .map(([, label]) => label);

    if (callTypeOptions.length > 0 && !values.typeofcalls) {
      missing.push("Type of Calls");
    }
    if (missing.length > 0) {
      notify.error(`Select ${missing.join(", ")} before searching.`);
      return;
    }

    const selectedCallType = callTypeOptions.find(
      (row) => String(row.idnumber) === String(values.typeofcalls)
    );

    try {
      setSearching(true);
      setError(null);
      setSelectedRowKeys([]);
      setActiveAction("");
      const rows = await fetchFunction(
        MAINTENANCE_DASHBOARD_CONFIG.SP_DATA,
        {
          prmcompanyid: Number(session.companyId) || 1,
          prmyearid: Number(session.yearId) || 1,
          prmloginid: Number(session.loginId) || 1,
          prmsessionid: MAINTENANCE_DASHBOARD_CONFIG.DEFAULT_SESSION_ID,
          prmasondate: values.asondate,
          prmdivisionid: Number(values.divisionid) || 0,
          prmlocationid: Number(values.locationid) || 0,
          prmdeptid: Number(values.deptid) || 0,
          prmcalltype: selectedCallType?.code ?? "",
          prmmaingroupid: Number(values.assetstype) || 0,
          prmmasterid: MAINTENANCE_DASHBOARD_CONFIG.DEFAULT_MASTER_ID,
          prmrbrowid: 0,
        },
        "maintenance dashboard data"
      );
      setData(rows);
    } catch (err) {
      console.error("[MaintenanceDashboard] search failed:", err);
      setData([]);
      setError(err?.message || "Failed to load maintenance dashboard data.");
    } finally {
      setSearching(false);
    }
  }, [callTypeOptions, fetchFunction, notify, session]);

  const handleSelectionChange = useCallback((keys) => {
    setSelectedRowKeys(keys);
    if (keys.length === 0) setActiveAction("");
  }, []);

  const handleActionClick = useCallback((actionId) => {
    if (
      actionId === "call-allocation"
      || actionId === "vendor-follow-up"
      || actionId === "call-reporting"
    ) {
      const actionLabel =
        actionId === "call-allocation"
          ? "Call Allocation"
          : actionId === "vendor-follow-up"
            ? "Vendor Follow Up"
            : "Call Reporting";
      if (selectedRowKeys.length !== 1) {
        notify.error(`Select exactly one maintenance call for ${actionLabel}.`);
        return;
      }
      const selectedKey = selectedRowKeys[0];
      const dashboardRow = data.find((row, index) => {
        const rowKey = String(row.idnumber ?? row.compuniquekey ?? `maintenance-${index}`);
        return rowKey === String(selectedKey);
      });
      if (!dashboardRow) {
        notify.error("Selected record could not be found. Refresh the grid and try again.");
        return;
      }
      if (actionId === "call-allocation") {
        setCallAllocationRow(dashboardRow);
        setCallAllocationOpen(true);
      } else if (actionId === "vendor-follow-up") {
        setCallFollowUpRow(dashboardRow);
        setCallFollowUpOpen(true);
      } else {
        setCallReportingRow(dashboardRow);
        setCallReportingOpen(true);
      }
      return;
    }
    setActiveAction(actionId);
  }, [data, notify, selectedRowKeys]);

  const handleCallAllocationClose = useCallback(() => {
    setCallAllocationOpen(false);
    setCallAllocationRow(null);
  }, []);

  const handleCallAllocationSaved = useCallback(() => {
    handleCallAllocationClose();
    handleSearch(filterValues);
  }, [filterValues, handleCallAllocationClose, handleSearch]);

  const handleCallFollowUpClose = useCallback(() => {
    setCallFollowUpOpen(false);
    setCallFollowUpRow(null);
  }, []);

  const handleCallFollowUpSaved = useCallback(() => {
    handleCallFollowUpClose();
    handleSearch(filterValues);
  }, [filterValues, handleCallFollowUpClose, handleSearch]);

  const handleCallReportingClose = useCallback(() => {
    setCallReportingOpen(false);
    setCallReportingRow(null);
  }, []);

  const handleCallReportingSaved = useCallback(() => {
    handleCallReportingClose();
    handleSearch(filterValues);
  }, [filterValues, handleCallReportingClose, handleSearch]);

  return (
    <div className="workspace-page workspace-page--fill maintenance-dashboard">
      <section className="workspace-page__filters">
        <DashboardFilterPanelV2
          title="Maintenance Dashboard"
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

      <section className="maintenance-dashboard__actions" aria-label="Maintenance actions">
        {MAINTENANCE_DASHBOARD_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`maintenance-dashboard__action-btn${activeAction === action.id ? " maintenance-dashboard__action-btn--active" : ""
              }`}
            disabled={selectedRowKeys.length === 0}
            aria-pressed={activeAction === action.id}
            onClick={() => handleActionClick(action.id)}
          >
            {action.label}
          </button>
        ))}
        <span className="maintenance-dashboard__selection-count">
          {selectedRowKeys.length > 0
            ? `${selectedRowKeys.length} record${selectedRowKeys.length === 1 ? "" : "s"} selected`
            : "Select a grid record to enable actions"}
        </span>
      </section>

      <section className="workspace-page__grid maintenance-dashboard__grid">
        <EnterpriseDataGrid
          title="Maintenance Calls"
          icon={<Wrench size={15} strokeWidth={2} />}
          columns={columns}
          data={data}
          loading={loadingColumns || searching}
          error={error}
          loaderText={
            loadingColumns
              ? "Loading dashboard column configuration…"
              : "Loading maintenance calls…"
          }
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          emptyMessage={
            columns.length === 0 && !loadingColumns
              ? "Maintenance dashboard columns could not be loaded."
              : "Select filters and click Search to load maintenance calls."
          }
          searchable
          fill
          variant="dashboard-v2"
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
          getRowKey={(row, index) =>
            String(row.idnumber ?? row.compuniquekey ?? `maintenance-${index}`)
          }
          bottomPanelExtras={
            <RefreshButton
              onClick={() => handleSearch(filterValues)}
              loading={searching}
              title="Re-run the last search"
            />
          }
        />
      </section>

      <CallAllocationForm
        isOpen={callAllocationOpen}
        dashboardRow={callAllocationRow}
        filterContext={filterValues}
        onClose={handleCallAllocationClose}
        onSaved={handleCallAllocationSaved}
      />

      <CallFollowUpForm
        isOpen={callFollowUpOpen}
        dashboardRow={callFollowUpRow}
        filterContext={filterValues}
        onClose={handleCallFollowUpClose}
        onSaved={handleCallFollowUpSaved}
      />

      <CallReportingForm
        isOpen={callReportingOpen}
        dashboardRow={callReportingRow}
        filterContext={filterValues}
        onClose={handleCallReportingClose}
        onSaved={handleCallReportingSaved}
      />
    </div>
  );
}
