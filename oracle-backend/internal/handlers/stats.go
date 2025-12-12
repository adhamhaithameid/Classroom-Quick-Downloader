// oracle-backend/internal/handlers/stats.go
package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"time"
)

type summaryBatchInfo struct {
	BatchID       string `json:"batchId"`
	GeneratedAt   int64  `json:"generatedAt"`
	IngestedAt    int64  `json:"ingestedAt"`
	EventsCount   int64  `json:"eventsCount"`
	DownloadsCount int64 `json:"downloadsCount"`
	SuccessCount  int64  `json:"successCount"`
	FailCount     int64  `json:"failCount"`
}

type summaryDOStateInfo struct {
	CapturedAt         int64   `json:"capturedAt"`
	TotalEvents        int64   `json:"totalEvents"`
	TotalDownloads     int64   `json:"totalDownloads"`
	TotalSuccess       int64   `json:"totalSuccess"`
	TotalFail          int64   `json:"totalFail"`
	PendingEvents      int64   `json:"pendingEvents"`
	LastEventAt        *int64  `json:"lastEventAt,omitempty"`
	LastFlushAt        *int64  `json:"lastFlushAt,omitempty"`
	RequestsToday      int64   `json:"requestsToday"`
	QuotaLevel         string  `json:"quotaLevel"`
	ModeLabel          string  `json:"modeLabel"`
	RemoteEnabled      bool    `json:"remoteEnabled"`
	BatchSizeSuggestion int64  `json:"batchSizeSuggestion"`
	MaxBatchEvents     int64   `json:"maxBatchEvents"`
}

type summaryResponse struct {
	OK             bool                `json:"ok"`
	GeneratedAt    int64               `json:"generatedAt"`
	Status         string              `json:"status"`
	Flags          []string            `json:"flags"`
	Totals         map[string]int64    `json:"totals"`
	TotalDownloads int64               `json:"totalDownloads"`
	TotalSuccess   int64               `json:"totalSuccess"`
	TotalFail      int64               `json:"totalFail"`
	SuccessRate    float64             `json:"successRate"`
	FailRate       float64             `json:"failRate"`
	LastBatch      *summaryBatchInfo   `json:"lastBatch,omitempty"`
	DOState        *summaryDOStateInfo `json:"doState,omitempty"`
}

// SummaryHandler serves GET /api/stats/summary and (optionally) /stats.
func SummaryHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()

		totals, err := loadTotals(ctx, db)
		if err != nil {
			http.Error(w, "failed to load totals: "+err.Error(), http.StatusInternalServerError)
			return
		}

		totalDownloads := totals["totalDownloads"]
		totalSuccess := totals["totalSuccess"]
		totalFail := totals["totalFail"]

		var successRate, failRate float64
		if totalDownloads > 0 {
			successRate = float64(totalSuccess) / float64(totalDownloads)
			failRate = float64(totalFail) / float64(totalDownloads)
		}

		lastBatch, err := loadLastBatch(ctx, db)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "failed to load batch info: "+err.Error(), http.StatusInternalServerError)
			return
		}

		doSnapshot, err := loadLastDOSnapshot(ctx, db)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "failed to load do state: "+err.Error(), http.StatusInternalServerError)
			return
		}

		status, flags := deriveStatusAndFlags(lastBatch, doSnapshot)

		resp := summaryResponse{
			OK:             true,
			GeneratedAt:    time.Now().UnixMilli(),
			Status:         status,
			Flags:          flags,
			Totals:         totals,
			TotalDownloads: totalDownloads,
			TotalSuccess:   totalSuccess,
			TotalFail:      totalFail,
			SuccessRate:    successRate,
			FailRate:       failRate,
			LastBatch:      lastBatch,
			DOState:        doSnapshot,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func loadTotals(ctx context.Context, db *sql.DB) (map[string]int64, error) {
	rows, err := db.QueryContext(ctx, `SELECT key, value FROM downloads_totals`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]int64)
	for rows.Next() {
		var key string
		var v int64
		if err := rows.Scan(&key, &v); err != nil {
			return nil, err
		}
		out[key] = v
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

func loadLastBatch(ctx context.Context, db *sql.DB) (*summaryBatchInfo, error) {
	row := db.QueryRowContext(ctx, `
		SELECT batch_id, generated_at, ingested_at, events_count,
		       downloads_count, success_count, fail_count
		FROM batches
		ORDER BY ingested_at DESC
		LIMIT 1
	`)
	var b summaryBatchInfo
	if err := row.Scan(
		&b.BatchID,
		&b.GeneratedAt,
		&b.IngestedAt,
		&b.EventsCount,
		&b.DownloadsCount,
		&b.SuccessCount,
		&b.FailCount,
	); err != nil {
		return nil, err
	}
	return &b, nil
}

func loadLastDOSnapshot(ctx context.Context, db *sql.DB) (*summaryDOStateInfo, error) {
	row := db.QueryRowContext(ctx, `
		SELECT
			captured_at,
			total_events,
			total_downloads,
			total_success,
			total_fail,
			pending_events,
			last_event_at,
			last_flush_at,
			requests_today,
			quota_level,
			mode_label,
			remote_enabled,
			batch_size_suggestion,
			max_batch_events
		FROM do_state_snapshots
		ORDER BY captured_at DESC
		LIMIT 1
	`)

	var (
		capturedAt   int64
		totalEvents  sql.NullInt64
		totalDown    sql.NullInt64
		totalSucc    sql.NullInt64
		totalFail    sql.NullInt64
		pending      sql.NullInt64
		lastEventAt  sql.NullInt64
		lastFlushAt  sql.NullInt64
		reqToday     sql.NullInt64
		quotaLevel   sql.NullString
		modeLabel    sql.NullString
		remote       sql.NullInt64
		batchSizeSug sql.NullInt64
		maxBatch     sql.NullInt64
	)

	if err := row.Scan(
		&capturedAt,
		&totalEvents,
		&totalDown,
		&totalSucc,
		&totalFail,
		&pending,
		&lastEventAt,
		&lastFlushAt,
		&reqToday,
		&quotaLevel,
		&modeLabel,
		&remote,
		&batchSizeSug,
		&maxBatch,
	); err != nil {
		return nil, err
	}

	resp := &summaryDOStateInfo{
		CapturedAt:         capturedAt,
		TotalEvents:        totalEvents.Int64,
		TotalDownloads:     totalDown.Int64,
		TotalSuccess:       totalSucc.Int64,
		TotalFail:          totalFail.Int64,
		PendingEvents:      pending.Int64,
		RequestsToday:      reqToday.Int64,
		QuotaLevel:         quotaLevel.String,
		ModeLabel:          modeLabel.String,
		RemoteEnabled:      remote.Valid && remote.Int64 != 0,
		BatchSizeSuggestion: batchSizeSug.Int64,
		MaxBatchEvents:     maxBatch.Int64,
	}

	if lastEventAt.Valid {
		v := lastEventAt.Int64
		resp.LastEventAt = &v
	}
	if lastFlushAt.Valid {
		v := lastFlushAt.Int64
		resp.LastFlushAt = &v
	}

	return resp, nil
}

func deriveStatusAndFlags(lastBatch *summaryBatchInfo, doSnapshot *summaryDOStateInfo) (string, []string) {
	nowMs := time.Now().UnixMilli()
	flags := []string{}

	var lastIngestAt int64
	if lastBatch != nil {
		lastIngestAt = lastBatch.IngestedAt
	}

	status := "unknown"
	if lastIngestAt == 0 {
		status = "cold"
	} else {
		ageMs := nowMs - lastIngestAt
		switch {
		case ageMs < 5*60*1000:
			status = "online"
		case ageMs < 24*60*60*1000:
			status = "stale"
		default:
			status = "idle"
		}
	}

	if doSnapshot != nil {
		if doSnapshot.RemoteEnabled {
			flags = append(flags, "remote_enabled")
		} else {
			flags = append(flags, "remote_disabled")
		}
		if doSnapshot.PendingEvents > 0 {
			flags = append(flags, "backlog")
		}
	}

	if lastBatch == nil {
		flags = append(flags, "no_batches_yet")
	}

	return status, flags
}

type timeSeriesPoint struct {
	Timestamp   string  `json:"timestamp"`   // RFC3339 for hour, YYYY-MM-DD for day
	Downloads   int64   `json:"downloads"`
	Success     int64   `json:"success"`
	Fail        int64   `json:"fail"`
	SuccessRate float64 `json:"successRate"`
}

type timeSeriesResponse struct {
	OK          bool              `json:"ok"`
	Granularity string            `json:"granularity"`
	From        string            `json:"from"`
	To          string            `json:"to"`
	Points      []timeSeriesPoint `json:"points"`
}

// TimeSeriesHandler serves GET /api/stats/timeseries.
func TimeSeriesHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		q := r.URL.Query()

		gran := q.Get("granularity")
		if gran == "" {
			gran = "day" // default
		}

		now := time.Now().UTC()
		fromStr := q.Get("from")
		toStr := q.Get("to")

		var fromTime, toTime time.Time
		var err error

		if fromStr == "" {
			fromTime = now.AddDate(0, 0, -7)
		} else {
			fromTime, err = time.Parse("2006-01-02", fromStr)
			if err != nil {
				http.Error(w, "invalid from (expected YYYY-MM-DD)", http.StatusBadRequest)
				return
			}
		}

		if toStr == "" {
			toTime = now
		} else {
			toTime, err = time.Parse("2006-01-02", toStr)
			if err != nil {
				http.Error(w, "invalid to (expected YYYY-MM-DD)", http.StatusBadRequest)
				return
			}
		}

		if !toTime.After(fromTime) {
			http.Error(w, "to must be after from", http.StatusBadRequest)
			return
		}

		fromIso := fromTime.UTC().Format(time.RFC3339)
		// Add 1 day to include full "to" date.
		toIso := toTime.AddDate(0, 0, 1).UTC().Format(time.RFC3339)

		var points []timeSeriesPoint

		switch gran {
		case "hour":
			points, err = queryTimeSeriesHour(ctx, db, fromIso, toIso)
		case "day":
			points, err = queryTimeSeriesDay(ctx, db, fromIso, toIso)
		default:
			http.Error(w, "invalid granularity (use 'hour' or 'day')", http.StatusBadRequest)
			return
		}

		if err != nil {
			http.Error(w, "failed to load timeseries: "+err.Error(), http.StatusInternalServerError)
			return
		}

		resp := timeSeriesResponse{
			OK:          true,
			Granularity: gran,
			From:        fromTime.Format("2006-01-02"),
			To:          toTime.Format("2006-01-02"),
			Points:      points,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func queryTimeSeriesHour(ctx context.Context, db *sql.DB, fromIso, toIso string) ([]timeSeriesPoint, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT bucket_start, total_downloads, total_success, total_fail
		FROM downloads_hourly
		WHERE bucket_start >= ? AND bucket_start < ?
		ORDER BY bucket_start ASC
	`, fromIso, toIso)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []timeSeriesPoint
	for rows.Next() {
		var ts string
		var d, s, f int64
		if err := rows.Scan(&ts, &d, &s, &f); err != nil {
			return nil, err
		}
		var rate float64
		if d > 0 {
			rate = float64(s) / float64(d)
		}
		out = append(out, timeSeriesPoint{
			Timestamp:   ts,
			Downloads:   d,
			Success:     s,
			Fail:        f,
			SuccessRate: rate,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

func queryTimeSeriesDay(ctx context.Context, db *sql.DB, fromIso, toIso string) ([]timeSeriesPoint, error) {
	// Group by date portion of bucket_start.
	rows, err := db.QueryContext(ctx, `
		SELECT substr(bucket_start, 1, 10) AS day,
		       SUM(total_downloads),
		       SUM(total_success),
		       SUM(total_fail)
		FROM downloads_hourly
		WHERE bucket_start >= ? AND bucket_start < ?
		GROUP BY day
		ORDER BY day ASC
	`, fromIso, toIso)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []timeSeriesPoint
	for rows.Next() {
		var day string
		var d, s, f int64
		if err := rows.Scan(&day, &d, &s, &f); err != nil {
			return nil, err
		}
		var rate float64
		if d > 0 {
			rate = float64(s) / float64(d)
		}
		out = append(out, timeSeriesPoint{
			Timestamp:   day,
			Downloads:   d,
			Success:     s,
			Fail:        f,
			SuccessRate: rate,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

type breakdownValue struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

type breakdownResponse struct {
	OK        bool             `json:"ok"`
	Dimension string           `json:"dimension"`
	From      string           `json:"from"`
	To        string           `json:"to"`
	Values    []breakdownValue `json:"values"`
}

// BreakdownHandler serves GET /api/stats/breakdown.
func BreakdownHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		q := r.URL.Query()

		dim := q.Get("dimension")
		if dim == "" {
			dim = "type"
		}

		now := time.Now().UTC()
		fromStr := q.Get("from")
		toStr := q.Get("to")

		var fromTime, toTime time.Time
		var err error

		if fromStr == "" {
			fromTime = now.AddDate(0, 0, -7)
		} else {
			fromTime, err = time.Parse("2006-01-02", fromStr)
			if err != nil {
				http.Error(w, "invalid from (expected YYYY-MM-DD)", http.StatusBadRequest)
				return
			}
		}

		if toStr == "" {
			toTime = now
		} else {
			toTime, err = time.Parse("2006-01-02", toStr)
			if err != nil {
				http.Error(w, "invalid to (expected YYYY-MM-DD)", http.StatusBadRequest)
				return
			}
		}
		if !toTime.After(fromTime) {
			http.Error(w, "to must be after from", http.StatusBadRequest)
			return
		}

		fromIso := fromTime.UTC().Format(time.RFC3339)
		toIso := toTime.AddDate(0, 0, 1).UTC().Format(time.RFC3339)

		col, err := columnForDimension(dim)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		values, err := queryBreakdown(ctx, db, col, fromIso, toIso)
		if err != nil {
			http.Error(w, "failed to load breakdown: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Sort descending by count.
		sort.Slice(values, func(i, j int) bool {
			return values[i].Count > values[j].Count
		})

		resp := breakdownResponse{
			OK:        true,
			Dimension: dim,
			From:      fromTime.Format("2006-01-02"),
			To:        toTime.Format("2006-01-02"),
			Values:    values,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func columnForDimension(dim string) (string, error) {
	switch dim {
	case "status":
		return "by_status_json", nil
	case "type":
		return "by_type_json", nil
	case "browser":
		return "by_browser_json", nil
	case "os":
		return "by_os_json", nil
	case "country":
		return "by_country_json", nil
	case "lang", "language":
		return "by_lang_json", nil
	case "ext_version", "extVersion":
		return "by_ext_ver_json", nil
	case "error_type", "errorType":
		return "by_error_type_json", nil
	default:
		return "", errors.New("invalid dimension")
	}
}

func queryBreakdown(ctx context.Context, db *sql.DB, jsonColumn, fromIso, toIso string) ([]breakdownValue, error) {
	query := `
		SELECT ` + jsonColumn + `
		FROM downloads_hourly
		WHERE bucket_start >= ? AND bucket_start < ?
	`

	rows, err := db.QueryContext(ctx, query, fromIso, toIso)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	agg := map[string]int64{}
	for rows.Next() {
		var js sql.NullString
		if err := rows.Scan(&js); err != nil {
			return nil, err
		}
		if !js.Valid || js.String == "" {
			continue
		}

		var m map[string]int64
		if err := json.Unmarshal([]byte(js.String), &m); err != nil {
			continue
		}
		for k, v := range m {
			agg[k] += v
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := make([]breakdownValue, 0, len(agg))
	for k, v := range agg {
		out = append(out, breakdownValue{
			Value: k,
			Count: v,
		})
	}

	return out, nil
}

// ---------------------------------------------------------------------------
// Comparison & Export Handlers
// ---------------------------------------------------------------------------

type periodData struct {
	From      string  `json:"from"`
	To        string  `json:"to"`
	Downloads int64   `json:"downloads"`
	Success   int64   `json:"success"`
	Fail      int64   `json:"fail"`
	Rate      float64 `json:"successRate"`
}

type comparisonChange struct {
	Downloads string `json:"downloads"`
	Success   string `json:"success"`
	Fail      string `json:"fail"`
}

type comparisonResponse struct {
	OK      bool             `json:"ok"`
	Period1 periodData       `json:"period1"`
	Period2 periodData       `json:"period2"`
	Change  comparisonChange `json:"change"`
}

// ComparisonHandler serves GET /api/stats/comparison.
// Compares two time periods (e.g., this week vs last week).
func ComparisonHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		q := r.URL.Query()

		// Parse both periods
		from1Str := q.Get("from1")
		to1Str := q.Get("to1")
		from2Str := q.Get("from2")
		to2Str := q.Get("to2")

		if from1Str == "" || to1Str == "" || from2Str == "" || to2Str == "" {
			http.Error(w, "missing from1, to1, from2, to2 params", http.StatusBadRequest)
			return
		}

		from1, err := time.Parse("2006-01-02", from1Str)
		if err != nil {
			http.Error(w, "invalid from1", http.StatusBadRequest)
			return
		}
		to1, err := time.Parse("2006-01-02", to1Str)
		if err != nil {
			http.Error(w, "invalid to1", http.StatusBadRequest)
			return
		}
		from2, err := time.Parse("2006-01-02", from2Str)
		if err != nil {
			http.Error(w, "invalid from2", http.StatusBadRequest)
			return
		}
		to2, err := time.Parse("2006-01-02", to2Str)
		if err != nil {
			http.Error(w, "invalid to2", http.StatusBadRequest)
			return
		}

		// Query both periods
		p1, err := queryPeriodTotals(ctx, db, from1, to1)
		if err != nil {
			http.Error(w, "failed to query period1: "+err.Error(), http.StatusInternalServerError)
			return
		}
		p1.From = from1Str
		p1.To = to1Str

		p2, err := queryPeriodTotals(ctx, db, from2, to2)
		if err != nil {
			http.Error(w, "failed to query period2: "+err.Error(), http.StatusInternalServerError)
			return
		}
		p2.From = from2Str
		p2.To = to2Str

		// Calculate change percentages
		change := comparisonChange{
			Downloads: calcChange(p1.Downloads, p2.Downloads),
			Success:   calcChange(p1.Success, p2.Success),
			Fail:      calcChange(p1.Fail, p2.Fail),
		}

		resp := comparisonResponse{
			OK:      true,
			Period1: p1,
			Period2: p2,
			Change:  change,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func queryPeriodTotals(ctx context.Context, db *sql.DB, from, to time.Time) (periodData, error) {
	fromIso := from.UTC().Format(time.RFC3339)
	toIso := to.AddDate(0, 0, 1).UTC().Format(time.RFC3339)

	row := db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(total_downloads), 0),
		       COALESCE(SUM(total_success), 0),
		       COALESCE(SUM(total_fail), 0)
		FROM downloads_hourly
		WHERE bucket_start >= ? AND bucket_start < ?
	`, fromIso, toIso)

	var d, s, f int64
	if err := row.Scan(&d, &s, &f); err != nil {
		return periodData{}, err
	}

	var rate float64
	if d > 0 {
		rate = float64(s) / float64(d)
	}

	return periodData{
		Downloads: d,
		Success:   s,
		Fail:      f,
		Rate:      rate,
	}, nil
}

func calcChange(old, new int64) string {
	if old == 0 {
		if new == 0 {
			return "0%"
		}
		return "+∞"
	}
	pct := float64(new-old) / float64(old) * 100
	if pct >= 0 {
		return "+" + strconv.FormatFloat(pct, 'f', 1, 64) + "%"
	}
	return strconv.FormatFloat(pct, 'f', 1, 64) + "%"
}

type exportPoint struct {
	Timestamp string `json:"timestamp"`
	Downloads int64  `json:"downloads"`
	Success   int64  `json:"success"`
	Fail      int64  `json:"fail"`
	Rate      string `json:"rate"`
}

// ExportHandler serves GET /api/stats/export.
// Returns CSV or JSON export of time series data.
func ExportHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		q := r.URL.Query()

		format := q.Get("format")
		if format == "" {
			format = "json"
		}

		gran := q.Get("granularity")
		if gran == "" {
			gran = "day"
		}

		now := time.Now().UTC()
		fromStr := q.Get("from")
		toStr := q.Get("to")

		var fromTime, toTime time.Time
		var err error

		if fromStr == "" {
			fromTime = now.AddDate(0, 0, -30)
		} else {
			fromTime, err = time.Parse("2006-01-02", fromStr)
			if err != nil {
				http.Error(w, "invalid from", http.StatusBadRequest)
				return
			}
		}

		if toStr == "" {
			toTime = now
		} else {
			toTime, err = time.Parse("2006-01-02", toStr)
			if err != nil {
				http.Error(w, "invalid to", http.StatusBadRequest)
				return
			}
		}

		fromIso := fromTime.UTC().Format(time.RFC3339)
		toIso := toTime.AddDate(0, 0, 1).UTC().Format(time.RFC3339)

		var points []timeSeriesPoint
		switch gran {
		case "hour":
			points, err = queryTimeSeriesHour(ctx, db, fromIso, toIso)
		case "day":
			points, err = queryTimeSeriesDay(ctx, db, fromIso, toIso)
		default:
			http.Error(w, "invalid granularity", http.StatusBadRequest)
			return
		}

		if err != nil {
			http.Error(w, "failed to query data: "+err.Error(), http.StatusInternalServerError)
			return
		}

		if format == "csv" {
			filename := "cqd_analytics_" + fromTime.Format("2006-01-02") + "_to_" + toTime.Format("2006-01-02") + ".csv"
			w.Header().Set("Content-Type", "text/csv")
			w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")

			// Write CSV header + rows
			_, _ = w.Write([]byte("Timestamp,Downloads,Success,Fail,SuccessRate\n"))
			for _, p := range points {
				rate := "0%"
				if p.Downloads > 0 {
					rate = strconv.FormatFloat(p.SuccessRate*100, 'f', 1, 64) + "%"
				}
				line := p.Timestamp + "," +
					strconv.FormatInt(p.Downloads, 10) + "," +
					strconv.FormatInt(p.Success, 10) + "," +
					strconv.FormatInt(p.Fail, 10) + "," +
					rate + "\n"
				_, _ = w.Write([]byte(line))
			}
			return
		}

		// Default: JSON
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":          true,
			"granularity": gran,
			"from":        fromTime.Format("2006-01-02"),
			"to":          toTime.Format("2006-01-02"),
			"totalRows":   len(points),
			"data":        points,
		})
	}
}