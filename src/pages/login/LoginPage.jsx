import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  LogIn,
  BarChart3,
  Users,
  FileStack,
} from "lucide-react";
import { useApi } from "../../api/useApi";
import { ENDPOINTS, API_BASE_URL, OBJ_TYPE } from "../../api/constants";
import { useUser } from "../../context/UserContext";
import { LOGIN_CONFIG } from "./constants";
import Loader from "../../components/ui/Loader";
import "./LoginPage.css";

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
      const from = toDateOnly(row.YearFrom);
      const to = toDateOnly(row.YearTo);
      if (!from || !to) return false;
      return today >= from && today <= to;
    }) ?? null
  );
}

function LoginAmbient() {
  return (
    <div className="login-ambient" aria-hidden="true">
      <div className="login-ambient__orb login-ambient__orb--1" />
      <div className="login-ambient__orb login-ambient__orb--2" />
      <div className="login-ambient__orb login-ambient__orb--3" />
      <div className="login-ambient__grid" />
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
          <label className="login-field">
            <span>Company</span>
            <select
              className="login-field__control"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required
            >
              {companies.map((row) => (
                <option key={row.CompanyID} value={String(row.CompanyID)}>
                  {row.CompanyName}
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
                <option key={row.YearID} value={String(row.YearID)}>
                  {row.YearName}
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
              placeholder="Admin"
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

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const loadLoginOptions = useCallback(async () => {
    setLoadingOptions(true);
    setError("");
    try {
      const bootstrap = buildBootstrapParams(LOGIN_CONFIG.BOOTSTRAP_LOGIN_ID);
      const [companyRes, yearRes] = await Promise.all([
        get(ENDPOINTS.FN_FETCH_DATA, { ...bootstrap, ObjName: LOGIN_CONFIG.SP_COMPANIES }),
        get(ENDPOINTS.FN_FETCH_DATA, { ...bootstrap, ObjName: LOGIN_CONFIG.SP_FINANCIAL_YEARS }),
      ]);

      const companyRows = companyRes?.Table ?? [];
      const yearRows = yearRes?.Table ?? [];
      setCompanies(companyRows);
      setYears(yearRows);

      if (companyRows.length > 0) {
        setCompanyId(String(companyRows[0].CompanyID));
      }
      const activeYear = findFinancialYearForDate(yearRows);
      if (activeYear?.YearID != null) {
        setYearId(String(activeYear.YearID));
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
      const authRes = await get(ENDPOINTS.FN_FETCH_DATA, {
        ObjType: OBJ_TYPE.FUNCTION,
        ObjName: LOGIN_CONFIG.SP_AUTH,
        JSon: JSON.stringify([
          {
            prmUserID: userId.trim(),
            prmPassword: password,
            prmCompanyID: Number(companyId),
            prmYearID: Number(yearId),
          },
        ]),
        p_ErrCode: -1,
        p_ErrMsg: "",
      });

      const authRow = authRes?.Table?.[0];
      if (!authRow?.LoginID) {
        setError("Invalid user ID or password. Please try again.");
        return;
      }

      const company = companies.find((row) => String(row.CompanyID) === companyId) ?? null;
      const year = years.find((row) => String(row.YearID) === yearId) ?? null;

      login(authRow, { companyId, yearId, company, year });
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
      <LoginAmbient />

      <section className="login-hero">
        <div className="login-hero__shine" aria-hidden="true" />
        <div className="login-hero__content">
          <div className="login-hero__brand">
            <div className="login-hero__logo">
              <Box size={28} strokeWidth={1.5} />
            </div>
            <div>
              <h1>Horizon Enterprise</h1>
              <p className="login-hero__tagline">Business Suite</p>
            </div>
          </div>

          <div className="login-hero__intro">
            <h2>Run operations with clarity and control</h2>
            <p>
              Inventory, procurement, invoicing, and executive reporting — built for teams that need
              speed without sacrificing compliance.
            </p>
          </div>

          <div className="login-hero__metrics">
            <div className="login-metric">
              <BarChart3 size={18} />
              <div>
                <strong>Live dashboards</strong>
                <span>Operational KPIs at a glance</span>
              </div>
            </div>
            <div className="login-metric">
              <FileStack size={18} />
              <div>
                <strong>Unified workflows</strong>
                <span>Purchase to pay, end to end</span>
              </div>
            </div>
            <div className="login-metric">
              <Users size={18} />
              <div>
                <strong>Role governance</strong>
                <span>Division &amp; department access</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-hero__trust">
          <span>
            <ShieldCheck size={14} /> Secure access
          </span>
          <span className="login-hero__dot" aria-hidden="true" />
          <span>
            <Lock size={14} /> Audit-ready
          </span>
          <span className="login-hero__dot" aria-hidden="true" />
          <span>
            <CheckCircle2 size={14} /> Enterprise SLA
          </span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel__inner">
          <div className="login-card-wrap">
            <div className="login-card">
              <div className="login-card__header">
                <div className="login-card__logo">
                  <Box size={20} strokeWidth={1.5} />
                </div>
                <h3>Sign in to workspace</h3>
                <p>Select company and financial year, then enter your credentials.</p>
              </div>

              <LoginForm {...formProps} />
            </div>
          </div>

          <p className="login-footer">© 2026 Horizon Enterprise · All Rights Reserved</p>
        </div>
      </section>
    </main>
  );
}
