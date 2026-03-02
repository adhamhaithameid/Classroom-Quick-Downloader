package handlers

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	model "oracle-backend/internal/model"
)

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

type summaryBatchInfo struct {
	BatchID        string `json:"batchId"`
	GeneratedAt    int64  `json:"generatedAt"`
	IngestedAt     int64  `json:"ingestedAt"`
	EventsCount    int64  `json:"eventsCount"`
	DownloadsCount int64  `json:"downloadsCount"`
	SuccessCount   int64  `json:"successCount"`
	FailCount      int64  `json:"failCount"`
}

type summaryDOStateInfo struct {
	CapturedAt          int64  `json:"capturedAt"`
	TotalEvents         int64  `json:"totalEvents"`
	TotalDownloads      int64  `json:"totalDownloads"`
	TotalSuccess        int64  `json:"totalSuccess"`
	TotalFail           int64  `json:"totalFail"`
	PendingEvents       int64  `json:"pendingEvents"`
	LastEventAt         *int64 `json:"lastEventAt,omitempty"`
	LastFlushAt         *int64 `json:"lastFlushAt,omitempty"`
	RequestsToday       int64  `json:"requestsToday"`
	QuotaLevel          string `json:"quotaLevel"`
	ModeLabel           string `json:"modeLabel"`
	RemoteEnabled       bool   `json:"remoteEnabled"`
	BatchSizeSuggestion int64  `json:"batchSizeSuggestion"`
	MaxBatchEvents      int64  `json:"maxBatchEvents"`
}

// SummaryResponse is the "Master Struct"
// It contains fields for the Dashboard (Status, Flags, Rates)
// AND fields for the Archiver (Browsers, Os, Countries maps)
type summaryResponse struct {
	// --- Dashboard Fields ---
	OK             bool                `json:"ok"`
	GeneratedAt    int64               `json:"generatedAt"`
	GeneratedAtUTC string              `json:"generatedAtUtc,omitempty"`
	WindowStartUTC string              `json:"windowStartUtc,omitempty"`
	WindowEndUTC   string              `json:"windowEndUtc,omitempty"`
	Status         string              `json:"status"`
	Flags          []string            `json:"flags"`
	TotalDownloads int64               `json:"totalDownloads"`
	TotalSuccess   int64               `json:"totalSuccess"`
	TotalFail      int64               `json:"totalFail"`
	SuccessRate    float64             `json:"successRate"`
	FailRate       float64             `json:"failRate"`
	LastBatch      *summaryBatchInfo   `json:"lastBatch,omitempty"`
	DOState        *summaryDOStateInfo `json:"doState,omitempty"`

	// --- Archiver Fields (Detailed Data) ---
	Totals       model.BucketTotals `json:"totals"` // Nested totals object for Archiver
	Browsers     map[string]int64   `json:"browsers"`
	Os           map[string]int64   `json:"os"`
	Countries    map[string]int64   `json:"countries"`
	Languages    map[string]int64   `json:"languages"`
	Versions     map[string]int64   `json:"versions"`
	Types        map[string]int64   `json:"types"`
	ErrorReasons map[string]int64   `json:"errorReasons"`
	TopBrowser   string             `json:"topBrowser"`
	TopOs        string             `json:"topOs"`
	TopCountry   string             `json:"topCountry"`
	TopType      string             `json:"topType"`
}

// ---------------------------------------------------------------------------
// 1. Summary Handler (Merged Logic)
// ---------------------------------------------------------------------------

func SummaryHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		now := time.Now().UTC()

		// Initialize maps
		resp := summaryResponse{
			Browsers:     make(map[string]int64),
			Os:           make(map[string]int64),
			Countries:    make(map[string]int64),
			Languages:    make(map[string]int64),
			Versions:     make(map[string]int64),
			Types:        make(map[string]int64),
			ErrorReasons: make(map[string]int64),
		}

		rangeName := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("range")))
		fromStr := strings.TrimSpace(r.URL.Query().Get("from"))
		toStr := strings.TrimSpace(r.URL.Query().Get("to"))
		fromTime, toTime, useWindow, err := resolveSummaryWindow(ctx, db, rangeName, fromStr, toStr, now)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if useWindow {
			if err := loadWindowTotals(ctx, db, fromTime, toTime, &resp); err != nil {
				http.Error(w, "failed to load window totals: "+err.Error(), http.StatusInternalServerError)
				return
			}
		} else {
			rawTotals, err := loadTotals(ctx, db)
			if err != nil {
				http.Error(w, "failed to load totals: "+err.Error(), http.StatusInternalServerError)
				return
			}
			applyRawTotalsToSummary(rawTotals, &resp)
		}

		// 3. Calculate Rates
		if resp.TotalDownloads > 0 {
			resp.SuccessRate = float64(resp.TotalSuccess) / float64(resp.TotalDownloads)
			resp.FailRate = float64(resp.TotalFail) / float64(resp.TotalDownloads)
		}

		// 4. Calculate Top Stats
		resp.TopBrowser = getTopKey(resp.Browsers)
		resp.TopOs = getTopKey(resp.Os)
		resp.TopCountry = getTopKey(resp.Countries)
		resp.TopType = getTopKey(resp.Types)

		// 5. Load Metadata (Last Batch & DO State) for Dashboard Status
		lastBatch, err := loadLastBatch(ctx, db)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "failed to load batch info: "+err.Error(), http.StatusInternalServerError)
			return
		}
		resp.LastBatch = lastBatch

		doSnapshot, err := loadLastDOSnapshot(ctx, db)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "failed to load do state: "+err.Error(), http.StatusInternalServerError)
			return
		}
		resp.DOState = doSnapshot

		// 6. Derive Status Flags
		status, flags := deriveStatusAndFlags(lastBatch, doSnapshot)
		resp.Status = status
		resp.Flags = flags
		resp.OK = true
		resp.GeneratedAt = now.UnixMilli()
		resp.GeneratedAtUTC = now.Format(time.RFC3339)
		if useWindow {
			meta := buildWindowMeta(now, fromTime, toTime)
			resp.WindowStartUTC = meta.WindowStartUTC
			resp.WindowEndUTC = meta.WindowEndUTC
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// ---------------------------------------------------------------------------
// 2. Time Series Handler
// ---------------------------------------------------------------------------

type timeSeriesPoint struct {
	Timestamp   string  `json:"timestamp"` // RFC3339 for hour, YYYY-MM-DD for day
	Downloads   int64   `json:"downloads"`
	Success     int64   `json:"success"`
	Fail        int64   `json:"fail"`
	SuccessRate float64 `json:"successRate"`
}

type timeSeriesResponse struct {
	OK             bool              `json:"ok"`
	Granularity    string            `json:"granularity"`
	Range          string            `json:"range,omitempty"`
	ExtVersion     string            `json:"extVersion,omitempty"`
	GeneratedAtUTC string            `json:"generatedAtUtc,omitempty"`
	WindowStartUTC string            `json:"windowStartUtc,omitempty"`
	WindowEndUTC   string            `json:"windowEndUtc,omitempty"`
	From           string            `json:"from"`
	To             string            `json:"to"`
	Points         []timeSeriesPoint `json:"points"`
	Buckets        []timeSeriesPoint `json:"buckets"` // Backward-compatible alias for older clients/tests.
}

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
		rangeName := strings.TrimSpace(strings.ToLower(q.Get("range")))
		extVersion := strings.TrimSpace(q.Get("extVersion"))

		var fromTime, toTime time.Time
		var err error

		if rangeName != "" {
			fromTime, toTime, err = resolveRange(ctx, db, rangeName, now)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			if gran == "" || gran == "day" {
				gran = granularityForRange(rangeName)
			}
		} else {
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
		}

		if toTime.Before(fromTime) {
			http.Error(w, "to must be >= from", http.StatusBadRequest)
			return
		}

		fromIso := fromTime.UTC().Format(time.RFC3339)
		toIso := toTime.AddDate(0, 0, 1).UTC().Format(time.RFC3339)

		var points []timeSeriesPoint

		switch gran {
		case "hour":
			points, err = queryTimeSeriesHour(ctx, db, fromIso, toIso, extVersion)
		case "day":
			points, err = queryTimeSeriesDay(ctx, db, fromIso, toIso, extVersion)
		default:
			http.Error(w, "invalid granularity (use 'hour' or 'day')", http.StatusBadRequest)
			return
		}

		if err != nil {
			http.Error(w, "failed to load timeseries: "+err.Error(), http.StatusInternalServerError)
			return
		}

		resp := timeSeriesResponse{
			OK:             true,
			Granularity:    gran,
			Range:          rangeName,
			ExtVersion:     extVersion,
			GeneratedAtUTC: now.Format(time.RFC3339),
			From:           fromTime.Format("2006-01-02"),
			To:             toTime.Format("2006-01-02"),
			Points:         points,
			Buckets:        points,
		}
		meta := buildWindowMeta(now, fromTime, toTime)
		resp.WindowStartUTC = meta.WindowStartUTC
		resp.WindowEndUTC = meta.WindowEndUTC

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// ---------------------------------------------------------------------------
// 3. Breakdown Handler
// ---------------------------------------------------------------------------

type breakdownValue struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

type breakdownResponse struct {
	OK             bool             `json:"ok"`
	Dimension      string           `json:"dimension"`
	GeneratedAtUTC string           `json:"generatedAtUtc,omitempty"`
	WindowStartUTC string           `json:"windowStartUtc,omitempty"`
	WindowEndUTC   string           `json:"windowEndUtc,omitempty"`
	From           string           `json:"from"`
	To             string           `json:"to"`
	Values         []breakdownValue `json:"values"`
}

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
		rangeName := strings.TrimSpace(strings.ToLower(q.Get("range")))

		var fromTime, toTime time.Time
		var err error

		if rangeName != "" {
			fromTime, toTime, err = resolveRange(ctx, db, rangeName, now)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		} else {
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
		}
		if toTime.Before(fromTime) {
			http.Error(w, "to must be >= from", http.StatusBadRequest)
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
			OK:             true,
			Dimension:      dim,
			GeneratedAtUTC: now.Format(time.RFC3339),
			From:           fromTime.Format("2006-01-02"),
			To:             toTime.Format("2006-01-02"),
			Values:         values,
		}
		meta := buildWindowMeta(now, fromTime, toTime)
		resp.WindowStartUTC = meta.WindowStartUTC
		resp.WindowEndUTC = meta.WindowEndUTC

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// ---------------------------------------------------------------------------
// 4. Comparison Handler
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
	OK             bool             `json:"ok"`
	GeneratedAtUTC string           `json:"generatedAtUtc,omitempty"`
	WindowStartUTC string           `json:"windowStartUtc,omitempty"`
	WindowEndUTC   string           `json:"windowEndUtc,omitempty"`
	Period1        periodData       `json:"period1"`
	Period2        periodData       `json:"period2"`
	Change         comparisonChange `json:"change"`
}

type topTodayWindowMeta struct {
	GeneratedAtUTC string `json:"generatedAtUtc"`
	WindowStartUTC string `json:"windowStartUtc"`
	WindowEndUTC   string `json:"windowEndUtc"`
}

type visitorsTimeseriesPoint struct {
	Timestamp         string `json:"timestamp"`
	Visits            int64  `json:"visits"`
	Requests          int64  `json:"requests"`
	UniqueSessions    int64  `json:"uniqueSessions"`
	ReturningSessions int64  `json:"returningSessions"`
}

type visitorsTimeseriesResponse struct {
	OK          bool                      `json:"ok"`
	Range       string                    `json:"range,omitempty"`
	Granularity string                    `json:"granularity"`
	From        string                    `json:"from"`
	To          string                    `json:"to"`
	Points      []visitorsTimeseriesPoint `json:"points"`
	Meta        topTodayWindowMeta        `json:"meta"`
}

type funnelStage struct {
	Key       string  `json:"key"`
	Label     string  `json:"label"`
	Count     int64   `json:"count"`
	FromPrev  float64 `json:"fromPrev"`
	FromStart float64 `json:"fromStart"`
}

type funnelResponse struct {
	OK     bool               `json:"ok"`
	Range  string             `json:"range,omitempty"`
	From   string             `json:"from"`
	To     string             `json:"to"`
	Stages []funnelStage      `json:"stages"`
	Meta   topTodayWindowMeta `json:"meta"`
}

type segmentValue struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

type segmentsResponse struct {
	OK        bool               `json:"ok"`
	Dimension string             `json:"dimension"`
	Range     string             `json:"range,omitempty"`
	From      string             `json:"from"`
	To        string             `json:"to"`
	Values    []segmentValue     `json:"values"`
	Meta      topTodayWindowMeta `json:"meta"`
}

type heatmapCell struct {
	DayOfWeek int   `json:"dayOfWeek"`
	HourUTC   int   `json:"hourUtc"`
	Count     int64 `json:"count"`
}

type heatmapResponse struct {
	OK    bool               `json:"ok"`
	Range string             `json:"range,omitempty"`
	From  string             `json:"from"`
	To    string             `json:"to"`
	Cells []heatmapCell      `json:"cells"`
	Meta  topTodayWindowMeta `json:"meta"`
}

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
			OK:             true,
			GeneratedAtUTC: time.Now().UTC().Format(time.RFC3339),
			Period1:        p1,
			Period2:        p2,
			Change:         change,
		}
		start := from1
		if from2.Before(start) {
			start = from2
		}
		end := to1
		if to2.After(end) {
			end = to2
		}
		meta := buildWindowMeta(time.Now().UTC(), start, end)
		resp.WindowStartUTC = meta.WindowStartUTC
		resp.WindowEndUTC = meta.WindowEndUTC

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// ---------------------------------------------------------------------------
// 5. Export Handler
// ---------------------------------------------------------------------------

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
		rangeName := strings.TrimSpace(strings.ToLower(q.Get("range")))
		extVersion := strings.TrimSpace(q.Get("extVersion"))

		var fromTime, toTime time.Time
		var err error

		if rangeName != "" {
			fromTime, toTime, err = resolveRange(ctx, db, rangeName, now)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		} else {
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
		}

		fromIso := fromTime.UTC().Format(time.RFC3339)
		toIso := toTime.AddDate(0, 0, 1).UTC().Format(time.RFC3339)

		var points []timeSeriesPoint
		switch gran {
		case "hour":
			points, err = queryTimeSeriesHour(ctx, db, fromIso, toIso, extVersion)
		case "day":
			points, err = queryTimeSeriesDay(ctx, db, fromIso, toIso, extVersion)
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

			cw := csv.NewWriter(w)
			if err := cw.Write([]string{"Timestamp", "Downloads", "Success", "Fail", "SuccessRate"}); err != nil {
				http.Error(w, "failed to write csv header", http.StatusInternalServerError)
				return
			}
			for _, p := range points {
				rate := "0%"
				if p.Downloads > 0 {
					rate = strconv.FormatFloat(p.SuccessRate*100, 'f', 1, 64) + "%"
				}
				row := []string{
					p.Timestamp,
					strconv.FormatInt(p.Downloads, 10),
					strconv.FormatInt(p.Success, 10),
					strconv.FormatInt(p.Fail, 10),
					rate,
				}
				if err := cw.Write(row); err != nil {
					http.Error(w, "failed to write csv row", http.StatusInternalServerError)
					return
				}
			}
			cw.Flush()
			if err := cw.Error(); err != nil {
				http.Error(w, "failed to flush csv output", http.StatusInternalServerError)
				return
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

// ---------------------------------------------------------------------------
// 6. Visitors Time Series Handler
// ---------------------------------------------------------------------------

func VisitorsTimeseriesHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		now := time.Now().UTC()
		q := r.URL.Query()

		fromTime, toTime, rangeName, err := resolveRangeWindow(ctx, db, map[string][]string(q), now, 30)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		gran := strings.ToLower(strings.TrimSpace(q.Get("granularity")))
		if gran == "" {
			if rangeName == "today" {
				gran = "hour"
			} else {
				gran = "day"
			}
		}
		if gran != "hour" && gran != "day" {
			http.Error(w, "invalid granularity (use hour|day)", http.StatusBadRequest)
			return
		}

		fromIso := fromTime.UTC().Format(time.RFC3339)
		toIso := toTime.AddDate(0, 0, 1).UTC().Format(time.RFC3339)
		points, err := queryWebsiteTrafficTimeseries(ctx, db, fromIso, toIso, gran)
		if err != nil {
			http.Error(w, "failed to load visitors timeseries: "+err.Error(), http.StatusInternalServerError)
			return
		}

		if gran == "day" {
			uniqueByDay, returningByDay, err := queryWebsiteSessionDayStats(ctx, db, fromTime, toTime)
			if err == nil {
				for idx := range points {
					dayKey := points[idx].Timestamp
					points[idx].UniqueSessions = uniqueByDay[dayKey]
					points[idx].ReturningSessions = returningByDay[dayKey]
				}
			}
		}

		resp := visitorsTimeseriesResponse{
			OK:          true,
			Range:       rangeName,
			Granularity: gran,
			From:        fromTime.Format("2006-01-02"),
			To:          toTime.Format("2006-01-02"),
			Points:      points,
			Meta:        buildWindowMeta(now, fromTime, toTime),
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// ---------------------------------------------------------------------------
// 7. Funnel Handler
// ---------------------------------------------------------------------------

func FunnelHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		now := time.Now().UTC()
		q := r.URL.Query()

		fromTime, toTime, rangeName, err := resolveRangeWindow(ctx, db, map[string][]string(q), now, 30)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		fromIso := fromTime.UTC().Format(time.RFC3339)
		toIso := toTime.AddDate(0, 0, 1).UTC().Format(time.RFC3339)
		fromDay := fromTime.UTC().Format("2006-01-02")
		toDay := toTime.UTC().Format("2006-01-02")

		visits, err := queryWebsiteTrafficWindowTotal(ctx, db, fromIso, toIso, "visits")
		if err != nil {
			http.Error(w, "failed to load funnel visits: "+err.Error(), http.StatusInternalServerError)
			return
		}
		installClicks, err := queryWebsiteEventDailyTotal(ctx, db, fromDay, toDay, "cta", "install_click")
		if err != nil {
			http.Error(w, "failed to load funnel install clicks: "+err.Error(), http.StatusInternalServerError)
			return
		}
		downloadClicks, err := queryWebsiteEventDailyTotal(ctx, db, fromDay, toDay, "cta", "download_click")
		if err != nil {
			http.Error(w, "failed to load funnel download clicks: "+err.Error(), http.StatusInternalServerError)
			return
		}
		actualDownloads, err := queryDownloadsWindowTotal(ctx, db, fromIso, toIso)
		if err != nil {
			http.Error(w, "failed to load funnel download totals: "+err.Error(), http.StatusInternalServerError)
			return
		}
		mapYes, err := queryWebsiteEventDailyTotal(ctx, db, fromDay, toDay, "map", "map_yes")
		if err != nil {
			http.Error(w, "failed to load funnel map yes totals: "+err.Error(), http.StatusInternalServerError)
			return
		}

		stages := []funnelStage{
			{Key: "visits", Label: "Website Visits", Count: visits},
			{Key: "install_clicks", Label: "Install Clicks", Count: installClicks},
			{Key: "download_clicks", Label: "Download Clicks", Count: downloadClicks},
			{Key: "downloads", Label: "Actual Downloads", Count: actualDownloads},
			{Key: "map_yes", Label: "Map Prompt Yes", Count: mapYes},
		}
		startCount := stages[0].Count
		prevCount := int64(0)
		for i := range stages {
			if i == 0 {
				stages[i].FromPrev = 1
				if startCount > 0 {
					stages[i].FromStart = 1
				}
				prevCount = stages[i].Count
				continue
			}
			if prevCount > 0 {
				stages[i].FromPrev = float64(stages[i].Count) / float64(prevCount)
			}
			if startCount > 0 {
				stages[i].FromStart = float64(stages[i].Count) / float64(startCount)
			}
			prevCount = stages[i].Count
		}

		resp := funnelResponse{
			OK:     true,
			Range:  rangeName,
			From:   fromTime.Format("2006-01-02"),
			To:     toTime.Format("2006-01-02"),
			Stages: stages,
			Meta:   buildWindowMeta(now, fromTime, toTime),
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// ---------------------------------------------------------------------------
// 8. Segments Handler
// ---------------------------------------------------------------------------

func SegmentsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		now := time.Now().UTC()
		q := r.URL.Query()

		fromTime, toTime, rangeName, err := resolveRangeWindow(ctx, db, map[string][]string(q), now, 30)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		dim := strings.ToLower(strings.TrimSpace(q.Get("dimension")))
		if dim == "" {
			dim = "browser"
		}

		values := make([]segmentValue, 0, 24)
		fromIso := fromTime.UTC().Format(time.RFC3339)
		toIso := toTime.AddDate(0, 0, 1).UTC().Format(time.RFC3339)
		fromDay := fromTime.UTC().Format("2006-01-02")
		toDay := toTime.UTC().Format("2006-01-02")

		switch dim {
		case "browser", "os", "type", "country", "status", "lang", "language", "version", "extversion", "error":
			column, colErr := columnForDimension(dim)
			if colErr != nil {
				http.Error(w, colErr.Error(), http.StatusBadRequest)
				return
			}
			rows, queryErr := queryBreakdown(ctx, db, column, fromIso, toIso)
			if queryErr != nil {
				http.Error(w, "failed to load segments: "+queryErr.Error(), http.StatusInternalServerError)
				return
			}
			sort.Slice(rows, func(i, j int) bool { return rows[i].Count > rows[j].Count })
			for _, row := range rows {
				values = append(values, segmentValue{Value: row.Value, Count: row.Count})
				if len(values) >= 30 {
					break
				}
			}
		case "action":
			rows, queryErr := queryWebsiteEventGroupBy(ctx, db, "action", fromDay, toDay)
			if queryErr != nil {
				http.Error(w, "failed to load action segments: "+queryErr.Error(), http.StatusInternalServerError)
				return
			}
			values = rows
		case "placement":
			rows, queryErr := queryWebsiteEventGroupBy(ctx, db, "placement", fromDay, toDay)
			if queryErr != nil {
				http.Error(w, "failed to load placement segments: "+queryErr.Error(), http.StatusInternalServerError)
				return
			}
			values = rows
		case "path", "page_path":
			rows, queryErr := queryWebsiteRawGroupBy(ctx, db, "page_path", fromTime, toTime)
			if queryErr != nil {
				http.Error(w, "failed to load path segments: "+queryErr.Error(), http.StatusInternalServerError)
				return
			}
			values = rows
		case "device":
			rows, queryErr := queryWebsiteRawJSONGroupBy(ctx, db, "$.device", fromTime, toTime)
			if queryErr != nil {
				http.Error(w, "failed to load device segments: "+queryErr.Error(), http.StatusInternalServerError)
				return
			}
			values = rows
		case "referrer":
			rows, queryErr := queryWebsiteRawJSONGroupBy(ctx, db, "$.referrer", fromTime, toTime)
			if queryErr != nil {
				http.Error(w, "failed to load referrer segments: "+queryErr.Error(), http.StatusInternalServerError)
				return
			}
			values = rows
		default:
			http.Error(w, "invalid dimension", http.StatusBadRequest)
			return
		}

		resp := segmentsResponse{
			OK:        true,
			Dimension: dim,
			Range:     rangeName,
			From:      fromTime.Format("2006-01-02"),
			To:        toTime.Format("2006-01-02"),
			Values:    values,
			Meta:      buildWindowMeta(now, fromTime, toTime),
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// ---------------------------------------------------------------------------
// 9. Heatmap Handler
// ---------------------------------------------------------------------------

func HeatmapHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		now := time.Now().UTC()
		q := r.URL.Query()

		fromTime, toTime, rangeName, err := resolveRangeWindow(ctx, db, map[string][]string(q), now, 30)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fromIso := fromTime.UTC().Format(time.RFC3339)
		toIso := toTime.AddDate(0, 0, 1).UTC().Format(time.RFC3339)

		// #nosec G701 -- static SQL statement with bound date parameters.
		rows, err := db.QueryContext(
			ctx,
			`SELECT
				CAST(strftime('%w', bucket_start) AS INTEGER) AS dow,
				CAST(strftime('%H', bucket_start) AS INTEGER) AS hour_utc,
				COALESCE(SUM(total_downloads), 0) AS total
			 FROM downloads_hourly
			 WHERE bucket_start >= ? AND bucket_start < ?
			 GROUP BY dow, hour_utc`,
			fromIso,
			toIso,
		)
		if err != nil {
			http.Error(w, "failed to load heatmap data: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		matrix := make(map[int64]int64, 7*24)
		for rows.Next() {
			var dayOfWeek int
			var hourUTC int
			var count int64
			if scanErr := rows.Scan(&dayOfWeek, &hourUTC, &count); scanErr != nil {
				http.Error(w, "failed to decode heatmap data", http.StatusInternalServerError)
				return
			}
			key := int64(dayOfWeek*100 + hourUTC)
			matrix[key] = maxInt64(count, 0)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "failed to read heatmap rows", http.StatusInternalServerError)
			return
		}

		cells := make([]heatmapCell, 0, 7*24)
		for day := 0; day < 7; day += 1 {
			for hour := 0; hour < 24; hour += 1 {
				key := int64(day*100 + hour)
				cells = append(cells, heatmapCell{
					DayOfWeek: day,
					HourUTC:   hour,
					Count:     matrix[key],
				})
			}
		}

		resp := heatmapResponse{
			OK:    true,
			Range: rangeName,
			From:  fromTime.Format("2006-01-02"),
			To:    toTime.Format("2006-01-02"),
			Cells: cells,
			Meta:  buildWindowMeta(now, fromTime, toTime),
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func loadTotals(ctx context.Context, db *sql.DB) (map[string]int64, error) {
	rows, err := db.QueryContext(ctx, `SELECT key, value FROM downloads_totals`) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
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
	return out, rows.Err()
}

func applyRawTotalsToSummary(rawTotals map[string]int64, resp *summaryResponse) {
	for key, val := range rawTotals {
		switch {
		case key == "totalEvents":
			resp.Totals.TotalEvents = val
		case key == "totalDownloads":
			resp.Totals.TotalDownloads = val
			resp.TotalDownloads = val
		case key == "totalSuccess":
			resp.Totals.TotalSuccess = val
			resp.TotalSuccess = val
		case key == "totalFail":
			resp.Totals.TotalFail = val
			resp.TotalFail = val
		case key == "status:cancelled":
			resp.Totals.TotalCancelled = val
		case strings.HasPrefix(key, "browser:"):
			resp.Browsers[strings.TrimPrefix(key, "browser:")] = val
		case strings.HasPrefix(key, "os:"):
			resp.Os[strings.TrimPrefix(key, "os:")] = val
		case strings.HasPrefix(key, "country:"):
			resp.Countries[strings.TrimPrefix(key, "country:")] = val
		case strings.HasPrefix(key, "lang:"):
			resp.Languages[strings.TrimPrefix(key, "lang:")] = val
		case strings.HasPrefix(key, "extVer:"):
			resp.Versions[strings.TrimPrefix(key, "extVer:")] = val
		case strings.HasPrefix(key, "type:"):
			resp.Types[strings.TrimPrefix(key, "type:")] = val
		case strings.HasPrefix(key, "errorType:"):
			resp.ErrorReasons[strings.TrimPrefix(key, "errorType:")] = val
		}
	}
}

func resolveSummaryWindow(ctx context.Context, db *sql.DB, rangeName, fromStr, toStr string, now time.Time) (time.Time, time.Time, bool, error) {
	if rangeName == "" && fromStr == "" && toStr == "" {
		return time.Time{}, time.Time{}, false, nil
	}

	if rangeName != "" {
		fromTime, toTime, err := resolveRange(ctx, db, rangeName, now)
		if err != nil {
			return time.Time{}, time.Time{}, false, err
		}
		return fromTime, toTime, true, nil
	}

	var (
		fromTime time.Time
		toTime   time.Time
		err      error
	)

	if fromStr != "" {
		fromTime, err = time.Parse("2006-01-02", fromStr)
		if err != nil {
			return time.Time{}, time.Time{}, false, errors.New("invalid from (expected YYYY-MM-DD)")
		}
	}
	if toStr != "" {
		toTime, err = time.Parse("2006-01-02", toStr)
		if err != nil {
			return time.Time{}, time.Time{}, false, errors.New("invalid to (expected YYYY-MM-DD)")
		}
	}
	switch {
	case fromStr == "" && toStr != "":
		fromTime = toTime
	case toStr == "" && fromStr != "":
		toTime = fromTime
	}
	if toTime.Before(fromTime) {
		return time.Time{}, time.Time{}, false, errors.New("to must be >= from")
	}
	return fromTime, toTime, true, nil
}

func loadWindowTotals(ctx context.Context, db *sql.DB, fromDate, toDate time.Time, resp *summaryResponse) error {
	fromIso := fromDate.UTC().Format(time.RFC3339)
	toIso := toDate.AddDate(0, 0, 1).UTC().Format(time.RFC3339)

	rows, err := db.QueryContext(ctx, `
		SELECT
			total_events,
			total_downloads,
			total_success,
			total_fail,
			by_status_json,
			by_type_json,
			by_browser_json,
			by_os_json,
			by_ext_ver_json,
			by_lang_json,
			by_country_json,
			by_error_type_json
		FROM downloads_hourly
		WHERE bucket_start >= ? AND bucket_start < ?
	`, fromIso, toIso) // #nosec G701 -- SQL text is static and uses bound parameters for window bounds.
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			totalEvents, totalDownloads, totalSuccess, totalFail int64
			byStatus, byType, byBrowser, byOS                    sql.NullString
			byExtVer, byLang, byCountry, byErrorType             sql.NullString
		)
		if err := rows.Scan(
			&totalEvents,
			&totalDownloads,
			&totalSuccess,
			&totalFail,
			&byStatus,
			&byType,
			&byBrowser,
			&byOS,
			&byExtVer,
			&byLang,
			&byCountry,
			&byErrorType,
		); err != nil {
			return err
		}

		resp.Totals.TotalEvents += totalEvents
		resp.Totals.TotalDownloads += totalDownloads
		resp.Totals.TotalSuccess += totalSuccess
		resp.Totals.TotalFail += totalFail

		resp.TotalDownloads = resp.Totals.TotalDownloads
		resp.TotalSuccess = resp.Totals.TotalSuccess
		resp.TotalFail = resp.Totals.TotalFail

		statusMap := decodeCounterMap(byStatus.String)
		if cancelled, ok := statusMap["cancelled"]; ok {
			resp.Totals.TotalCancelled += cancelled
		}
		if canceled, ok := statusMap["canceled"]; ok {
			resp.Totals.TotalCancelled += canceled
		}
		mergeCounterMap(resp.Types, decodeCounterMap(byType.String))
		mergeCounterMap(resp.Browsers, decodeCounterMap(byBrowser.String))
		mergeCounterMap(resp.Os, decodeCounterMap(byOS.String))
		mergeCounterMap(resp.Versions, decodeCounterMap(byExtVer.String))
		mergeCounterMap(resp.Languages, decodeCounterMap(byLang.String))
		mergeCounterMap(resp.Countries, decodeCounterMap(byCountry.String))
		mergeCounterMap(resp.ErrorReasons, decodeCounterMap(byErrorType.String))
	}
	return rows.Err()
}

func mergeCounterMap(dest, src map[string]int64) {
	for k, v := range src {
		dest[k] += v
	}
}

func decodeCounterMap(raw string) map[string]int64 {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return map[string]int64{}
	}
	var ints map[string]int64
	if err := json.Unmarshal([]byte(raw), &ints); err == nil {
		return ints
	}
	var floats map[string]float64
	if err := json.Unmarshal([]byte(raw), &floats); err == nil {
		out := make(map[string]int64, len(floats))
		for k, v := range floats {
			out[k] = int64(v)
		}
		return out
	}
	return map[string]int64{}
}

func loadLastBatch(ctx context.Context, db *sql.DB) (*summaryBatchInfo, error) {
	// #nosec G701 -- statement is static SQL; no untrusted SQL fragments are concatenated.
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
	// #nosec G701 -- statement is static SQL; no untrusted SQL fragments are concatenated.
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
		CapturedAt:          capturedAt,
		TotalEvents:         totalEvents.Int64,
		TotalDownloads:      totalDown.Int64,
		TotalSuccess:        totalSucc.Int64,
		TotalFail:           totalFail.Int64,
		PendingEvents:       pending.Int64,
		RequestsToday:       reqToday.Int64,
		QuotaLevel:          quotaLevel.String,
		ModeLabel:           modeLabel.String,
		RemoteEnabled:       remote.Valid && remote.Int64 != 0,
		BatchSizeSuggestion: batchSizeSug.Int64,
		MaxBatchEvents:      maxBatch.Int64,
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

func getTopKey(m map[string]int64) string {
	topKey := "unknown"
	var maxVal int64 = -1
	for k, v := range m {
		if v > maxVal {
			maxVal = v
			topKey = k
		}
	}
	return topKey
}

func granularityForRange(rangeName string) string {
	switch rangeName {
	case "today":
		return "hour"
	default:
		return "day"
	}
}

func resolveRange(ctx context.Context, db *sql.DB, rangeName string, now time.Time) (time.Time, time.Time, error) {
	switch rangeName {
	case "today":
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
		return start, start, nil
	case "week":
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -6)
		return start, now, nil
	case "month":
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		return start, now, nil
	case "year":
		start := time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, time.UTC)
		return start, now, nil
	case "all", "all_time", "alltime":
		var minDay sql.NullString
		err := db.QueryRowContext(ctx, `SELECT MIN(substr(bucket_start, 1, 10)) FROM downloads_hourly`).Scan(&minDay) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		if minDay.Valid && strings.TrimSpace(minDay.String) != "" {
			from, parseErr := time.Parse("2006-01-02", minDay.String)
			if parseErr != nil {
				return time.Time{}, time.Time{}, parseErr
			}
			return from, now, nil
		}
		return now, now, nil
	default:
		return time.Time{}, time.Time{}, errors.New("invalid range (use today|week|month|year|all)")
	}
}

func buildWindowMeta(now, fromTime, toTime time.Time) topTodayWindowMeta {
	return topTodayWindowMeta{
		GeneratedAtUTC: now.UTC().Format(time.RFC3339),
		WindowStartUTC: fromTime.UTC().Format(time.RFC3339),
		WindowEndUTC:   toTime.AddDate(0, 0, 1).UTC().Format(time.RFC3339),
	}
}

func resolveRangeWindow(
	ctx context.Context,
	db *sql.DB,
	q map[string][]string,
	now time.Time,
	defaultDays int,
) (fromTime time.Time, toTime time.Time, rangeName string, err error) {
	getFirst := func(key string) string {
		values := q[key]
		if len(values) == 0 {
			return ""
		}
		return strings.TrimSpace(values[0])
	}

	rangeName = strings.ToLower(getFirst("range"))
	fromStr := getFirst("from")
	toStr := getFirst("to")

	if rangeName != "" {
		fromTime, toTime, err = resolveRange(ctx, db, rangeName, now)
		return
	}

	if fromStr == "" {
		fromTime = now.AddDate(0, 0, -defaultDays)
	} else {
		fromTime, err = time.Parse("2006-01-02", fromStr)
		if err != nil {
			err = errors.New("invalid from (expected YYYY-MM-DD)")
			return
		}
	}
	if toStr == "" {
		toTime = now
	} else {
		toTime, err = time.Parse("2006-01-02", toStr)
		if err != nil {
			err = errors.New("invalid to (expected YYYY-MM-DD)")
			return
		}
	}
	if toTime.Before(fromTime) {
		err = errors.New("to must be >= from")
		return
	}
	return
}

func queryTimeSeriesHour(ctx context.Context, db *sql.DB, fromIso, toIso, extVersion string) ([]timeSeriesPoint, error) {
	if strings.TrimSpace(extVersion) != "" {
		return queryTimeSeriesHourByVersion(ctx, db, fromIso, toIso, extVersion)
	}
	// #nosec G701 -- statement is static SQL; time bounds are bound parameters.
	rows, err := db.QueryContext(ctx, `
        SELECT bucket_start,
               COALESCE(SUM(total_downloads), 0),
               COALESCE(SUM(total_success), 0),
               COALESCE(SUM(total_fail), 0)
        FROM downloads_hourly
        WHERE bucket_start >= ? AND bucket_start < ?
        GROUP BY bucket_start
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
	return out, rows.Err()
}

func queryTimeSeriesDay(ctx context.Context, db *sql.DB, fromIso, toIso, extVersion string) ([]timeSeriesPoint, error) {
	if strings.TrimSpace(extVersion) != "" {
		return queryTimeSeriesDayByVersion(ctx, db, fromIso, toIso, extVersion)
	}
	// #nosec G701 -- statement is static SQL; time bounds are bound parameters.
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
	return out, rows.Err()
}

func queryTimeSeriesHourByVersion(ctx context.Context, db *sql.DB, fromIso, toIso, extVersion string) ([]timeSeriesPoint, error) {
	// #nosec G701 -- statement is static SQL; time bounds are bound parameters.
	rows, err := db.QueryContext(ctx, `
		SELECT bucket_start,
		       total_downloads,
		       total_success,
		       total_fail,
		       by_ext_ver_json
		FROM downloads_hourly
		WHERE bucket_start >= ? AND bucket_start < ?
		ORDER BY bucket_start ASC
	`, fromIso, toIso)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type aggRow struct {
		Downloads int64
		Success   int64
		Fail      int64
	}
	agg := make(map[string]*aggRow)
	keys := make([]string, 0, 256)
	seen := make(map[string]struct{})
	for rows.Next() {
		var ts string
		var totalDownloads, totalSuccess, totalFail int64
		var byVersion sql.NullString
		if err := rows.Scan(&ts, &totalDownloads, &totalSuccess, &totalFail, &byVersion); err != nil {
			return nil, err
		}

		versionDownloads := extractVersionCount(byVersion.String, extVersion)
		if versionDownloads <= 0 {
			continue
		}
		if _, ok := agg[ts]; !ok {
			agg[ts] = &aggRow{}
		}
		row := agg[ts]
		row.Downloads += versionDownloads
		versionSuccess, versionFail := proportionalSuccessFail(versionDownloads, totalDownloads, totalSuccess, totalFail)
		row.Success += versionSuccess
		row.Fail += versionFail
		if _, ok := seen[ts]; !ok {
			keys = append(keys, ts)
			seen[ts] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	sort.Strings(keys)
	out := make([]timeSeriesPoint, 0, len(keys))
	for _, ts := range keys {
		row := agg[ts]
		rate := 0.0
		if row.Downloads > 0 {
			rate = float64(row.Success) / float64(row.Downloads)
		}
		out = append(out, timeSeriesPoint{
			Timestamp:   ts,
			Downloads:   row.Downloads,
			Success:     row.Success,
			Fail:        row.Fail,
			SuccessRate: rate,
		})
	}
	return out, nil
}

func queryTimeSeriesDayByVersion(ctx context.Context, db *sql.DB, fromIso, toIso, extVersion string) ([]timeSeriesPoint, error) {
	// #nosec G701 -- statement is static SQL; time bounds are bound parameters.
	rows, err := db.QueryContext(ctx, `
		SELECT substr(bucket_start, 1, 10) AS day,
		       total_downloads,
		       total_success,
		       total_fail,
		       by_ext_ver_json
		FROM downloads_hourly
		WHERE bucket_start >= ? AND bucket_start < ?
		ORDER BY day ASC
	`, fromIso, toIso)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type aggRow struct {
		Downloads int64
		Success   int64
		Fail      int64
	}
	agg := make(map[string]*aggRow)
	keys := make([]string, 0, 256)
	seen := make(map[string]struct{})
	for rows.Next() {
		var day string
		var totalDownloads, totalSuccess, totalFail int64
		var byVersion sql.NullString
		if err := rows.Scan(&day, &totalDownloads, &totalSuccess, &totalFail, &byVersion); err != nil {
			return nil, err
		}

		versionDownloads := extractVersionCount(byVersion.String, extVersion)
		if versionDownloads <= 0 {
			continue
		}
		if _, ok := agg[day]; !ok {
			agg[day] = &aggRow{}
		}
		row := agg[day]
		row.Downloads += versionDownloads
		versionSuccess, versionFail := proportionalSuccessFail(versionDownloads, totalDownloads, totalSuccess, totalFail)
		row.Success += versionSuccess
		row.Fail += versionFail
		if _, ok := seen[day]; !ok {
			keys = append(keys, day)
			seen[day] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	sort.Strings(keys)
	out := make([]timeSeriesPoint, 0, len(keys))
	for _, day := range keys {
		row := agg[day]
		rate := 0.0
		if row.Downloads > 0 {
			rate = float64(row.Success) / float64(row.Downloads)
		}
		out = append(out, timeSeriesPoint{
			Timestamp:   day,
			Downloads:   row.Downloads,
			Success:     row.Success,
			Fail:        row.Fail,
			SuccessRate: rate,
		})
	}
	return out, nil
}

func extractVersionCount(raw string, extVersion string) int64 {
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(extVersion) == "" {
		return 0
	}
	var m map[string]int64
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return 0
	}
	return m[extVersion]
}

func proportionalSplit(versionDownloads, totalDownloads, totalCategory int64) int64 {
	if versionDownloads <= 0 || totalDownloads <= 0 || totalCategory <= 0 {
		return 0
	}
	return int64(float64(versionDownloads)*float64(totalCategory)/float64(totalDownloads) + 0.5)
}

func proportionalSuccessFail(versionDownloads, totalDownloads, totalSuccess, totalFail int64) (int64, int64) {
	if versionDownloads <= 0 {
		return 0, 0
	}
	success := proportionalSplit(versionDownloads, totalDownloads, totalSuccess)
	fail := proportionalSplit(versionDownloads, totalDownloads, totalFail)

	if success < 0 {
		success = 0
	}
	if fail < 0 {
		fail = 0
	}
	if success > versionDownloads {
		success = versionDownloads
	}
	maxFail := versionDownloads - success
	if fail > maxFail {
		fail = maxFail
	}
	return success, fail
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
	case "ext_version", "extVersion", "version":
		return "by_ext_ver_json", nil
	case "error_type", "errorType", "error":
		return "by_error_type_json", nil
	default:
		return "", errors.New("invalid dimension")
	}
}

func queryBreakdown(ctx context.Context, db *sql.DB, jsonColumn, fromIso, toIso string) ([]breakdownValue, error) {
	var query string
	switch jsonColumn {
	case "by_status_json":
		query = `
        SELECT by_status_json
        FROM downloads_hourly
        WHERE bucket_start >= ? AND bucket_start < ?
    `
	case "by_type_json":
		query = `
        SELECT by_type_json
        FROM downloads_hourly
        WHERE bucket_start >= ? AND bucket_start < ?
    `
	case "by_browser_json":
		query = `
        SELECT by_browser_json
        FROM downloads_hourly
        WHERE bucket_start >= ? AND bucket_start < ?
    `
	case "by_os_json":
		query = `
        SELECT by_os_json
        FROM downloads_hourly
        WHERE bucket_start >= ? AND bucket_start < ?
    `
	case "by_country_json":
		query = `
        SELECT by_country_json
        FROM downloads_hourly
        WHERE bucket_start >= ? AND bucket_start < ?
    `
	case "by_lang_json":
		query = `
        SELECT by_lang_json
        FROM downloads_hourly
        WHERE bucket_start >= ? AND bucket_start < ?
    `
	case "by_ext_ver_json":
		query = `
        SELECT by_ext_ver_json
        FROM downloads_hourly
        WHERE bucket_start >= ? AND bucket_start < ?
    `
	case "by_error_type_json":
		query = `
        SELECT by_error_type_json
        FROM downloads_hourly
        WHERE bucket_start >= ? AND bucket_start < ?
    `
	default:
		return nil, errors.New("invalid dimension")
	}
	rows, err := db.QueryContext(ctx, query, fromIso, toIso) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
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

func queryPeriodTotals(ctx context.Context, db *sql.DB, from, to time.Time) (periodData, error) {
	fromIso := from.UTC().Format(time.RFC3339)
	toIso := to.AddDate(0, 0, 1).UTC().Format(time.RFC3339)

	// #nosec G701 -- statement is static SQL; time bounds are bound parameters.
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

func queryWebsiteTrafficTimeseries(
	ctx context.Context,
	db *sql.DB,
	fromIso string,
	toIso string,
	granularity string,
) ([]visitorsTimeseriesPoint, error) {
	var (
		query string
		rows  *sql.Rows
		err   error
	)
	if granularity == "hour" {
		query = `
			SELECT hour_utc, COALESCE(SUM(visits), 0), COALESCE(SUM(requests), 0)
			FROM website_traffic_hourly
			WHERE hour_utc >= ? AND hour_utc < ?
			GROUP BY hour_utc
			ORDER BY hour_utc ASC`
		rows, err = db.QueryContext(ctx, query, fromIso, toIso) // #nosec G701 -- static SQL with bound parameters only.
	} else {
		query = `
			SELECT substr(hour_utc, 1, 10) AS day_utc, COALESCE(SUM(visits), 0), COALESCE(SUM(requests), 0)
			FROM website_traffic_hourly
			WHERE hour_utc >= ? AND hour_utc < ?
			GROUP BY day_utc
			ORDER BY day_utc ASC`
		rows, err = db.QueryContext(ctx, query, fromIso, toIso) // #nosec G701 -- static SQL with bound parameters only.
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]visitorsTimeseriesPoint, 0, 120)
	for rows.Next() {
		var (
			ts       string
			visits   int64
			requests int64
		)
		if scanErr := rows.Scan(&ts, &visits, &requests); scanErr != nil {
			return nil, scanErr
		}
		out = append(out, visitorsTimeseriesPoint{
			Timestamp: ts,
			Visits:    maxInt64(visits, 0),
			Requests:  maxInt64(requests, 0),
		})
	}
	return out, rows.Err()
}

func queryWebsiteSessionDayStats(
	ctx context.Context,
	db *sql.DB,
	fromTime time.Time,
	toTime time.Time,
) (map[string]int64, map[string]int64, error) {
	fromMS := fromTime.UTC().UnixMilli()
	toMS := toTime.AddDate(0, 0, 1).UTC().UnixMilli()

	rows, err := db.QueryContext(
		ctx,
		`WITH daily_sessions AS (
			SELECT
				strftime('%Y-%m-%d', ingested_at / 1000, 'unixepoch') AS day_utc,
				session_id
			FROM website_events_raw
			WHERE ingested_at >= ? AND ingested_at < ? AND session_id <> ''
			GROUP BY day_utc, session_id
		),
		first_seen AS (
			SELECT session_id, MIN(day_utc) AS first_day
			FROM daily_sessions
			GROUP BY session_id
		)
		SELECT
			d.day_utc,
			COUNT(*) AS unique_sessions,
			SUM(CASE WHEN f.first_day < d.day_utc THEN 1 ELSE 0 END) AS returning_sessions
		FROM daily_sessions d
		INNER JOIN first_seen f ON f.session_id = d.session_id
		GROUP BY d.day_utc
		ORDER BY d.day_utc ASC`,
		fromMS,
		toMS,
	) // #nosec G701 -- static SQL with bound parameters only.
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	uniqueByDay := make(map[string]int64, 64)
	returningByDay := make(map[string]int64, 64)
	for rows.Next() {
		var (
			day       string
			unique    int64
			returning int64
		)
		if scanErr := rows.Scan(&day, &unique, &returning); scanErr != nil {
			return nil, nil, scanErr
		}
		day = strings.TrimSpace(day)
		if day == "" {
			continue
		}
		uniqueByDay[day] = maxInt64(unique, 0)
		returningByDay[day] = maxInt64(returning, 0)
	}
	return uniqueByDay, returningByDay, rows.Err()
}

func queryWebsiteTrafficWindowTotal(ctx context.Context, db *sql.DB, fromIso, toIso string, field string) (int64, error) {
	query := `SELECT COALESCE(SUM(visits), 0) FROM website_traffic_hourly WHERE hour_utc >= ? AND hour_utc < ?`
	if field == "requests" {
		query = `SELECT COALESCE(SUM(requests), 0) FROM website_traffic_hourly WHERE hour_utc >= ? AND hour_utc < ?`
	}
	var total int64
	if err := db.QueryRowContext(ctx, query, fromIso, toIso).Scan(&total); err != nil { // #nosec G701 -- SQL text is static and bounds are parameterized.
		return 0, err
	}
	return maxInt64(total, 0), nil
}

func queryWebsiteEventDailyTotal(ctx context.Context, db *sql.DB, fromDay, toDay, eventType, action string) (int64, error) {
	var total int64
	// #nosec G701 -- static SQL statement with bound range/action filters.
	if err := db.QueryRowContext(
		ctx,
		`SELECT COALESCE(SUM(count), 0)
		 FROM website_event_daily
		 WHERE day_utc >= ? AND day_utc <= ? AND event_type = ? AND action = ?`,
		fromDay,
		toDay,
		eventType,
		action,
	).Scan(&total); err != nil { // #nosec G701 -- static SQL with bound params only.
		return 0, err
	}
	return maxInt64(total, 0), nil
}

func queryDownloadsWindowTotal(ctx context.Context, db *sql.DB, fromIso, toIso string) (int64, error) {
	var total int64
	// #nosec G701 -- static SQL statement with bound range parameters.
	if err := db.QueryRowContext(
		ctx,
		`SELECT COALESCE(SUM(total_downloads), 0)
		 FROM downloads_hourly
		 WHERE bucket_start >= ? AND bucket_start < ?`,
		fromIso,
		toIso,
	).Scan(&total); err != nil { // #nosec G701 -- static SQL with bound params only.
		return 0, err
	}
	return maxInt64(total, 0), nil
}

func queryWebsiteEventGroupBy(
	ctx context.Context,
	db *sql.DB,
	groupBy string,
	fromDay string,
	toDay string,
) ([]segmentValue, error) {
	query := `SELECT action, COALESCE(SUM(count), 0) AS total
		FROM website_event_daily
		WHERE day_utc >= ? AND day_utc <= ?
		GROUP BY action
		ORDER BY total DESC, action ASC
		LIMIT 30`
	if groupBy == "placement" {
		query = `SELECT placement, COALESCE(SUM(count), 0) AS total
			FROM website_event_daily
			WHERE day_utc >= ? AND day_utc <= ?
			GROUP BY placement
			ORDER BY total DESC, placement ASC
			LIMIT 30`
	}
	rows, err := db.QueryContext(ctx, query, fromDay, toDay) // #nosec G701 -- SQL text is static and date values are bound.
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	values := make([]segmentValue, 0, 30)
	for rows.Next() {
		var value sql.NullString
		var count int64
		if scanErr := rows.Scan(&value, &count); scanErr != nil {
			return nil, scanErr
		}
		label := strings.TrimSpace(value.String)
		if label == "" {
			label = "unknown"
		}
		values = append(values, segmentValue{
			Value: label,
			Count: maxInt64(count, 0),
		})
	}
	return values, rows.Err()
}

func queryWebsiteRawGroupBy(
	ctx context.Context,
	db *sql.DB,
	column string,
	fromTime time.Time,
	toTime time.Time,
) ([]segmentValue, error) {
	if strings.ToLower(strings.TrimSpace(column)) != "page_path" {
		return nil, errors.New("invalid raw group-by column")
	}
	fromMS := fromTime.UTC().UnixMilli()
	toMS := toTime.AddDate(0, 0, 1).UTC().UnixMilli()
	query := `SELECT page_path, COUNT(*) AS total
		FROM website_events_raw
		WHERE ingested_at >= ? AND ingested_at < ?
		GROUP BY page_path
		ORDER BY total DESC, page_path ASC
		LIMIT 30`
	rows, err := db.QueryContext(ctx, query, fromMS, toMS) // #nosec G701 -- SQL text is static and bounds are parameterized.
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	values := make([]segmentValue, 0, 30)
	for rows.Next() {
		var value sql.NullString
		var count int64
		if scanErr := rows.Scan(&value, &count); scanErr != nil {
			return nil, scanErr
		}
		label := strings.TrimSpace(value.String)
		if label == "" {
			label = "/"
		}
		values = append(values, segmentValue{
			Value: label,
			Count: maxInt64(count, 0),
		})
	}
	return values, rows.Err()
}

func queryWebsiteRawJSONGroupBy(
	ctx context.Context,
	db *sql.DB,
	jsonPath string,
	fromTime time.Time,
	toTime time.Time,
) ([]segmentValue, error) {
	path := strings.TrimSpace(jsonPath)
	if path != "$.device" && path != "$.referrer" {
		return nil, errors.New("invalid json path")
	}
	fromMS := fromTime.UTC().UnixMilli()
	toMS := toTime.AddDate(0, 0, 1).UTC().UnixMilli()
	rows, err := db.QueryContext(
		ctx,
		`SELECT
			COALESCE(NULLIF(TRIM(CAST(json_extract(meta_json, ?) AS TEXT)), ''), 'unknown') AS value,
			COUNT(*) AS total
		 FROM website_events_raw
		 WHERE ingested_at >= ? AND ingested_at < ?
		 GROUP BY value
		 ORDER BY total DESC, value ASC
		 LIMIT 30`,
		path,
		fromMS,
		toMS,
	) // #nosec G701 -- SQL text is static and path/time args are bound parameters.
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	values := make([]segmentValue, 0, 30)
	for rows.Next() {
		var value sql.NullString
		var count int64
		if scanErr := rows.Scan(&value, &count); scanErr != nil {
			return nil, scanErr
		}
		label := strings.TrimSpace(value.String)
		if label == "" {
			label = "unknown"
		}
		values = append(values, segmentValue{
			Value: label,
			Count: maxInt64(count, 0),
		})
	}
	return values, rows.Err()
}
