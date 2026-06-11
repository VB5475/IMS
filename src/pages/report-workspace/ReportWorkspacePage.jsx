import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import EnterpriseFilterPanel from "../../components/filters/EnterpriseFilterPanel";
import EnterpriseGrid from "../../components/grid/EnterpriseGrid";
import Loader from "../../components/ui/Loader";
import { useGridSearch } from "../../hooks/useGridSearch";
import { gridMeta } from "../../data/dummyData";
import { AlertCircle, Search } from "lucide-react";
import { usePageHeader } from "../../context/PageHeaderContext";
import { API_BASE_URL_OLD } from "../../api/constants";
import "./ReportWorkspacePage.css";

export default function ReportWorkspacePage() {
  const [hasFilters, setHasFilters] = useState(null);
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
    saveSelectedRows,
  } = useGridSearch(API_BASE_URL_OLD);

  const reportTitle = masterDetail?.ReportDashBoardName || "Report";

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
    handleSearch(filterValues, filterDefs, masterID);
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
        {searchError && (
          <div className="workspace-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{searchError}</span>
          </div>
        )}

        {isSearching && <Loader text="Loading Data..." />}

        {hasSearched && columns.length > 0 ? (
          <EnterpriseGrid
            config={{
              columns,
              pagination: {
                pageSize: 25,
                pageSizeOptions: [10, 25, 50, 100],
              },
            }}
            initialData={rows}
            title={gridMeta.title}
            onSave={saveSelectedRows}
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
