package config

import (
	"os"
)

type Config struct {
	DBUrl     string
	JWTSecret string
	Port      string
	Env       string
}

func Load() *Config {
	return &Config{
		DBUrl:     getEnv("DB_URL", "postgres://sniderbytes:sniderbytes@localhost:5432/sniderbytes?sslmode=disable"),
		JWTSecret: getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		Port:      getEnv("PORT", "8080"),
		Env:       getEnv("ENV", "development"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
