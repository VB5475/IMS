// ListPanelHeader.jsx — the title + toolbar strip above every list page's grid.
//
// Every list page used to hand-roll this block (title, Add, Refresh, Print,
// rows-per-page) against its own class prefix. Pages now pass what differs and
// nothing else:
//
//   <ListPanelHeader
//     icon={ClipboardList}
//     title="Purchase Indents"
//     addLabel={ENTRY_FORM_LABEL}
//     onAdd={handleAddNew}
//     onRefresh={fetchIndents}
//     refreshing={loading}
//     print={{ reportTitle, reportFileName, buildParams }}
//     onExportCsv={handleExportCsv}
//     pageSize={pageSize}
//     onPageSizeChange={setPageSize}
//   />
//
// Each control is optional and appears only when its handler is supplied, which
// covers the pages that legitimately differ: Company and Division Master have
// no Add, and the two Maintenance Contract pages have no Print.
//
// Add is additionally gated on the login's insert right for the current module,
// so pages no longer repeat that check — see session/moduleRights.js.

import React, { useId } from "react";
import { Plus } from "lucide-react";
import PrintReportButton from "../ui/PrintReportButton";
import RefreshButton from "../ui/RefreshButton";
import ExportCsvButton from "../ui/ExportCsvButton";
import { useModuleRights } from "../../hooks/useModuleRights";
import { PAGE_SIZE_OPTIONS } from "../../constants/tableConfig";
import "./ListPanelHeader.css";

export default function ListPanelHeader({
  icon: Icon,
  title,
  addLabel = "Add New",
  onAdd,
  onRefresh,
  refreshing = false,
  print,
  // Plain callback, same shape as onAdd/onRefresh — the page owns gathering
  // the rows (via its EnterpriseDataGrid ref's getExportData()) and building
  // the CSV; this component only renders the button. See
  // project_csv_export_master_lists.md for why.
  onExportCsv,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  children,
}) {
  const { canInsert } = useModuleRights();
  const pageSizeId = useId();
  const showPageSize = onPageSizeChange != null;

  return (
    <header className="list-panel__header">
      <div className="list-panel__title">
        {Icon && <Icon size={14} strokeWidth={2} />}
        <span>{title}</span>
      </div>
      <div className="list-panel__toolbar">
        {onAdd && canInsert && (
          <button type="button" className="list-panel__add-btn" onClick={onAdd}>
            <Plus size={14} strokeWidth={2.5} />
            {addLabel}
          </button>
        )}
        {onRefresh && <RefreshButton onClick={onRefresh} loading={refreshing} />}
        {print && (
          <PrintReportButton
            reportTitle={print.reportTitle}
            reportFileName={print.reportFileName}
            buildParams={print.buildParams}
          />
        )}
        {onExportCsv && <ExportCsvButton onClick={onExportCsv} />}
        {children}
        {showPageSize && (
          <>
            <label htmlFor={pageSizeId} className="list-panel__pagesize-label">
              Rows per page
            </label>
            <select
              id={pageSizeId}
              className="ng-select list-panel__pagesize-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </header>
  );
}
