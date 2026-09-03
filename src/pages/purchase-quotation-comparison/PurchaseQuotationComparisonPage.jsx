// PurchaseQuotationComparisonPage.jsx — single-page module (no list/add/edit),
// same shape as DivisionWiseRightsPage: a cascading header selector auto-fills
// a grid below. Division → Inquiry No. → comparison grid; one Save button.

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { FileSpreadsheet, Save, AlertCircle } from "lucide-react";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import { focusFieldAfterCascade } from "../../utils/focusUtils";
import ComparisonGrid from "../../components/purchase-quotation-comparison/ComparisonGrid";
import ActionBar from "../../components/ui/ActionBar";
import AlertPanel from "../../components/ui/AlertPanel";
import Loader from "../../components/ui/Loader";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useNotification } from "../../context/NotificationContext";
import { usePurchaseQuotationComparison } from "../../hooks/usePurchaseQuotationComparison";
import { pivotQuotationRows, computeComparisonBadges, computeBestRateBadges } from "../../utils/comparisonBuilder";
import { exportRowsToExcel } from "../../utils/excelExport";
import { formatTranDate } from "../../utils/dateFormat";
import { PAGE_TITLE, PQC_HEADER_FILTERS, PQC_FILTER_CASCADE_RESETS, PQC_DISPLAY_FIELDS } from "./constants";
import "./PurchaseQuotationComparisonPage.css";

export default function PurchaseQuotationComparisonPage() {
  const notify = useNotification();
  const [formErrors, setFormErrors] = useState([]);
  const [divisionId, setDivisionId] = useState("");
  const [inquiryId, setInquiryId] = useState("");
  const [selections, setSelections] = useState({});
  const filterPanelRef = useRef(null);

  const {
    divisionOptions,
    fetchDivisionOptions,
    inquiryOptions,
    isLoadingInquiries,
    inquiryOptionsError,
    fetchInquiryOptions,
    clearInquiries,
    inquiryDetails,
    isLoadingDetails,
    detailsError,
    fetchInquiryDetails,
    comparisonRows,
    isLoadingGrid,
    gridError,
    fetchComparisonRows,
    saveComparison,
    isSaving,
  } = usePurchaseQuotationComparison();

  usePageHeader({
    title: PAGE_TITLE,
    subtitle: "Compare supplier quotations against a purchase inquiry and select which quote to accept per item.",
  });

  useEffect(() => {
    fetchDivisionOptions();
  }, [fetchDivisionOptions]);

  // Single dispatcher for EnterpriseFilterPanel's onFilterChange(colName, val)
  // contract — same shape every transaction form's header handler uses.
  const handleFilterChange = useCallback(
    async (colName, val) => {
      if (colName === "divisionid") {
        setDivisionId(val);
        setInquiryId("");
        setSelections({});
        clearInquiries();
        if (val && val !== "0") {
          await fetchInquiryOptions(val);
          focusFieldAfterCascade(filterPanelRef, "inqid");
        }
      } else if (colName === "inqid") {
        setInquiryId(val);
        setSelections({});
        if (val && divisionId) {
          await Promise.all([
            fetchInquiryDetails(divisionId, val),
            fetchComparisonRows(divisionId, val),
          ]);
        }
      }
    },
    [divisionId, fetchInquiryOptions, clearInquiries, fetchInquiryDetails, fetchComparisonRows]
  );

  const pivoted = useMemo(() => pivotQuotationRows(comparisonRows), [comparisonRows]);
  const badges = useMemo(() => computeComparisonBadges(pivoted), [pivoted]);
  const bestRate = useMemo(() => computeBestRateBadges(pivoted), [pivoted]);

  // Selection progress + running cost — surfaced before Save so the user isn't
  // committing blind. Deliberately not routed through EnterpriseSummaryPanel:
  // that component sums a flat detail-grid rows array for the master save
  // payload, a different contract than reading this screen's pivoted map.
  const selectionSummary = useMemo(() => {
    let totalCost = 0;
    let selectedCount = 0;
    pivoted.items.forEach((item) => {
      const supplierId = selections[item.itemid];
      if (!supplierId) return;
      const cell = pivoted.cells.get(`${item.itemid}::${supplierId}`);
      if (!cell) return;
      selectedCount += 1;
      totalCost += cell.rate;
    });
    return { selectedCount, totalCount: pivoted.items.length, totalCost };
  }, [pivoted, selections]);

  // Seed selections from the API's own isselected flag whenever fresh
  // comparison data loads, so a previously-saved comparison reopens with its
  // chosen supplier per item already checked instead of starting blank.
  useEffect(() => {
    const initial = {};
    pivoted.cells.forEach((cell, key) => {
      if (!cell.isselected) return;
      const [itemId, supplierId] = key.split("::");
      initial[itemId] = supplierId;
    });
    setSelections(initial);
  }, [pivoted]);

  const handleSelect = useCallback((itemId, supplierId) => {
    setSelections((prev) => ({ ...prev, [itemId]: supplierId }));
  }, []);

  const handleExport = useCallback(async () => {
    const rows = [];
    pivoted.items.forEach((item) => {
      pivoted.suppliers.forEach((s) => {
        const cell = pivoted.cells.get(`${item.itemid}::${s.supplierid}`);
        if (!cell) return;
        rows.push({
          item: item.itemname,
          itemcode: item.itemcode,
          supplier: s.suppliername,
          rate: cell.rate,
          qty: cell.qty,
          deliverydate: cell.deliverydate ? formatTranDate(cell.deliverydate) : "",
          qtnno: cell.qtnno ?? "",
          selected: selections[item.itemid] === s.supplierid ? "Yes" : "No",
        });
      });
    });

    if (rows.length === 0) {
      notify.warning("Nothing to export yet — select an inquiry with quotations first.");
      return;
    }

    await exportRowsToExcel(
      rows,
      [
        { key: "item", label: "Item" },
        { key: "itemcode", label: "Item Code" },
        { key: "supplier", label: "Supplier" },
        { key: "rate", label: "Rate" },
        { key: "qty", label: "Qty" },
        { key: "deliverydate", label: "Delivery Date" },
        { key: "qtnno", label: "Quotation No." },
        { key: "selected", label: "Selected" },
      ],
      `QuotationComparison_${inquiryOptions.find((o) => o.value === String(inquiryId))?.label ?? inquiryId}`
    );
    notify.success("Comparison exported.");
  }, [pivoted, selections, inquiryOptions, inquiryId, notify]);

  const handleSave = useCallback(async () => {
    if (pivoted.items.length === 0) {
      setFormErrors(["Select an inquiry with quotations before saving."]);
      return;
    }
    const hasAnySelection = Object.keys(selections).length > 0;
    if (!hasAnySelection) {
      setFormErrors(["Select a supplier for at least one item before saving."]);
      return;
    }
    setFormErrors([]);

    // Full item×supplier matrix — every quoted combination, selected or not,
    // each carrying its own selection status. Per client: "pass all the rows
    // and columns with selection or unselected also, managed by selection status."
    const rows = [];
    pivoted.items.forEach((item) => {
      pivoted.suppliers.forEach((s) => {
        const cell = pivoted.cells.get(`${item.itemid}::${s.supplierid}`);
        if (!cell) return;
        rows.push({
          // qtndetid is this row's own real save-identifier (confirmed live on
          // fn_tbl_fetchquotationdet4comparision) — echoed back so the backend
          // can match the selection status to the exact quotation-detail row.
          qtndetid: Number(cell.qtndetid) || 0,
          inqid: Number(inquiryId) || 0,
          itemid: Number(item.itemid) || 0,
          supplierid: Number(s.supplierid) || 0,
          rate: cell.rate,
          qty: cell.qty,
          deliverydate: cell.deliverydate,
          qtnno: cell.qtnno,
          qtndate: cell.qtndate,
          isselected: selections[item.itemid] === s.supplierid ? 1 : 0,
        });
      });
    });

    try {
      const { message } = await saveComparison(divisionId, rows);
      notify.success(message || "Supplier selections saved.");
    } catch (err) {
      notify.error(err?.message || "Couldn't save. Try again.");
    }
  }, [pivoted, selections, inquiryId, divisionId, saveComparison, notify]);

  const syncedFilters = useMemo(
    () =>
      PQC_HEADER_FILTERS.map((f) => {
        if (f.FilterColName === "divisionid") return { ...f, staticOptions: divisionOptions };
        if (f.FilterColName === "inqid") return { ...f, staticOptions: inquiryOptions };
        return f;
      }),
    [divisionOptions, inquiryOptions]
  );

  const filterFieldTones = useMemo(
    () => ({ inqid: !divisionId ? "view" : "editable" }),
    [divisionId]
  );

  const displayValues = inquiryDetails ?? {};

  return (
    <div className="workspace-page workspace-page--fill pqc-page">
      <AlertPanel errors={formErrors} onDismiss={() => setFormErrors([])} />

      <EnterpriseFilterPanel
        panelRef={filterPanelRef}
        title="Purchase Quotation Comparison"
        staticFilters={syncedFilters}
        cascadeResets={PQC_FILTER_CASCADE_RESETS}
        onFilterChange={handleFilterChange}
        fieldTones={filterFieldTones}
        isSearching={isLoadingInquiries}
      />
      {inquiryOptionsError && (
        <div className="pqc-header__field-error pqc-header__field-error--standalone">
          <AlertCircle size={12} strokeWidth={2} />
          {inquiryOptionsError}
        </div>
      )}

      {/* Read-only inquiry summary — derived, non-interactive, so it stays
          visually separate from the EnterpriseFilterPanel's editable field
          grid rather than being folded in as if it were another input. */}
      {inquiryId && (
        <section className="pqc-inquiry-details">
          {isLoadingDetails ? (
            <Loader text="Loading inquiry details…" />
          ) : detailsError ? (
            <span className="pqc-header__field-error">
              <AlertCircle size={12} strokeWidth={2} />
              {detailsError}
            </span>
          ) : (
            PQC_DISPLAY_FIELDS.map((f) => (
              <div key={f.key} className="pqc-header__display-item">
                <span className="pqc-header__display-label">{f.label}</span>
                <span className="pqc-header__display-value">
                  {f.isDate
                    ? (displayValues[f.key] ? formatTranDate(displayValues[f.key]) : "—")
                    : (displayValues[f.key] ?? "—")}
                </span>
              </div>
            ))
          )}
        </section>
      )}

      <section className="pqc-body">
        {!inquiryId ? (
          <div className="pqc-guidance">
            {!divisionId
              ? "Select a division to begin. Choosing a division will list its purchase inquiries below."
              : "Select an inquiry to load its quotation comparison."}
          </div>
        ) : isLoadingGrid ? (
          <Loader text="Loading quotation comparison…" />
        ) : gridError ? (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{gridError}</span>
          </div>
        ) : (
          <ComparisonGrid
            items={pivoted.items}
            suppliers={pivoted.suppliers}
            cells={pivoted.cells}
            badges={badges}
            bestRate={bestRate}
            selections={selections}
            onSelect={handleSelect}
          />
        )}
      </section>

      {inquiryId && pivoted.items.length > 0 && (
        <section className="pqc-selection-summary">
          <div className="pqc-header__display-item">
            <span className="pqc-header__display-label">Items Selected</span>
            <span className="pqc-header__display-value">
              {selectionSummary.selectedCount} of {selectionSummary.totalCount}
            </span>
          </div>
          <div className="pqc-header__display-item">
            <span className="pqc-header__display-label">Total Cost (Selected)</span>
            <span className="pqc-header__display-value">
              ₹{selectionSummary.totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </section>
      )}

      <ActionBar
        showAddCancel={false}
        alignEnd
        extraButtons={[
          {
            key: "export",
            label: "Export to Excel",
            Icon: FileSpreadsheet,
            variant: "secondary",
            onClick: handleExport,
            disabled: !inquiryId || isLoadingGrid,
            showAlways: true,
          },
          {
            key: "save",
            label: isSaving ? "Saving…" : "Save Selections",
            Icon: Save,
            variant: "save",
            onClick: handleSave,
            disabled: !inquiryId || isSaving,
            loading: isSaving,
            showAlways: true,
          },
        ]}
      />
    </div>
  );
}
