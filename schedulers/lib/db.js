// db.js — DBTYPE-aware database layer. Everything dialect-specific (MERGE
// vs INSERT...ON CONFLICT, mssql's named @params vs pg's positional $N,
// IDENTITY vs SERIAL, etc.) is isolated in here; sync-employees.js only
// ever calls the shared interface both adapters implement:
//
//   connect() / close()
//   ensureSchema()
//   upsertEmployee(row)
//   reconcileOrphanedRuns(staleAfterMinutes) -> [id, ...]
//   startSyncRun({ fromDate, toDate, pageSize }) -> runId
//   updateLastRecord(runId, employeeCode) -> marks the most recently
//     upserted record on this run, so a failed row shows exactly which
//     employee it got through up to, not just which page
//   updateSyncRunProgress(runId, { pagesFetched, lastPageNumber,
//     employeesCountLastBatch, totalEmployeeCount, employeesUpserted })
//   completeSyncRun(runId, { pagesFetched, lastPageNumber,
//     employeesCountLastBatch, totalEmployeeCount, employeesUpserted, summary })
//   failSyncRun(runId, errorMessage)
//   getLastSuccessfulSyncState() -> { to_date, ... } | null
//   getResumableRun() -> the most recent 'failed' row with checkpoint
//     progress, as long as no later run has already succeeded past it — or
//     null if there's nothing to resume
//
// All queries are parameterized — table/column names are the only
// interpolated strings, and those come only from config.js's validated
// dbTableName (checked against a strict identifier pattern before this
// module ever sees it), never from API response data.

import { EMPLOYEE_COLUMNS, mssqlSchema, postgresSchema } from "./schema.js";

// createMssqlDb/createPostgresDb are both async (each dynamically imports
// only the driver it actually needs) — this factory has to be async too and
// await the right one, or callers get an unresolved Promise instead of the
// db object.
export async function createDb(config) {
  return config.dbType === "SQL" ? createMssqlDb(config) : createPostgresDb(config);
}

// ── SQL Server ──────────────────────────────────────────────────────────

async function createMssqlDb(config) {
  const sql = (await import("mssql")).default;

  const pool = new sql.ConnectionPool({
    server: config.dbIp,
    port: config.dbPort,
    database: config.dbName,
    user: config.dbUsername,
    password: config.dbPassword,
    options: {
      // Most on-prem SQL Server instances aren't set up with a CA-signed
      // cert for this — flip these if your environment's server enforces
      // encrypted connections with a real certificate.
      encrypt: false,
      trustServerCertificate: true,
    },
  });

  async function connect() {
    await pool.connect();
  }

  async function close() {
    await pool.close();
  }

  async function ensureSchema() {
    await pool.request().batch(mssqlSchema(config.dbTableName, config.dbSyncStateTableName));
  }

  async function upsertEmployee(row) {
    const request = pool.request();
    EMPLOYEE_COLUMNS.forEach((col) => request.input(col, row[col] ?? null));

    const updateSet = EMPLOYEE_COLUMNS.filter((c) => c !== "employee_code")
      .map((c) => `target.${c} = src.${c}`)
      .concat("target.synced_at = SYSUTCDATETIME()")
      .join(", ");
    const insertCols = [...EMPLOYEE_COLUMNS, "synced_at", "created_at"].join(", ");
    const insertVals = [
      ...EMPLOYEE_COLUMNS.map((c) => `src.${c}`),
      "SYSUTCDATETIME()",
      "SYSUTCDATETIME()",
    ].join(", ");
    const srcCols = EMPLOYEE_COLUMNS.map((c) => `@${c} AS ${c}`).join(", ");

    await request.query(`
      MERGE [dbo].[${config.dbTableName}] AS target
      USING (SELECT ${srcCols}) AS src
        ON target.employee_code = src.employee_code
      WHEN MATCHED THEN UPDATE SET ${updateSet}
      WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals});
    `);
  }

  async function reconcileOrphanedRuns(staleAfterMinutes) {
    // A row left at status='running' means the process that owned it never
    // reached completeSyncRun/failSyncRun — killed, OOM, host reboot, a
    // Task Scheduler timeout. Left alone it stays "running" forever, which
    // is exactly the stuck-status glitch this closes out before a new run
    // starts, so the next getResumableRun() call can see it as resumable.
    // Only rows older than staleAfterMinutes qualify, so a second invocation
    // that overlaps a still-genuinely-running one doesn't fail it out from
    // under itself.
    const result = await pool
      .request()
      .input("stale_minutes", staleAfterMinutes)
      .query(`
        UPDATE [dbo].[${config.dbSyncStateTableName}]
        SET run_completed_at = SYSUTCDATETIME(), status = 'failed',
            error_message = COALESCE(error_message, N'Orphaned: process ended without recording a result (crash, kill, or host restart).')
        OUTPUT INSERTED.id
        WHERE status = 'running'
          AND run_started_at < DATEADD(MINUTE, -@stale_minutes, SYSUTCDATETIME());
      `);
    return result.recordset.map((row) => row.id);
  }

  async function startSyncRun({ fromDate, toDate, pageSize }) {
    const result = await pool
      .request()
      .input("from_date", fromDate)
      .input("to_date", toDate)
      .input("page_size", pageSize)
      .query(`
        INSERT INTO [dbo].[${config.dbSyncStateTableName}]
          (run_started_at, from_date, to_date, page_size, status)
        OUTPUT INSERTED.id
        VALUES (SYSUTCDATETIME(), @from_date, @to_date, @page_size, 'running');
      `);
    return result.recordset[0].id;
  }

  async function updateLastRecord(runId, employeeCode) {
    await pool
      .request()
      .input("id", runId)
      .input("last_employee_code", employeeCode)
      .query(`
        UPDATE [dbo].[${config.dbSyncStateTableName}]
        SET last_employee_code = @last_employee_code
        WHERE id = @id;
      `);
  }

  async function updateSyncRunProgress(runId, progress) {
    await pool
      .request()
      .input("id", runId)
      .input("pages_fetched", progress.pagesFetched)
      .input("last_page_number", progress.lastPageNumber)
      .input("employees_count_last_batch", progress.employeesCountLastBatch)
      .input("total_employee_count", progress.totalEmployeeCount)
      .input("employees_upserted", progress.employeesUpserted)
      .query(`
        UPDATE [dbo].[${config.dbSyncStateTableName}]
        SET pages_fetched = @pages_fetched, last_page_number = @last_page_number,
            employees_count_last_batch = @employees_count_last_batch,
            total_employee_count = @total_employee_count, employees_upserted = @employees_upserted
        WHERE id = @id;
      `);
  }

  async function completeSyncRun(runId, summary) {
    await pool
      .request()
      .input("id", runId)
      .input("pages_fetched", summary.pagesFetched)
      .input("last_page_number", summary.lastPageNumber)
      .input("employees_count_last_batch", summary.employeesCountLastBatch)
      .input("total_employee_count", summary.totalEmployeeCount)
      .input("employees_upserted", summary.employeesUpserted)
      .input("summary", JSON.stringify(summary))
      .query(`
        UPDATE [dbo].[${config.dbSyncStateTableName}]
        SET run_completed_at = SYSUTCDATETIME(), status = 'success',
            pages_fetched = @pages_fetched, last_page_number = @last_page_number,
            employees_count_last_batch = @employees_count_last_batch,
            total_employee_count = @total_employee_count,
            employees_upserted = @employees_upserted, summary = @summary
        WHERE id = @id;
      `);
  }

  async function failSyncRun(runId, errorMessage) {
    await pool
      .request()
      .input("id", runId)
      .input("error_message", errorMessage)
      .query(`
        UPDATE [dbo].[${config.dbSyncStateTableName}]
        SET run_completed_at = SYSUTCDATETIME(), status = 'failed', error_message = @error_message
        WHERE id = @id;
      `);
  }

  async function getLastSuccessfulSyncState() {
    const result = await pool.request().query(`
      SELECT TOP 1 * FROM [dbo].[${config.dbSyncStateTableName}]
      WHERE status = 'success'
      ORDER BY run_completed_at DESC;
    `);
    return result.recordset[0] ?? null;
  }

  async function getResumableRun() {
    const result = await pool.request().query(`
      SELECT TOP 1 * FROM [dbo].[${config.dbSyncStateTableName}]
      WHERE status = 'failed' AND last_page_number IS NOT NULL
      ORDER BY run_started_at DESC;
    `);
    const failedRun = result.recordset[0] ?? null;
    if (!failedRun) return null;

    // A later success can only exist if someone re-ran with a fresh window
    // after this failure without resuming it — don't resume a run that's
    // already been superseded.
    const lastSuccess = await getLastSuccessfulSyncState();
    if (lastSuccess && new Date(lastSuccess.run_completed_at) > new Date(failedRun.run_started_at)) {
      return null;
    }
    return failedRun;
  }

  return {
    connect,
    close,
    ensureSchema,
    upsertEmployee,
    reconcileOrphanedRuns,
    startSyncRun,
    updateLastRecord,
    updateSyncRunProgress,
    completeSyncRun,
    failSyncRun,
    getLastSuccessfulSyncState,
    getResumableRun,
  };
}

// ── PostgreSQL ──────────────────────────────────────────────────────────

async function createPostgresDb(config) {
  const { Pool } = await import("pg");

  const pool = new Pool({
    host: config.dbIp,
    port: config.dbPort,
    database: config.dbName,
    user: config.dbUsername,
    password: config.dbPassword,
  });

  async function connect() {
    // Validates the connection eagerly rather than waiting for the first
    // real query to discover bad credentials/host.
    const client = await pool.connect();
    client.release();
  }

  async function close() {
    await pool.end();
  }

  async function ensureSchema() {
    await pool.query(postgresSchema(config.dbTableName, config.dbSyncStateTableName));
  }

  async function upsertEmployee(row) {
    const values = EMPLOYEE_COLUMNS.map((c) => row[c] ?? null);
    const placeholders = EMPLOYEE_COLUMNS.map((_, i) => `$${i + 1}`).join(", ");
    const updateSet = EMPLOYEE_COLUMNS.filter((c) => c !== "employee_code")
      .map((c) => `${c} = EXCLUDED.${c}`)
      .concat("synced_at = now()")
      .join(", ");

    await pool.query(
      `
        INSERT INTO "${config.dbTableName}" (${EMPLOYEE_COLUMNS.join(", ")}, synced_at, created_at)
        VALUES (${placeholders}, now(), now())
        ON CONFLICT (employee_code) DO UPDATE SET ${updateSet};
      `,
      values
    );
  }

  async function reconcileOrphanedRuns(staleAfterMinutes) {
    // A row left at status='running' means the process that owned it never
    // reached completeSyncRun/failSyncRun — killed, OOM, host reboot, a
    // scheduled-task timeout. Left alone it stays "running" forever, which
    // is exactly the stuck-status glitch this closes out before a new run
    // starts, so the next getResumableRun() call can see it as resumable.
    // Only rows older than staleAfterMinutes qualify, so a second invocation
    // that overlaps a still-genuinely-running one doesn't fail it out from
    // under itself.
    const result = await pool.query(
      `
        UPDATE "${config.dbSyncStateTableName}"
        SET run_completed_at = now(), status = 'failed',
            error_message = COALESCE(error_message, 'Orphaned: process ended without recording a result (crash, kill, or host restart).')
        WHERE status = 'running'
          AND run_started_at < now() - ($1 * interval '1 minute')
        RETURNING id;
      `,
      [staleAfterMinutes]
    );
    return result.rows.map((row) => row.id);
  }

  async function startSyncRun({ fromDate, toDate, pageSize }) {
    const result = await pool.query(
      `
        INSERT INTO "${config.dbSyncStateTableName}"
          (run_started_at, from_date, to_date, page_size, status)
        VALUES (now(), $1, $2, $3, 'running')
        RETURNING id;
      `,
      [fromDate, toDate, pageSize]
    );
    return result.rows[0].id;
  }

  async function updateLastRecord(runId, employeeCode) {
    await pool.query(`UPDATE "${config.dbSyncStateTableName}" SET last_employee_code = $2 WHERE id = $1;`, [
      runId,
      employeeCode,
    ]);
  }

  async function updateSyncRunProgress(runId, progress) {
    await pool.query(
      `
        UPDATE "${config.dbSyncStateTableName}"
        SET pages_fetched = $2, last_page_number = $3, employees_count_last_batch = $4,
            total_employee_count = $5, employees_upserted = $6
        WHERE id = $1;
      `,
      [
        runId,
        progress.pagesFetched,
        progress.lastPageNumber,
        progress.employeesCountLastBatch,
        progress.totalEmployeeCount,
        progress.employeesUpserted,
      ]
    );
  }

  async function completeSyncRun(runId, summary) {
    await pool.query(
      `
        UPDATE "${config.dbSyncStateTableName}"
        SET run_completed_at = now(), status = 'success',
            pages_fetched = $2, last_page_number = $3,
            employees_count_last_batch = $4, total_employee_count = $5,
            employees_upserted = $6, summary = $7
        WHERE id = $1;
      `,
      [
        runId,
        summary.pagesFetched,
        summary.lastPageNumber,
        summary.employeesCountLastBatch,
        summary.totalEmployeeCount,
        summary.employeesUpserted,
        JSON.stringify(summary),
      ]
    );
  }

  async function failSyncRun(runId, errorMessage) {
    await pool.query(
      `
        UPDATE "${config.dbSyncStateTableName}"
        SET run_completed_at = now(), status = 'failed', error_message = $2
        WHERE id = $1;
      `,
      [runId, errorMessage]
    );
  }

  async function getLastSuccessfulSyncState() {
    const result = await pool.query(
      `
        SELECT * FROM "${config.dbSyncStateTableName}"
        WHERE status = 'success'
        ORDER BY run_completed_at DESC
        LIMIT 1;
      `
    );
    return result.rows[0] ?? null;
  }

  async function getResumableRun() {
    const result = await pool.query(`
      SELECT * FROM "${config.dbSyncStateTableName}"
      WHERE status = 'failed' AND last_page_number IS NOT NULL
      ORDER BY run_started_at DESC
      LIMIT 1;
    `);
    const failedRun = result.rows[0] ?? null;
    if (!failedRun) return null;

    // A later success can only exist if someone re-ran with a fresh window
    // after this failure without resuming it — don't resume a run that's
    // already been superseded.
    const lastSuccess = await getLastSuccessfulSyncState();
    if (lastSuccess && new Date(lastSuccess.run_completed_at) > new Date(failedRun.run_started_at)) {
      return null;
    }
    return failedRun;
  }

  return {
    connect,
    close,
    ensureSchema,
    upsertEmployee,
    reconcileOrphanedRuns,
    startSyncRun,
    updateLastRecord,
    updateSyncRunProgress,
    completeSyncRun,
    failSyncRun,
    getLastSuccessfulSyncState,
    getResumableRun,
  };
}
