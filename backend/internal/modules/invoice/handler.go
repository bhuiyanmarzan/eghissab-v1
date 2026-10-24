package invoice

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
	// Invoices CRUD & Lifecycle
	mux.Handle("POST /stores/{id}/invoices", m.RequireAuth(http.HandlerFunc(m.createInvoice)))
	mux.Handle("POST /api/stores/{id}/invoices", m.RequireAuth(http.HandlerFunc(m.createInvoice)))

	mux.Handle("GET /stores/{id}/invoices", m.RequireAuth(http.HandlerFunc(m.listInvoices)))
	mux.Handle("GET /api/stores/{id}/invoices", m.RequireAuth(http.HandlerFunc(m.listInvoices)))

	mux.Handle("GET /stores/{id}/invoices/{invoice_id}", m.RequireAuth(http.HandlerFunc(m.getInvoice)))
	mux.Handle("GET /api/stores/{id}/invoices/{invoice_id}", m.RequireAuth(http.HandlerFunc(m.getInvoice)))

	mux.Handle("PATCH /stores/{id}/invoices/{invoice_id}", m.RequireAuth(http.HandlerFunc(m.updateInvoice)))
	mux.Handle("PATCH /api/stores/{id}/invoices/{invoice_id}", m.RequireAuth(http.HandlerFunc(m.updateInvoice)))

	mux.Handle("POST /stores/{id}/invoices/{invoice_id}/issue", m.RequireAuth(http.HandlerFunc(m.issueInvoice)))
	mux.Handle("POST /api/stores/{id}/invoices/{invoice_id}/issue", m.RequireAuth(http.HandlerFunc(m.issueInvoice)))

	mux.Handle("POST /stores/{id}/invoices/{invoice_id}/void", m.RequireAuth(http.HandlerFunc(m.voidInvoice)))
	mux.Handle("POST /api/stores/{id}/invoices/{invoice_id}/void", m.RequireAuth(http.HandlerFunc(m.voidInvoice)))

	// Invoice Payments
	mux.Handle("POST /stores/{id}/invoices/{invoice_id}/payments", m.RequireAuth(http.HandlerFunc(m.recordPayment)))
	mux.Handle("POST /api/stores/{id}/invoices/{invoice_id}/payments", m.RequireAuth(http.HandlerFunc(m.recordPayment)))

	mux.Handle("GET /stores/{id}/invoices/{invoice_id}/payments", m.RequireAuth(http.HandlerFunc(m.listPayments)))
	mux.Handle("GET /api/stores/{id}/invoices/{invoice_id}/payments", m.RequireAuth(http.HandlerFunc(m.listPayments)))

	// Invoice Adjustments (Credit/Debit Notes)
	mux.Handle("POST /stores/{id}/invoices/{invoice_id}/adjustments", m.RequireAuth(http.HandlerFunc(m.createAdjustment)))
	mux.Handle("POST /api/stores/{id}/invoices/{invoice_id}/adjustments", m.RequireAuth(http.HandlerFunc(m.createAdjustment)))

	mux.Handle("GET /stores/{id}/invoices/{invoice_id}/adjustments", m.RequireAuth(http.HandlerFunc(m.listAdjustments)))
	mux.Handle("GET /api/stores/{id}/invoices/{invoice_id}/adjustments", m.RequireAuth(http.HandlerFunc(m.listAdjustments)))

	// Consumer Decisions
	mux.Handle("POST /stores/{id}/invoices/{invoice_id}/decision", m.RequireAuth(http.HandlerFunc(m.recordDecision)))
	mux.Handle("POST /api/stores/{id}/invoices/{invoice_id}/decision", m.RequireAuth(http.HandlerFunc(m.recordDecision)))

	// Audit Trail Events
	mux.Handle("GET /stores/{id}/invoices/{invoice_id}/events", m.RequireAuth(http.HandlerFunc(m.listEvents)))
	mux.Handle("GET /api/stores/{id}/invoices/{invoice_id}/events", m.RequireAuth(http.HandlerFunc(m.listEvents)))
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
	case errors.Is(err, ErrAlreadyIssued):
		httpx.Error(w, http.StatusConflict, "Invoice is already issued and line items cannot be modified", httpx.CodeConflict)
	case errors.Is(err, ErrNotIssued):
		httpx.Error(w, http.StatusBadRequest, "Invoice must be in issued status to perform this operation", httpx.Code("bad_request"))
	case errors.Is(err, ErrAlreadyVoided):
		httpx.Error(w, http.StatusConflict, "Invoice is already voided", httpx.CodeConflict)
	case errors.Is(err, ErrAlreadyPaid):
		httpx.Error(w, http.StatusConflict, "Invoice is already fully paid", httpx.CodeConflict)
	case errors.Is(err, ErrOverpayment):
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "Payment amount exceeds remaining balance", httpx.CodeValidationFailed, "amount")
	case errors.Is(err, ErrConflict):
		httpx.Error(w, http.StatusConflict, "Conflict during invoice update", httpx.CodeConflict)
	default:
		m.logger.Error("invoice operation failed", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "Internal server error", httpx.CodeInternalError)
	}
}

func (m *Module) createInvoice(w http.ResponseWriter, r *http.Request) {
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

	var in CreateInvoiceRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.CreateInvoiceDraft(r.Context(), storeID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) getInvoice(w http.ResponseWriter, r *http.Request) {
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

	invoiceID, err := uuid.Parse(r.PathValue("invoice_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "invoice_id")
		return
	}

	res, err := m.Service.GetInvoice(r.Context(), storeID, invoiceID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) listInvoices(w http.ResponseWriter, r *http.Request) {
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

	var customerID *uuid.UUID
	if cidStr := r.URL.Query().Get("customer_id"); cidStr != "" {
		if cid, err := uuid.Parse(cidStr); err == nil {
			customerID = &cid
		}
	}
	status := r.URL.Query().Get("status")

	res, err := m.Service.ListInvoices(r.Context(), storeID, tc.UserID, customerID, status)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) updateInvoice(w http.ResponseWriter, r *http.Request) {
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

	invoiceID, err := uuid.Parse(r.PathValue("invoice_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "invoice_id")
		return
	}

	var in UpdateInvoiceRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.UpdateInvoiceDraft(r.Context(), storeID, invoiceID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) issueInvoice(w http.ResponseWriter, r *http.Request) {
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

	invoiceID, err := uuid.Parse(r.PathValue("invoice_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "invoice_id")
		return
	}

	res, err := m.Service.IssueInvoice(r.Context(), storeID, invoiceID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) voidInvoice(w http.ResponseWriter, r *http.Request) {
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

	invoiceID, err := uuid.Parse(r.PathValue("invoice_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "invoice_id")
		return
	}

	var in struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	if in.Reason == "" {
		in.Reason = "Voided by user request"
	}

	res, err := m.Service.VoidInvoice(r.Context(), storeID, invoiceID, tc.UserID, in.Reason)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) recordPayment(w http.ResponseWriter, r *http.Request) {
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

	invoiceID, err := uuid.Parse(r.PathValue("invoice_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "invoice_id")
		return
	}

	var in RecordPaymentRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.RecordPayment(r.Context(), storeID, invoiceID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) listPayments(w http.ResponseWriter, r *http.Request) {
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

	invoiceID, err := uuid.Parse(r.PathValue("invoice_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "invoice_id")
		return
	}

	res, err := m.Service.ListPayments(r.Context(), storeID, invoiceID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) createAdjustment(w http.ResponseWriter, r *http.Request) {
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

	invoiceID, err := uuid.Parse(r.PathValue("invoice_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "invoice_id")
		return
	}

	var in CreateAdjustmentRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.CreateAdjustment(r.Context(), storeID, invoiceID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) listAdjustments(w http.ResponseWriter, r *http.Request) {
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

	invoiceID, err := uuid.Parse(r.PathValue("invoice_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "invoice_id")
		return
	}

	res, err := m.Service.ListAdjustments(r.Context(), storeID, invoiceID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) recordDecision(w http.ResponseWriter, r *http.Request) {
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

	invoiceID, err := uuid.Parse(r.PathValue("invoice_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "invoice_id")
		return
	}

	var in InvoiceDecisionRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.RecordDecision(r.Context(), storeID, invoiceID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) listEvents(w http.ResponseWriter, r *http.Request) {
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

	invoiceID, err := uuid.Parse(r.PathValue("invoice_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invoice id", httpx.CodeValidationFailed, "invoice_id")
		return
	}

	res, err := m.Service.ListEvents(r.Context(), storeID, invoiceID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}
