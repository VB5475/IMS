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

  const handleDepartmentChange = useCallback(
    async (departmentId, departmentLabel) => {
      const [tranTypeOptions, documentTypeRows] = await Promise.all([
        fetchTranTypeOptions(departmentId),
        fetchDocumentTypeRows(departmentLabel),
      ]);
      return { tranTypeOptions, documentTypeRows };
    },
    [fetchTranTypeOptions, fetchDocumentTypeRows]
  );

  return (
    <DMTT2DocTypeMasterForm
      fieldDefs={fieldDefs}
      defsLoading={headerFetching}
      defsError={headerError}
      departmentOptions={departmentOptions}
      onDepartmentChange={handleDepartmentChange}
    />
  );
}
