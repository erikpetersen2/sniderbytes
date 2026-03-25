package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	db_pkg "github.com/sniderbytes/api/db"
)

type AdminClustersHandler struct {
	DB *pgxpool.Pool
}

type clusterAdminView struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	Environment     string `json:"environment"`
	EnvironmentID   int    `json:"environment_id"`
	Customer        string `json:"customer"`
	GrafanaURL      string `json:"grafana_url"`
	GrafanaAuthType string `json:"grafana_auth_type"`
	GrafanaClientID string `json:"grafana_client_id"`
	GrafanaTokenURL string `json:"grafana_token_url"`
}

func (h *AdminClustersHandler) List(c *gin.Context) {
	rows, err := h.DB.Query(context.Background(), `
		SELECT c.id, c.name, e.id, e.name, cu.name,
		       c.grafana_url, c.grafana_auth_type, c.grafana_client_id, c.grafana_token_url
		FROM clusters c
		JOIN environments e ON e.id = c.environment_id
		JOIN customers cu ON cu.id = e.customer_id
		ORDER BY cu.name, e.name, c.name
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	defer rows.Close()

	result := []clusterAdminView{}
	for rows.Next() {
		var v clusterAdminView
		if err := rows.Scan(&v.ID, &v.Name, &v.EnvironmentID, &v.Environment, &v.Customer,
			&v.GrafanaURL, &v.GrafanaAuthType, &v.GrafanaClientID, &v.GrafanaTokenURL); err != nil {
			continue
		}
		result = append(result, v)
	}
	c.JSON(http.StatusOK, result)
}

type clusterWriteRequest struct {
	Name            string `json:"name" binding:"required"`
	EnvironmentID   int    `json:"environment_id" binding:"required"`
	GrafanaURL      string `json:"grafana_url"`
	GrafanaAuthType string `json:"grafana_auth_type" binding:"required,oneof=token keycloak"`
	GrafanaToken    string `json:"grafana_token"` // SA token or client secret; blank on update = keep existing
	GrafanaClientID string `json:"grafana_client_id"`
	GrafanaTokenURL string `json:"grafana_token_url"`
}

func (h *AdminClustersHandler) Create(c *gin.Context) {
	var req clusterWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var id int
	err := h.DB.QueryRow(context.Background(), `
		INSERT INTO clusters (environment_id, name, grafana_url, grafana_token, grafana_auth_type, grafana_client_id, grafana_token_url)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		req.EnvironmentID, req.Name, req.GrafanaURL, req.GrafanaToken,
		req.GrafanaAuthType, req.GrafanaClientID, req.GrafanaTokenURL,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *AdminClustersHandler) Update(c *gin.Context) {
	var req clusterWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If token is blank, keep the existing value
	if req.GrafanaToken == "" {
		_, err := h.DB.Exec(context.Background(), `
			UPDATE clusters SET
				name=$1, environment_id=$2, grafana_url=$3,
				grafana_auth_type=$4, grafana_client_id=$5, grafana_token_url=$6
			WHERE id=$7`,
			req.Name, req.EnvironmentID, req.GrafanaURL,
			req.GrafanaAuthType, req.GrafanaClientID, req.GrafanaTokenURL,
			c.Param("id"),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
	} else {
		_, err := h.DB.Exec(context.Background(), `
			UPDATE clusters SET
				name=$1, environment_id=$2, grafana_url=$3, grafana_token=$4,
				grafana_auth_type=$5, grafana_client_id=$6, grafana_token_url=$7
			WHERE id=$8`,
			req.Name, req.EnvironmentID, req.GrafanaURL, req.GrafanaToken,
			req.GrafanaAuthType, req.GrafanaClientID, req.GrafanaTokenURL,
			c.Param("id"),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
	}
	c.Status(http.StatusNoContent)
}

func (h *AdminClustersHandler) Delete(c *gin.Context) {
	if _, err := h.DB.Exec(context.Background(),
		`DELETE FROM clusters WHERE id=$1`, c.Param("id"),
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	c.Status(http.StatusNoContent)
}

type EnvironmentView struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Customer string `json:"customer"`
}

func ListEnvironments(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(context.Background(), `
			SELECT e.id, e.name, cu.name
			FROM environments e
			JOIN customers cu ON cu.id = e.customer_id
			ORDER BY cu.name, e.name
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
		defer rows.Close()
		result := []EnvironmentView{}
		for rows.Next() {
			var v EnvironmentView
			if err := rows.Scan(&v.ID, &v.Name, &v.Customer); err != nil {
				continue
			}
			result = append(result, v)
		}
		c.JSON(http.StatusOK, result)
	}
}

type createOrgRequest struct {
	CustomerName    string `json:"customer_name" binding:"required"`
	EnvironmentName string `json:"environment_name" binding:"required"`
}

func CreateOrganization(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createOrgRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		tx, err := db.Begin(context.Background())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
		defer tx.Rollback(context.Background())

		var customerID int
		if err := tx.QueryRow(context.Background(),
			`INSERT INTO customers (name) VALUES ($1) RETURNING id`,
			req.CustomerName,
		).Scan(&customerID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}

		var envID int
		if err := tx.QueryRow(context.Background(),
			`INSERT INTO environments (customer_id, name) VALUES ($1, $2) RETURNING id`,
			customerID, req.EnvironmentName,
		).Scan(&envID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}

		if err := tx.Commit(context.Background()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}

		// Seed default panels for the new environment (best-effort)
		_ = db_pkg.SeedDefaultPanels(context.Background(), db, envID)

		c.Status(http.StatusCreated)
	}
}
