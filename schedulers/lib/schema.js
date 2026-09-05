// schema.js — DDL for both supported dialects. db.js's ensureSchema() picks
// the right one based on config.dbType and runs it once on startup, so a
// fresh database needs zero manual setup.
//
// Both tables' table names are interpolated directly (config.js validates
// DB_TABLENAME against a strict identifier pattern before it ever reaches
// here — see TABLE_NAME_PATTERN there).

export const EMPLOYEE_COLUMNS = [
  "employee_code",
  "employee_id",
  "employee_name",
  "first_name",
  "last_name",
  "email",
  "mobile",
  "gender",
  "date_of_birth",
  "date_of_joining",
  "date_of_leaving",
  "employee_status",
  "employment_status",
  "reporting_manager_name",
  "reporting_manager_code",
  "last_modified",
  "raw_json",
];

export function mssqlSchema(tableName, syncStateTableName) {
  return `
IF OBJECT_ID(N'[dbo].[${tableName}]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[${tableName}] (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_code NVARCHAR(50) NOT NULL,
    employee_id NVARCHAR(50) NULL,
    employee_name NVARCHAR(200) NULL,
    first_name NVARCHAR(100) NULL,
    last_name NVARCHAR(100) NULL,
    email NVARCHAR(200) NULL,
    mobile NVARCHAR(30) NULL,
    gender NVARCHAR(20) NULL,
    date_of_birth NVARCHAR(30) NULL,
    date_of_joining NVARCHAR(30) NULL,
    date_of_leaving NVARCHAR(30) NULL,
    employee_status NVARCHAR(50) NULL,
    employment_status NVARCHAR(50) NULL,
    reporting_manager_name NVARCHAR(200) NULL,
    reporting_manager_code NVARCHAR(50) NULL,
    last_modified NVARCHAR(50) NULL,
    raw_json NVARCHAR(MAX) NULL,
    synced_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_${tableName}_employee_code UNIQUE (employee_code)
  );
END;

IF OBJECT_ID(N'[dbo].[${syncStateTableName}]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[${syncStateTableName}] (
    id INT IDENTITY(1,1) PRIMARY KEY,
    run_started_at DATETIME2 NOT NULL,
    run_completed_at DATETIME2 NULL,
    from_date NVARCHAR(20) NULL,
    to_date NVARCHAR(20) NULL,
    page_size INT NULL,
    pages_fetched INT NULL,
    last_page_number INT NULL,
    employees_count_last_batch INT NULL,
    total_employee_count INT NULL,
    employees_upserted INT NULL,
    status NVARCHAR(20) NOT NULL,
    error_message NVARCHAR(MAX) NULL,
    summary NVARCHAR(MAX) NULL
  );
END;

-- Added after the original release — guarded so it's a no-op on a database
-- that already has the column, and self-applies on one that doesn't, with
-- no manual migration step either way.
IF COL_LENGTH(N'dbo.${syncStateTableName}', 'last_employee_code') IS NULL
BEGIN
  ALTER TABLE [dbo].[${syncStateTableName}] ADD last_employee_code NVARCHAR(50) NULL;
END;
`;
}

export function postgresSchema(tableName, syncStateTableName) {
  return `
CREATE TABLE IF NOT EXISTS "${tableName}" (
  id SERIAL PRIMARY KEY,
  employee_code VARCHAR(50) NOT NULL UNIQUE,
  employee_id VARCHAR(50),
  employee_name VARCHAR(200),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(200),
  mobile VARCHAR(30),
  gender VARCHAR(20),
  date_of_birth VARCHAR(30),
  date_of_joining VARCHAR(30),
  date_of_leaving VARCHAR(30),
  employee_status VARCHAR(50),
  employment_status VARCHAR(50),
  reporting_manager_name VARCHAR(200),
  reporting_manager_code VARCHAR(50),
  last_modified VARCHAR(50),
  raw_json JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "${syncStateTableName}" (
  id SERIAL PRIMARY KEY,
  run_started_at TIMESTAMPTZ NOT NULL,
  run_completed_at TIMESTAMPTZ,
  from_date VARCHAR(20),
  to_date VARCHAR(20),
  page_size INT,
  pages_fetched INT,
  last_page_number INT,
  employees_count_last_batch INT,
  total_employee_count INT,
  employees_upserted INT,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  summary JSONB
);

-- Added after the original release — IF NOT EXISTS makes this a no-op on a
-- database that already has the column, and self-applies on one that
-- doesn't, with no manual migration step either way.
ALTER TABLE "${syncStateTableName}" ADD COLUMN IF NOT EXISTS last_employee_code VARCHAR(50);
`;
}
