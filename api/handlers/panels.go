package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sniderbytes/api/grafana"
)

type PanelView struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Expr     string `json:"expr"`
	Unit     string `json:"unit"`
	Position int    `json:"position"`
}

type panelWriteRequest struct {
	Name     string `json:"name" binding:"required"`
	Expr     string `json:"expr" binding:"required"`
	Unit     string `json:"unit"`
	Position int    `json:"position"`
}

func ListPanels(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		envID := c.Param("id")
		rows, err := db.Query(context.Background(),
			`SELECT id, name, expr, unit, position FROM panels WHERE environment_id = $1 ORDER BY position, id`,
			envID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
		defer rows.Close()
		result := []PanelView{}
		for rows.Next() {
			var p PanelView
			if err := rows.Scan(&p.ID, &p.Name, &p.Expr, &p.Unit, &p.Position); err != nil {
				continue
			}
			result = append(result, p)
		}
		c.JSON(http.StatusOK, result)
	}
}

func CreatePanel(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		envID := c.Param("id")
		var req panelWriteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var id int
		if err := db.QueryRow(context.Background(),
			`INSERT INTO panels (environment_id, name, expr, unit, position) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
			envID, req.Name, req.Expr, req.Unit, req.Position,
		).Scan(&id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"id": id})
	}
}

func UpdatePanel(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req panelWriteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if _, err := db.Exec(context.Background(),
			`UPDATE panels SET name=$1, expr=$2, unit=$3, position=$4 WHERE id=$5`,
			req.Name, req.Expr, req.Unit, req.Position, c.Param("id"),
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func DeletePanel(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(context.Background(),
			`DELETE FROM panels WHERE id=$1`, c.Param("id"),
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

type testQueryRequest struct {
	Expr      string `json:"expr" binding:"required"`
	Namespace string `json:"namespace"`
}

// TestPanelQuery runs a PromQL expression against the first cluster in the
// environment that has a Grafana URL configured, and returns the scalar result.
func TestPanelQuery(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req testQueryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var grafanaURL, grafanaToken, grafanaAuthType, grafanaClientID, grafanaTokenURL string
		err := db.QueryRow(context.Background(), `
			SELECT grafana_url, grafana_token, grafana_auth_type, grafana_client_id, grafana_token_url
			FROM clusters
			WHERE environment_id = $1 AND grafana_url != ''
			ORDER BY id LIMIT 1`,
			c.Param("id"),
		).Scan(&grafanaURL, &grafanaToken, &grafanaAuthType, &grafanaClientID, &grafanaTokenURL)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "no configured cluster found for this environment"})
			return
		}

		nsValue := req.Namespace
		if nsValue == "" {
			nsValue = ".*"
		}
		expr := strings.ReplaceAll(req.Expr, "$namespace", nsValue)

		val, err := grafana.QueryPromQL(grafana.Config{
			URL:      grafanaURL,
			AuthType: grafanaAuthType,
			Token:    grafanaToken,
			ClientID: grafanaClientID,
			TokenURL: grafanaTokenURL,
		}, expr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"value": val})
	}
}
