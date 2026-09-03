// constants.js — Asset Health Decision dashboard (Home module)

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";
import { DASHBOARD_CONFIG } from "../dashboard/constants";

export const AHD_CONFIG = {
  RB_CODE: RB_CODES.ASSET_HEALTH_DECISION,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSET_HEALTH_DECISION),
  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DATA: "fn_tbl_fetch_adb_asthealthdecision",
  SP_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  SP_MAIN_GROUP: DASHBOARD_CONFIG.SP_MAIN_GROUP,
  SP_SUB_MAIN_GROUP: DASHBOARD_CONFIG.SP_SUB_MAIN_GROUP,
  OBJ_TYPE: 2,
  DEFAULT_MASTER_ID: 1,
  DEFAULT_SESSION_ID: 1,
};
