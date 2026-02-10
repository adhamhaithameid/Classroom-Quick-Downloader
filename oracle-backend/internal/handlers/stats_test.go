package handlers

import (
	"testing"
)

func TestGetTopKey(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]int64
		expected string
		// For ties, valid options
		valid []string
	}{
		{
			name:     "Empty map",
			input:    map[string]int64{},
			expected: "unknown",
		},
		{
			name:     "Single item",
			input:    map[string]int64{"chrome": 10},
			expected: "chrome",
		},
		{
			name:     "Clear winner",
			input:    map[string]int64{"chrome": 10, "firefox": 5, "safari": 2},
			expected: "chrome",
		},
		{
			name:     "Zero value winner",
			input:    map[string]int64{"chrome": 0},
			expected: "chrome",
		},
		{
			name:     "Negative values",
			input:    map[string]int64{"chrome": -5},
			expected: "unknown",
		},
        {
            name: "Tie",
            input: map[string]int64{"chrome": 10, "firefox": 10, "safari": 5},
            valid: []string{"chrome", "firefox"},
        },
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getTopKey(tt.input)
            if len(tt.valid) > 0 {
                found := false
                for _, v := range tt.valid {
                    if got == v {
                        found = true
                        break
                    }
                }
                if !found {
                    t.Errorf("getTopKey() = %v, want one of %v", got, tt.valid)
                }
            } else {
			    if got != tt.expected {
				    t.Errorf("getTopKey() = %v, want %v", got, tt.expected)
			    }
            }
		})
	}
}
