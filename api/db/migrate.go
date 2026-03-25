package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

var migrations = []string{
	`CREATE TABLE IF NOT EXISTS users (
		id            SERIAL PRIMARY KEY,
		username      TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		role          TEXT NOT NULL DEFAULT 'viewer'
	)`,
	`CREATE TABLE IF NOT EXISTS customers (
		id   SERIAL PRIMARY KEY,
		name TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS environments (
		id          SERIAL PRIMARY KEY,
		customer_id INT NOT NULL REFERENCES customers(id),
		name        TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS clusters (
		id             SERIAL PRIMARY KEY,
		environment_id INT NOT NULL REFERENCES environments(id),
		name           TEXT NOT NULL,
		grafana_url    TEXT NOT NULL DEFAULT '',
		grafana_token  TEXT NOT NULL DEFAULT ''
	)`,
	`CREATE TABLE IF NOT EXISTS user_cluster_access (
		user_id    INT NOT NULL REFERENCES users(id),
		cluster_id INT NOT NULL REFERENCES clusters(id),
		PRIMARY KEY (user_id, cluster_id)
	)`,
	`ALTER TABLE user_cluster_access
		DROP CONSTRAINT IF EXISTS user_cluster_access_user_id_fkey,
		ADD CONSTRAINT user_cluster_access_user_id_fkey
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`,
	`ALTER TABLE clusters
    ADD COLUMN IF NOT EXISTS grafana_auth_type TEXT NOT NULL DEFAULT 'token',
    ADD COLUMN IF NOT EXISTS grafana_client_id  TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS grafana_token_url  TEXT NOT NULL DEFAULT ''`,
	`CREATE TABLE IF NOT EXISTS panels (
		id             SERIAL PRIMARY KEY,
		environment_id INT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
		name           TEXT NOT NULL,
		expr           TEXT NOT NULL,
		unit           TEXT NOT NULL DEFAULT '',
		position       INT NOT NULL DEFAULT 0
	)`,
}

// defaultPanelSeeds are the five built-in panels seeded into every environment.
// Keep in sync with grafana.defaultPanels.
var defaultPanelSeeds = []struct {
	name, expr, unit string
	position         int
}{
	{
		name:     "CPU Usage",
		expr:     `avg(rate(node_cpu_seconds_total{mode!="idle",namespace=~"$namespace"}[5m])) * 100`,
		unit:     "%",
		position: 0,
	},
	{
		name:     "Memory Usage",
		expr:     `(1 - avg(node_memory_MemAvailable_bytes{namespace=~"$namespace"} / node_memory_MemTotal_bytes{namespace=~"$namespace"})) * 100`,
		unit:     "%",
		position: 1,
	},
	{
		name:     "Pod Count",
		expr:     `count(kube_pod_info{namespace=~"$namespace"})`,
		unit:     "",
		position: 2,
	},
	{
		name:     "Request Rate",
		expr:     `sum(rate(http_requests_total{namespace=~"$namespace"}[5m]))`,
		unit:     "req/s",
		position: 3,
	},
	{
		name:     "Error Rate",
		expr:     `sum(rate(http_requests_total{status=~"5..",namespace=~"$namespace"}[5m])) / sum(rate(http_requests_total{namespace=~"$namespace"}[5m])) * 100`,
		unit:     "%",
		position: 4,
	},
}

// SeedDefaultPanels inserts any missing default panels into the given environment.
// It is idempotent: panels that already exist (matched by name) are skipped.
func SeedDefaultPanels(ctx context.Context, pool *pgxpool.Pool, envID int) error {
	for _, p := range defaultPanelSeeds {
		if _, err := pool.Exec(ctx, `
			INSERT INTO panels (environment_id, name, expr, unit, position)
			SELECT $1, $2, $3, $4, $5
			WHERE NOT EXISTS (
				SELECT 1 FROM panels WHERE environment_id = $1 AND name = $2
			)`,
			envID, p.name, p.expr, p.unit, p.position,
		); err != nil {
			return err
		}
	}
	return nil
}

func Migrate(pool *pgxpool.Pool) error {
	ctx := context.Background()

	for i, ddl := range migrations {
		if _, err := pool.Exec(ctx, ddl); err != nil {
			return fmt.Errorf("migration %d failed: %w", i, err)
		}
	}

	// Seed default panels into every environment that is missing any of them.
	rows, err := pool.Query(ctx, `SELECT id FROM environments`)
	if err != nil {
		return fmt.Errorf("seed panels: query environments: %w", err)
	}
	defer rows.Close()
	var envIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			envIDs = append(envIDs, id)
		}
	}
	rows.Close()

	for _, envID := range envIDs {
		if err := SeedDefaultPanels(ctx, pool, envID); err != nil {
			return fmt.Errorf("seed panels for env %d: %w", envID, err)
		}
	}

	return nil
}
