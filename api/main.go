package main

import (
	"log"

	"github.com/sniderbytes/api/config"
	"github.com/sniderbytes/api/db"
	"github.com/sniderbytes/api/router"
)

func main() {
	cfg := config.Load()

	pool, err := db.Open(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(pool); err != nil {
		log.Fatalf("migration failed: %v", err)
	}
	log.Println("migrations applied")

	if err := db.Seed(pool); err != nil {
		log.Fatalf("seed failed: %v", err)
	}
	log.Println("seed complete")

	r := router.New(cfg, pool)
	log.Printf("starting server on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
