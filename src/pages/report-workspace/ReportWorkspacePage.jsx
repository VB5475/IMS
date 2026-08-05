import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EnterpriseDataGrid from "../../components/grid/EnterpriseDataGrid";
import Loader from "../../components/ui/Loader";
import RefreshButton from "../../components/ui/RefreshButton";
import { useGridSearch } from "../../hooks/useGridSearch";
import { gridMeta } from "../../data/dummyData";
import { toEnterpriseDataGridColumns } from "../../utils/gridUtils";
import { AlertCircle, Search } from "lucide-react";
import { usePageHeader } from "../../context/PageHeaderContext";
import { API_BASE_URL_OLD } from "../../api/constants";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "../../constants/tableConfig";
import "./ReportWorkspacePage.css";

export default function ReportWorkspacePage() {
  const [hasFilters, setHasFilters] = useState(null);
  const [lastSearchArgs, setLastSearchArgs] = useState(null);
  const { reportBoardId } = useParams();
  const masterID = Number(reportBoardId);

  const {
    columns,
    rows,
    isSearching,
    searchError,
    hasSearched,
    masterDetail,
    fetchMasterDetail,
    handleSearch,
  } = useGridSearch(API_BASE_URL_OLD);

  const reportTitle = masterDetail?.ReportDashBoardName || "Report";

  const dataGridColumns = useMemo(
    () => toEnterpriseDataGridColumns(columns),
    [columns]
  );

  usePageHeader({
    title: reportTitle,
    subtitle: "Configure filters and search to load data.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    if (masterID) fetchMasterDetail(masterID);
  }, [fetchMasterDetail, masterID]);

  const onSearch = (filterValues, filterDefs) => {
    setLastSearchArgs({ filterValues, filterDefs });
    handleSearch(filterValues, filterDefs, masterID);
  };

  const onRefresh = () => {
    if (!lastSearchArgs) return;
    handleSearch(lastSearchArgs.filterValues, lastSearchArgs.filterDefs, masterID);
  };

  return (
    <div className="workspace-page workspace-page--fill rw-page">
      <section className="workspace-page__filters">
        <EnterpriseFilterPanel
          masterID={masterID}
          apiBaseUrl={API_BASE_URL_OLD}
          onSearch={onSearch}
          isSearching={isSearching}
          title={masterDetail?.ReportDashBoardName || gridMeta.title}
          onFiltersLoaded={setHasFilters}
        />
      </section>

      <section className="workspace-page__grid">
        {searchError && !hasSearched && (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{searchError}</span>
          </div>
        )}

        {isSearching && !hasSearched && <Loader text="Loading data…" />}

        {hasSearched && dataGridColumns.length > 0 ? (
          <EnterpriseDataGrid
            title={reportTitle || gridMeta.title}
            columns={dataGridColumns}
            data={rows}
            loading={isSearching}
            error={searchError}
            loaderText="Loading data…"
            defaultPageSize={DEFAULT_PAGE_SIZE}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            emptyMessage="No records match the current filters."
            searchable
            fill
            bottomPanelExtras={
              <RefreshButton onClick={onRefresh} loading={isSearching} title="Re-run the last search" />
            }
          />
        ) : (
          !isSearching &&
          !searchError && (
            <div className="workspace-empty">
              <Search size={40} strokeWidth={1.5} />
              <p>
                {hasFilters === false ? (
                  <>
                    Click <strong>Search</strong> to load data.
                  </>
                ) : (
                  <>
                    Set your filters and click <strong>Search</strong> to load data.
                  </>
                )}
              </p>
            </div>
          )
        )}
      </section>
    </div>
  );
}
