import React, { useEffect, useCallback } from "react";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDMTT2DocTypeMaster } from "../../hooks/useDMTT2DocTypeMaster";
import DMTT2DocTypeMasterForm from "./DMTT2DocTypeMasterForm";
import "../division-wise-rights/DivisionWiseRightsPage.css";

export default function DMTT2DocTypeMasterPage() {
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs,
    headerFetching,
    headerError,
    departmentOptions,
    fetchTranTypeOptions,
    fetchDocumentTypeRows,
  } = useDMTT2DocTypeMaster();

  usePageHeader({
    title: "Transaction To Document Type Master",
    subtitle: "Map document types to a department and transaction type.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    fetchHeaderMeta();
  }, [fetchHeaderMeta]);

  // Document Type checklist now needs BOTH department + tran type (2026-08-14
  // /pm: fn_tbl_fetch_documenttypett2doc(@prmdeptid, @prmreftrantypeid)) — it
  // can no longer be fetched alongside Tran Type options at Department-change
  // time (tran type isn't known yet). Department change fetches Tran Type
  // options only; the checklist fetch moves to Tran Type change instead.
  const handleDepartmentChange = useCallback(
    async (departmentId) => {
      const tranTypeOptions = await fetchTranTypeOptions(departmentId);
      return { tranTypeOptions };
    },
    [fetchTranTypeOptions]
  );

  const handleTranTypeChange = useCallback(
    async (departmentId, tranTypeId) => {
      const documentTypeRows = await fetchDocumentTypeRows(departmentId, tranTypeId);
      return { documentTypeRows };
    },
    [fetchDocumentTypeRows]
  );

  return (
    <DMTT2DocTypeMasterForm
      fieldDefs={fieldDefs}
      defsLoading={headerFetching}
      defsError={headerError}
      departmentOptions={departmentOptions}
      onDepartmentChange={handleDepartmentChange}
      onTranTypeChange={handleTranTypeChange}
    />
  );
}
