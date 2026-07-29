import React, { useEffect } from "react";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useDMDocumentList } from "../../hooks/useDMDocumentList";
import DMDocumentListForm from "./DMDocumentListForm";

export default function DMDocumentListPage() {
  const {
    fetchHeaderMeta,
    docsColumns,
    refColumns,
    metaFetching,
    metaError,
    docTypeOptions,
    docSubTypeOptions,
    categoryOptions,
    fetchReferenceDocs,
    saveDocs,
    isSaving,
  } = useDMDocumentList();

  usePageHeader({
    title: "Document List",
    subtitle: "Add document metadata rows, then Save. Reference Documents shows related read-only entries.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    fetchHeaderMeta();
  }, [fetchHeaderMeta]);

  return (
    <DMDocumentListForm
      docsColumns={docsColumns}
      refColumns={refColumns}
      metaFetching={metaFetching}
      metaError={metaError}
      docTypeOptions={docTypeOptions}
      docSubTypeOptions={docSubTypeOptions}
      categoryOptions={categoryOptions}
      onFetchReferenceDocs={fetchReferenceDocs}
      onSaveDocs={saveDocs}
      isSaving={isSaving}
    />
  );
}
