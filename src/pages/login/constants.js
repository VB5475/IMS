// constants.js — Login page API config

export const LOGIN_CONFIG = {
  SP_COMPANIES: "Fn_tbl_Fetch_Company",
  SP_FINANCIAL_YEARS: "Fn_tbl_Fetch_FinancialYear",
  /** REST auth — Post_pr_UserLoginAuthentication */
  AUTH_ENDPOINT: "/API/UserLoginAuthentication/Post_pr_UserLoginAuthentication",
  /** Used only for company/year bootstrap before the user signs in. */
  BOOTSTRAP_LOGIN_ID: 1,
};

/**
 * Axios may return a JSON string (or double-encoded string) for this endpoint.
 * Normalize to a single auth row object.
 */
export function parseLoginAuthResponse(raw) {
  let data = raw;
  for (let i = 0; i < 2; i += 1) {
    if (typeof data !== "string") break;
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (Array.isArray(data)) data = data[0];
  if (!data || typeof data !== "object") return null;
  return data;
}

export function isLoginAuthSuccess(authRow) {
  if (!authRow) return false;
  const errCode = Number(authRow.errcode ?? authRow.ErrCode ?? authRow.p_ErrCode);
  const loginId = Number(
    authRow.idnumber
    ?? authRow.IDNumber
    ?? authRow.loginid
    ?? authRow.LoginID
    ?? 0
  );
  return errCode === 1 && loginId > 0;
}

export function getLoginAuthErrorMessage(authRow) {
  const msg = String(
    authRow?.errmsg ?? authRow?.ErrMsg ?? authRow?.p_ErrMsg ?? ""
  ).trim();
  return msg || "Invalid user ID or password. Please try again.";
}
