package listing

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/httpx"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/middleware"
)

// Handler serves HTTP endpoints for the listing domain.
type Handler struct {
	service Service
	logger  *slog.Logger
}

// NewHandler constructs a new listing HTTP handler.
func NewHandler(service Service, logger *slog.Logger) *Handler {
	return &Handler{
		service: service,
		logger:  logger,
	}
}

// List handles GET /listings requests.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestId := middleware.RequestIDFromContext(ctx)

	listings, err := h.service.List(ctx)
	if err != nil {
		h.logger.Error("failed to fetch listings", "request_id", requestId, "err", err)
		httpx.Error(w, http.StatusInternalServerError, "something went wrong", httpx.CodeInternalError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(ToListingResponses(listings))
}

// Create handles POST /listings requests.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestId := middleware.RequestIDFromContext(ctx)

	var req CreateListingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("failed to decode", "request_id", requestId, "err", err)
		httpx.Error(w, http.StatusBadRequest, "invalid body", httpx.CodeMalformedJson)
		return
	}

	out, err := h.service.Create(ctx, req)
	if err != nil {
		var verr *ValidationError
		if errors.As(err, &verr) {
			httpx.ValidationError(w, http.StatusUnprocessableEntity, verr.Msg, httpx.CodeValidationFailed, verr.Field)
			return
		}

		h.logger.Error("failed to insert", "request_id", requestId, "err", err)
		httpx.Error(w, http.StatusInternalServerError, "something went wrong", httpx.CodeInternalError)
		return
	}

	h.logger.Info("listing created", "request_id", requestId, "listing_id", out.ID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(out)
}

// Delete handles DELETE /listings/{id} requests.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestId := middleware.RequestIDFromContext(ctx)
	id := r.PathValue("id")

	if err := h.service.Delete(ctx, id); err != nil {
		h.logger.Error("delete failed", "request_id", requestId, "listing_id", id, "err", err)
		httpx.Error(w, http.StatusInternalServerError, "Something went wrong", httpx.CodeInternalError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
