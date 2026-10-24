package consumer

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
	// Consumer Profile
	mux.Handle("GET /consumer/profile", m.RequireAuth(http.HandlerFunc(m.getProfile)))
	mux.Handle("GET /api/consumer/profile", m.RequireAuth(http.HandlerFunc(m.getProfile)))

	mux.Handle("POST /consumer/profile", m.RequireAuth(http.HandlerFunc(m.createProfile)))
	mux.Handle("POST /api/consumer/profile", m.RequireAuth(http.HandlerFunc(m.createProfile)))

	mux.Handle("PATCH /consumer/profile", m.RequireAuth(http.HandlerFunc(m.updatePreferences)))
	mux.Handle("PATCH /api/consumer/profile", m.RequireAuth(http.HandlerFunc(m.updatePreferences)))

	// Membership Requests (Consumer)
	mux.Handle("POST /consumer/membership-requests", m.RequireAuth(http.HandlerFunc(m.submitMembershipRequest)))
	mux.Handle("POST /api/consumer/membership-requests", m.RequireAuth(http.HandlerFunc(m.submitMembershipRequest)))

	mux.Handle("GET /consumer/membership-requests", m.RequireAuth(http.HandlerFunc(m.listConsumerMembershipRequests)))
	mux.Handle("GET /api/consumer/membership-requests", m.RequireAuth(http.HandlerFunc(m.listConsumerMembershipRequests)))

	// Membership Requests (Store Staff)
	mux.Handle("GET /stores/{id}/membership-requests", m.RequireAuth(http.HandlerFunc(m.listStoreMembershipRequests)))
	mux.Handle("GET /api/stores/{id}/membership-requests", m.RequireAuth(http.HandlerFunc(m.listStoreMembershipRequests)))

	mux.Handle("POST /stores/{id}/membership-requests/{request_id}/review", m.RequireAuth(http.HandlerFunc(m.reviewMembershipRequest)))
	mux.Handle("POST /api/stores/{id}/membership-requests/{request_id}/review", m.RequireAuth(http.HandlerFunc(m.reviewMembershipRequest)))

	// Customer Links (Consumer)
	mux.Handle("GET /consumer/customer-links", m.RequireAuth(http.HandlerFunc(m.listConsumerCustomerLinks)))
	mux.Handle("GET /api/consumer/customer-links", m.RequireAuth(http.HandlerFunc(m.listConsumerCustomerLinks)))

	mux.Handle("DELETE /consumer/customer-links/{id}", m.RequireAuth(http.HandlerFunc(m.revokeCustomerLink)))
	mux.Handle("DELETE /api/consumer/customer-links/{id}", m.RequireAuth(http.HandlerFunc(m.revokeCustomerLink)))

	// Customer Links (Store Staff)
	mux.Handle("GET /stores/{id}/customer-links", m.RequireAuth(http.HandlerFunc(m.listStoreCustomerLinks)))
	mux.Handle("GET /api/stores/{id}/customer-links", m.RequireAuth(http.HandlerFunc(m.listStoreCustomerLinks)))

	// Cross-Store Invoices (Consumer)
	mux.Handle("GET /consumer/invoices", m.RequireAuth(http.HandlerFunc(m.listConsumerInvoices)))
	mux.Handle("GET /api/consumer/invoices", m.RequireAuth(http.HandlerFunc(m.listConsumerInvoices)))

	mux.Handle("GET /consumer/invoices/{id}", m.RequireAuth(http.HandlerFunc(m.getConsumerInvoice)))
	mux.Handle("GET /api/consumer/invoices/{id}", m.RequireAuth(http.HandlerFunc(m.getConsumerInvoice)))

	mux.Handle("POST /consumer/invoices/{id}/decision", m.RequireAuth(http.HandlerFunc(m.recordInvoiceDecision)))
	mux.Handle("POST /api/consumer/invoices/{id}/decision", m.RequireAuth(http.HandlerFunc(m.recordInvoiceDecision)))

	mux.Handle("POST /consumer/invoices/{id}/claim-expense", m.RequireAuth(http.HandlerFunc(m.claimInvoiceExpense)))
	mux.Handle("POST /api/consumer/invoices/{id}/claim-expense", m.RequireAuth(http.HandlerFunc(m.claimInvoiceExpense)))

	// Expense Categories
	mux.Handle("GET /consumer/expense-categories", m.RequireAuth(http.HandlerFunc(m.listExpenseCategories)))
	mux.Handle("GET /api/consumer/expense-categories", m.RequireAuth(http.HandlerFunc(m.listExpenseCategories)))

	mux.Handle("POST /consumer/expense-categories", m.RequireAuth(http.HandlerFunc(m.createExpenseCategory)))
	mux.Handle("POST /api/consumer/expense-categories", m.RequireAuth(http.HandlerFunc(m.createExpenseCategory)))

	mux.Handle("PATCH /consumer/expense-categories/{id}", m.RequireAuth(http.HandlerFunc(m.updateExpenseCategory)))
	mux.Handle("PATCH /api/consumer/expense-categories/{id}", m.RequireAuth(http.HandlerFunc(m.updateExpenseCategory)))

	mux.Handle("DELETE /consumer/expense-categories/{id}", m.RequireAuth(http.HandlerFunc(m.deleteExpenseCategory)))
	mux.Handle("DELETE /api/consumer/expense-categories/{id}", m.RequireAuth(http.HandlerFunc(m.deleteExpenseCategory)))

	// Expense Entries
	mux.Handle("GET /consumer/expenses", m.RequireAuth(http.HandlerFunc(m.listExpenseEntries)))
	mux.Handle("GET /api/consumer/expenses", m.RequireAuth(http.HandlerFunc(m.listExpenseEntries)))

	mux.Handle("POST /consumer/expenses", m.RequireAuth(http.HandlerFunc(m.createExpenseEntry)))
	mux.Handle("POST /api/consumer/expenses", m.RequireAuth(http.HandlerFunc(m.createExpenseEntry)))

	mux.Handle("GET /consumer/expenses/{id}", m.RequireAuth(http.HandlerFunc(m.getExpenseEntry)))
	mux.Handle("GET /api/consumer/expenses/{id}", m.RequireAuth(http.HandlerFunc(m.getExpenseEntry)))

	mux.Handle("PATCH /consumer/expenses/{id}", m.RequireAuth(http.HandlerFunc(m.updateExpenseEntry)))
	mux.Handle("PATCH /api/consumer/expenses/{id}", m.RequireAuth(http.HandlerFunc(m.updateExpenseEntry)))

	mux.Handle("DELETE /consumer/expenses/{id}", m.RequireAuth(http.HandlerFunc(m.deleteExpenseEntry)))
	mux.Handle("DELETE /api/consumer/expenses/{id}", m.RequireAuth(http.HandlerFunc(m.deleteExpenseEntry)))

	// Expense Adjustments
	mux.Handle("GET /consumer/expenses/{id}/adjustments", m.RequireAuth(http.HandlerFunc(m.listExpenseAdjustments)))
	mux.Handle("GET /api/consumer/expenses/{id}/adjustments", m.RequireAuth(http.HandlerFunc(m.listExpenseAdjustments)))

	mux.Handle("POST /consumer/expenses/{id}/adjustments", m.RequireAuth(http.HandlerFunc(m.createExpenseAdjustment)))
	mux.Handle("POST /api/consumer/expenses/{id}/adjustments", m.RequireAuth(http.HandlerFunc(m.createExpenseAdjustment)))
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
	case errors.Is(err, ErrDuplicateClaim):
		httpx.Error(w, http.StatusConflict, "Invoice has already been claimed as an expense", httpx.CodeConflict)
	case errors.Is(err, ErrRequestClosed):
		httpx.Error(w, http.StatusConflict, "Membership request has already been reviewed or cancelled", httpx.CodeConflict)
	case errors.Is(err, ErrLinkInactive):
		httpx.Error(w, http.StatusBadRequest, "Customer link is inactive or revoked", httpx.Code("link_inactive"))
	default:
		m.logger.Error("consumer operation failed", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "Internal server error", httpx.CodeInternalError)
	}
}

// Profile Handlers
func (m *Module) getProfile(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	profile, err := m.Service.GetProfile(r.Context(), tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, profile)
}

func (m *Module) createProfile(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in CreateConsumerProfileRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	profile, err := m.Service.CreateProfile(r.Context(), tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusCreated, profile)
}

func (m *Module) updatePreferences(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in UpdateConsumerPreferencesRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	profile, err := m.Service.UpdatePreferences(r.Context(), tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, profile)
}

// Membership Requests Handlers
func (m *Module) submitMembershipRequest(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in CreateMembershipRequestRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.SubmitMembershipRequest(r.Context(), tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) listConsumerMembershipRequests(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	res, err := m.Service.ListConsumerMembershipRequests(r.Context(), tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) listStoreMembershipRequests(w http.ResponseWriter, r *http.Request) {
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

	status := r.URL.Query().Get("status")
	res, err := m.Service.ListStoreMembershipRequests(r.Context(), storeID, tc.UserID, status)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) reviewMembershipRequest(w http.ResponseWriter, r *http.Request) {
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

	requestID, err := uuid.Parse(r.PathValue("request_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid request id", httpx.CodeValidationFailed, "request_id")
		return
	}

	var in ReviewMembershipRequestRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.ReviewMembershipRequest(r.Context(), storeID, requestID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

// Customer Links Handlers
func (m *Module) listConsumerCustomerLinks(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	res, err := m.Service.ListConsumerCustomerLinks(r.Context(), tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) revokeCustomerLink(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	linkID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid customer link id", httpx.CodeValidationFailed, "id")
		return
	}

	if err := m.Service.RevokeCustomerLink(r.Context(), tc.UserID, linkID); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"revoked": true})
}

func (m *Module) listStoreCustomerLinks(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.ListStoreCustomerLinks(r.Context(), storeID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

// Cross-Store Invoices Handlers
func (m *Module) listConsumerInvoices(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	res, err := m.Service.ListConsumerInvoices(r.Context(), tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) getConsumerInvoice(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.GetConsumerInvoice(r.Context(), tc.UserID, invoiceID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) recordInvoiceDecision(w http.ResponseWriter, r *http.Request) {
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

	var in ConsumerInvoiceDecisionRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.RecordConsumerInvoiceDecision(r.Context(), tc.UserID, invoiceID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) claimInvoiceExpense(w http.ResponseWriter, r *http.Request) {
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

	var in ClaimInvoiceExpenseRequest
	if r.Body != nil && r.ContentLength > 0 {
		if err := decode(w, r, &in); err != nil {
			m.fail(w, err)
			return
		}
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.ClaimInvoiceExpense(r.Context(), tc.UserID, invoiceID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

// Expense Categories Handlers
func (m *Module) listExpenseCategories(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	res, err := m.Service.ListExpenseCategories(r.Context(), tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) createExpenseCategory(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in CreateExpenseCategoryRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.CreateExpenseCategory(r.Context(), tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) updateExpenseCategory(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	categoryID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid category id", httpx.CodeValidationFailed, "id")
		return
	}

	var in UpdateExpenseCategoryRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.UpdateExpenseCategory(r.Context(), tc.UserID, categoryID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) deleteExpenseCategory(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	categoryID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid category id", httpx.CodeValidationFailed, "id")
		return
	}

	if err := m.Service.DeleteExpenseCategory(r.Context(), tc.UserID, categoryID); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"deleted": true})
}

// Expense Entries Handlers
func (m *Module) listExpenseEntries(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var catIDPtr *uuid.UUID
	if catStr := strings.TrimSpace(r.URL.Query().Get("category_id")); catStr != "" {
		parsedCat, err := uuid.Parse(catStr)
		if err != nil {
			httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid category_id", httpx.CodeValidationFailed, "category_id")
			return
		}
		catIDPtr = &parsedCat
	}

	startDate := strings.TrimSpace(r.URL.Query().Get("start_date"))
	endDate := strings.TrimSpace(r.URL.Query().Get("end_date"))

	res, err := m.Service.ListExpenseEntries(r.Context(), tc.UserID, catIDPtr, startDate, endDate)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) createExpenseEntry(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in CreateExpenseEntryRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.CreateExpenseEntry(r.Context(), tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) getExpenseEntry(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	expenseID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid expense id", httpx.CodeValidationFailed, "id")
		return
	}

	res, err := m.Service.GetExpenseEntry(r.Context(), tc.UserID, expenseID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) updateExpenseEntry(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	expenseID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid expense id", httpx.CodeValidationFailed, "id")
		return
	}

	var in UpdateExpenseEntryRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.UpdateExpenseEntry(r.Context(), tc.UserID, expenseID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) deleteExpenseEntry(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	expenseID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid expense id", httpx.CodeValidationFailed, "id")
		return
	}

	if err := m.Service.DeleteExpenseEntry(r.Context(), tc.UserID, expenseID); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"deleted": true})
}

// Expense Adjustments Handlers
func (m *Module) listExpenseAdjustments(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	expenseID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid expense id", httpx.CodeValidationFailed, "id")
		return
	}

	res, err := m.Service.ListExpenseAdjustments(r.Context(), tc.UserID, expenseID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) createExpenseAdjustment(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	expenseID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid expense id", httpx.CodeValidationFailed, "id")
		return
	}

	var in CreateExpenseAdjustmentRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.CreateExpenseAdjustment(r.Context(), tc.UserID, expenseID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}
