# IMS Schedulers

Standalone scheduled jobs for IMS. This folder is fully self-contained — its
own `package.json`, its own `.env` — so it can be copied and run on any
machine independently of the frontend app (`src/`). Nothing here is part of
the Vite build.

## Employee sync (`sync-employees.js`)

Pulls employee master data from ZingHR's API and upserts it into a local
database (SQL Server or PostgreSQL). Each run:

1. Reconciles any prior run still stuck at `status='running'` — a process
   that was killed, OOM'd, or lost its host never gets to record its own
   result, so that row would otherwise report "running" forever. Once it's
   older than `SYNC_STALE_RUNNING_MINUTES` (default 120), the next run marks
   it `failed` instead. A row younger than that is left alone, so two
   overlapping invocations can't fail each other's still-live run.
2. Checks for a `failed` run more recent than the last success. If one
   exists and it has page-level checkpoint progress, resumes its exact
   `from_date`/`to_date` window from the next unfetched page — instead of
   re-fetching everything from page 1. Otherwise, looks up the last
   *successful* sync's `to_date` and starts a fresh window from there
   (falling back to `SYNC_INITIAL_FROM_DATE` only on the very first-ever
   run).
3. Pages through ZingHR's `GetEmployeeMasterDetails` API for that date
   range until it's exhausted, checkpointing progress (page number, counts)
   into its own `sync_state` row after every page — so a crash partway
   through leaves an accurate resume point for step 2 on the next run,
   rather than just a summary at the very end. `last_employee_code` is
   updated after every individual record, not just every page — so a
   `failed` row always shows the exact employee it got through up to, and
   if it died mid-upsert, `error_message` names the `employee_code` (and
   page) it was on when it failed.
4. Upserts every employee by `EmployeeCode` (idempotent — re-running the
   same window, or the same page after a resume, never creates duplicates).
5. Records a final summary (counts, page range, status) in the same
   companion `<DB_TABLENAME>_sync_state` row, so you have a full history of
   every run — including every failed attempt leading up to a success.
6. As the very last step of a successful run, calls IMS's `/API/Values`
   REST gateway to run `pr_Transfer_IMSEmpSync` (no params), telling IMS the
   freshly-synced data is ready to be pulled into its own tables. If this
   one call fails after its own retries, the run still exits non-zero (so
   the external scheduler's alerting catches it) but `sync_state` stays
   `success` — the data sync itself genuinely completed; only the
   downstream notification didn't, and it isn't worth re-fetching every
   page over on the next run just for that.

It does **one pass and exits** — it is not a daemon and does not schedule
itself. Point an external scheduler at it.

### Setup

```bash
cd schedulers
npm install
cp .env.example .env
# edit .env with real values — see the comments in .env.example for what each one does
```

### Run it once, manually

```bash
node sync-employees.js
# or
npm run sync:employees
```

Exit code `0` = success, `1` = failure (config error, ZingHR API error, or
DB error — check stdout, it logs each step).

### Scheduling it

**Linux/macOS cron** — e.g. every hour, on the hour:

```
0 * * * * cd /path/to/IMS/schedulers && /usr/bin/node sync-employees.js >> /var/log/ims-employee-sync.log 2>&1
```

**Windows Task Scheduler:**

- Program/script: `node`
- Arguments: `sync-employees.js`
- Start in: `D:\path\to\IMS\schedulers`
- Trigger: whatever cadence you want (hourly/daily/etc.)
- Under Settings, check "If the task fails, restart every..." if you want
  automatic retry on a bad run — the exit code makes this safe (a failed
  run doesn't advance the sync checkpoint).

**Any CI system with a scheduled/cron trigger** (GitHub Actions, Azure
Pipelines, etc.) works the same way: install deps, load the secrets into
`.env` (or equivalent env vars — see below), run `node sync-employees.js`.

### Environment variables

See `.env.example` for the full list with defaults. Nothing here is
optional except the `SYNC_*` execution-tuning vars, which fall back to
sane defaults if omitted.

SQL Server and PostgreSQL connection details are separate var sets
(`SQL_DB_*` / `PG_DB_*`) that can both stay filled in at once — `DBTYPE`
picks which one is actually used, so switching dialects is a one-line
change, not a re-entry of credentials. Only the active dialect's vars are
required; the inactive set can be left blank.

Similarly, `IMS_API_PROJECT` picks which IMS backend the final
`pr_Transfer_IMSEmpSync` call (step 6 above) targets — one of `IMS_LIVE`,
`IMS_PGLIVE`, or `MV_WSLIVE`, the same three the frontend's environment
switcher offers (see `BASE_PROJECTS` in `src/config/runtimeConfig.js`).
`IMS_API_DOMAIN` is the server root the project name gets joined onto;
it's optional and defaults to the frontend's own default domain if left
blank. Make sure `IMS_API_PROJECT` actually matches the backend this
scheduler's DB connection is meant to represent — nothing cross-checks the
two automatically.

`.env` is gitignored at the repo root already (`.env`, `.env.*`, with
`.env.example` explicitly allowed through) — never commit real credentials
or the real `ZINGHR_TOKEN`.

### Database

Both tables (`DB_TABLENAME` and `DB_TABLENAME_sync_state`) are created
automatically on first run if they don't exist — no manual migration step.

`DB_TABLENAME` stores a curated set of frequently-queried fields as real
columns (code, name, email, status, dates, reporting manager) plus a
`raw_json` column holding the *complete* original ZingHR record —
`Attributes`/`Addresses`/`CardCodeDetails` included, exactly as received.
Nothing is ever dropped even if ZingHR adds fields this script doesn't
know about yet; query `raw_json` directly (`JSON_VALUE(...)` on SQL
Server, `raw_json->>'...'` on Postgres) for anything not promoted to its
own column.

`DB_TABLENAME_sync_state` is an append-only log — one row per run, with
its final counts and status. Query it directly for sync history/audit
rather than relying only on the logs.
