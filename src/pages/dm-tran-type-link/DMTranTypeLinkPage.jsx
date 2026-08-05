import React, { useEffect } from "react";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDMTranTypeLink } from "../../hooks/useDMTranTypeLink";
import DMTranTypeLinkForm from "./DMTranTypeLinkForm";
import "../division-wise-rights/DivisionWiseRightsPage.css";
import "./DMTranTypeLinkPage.css";

export default function DMTranTypeLinkPage() {
  const {
    fetchHeaderMeta,
    headerColumns,
    headerFetching,
    headerError,
    allColumns,
    gridColumns,
    tranTypeOptions,
    fetchLinkRows,
  } = useDMTranTypeLink();

  usePageHeader({
    title: "DM Tran Type Link",
    subtitle: "Link a Transaction Type to the other Transaction Types it references.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    fetchHeaderMeta();
  }, [fetchHeaderMeta]);

  return (
    <DMTranTypeLinkForm
      headerColumns={headerColumns}
      defsLoading={headerFetching}
      defsError={headerError}
      allColumns={allColumns}
      gridColumns={gridColumns}
      tranTypeOptions={tranTypeOptions}
      onFromTranTypeChange={fetchLinkRows}
    />
  );
}
