// oracle-backend/internal/db/db.go
package db

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// Init opens the SQLite database and runs all migrations.
func Init(dbPath string) (*sql.DB, error) {
	// Use WAL + busy_timeout via DSN.
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)", dbPath)
	database, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	// WAL mode allows concurrent readers with single writer.
	// Increase pool for better read concurrency.
	database.SetMaxOpenConns(5)
	database.SetMaxIdleConns(3)

	if err := Migrate(database); err != nil {
		_ = database.Close()
		return nil, err
	}

	return database, nil
}

// InitReadOnly opens the SQLite database in read-only mode for restricted query handlers.
func InitReadOnly(dbPath string) (*sql.DB, error) {
	dsn := fmt.Sprintf("file:%s?mode=ro&_pragma=busy_timeout(5000)&_pragma=query_only(1)", dbPath)
	database, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	database.SetMaxOpenConns(3)
	database.SetMaxIdleConns(2)
	if err := database.Ping(); err != nil {
		_ = database.Close()
		return nil, err
	}
	return database, nil
}

// Migrate ensures all tables/indices exist.
func Migrate(db *sql.DB) error {
	stmts := []string{
		`PRAGMA journal_mode = WAL;`,
		`PRAGMA synchronous = FULL;`,
		`PRAGMA busy_timeout = 5000;`,

		// Idempotency + batch metadata.
		`CREATE TABLE IF NOT EXISTS batches (
			batch_id        TEXT PRIMARY KEY,
			generated_at    INTEGER,
			ingested_at     INTEGER,
			time_zone       TEXT,
			events_count    INTEGER,
			downloads_count INTEGER,
			success_count   INTEGER,
			fail_count      INTEGER
		);`,

		// Per-hour aggregates (warehouse grain).
		`CREATE TABLE IF NOT EXISTS downloads_hourly (
			id                   INTEGER PRIMARY KEY AUTOINCREMENT,
			bucket_start         TEXT NOT NULL,
			bucket_end           TEXT NOT NULL,
			total_events         INTEGER NOT NULL DEFAULT 0,
			total_downloads      INTEGER NOT NULL DEFAULT 0,
			total_success        INTEGER NOT NULL DEFAULT 0,
			total_fail           INTEGER NOT NULL DEFAULT 0,
			by_status_json       TEXT,
			by_type_json         TEXT,
			by_browser_json      TEXT,
			by_os_json           TEXT,
			by_ext_ver_json      TEXT,
			by_lang_json         TEXT,
			by_country_json      TEXT,
			by_error_type_json   TEXT,
			batch_id             TEXT NOT NULL,
			FOREIGN KEY(batch_id) REFERENCES batches(batch_id)
		);`,

		`CREATE INDEX IF NOT EXISTS idx_downloads_hourly_bucket_start
			ON downloads_hourly(bucket_start);`,

		// Lifetime totals (fast summary queries).
		`CREATE TABLE IF NOT EXISTS downloads_totals (
			key   TEXT PRIMARY KEY,
			value INTEGER NOT NULL DEFAULT 0
		);`,

		// Public uninstall feedback submissions from the website.
		`CREATE TABLE IF NOT EXISTS website_uninstall_feedback (
			id                 INTEGER PRIMARY KEY AUTOINCREMENT,
			reason             TEXT NOT NULL,
			browser            TEXT NOT NULL,
			extension_version  TEXT NOT NULL,
			source             TEXT NOT NULL,
			notes              TEXT NOT NULL DEFAULT '',
			origin             TEXT NOT NULL DEFAULT '',
			created_at         INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_website_uninstall_feedback_created_at
			ON website_uninstall_feedback(created_at DESC);`,

		`CREATE INDEX IF NOT EXISTS idx_website_uninstall_feedback_reason
			ON website_uninstall_feedback(reason);`,

		// Public website telemetry aggregates (daily counters) + idempotency guard.
		`CREATE TABLE IF NOT EXISTS website_event_daily (
			day_utc      TEXT NOT NULL,
			event_type   TEXT NOT NULL,
			action       TEXT NOT NULL,
			placement    TEXT NOT NULL,
			count        INTEGER NOT NULL DEFAULT 0,
			last_seen_at INTEGER NOT NULL,
			PRIMARY KEY(day_utc, event_type, action, placement)
		);`,

		`CREATE INDEX IF NOT EXISTS idx_website_event_daily_day_utc
			ON website_event_daily(day_utc DESC);`,

		`CREATE TABLE IF NOT EXISTS website_event_idempotency (
			event_id   TEXT PRIMARY KEY,
			created_at INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_website_event_idempotency_created_at
			ON website_event_idempotency(created_at DESC);`,

		// Append-only raw website telemetry events (source of truth for website event writes).
		`CREATE TABLE IF NOT EXISTS website_events_raw (
			id               INTEGER PRIMARY KEY AUTOINCREMENT,
			event_id         TEXT NOT NULL UNIQUE,
			source           TEXT NOT NULL,
			batch_id         TEXT NOT NULL,
			session_id       TEXT NOT NULL,
			page_path        TEXT NOT NULL,
			event_type       TEXT NOT NULL,
			action           TEXT NOT NULL,
			placement        TEXT NOT NULL,
			event_ts_utc     INTEGER,
			generated_at_utc INTEGER,
			attempt          INTEGER NOT NULL DEFAULT 1,
			correlation_id   TEXT NOT NULL DEFAULT '',
			meta_json        TEXT NOT NULL DEFAULT '{}',
			raw_event_json   TEXT NOT NULL DEFAULT '{}',
			ingested_at      INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_website_events_raw_ingested_at
			ON website_events_raw(ingested_at DESC);`,

		`CREATE INDEX IF NOT EXISTS idx_website_events_raw_batch_id
			ON website_events_raw(batch_id);`,

		`CREATE TRIGGER IF NOT EXISTS trg_website_events_raw_no_update
			BEFORE UPDATE ON website_events_raw
			BEGIN
				SELECT RAISE(ABORT, 'website_events_raw is append-only');
			END;`,

		`CREATE TRIGGER IF NOT EXISTS trg_website_events_raw_no_delete
			BEFORE DELETE ON website_events_raw
			BEGIN
				SELECT RAISE(ABORT, 'website_events_raw is append-only');
			END;`,

		// Cloudflare website traffic aggregates ingested into Oracle (hourly grain).
		`CREATE TABLE IF NOT EXISTS website_traffic_hourly (
			hour_utc   TEXT PRIMARY KEY,
			visits     INTEGER NOT NULL DEFAULT 0,
			requests   INTEGER NOT NULL DEFAULT 0,
			fetched_at INTEGER NOT NULL,
			source     TEXT NOT NULL DEFAULT 'cloudflare_graphql'
		);`,

		`CREATE INDEX IF NOT EXISTS idx_website_traffic_hourly_hour_utc
			ON website_traffic_hourly(hour_utc DESC);`,

		// Website sync control plane (Oracle/Cloudflare/Website transfer state).
		`CREATE TABLE IF NOT EXISTS website_sync_control (
			id                         INTEGER PRIMARY KEY CHECK (id = 1),
			one_am_flush_enabled       INTEGER NOT NULL DEFAULT 1,
			override_enabled           INTEGER NOT NULL DEFAULT 0,
			override_downloads         INTEGER NOT NULL DEFAULT 0,
			override_countries_json    TEXT NOT NULL DEFAULT '[]',
			published_downloads        INTEGER NOT NULL DEFAULT 0,
			published_countries_json   TEXT NOT NULL DEFAULT '[]',
			published_source           TEXT NOT NULL DEFAULT 'oracle',
			last_oracle_push_at        INTEGER,
			last_cloudflare_push_at    INTEGER,
			last_website_ingest_at     INTEGER,
			updated_at                 INTEGER NOT NULL
		);`,

		`INSERT OR IGNORE INTO website_sync_control (
			id, one_am_flush_enabled, override_enabled, override_downloads,
			override_countries_json, published_downloads, published_countries_json,
			published_source, last_oracle_push_at, last_cloudflare_push_at,
			last_website_ingest_at, updated_at
		) VALUES (1, 1, 0, 0, '[]', 0, '[]', 'oracle', NULL, NULL, NULL, 0);`,

		`CREATE TABLE IF NOT EXISTS website_sync_batches (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			direction      TEXT NOT NULL,
			batch_id       TEXT NOT NULL,
			triggered_by   TEXT NOT NULL DEFAULT '',
			status         TEXT NOT NULL DEFAULT 'ok',
			details_json   TEXT NOT NULL DEFAULT '{}',
			created_at     INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_website_sync_batches_direction_created
			ON website_sync_batches(direction, created_at DESC);`,

		// DO state history (health + backlog + quota).
		`CREATE TABLE IF NOT EXISTS do_state_snapshots (
			snapshot_id           INTEGER PRIMARY KEY AUTOINCREMENT,
			captured_at           INTEGER NOT NULL,
			source                TEXT NOT NULL,
			raw_json              TEXT,
			total_events          INTEGER,
			total_downloads       INTEGER,
			total_success         INTEGER,
			total_fail            INTEGER,
			pending_events        INTEGER,
			last_event_at         INTEGER,
			last_flush_at         INTEGER,
			requests_today        INTEGER,
			quota_level           TEXT,
			mode_label            TEXT,
			remote_enabled        INTEGER,
			batch_size_suggestion INTEGER,
			max_batch_events      INTEGER
		);`,

		`CREATE INDEX IF NOT EXISTS idx_do_state_snapshots_captured_at
			ON do_state_snapshots(captured_at);`,

		// End-to-end delivery metrics (daily counters + per-delivery latest state).
		`CREATE TABLE IF NOT EXISTS pipeline_stage_daily (
			day_utc    TEXT NOT NULL,
			stage      TEXT NOT NULL,
			count      INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL,
			PRIMARY KEY(day_utc, stage)
		);`,

		`CREATE TABLE IF NOT EXISTS pipeline_delivery_events (
			delivery_id      TEXT PRIMARY KEY,
			batch_id         TEXT NOT NULL,
			created_at       INTEGER NOT NULL,
			updated_at       INTEGER NOT NULL,
			accepted_count   INTEGER NOT NULL DEFAULT 0,
			stored_count     INTEGER NOT NULL DEFAULT 0,
			forwarded_count  INTEGER NOT NULL DEFAULT 0,
			committed_count  INTEGER NOT NULL DEFAULT 0,
			min_seq          INTEGER,
			max_seq          INTEGER,
			status           TEXT NOT NULL DEFAULT 'pending'
		);`,

		`CREATE INDEX IF NOT EXISTS idx_pipeline_delivery_events_updated_at
			ON pipeline_delivery_events(updated_at);`,

		// Structured failure sink for Cloudflare + Oracle ingestion failures.
		`CREATE TABLE IF NOT EXISTS pipeline_failure_logs (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			ts_utc       INTEGER NOT NULL,
			day_utc      TEXT NOT NULL,
			source       TEXT NOT NULL,
			stage        TEXT NOT NULL,
			error_code   TEXT NOT NULL,
			error_detail TEXT NOT NULL,
			sample_count INTEGER NOT NULL DEFAULT 1,
			batch_id     TEXT,
			delivery_id  TEXT
		);`,

		`CREATE INDEX IF NOT EXISTS idx_pipeline_failure_logs_ts
			ON pipeline_failure_logs(ts_utc DESC);`,

		`CREATE INDEX IF NOT EXISTS idx_pipeline_failure_logs_day_stage
			ON pipeline_failure_logs(day_utc, stage);`,

		// IP Tracking for Geo Map feature (required for dashboard's geographical map view)
		// NOTE: This is internal/trusted network traffic. Deploy behind VPN/Tunnel for security.
		// unique_ips format: {"ips": [...], "count": N, "is_truncated": boolean}
		// Legacy rows may contain JSON array of strings (backwards compatible)
		`CREATE TABLE IF NOT EXISTS batch_ips (
			batch_id   TEXT PRIMARY KEY,
			ip_count   INTEGER,
			unique_ips TEXT, -- JSON object: {"ips": [], "count": N, "is_truncated": bool}
			FOREIGN KEY(batch_id) REFERENCES batches(batch_id)
		);`,

		// Raw payload snapshots from edge/worker sync and ingest.
		`CREATE TABLE IF NOT EXISTS cf_snapshots_raw (
			id                 INTEGER PRIMARY KEY AUTOINCREMENT,
			source             TEXT NOT NULL,
			endpoint           TEXT NOT NULL,
			payload_json       TEXT NOT NULL,
			schema_fingerprint TEXT NOT NULL,
			status             TEXT NOT NULL DEFAULT 'ok',
			received_at        INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_cf_snapshots_raw_received_at
			ON cf_snapshots_raw(received_at DESC);`,

		`CREATE INDEX IF NOT EXISTS idx_cf_snapshots_raw_endpoint_received
			ON cf_snapshots_raw(endpoint, received_at DESC);`,

		// Schema drift registry for unknown/new JSON paths.
		`CREATE TABLE IF NOT EXISTS cf_schema_registry (
			json_path     TEXT PRIMARY KEY,
			first_seen_at INTEGER NOT NULL,
			last_seen_at  INTEGER NOT NULL,
			sample_type   TEXT NOT NULL,
			is_projected  INTEGER NOT NULL DEFAULT 0
		);`,

		// Transactional outbox for SQLite-owned writes.
		`CREATE TABLE IF NOT EXISTS ingest_outbox (
			id              INTEGER PRIMARY KEY AUTOINCREMENT,
			event_type      TEXT NOT NULL,
			payload_json    TEXT NOT NULL,
			idempotency_key TEXT NOT NULL UNIQUE,
			status          TEXT NOT NULL DEFAULT 'pending',
			attempts        INTEGER NOT NULL DEFAULT 0,
			last_error      TEXT,
			created_at      INTEGER NOT NULL,
			next_run_at     INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_ingest_outbox_status_next_run
			ON ingest_outbox(status, next_run_at);`,

		// Poison queue for relay failures.
		`CREATE TABLE IF NOT EXISTS outbox_dead_letter (
			id              INTEGER PRIMARY KEY AUTOINCREMENT,
			outbox_id       INTEGER,
			event_type      TEXT NOT NULL,
			payload_json    TEXT NOT NULL,
			idempotency_key TEXT NOT NULL,
			attempts        INTEGER NOT NULL,
			last_error      TEXT NOT NULL,
			failed_at       INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_outbox_dead_letter_failed_at
			ON outbox_dead_letter(failed_at DESC);`,

		// Relay coordination metadata.
		`CREATE TABLE IF NOT EXISTS relay_offsets (
			source      TEXT PRIMARY KEY,
			last_id      INTEGER NOT NULL DEFAULT 0,
			updated_at   INTEGER NOT NULL
		);`,

		`CREATE TABLE IF NOT EXISTS relay_leases (
			lease_key    TEXT PRIMARY KEY,
			owner        TEXT NOT NULL,
			expires_at   INTEGER NOT NULL,
			updated_at   INTEGER NOT NULL
		);`,

		// Server-side feature flags and kill switches.
		`CREATE TABLE IF NOT EXISTS feature_flags (
			name         TEXT PRIMARY KEY,
			enabled      INTEGER NOT NULL DEFAULT 0,
			description  TEXT NOT NULL DEFAULT '',
			updated_at   INTEGER NOT NULL
		);`,

		// Append-only admin audit trail with hash chain.
		`CREATE TABLE IF NOT EXISTS admin_audit_log (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			ts_utc         INTEGER NOT NULL,
			request_id     TEXT NOT NULL,
			correlation_id TEXT NOT NULL,
			user_id        TEXT NOT NULL,
			token_id       TEXT NOT NULL,
			role           TEXT NOT NULL,
			action_type    TEXT NOT NULL,
			resource_type  TEXT NOT NULL,
			resource_id    TEXT NOT NULL,
			result         TEXT NOT NULL,
			error_code     TEXT NOT NULL DEFAULT '',
			payload_json   TEXT NOT NULL,
			prev_hash      TEXT NOT NULL,
			payload_hash   TEXT NOT NULL,
			row_hash       TEXT NOT NULL UNIQUE
		);`,

		`CREATE INDEX IF NOT EXISTS idx_admin_audit_log_ts
			ON admin_audit_log(ts_utc DESC);`,

		`CREATE TRIGGER IF NOT EXISTS trg_admin_audit_no_update
			BEFORE UPDATE ON admin_audit_log
			BEGIN
				SELECT RAISE(ABORT, 'admin_audit_log is append-only');
			END;`,

		`CREATE TRIGGER IF NOT EXISTS trg_admin_audit_no_delete
			BEFORE DELETE ON admin_audit_log
			BEGIN
				SELECT RAISE(ABORT, 'admin_audit_log is append-only');
			END;`,

		// Signed audit checkpoints for hash-chain anchoring.
		`CREATE TABLE IF NOT EXISTS admin_audit_checkpoints (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			audit_log_id  INTEGER NOT NULL UNIQUE,
			row_hash      TEXT NOT NULL,
			hmac_sig      TEXT NOT NULL,
			created_at    INTEGER NOT NULL,
			FOREIGN KEY(audit_log_id) REFERENCES admin_audit_log(id)
		);`,

		`CREATE INDEX IF NOT EXISTS idx_admin_audit_checkpoints_created_at
			ON admin_audit_checkpoints(created_at DESC);`,

		`CREATE TRIGGER IF NOT EXISTS trg_admin_audit_checkpoints_no_update
			BEFORE UPDATE ON admin_audit_checkpoints
			BEGIN
				SELECT RAISE(ABORT, 'admin_audit_checkpoints is append-only');
			END;`,

		`CREATE TRIGGER IF NOT EXISTS trg_admin_audit_checkpoints_no_delete
			BEFORE DELETE ON admin_audit_checkpoints
			BEGIN
				SELECT RAISE(ABORT, 'admin_audit_checkpoints is append-only');
			END;`,

		// Alert sink for observability and dashboard surfacing.
		`CREATE TABLE IF NOT EXISTS system_alerts (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			alert_type     TEXT NOT NULL,
			severity       TEXT NOT NULL,
			message        TEXT NOT NULL,
			status         TEXT NOT NULL DEFAULT 'open',
			payload_json   TEXT NOT NULL,
			created_at     INTEGER NOT NULL,
			updated_at     INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_system_alerts_status_created
			ON system_alerts(status, created_at DESC);`,

		// Backup execution history for reliability observability.
		`CREATE TABLE IF NOT EXISTS backup_runs (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			backup_path   TEXT NOT NULL,
			status        TEXT NOT NULL,
			error_message TEXT NOT NULL DEFAULT '',
			started_at    INTEGER NOT NULL,
			finished_at   INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_backup_runs_started_at
			ON backup_runs(started_at DESC);`,

		// Google Sheets archiver flush history for dashboard "last flush" visibility.
		`CREATE TABLE IF NOT EXISTS sheets_flush_runs (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			flushed_at_utc INTEGER NOT NULL,
			archived_day   TEXT,
			status         TEXT NOT NULL,
			sheet_id       TEXT,
			api_url        TEXT,
			row_json       TEXT,
			summary_json   TEXT,
			meta_json      TEXT,
			error_message  TEXT,
			created_at     INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_sheets_flush_runs_flushed
			ON sheets_flush_runs(flushed_at_utc DESC);`,

		// Storage pressure telemetry snapshots for operator visibility.
		`CREATE TABLE IF NOT EXISTS storage_status_samples (
			id                    INTEGER PRIMARY KEY AUTOINCREMENT,
			captured_at           INTEGER NOT NULL,
			disk_used_percent     REAL NOT NULL,
			disk_total_bytes      INTEGER NOT NULL,
			disk_available_bytes  INTEGER NOT NULL,
			sqlite_db_size_bytes  INTEGER NOT NULL,
			severity              TEXT NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_storage_status_samples_captured_at
			ON storage_status_samples(captured_at DESC);`,

		// Disaster recovery drill tracking for warm-DR readiness checks.
		`CREATE TABLE IF NOT EXISTS dr_drills (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			drill_id       TEXT NOT NULL UNIQUE,
			target_region  TEXT NOT NULL,
			status         TEXT NOT NULL,
			result_json    TEXT NOT NULL,
			started_at     INTEGER NOT NULL,
			finished_at    INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_dr_drills_started_at
			ON dr_drills(started_at DESC);`,

		// Oracle backend operation logs (request-level, server-side observability).
		`CREATE TABLE IF NOT EXISTS oracle_operation_logs (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			ts_utc         INTEGER NOT NULL,
			request_id     TEXT NOT NULL,
			correlation_id TEXT NOT NULL,
			user_id        TEXT NOT NULL,
			token_id       TEXT NOT NULL,
			role           TEXT NOT NULL,
			action_type    TEXT NOT NULL,
			resource_type  TEXT NOT NULL,
			resource_id    TEXT NOT NULL,
			method         TEXT NOT NULL,
			path           TEXT NOT NULL,
			status_code    INTEGER NOT NULL,
			result         TEXT NOT NULL,
			latency_ms     INTEGER NOT NULL,
			error_code     TEXT NOT NULL DEFAULT ''
		);`,

		`CREATE INDEX IF NOT EXISTS idx_oracle_operation_logs_ts
			ON oracle_operation_logs(ts_utc DESC);`,

		`CREATE INDEX IF NOT EXISTS idx_oracle_operation_logs_action_ts
			ON oracle_operation_logs(action_type, ts_utc DESC);`,

		// Generic admin entity store for dashboard-managed records (deployments, versions, designs, emails, etc.).
		`CREATE TABLE IF NOT EXISTS admin_records (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			record_type  TEXT NOT NULL,
			record_key   TEXT NOT NULL,
			data_json    TEXT NOT NULL,
			created_at   INTEGER NOT NULL,
			updated_at   INTEGER NOT NULL,
			UNIQUE(record_type, record_key)
		);`,

		`CREATE INDEX IF NOT EXISTS idx_admin_records_type_updated
			ON admin_records(record_type, updated_at DESC);`,

		// Persisted auth/session state to survive restarts.
		`CREATE TABLE IF NOT EXISTS auth_sessions (
			token        TEXT PRIMARY KEY,
			session_kind TEXT NOT NULL,
			parent_token TEXT NOT NULL DEFAULT '',
			expires_at   INTEGER NOT NULL,
			created_at   INTEGER NOT NULL,
			updated_at   INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_auth_sessions_kind_expiry
			ON auth_sessions(session_kind, expires_at);`,

		`CREATE TABLE IF NOT EXISTS auth_stepup_challenges (
			challenge_id TEXT PRIMARY KEY,
			client_ip    TEXT NOT NULL,
			expires_at   INTEGER NOT NULL,
			created_at   INTEGER NOT NULL,
			updated_at   INTEGER NOT NULL
		);`,

		`CREATE INDEX IF NOT EXISTS idx_auth_stepup_challenges_expiry
			ON auth_stepup_challenges(expires_at);`,

		`CREATE TABLE IF NOT EXISTS auth_rate_limits (
			scope            TEXT NOT NULL,
			client_ip        TEXT NOT NULL,
			attempts         INTEGER NOT NULL,
			first_attempt_at INTEGER NOT NULL,
			blocked_until    INTEGER NOT NULL DEFAULT 0,
			updated_at       INTEGER NOT NULL,
			PRIMARY KEY(scope, client_ip)
		);`,

		`CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_scope_updated
			ON auth_rate_limits(scope, updated_at DESC);`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	if err := seedFeatureFlags(db); err != nil {
		return err
	}

	return nil
}

func seedFeatureFlags(db *sql.DB) error {
	stmts := []struct {
		name    string
		desc    string
		enabled int
	}{
		{name: "feature_sql_console_enabled", desc: "Enable SQL console endpoints", enabled: 0},
		{name: "feature_clear_data_enabled", desc: "Enable destructive clear data endpoints", enabled: 0},
		{name: "feature_sync_enabled", desc: "Enable Cloudflare sync pollers and relays", enabled: 1},
		{name: "feature_creative_hub_enabled", desc: "Enable designs/emails/newsletter hub", enabled: 1},
		{name: "feature_management_hub_enabled", desc: "Enable deployments/versions hub", enabled: 1},
		{name: "feature_postgres_projection_enabled", desc: "Enable SQLite outbox to Postgres projection relay", enabled: 1},
		{name: "feature_postgres_primary_ingest", desc: "Use Postgres as source-of-truth for ingest writes", enabled: 0},
		{name: "feature_postgres_primary_control_plane", desc: "Use Postgres as source-of-truth for control-plane writes", enabled: 0},
		{name: "feature_sqlite_fallback_readonly", desc: "Allow SQLite read fallback while Postgres primary is rolling out", enabled: 1},
		{name: "feature_stepup_enforced", desc: "Require step-up auth for sensitive operations", enabled: 1},
	}

	now := unixMilliNow()
	for _, row := range stmts {
		if _, err := db.Exec(
			`INSERT INTO feature_flags (name, enabled, description, updated_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(name) DO NOTHING`,
			row.name,
			row.enabled,
			row.desc,
			now,
		); err != nil {
			return err
		}
	}
	return nil
}

func unixMilliNow() int64 {
	return time.Now().UnixMilli()
}
