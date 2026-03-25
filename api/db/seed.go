package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func Seed(pool *pgxpool.Pool) error {
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return fmt.Errorf("seed check failed: %w", err)
	}
	if count > 0 {
		return nil
	}

	adminHash, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	aliceHash, err := bcrypt.GenerateFromPassword([]byte("alice123"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	bobHash, err := bcrypt.GenerateFromPassword([]byte("bob123"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	tx, err := pool.Begin(context.Background())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())

	// Users
	var adminID, aliceID, bobID int
	if err := tx.QueryRow(context.Background(),
		`INSERT INTO users (username, password_hash, role) VALUES ($1,$2,'admin') RETURNING id`,
		"admin", string(adminHash)).Scan(&adminID); err != nil {
		return err
	}
	if err := tx.QueryRow(context.Background(),
		`INSERT INTO users (username, password_hash, role) VALUES ($1,$2,'viewer') RETURNING id`,
		"alice", string(aliceHash)).Scan(&aliceID); err != nil {
		return err
	}
	if err := tx.QueryRow(context.Background(),
		`INSERT INTO users (username, password_hash, role) VALUES ($1,$2,'viewer') RETURNING id`,
		"bob", string(bobHash)).Scan(&bobID); err != nil {
		return err
	}

	// Customers
	var acmeCustID, globexCustID int
	if err := tx.QueryRow(context.Background(),
		`INSERT INTO customers (name) VALUES ($1) RETURNING id`, "Acme Corp").Scan(&acmeCustID); err != nil {
		return err
	}
	if err := tx.QueryRow(context.Background(),
		`INSERT INTO customers (name) VALUES ($1) RETURNING id`, "Globex Inc").Scan(&globexCustID); err != nil {
		return err
	}

	// Environments
	var acmeProdEnvID, globexStagingEnvID int
	if err := tx.QueryRow(context.Background(),
		`INSERT INTO environments (customer_id, name) VALUES ($1,$2) RETURNING id`,
		acmeCustID, "production").Scan(&acmeProdEnvID); err != nil {
		return err
	}
	if err := tx.QueryRow(context.Background(),
		`INSERT INTO environments (customer_id, name) VALUES ($1,$2) RETURNING id`,
		globexCustID, "staging").Scan(&globexStagingEnvID); err != nil {
		return err
	}

	// Clusters
	var clusterAID, clusterBID int
	if err := tx.QueryRow(context.Background(),
		`INSERT INTO clusters (environment_id, name, grafana_url, grafana_token) VALUES ($1,$2,$3,$4) RETURNING id`,
		acmeProdEnvID, "cluster-alpha", "", "").Scan(&clusterAID); err != nil {
		return err
	}
	if err := tx.QueryRow(context.Background(),
		`INSERT INTO clusters (environment_id, name, grafana_url, grafana_token) VALUES ($1,$2,$3,$4) RETURNING id`,
		globexStagingEnvID, "cluster-beta", "", "").Scan(&clusterBID); err != nil {
		return err
	}

	// Access grants: alice → cluster-alpha, bob → cluster-beta
	if _, err := tx.Exec(context.Background(),
		`INSERT INTO user_cluster_access (user_id, cluster_id) VALUES ($1,$2)`,
		aliceID, clusterAID); err != nil {
		return err
	}
	if _, err := tx.Exec(context.Background(),
		`INSERT INTO user_cluster_access (user_id, cluster_id) VALUES ($1,$2)`,
		bobID, clusterBID); err != nil {
		return err
	}

	return tx.Commit(context.Background())
}
