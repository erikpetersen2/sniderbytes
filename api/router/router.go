package router

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sniderbytes/api/config"
	"github.com/sniderbytes/api/handlers"
	"github.com/sniderbytes/api/middleware"
)

func New(cfg *config.Config, pool *pgxpool.Pool) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	r.Use(corsMiddleware())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	clustersHandler := &handlers.ClustersHandler{DB: pool}
	metricsHandler := &handlers.MetricsHandler{DB: pool, Clusters: clustersHandler}
	usersHandler := &handlers.UsersHandler{DB: pool}

	protected := r.Group("/api", middleware.Auth(pool, cfg.KeycloakJWKSURL))
	protected.GET("/auth/me", handlers.Me)
	protected.GET("/clusters", clustersHandler.List)
	protected.GET("/clusters/:id/metrics", metricsHandler.GetMetrics)
	protected.GET("/clusters/:id/alerts", metricsHandler.GetAlerts)

	admin := protected.Group("/", middleware.AdminOnly())
	admin.GET("/users", usersHandler.List)

	return r
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
