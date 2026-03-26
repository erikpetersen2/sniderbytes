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

	authHandler := &handlers.AuthHandler{DB: pool, JWTSecret: cfg.JWTSecret}
	clustersHandler := &handlers.ClustersHandler{DB: pool}
	metricsHandler := &handlers.MetricsHandler{DB: pool, Clusters: clustersHandler}
	usersHandler := &handlers.UsersHandler{DB: pool}
	adminClustersHandler := &handlers.AdminClustersHandler{DB: pool}

	api := r.Group("/api")
	api.POST("/auth/login", authHandler.Login)

	protected := api.Group("/", middleware.Auth(pool, cfg.JWTSecret, cfg.KeycloakJWKSURL))
	protected.GET("/auth/me", handlers.Me)
	protected.GET("/clusters", clustersHandler.List)
	protected.GET("/clusters/:id/metrics", metricsHandler.GetMetrics)
	protected.GET("/clusters/:id/namespaces", metricsHandler.GetNamespaces)
	protected.GET("/clusters/:id/alerts", metricsHandler.GetAlerts)
	protected.GET("/clusters/:id/panels", handlers.GetPanelsForCluster(pool))
	protected.POST("/clusters/:id/panels", handlers.CreatePanelForCluster(pool))
	protected.PUT("/clusters/:id/panels/:panelId", handlers.UpdatePanelForCluster(pool))
	protected.DELETE("/clusters/:id/panels/:panelId", handlers.DeletePanelForCluster(pool))
	protected.POST("/clusters/:id/test-query", handlers.TestQueryForCluster(pool))

	adminGroup := protected.Group("/admin", middleware.AdminOnly())
	adminGroup.GET("/users", usersHandler.List)
	adminGroup.GET("/clusters", adminClustersHandler.List)
	adminGroup.POST("/clusters", adminClustersHandler.Create)
	adminGroup.PUT("/clusters/:id", adminClustersHandler.Update)
	adminGroup.DELETE("/clusters/:id", adminClustersHandler.Delete)
	adminGroup.GET("/environments", handlers.ListEnvironments(pool))
	adminGroup.POST("/organizations", handlers.CreateOrganization(pool))
	adminGroup.GET("/environments/:id/panels", handlers.ListPanels(pool))
	adminGroup.POST("/environments/:id/panels", handlers.CreatePanel(pool))
	adminGroup.POST("/environments/:id/test-query", handlers.TestPanelQuery(pool))
	adminGroup.PUT("/panels/:id", handlers.UpdatePanel(pool))
	adminGroup.DELETE("/panels/:id", handlers.DeletePanel(pool))

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
