#!/usr/bin/env node
// sync-employees.js — entry point for the ZingHR employee sync.
//
// Run directly: `node sync-employees.js` (or `npm run sync:employees` from
// inside schedulers/). Does ONE full incremental sync pass against ZingHR,
// then exits — there's no internal scheduling loop by design. Trigger it
// from cron, Windows Task Scheduler, a CI scheduled job, or anything else
// that can run a shell command on a timer. See README.md for setup and
// example scheduler configs.
//
// Exit code 0 = success, 1 = failure — the external scheduler should alert
// on non-zero.

import { loadConfig, describeConfig } from "./lib/config.js";
import { createZingHrClient } from "./lib/zinghrClient.js";
import { createImsApiClient } from "./lib/imsApiClient.js";
import { createDb } from "./lib/db.js";
import { mapEmployee } from "./lib/mapEmployee.js";

function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function log(...args) {
  console.log(`[sync-employees ${new Date().toISOString()}]`, ...args);
}

async function runSync(config) {
  const zingHr = createZingHrClient(config);
  const imsApi = createImsApiClient(config);
  const db = await createDb(config);

  await db.connect();
  log("Database connected.");
  await db.ensureSchema();
  log(`Schema ready: "${config.dbTableName}" + "${config.dbSyncStateTableName}".`);

  // A row stuck at status='running' means its process died without ever
  // reaching completeSyncRun/failSyncRun — this is the "shows running but
  // it actually failed" glitch. Close those out as 'failed' before deciding
  // what to do next, so a genuinely dead run never reports itself as live.
  const orphanedIds = await db.reconcileOrphanedRuns(config.syncStaleRunningMinutes);
  if (orphanedIds.length > 0) {
    log(
      `Reconciled ${orphanedIds.length} orphaned run(s) stuck at status='running' ` +
        `(ids: ${orphanedIds.join(", ")}) — process likely crashed or was killed mid-run. Marked as 'failed'.`
    );
  }

  const resumable = await db.getResumableRun();
  let fromDate;
  let toDate;
  let startPage;
  if (resumable) {
    fromDate = resumable.from_date;
    toDate = resumable.to_date;
    startPage = (resumable.last_page_number || 0) + 1;
    log(
      `Resuming failed run #${resumable.id} from page ${startPage} ` +
        `(window ${fromDate} -> ${toDate}, ${resumable.employees_upserted || 0} employees already upserted).`
    );
  } else {
    const lastState = await db.getLastSuccessfulSyncState();
    fromDate = lastState?.to_date || config.syncInitialFromDate;
    toDate = formatDate(new Date());
    startPage = 1;
    log(
      lastState
        ? `Resuming from last successful sync (previous to_date=${lastState.to_date}).`
        : "No prior successful sync found — using SYNC_INITIAL_FROM_DATE."
    );
    log(`Sync window: ${fromDate} -> ${toDate}`);
  }

  // Recorded up front (status='running') so a run that crashes mid-way is
  // still visible in the sync-state history, not just silently missing.
  const runId = await db.startSyncRun({ fromDate, toDate, pageSize: config.syncPageSize });

  try {
    let pageNumber = startPage;
    let lastFetchedPage = startPage - 1;
    // Pages before startPage aren't re-fetched on resume, so this estimates
    // how many employees they covered (assuming full pages) purely to keep
    // the isLastPage math below correct — the empty-page check a few lines
    // down still catches the true end regardless of this being slightly off.
    let cumulativeFetched = config.syncPageSize * (startPage - 1);
    let employeesUpserted = 0;
    let skippedNoCode = 0;
    let totalEmployeeCount = resumable?.total_employee_count || 0;
    let employeesCountLastBatch = 0;

    for (;;) {
      if (pageNumber > config.syncMaxPages) {
        log(
          `WARNING: hit SYNC_MAX_PAGES (${config.syncMaxPages}) before the sync reported itself complete. ` +
            `This run stops here; the next run resumes from the same fromDate (still marked as this run's window) and will pick up where this left off only if TotalEmployeeCount hasn't grown — consider raising SYNC_MAX_PAGES if this happens regularly.`
        );
        break;
      }

      log(`Fetching page ${pageNumber} (pageSize=${config.syncPageSize})…`);
      const page = await zingHr.fetchEmployeePage({
        fromDate,
        toDate,
        pageNumber,
        pageSize: config.syncPageSize,
      });
      lastFetchedPage = pageNumber;

      const employees = page.Employees ?? [];
      employeesCountLastBatch = Number(page.EmployeesCount) || employees.length;
      totalEmployeeCount = Number(page.TotalEmployeeCount) || totalEmployeeCount;

      for (const raw of employees) {
        const row = mapEmployee(raw);
        if (!row) {
          skippedNoCode += 1;
          continue;
        }
        try {
          await db.upsertEmployee(row);
        } catch (err) {
          // Tag the error with exactly which record it died on before it
          // propagates up — this lands in error_message via failSyncRun, so
          // a failed run is traceable to a record, not just a page.
          err.message = `Failed upserting employee_code="${row.employee_code}" (page ${pageNumber}): ${err.message}`;
          throw err;
        }
        employeesUpserted += 1;
        // Persisted per record (not just per page) so a hard crash — one
        // that never reaches the catch below — still leaves an accurate
        // "got through this record" marker on the run.
        await db.updateLastRecord(runId, row.employee_code);
      }

      cumulativeFetched += employees.length;
      log(
        `Page ${pageNumber}: ${employees.length} employees (${employeesUpserted} upserted so far, ` +
          `${cumulativeFetched}/${totalEmployeeCount || "?"} total fetched).`
      );

      // Checkpoint this run's own sync_state row now that every employee on
      // this page has been upserted, so a crash on the *next* page resumes
      // from here instead of from page 1 of this whole window.
      await db.updateSyncRunProgress(runId, {
        pagesFetched: pageNumber,
        lastPageNumber: pageNumber,
        employeesCountLastBatch,
        totalEmployeeCount,
        employeesUpserted,
      });

      const isLastPage =
        employees.length === 0 || (totalEmployeeCount > 0 && cumulativeFetched >= totalEmployeeCount);
      if (isLastPage) break;
      pageNumber += 1;
    }

    const summary = {
      fromDate,
      toDate,
      pagesFetched: lastFetchedPage,
      lastPageNumber: lastFetchedPage,
      employeesCountLastBatch,
      totalEmployeeCount,
      employeesUpserted,
      skippedNoCode,
    };

    await db.completeSyncRun(runId, summary);
    log("Sync completed successfully.", summary);

    // Last step of a successful run: tell IMS the freshly-synced ZingHR
    // data is ready to be pulled into its own tables. This is a separate
    // concern from the data sync itself (already durably recorded as
    // 'success' above), so a failure here doesn't flip sync_state back to
    // 'failed' — doing that would make the next run re-fetch every page for
    // nothing just because this one notification call flaked. It's still
    // surfaced loudly (a non-zero exit code) so the external scheduler's
    // failure alerting catches it.
    let exitCode = 0;
    try {
      const transferResult = await imsApi.transferEmpSync();
      log("pr_Transfer_IMSEmpSync notified IMS successfully.", transferResult);
    } catch (err) {
      log("WARNING: pr_Transfer_IMSEmpSync call failed after the sync itself succeeded:", err.message);
      exitCode = 1;
    }

    await db.close();
    return exitCode;
  } catch (err) {
    log("Sync FAILED:", err.message);
    try {
      await db.failSyncRun(runId, err.message);
    } catch (innerErr) {
      log("Additionally failed to record the failure in sync_state:", innerErr.message);
    }
    try {
      await db.close();
    } catch {
      // already exiting with an error — a close failure here doesn't change the outcome
    }
    return 1;
  }
}

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[sync-employees] Configuration error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  log("Starting sync run. Config:", describeConfig(config));
  try {
    process.exitCode = await runSync(config);
  } catch (err) {
    // Failures before a sync_state row could even be created (e.g. DB
    // unreachable during connect/ensureSchema) — nothing to update in that
    // case, just log and fail.
    console.error(`[sync-employees] Fatal error before sync could start: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
