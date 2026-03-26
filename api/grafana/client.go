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

// PanelConfig defines a single metrics panel — its display name, PromQL expression, and unit.
// ID is 0 for built-in defaults (not editable by viewers).
type PanelConfig struct {
	ID   int
	Name string
	Expr string
	Unit string
}

var defaultPanels = []PanelConfig{
	{Name: "CPU Usage", Expr: `avg(rate(node_cpu_seconds_total{mode!="idle",namespace=~"$namespace"}[5m])) * 100`, Unit: "%"},
	{Name: "Memory Usage", Expr: `(1 - avg(node_memory_MemAvailable_bytes{namespace=~"$namespace"} / node_memory_MemTotal_bytes{namespace=~"$namespace"})) * 100`, Unit: "%"},
	{Name: "Pod Count", Expr: `count(kube_pod_info{namespace=~"$namespace"})`, Unit: ""},
	{Name: "Request Rate", Expr: `sum(rate(http_requests_total{namespace=~"$namespace"}[5m]))`, Unit: "req/s"},
	{Name: "Error Rate", Expr: `sum(rate(http_requests_total{status=~"5..",namespace=~"$namespace"}[5m])) / sum(rate(http_requests_total{namespace=~"$namespace"}[5m])) * 100`, Unit: "%"},
}

// FetchNamespaces returns the list of Kubernetes namespaces visible in Prometheus.
func FetchNamespaces(cfg Config) ([]string, error) {
	token, err := getBearerToken(cfg)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("GET", cfg.URL+"/api/datasources/proxy/1/api/v1/label/namespace/values", nil)
	if err != nil {
		return nil, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		Data []string `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result.Data, nil
}

// FetchMetrics calls Grafana/Prometheus for configured panels.
// Falls back to mock data if Grafana is unreachable or unconfigured.
// If panels is empty, the built-in defaults are used.
// namespace is substituted for $namespace in expressions; "" means ".*" (all).
func FetchMetrics(cfg Config, panels []PanelConfig, namespace string) (*models.MetricsPayload, error) {
	if len(panels) == 0 {
		panels = defaultPanels
	}

	if cfg.URL == "" {
		return mockMetrics(panels), nil
	}

	token, err := getBearerToken(cfg)
	if err != nil {
		return mockMetrics(panels), nil
	}

	req, err := http.NewRequest("GET", cfg.URL+"/api/health", nil)
	if err != nil {
		return mockMetrics(panels), nil
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return mockMetrics(panels), nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return mockMetrics(panels), nil
	}

	return fetchRealMetrics(cfg.URL, token, panels, namespace)
}

func fetchRealMetrics(grafanaURL, token string, panels []PanelConfig, namespace string) (*models.MetricsPayload, error) {
	nsValue := namespace
	if nsValue == "" {
		nsValue = ".*"
	}

	payload := &models.MetricsPayload{
		Metrics:   make([]models.MetricValue, 0, len(panels)),
		FetchedAt: time.Now(),
	}

	for _, p := range panels {
		expr := strings.ReplaceAll(p.Expr, "$namespace", nsValue)
		val, err := queryPromQL(grafanaURL, token, expr)
		if err != nil {
			return mockMetrics(panels), nil
		}
		payload.Metrics = append(payload.Metrics, models.MetricValue{
			PanelID: p.ID,
			Name:    p.Name,
			Value:   val,
			Unit:    p.Unit,
		})
	}
	return payload, nil
}

// QueryPromQL executes a single PromQL expression against the Grafana datasource proxy and returns the scalar result.
func QueryPromQL(cfg Config, expr string) (float64, error) {
	token, err := getBearerToken(cfg)
	if err != nil {
		return 0, err
	}
	return queryPromQL(cfg.URL, token, expr)
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
		Status string `json:"status"`
		Error  string `json:"error"`
		Data   struct {
			Result []struct {
				Value []interface{} `json:"value"`
			} `json:"result"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return 0, fmt.Errorf("unexpected response")
	}
	if result.Status == "error" {
		return 0, fmt.Errorf("%s", result.Error)
	}
	if len(result.Data.Result) == 0 {
		return 0, nil
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

func mockMetrics(panels []PanelConfig) *models.MetricsPayload {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	metrics := make([]models.MetricValue, 0, len(panels))
	for _, p := range panels {
		metrics = append(metrics, models.MetricValue{
			Name:  p.Name,
			Value: round(r.Float64() * 100),
			Unit:  p.Unit,
		})
	}
	return &models.MetricsPayload{
		Metrics:   metrics,
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
