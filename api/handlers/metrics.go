package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sniderbytes/api/grafana"
)

type MetricsHandler struct {
	DB       *pgxpool.Pool
	Clusters *ClustersHandler
}

func (h *MetricsHandler) GetMetrics(c *gin.Context) {
	userID := c.MustGet("userID").(int)
	role := c.MustGet("role").(string)

	clusterID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid cluster id"})
		return
	}

	ok, err := h.Clusters.hasAccess(userID, role, clusterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	var grafanaURL, grafanaToken, grafanaAuthType, grafanaClientID, grafanaTokenURL string
	if err := h.DB.QueryRow(context.Background(),
		`SELECT grafana_url, grafana_token, grafana_auth_type, grafana_client_id, grafana_token_url FROM clusters WHERE id = $1`, clusterID,
	).Scan(&grafanaURL, &grafanaToken, &grafanaAuthType, &grafanaClientID, &grafanaTokenURL); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not found"})
		return
	}

	payload, err := grafana.FetchMetrics(grafana.Config{
		URL:      grafanaURL,
		AuthType: grafanaAuthType,
		Token:    grafanaToken,
		ClientID: grafanaClientID,
		TokenURL: grafanaTokenURL,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch metrics"})
		return
	}
	payload.ClusterID = clusterID
	c.JSON(http.StatusOK, payload)
}

func (h *MetricsHandler) GetAlerts(c *gin.Context) {
	userID := c.MustGet("userID").(int)
	role := c.MustGet("role").(string)

	clusterID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid cluster id"})
		return
	}

	ok, err := h.Clusters.hasAccess(userID, role, clusterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	var grafanaURL, grafanaToken, grafanaAuthType, grafanaClientID, grafanaTokenURL string
	if err := h.DB.QueryRow(context.Background(),
		`SELECT grafana_url, grafana_token, grafana_auth_type, grafana_client_id, grafana_token_url FROM clusters WHERE id = $1`, clusterID,
	).Scan(&grafanaURL, &grafanaToken, &grafanaAuthType, &grafanaClientID, &grafanaTokenURL); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not found"})
		return
	}

	alerts, isMock, err := grafana.FetchAlerts(grafana.Config{
		URL:      grafanaURL,
		AuthType: grafanaAuthType,
		Token:    grafanaToken,
		ClientID: grafanaClientID,
		TokenURL: grafanaTokenURL,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch alerts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cluster_id": clusterID,
		"alerts":     alerts,
		"mock":       isMock,
	})
}
