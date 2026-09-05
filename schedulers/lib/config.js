// config.js — loads and validates schedulers/.env, fails fast with one
// clear message if something required is missing/malformed, rather than
// crashing deep inside an HTTP or DB call later.

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const ALWAYS_REQUIRED_VARS = [
  "ZINGHR_API_URL",
  "ZINGHR_SUBSCRIPTION_NAME",
  "ZINGHR_TOKEN",
  "DBTYPE",
  "DB_TABLENAME",
  "IMS_API_PROJECT",
];

// Same set the frontend's environment switcher offers — see BASE_PROJECTS in
// src/config/runtimeConfig.js. Kept as a separate literal here (rather than
// imported) because this folder is standalone and deployable on its own,
// independent of src/ — see schedulers/README.md.
const IMS_API_PROJECTS = ["IMS_LIVE", "IMS_PGLIVE", "MV_WSLIVE"];
const DEFAULT_IMS_API_DOMAIN = "http://122.179.135.100:8095/";

// Both SQL Server and Postgres connection details can stay configured in
// .env at the same time — only the set matching DBTYPE actually has to be
// filled in; the other one is simply unused, not validated.
const DB_VARS_BY_TYPE = {
  SQL: ["SQL_DB_IP", "SQL_DB_PORT", "SQL_DB_NAME", "SQL_DB_USERNAME", "SQL_DB_PASSWORD"],
  PG: ["PG_DB_IP", "PG_DB_PORT", "PG_DB_NAME", "PG_DB_USERNAME", "PG_DB_PASSWORD"],
};

// Table name gets interpolated directly into DDL/DML strings (table names
// can't be bound as query parameters in either SQL Server or Postgres), so
// it's restricted to a safe identifier shape rather than trusted as-is.
const TABLE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `Missing required environment variable: ${name}. Copy schedulers/.env.example to schedulers/.env and fill in real values.`
    );
  }
  return value;
}

function optionalInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: "${raw}"`);
  }
  return parsed;
}

export function loadConfig() {
  ALWAYS_REQUIRED_VARS.forEach(required);

  const dbType = required("DBTYPE").toUpperCase();
  if (dbType !== "SQL" && dbType !== "PG") {
    throw new Error(`DBTYPE must be "SQL" or "PG", got: "${dbType}"`);
  }
  // Only the connection vars for the ACTIVE dialect are required — the
  // other dialect's vars can be left blank, or filled in and simply
  // ignored, so both can stay configured side by side and DBTYPE alone
  // switches which one is used.
  const [ipVar, portVar, nameVar, userVar, passVar] = DB_VARS_BY_TYPE[dbType];
  DB_VARS_BY_TYPE[dbType].forEach(required);

  const dbTableName = required("DB_TABLENAME");
  if (!TABLE_NAME_PATTERN.test(dbTableName)) {
    throw new Error(
      `DB_TABLENAME "${dbTableName}" is invalid — it's used as a SQL identifier, so only letters, numbers, and underscores are allowed, and it can't start with a number.`
    );
  }

  // Same two-part shape as the frontend's config.json (baseDomain + apiMode,
  // see src/config/runtimeConfig.js): a domain root plus which backend
  // project to hit, rather than one hand-assembled URL — so switching
  // between IMS_LIVE / IMS_PGLIVE / MV_WSLIVE is a one-line env change.
  const imsApiProject = required("IMS_API_PROJECT").toUpperCase();
  if (!IMS_API_PROJECTS.includes(imsApiProject)) {
    throw new Error(`IMS_API_PROJECT must be one of ${IMS_API_PROJECTS.join(", ")}, got: "${imsApiProject}"`);
  }
  const imsApiDomainRaw = process.env.IMS_API_DOMAIN || DEFAULT_IMS_API_DOMAIN;
  const imsApiDomain = imsApiDomainRaw.endsWith("/") ? imsApiDomainRaw : `${imsApiDomainRaw}/`;

  return {
    zingHrApiUrl: required("ZINGHR_API_URL"),
    zingHrSubscriptionName: required("ZINGHR_SUBSCRIPTION_NAME"),
    zingHrToken: required("ZINGHR_TOKEN"),

    imsApiProject,
    imsApiBaseUrl: `${imsApiDomain}${imsApiProject}`,

    dbType,
    dbIp: required(ipVar),
    dbPort: optionalInt(portVar, dbType === "SQL" ? 1433 : 5432),
    dbName: required(nameVar),
    dbUsername: required(userVar),
    dbPassword: required(passVar),
    dbTableName,
    dbSyncStateTableName: `${dbTableName}_sync_state`,

    syncPageSize: optionalInt("SYNC_PAGE_SIZE", 100),
    syncInitialFromDate: process.env.SYNC_INITIAL_FROM_DATE || "01-01-2020",
    syncMaxPages: optionalInt("SYNC_MAX_PAGES", 500),
    syncMaxRetries: optionalInt("SYNC_MAX_RETRIES", 3),
    syncRetryDelayMs: optionalInt("SYNC_RETRY_DELAY_MS", 2000),
    syncRequestTimeoutMs: optionalInt("SYNC_REQUEST_TIMEOUT_MS", 30000),
    // How long a status='running' row is trusted before the next run treats
    // it as orphaned (crashed/killed) rather than a genuinely slow sync
    // that's still in flight. Keep this comfortably above how long a normal
    // full run ever takes, so two overlapping invocations don't cause one
    // to mark the other's still-live row as failed.
    syncStaleRunningMinutes: optionalInt("SYNC_STALE_RUNNING_MINUTES", 120),
  };
}

function maskSecret(value) {
  if (!value || value.length <= 8) return "********";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/** Safe-to-log summary of the loaded config — every secret masked. Use this
 *  instead of ever logging the config object itself. */
export function describeConfig(config) {
  return {
    dbType: config.dbType,
    dbHost: `${config.dbIp}:${config.dbPort}`,
    dbName: config.dbName,
    dbTableName: config.dbTableName,
    dbSyncStateTableName: config.dbSyncStateTableName,
    imsApiProject: config.imsApiProject,
    imsApiBaseUrl: config.imsApiBaseUrl,
    dbUsername: config.dbUsername,
    dbPassword: "********",
    zingHrSubscriptionName: config.zingHrSubscriptionName,
    zingHrToken: maskSecret(config.zingHrToken),
    syncPageSize: config.syncPageSize,
    syncInitialFromDate: config.syncInitialFromDate,
    syncMaxPages: config.syncMaxPages,
  };
}
