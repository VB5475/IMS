// constants.js — Asset Summary dashboard (Home module)

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const ASSET_SUMMARY_CONFIG = {
  RB_CODE: RB_CODES.ASSET_SUMMARY,
  ROUTE_PATH: rbRoutePath(RB_CODES.ASSET_SUMMARY),
  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DATA: "fn_tbl_rb_aststkadbsmgws",
  SP_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  OBJ_TYPE: 2,
  DEFAULT_MASTER_ID: 1,
  DEFAULT_SESSION_ID: 1,
};
