// constants.js — FAR dashboard (Finance module)

import { RB_CODES, rbRoutePath } from "../../constants/rbCodes";

export const FAR_CONFIG = {
  RB_CODE: RB_CODES.FAR,
  ROUTE_PATH: rbRoutePath(RB_CODES.FAR),
  SP_RB_META: "fn_fetch_rbdetailbyrbcode",
  SP_DATA: "fn_tbl_rb_astfar",
  SP_DIVISION: "fn_tbl_fetchuserwsfromdivision",
  OBJ_TYPE: 2,
  DEFAULT_MASTER_ID: 1,
  DEFAULT_SESSION_ID: 1,
};
