package observability

import (
	"strings"
	"testing"
)

func TestRegistryRenderPrometheus_DeterministicAndEscaped(t *testing.T) {
	reg := NewRegistry()
	reg.IncCounter("oracle_counter_total", map[string]string{"k": "value\nline", "q": `a"b`}, 2)
	reg.SetGauge("oracle_gauge", map[string]string{"z": "1"}, 3.5)
	reg.IncCounter("oracle_counter_total", map[string]string{"k": "value\nline", "q": `a"b`}, 1)

	out := reg.RenderPrometheus()

	if !strings.Contains(out, `oracle_counter_total{k="value\\nline",q="a\\\"b"} 3`) {
		t.Fatalf("counter output missing/incorrect: %q", out)
	}
	if !strings.Contains(out, `oracle_gauge{z="1"} 3.5`) {
		t.Fatalf("gauge output missing/incorrect: %q", out)
	}
	if strings.Index(out, "oracle_counter_total") > strings.Index(out, "oracle_gauge") {
		t.Fatalf("expected alphabetical ordering, got: %q", out)
	}
}
