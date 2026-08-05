import React, { useEffect } from "react";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useUserWiseGroupRights } from "../../hooks/useUserWiseGroupRights";
import UserWiseGroupRightsForm from "./UserWiseGroupRightsForm";

export default function UserWiseGroupRightsPage() {
  const {
    headerColumns,
    groupOptions,
    moduleOptions,
    typeOptions,
    headerFetching,
    headerError,
    fetchHeaderMeta,
    fetchRightsGrids,
  } = useUserWiseGroupRights();

  usePageHeader({
    title: "User Wise Group Rights",
    subtitle:
      "Pick a Group, Module and Type, click Search, then grant form rights and report approval rights for that group.",
    showBack: true,
    backTo: "/",
  });

  useEffect(() => {
    fetchHeaderMeta();
  }, [fetchHeaderMeta]);

  return (
    <UserWiseGroupRightsForm
      headerColumns={headerColumns}
      groupOptions={groupOptions}
      moduleOptions={moduleOptions}
      typeOptions={typeOptions}
      headerFetching={headerFetching}
      headerError={headerError}
      onSearch={fetchRightsGrids}
    />
  );
}
