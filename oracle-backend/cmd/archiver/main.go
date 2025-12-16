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
	"time"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

// SummaryResponse matches the JSON structure from /api/stats/summary
type SummaryResponse struct {
	TotalDownloads int64 `json:"totalDownloads"`
	TotalSuccess   int64 `json:"totalSuccess"`
	TotalFail      int64 `json:"totalFail"`
	Totals         struct {
		BrowserChrome  int64 `json:"browser:chrome"`
		BrowserFirefox int64 `json:"browser:firefox"`
		BrowserEdge    int64 `json:"browser:edge"`
		BrowserSafari  int64 `json:"browser:safari"`
		OSMac          int64 `json:"os:mac"`
		OSWin          int64 `json:"os:win"`
		OSLinux        int64 `json:"os:linux"`
		OSAndroid      int64 `json:"os:android"`
		OSiOS          int64 `json:"os:ios"`
	} `json:"totals"`
}

func main() {
	sheetID := flag.String("sheet", "", "Google Sheet ID")
	credsPath := flag.String("creds", "/app/google-credentials.json", "Path to Service Account JSON")
	apiURL := flag.String("api", "http://localhost:8080/api/stats/summary", "URL to fetch stats from")
	flag.Parse()

	if *sheetID == "" {
		log.Fatal("Please provide a --sheet ID")
	}

	// 1. Fetch Stats from Local Backend
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

	// 2. Prepare the Row Data
	// Format: Date, Downloads, Success, Fail, Chrome, Firefox, Edge, Safari, Win, Mac, Linux
	today := time.Now().Format("2006-01-02")
	row := []interface{}{
		today,
		data.TotalDownloads,
		data.TotalSuccess,
		data.TotalFail,
		data.Totals.BrowserChrome,
		data.Totals.BrowserFirefox,
		data.Totals.BrowserEdge,
		data.Totals.BrowserSafari,
		data.Totals.OSWin,
		data.Totals.OSMac,
		data.Totals.OSLinux,
	}

	// 3. Authenticate with Google
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

	// 4. Append to Sheet
	rangeData := "Sheet1!A1" // Appends to the end of the sheet automatically
	rb := &sheets.ValueRange{
		Values: [][]interface{}{row},
	}

	_, err = srv.Spreadsheets.Values.Append(*sheetID, rangeData, rb).ValueInputOption("RAW").Do()
	if err != nil {
		log.Fatalf("Unable to append data to sheet: %v", err)
	}

	log.Printf("Successfully archived stats for %s", today)
}