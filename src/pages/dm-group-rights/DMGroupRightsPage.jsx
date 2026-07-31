import React, { useEffect } from "react";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDMGroupRights } from "../../hooks/useDMGroupRights";
import DMGroupRightsForm from "./DMGroupRightsForm";

export default function DMGroupRightsPage() {
  const {
    allColumns,
    headerColumns,
    gridColumns,
    groupOptions,
    departmentOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchGridRows,
    refreshDepartmentOptions,
  } = useDMGroupRights();

  usePageHeader({
    title: "Group Rights",
    subtitle: "Pick a Group and Department, click Get Detail, then set Upload/View/Delete rights per document type.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    fetchHeaderMeta();
  }, [fetchHeaderMeta]);

  return (
    <DMGroupRightsForm
      allColumns={allColumns}
      headerColumns={headerColumns}
      gridColumns={gridColumns}
      groupOptions={groupOptions}
      departmentOptions={departmentOptions}
      headerFetching={headerFetching}
      headerError={headerError}
      onGetDetail={fetchGridRows}
      onDefineModeChange={refreshDepartmentOptions}
    />
  );
}
