package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	Env         string
	DatabaseURL string
}

func MustLoad() Config {
	// Attempt to load .env from current directory, then parent directory
	_ = godotenv.Load(".env", "../.env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		user := os.Getenv("POSTGRES_USER")
		pass := os.Getenv("POSTGRES_PASSWORD")
		dbName := os.Getenv("POSTGRES_DB")
		pgPort := os.Getenv("POSTGRES_PORT")
		if pgPort == "" {
			pgPort = "5432"
		}
		if user != "" && pass != "" && dbName != "" {
			databaseURL = fmt.Sprintf("postgres://%s:%s@localhost:%s/%s?sslmode=disable", user, pass, pgPort, dbName)
		} else {
			panic("DATABASE_URL is required (set in .env or provide POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB)")
		}
	}

	return Config{
		Port:        port,
		Env:         env,
		DatabaseURL: databaseURL,
	}
}
