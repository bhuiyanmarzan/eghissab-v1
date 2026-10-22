package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                 string
	Env                  string
	DatabaseURL          string
	MigrationDatabaseURL string
	DBMaxOpenConns       int
	DBMaxIdleConns       int
	DBConnMaxLifetime    time.Duration
	DBConnMaxIdleTime    time.Duration
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

	migrationDatabaseURL := os.Getenv("MIGRATION_DATABASE_URL")
	if migrationDatabaseURL == "" {
		// Fallback to databaseURL if not separately configured
		migrationDatabaseURL = databaseURL
	}

	return Config{
		Port:                 port,
		Env:                  env,
		DatabaseURL:          databaseURL,
		MigrationDatabaseURL: migrationDatabaseURL,
		DBMaxOpenConns:       getEnvAsInt("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns:       getEnvAsInt("DB_MAX_IDLE_CONNS", 25),
		DBConnMaxLifetime:    getEnvAsDuration("DB_CONN_MAX_LIFETIME", 5*time.Minute),
		DBConnMaxIdleTime:    getEnvAsDuration("DB_CONN_MAX_IDLE_TIME", 5*time.Minute),
	}
}

func getEnvAsInt(key string, defaultVal int) int {
	valStr := os.Getenv(key)
	if valStr == "" {
		return defaultVal
	}
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return defaultVal
	}
	return val
}

func getEnvAsDuration(key string, defaultVal time.Duration) time.Duration {
	valStr := os.Getenv(key)
	if valStr == "" {
		return defaultVal
	}
	val, err := time.ParseDuration(valStr)
	if err != nil {
		return defaultVal
	}
	return val
}
