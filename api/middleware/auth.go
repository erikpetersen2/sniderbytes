package middleware

import (
	"context"
	"net/http"
	"strings"
	"sync"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	jwksMu   sync.RWMutex
	jwksInst keyfunc.Keyfunc
)

func initJWKS(jwksURL string) error {
	jwksMu.Lock()
	defer jwksMu.Unlock()
	if jwksInst != nil {
		return nil
	}
	kf, err := keyfunc.NewDefaultCtx(context.Background(), []string{jwksURL})
	if err != nil {
		return err
	}
	jwksInst = kf
	return nil
}

// mapGroups maps Keycloak group paths to a sniderbytes role and any customer
// names the user should be auto-assigned to.
//
//	Gamewarden/employee/grafana-admin    → admin
//	Gamewarden/employee/grafana-viewer   → viewer
//	Customer/<name>/logging-access       → viewer + auto-assign <name> clusters
func mapGroups(groups []string) (role string, customerNames []string) {
	for _, g := range groups {
		g = strings.TrimPrefix(g, "/")
		switch g {
		case "Gamewarden/employee/grafana-admin":
			role = "admin"
		case "Gamewarden/employee/grafana-viewer":
			if role != "admin" {
				role = "viewer"
			}
		default:
			parts := strings.SplitN(g, "/", 3)
			if len(parts) == 3 && parts[0] == "Customer" && parts[2] == "logging-access" {
				customerNames = append(customerNames, parts[1])
				if role != "admin" {
					role = "viewer"
				}
			}
		}
	}
	return role, customerNames
}

// Auth validates the bearer token. It first attempts local HMAC validation
// (issued by /api/auth/login). If that fails it falls back to Keycloak JWKS
// validation for tokens injected by authservice.
func Auth(db *pgxpool.Pool, jwtSecret, jwksURL string) gin.HandlerFunc {
	if err := initJWKS(jwksURL); err != nil {
		panic("failed to initialize Keycloak JWKS: " + err.Error())
	}

	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")

		// --- local HMAC token (issued by /api/auth/login) ---
		localToken, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})
		if err == nil && localToken.Valid {
			claims, ok := localToken.Claims.(jwt.MapClaims)
			if !ok {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
				return
			}
			c.Set("userID", int(claims["user_id"].(float64)))
			c.Set("role", claims["role"].(string))
			c.Set("username", claims["username"].(string))
			c.Next()
			return
		}

		// --- Keycloak JWT (injected by authservice) ---
		jwksMu.RLock()
		kf := jwksInst
		jwksMu.RUnlock()

		kcToken, err := jwt.Parse(tokenStr, kf.Keyfunc)
		if err != nil || !kcToken.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		claims, ok := kcToken.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}

		username, _ := claims["preferred_username"].(string)
		if username == "" {
			username, _ = claims["sub"].(string)
		}

		var groups []string
		if raw, ok := claims["groups"].([]interface{}); ok {
			for _, g := range raw {
				if s, ok := g.(string); ok {
					groups = append(groups, s)
				}
			}
		}

		role, customerNames := mapGroups(groups)
		if role == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "no sniderbytes access"})
			return
		}

		// JIT upsert
		var userID int
		if err := db.QueryRow(context.Background(),
			`INSERT INTO users (username, password_hash, role)
			 VALUES ($1, '', $2)
			 ON CONFLICT (username) DO UPDATE SET role = EXCLUDED.role
			 RETURNING id`,
			username, role,
		).Scan(&userID); err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "db error"})
			return
		}

		for _, name := range customerNames {
			_, _ = db.Exec(context.Background(), `
				INSERT INTO user_cluster_access (user_id, cluster_id)
				SELECT $1, c.id
				FROM clusters c
				JOIN environments e ON e.id = c.environment_id
				JOIN customers cu ON cu.id = e.customer_id
				WHERE cu.name = $2
				ON CONFLICT DO NOTHING
			`, userID, name)
		}

		c.Set("userID", userID)
		c.Set("role", role)
		c.Set("username", username)
		c.Next()
	}
}
