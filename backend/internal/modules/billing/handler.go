package billing

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/httpx"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/tenant"
	"github.com/google/uuid"
)

type Module struct {
	Service     *Service
	RequireAuth func(http.Handler) http.Handler
	logger      *slog.Logger
}

func NewModule(service *Service, requireAuth func(http.Handler) http.Handler, logger *slog.Logger) *Module {
	return &Module{
		Service:     service,
		RequireAuth: requireAuth,
		logger:      logger,
	}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) {
	mux.Handle("GET /billing/plans", m.RequireAuth(http.HandlerFunc(m.listPlans)))
	mux.Handle("GET /api/billing/plans", m.RequireAuth(http.HandlerFunc(m.listPlans)))

	mux.Handle("GET /billing/subscription", m.RequireAuth(http.HandlerFunc(m.getSubscription)))
	mux.Handle("GET /api/billing/subscription", m.RequireAuth(http.HandlerFunc(m.getSubscription)))

	mux.Handle("POST /billing/subscribe", m.RequireAuth(http.HandlerFunc(m.subscribe)))
	mux.Handle("POST /api/billing/subscribe", m.RequireAuth(http.HandlerFunc(m.subscribe)))

	mux.Handle("POST /billing/cancel", m.RequireAuth(http.HandlerFunc(m.cancel)))
	mux.Handle("POST /api/billing/cancel", m.RequireAuth(http.HandlerFunc(m.cancel)))

	mux.Handle("GET /billing/invoices", m.RequireAuth(http.HandlerFunc(m.listInvoices)))
	mux.Handle("GET /api/billing/invoices", m.RequireAuth(http.HandlerFunc(m.listInvoices)))

	mux.Handle("POST /billing/usage", m.RequireAuth(http.HandlerFunc(m.recordUsage)))
	mux.Handle("POST /api/billing/usage", m.RequireAuth(http.HandlerFunc(m.recordUsage)))

	// Webhooks are unauthenticated by user session, secured by provider signature / headers
	mux.HandleFunc("POST /billing/webhooks/{provider}", m.handleWebhook)
	mux.HandleFunc("POST /api/billing/webhooks/{provider}", m.handleWebhook)
}

func decode(w http.ResponseWriter, r *http.Request, v any) error {
	if ct := strings.Split(r.Header.Get("Content-Type"), ";")[0]; strings.TrimSpace(ct) != "application/json" {
		return &ValidationError{Field: "Content-Type", Msg: "Content-Type must be application/json"}
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return &ValidationError{Field: "body", Msg: "malformed JSON body"}
	}
	if d.Decode(&struct{}{}) != io.EOF {
		return &ValidationError{Field: "body", Msg: "a single JSON object is required"}
	}
	return nil
}

func (m *Module) fail(w http.ResponseWriter, err error) {
	w.Header().Set("Cache-Control", "no-store")
	var verr *ValidationError
	if errors.As(err, &verr) {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, verr.Msg, httpx.CodeValidationFailed, verr.Field)
		return
	}
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Error(w, http.StatusNotFound, "Resource not found", httpx.CodeNotFound)
	case errors.Is(err, ErrForbidden):
		httpx.Error(w, http.StatusForbidden, "Forbidden: insufficient permissions", httpx.CodeForbidden)
	case errors.Is(err, ErrPlanNotFound):
		httpx.Error(w, http.StatusBadRequest, "Requested plan does not exist", httpx.Code("plan_not_found"))
	case errors.Is(err, ErrNoActiveSub):
		httpx.Error(w, http.StatusNotFound, "No active subscription found for organization", httpx.Code("no_active_subscription"))
	default:
		m.logger.Error("billing operation failed", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "Internal server error", httpx.CodeInternalError)
	}
}

func (m *Module) listPlans(w http.ResponseWriter, r *http.Request) {
	res, err := m.Service.ListPlans(r.Context())
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) getSubscription(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	orgIDStr := r.URL.Query().Get("organization_id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "valid organization_id query parameter is required", httpx.CodeValidationFailed, "organization_id")
		return
	}

	res, err := m.Service.GetSubscription(r.Context(), orgID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) subscribe(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in SubscribeRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.Subscribe(r.Context(), tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) cancel(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in CancelSubscriptionRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	if err := m.Service.Cancel(r.Context(), tc.UserID, in); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "subscription canceled successfully"})
}

func (m *Module) listInvoices(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	orgIDStr := r.URL.Query().Get("organization_id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "valid organization_id query parameter is required", httpx.CodeValidationFailed, "organization_id")
		return
	}

	res, err := m.Service.ListInvoices(r.Context(), orgID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) recordUsage(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in RecordUsageRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	if err := m.Service.RecordUsage(r.Context(), tc.UserID, in); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"message": "usage recorded successfully"})
}

func (m *Module) handleWebhook(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if provider == "" {
		httpx.Error(w, http.StatusBadRequest, "provider is required", httpx.Code("bad_request"))
		return
	}

	var in WebhookPayload
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	isNew, err := m.Service.ProcessWebhook(r.Context(), provider, in)
	if err != nil {
		m.fail(w, err)
		return
	}

	if !isNew {
		// Idempotent duplicate: return 200 OK acknowledging receipt without re-processing
		httpx.JSON(w, http.StatusOK, map[string]any{
			"status":    "ignored",
			"duplicate": true,
			"message":   "event already processed",
		})
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"status":  "received",
		"message": "webhook event received and queued",
	})
}
