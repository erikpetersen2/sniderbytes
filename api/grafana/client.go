package grafana

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/sniderbytes/api/models"
)

var ErrGrafanaUnreachable = errors.New("grafana unreachable")

var httpClient = &http.Client{Timeout: 10 * time.Second}

// Config holds everything needed to authenticate against a Grafana instance.
type Config struct {
	URL      string
	AuthType string // "token" or "keycloak"
	Token    string // SA token (AuthType=token) or client secret (AuthType=keycloak)
	ClientID string // keycloak only
	TokenURL string // keycloak only, e.g. https://login.afwerx.dso.mil/auth/realms/baby-yoda/protocol/openid-connect/token
}

// --- Keycloak client credentials token cache ---

type cachedToken struct {
	value     string
	expiresAt time.Time
}

var (
	tokenCacheMu sync.RWMutex
	tokenCache   = map[string]*cachedToken{}
)

func getBearerToken(cfg Config) (string, error) {
	if cfg.AuthType != "keycloak" {
		return cfg.Token, nil
	}

	key := cfg.ClientID + "@" + cfg.TokenURL

	tokenCacheMu.RLock()
	if t, ok := tokenCache[key]; ok && time.Now().Before(t.expiresAt) {
		tokenCacheMu.RUnlock()
		return t.value, nil
	}
	tokenCacheMu.RUnlock()

	// Fetch new token
	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", cfg.ClientID)
	form.Set("client_secret", cfg.Token)

	resp, err := httpClient.Post(cfg.TokenURL, "application/x-www-form-urlencoded", strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("keycloak token fetch failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &result); err != nil || result.AccessToken == "" {
		return "", fmt.Errorf("keycloak token parse failed: %s", string(body))
	}

	expiry := time.Now().Add(time.Duration(result.ExpiresIn-60) * time.Second)
	tokenCacheMu.Lock()
	tokenCache[key] = &cachedToken{value: result.AccessToken, expiresAt: expiry}
	tokenCacheMu.Unlock()

	return result.AccessToken, nil
}

// FetchMetrics calls the Grafana alerting API to get metrics.
// Falls back to mock data if unreachable or unconfigured.
func FetchMetrics(cfg Config) (*models.MetricsPayload, error) {
	if cfg.URL == "" {
		return mockMetrics(), nil
	}

	token, err := getBearerToken(cfg)
	if err != nil {
		return mockMetrics(), nil
	}

	req, err := http.NewRequest("GET", cfg.URL+"/api/health", nil)
	if err != nil {
		return mockMetrics(), nil
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return mockMetrics(), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return mockMetrics(), nil
	}

	return fetchRealMetrics(cfg.URL, token)
}

func fetchRealMetrics(grafanaURL, token string) (*models.MetricsPayload, error) {
	queries := []struct {
		expr string
		name string
		unit string
	}{
		{`avg(rate(node_cpu_seconds_total{mode!="idle"}[5m])) * 100`, "CPU Usage", "%"},
		{`(1 - avg(node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100`, "Memory Usage", "%"},
		{`count(kube_pod_info)`, "Pod Count", ""},
		{`sum(rate(http_requests_total[5m]))`, "Request Rate", "req/s"},
		{`sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100`, "Error Rate", "%"},
	}

	payload := &models.MetricsPayload{
		Metrics:   make([]models.MetricValue, 0, len(queries)),
		FetchedAt: time.Now(),
	}

	for _, q := range queries {
		val, err := queryPromQL(grafanaURL, token, q.expr)
		if err != nil {
			return mockMetrics(), nil
		}
		payload.Metrics = append(payload.Metrics, models.MetricValue{
			Name:  q.name,
			Value: val,
			Unit:  q.unit,
		})
	}
	return payload, nil
}

func queryPromQL(grafanaURL, token, expr string) (float64, error) {
	params := url.Values{}
	params.Set("query", expr)
	u := fmt.Sprintf("%s/api/datasources/proxy/1/api/v1/query?%s", grafanaURL, params.Encode())
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return 0, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return 0, ErrGrafanaUnreachable
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		Data struct {
			Result []struct {
				Value []interface{} `json:"value"`
			} `json:"result"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil || len(result.Data.Result) == 0 {
		return 0, fmt.Errorf("unexpected response")
	}

	valStr, ok := result.Data.Result[0].Value[1].(string)
	if !ok {
		return 0, fmt.Errorf("unexpected value type")
	}
	var val float64
	fmt.Sscanf(valStr, "%f", &val)
	if math.IsNaN(val) || math.IsInf(val, 0) {
		val = 0
	}
	return val, nil
}

// FetchAlerts calls the Grafana alertmanager API.
// Falls back to mock alerts if unavailable.
func FetchAlerts(cfg Config) ([]models.Alert, bool, error) {
	if cfg.URL == "" {
		return mockAlerts(), true, nil
	}

	token, err := getBearerToken(cfg)
	if err != nil {
		return mockAlerts(), true, nil
	}

	req, err := http.NewRequest("GET", cfg.URL+"/api/alertmanager/grafana/api/v2/alerts", nil)
	if err != nil {
		return mockAlerts(), true, nil
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return mockAlerts(), true, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return mockAlerts(), true, nil
	}

	body, _ := io.ReadAll(resp.Body)
	var raw []struct {
		Labels    map[string]string  `json:"labels"`
		Status    struct{ State string } `json:"status"`
		UpdatedAt time.Time          `json:"updatedAt"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return mockAlerts(), true, nil
	}

	alerts := make([]models.Alert, 0, len(raw))
	for _, a := range raw {
		alerts = append(alerts, models.Alert{
			Name:        a.Labels["alertname"],
			Severity:    a.Labels["severity"],
			Status:      a.Status.State,
			LastUpdated: a.UpdatedAt,
		})
	}
	return alerts, false, nil
}

func mockMetrics() *models.MetricsPayload {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	return &models.MetricsPayload{
		Metrics: []models.MetricValue{
			{Name: "CPU Usage", Value: round(20 + r.Float64()*40), Unit: "%"},
			{Name: "Memory Usage", Value: round(40 + r.Float64()*30), Unit: "%"},
			{Name: "Pod Count", Value: float64(12 + r.Intn(20)), Unit: ""},
			{Name: "Request Rate", Value: round(100 + r.Float64()*500), Unit: "req/s"},
			{Name: "Error Rate", Value: round(r.Float64() * 3), Unit: "%"},
			{Name: "P99 Latency", Value: round(50 + r.Float64()*150), Unit: "ms"},
		},
		Mock:      true,
		FetchedAt: time.Now(),
	}
}

func mockAlerts() []models.Alert {
	now := time.Now()
	return []models.Alert{
		{Name: "HighCPUUsage", Severity: "warning", Status: "firing", LastUpdated: now.Add(-5 * time.Minute)},
		{Name: "PodCrashLooping", Severity: "critical", Status: "firing", LastUpdated: now.Add(-12 * time.Minute)},
		{Name: "LowDiskSpace", Severity: "warning", Status: "firing", LastUpdated: now.Add(-1 * time.Hour)},
		{Name: "HighErrorRate", Severity: "info", Status: "resolved", LastUpdated: now.Add(-30 * time.Minute)},
	}
}

func round(f float64) float64 {
	return float64(int(f*100)) / 100
}
