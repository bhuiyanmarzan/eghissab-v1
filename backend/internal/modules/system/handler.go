package system

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
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
	if logger == nil {
		logger = slog.Default()
	}
	return &Module{
		Service:     service,
		RequireAuth: requireAuth,
		logger:      logger.With(slog.String("module", "system")),
	}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux) {
	// Audit Events
	mux.Handle("GET /organizations/{id}/audit-events", m.RequireAuth(http.HandlerFunc(m.listOrgAuditEvents)))
	mux.Handle("GET /api/organizations/{id}/audit-events", m.RequireAuth(http.HandlerFunc(m.listOrgAuditEvents)))

	mux.Handle("GET /stores/{id}/audit-events", m.RequireAuth(http.HandlerFunc(m.listStoreAuditEvents)))
	mux.Handle("GET /api/stores/{id}/audit-events", m.RequireAuth(http.HandlerFunc(m.listStoreAuditEvents)))

	mux.Handle("POST /stores/{id}/audit-events", m.RequireAuth(http.HandlerFunc(m.recordStoreAuditEvent)))
	mux.Handle("POST /api/stores/{id}/audit-events", m.RequireAuth(http.HandlerFunc(m.recordStoreAuditEvent)))

	// Background Jobs
	mux.Handle("GET /system/jobs", m.RequireAuth(http.HandlerFunc(m.listJobs)))
	mux.Handle("GET /api/system/jobs", m.RequireAuth(http.HandlerFunc(m.listJobs)))

	mux.Handle("POST /system/jobs", m.RequireAuth(http.HandlerFunc(m.createJob)))
	mux.Handle("POST /api/system/jobs", m.RequireAuth(http.HandlerFunc(m.createJob)))

	mux.Handle("GET /system/jobs/{id}", m.RequireAuth(http.HandlerFunc(m.getJob)))
	mux.Handle("GET /api/system/jobs/{id}", m.RequireAuth(http.HandlerFunc(m.getJob)))

	mux.Handle("GET /system/jobs/{id}/attempts", m.RequireAuth(http.HandlerFunc(m.listJobAttempts)))
	mux.Handle("GET /api/system/jobs/{id}/attempts", m.RequireAuth(http.HandlerFunc(m.listJobAttempts)))

	mux.Handle("POST /system/jobs/{id}/retry", m.RequireAuth(http.HandlerFunc(m.retryJob)))
	mux.Handle("POST /api/system/jobs/{id}/retry", m.RequireAuth(http.HandlerFunc(m.retryJob)))

	// Outbox Events (system inspection)
	mux.Handle("GET /system/outbox", m.RequireAuth(http.HandlerFunc(m.listOutboxEvents)))
	mux.Handle("GET /api/system/outbox", m.RequireAuth(http.HandlerFunc(m.listOutboxEvents)))

	// File Assets
	mux.Handle("GET /files/{id}", m.RequireAuth(http.HandlerFunc(m.getFileAsset)))
	mux.Handle("GET /api/files/{id}", m.RequireAuth(http.HandlerFunc(m.getFileAsset)))

	mux.Handle("GET /invoices/{id}/pdf", m.RequireAuth(http.HandlerFunc(m.getInvoicePDF)))
	mux.Handle("GET /api/invoices/{id}/pdf", m.RequireAuth(http.HandlerFunc(m.getInvoicePDF)))

	// Webhooks (Public ingress with idempotent deduplication)
	mux.HandleFunc("POST /webhooks/{provider}", m.ingestWebhook)
	mux.HandleFunc("POST /api/webhooks/{provider}", m.ingestWebhook)
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
	case errors.Is(err, ErrAlreadyExists):
		httpx.Error(w, http.StatusConflict, "Resource already exists", httpx.CodeConflict)
	case errors.Is(err, ErrForbidden):
		httpx.Error(w, http.StatusForbidden, "Forbidden: insufficient permissions", httpx.CodeForbidden)
	default:
		m.logger.Error("system operation failed", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "Internal server error", httpx.CodeInternalError)
	}
}

// Audit Events Handlers
func (m *Module) listOrgAuditEvents(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	orgID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid organization id", httpx.CodeValidationFailed, "id")
		return
	}

	filter := ListAuditEventsFilter{
		OrganizationID: &orgID,
		Action:         r.URL.Query().Get("action"),
		StartDate:      r.URL.Query().Get("start_date"),
		EndDate:        r.URL.Query().Get("end_date"),
	}
	if l := r.URL.Query().Get("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		filter.Offset, _ = strconv.Atoi(o)
	}

	events, err := m.Service.ListAuditEvents(r.Context(), tc.UserID, filter)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, events)
}

func (m *Module) listStoreAuditEvents(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	storeID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid store id", httpx.CodeValidationFailed, "id")
		return
	}

	filter := ListAuditEventsFilter{
		StoreID:   &storeID,
		Action:    r.URL.Query().Get("action"),
		StartDate: r.URL.Query().Get("start_date"),
		EndDate:   r.URL.Query().Get("end_date"),
	}
	if l := r.URL.Query().Get("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		filter.Offset, _ = strconv.Atoi(o)
	}

	events, err := m.Service.ListAuditEvents(r.Context(), tc.UserID, filter)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, events)
}

func (m *Module) recordStoreAuditEvent(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	storeID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid store id", httpx.CodeValidationFailed, "id")
		return
	}

	var req RecordAuditRequest
	if err := decode(w, r, &req); err != nil {
		m.fail(w, err)
		return
	}
	if err := req.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	event, err := m.Service.RecordAudit(r.Context(), &tc.UserID, nil, &storeID, req.Action, req.Details)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, event)
}

// Background Jobs Handlers
func (m *Module) listJobs(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	jobType := r.URL.Query().Get("type")
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		limit, _ = strconv.Atoi(l)
	}

	jobs, err := m.Service.ListJobs(r.Context(), status, jobType, limit)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, jobs)
}

func (m *Module) createJob(w http.ResponseWriter, r *http.Request) {
	var req CreateJobRequest
	if err := decode(w, r, &req); err != nil {
		m.fail(w, err)
		return
	}
	if err := req.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	job, err := m.Service.EnqueueJob(r.Context(), nil, req.Type, req.Payload, nil, req.MaxAttempts)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, job)
}

func (m *Module) getJob(w http.ResponseWriter, r *http.Request) {
	jobID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid job id", httpx.CodeValidationFailed, "id")
		return
	}

	job, err := m.Service.GetJob(r.Context(), jobID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, job)
}

func (m *Module) listJobAttempts(w http.ResponseWriter, r *http.Request) {
	jobID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid job id", httpx.CodeValidationFailed, "id")
		return
	}

	attempts, err := m.Service.ListJobAttempts(r.Context(), jobID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, attempts)
}

func (m *Module) retryJob(w http.ResponseWriter, r *http.Request) {
	jobID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid job id", httpx.CodeValidationFailed, "id")
		return
	}

	job, err := m.Service.RetryJob(r.Context(), jobID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, job)
}

// Outbox Events Handler
func (m *Module) listOutboxEvents(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		limit, _ = strconv.Atoi(l)
	}

	events, err := m.Service.ListOutboxEvents(r.Context(), limit)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, events)
}

// File Assets Handlers
func (m *Module) getFileAsset(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	fileID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid file id", httpx.CodeValidationFailed, "id")
		return
	}

	asset, err := m.Service.GetFileAsset(r.Context(), tc.UserID, fileID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, asset)
}

func (m *Module) getInvoicePDF(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	invoiceID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "id")
		return
	}

	asset, err := m.Service.GetFileAssetByInvoiceID(r.Context(), tc.UserID, invoiceID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, asset)
}

// Webhook Handlers
func (m *Module) ingestWebhook(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if provider == "" {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "provider is required", httpx.CodeValidationFailed, "provider")
		return
	}

	var req IngestWebhookRequest
	if err := decode(w, r, &req); err != nil {
		m.fail(w, err)
		return
	}
	if err := req.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	receipt, err := m.Service.IngestWebhook(r.Context(), provider, req)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, receipt)
}
