// oracle-backend/cmd/archiver/main.go
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

// SummaryResponse matches the FULL JSON structure from your backend
type SummaryResponse struct {
	Totals struct {
		TotalEvents    int64 `json:"totalEvents"`
		TotalDownloads int64 `json:"totalDownloads"`
		TotalSuccess   int64 `json:"totalSuccess"`
		TotalFail      int64 `json:"totalFail"`
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

func main() {
	sheetID := flag.String("sheet", "", "Google Sheet ID")
	credsPath := flag.String("creds", "/app/google-credentials.json", "Path to Service Account JSON")
	apiURL := flag.String("api", "http://localhost:8080/api/stats/summary", "URL to fetch stats from")
	kumaPushURL := flag.String("kuma", "", "Uptime Kuma Push URL (optional)")
	flag.Parse()

	if *sheetID == "" {
		log.Fatal("Please provide a --sheet ID")
	}

	// 1. Fetch Stats
	log.Printf("Fetching stats from %s...", *apiURL)
	resp, err := http.Get(*apiURL)
	if err != nil {
		log.Fatalf("Failed to fetch stats: %v", err)
	}
	defer resp.Body.Close()

	var data SummaryResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Fatalf("Failed to decode JSON: %v", err)
	}

	// 2. Prepare Data
	today := time.Now().Format("2006-01-02")

	// Helper to format map as readable string
	formatMap := func(m map[string]int64) string {
		var parts []string
		for k, v := range m {
			parts = append(parts, fmt.Sprintf("%s: %d", k, v))
		}
		sort.Strings(parts)
		return strings.Join(parts, "\n")
	}

	// Calculate Success Rate
	successRate := 0.0
	if data.Totals.TotalDownloads > 0 {
		successRate = float64(data.Totals.TotalSuccess) / float64(data.Totals.TotalDownloads) * 100
	}

	// 3. Build the "Everything" Row
	row := []interface{}{
		today,                              // A: Date
		data.Totals.TotalDownloads,         // B: Total Downloads
		data.Totals.TotalSuccess,           // C: Success Count
		data.Totals.TotalFail,              // D: Fail Count
		fmt.Sprintf("%.2f%%", successRate), // E: Success Rate

		// Top Stats
		data.TopBrowser, // F: Top Browser
		data.TopOs,      // G: Top OS
		data.TopCountry, // H: Top Country
		data.TopType,    // I: Top File Type

		// Full Data Dumps
		formatMap(data.Browsers),     // J: All Browsers
		formatMap(data.Os),           // K: All OS
		formatMap(data.Countries),    // L: All Countries
		formatMap(data.Languages),    // M: All Languages
		formatMap(data.Types),        // N: All File Types
		formatMap(data.ErrorReasons), // O: All Errors
		formatMap(data.Versions),     // P: Extension Versions
	}

	// 4. Send to Google
	ctx := context.Background()
	b, err := os.ReadFile(*credsPath)
	if err != nil {
		log.Fatalf("Unable to read client secret file: %v", err)
	}

	config, err := google.JWTConfigFromJSON(b, sheets.SpreadsheetsScope)
	if err != nil {
		log.Fatalf("Unable to parse client secret file to config: %v", err)
	}
	client := config.Client(ctx)

	srv, err := sheets.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		log.Fatalf("Unable to retrieve Sheets client: %v", err)
	}

	rangeData := "Sheet1!A1"
	rb := &sheets.ValueRange{
		Values: [][]interface{}{row},
	}

	_, err = srv.Spreadsheets.Values.Append(*sheetID, rangeData, rb).ValueInputOption("USER_ENTERED").Do()
	if err != nil {
		log.Fatalf("Unable to append data to sheet: %v", err)
	}

	log.Printf("Successfully archived FULL stats for %s", today)

	// 5. Notify Uptime Kuma (Push Monitor)
	if *kumaPushURL != "" {
		// Append success message param
		pushURL := fmt.Sprintf("%s&msg=OK&ping=", *kumaPushURL)
		k_resp, k_err := http.Get(pushURL)
		if k_err != nil {
			log.Printf("[WARN] Failed to push status to Uptime Kuma: %v", k_err)
		} else {
			defer k_resp.Body.Close()
			log.Println("Uptime Kuma notified.")
		}
	}
}