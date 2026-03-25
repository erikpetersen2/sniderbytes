package models

import "time"

type User struct {
	ID           int    `json:"id" db:"id"`
	Username     string `json:"username" db:"username"`
	PasswordHash string `json:"-" db:"password_hash"`
	Role         string `json:"role" db:"role"`
}

type Customer struct {
	ID   int    `json:"id" db:"id"`
	Name string `json:"name" db:"name"`
}

type Environment struct {
	ID         int    `json:"id" db:"id"`
	CustomerID int    `json:"customer_id" db:"customer_id"`
	Name       string `json:"name" db:"name"`
}

type Cluster struct {
	ID           int    `json:"id" db:"id"`
	EnvironmentID int   `json:"environment_id" db:"environment_id"`
	Name         string `json:"name" db:"name"`
	GrafanaURL   string `json:"grafana_url" db:"grafana_url"`
	GrafanaToken string `json:"-" db:"grafana_token"`
}

type ClusterView struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Environment string `json:"environment"`
	Customer    string `json:"customer"`
	GrafanaURL  string `json:"grafana_url"`
}

type UserClusterAccess struct {
	UserID    int `json:"user_id" db:"user_id"`
	ClusterID int `json:"cluster_id" db:"cluster_id"`
}

type MetricValue struct {
	PanelID int     `json:"panel_id,omitempty"`
	Name    string  `json:"name"`
	Value   float64 `json:"value"`
	Unit    string  `json:"unit"`
}

type MetricsPayload struct {
	ClusterID int           `json:"cluster_id"`
	Metrics   []MetricValue `json:"metrics"`
	Mock      bool          `json:"mock"`
	FetchedAt time.Time     `json:"fetched_at"`
}

type Alert struct {
	Name        string    `json:"name"`
	Severity    string    `json:"severity"`
	Status      string    `json:"status"`
	LastUpdated time.Time `json:"last_updated"`
}

type AlertsPayload struct {
	ClusterID int     `json:"cluster_id"`
	Alerts    []Alert `json:"alerts"`
	Mock      bool    `json:"mock"`
}
