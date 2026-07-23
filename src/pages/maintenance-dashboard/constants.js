import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const MAINTENANCE_DASHBOARD_CONFIG = {
  RB_CODE: RB_CODES.MAINTENANCE_DASHBOARD,
  ROUTE_PATH: rbRoutePath(RB_CODES.MAINTENANCE_DASHBOARD),
  SP_RB_META: "Fn_Fetch_RBDetailByRBCode",
  SP_DATA: "fn_tbl_rb_mntdashboard",
  SP_DIVISION: "fn_tbl_fetchuserwsdivision",
  SP_LOCATION: "fn_gen_fetchlocationmaster",
  SP_DEPARTMENT: "fn_gen_fetchdepartmentmaster",
  SP_CALL_TYPE: "Vw_MntCallgentype",
  SP_ASSET_TYPE: "fn_tbl_fetchassetsitemmaingroup",
  OBJ_TYPE: 2,
  /** Vw_MntCallgentype is a SQL view — ObjType 3 on FN_Fetch_Data */
  CALL_TYPE_OBJ_TYPE: 3,
  DEFAULT_MASTER_ID: 0,
  DEFAULT_SESSION_ID: 1,
};

export const MAINTENANCE_DASHBOARD_FILTER_RESETS = {
  divisionid: ["locationid", "deptid", "assetstype"],
  locationid: ["deptid", "assetstype"],
  deptid: ["assetstype"],
  typeofcalls: ["assetstype"],
};

export const MAINTENANCE_DASHBOARD_ACTIONS = [
  { id: "call-allocation", label: "Call Allocation" },
  { id: "vendor-follow-up", label: "Vendor Follow Up" },
  { id: "call-reporting", label: "Call Reporting" },
];
