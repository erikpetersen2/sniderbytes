package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sniderbytes/api/models"
)

type ClustersHandler struct {
	DB *pgxpool.Pool
}

func (h *ClustersHandler) List(c *gin.Context) {
	userID := c.MustGet("userID").(int)
	role := c.MustGet("role").(string)

	var rows []models.ClusterView

	if role == "admin" {
		r, err := h.DB.Query(context.Background(), `
			SELECT c.id, c.name, e.name AS environment, cu.name AS customer, c.grafana_url
			FROM clusters c
			JOIN environments e ON e.id = c.environment_id
			JOIN customers cu ON cu.id = e.customer_id
			ORDER BY cu.name, e.name, c.name
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
		defer r.Close()
		for r.Next() {
			var cv models.ClusterView
			if err := r.Scan(&cv.ID, &cv.Name, &cv.Environment, &cv.Customer, &cv.GrafanaURL); err != nil {
				continue
			}
			rows = append(rows, cv)
		}
	} else {
		r, err := h.DB.Query(context.Background(), `
			SELECT c.id, c.name, e.name AS environment, cu.name AS customer, c.grafana_url
			FROM clusters c
			JOIN environments e ON e.id = c.environment_id
			JOIN customers cu ON cu.id = e.customer_id
			JOIN user_cluster_access uca ON uca.cluster_id = c.id
			WHERE uca.user_id = $1
			ORDER BY cu.name, e.name, c.name
		`, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
		defer r.Close()
		for r.Next() {
			var cv models.ClusterView
			if err := r.Scan(&cv.ID, &cv.Name, &cv.Environment, &cv.Customer, &cv.GrafanaURL); err != nil {
				continue
			}
			rows = append(rows, cv)
		}
	}

	if rows == nil {
		rows = []models.ClusterView{}
	}
	c.JSON(http.StatusOK, rows)
}

func (h *ClustersHandler) hasAccess(userID int, role string, clusterID int) (bool, error) {
	if role == "admin" {
		return true, nil
	}
	var exists bool
	err := h.DB.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM user_cluster_access WHERE user_id=$1 AND cluster_id=$2)`,
		userID, clusterID,
	).Scan(&exists)
	return exists, err
}
