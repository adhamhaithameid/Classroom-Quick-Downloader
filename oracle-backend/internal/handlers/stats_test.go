package handlers

import (
	"testing"
)

func TestColumnForDimension(t *testing.T) {
	tests := []struct {
		name          string
		dim           string
		wantColumn    string
		wantErr       bool
	}{
		// Valid dimensions
		{name: "status", dim: "status", wantColumn: "by_status_json", wantErr: false},
		{name: "type", dim: "type", wantColumn: "by_type_json", wantErr: false},
		{name: "browser", dim: "browser", wantColumn: "by_browser_json", wantErr: false},
		{name: "os", dim: "os", wantColumn: "by_os_json", wantErr: false},
		{name: "country", dim: "country", wantColumn: "by_country_json", wantErr: false},
		{name: "lang", dim: "lang", wantColumn: "by_lang_json", wantErr: false},
		{name: "language", dim: "language", wantColumn: "by_lang_json", wantErr: false},
		{name: "ext_version", dim: "ext_version", wantColumn: "by_ext_ver_json", wantErr: false},
		{name: "extVersion", dim: "extVersion", wantColumn: "by_ext_ver_json", wantErr: false},
		{name: "error_type", dim: "error_type", wantColumn: "by_error_type_json", wantErr: false},
		{name: "errorType", dim: "errorType", wantColumn: "by_error_type_json", wantErr: false},

		// Invalid dimensions
		{name: "invalid", dim: "invalid", wantColumn: "", wantErr: true},
		{name: "empty", dim: "", wantColumn: "", wantErr: true},
		{name: "sql_injection", dim: "browser; DROP TABLE users;", wantColumn: "", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotColumn, err := columnForDimension(tt.dim)
			if (err != nil) != tt.wantErr {
				t.Errorf("columnForDimension(%q) error = %v, wantErr %v", tt.dim, err, tt.wantErr)
				return
			}
			if gotColumn != tt.wantColumn {
				t.Errorf("columnForDimension(%q) = %v, want %v", tt.dim, gotColumn, tt.wantColumn)
			}
		})
	}
}
