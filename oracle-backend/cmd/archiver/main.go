// oracle-backend/cmd/archiver/main.go
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

type logPayload struct {
	Level   string                 `json:"level"`
	Message string                 `json:"message"`
	Time    string                 `json:"time"`
	Fields  map[string]interface{} `json:"fields,omitempty"`
}

func logEvent(level string, message string, fields map[string]interface{}) {
	payload := logPayload{
		Level:   level,
		Message: message,
		Time:    time.Now().UTC().Format(time.RFC3339),
		Fields:  fields,
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[logEvent] marshal error: %v", err)
		return
	}
	log.Println(string(encoded))
}

// SummaryResponse matches the FULL JSON structure from your backend
type SummaryResponse struct {
	Totals struct {
		TotalEvents    int64 `json:"totalEvents"`
		TotalDownloads int64 `json:"totalDownloads"`
		TotalSuccess   int64 `json:"totalSuccess"`
		TotalFail      int64 `json:"totalFail"`
		TotalCancelled int64 `json:"totalCancelled"`
	} `json:"totals"`

	// Dimensional maps
	Browsers     map[string]int64 `json:"browsers"`
	Os           map[string]int64 `json:"os"`
	Countries    map[string]int64 `json:"countries"`
	Languages    map[string]int64 `json:"languages"`
	Versions     map[string]int64 `json:"versions"`
	Types        map[string]int64 `json:"types"`
	ErrorReasons map[string]int64 `json:"errorReasons"`

	// Top stats
	TopBrowser string `json:"topBrowser"`
	TopOs      string `json:"topOs"`
	TopCountry string `json:"topCountry"`
	TopType    string `json:"topType"`
}

func formatMapSorted(m map[string]int64) string {
	var parts []string
	for k, v := range m {
		parts = append(parts, fmt.Sprintf("%s: %d", k, v))
	}
	sort.Strings(parts)
	return strings.Join(parts, "\n")
}

func calcSuccessRate(totalDownloads, totalSuccess int64) float64 {
	if totalDownloads <= 0 {
		return 0
	}
	return float64(totalSuccess) / float64(totalDownloads) * 100
}

func buildArchiveRow(today string, data SummaryResponse) []interface{} {
	successRate := calcSuccessRate(data.Totals.TotalDownloads, data.Totals.TotalSuccess)
	return []interface{}{
		today,                              // A: Date
		data.Totals.TotalDownloads,         // B: Total Downloads
		data.Totals.TotalSuccess,           // C: Success Count
		data.Totals.TotalFail,              // D: Fail Count
		data.Totals.TotalCancelled,         // E: Cancelled Count
		fmt.Sprintf("%.2f%%", successRate), // F: Success Rate

		// Top Stats
		data.TopBrowser, // F: Top Browser
		data.TopOs,      // G: Top OS
		data.TopCountry, // H: Top Country
		data.TopType,    // I: Top File Type

		// Full Data Dumps
		formatMapSorted(data.Browsers),     // J: All Browsers
		formatMapSorted(data.Os),           // K: All OS
		formatMapSorted(data.Countries),    // L: All Countries
		formatMapSorted(data.Languages),    // M: All Languages
		formatMapSorted(data.Types),        // N: All File Types
		formatMapSorted(data.ErrorReasons), // O: All Errors
		formatMapSorted(data.Versions),     // P: Extension Versions
	}
}

func parseAndValidateOutboundURL(raw string) (string, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return "", errors.New("empty url")
	}
	u, err := url.Parse(v)
	if err != nil {
		return "", err
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", errors.New("unsupported url scheme")
	}
	if strings.TrimSpace(u.Host) == "" {
		return "", errors.New("missing url host")
	}
	return u.String(), nil
}

func main() {
	sheetID := flag.String("sheet", "", "Google Sheet ID")
	credsPath := flag.String("creds", "/app/google-credentials.json", "Path to Service Account JSON")
	apiURL := flag.String("api", "http://localhost:8080/api/stats/summary", "URL to fetch stats from")
	secret := flag.String("secret", os.Getenv("ARCHIVER_SHARED_SECRET"), "Shared secret for authenticated stats (optional)")
	kumaPushURL := flag.String("kuma", "", "Uptime Kuma Push URL (optional)")
	flag.Parse()

	if *sheetID == "" {
		logEvent("error", "archiver_missing_sheet_id", nil)
		log.Fatal("Please provide a --sheet ID")
	}

	validatedAPIURL, err := parseAndValidateOutboundURL(*apiURL)
	if err != nil {
		logEvent("error", "archiver_invalid_api_url", map[string]interface{}{
			"error": err.Error(),
		})
		log.Fatalf("Invalid --api URL: %v", err)
	}

	// 1. Fetch Stats
	log.Printf("Fetching stats from %s...", validatedAPIURL)
	req, err := http.NewRequest(http.MethodGet, validatedAPIURL, nil)
	if err != nil {
		logEvent("error", "archiver_request_build_failed", map[string]interface{}{
			"error": err.Error(),
		})
		log.Fatalf("Failed to build request: %v", err)
	}
	if *secret != "" {
		req.Header.Set("X-Archiver-Secret", *secret)
	}

	httpClient := &http.Client{Timeout: 15 * time.Second}
	// #nosec G107,G704 -- URL is validated by parseAndValidateOutboundURL before request creation.
	resp, err := httpClient.Do(req)
	if err != nil {
		logEvent("error", "archiver_stats_fetch_failed", map[string]interface{}{
			"error": err.Error(),
		})
		log.Fatalf("Failed to fetch stats: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		logEvent("error", "archiver_stats_bad_status", map[string]interface{}{
			"status": resp.StatusCode,
		})
		log.Fatalf("Stats request failed with status code: %d", resp.StatusCode) // #nosec G706 -- status code is numeric and not tainted text.
	}

	var data SummaryResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		logEvent("error", "archiver_stats_decode_failed", map[string]interface{}{
			"error": err.Error(),
		})
		log.Fatalf("Failed to decode JSON: %v", err)
	}

	// 2. Prepare Data (UTC)
	today := time.Now().UTC().Format("2006-01-02")

	// 3. Build the "Everything" Row
	row := buildArchiveRow(today, data)

	// 4. Send to Google
	ctx := context.Background()
	b, err := os.ReadFile(*credsPath)
	if err != nil {
		logEvent("error", "archiver_creds_read_failed", map[string]interface{}{
			"error": err.Error(),
		})
		log.Fatalf("Unable to read client secret file: %v", err)
	}

	config, err := google.JWTConfigFromJSON(b, sheets.SpreadsheetsScope)
	if err != nil {
		logEvent("error", "archiver_creds_parse_failed", map[string]interface{}{
			"error": err.Error(),
		})
		log.Fatalf("Unable to parse client secret file to config: %v", err)
	}
	client := config.Client(ctx)

	srv, err := sheets.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		logEvent("error", "archiver_sheets_client_failed", map[string]interface{}{
			"error": err.Error(),
		})
		log.Fatalf("Unable to retrieve Sheets client: %v", err)
	}

	rangeData := "Sheet1!A1"
	rb := &sheets.ValueRange{
		Values: [][]interface{}{row},
	}

	_, err = srv.Spreadsheets.Values.Append(*sheetID, rangeData, rb).ValueInputOption("RAW").Do()
	if err != nil {
		logEvent("error", "archiver_sheet_append_failed", map[string]interface{}{
			"error": err.Error(),
		})
		log.Fatalf("Unable to append data to sheet: %v", err)
	}

	logEvent("info", "archiver_success", map[string]interface{}{
		"date": today,
	})
	log.Printf("Successfully archived FULL stats for %s", today)

	// 5. Notify Uptime Kuma (Push Monitor)
	if *kumaPushURL != "" {
		validatedKumaURL, err := parseAndValidateOutboundURL(*kumaPushURL)
		if err != nil {
			log.Printf("[WARN] Invalid Uptime Kuma URL: %v", err)
			return
		}

		// Append success message param
		pushURL := fmt.Sprintf("%s&msg=OK&ping=", validatedKumaURL)
		kReq, reqErr := http.NewRequest(http.MethodGet, pushURL, nil)
		if reqErr != nil {
			log.Printf("[WARN] Failed to build Uptime Kuma request: %v", reqErr)
		} else {
			// #nosec G107,G704 -- URL is validated by parseAndValidateOutboundURL before request creation.
			kResp, kErr := httpClient.Do(kReq)
			if kErr != nil {
				log.Printf("[WARN] Failed to push status to Uptime Kuma: %v", kErr)
				return
			}
			defer kResp.Body.Close()
			log.Println("Uptime Kuma notified.")
		}
	}
}
