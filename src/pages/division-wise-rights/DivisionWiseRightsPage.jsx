import React, { useEffect, useCallback } from "react";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDivisionWiseRights } from "../../hooks/useDivisionWiseRights";
import DivisionWiseRightsForm from "./DivisionWiseRightsForm";
import { UDR_CONFIG } from "./constants";
import "./DivisionWiseRightsPage.css";

export default function DivisionWiseRightsPage() {
  const {
    fetchHeaderMeta,
    headerColumns: fieldDefs,
    gridColumns,
    dropdownOptions,
    headerFetching,
    headerError,
    fetchGridRows,
  } = useDivisionWiseRights();

  usePageHeader({
    title: "Division Wise User Right",
    subtitle: "Assign transaction and report division access per user.",
  });

  useEffect(() => {
    fetchHeaderMeta();
  }, [fetchHeaderMeta]);

  const handleUserChange = useCallback(
    async (userId) => {
      const [transactionRows, reportRows] = await Promise.all([
        fetchGridRows({ userId, tranBook: UDR_CONFIG.TRAN_BOOK_TRANSACTION }),
        fetchGridRows({ userId, tranBook: UDR_CONFIG.TRAN_BOOK_REPORT }),
      ]);
      return { transactionRows, reportRows };
    },
    [fetchGridRows]
  );

  return (
    <DivisionWiseRightsForm
      fieldDefs={fieldDefs}
      gridColumnDefs={gridColumns}
      defsLoading={headerFetching}
      defsError={headerError}
      dropdownOptions={dropdownOptions}
      onUserChange={handleUserChange}
    />
  );
}
