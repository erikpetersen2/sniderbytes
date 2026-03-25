package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sniderbytes/api/models"
)

func Me(c *gin.Context) {
	c.JSON(http.StatusOK, models.User{
		ID:       c.MustGet("userID").(int),
		Username: c.MustGet("username").(string),
		Role:     c.MustGet("role").(string),
	})
}
