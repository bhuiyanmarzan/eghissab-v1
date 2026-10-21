package db

import (
	"database/sql"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
)

// Connect forwards to internal/database.Connect for backwards compatibility.
func Connect(databaseURL string) (*sql.DB, error) {
	return database.Connect(databaseURL)
}
