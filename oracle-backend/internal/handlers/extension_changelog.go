package handlers

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type extChangelogEntry struct {
	ID          string   `json:"id"`
	Version     string   `json:"version"`
	Date        string   `json:"date"`
	Summary     string   `json:"summary,omitempty"`
	Changes     []string `json:"changes"`
	Added       []string `json:"added,omitempty"`
	Changed     []string `json:"changed,omitempty"`
	Fixed       []string `json:"fixed,omitempty"`
	IsImportant bool     `json:"isImportant,omitempty"`
}

type extNotificationRule struct {
	ID       string `json:"id"`
	Target   string `json:"target"`
	Priority string `json:"priority"`
	Effect   string `json:"effect"`
}

type extChangelogConfig struct {
	Rules       []extNotificationRule `json:"rules"`
	LastUpdated int64                 `json:"lastUpdated,omitempty"`
}

type extChangelogMeta struct {
	LiveUpdatedAt   int64  `json:"liveUpdatedAt,omitempty"`
	ApplyMode       string `json:"applyMode,omitempty"`
	ContentChecksum string `json:"contentChecksum,omitempty"`
}

type extChangelogResponse struct {
	SchemaVersion string              `json:"schemaVersion"`
	OK            bool                `json:"ok"`
	Entries       []extChangelogEntry `json:"entries"`
	Config        extChangelogConfig  `json:"config"`
	Meta          extChangelogMeta    `json:"meta"`
	UpdateState   string              `json:"updateState,omitempty"`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const (
	extChangelogMaxEntries     = 100
	extChangelogMaxRules       = 20
	extChangelogBodyLimitBytes = 64 << 10 // 64 KiB
)

var validPriorities = map[string]bool{"normal": true, "minor": true, "major": true}
var validEffects = map[string]bool{"none": true, "glow": true, "pulse": true}

func sanitizeExtPriority(v string) string {
	lower := strings.ToLower(strings.TrimSpace(v))
	if validPriorities[lower] {
		return lower
	}
	return "normal"
}

func sanitizeExtEffect(v string) string {
	lower := strings.ToLower(strings.TrimSpace(v))
	if validEffects[lower] {
		return lower
	}
	return "none"
}

func sanitizeExtTarget(v string) string {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" || strings.EqualFold(trimmed, "all") {
		return "all"
	}
	return strings.TrimPrefix(strings.TrimPrefix(trimmed, "v"), "V")
}

func sanitizeGitHubRawMarkdownURL(input string) (string, error) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return githubRawMarkdownURL("user-friendly-changelog.md"), nil
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid markdown URL")
	}
	if !strings.EqualFold(parsed.Scheme, "https") {
		return "", fmt.Errorf("markdown URL must use https")
	}
	host := strings.ToLower(strings.TrimSpace(parsed.Host))
	if host != "raw.githubusercontent.com" {
		return "", fmt.Errorf("only raw.githubusercontent.com URLs are allowed")
	}
	return parsed.String(), nil
}

func parseJSONStringArray(raw string) []string {
	if raw == "" || raw == "[]" {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return []string{}
	}
	return out
}

func marshalJSONStringArray(items []string) string {
	if len(items) == 0 {
		return "[]"
	}
	b, err := json.Marshal(items)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func buildExtChanges(summary string, added, changed, fixed []string) []string {
	out := make([]string, 0, 1+len(added)+len(changed)+len(fixed))
	if summary != "" {
		out = append(out, "Summary: "+summary)
	}
	for _, v := range added {
		out = append(out, "Added: "+v)
	}
	for _, v := range changed {
		out = append(out, "Changed: "+v)
	}
	for _, v := range fixed {
		out = append(out, "Fixed: "+v)
	}
	return out
}

func computeExtContentChecksum(entries []extChangelogEntry, rules []extNotificationRule) string {
	h := sha256.New()
	for _, e := range entries {
		fmt.Fprintf(h, "E|%s|%s|%s|%s|%v\n", e.ID, e.Version, e.Date, e.Summary, e.IsImportant)
		for _, a := range e.Added {
			fmt.Fprintf(h, "+%s\n", a)
		}
		for _, c := range e.Changed {
			fmt.Fprintf(h, "~%s\n", c)
		}
		for _, f := range e.Fixed {
			fmt.Fprintf(h, "!%s\n", f)
		}
	}
	for _, r := range rules {
		fmt.Fprintf(h, "R|%s|%s|%s|%s\n", r.ID, r.Target, r.Priority, r.Effect)
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func readLimitedBody(r *http.Request, limit int64) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("request body exceeds %d bytes", limit)
	}
	return body, nil
}

func writeExtJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store, max-age=0, must-revalidate")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeExtError(w http.ResponseWriter, statusCode int, message string) {
	writeExtJSON(w, statusCode, map[string]any{
		"ok":    false,
		"error": message,
	})
}

// ---------------------------------------------------------------------------
// DB Access — Entries
// ---------------------------------------------------------------------------

func loadExtChangelogEntries(db *sql.DB) ([]extChangelogEntry, error) {
	rows, err := db.Query(`SELECT id, version, date, summary, added_json, changed_json, fixed_json, is_important FROM extension_changelog_entries ORDER BY date DESC, version DESC LIMIT ?`, extChangelogMaxEntries)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []extChangelogEntry
	for rows.Next() {
		var id, version, date, summary, addedJSON, changedJSON, fixedJSON string
		var isImportant int
		if err := rows.Scan(&id, &version, &date, &summary, &addedJSON, &changedJSON, &fixedJSON, &isImportant); err != nil {
			return nil, err
		}
		added := parseJSONStringArray(addedJSON)
		changed := parseJSONStringArray(changedJSON)
		fixed := parseJSONStringArray(fixedJSON)
		entries = append(entries, extChangelogEntry{
			ID:          id,
			Version:     version,
			Date:        date,
			Summary:     summary,
			Changes:     buildExtChanges(summary, added, changed, fixed),
			Added:       added,
			Changed:     changed,
			Fixed:       fixed,
			IsImportant: isImportant == 1,
		})
	}
	if entries == nil {
		entries = []extChangelogEntry{}
	}
	return entries, rows.Err()
}

func upsertExtChangelogEntry(db *sql.DB, entry extChangelogEntry) error {
	now := time.Now().UnixMilli()
	_, err := db.Exec(`INSERT INTO extension_changelog_entries (id, version, date, summary, added_json, changed_json, fixed_json, is_important, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			version=excluded.version,
			date=excluded.date,
			summary=excluded.summary,
			added_json=excluded.added_json,
			changed_json=excluded.changed_json,
			fixed_json=excluded.fixed_json,
			is_important=excluded.is_important,
			updated_at=excluded.updated_at`,
		entry.ID,
		entry.Version,
		entry.Date,
		trimAndLimit(entry.Summary, 600),
		marshalJSONStringArray(entry.Added),
		marshalJSONStringArray(entry.Changed),
		marshalJSONStringArray(entry.Fixed),
		boolToInt(entry.IsImportant),
		now,
		now,
	)
	return err
}

func deleteExtChangelogEntry(db *sql.DB, id string) error {
	_, err := db.Exec(`DELETE FROM extension_changelog_entries WHERE id = ?`, id)
	return err
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

// ---------------------------------------------------------------------------
// DB Access — Notification Rules
// ---------------------------------------------------------------------------

func loadExtNotificationRules(db *sql.DB) ([]extNotificationRule, error) {
	rows, err := db.Query(`SELECT id, target, priority, effect FROM extension_notification_rules ORDER BY rowid LIMIT ?`, extChangelogMaxRules)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []extNotificationRule
	for rows.Next() {
		var id, target, priority, effect string
		if err := rows.Scan(&id, &target, &priority, &effect); err != nil {
			return nil, err
		}
		rules = append(rules, extNotificationRule{
			ID:       id,
			Target:   sanitizeExtTarget(target),
			Priority: sanitizeExtPriority(priority),
			Effect:   sanitizeExtEffect(effect),
		})
	}
	if rules == nil {
		rules = []extNotificationRule{}
	}
	return rules, rows.Err()
}

func upsertExtNotificationRule(db *sql.DB, rule extNotificationRule) error {
	now := time.Now().UnixMilli()
	_, err := db.Exec(`INSERT INTO extension_notification_rules (id, target, priority, effect, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			target=excluded.target,
			priority=excluded.priority,
			effect=excluded.effect,
			updated_at=excluded.updated_at`,
		rule.ID,
		sanitizeExtTarget(rule.Target),
		sanitizeExtPriority(rule.Priority),
		sanitizeExtEffect(rule.Effect),
		now,
		now,
	)
	return err
}

func deleteExtNotificationRule(db *sql.DB, id string) error {
	_, err := db.Exec(`DELETE FROM extension_notification_rules WHERE id = ?`, id)
	return err
}

// ---------------------------------------------------------------------------
// DB Access — Config
// ---------------------------------------------------------------------------

func loadExtChangelogConfig(db *sql.DB) (map[string]string, error) {
	rows, err := db.Query(`SELECT key, value FROM extension_changelog_config`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	config := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		config[key] = value
	}
	return config, rows.Err()
}

func getExtChangelogConfigValue(config map[string]string, key string) string {
	if config == nil {
		return ""
	}
	return strings.TrimSpace(config[key])
}

func parseExtInt64(value string) int64 {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0
	}
	parsed, err := strconv.ParseInt(trimmed, 10, 64)
	if err != nil {
		return 0
	}
	return parsed
}

func setExtChangelogConfigValue(db *sql.DB, key, value string) error {
	now := time.Now().UnixMilli()
	_, err := db.Exec(`INSERT INTO extension_changelog_config (key, value, updated_at)
		VALUES (?, ?, ?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
		key, value, now)
	return err
}

// ---------------------------------------------------------------------------
// GitHub Import
// ---------------------------------------------------------------------------

type extGitHubImportResult struct {
	Imported     int    `json:"imported"`
	Skipped      bool   `json:"skipped"`
	Checksum     string `json:"checksum"`
	LastImportAt int64  `json:"lastImportAt"`
	SourceURL    string `json:"sourceUrl"`
}

func previewExtChangelogFromGitHub(db *sql.DB, markdownURL string) (map[string]any, error) {
	canonicalURL, err := sanitizeGitHubRawMarkdownURL(markdownURL)
	if err != nil {
		return nil, err
	}
	markdown, err := fetchRemoteUserFriendlyChangelogMarkdown(context.Background(), canonicalURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch markdown: %w", err)
	}
	releases := parseUserFriendlyChangelogMarkdown(markdown)
	if len(releases) == 0 {
		return nil, fmt.Errorf("no releases parsed from markdown")
	}

	hash := sha256.Sum256([]byte(markdown))
	checksum := hex.EncodeToString(hash[:])[:16]

	config, _ := loadExtChangelogConfig(db)
	lastChecksum := getExtChangelogConfigValue(config, "last_import_checksum")
	lastImportAt := parseExtInt64(getExtChangelogConfigValue(config, "last_import_at"))
	duplicate := lastChecksum != "" && strings.EqualFold(lastChecksum, checksum)

	preview := make([]map[string]any, 0, 5)
	for i := 0; i < len(releases) && i < 5; i += 1 {
		release := releases[i]
		preview = append(preview, map[string]any{
			"version": release.Version,
			"summary": trimAndLimit(release.Summary, 200),
			"added":   len(release.Added),
			"changed": len(release.Changed),
			"fixed":   len(release.Fixed),
		})
	}

	return map[string]any{
		"ok":            true,
		"url":           canonicalURL,
		"parsedCount":   len(releases),
		"checksum":      checksum,
		"duplicate":     duplicate,
		"lastImportAt":  lastImportAt,
		"preview":       preview,
		"schemaVersion": "1",
	}, nil
}

func importExtChangelogFromGitHub(db *sql.DB, markdownURL string) (extGitHubImportResult, error) {
	canonicalURL, err := sanitizeGitHubRawMarkdownURL(markdownURL)
	if err != nil {
		return extGitHubImportResult{}, err
	}
	markdown, err := fetchRemoteUserFriendlyChangelogMarkdown(context.Background(), canonicalURL)
	if err != nil {
		return extGitHubImportResult{}, fmt.Errorf("failed to fetch markdown: %w", err)
	}

	releases := parseUserFriendlyChangelogMarkdown(markdown)
	if len(releases) == 0 {
		return extGitHubImportResult{}, fmt.Errorf("no releases parsed from markdown")
	}

	hash := sha256.Sum256([]byte(markdown))
	checksum := hex.EncodeToString(hash[:])[:16]
	config, _ := loadExtChangelogConfig(db)
	lastChecksum := getExtChangelogConfigValue(config, "last_import_checksum")
	if lastChecksum != "" && strings.EqualFold(lastChecksum, checksum) {
		lastImportAt := time.Now().UnixMilli()
		_ = setExtChangelogConfigValue(db, "last_import_at", fmt.Sprintf("%d", lastImportAt))
		return extGitHubImportResult{
			Imported:     0,
			Skipped:      true,
			Checksum:     checksum,
			LastImportAt: lastImportAt,
			SourceURL:    canonicalURL,
		}, nil
	}

	tx, err := db.Begin()
	if err != nil {
		return extGitHubImportResult{}, err
	}
	defer func() { _ = tx.Rollback() }()

	now := time.Now().UnixMilli()
	imported := 0
	for _, release := range releases {
		version := trimAndLimit(release.Version, 64)
		if version == "" || release.Summary == "" {
			continue
		}
		id := "github-" + strings.ReplaceAll(strings.ToLower(version), ".", "-")
		date := time.Now().UTC().Format("2006-01-02")

		addedJSON := marshalJSONStringArray(limitStringSlice(release.Added, 20))
		changedJSON := marshalJSONStringArray(limitStringSlice(release.Changed, 20))
		fixedJSON := marshalJSONStringArray(limitStringSlice(release.Fixed, 20))

		_, execErr := tx.Exec(`INSERT INTO extension_changelog_entries (id, version, date, summary, added_json, changed_json, fixed_json, is_important, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				version=excluded.version,
				summary=excluded.summary,
				added_json=excluded.added_json,
				changed_json=excluded.changed_json,
				fixed_json=excluded.fixed_json,
				updated_at=excluded.updated_at`,
			id, version, date,
			trimAndLimit(release.Summary, 600),
			addedJSON, changedJSON, fixedJSON,
			now, now,
		)
		if execErr != nil {
			return extGitHubImportResult{}, execErr
		}
		imported++
	}

	if err := tx.Commit(); err != nil {
		return extGitHubImportResult{}, err
	}

	// Record import metadata.
	h := sha256.New()
	_, _ = h.Write([]byte(markdown))
	_ = setExtChangelogConfigValue(db, "last_import_checksum", hex.EncodeToString(h.Sum(nil))[:16])
	_ = setExtChangelogConfigValue(db, "last_import_at", fmt.Sprintf("%d", time.Now().UnixMilli()))
	_ = setExtChangelogConfigValue(db, "last_import_count", fmt.Sprintf("%d", imported))

	return imported, nil
}

func limitStringSlice(items []string, max int) []string {
	if len(items) <= max {
		return items
	}
	return items[:max]
}

// ---------------------------------------------------------------------------
// Public Endpoint — GET /api/public/extension/changelog
// ---------------------------------------------------------------------------

// ExtensionChangelogPublicHandler serves the extension-compatible changelog
// payload including entries, notification rules, and content checksum.
func ExtensionChangelogPublicHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods: "GET, OPTIONS",
		}) {
			return
		}
		if r.Method != http.MethodGet {
			writeExtError(w, http.StatusMethodNotAllowed, "Only GET is allowed.")
			return
		}

		entries, err := loadExtChangelogEntries(sqliteDB)
		if err != nil {
			logEvent("error", "ext_changelog_load_entries_failed", map[string]interface{}{
				"error": trimAndLimit(err.Error(), 240),
			})
			writeExtError(w, http.StatusInternalServerError, "Failed to load changelog entries.")
			return
		}

		rules, err := loadExtNotificationRules(sqliteDB)
		if err != nil {
			logEvent("error", "ext_changelog_load_rules_failed", map[string]interface{}{
				"error": trimAndLimit(err.Error(), 240),
			})
			writeExtError(w, http.StatusInternalServerError, "Failed to load notification rules.")
			return
		}

		// Sort entries by date DESC, then version DESC.
		sort.Slice(entries, func(i, j int) bool {
			if entries[i].Date == entries[j].Date {
				return entries[i].Version > entries[j].Version
			}
			return entries[i].Date > entries[j].Date
		})

		now := time.Now().UTC().UnixMilli()
		checksum := computeExtContentChecksum(entries, rules)

		// Support ETag conditional requests.
		etag := `"` + checksum + `"`
		w.Header().Set("ETag", etag)
		if match := strings.TrimSpace(r.Header.Get("If-None-Match")); match == etag {
			w.Header().Set("Cache-Control", "no-store, max-age=0, must-revalidate")
			w.WriteHeader(http.StatusNotModified)
			return
		}

		var lastRuleUpdate int64
		var lastEntryUpdate int64
		_ = sqliteDB.QueryRow(`SELECT COALESCE(MAX(updated_at), 0) FROM extension_notification_rules`).Scan(&lastRuleUpdate)
		_ = sqliteDB.QueryRow(`SELECT COALESCE(MAX(updated_at), 0) FROM extension_changelog_entries`).Scan(&lastEntryUpdate)
		lastUpdated := lastRuleUpdate
		if lastEntryUpdate > lastUpdated {
			lastUpdated = lastEntryUpdate
		}
		if lastUpdated == 0 {
			lastUpdated = now
		}

		config, _ := loadExtChangelogConfig(sqliteDB)
		applyMode := config["source"]
		if applyMode == "" {
			applyMode = "oracle"
		}

		writeExtJSON(w, http.StatusOK, extChangelogResponse{
			OK:      true,
			Entries: entries,
			Config: extChangelogConfig{
				Rules:       rules,
				LastUpdated: lastUpdated,
			},
			Meta: extChangelogMeta{
				LiveUpdatedAt:   lastUpdated,
				ApplyMode:       applyMode,
				ContentChecksum: checksum,
			},
		})
	}
}

// ---------------------------------------------------------------------------
// Admin Handlers
// ---------------------------------------------------------------------------

// ExtChangelogEntriesListHandler lists all extension changelog entries.
func ExtChangelogEntriesListHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeExtError(w, http.StatusMethodNotAllowed, "Only GET is allowed.")
			return
		}
		entries, err := loadExtChangelogEntries(sqliteDB)
		if err != nil {
			writeExtError(w, http.StatusInternalServerError, "Failed to load entries.")
			return
		}
		writeExtJSON(w, http.StatusOK, map[string]any{"ok": true, "entries": entries, "count": len(entries)})
	}
}

// ExtChangelogEntriesUpsertHandler creates or updates an extension changelog entry.
func ExtChangelogEntriesUpsertHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeExtError(w, http.StatusMethodNotAllowed, "Only POST is allowed.")
			return
		}
		body, err := readLimitedBody(r, extChangelogBodyLimitBytes)
		if err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid request body.")
			return
		}
		var input struct {
			ID          string   `json:"id"`
			Version     string   `json:"version"`
			Date        string   `json:"date"`
			Summary     string   `json:"summary"`
			Added       []string `json:"added"`
			Changed     []string `json:"changed"`
			Fixed       []string `json:"fixed"`
			IsImportant bool     `json:"isImportant"`
		}
		if err := json.Unmarshal(body, &input); err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid JSON.")
			return
		}
		input.ID = trimAndLimit(strings.TrimSpace(input.ID), 120)
		input.Version = trimAndLimit(strings.TrimSpace(input.Version), 64)
		input.Date = trimAndLimit(strings.TrimSpace(input.Date), 32)
		input.Summary = trimAndLimit(strings.TrimSpace(input.Summary), 600)
		if input.ID == "" || input.Version == "" {
			writeExtError(w, http.StatusBadRequest, "id and version are required.")
			return
		}
		if input.Date == "" {
			input.Date = time.Now().UTC().Format("2006-01-02")
		}

		entry := extChangelogEntry{
			ID:          input.ID,
			Version:     input.Version,
			Date:        input.Date,
			Summary:     input.Summary,
			Added:       limitStringSlice(input.Added, 20),
			Changed:     limitStringSlice(input.Changed, 20),
			Fixed:       limitStringSlice(input.Fixed, 20),
			IsImportant: input.IsImportant,
		}
		if err := upsertExtChangelogEntry(sqliteDB, entry); err != nil {
			logEvent("error", "ext_changelog_upsert_entry_failed", map[string]interface{}{
				"error": trimAndLimit(err.Error(), 240),
			})
			writeExtError(w, http.StatusInternalServerError, "Failed to save entry.")
			return
		}
		writeExtJSON(w, http.StatusOK, map[string]any{"ok": true, "entry": entry})
	}
}

// ExtChangelogEntriesDeleteHandler deletes an extension changelog entry.
func ExtChangelogEntriesDeleteHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeExtError(w, http.StatusMethodNotAllowed, "Only POST is allowed.")
			return
		}
		body, err := readLimitedBody(r, extChangelogBodyLimitBytes)
		if err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid request body.")
			return
		}
		var input struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &input); err != nil || strings.TrimSpace(input.ID) == "" {
			writeExtError(w, http.StatusBadRequest, "id is required.")
			return
		}
		if err := deleteExtChangelogEntry(sqliteDB, strings.TrimSpace(input.ID)); err != nil {
			writeExtError(w, http.StatusInternalServerError, "Failed to delete entry.")
			return
		}
		writeExtJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}

// ExtChangelogRulesListHandler lists all extension notification rules.
func ExtChangelogRulesListHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeExtError(w, http.StatusMethodNotAllowed, "Only GET is allowed.")
			return
		}
		rules, err := loadExtNotificationRules(sqliteDB)
		if err != nil {
			writeExtError(w, http.StatusInternalServerError, "Failed to load rules.")
			return
		}
		writeExtJSON(w, http.StatusOK, map[string]any{"ok": true, "rules": rules, "count": len(rules)})
	}
}

// ExtChangelogRulesUpsertHandler creates or updates a notification rule.
func ExtChangelogRulesUpsertHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeExtError(w, http.StatusMethodNotAllowed, "Only POST is allowed.")
			return
		}
		body, err := readLimitedBody(r, extChangelogBodyLimitBytes)
		if err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid request body.")
			return
		}
		var input struct {
			ID       string `json:"id"`
			Target   string `json:"target"`
			Priority string `json:"priority"`
			Effect   string `json:"effect"`
		}
		if err := json.Unmarshal(body, &input); err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid JSON.")
			return
		}
		input.ID = trimAndLimit(strings.TrimSpace(input.ID), 120)
		if input.ID == "" {
			writeExtError(w, http.StatusBadRequest, "id is required.")
			return
		}
		rule := extNotificationRule{
			ID:       input.ID,
			Target:   sanitizeExtTarget(input.Target),
			Priority: sanitizeExtPriority(input.Priority),
			Effect:   sanitizeExtEffect(input.Effect),
		}
		if err := upsertExtNotificationRule(sqliteDB, rule); err != nil {
			writeExtError(w, http.StatusInternalServerError, "Failed to save rule.")
			return
		}
		writeExtJSON(w, http.StatusOK, map[string]any{"ok": true, "rule": rule})
	}
}

// ExtChangelogRulesDeleteHandler deletes a notification rule.
func ExtChangelogRulesDeleteHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeExtError(w, http.StatusMethodNotAllowed, "Only POST is allowed.")
			return
		}
		body, err := readLimitedBody(r, extChangelogBodyLimitBytes)
		if err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid request body.")
			return
		}
		var input struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &input); err != nil || strings.TrimSpace(input.ID) == "" {
			writeExtError(w, http.StatusBadRequest, "id is required.")
			return
		}
		if err := deleteExtNotificationRule(sqliteDB, strings.TrimSpace(input.ID)); err != nil {
			writeExtError(w, http.StatusInternalServerError, "Failed to delete rule.")
			return
		}
		writeExtJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}

// ExtChangelogConfigHandler returns the extension changelog config.
func ExtChangelogConfigHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeExtError(w, http.StatusMethodNotAllowed, "Only GET is allowed.")
			return
		}
		config, err := loadExtChangelogConfig(sqliteDB)
		if err != nil {
			writeExtError(w, http.StatusInternalServerError, "Failed to load config.")
			return
		}
		writeExtJSON(w, http.StatusOK, map[string]any{"ok": true, "config": config})
	}
}

// ExtChangelogConfigSaveHandler saves a config key/value pair.
func ExtChangelogConfigSaveHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeExtError(w, http.StatusMethodNotAllowed, "Only POST is allowed.")
			return
		}
		body, err := readLimitedBody(r, extChangelogBodyLimitBytes)
		if err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid request body.")
			return
		}
		var input struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}
		if err := json.Unmarshal(body, &input); err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid JSON.")
			return
		}
		input.Key = trimAndLimit(strings.TrimSpace(input.Key), 64)
		input.Value = trimAndLimit(strings.TrimSpace(input.Value), 2048)
		if input.Key == "" {
			writeExtError(w, http.StatusBadRequest, "key is required.")
			return
		}
		if err := setExtChangelogConfigValue(sqliteDB, input.Key, input.Value); err != nil {
			writeExtError(w, http.StatusInternalServerError, "Failed to save config.")
			return
		}
		writeExtJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}

// ExtChangelogImportGitHubHandler imports changelog entries from a GitHub markdown file.
func ExtChangelogImportGitHubHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeExtError(w, http.StatusMethodNotAllowed, "Only POST is allowed.")
			return
		}
		body, err := readLimitedBody(r, extChangelogBodyLimitBytes)
		if err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid request body.")
			return
		}
		var input struct {
			URL string `json:"url"`
		}
		_ = json.Unmarshal(body, &input)

		markdownURL := strings.TrimSpace(input.URL)
		imported, err := importExtChangelogFromGitHub(sqliteDB, markdownURL)
		if err != nil {
			logEvent("error", "ext_changelog_github_import_failed", map[string]interface{}{
				"error": trimAndLimit(err.Error(), 240),
				"url":   trimAndLimit(markdownURL, 240),
			})
			writeExtError(w, http.StatusInternalServerError, "Import failed: "+trimAndLimit(err.Error(), 200))
			return
		}
		writeExtJSON(w, http.StatusOK, map[string]any{"ok": true, "imported": imported})
	}
}

// ExtChangelogBulkImportHandler parses a user-friendly-changelog-style markdown
// block and upserts all parsed entries. Ideal for pasting many releases at once.
func ExtChangelogBulkImportHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeExtError(w, http.StatusMethodNotAllowed, "Only POST is allowed.")
			return
		}
		body, err := readLimitedBody(r, 256<<10) // 256 KiB for bulk
		if err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid or oversized request body.")
			return
		}
		var input struct {
			Markdown string `json:"markdown"`
		}
		if err := json.Unmarshal(body, &input); err != nil {
			writeExtError(w, http.StatusBadRequest, "Invalid JSON.")
			return
		}
		mdText := strings.TrimSpace(input.Markdown)
		if mdText == "" {
			writeExtError(w, http.StatusBadRequest, "markdown field is required.")
			return
		}

		releases := parseUserFriendlyChangelogMarkdown(mdText)
		if len(releases) == 0 {
			writeExtError(w, http.StatusBadRequest, "No releases parsed from the provided markdown.")
			return
		}

		tx, err := sqliteDB.Begin()
		if err != nil {
			writeExtError(w, http.StatusInternalServerError, "Database error.")
			return
		}
		defer func() { _ = tx.Rollback() }()

		now := time.Now().UnixMilli()
		imported := 0
		for _, release := range releases {
			version := trimAndLimit(release.Version, 64)
			if version == "" {
				continue
			}
			id := "v" + strings.ReplaceAll(strings.ToLower(version), ".", "-") + "-release"
			date := time.Now().UTC().Format("2006-01-02")
			summary := trimAndLimit(release.Summary, 600)

			addedJSON := marshalJSONStringArray(limitStringSlice(release.Added, 20))
			changedJSON := marshalJSONStringArray(limitStringSlice(release.Changed, 20))
			fixedJSON := marshalJSONStringArray(limitStringSlice(release.Fixed, 20))

			_, execErr := tx.Exec(`INSERT INTO extension_changelog_entries (id, version, date, summary, added_json, changed_json, fixed_json, is_important, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
					version=excluded.version,
					summary=excluded.summary,
					added_json=excluded.added_json,
					changed_json=excluded.changed_json,
					fixed_json=excluded.fixed_json,
					updated_at=excluded.updated_at`,
				id, version, date,
				summary,
				addedJSON, changedJSON, fixedJSON,
				now, now,
			)
			if execErr != nil {
				writeExtError(w, http.StatusInternalServerError, "Failed to save entry: "+trimAndLimit(execErr.Error(), 120))
				return
			}
			imported++
		}

		if err := tx.Commit(); err != nil {
			writeExtError(w, http.StatusInternalServerError, "Failed to commit bulk import.")
			return
		}

		writeExtJSON(w, http.StatusOK, map[string]any{"ok": true, "imported": imported})
	}
}

