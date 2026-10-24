package store

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
	// Store CRUD
	mux.Handle("POST /stores", m.RequireAuth(http.HandlerFunc(m.createStore)))
	mux.Handle("POST /api/stores", m.RequireAuth(http.HandlerFunc(m.createStore)))

	mux.Handle("GET /stores", m.RequireAuth(http.HandlerFunc(m.listStores)))
	mux.Handle("GET /api/stores", m.RequireAuth(http.HandlerFunc(m.listStores)))

	mux.Handle("GET /stores/{id}", m.RequireAuth(http.HandlerFunc(m.getStore)))
	mux.Handle("GET /api/stores/{id}", m.RequireAuth(http.HandlerFunc(m.getStore)))

	mux.Handle("PATCH /stores/{id}", m.RequireAuth(http.HandlerFunc(m.updateStore)))
	mux.Handle("PATCH /api/stores/{id}", m.RequireAuth(http.HandlerFunc(m.updateStore)))

	// Store Settings
	mux.Handle("GET /stores/{id}/settings", m.RequireAuth(http.HandlerFunc(m.getStoreSettings)))
	mux.Handle("GET /api/stores/{id}/settings", m.RequireAuth(http.HandlerFunc(m.getStoreSettings)))

	mux.Handle("PATCH /stores/{id}/settings", m.RequireAuth(http.HandlerFunc(m.updateStoreSettings)))
	mux.Handle("PATCH /api/stores/{id}/settings", m.RequireAuth(http.HandlerFunc(m.updateStoreSettings)))

	// Permissions Catalog
	mux.Handle("GET /stores/permissions", m.RequireAuth(http.HandlerFunc(m.listPermissions)))
	mux.Handle("GET /api/stores/permissions", m.RequireAuth(http.HandlerFunc(m.listPermissions)))

	// Reusable Store Roles
	mux.Handle("GET /stores/roles", m.RequireAuth(http.HandlerFunc(m.listStoreRoles)))
	mux.Handle("GET /api/stores/roles", m.RequireAuth(http.HandlerFunc(m.listStoreRoles)))

	mux.Handle("POST /stores/roles", m.RequireAuth(http.HandlerFunc(m.createStoreRole)))
	mux.Handle("POST /api/stores/roles", m.RequireAuth(http.HandlerFunc(m.createStoreRole)))

	mux.Handle("PUT /stores/roles/{id}/permissions", m.RequireAuth(http.HandlerFunc(m.updateStoreRolePermissions)))
	mux.Handle("PUT /api/stores/roles/{id}/permissions", m.RequireAuth(http.HandlerFunc(m.updateStoreRolePermissions)))

	mux.Handle("DELETE /stores/roles/{id}", m.RequireAuth(http.HandlerFunc(m.deleteStoreRole)))
	mux.Handle("DELETE /api/stores/roles/{id}", m.RequireAuth(http.HandlerFunc(m.deleteStoreRole)))

	// Memberships
	mux.Handle("GET /stores/{id}/members", m.RequireAuth(http.HandlerFunc(m.listMembers)))
	mux.Handle("GET /api/stores/{id}/members", m.RequireAuth(http.HandlerFunc(m.listMembers)))

	mux.Handle("POST /stores/{id}/members", m.RequireAuth(http.HandlerFunc(m.assignMember)))
	mux.Handle("POST /api/stores/{id}/members", m.RequireAuth(http.HandlerFunc(m.assignMember)))

	mux.Handle("DELETE /stores/{id}/members/{user_id}", m.RequireAuth(http.HandlerFunc(m.removeMember)))
	mux.Handle("DELETE /api/stores/{id}/members/{user_id}", m.RequireAuth(http.HandlerFunc(m.removeMember)))

	// Store Invitations
	mux.Handle("GET /stores/{id}/invitations", m.RequireAuth(http.HandlerFunc(m.listInvitations)))
	mux.Handle("GET /api/stores/{id}/invitations", m.RequireAuth(http.HandlerFunc(m.listInvitations)))

	mux.Handle("POST /stores/{id}/invitations", m.RequireAuth(http.HandlerFunc(m.inviteStaff)))
	mux.Handle("POST /api/stores/{id}/invitations", m.RequireAuth(http.HandlerFunc(m.inviteStaff)))

	mux.Handle("POST /stores/invitations/accept", m.RequireAuth(http.HandlerFunc(m.acceptInvitation)))
	mux.Handle("POST /api/stores/invitations/accept", m.RequireAuth(http.HandlerFunc(m.acceptInvitation)))

	mux.Handle("DELETE /stores/{id}/invitations/{invitation_id}", m.RequireAuth(http.HandlerFunc(m.revokeInvitation)))
	mux.Handle("DELETE /api/stores/{id}/invitations/{invitation_id}", m.RequireAuth(http.HandlerFunc(m.revokeInvitation)))

	// Presentation Menus
	mux.Handle("GET /stores/menus", m.RequireAuth(http.HandlerFunc(m.getMenus)))
	mux.Handle("GET /api/stores/menus", m.RequireAuth(http.HandlerFunc(m.getMenus)))

	// Domain D: Products
	mux.Handle("POST /stores/{id}/products", m.RequireAuth(http.HandlerFunc(m.createProduct)))
	mux.Handle("POST /api/stores/{id}/products", m.RequireAuth(http.HandlerFunc(m.createProduct)))

	mux.Handle("GET /stores/{id}/products", m.RequireAuth(http.HandlerFunc(m.listProducts)))
	mux.Handle("GET /api/stores/{id}/products", m.RequireAuth(http.HandlerFunc(m.listProducts)))

	mux.Handle("GET /stores/{id}/products/{product_id}", m.RequireAuth(http.HandlerFunc(m.getProduct)))
	mux.Handle("GET /api/stores/{id}/products/{product_id}", m.RequireAuth(http.HandlerFunc(m.getProduct)))

	mux.Handle("PATCH /stores/{id}/products/{product_id}", m.RequireAuth(http.HandlerFunc(m.updateProduct)))
	mux.Handle("PATCH /api/stores/{id}/products/{product_id}", m.RequireAuth(http.HandlerFunc(m.updateProduct)))

	// Domain D: Inventory Locations & Balances
	mux.Handle("POST /stores/{id}/locations", m.RequireAuth(http.HandlerFunc(m.createLocation)))
	mux.Handle("POST /api/stores/{id}/locations", m.RequireAuth(http.HandlerFunc(m.createLocation)))

	mux.Handle("GET /stores/{id}/locations", m.RequireAuth(http.HandlerFunc(m.listLocations)))
	mux.Handle("GET /api/stores/{id}/locations", m.RequireAuth(http.HandlerFunc(m.listLocations)))

	mux.Handle("GET /stores/{id}/inventory", m.RequireAuth(http.HandlerFunc(m.listInventoryBalances)))
	mux.Handle("GET /api/stores/{id}/inventory", m.RequireAuth(http.HandlerFunc(m.listInventoryBalances)))

	mux.Handle("POST /stores/{id}/inventory/movements", m.RequireAuth(http.HandlerFunc(m.recordStockMovement)))
	mux.Handle("POST /api/stores/{id}/inventory/movements", m.RequireAuth(http.HandlerFunc(m.recordStockMovement)))

	// Domain D: Store Customers
	mux.Handle("POST /stores/{id}/customers", m.RequireAuth(http.HandlerFunc(m.createCustomer)))
	mux.Handle("POST /api/stores/{id}/customers", m.RequireAuth(http.HandlerFunc(m.createCustomer)))

	mux.Handle("GET /stores/{id}/customers", m.RequireAuth(http.HandlerFunc(m.listCustomers)))
	mux.Handle("GET /api/stores/{id}/customers", m.RequireAuth(http.HandlerFunc(m.listCustomers)))

	mux.Handle("GET /stores/{id}/customers/{customer_id}", m.RequireAuth(http.HandlerFunc(m.getCustomer)))
	mux.Handle("GET /api/stores/{id}/customers/{customer_id}", m.RequireAuth(http.HandlerFunc(m.getCustomer)))

	mux.Handle("PATCH /stores/{id}/customers/{customer_id}", m.RequireAuth(http.HandlerFunc(m.updateCustomer)))
	mux.Handle("PATCH /api/stores/{id}/customers/{customer_id}", m.RequireAuth(http.HandlerFunc(m.updateCustomer)))
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
		httpx.Error(w, http.StatusConflict, "Resource already exists with this code, SKU, or name", httpx.CodeConflict)
	case errors.Is(err, ErrForbidden):
		httpx.Error(w, http.StatusForbidden, "Forbidden: insufficient permissions", httpx.CodeForbidden)
	case errors.Is(err, ErrQuotaExceeded):
		httpx.Error(w, http.StatusPaymentRequired, err.Error(), httpx.Code("quota_exceeded"))
	case errors.Is(err, ErrNoSubscription):
		httpx.Error(w, http.StatusPaymentRequired, "Valid active subscription required to create stores", httpx.Code("subscription_required"))
	case errors.Is(err, ErrSystemRoleProtected):
		httpx.Error(w, http.StatusConflict, "System roles cannot be modified or deleted", httpx.Code("system_role_protected"))
	case errors.Is(err, ErrRoleInUse):
		httpx.Error(w, http.StatusConflict, "Role is currently assigned to active members and cannot be deleted", httpx.Code("role_in_use"))
	case errors.Is(err, ErrInvitationExpired):
		httpx.Error(w, http.StatusGone, "Invitation is expired or invalid", httpx.Code("invitation_expired"))
	case errors.Is(err, ErrInvitationAccepted):
		httpx.Error(w, http.StatusConflict, "Invitation has already been accepted", httpx.Code("invitation_already_accepted"))
	default:
		m.logger.Error("store operation failed", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "Internal server error", httpx.CodeInternalError)
	}
}

func (m *Module) createStore(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in CreateStoreRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.Create(r.Context(), tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) listStores(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.List(r.Context(), orgID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) getStore(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.Get(r.Context(), storeID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) updateStore(w http.ResponseWriter, r *http.Request) {
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

	var in UpdateStoreRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.Update(r.Context(), storeID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) getStoreSettings(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.GetSettings(r.Context(), storeID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) updateStoreSettings(w http.ResponseWriter, r *http.Request) {
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

	var in UpdateStoreSettingsRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.UpdateSettings(r.Context(), storeID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) listPermissions(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	res, err := m.Service.ListPermissions(r.Context(), scope)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) listStoreRoles(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.ListRoles(r.Context(), orgID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) createStoreRole(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in CreateStoreRoleRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.CreateRole(r.Context(), in.OrganizationID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) updateStoreRolePermissions(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	roleID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid role id", httpx.CodeValidationFailed, "id")
		return
	}

	var in UpdateStoreRolePermissionsRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	if err := m.Service.UpdateRolePermissions(r.Context(), roleID, tc.UserID, in); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "store role permissions updated successfully"})
}

func (m *Module) deleteStoreRole(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	roleID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid role id", httpx.CodeValidationFailed, "id")
		return
	}

	if err := m.Service.DeleteRole(r.Context(), roleID, tc.UserID); err != nil {
		m.fail(w, err)
		return
	}
	httpx.NoContent(w)
}

func (m *Module) assignMember(w http.ResponseWriter, r *http.Request) {
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

	var in AssignStoreMemberRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	if err := m.Service.AssignMember(r.Context(), storeID, tc.UserID, in); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "store member assigned successfully"})
}

func (m *Module) listMembers(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.ListMembers(r.Context(), storeID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) removeMember(w http.ResponseWriter, r *http.Request) {
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

	targetUserID, err := uuid.Parse(r.PathValue("user_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid target user id", httpx.CodeValidationFailed, "user_id")
		return
	}

	if err := m.Service.RemoveMember(r.Context(), storeID, tc.UserID, targetUserID); err != nil {
		m.fail(w, err)
		return
	}
	httpx.NoContent(w)
}

func (m *Module) listInvitations(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.ListInvitations(r.Context(), storeID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) inviteStaff(w http.ResponseWriter, r *http.Request) {
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

	var in CreateStoreInvitationRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.InviteStaff(r.Context(), storeID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) acceptInvitation(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in AcceptStoreInvitationRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.AcceptInvitation(r.Context(), tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) revokeInvitation(w http.ResponseWriter, r *http.Request) {
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

	invitationID, err := uuid.Parse(r.PathValue("invitation_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid invitation id", httpx.CodeValidationFailed, "invitation_id")
		return
	}

	if err := m.Service.RevokeInvitation(r.Context(), storeID, invitationID, tc.UserID); err != nil {
		m.fail(w, err)
		return
	}
	httpx.NoContent(w)
}

func (m *Module) getMenus(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	portal := r.URL.Query().Get("portal")
	if portal == "" {
		portal = "merchant"
	}

	var storeID uuid.UUID
	storeIDStr := r.URL.Query().Get("store_id")
	if storeIDStr != "" {
		parsed, err := uuid.Parse(storeIDStr)
		if err == nil {
			storeID = parsed
		}
	}

	res, err := m.Service.GetAuthorizedMenus(r.Context(), portal, storeID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

// Domain D: Product Handlers

func (m *Module) createProduct(w http.ResponseWriter, r *http.Request) {
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

	var in CreateProductRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.CreateProduct(r.Context(), storeID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) getProduct(w http.ResponseWriter, r *http.Request) {
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

	productID, err := uuid.Parse(r.PathValue("product_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid product id", httpx.CodeValidationFailed, "product_id")
		return
	}

	res, err := m.Service.GetProduct(r.Context(), storeID, productID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) listProducts(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.ListProducts(r.Context(), storeID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) updateProduct(w http.ResponseWriter, r *http.Request) {
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

	productID, err := uuid.Parse(r.PathValue("product_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid product id", httpx.CodeValidationFailed, "product_id")
		return
	}

	var in UpdateProductRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.UpdateProduct(r.Context(), storeID, productID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

// Domain D: Inventory Location Handlers

func (m *Module) createLocation(w http.ResponseWriter, r *http.Request) {
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

	var in CreateInventoryLocationRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.CreateLocation(r.Context(), storeID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) listLocations(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.ListLocations(r.Context(), storeID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

// Domain D: Inventory Balances & Movements Handlers

func (m *Module) listInventoryBalances(w http.ResponseWriter, r *http.Request) {
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

	var productID *uuid.UUID
	if pidStr := r.URL.Query().Get("product_id"); pidStr != "" {
		if pid, err := uuid.Parse(pidStr); err == nil {
			productID = &pid
		}
	}

	var locationID *uuid.UUID
	if lidStr := r.URL.Query().Get("location_id"); lidStr != "" {
		if lid, err := uuid.Parse(lidStr); err == nil {
			locationID = &lid
		}
	}

	res, err := m.Service.ListInventoryBalances(r.Context(), storeID, tc.UserID, productID, locationID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) recordStockMovement(w http.ResponseWriter, r *http.Request) {
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

	var in RecordStockMovementRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.RecordStockMovement(r.Context(), storeID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

// Domain D: Store Customer Handlers

func (m *Module) createCustomer(w http.ResponseWriter, r *http.Request) {
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

	var in CreateStoreCustomerRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.CreateCustomer(r.Context(), storeID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (m *Module) getCustomer(w http.ResponseWriter, r *http.Request) {
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

	customerID, err := uuid.Parse(r.PathValue("customer_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid customer id", httpx.CodeValidationFailed, "customer_id")
		return
	}

	res, err := m.Service.GetCustomer(r.Context(), storeID, customerID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) listCustomers(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.ListCustomers(r.Context(), storeID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) updateCustomer(w http.ResponseWriter, r *http.Request) {
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

	customerID, err := uuid.Parse(r.PathValue("customer_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid customer id", httpx.CodeValidationFailed, "customer_id")
		return
	}

	var in UpdateStoreCustomerRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.UpdateCustomer(r.Context(), storeID, customerID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

