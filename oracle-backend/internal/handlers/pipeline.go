package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

type pipelineStageDailyPoint struct {
	DayUTC string `json:"dayUtc"`
	Stage  string `json:"stage"`
	Count  int64  `json:"count"`
}

type pipelineDeliveryItem struct {
	DeliveryID     string   `json:"deliveryId"`
	BatchID        string   `json:"batchId"`
	CreatedAt      int64    `json:"createdAt"`
	UpdatedAt      int64    `json:"updatedAt"`
	AcceptedCount  int64    `json:"acceptedCount"`
	StoredCount    int64    `json:"storedCount"`
	ForwardedCount int64    `json:"forwardedCount"`
	CommittedCount int64    `json:"committedCount"`
	Status         string   `json:"status"`
	MinSeq         *int64   `json:"minSeq,omitempty"`
	MaxSeq         *int64   `json:"maxSeq,omitempty"`
	MissingStages  []string `json:"missingStages,omitempty"`
}

type pipelineMetricsResponse struct {
	OK            bool                      `json:"ok"`
	GeneratedAt   int64                     `json:"generatedAt"`
	Totals        map[string]int64          `json:"totals"`
	Gaps          map[string]int64          `json:"gaps"`
	Daily         []pipelineStageDailyPoint `json:"daily"`
	Recent        []pipelineDeliveryItem    `json:"recentDeliveries"`
	WeeklySummary map[string]int64          `json:"weeklySummary"`
}

type pipelineFailureLogItem struct {
	ID          int64  `json:"id"`
	TSUTC       int64  `json:"tsUtc"`
	DayUTC      string `json:"dayUtc"`
	Source      string `json:"source"`
	Stage       string `json:"stage"`
	ErrorCode   string `json:"errorCode"`
	ErrorDetail string `json:"errorDetail"`
	SampleCount int64  `json:"sampleCount"`
	BatchID     string `json:"batchId,omitempty"`
	DeliveryID  string `json:"deliveryId,omitempty"`
}

type pipelineFailureSummaryItem struct {
	DayUTC      string `json:"dayUtc"`
	Stage       string `json:"stage"`
	ErrorCode   string `json:"errorCode"`
	Events      int64  `json:"events"`
	Occurrences int64  `json:"occurrences"`
}

type pipelineFailuresResponse struct {
	OK          bool                         `json:"ok"`
	GeneratedAt int64                        `json:"generatedAt"`
	Recent      []pipelineFailureLogItem     `json:"recent"`
	Daily       []pipelineFailureSummaryItem `json:"daily"`
}

func parsePositiveInt(raw string, fallback int, min int, max int) int {
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func PipelineMetricsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		now := time.Now().UTC()
		days := parsePositiveInt(r.URL.Query().Get("days"), 14, 1, 90)
		limit := parsePositiveInt(r.URL.Query().Get("limit"), 100, 1, 500)
		dayFloor := now.AddDate(0, 0, -days).Format("2006-01-02")

		resp := pipelineMetricsResponse{
			OK:          true,
			GeneratedAt: now.UnixMilli(),
			Totals: map[string]int64{
				"accepted":  0,
				"stored":    0,
				"forwarded": 0,
				"committed": 0,
			},
			Gaps: map[string]int64{
				"accepted_minus_stored":     0,
				"stored_minus_forwarded":    0,
				"forwarded_minus_committed": 0,
			},
			Daily:         []pipelineStageDailyPoint{},
			Recent:        []pipelineDeliveryItem{},
			WeeklySummary: map[string]int64{},
		}

		rows, err := db.QueryContext(
			ctx,
			`SELECT day_utc, stage, count
			 FROM pipeline_stage_daily
			 WHERE day_utc >= ?
			 ORDER BY day_utc ASC, stage ASC`,
			dayFloor,
		)
		if err != nil {
			http.Error(w, "failed to query stage daily: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		for rows.Next() {
			var day, stage string
			var count int64
			if err := rows.Scan(&day, &stage, &count); err != nil {
				http.Error(w, "failed to scan stage daily: "+err.Error(), http.StatusInternalServerError)
				return
			}
			resp.Daily = append(resp.Daily, pipelineStageDailyPoint{
				DayUTC: day,
				Stage:  stage,
				Count:  count,
			})
			resp.WeeklySummary[stage] += count
			if _, ok := resp.Totals[stage]; ok {
				resp.Totals[stage] += count
			}
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "failed to iterate stage daily: "+err.Error(), http.StatusInternalServerError)
			return
		}

		resp.Gaps["accepted_minus_stored"] = resp.Totals["accepted"] - resp.Totals["stored"]
		resp.Gaps["stored_minus_forwarded"] = resp.Totals["stored"] - resp.Totals["forwarded"]
		resp.Gaps["forwarded_minus_committed"] = resp.Totals["forwarded"] - resp.Totals["committed"]

		deliveryRows, err := db.QueryContext(
			ctx,
			`SELECT delivery_id, batch_id, created_at, updated_at,
			        accepted_count, stored_count, forwarded_count, committed_count,
			        min_seq, max_seq, status
			 FROM pipeline_delivery_events
			 ORDER BY updated_at DESC
			 LIMIT ?`,
			limit,
		)
		if err != nil {
			http.Error(w, "failed to query delivery events: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer deliveryRows.Close()

		for deliveryRows.Next() {
			var item pipelineDeliveryItem
			var minSeq, maxSeq sql.NullInt64
			if err := deliveryRows.Scan(
				&item.DeliveryID,
				&item.BatchID,
				&item.CreatedAt,
				&item.UpdatedAt,
				&item.AcceptedCount,
				&item.StoredCount,
				&item.ForwardedCount,
				&item.CommittedCount,
				&minSeq,
				&maxSeq,
				&item.Status,
			); err != nil {
				http.Error(w, "failed to scan delivery event: "+err.Error(), http.StatusInternalServerError)
				return
			}
			if minSeq.Valid {
				v := minSeq.Int64
				item.MinSeq = &v
			}
			if maxSeq.Valid {
				v := maxSeq.Int64
				item.MaxSeq = &v
			}

			if item.StoredCount < item.AcceptedCount {
				item.MissingStages = append(item.MissingStages, "stored")
			}
			if item.ForwardedCount < item.StoredCount {
				item.MissingStages = append(item.MissingStages, "forwarded")
			}
			if item.CommittedCount < item.ForwardedCount {
				item.MissingStages = append(item.MissingStages, "committed")
			}

			resp.Recent = append(resp.Recent, item)
		}
		if err := deliveryRows.Err(); err != nil {
			http.Error(w, "failed to iterate delivery events: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func PipelineFailuresHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		ctx := r.Context()
		now := time.Now().UTC()
		limit := parsePositiveInt(r.URL.Query().Get("limit"), 200, 1, 1000)
		days := parsePositiveInt(r.URL.Query().Get("days"), 14, 1, 90)
		dayFloor := now.AddDate(0, 0, -days).Format("2006-01-02")

		resp := pipelineFailuresResponse{
			OK:          true,
			GeneratedAt: now.UnixMilli(),
			Recent:      []pipelineFailureLogItem{},
			Daily:       []pipelineFailureSummaryItem{},
		}

		rows, err := db.QueryContext(
			ctx,
			`SELECT id, ts_utc, day_utc, source, stage, error_code, error_detail, sample_count, batch_id, delivery_id
			 FROM pipeline_failure_logs
			 ORDER BY ts_utc DESC
			 LIMIT ?`,
			limit,
		)
		if err != nil {
			http.Error(w, "failed to query failure logs: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		for rows.Next() {
			var item pipelineFailureLogItem
			if err := rows.Scan(
				&item.ID,
				&item.TSUTC,
				&item.DayUTC,
				&item.Source,
				&item.Stage,
				&item.ErrorCode,
				&item.ErrorDetail,
				&item.SampleCount,
				&item.BatchID,
				&item.DeliveryID,
			); err != nil {
				http.Error(w, "failed to scan failure log: "+err.Error(), http.StatusInternalServerError)
				return
			}
			resp.Recent = append(resp.Recent, item)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "failed to iterate failure logs: "+err.Error(), http.StatusInternalServerError)
			return
		}

		sumRows, err := db.QueryContext(
			ctx,
			`SELECT day_utc, stage, error_code, SUM(sample_count) AS events, COUNT(*) AS occurrences
			 FROM pipeline_failure_logs
			 WHERE day_utc >= ?
			 GROUP BY day_utc, stage, error_code
			 ORDER BY day_utc DESC, events DESC`,
			dayFloor,
		)
		if err != nil {
			http.Error(w, "failed to query failure summary: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer sumRows.Close()

		for sumRows.Next() {
			var item pipelineFailureSummaryItem
			if err := sumRows.Scan(
				&item.DayUTC,
				&item.Stage,
				&item.ErrorCode,
				&item.Events,
				&item.Occurrences,
			); err != nil {
				http.Error(w, "failed to scan failure summary: "+err.Error(), http.StatusInternalServerError)
				return
			}
			resp.Daily = append(resp.Daily, item)
		}
		if err := sumRows.Err(); err != nil {
			http.Error(w, "failed to iterate failure summary: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		_ = json.NewEncoder(w).Encode(resp)
	}
}
