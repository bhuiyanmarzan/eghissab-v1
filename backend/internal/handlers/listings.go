package handlers

import (
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/modules/listing"
)

// ListingHandler wraps listing.Handler for backwards compatibility.
type ListingHandler struct {
	handler *listing.Handler
}

// NewListingHandler constructs a legacy ListingHandler forwarding to the listing module.
func NewListingHandler(db *sql.DB, logger *slog.Logger) *ListingHandler {
	m := listing.NewModule(db, logger)
	return &ListingHandler{
		handler: m.Handler,
	}
}

func (lh ListingHandler) List(w http.ResponseWriter, r *http.Request) {
	lh.handler.List(w, r)
}

func (lh ListingHandler) Delete(w http.ResponseWriter, r *http.Request) {
	lh.handler.Delete(w, r)
}

func (lh ListingHandler) Create(w http.ResponseWriter, r *http.Request) {
	lh.handler.Create(w, r)
}
