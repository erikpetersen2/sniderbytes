package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sniderbytes/api/models"
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
