package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sniderbytes/api/models"
	"golang.org/x/crypto/bcrypt"
)

type UsersHandler struct {
	DB *pgxpool.Pool
}

func (h *UsersHandler) List(c *gin.Context) {
	rows, err := h.DB.Query(context.Background(),
		`SELECT id, username, role FROM users ORDER BY username`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role); err != nil {
			continue
		}
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

type createUserRequest struct {
	Username   string `json:"username" binding:"required"`
	Password   string `json:"password" binding:"required"`
	Role       string `json:"role" binding:"required,oneof=admin viewer"`
	ClusterIDs []int  `json:"cluster_ids"`
}

func (h *UsersHandler) Create(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	tx, err := h.DB.Begin(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	defer tx.Rollback(context.Background())

	var userID int
	err = tx.QueryRow(context.Background(),
		`INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id`,
		req.Username, string(hash), req.Role,
	).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
		return
	}

	if req.Role == "viewer" {
		for _, clusterID := range req.ClusterIDs {
			if _, err := tx.Exec(context.Background(),
				`INSERT INTO user_cluster_access (user_id, cluster_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				userID, clusterID,
			); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign cluster access"})
				return
			}
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}

	c.JSON(http.StatusCreated, models.User{ID: userID, Username: req.Username, Role: req.Role})
}

func (h *UsersHandler) Delete(c *gin.Context) {
	callerID := c.MustGet("userID").(int)

	var targetID int
	if err := h.DB.QueryRow(context.Background(),
		`SELECT id FROM users WHERE id = $1`, c.Param("id"),
	).Scan(&targetID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if callerID == targetID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete your own account"})
		return
	}

	if _, err := h.DB.Exec(context.Background(),
		`DELETE FROM users WHERE id = $1`, targetID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}

	c.Status(http.StatusNoContent)
}
