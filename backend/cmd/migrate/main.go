package main

import (
	"errors"
	"log"
	"os"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/config"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatalf("usage: migrate <up | down>")
	}

	cfg := config.MustLoad()

	m, err := migrate.New(
		"file://migrations",
		cfg.MigrationDatabaseURL,
	)
	if err != nil {
		log.Fatalf("migration.New: %v", err)
	}

	switch os.Args[1] {
	case "up":
		if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			log.Fatal(err)
		}
		log.Println("migration up applied")
	case "down":
		if err := m.Steps(-1); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			log.Fatal(err)
		}
		log.Println("migration down applied")

	case "down-all":
		if err := m.Down(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			log.Fatal(err)
		}
		log.Println("migration down all applied")

	default:
		log.Fatalf("unknown command: %s", os.Args[1])
	}
}
