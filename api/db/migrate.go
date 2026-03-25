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
}

func Migrate(pool *pgxpool.Pool) error {
	for i, ddl := range migrations {
		if _, err := pool.Exec(context.Background(), ddl); err != nil {
			return fmt.Errorf("migration %d failed: %w", i, err)
		}
	}
	return nil
}
