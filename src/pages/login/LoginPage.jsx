import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
  LogIn,
} from "lucide-react";
import { useApi } from "../../api/useApi";
import {
  ENDPOINTS,
  API_BASE_URL,
  API_BASE_URL_IMS,
  OBJ_TYPE,
  BASE_PROJECT_OPTIONS,
  PROD_BASE_PROJECT,
  switchBaseProject,
} from "../../api/constants";
import { useUser } from "../../context/UserContext";
import { getClientIpAddress } from "../../utils/clientIp";
import {
  LOGIN_CONFIG,
  parseLoginAuthResponse,
  isLoginAuthSuccess,
  getLoginAuthErrorMessage,
} from "./constants";
import Loader from "../../components/ui/Loader";
import "./LoginPage.css";

const BRAND_LOGO_SRC = "/test.png";
const LOGIN_BG_VIDEO_SRC = "/media/login-bg.mp4";
const LOGIN_BG_POSTER_SRC = "/media/login-bg-poster.jpg";

function buildBootstrapParams(loginId) {
  return {
    ObjType: OBJ_TYPE.FUNCTION,
    JSon: JSON.stringify([{ prmLoginID: loginId }]),
    p_ErrCode: -1,
    p_ErrMsg: "",
  };
}

function toDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Pick the financial year row whose YearFrom–YearTo range contains the given date. */
function findFinancialYearForDate(yearRows, date = new Date()) {
  const today = toDateOnly(date);
  if (!today || !Array.isArray(yearRows)) return null;

  return (
    yearRows.find((row) => {
      const from = toDateOnly(row.yearfrom);
      const to = toDateOnly(row.yearto);
      if (!from || !to) return false;
      return today >= from && today <= to;
    }) ?? null
  );
}

function LoginEnvSwitcher() {
  return (
    <div className="login-env-switcher">
      <div className="login-env-switcher__group" role="group" aria-label="API environment">
        {BASE_PROJECT_OPTIONS.map((opt) => {
          const isActive = opt === PROD_BASE_PROJECT;
          return (
            <button
              key={opt}
              type="button"
              className={`login-env-switcher__btn${isActive ? " login-env-switcher__btn--active" : ""}${opt === "IMS_PGLIVE" ? " login-env-switcher__btn--pg" : ""}`}
              title={isActive ? `Active: ${opt}` : `Switch to ${opt}`}
              onClick={() => { if (!isActive) switchBaseProject(opt); }}
              aria-pressed={isActive}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoginVideoBackground() {
  return (
    <div className="login-video-bg" aria-hidden="true">
      <video
        className="login-video-bg__video"
        src={LOGIN_BG_VIDEO_SRC}
        poster={LOGIN_BG_POSTER_SRC}
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="login-video-bg__overlay" />
    </div>
  );
}

function LoginForm({
  error,
  loadingOptions,
  submitting,
  companies,
  years,
  companyId,
  setCompanyId,
  yearId,
  setYearId,
  userId,
  setUserId,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  onSubmit,
}) {
  return (
    <>
      {error && (
        <div className="login-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loadingOptions ? (
        <div className="login-card__loader">
          <Loader text="Loading sign-in options…" />
        </div>
      ) : (
        <form className="login-form" onSubmit={onSubmit}>
          {/* Only this wrapper scrolls (if the fields genuinely don't fit a
              short mobile viewport) — the submit button below stays outside
              it, always visible, never pushed off-screen or into the scroll. */}
          <div className="login-form__fields">
            <label className="login-field">
              <span>Company</span>
              <select
                className="login-field__control"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
              >
                {companies.map((row) => (
                  <option key={row.companyid ?? row.CompanyID} value={String(row.companyid ?? row.CompanyID)}>
                    {row.companyname ?? row.CompanyName}
                  </option>
                ))}
              </select>
            </label>

            <label className="login-field">
              <span>Financial Year</span>
              <select
                className="login-field__control"
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
                required
              >
                {years.map((row) => (
                  <option key={row.yearid} value={String(row.yearid)}>
                    {row.yearname}
                  </option>
                ))}
              </select>
            </label>

            <label className="login-field">
              <span>User ID</span>
              <input
                className="login-field__control"
                type="text"
                name="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your user ID"
                autoComplete="username"
                required
                autoFocus
              />
            </label>

            <div className="login-field">
              <div className="login-field__row">
                <label htmlFor="password">Password</label>
                <button type="button" className="login-field__link">
                  Forgot password?
                </button>
              </div>
              <div className="login-field__password">
                <input
                  className="login-field__control"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="login-field__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="login-remember">
              <input type="checkbox" name="remember" defaultChecked />
              <span>Remember me for 30 days</span>
            </label>
          </div>

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign In"}
            {!submitting && <LogIn size={15} />}
          </button>
        </form>
      )}

      <p className="login-card__notice">
        <Lock size={12} />
        Authorized users only · Internal business application
      </p>
    </>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { get } = useApi(API_BASE_URL);
  const { post: postAuth } = useApi(API_BASE_URL_IMS);
  const { login, isAuthenticated } = useUser();

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [companies, setCompanies] = useState([]);
  const [years, setYears] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [yearId, setYearId] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [clientIp, setClientIp] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ip = await getClientIpAddress();
      if (!cancelled) setClientIp(ip);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadLoginOptions = useCallback(async () => {
    setLoadingOptions(true);
    setError("");
    try {
      const bootstrap = buildBootstrapParams(LOGIN_CONFIG.BOOTSTRAP_LOGIN_ID);
      const [companyRes, yearRes] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, { ...bootstrap, ObjName: LOGIN_CONFIG.SP_COMPANIES }),
        get(ENDPOINTS.FN_FETCH_DATA, { ...bootstrap, ObjName: LOGIN_CONFIG.SP_FINANCIAL_YEARS }),
      ]);

      const companyRows = companyRes ?? [];
      const yearRows = yearRes ?? [];
      setCompanies(companyRows);
      setYears(yearRows);

      if (companyRows.length > 0) {
        const firstId = companyRows[0].companyid ?? companyRows[0].CompanyID;
        if (firstId != null) setCompanyId(String(firstId));
      }
      const activeYear = findFinancialYearForDate(yearRows);
      if (activeYear?.yearid != null) {
        setYearId(String(activeYear.yearid));
      }
    } catch (err) {
      console.error("[LoginPage] bootstrap fetch failed:", err);
      setError("Failed to load company or financial year options.");
    } finally {
      setLoadingOptions(false);
    }
  }, [get]);

  useEffect(() => {
    loadLoginOptions();
  }, [loadLoginOptions]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const ipAddress = clientIp || (await getClientIpAddress());
      const authRes = await postAuth(LOGIN_CONFIG.AUTH_ENDPOINT, {
        prmuserid: userId.trim(),
        prmpassword: password,
        prmcompanyid: Number(companyId),
        prmyearid: Number(yearId),
        prmipaddress: ipAddress
      });

      const authRow = parseLoginAuthResponse(authRes);
      if (!isLoginAuthSuccess(authRow)) {
        setError(getLoginAuthErrorMessage(authRow));
        return;
      }

      const company = companies.find(
        (row) => String(row.companyid ?? row.CompanyID) === companyId
      ) ?? null;
      const year = years.find((row) => String(row.yearid) === yearId) ?? null;

      await login(authRow, { companyId, yearId, company, year });
      navigate("/", { replace: true });
    } catch (err) {
      console.error("[LoginPage] authentication failed:", err);
      setError(err?.message || "Sign in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formProps = {
    error,
    loadingOptions,
    submitting,
    companies,
    years,
    companyId,
    setCompanyId,
    yearId,
    setYearId,
    userId,
    setUserId,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    onSubmit: handleSubmit,
  };

  return (
    <main className="login-page">
      <LoginVideoBackground />

      <section className="login-panel">
        <div className="login-panel__inner">
          <div className="login-brand">
            <div className="login-brand__logo">
              <img src={BRAND_LOGO_SRC} alt="IMS logo" className="login-brand-logo__image" />
            </div>
            <div>
              <h1>IMS PORTAL</h1>
              <p className="login-brand__tagline">Asset Management System</p>
            </div>
          </div>

          <div className="login-card-wrap">
            <div className="login-card">
              <LoginEnvSwitcher />
              <div className="login-card__header">
                <h3>Sign in to workspace</h3>
                <p>Select company and financial year, then enter your credentials.</p>
              </div>

              <LoginForm {...formProps} />
            </div>
          </div>

          <p className="login-footer">© 2026 IMS Group · All Rights Reserved</p>
        </div>
      </section>
    </main>
  );
}