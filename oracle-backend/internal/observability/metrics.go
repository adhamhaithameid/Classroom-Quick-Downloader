package observability

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
)

type metricSample struct {
	name   string
	labels string
	value  float64
}

type Registry struct {
	mu       sync.RWMutex
	counters map[string]float64
	gauges   map[string]float64
}

func NewRegistry() *Registry {
	return &Registry{
		counters: make(map[string]float64),
		gauges:   make(map[string]float64),
	}
}

func keyFor(name string, labels map[string]string) string {
	if len(labels) == 0 {
		return name
	}
	keys := make([]string, 0, len(labels))
	for k := range labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=%q", k, escapeLabelValue(labels[k])))
	}
	return fmt.Sprintf("%s{%s}", name, strings.Join(parts, ","))
}

func escapeLabelValue(v string) string {
	v = strings.ReplaceAll(v, `\`, `\\`)
	v = strings.ReplaceAll(v, `"`, `\"`)
	v = strings.ReplaceAll(v, "\n", `\n`)
	return v
}

func (r *Registry) IncCounter(name string, labels map[string]string, delta float64) {
	if delta == 0 {
		return
	}
	key := keyFor(name, labels)
	r.mu.Lock()
	r.counters[key] += delta
	r.mu.Unlock()
}

func (r *Registry) SetGauge(name string, labels map[string]string, value float64) {
	key := keyFor(name, labels)
	r.mu.Lock()
	r.gauges[key] = value
	r.mu.Unlock()
}

func (r *Registry) Snapshot() []metricSample {
	r.mu.RLock()
	defer r.mu.RUnlock()

	samples := make([]metricSample, 0, len(r.counters)+len(r.gauges))
	for k, v := range r.counters {
		samples = append(samples, metricSample{name: k, value: v})
	}
	for k, v := range r.gauges {
		samples = append(samples, metricSample{name: k, value: v})
	}

	sort.Slice(samples, func(i, j int) bool {
		return samples[i].name < samples[j].name
	})
	return samples
}

func (r *Registry) RenderPrometheus() string {
	samples := r.Snapshot()
	var b strings.Builder
	for _, sample := range samples {
		b.WriteString(sample.name)
		b.WriteByte(' ')
		b.WriteString(strconv.FormatFloat(sample.value, 'f', -1, 64))
		b.WriteByte('\n')
	}
	return b.String()
}
