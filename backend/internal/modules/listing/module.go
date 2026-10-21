package listing

import (
	"database/sql"
	"log/slog"
	"net/http"
)

// Module encapsulates the listing bounded context.
type Module struct {
	Handler    *Handler
	Service    Service
	Repository Repository
}

// NewModule wires up repository, service, and handler layers for the listing module.
func NewModule(db *sql.DB, logger *slog.Logger) *Module {
	repo := NewPostgresRepository(db)
	svc := NewService(repo, logger)
	h := NewHandler(svc, logger)

	return &Module{
		Handler:    h,
		Service:    svc,
		Repository: repo,
	}
}

// RegisterRoutes mounts all HTTP endpoints belonging to this module on the router.
func (m *Module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /listings", m.Handler.List)
	mux.HandleFunc("POST /listings", m.Handler.Create)
	mux.HandleFunc("DELETE /listings/{id}", m.Handler.Delete)
}
