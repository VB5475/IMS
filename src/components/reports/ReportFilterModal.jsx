// ReportFilterModal.jsx — one generic filter modal shared by every entry in
// REPORTS_LIST (see src/constants/reportsConfig.js). Division/Location/
// Dept + From/To Date, all optional (blank = no restriction on that field)
// except the date defaults below — plus a report-specific Employee field
// for "Asset Issue Employee Wise" (report.extraFields). Print calls the
// existing GENERATE_REPORT endpoint via useReportPrint — the same mechanism
// every other page's PrintReportButton already uses, not a new API.
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FileBarChart2, AlertCircle } from "lucide-react";
import Modal from "../ui/Modal";
import SearchSelect from "../ui/SearchSelect";
import AlertPanel from "../ui/AlertPanel";
import { useReportPrint } from "../../hooks/useReportPrint";
import { useReportFilterOptions } from "../../hooks/useReportFilterOptions";
import { useNotification } from "../../context/NotificationContext";
import { getUserSession } from "../../session/userSession";
import { buildCompanyReportParam } from "../../utils/reportParams";
import "./ReportFilterModal.css";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Native <input type="date"> gives back "YYYY-MM-DD" — convert to this app's
// standard report/list param format ("DD-MMM-YYYY", e.g. PurchaseOrderPage's
// `01-Jan-${year}`) rather than the ISO string.
function toReportDateParam(isoValue) {
  if (!isoValue) return "";
  const [y, m, d] = isoValue.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")}-${MONTH_ABBR[m - 1]}-${y}`;
}

// Local-time (not UTC) YYYY-MM-DD, matching what <input type="date"> expects
// as its own value — avoids the off-by-one-day bug toISOString()'s UTC
// conversion can cause near midnight.
function toIsoDateInputValue(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// From Date defaults to the logged-in financial year's own start date
// (session.year.yearfrom, set at login — see LoginPage.jsx's
// findFinancialYearForDate); To Date defaults to today. Both per explicit
// user spec 2026-08-17 (/pm), still freely editable afterward.
function buildDefaultFilters() {
  const yearFrom = getUserSession().year?.yearfrom;
  const fromDate = yearFrom ? new Date(yearFrom) : null;
  return {
    fromDate: fromDate && !Number.isNaN(fromDate.getTime()) ? toIsoDateInputValue(fromDate) : toIsoDateInputValue(new Date()),
    toDate: toIsoDateInputValue(new Date()),
    divisionId: "",
    locationId: "",
    deptId: "",
    employeeId: "",
  };
}

export default function ReportFilterModal({ report, onClose }) {
  const isOpen = !!report;
  const notify = useNotification();
  const { printReport, printing } = useReportPrint();
  const {
    divisionOptions, locationOptions, departmentOptions,
    optionsLoading, isLoadingLocations,
    fetchOptions, fetchLocations, clearLocations,
  } = useReportFilterOptions();

  const showEmployeeField = report?.extraFields?.includes("employee") ?? false;

  const [filters, setFilters] = useState(buildDefaultFilters);
  const [rangeError, setRangeError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setFilters(buildDefaultFilters());
    setRangeError(null);
    clearLocations();
    fetchOptions();
  }, [isOpen, report?.key, fetchOptions, clearLocations]);

  const handleChange = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "divisionId") next.locationId = "";
      return next;
    });
    setRangeError(null);
    if (key === "divisionId") {
      if (value) void fetchLocations(value);
      else clearLocations();
    }
  }, [fetchLocations, clearLocations]);

  const divisionLabel = useMemo(
    () => divisionOptions.find((o) => o.value === filters.divisionId)?.label ?? "",
    [divisionOptions, filters.divisionId]
  );
  const locationLabel = useMemo(
    () => locationOptions.find((o) => o.value === filters.locationId)?.label ?? "",
    [locationOptions, filters.locationId]
  );
  const deptLabel = useMemo(
    () => departmentOptions.find((o) => o.value === filters.deptId)?.label ?? "",
    [departmentOptions, filters.deptId]
  );

  const handlePrint = useCallback(async () => {
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      setRangeError("From Date must be on or before To Date.");
      return;
    }
    if (!report) return;
    const session = getUserSession();
    // Base set confirmed generic across this app's report/print SPs. Any
    // param proven only for one specific report's SP belongs on that
    // report's own `extraParams` in reportsConfig.js, not here — see
    // fixed-asset-register's entry for the pattern.
    const jsonParameters = [
      { paramtitle: "From Date", paramname: "@prmfromdate", paramval: toReportDateParam(filters.fromDate), paramtext: filters.fromDate ? toReportDateParam(filters.fromDate) : "" },
      { paramtitle: "To Date", paramname: "@prmtodate", paramval: toReportDateParam(filters.toDate), paramtext: filters.toDate ? toReportDateParam(filters.toDate) : "" },
      { paramtitle: "Division", paramname: "@prmdivisionid", paramval: filters.divisionId || "0", paramtext: divisionLabel },
      ...(report.extraParams ?? []),
      { paramtitle: "Login", paramname: "@prmloginid", paramval: String(session.loginId ?? "0"), paramtext: "" },
      { paramtitle: "Operation Type Id", paramname: "@prmoperationtypeid", paramval: "1", paramtext: "" },
      buildCompanyReportParam(),
    ];
    if (showEmployeeField) {
      jsonParameters.push({ paramtitle: "Employee", paramname: "@prmEmployeeID", paramval: filters.employeeId || "0", paramtext: "" });
    }
    try {
      await printReport({ reportTitle: report.reportTitle, reportFileName: report.reportFileName, jsonParameters });
      onClose?.();
    } catch (err) {
      notify.error(err?.message || "Failed to generate report.");
    }
  }, [filters, report, divisionLabel, locationLabel, deptLabel, showEmployeeField, printReport, notify, onClose]);

  const footer = (
    <div className="master-modal-footer-actions">
      <button type="button" className="master-modal-btn master-modal-btn--save" onClick={handlePrint} disabled={printing}>
        {printing ? "Generating…" : "Print"}
      </button>
      <button type="button" className="master-modal-btn master-modal-btn--cancel" onClick={onClose} disabled={printing}>
        Cancel
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={report?.label ?? ""}
      subtitle="Set filters, then Print to generate the report."
      icon={<FileBarChart2 size={16} strokeWidth={2} />}
      size="md"
      variant="enterprise"
      footer={footer}
    >
      {rangeError && (
        <AlertPanel errors={[rangeError]} onDismiss={() => setRangeError(null)} />
      )}
      <div className="rfm-form">
        <div className="rfm-form-row">
          <span className="rfm-form-label">From Date</span>
          <input
            type="date"
            className="rfm-form-input"
            value={filters.fromDate}
            onChange={(e) => handleChange("fromDate", e.target.value)}
          />
        </div>
        <div className="rfm-form-row">
          <span className="rfm-form-label">To Date</span>
          <input
            type="date"
            className="rfm-form-input"
            value={filters.toDate}
            onChange={(e) => handleChange("toDate", e.target.value)}
          />
        </div>
        <div className="rfm-form-row">
          <span className="rfm-form-label">Division</span>
          <SearchSelect
            value={filters.divisionId}
            onChange={(val) => handleChange("divisionId", val)}
            options={divisionOptions}
            placeholder={optionsLoading ? "Loading…" : "All divisions"}
            disabled={optionsLoading}
          />
        </div>
        <div className="rfm-form-row">
          <span className="rfm-form-label">Location</span>
          <SearchSelect
            value={filters.locationId}
            onChange={(val) => handleChange("locationId", val)}
            options={locationOptions}
            placeholder={!filters.divisionId ? "Select Division first" : isLoadingLocations ? "Loading…" : "All locations"}
            disabled={!filters.divisionId || isLoadingLocations}
          />
        </div>
        <div className="rfm-form-row">
          <span className="rfm-form-label">Dept</span>
          <SearchSelect
            value={filters.deptId}
            onChange={(val) => handleChange("deptId", val)}
            options={departmentOptions}
            placeholder={optionsLoading ? "Loading…" : "All departments"}
            disabled={optionsLoading}
          />
        </div>
        {showEmployeeField && (
          <div className="rfm-form-row">
            <span className="rfm-form-label">Employee</span>
            <SearchSelect
              value={filters.employeeId}
              onChange={(val) => handleChange("employeeId", val)}
              options={[]}
              placeholder="Employee list — coming soon"
              disabled
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
