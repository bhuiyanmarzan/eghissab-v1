package organization

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
	mux.Handle("POST /organizations", m.RequireAuth(http.HandlerFunc(m.createOrganization)))
	mux.Handle("POST /api/organizations", m.RequireAuth(http.HandlerFunc(m.createOrganization)))

	mux.Handle("GET /organizations", m.RequireAuth(http.HandlerFunc(m.listOrganizations)))
	mux.Handle("GET /api/organizations", m.RequireAuth(http.HandlerFunc(m.listOrganizations)))

	mux.Handle("GET /organizations/{id}", m.RequireAuth(http.HandlerFunc(m.getOrganization)))
	mux.Handle("GET /api/organizations/{id}", m.RequireAuth(http.HandlerFunc(m.getOrganization)))

	mux.Handle("PATCH /organizations/{id}", m.RequireAuth(http.HandlerFunc(m.updateOrganization)))
	mux.Handle("PATCH /api/organizations/{id}", m.RequireAuth(http.HandlerFunc(m.updateOrganization)))

	mux.Handle("GET /organizations/{id}/members", m.RequireAuth(http.HandlerFunc(m.listMembers)))
	mux.Handle("GET /api/organizations/{id}/members", m.RequireAuth(http.HandlerFunc(m.listMembers)))

	mux.Handle("POST /organizations/{id}/invitations", m.RequireAuth(http.HandlerFunc(m.inviteMember)))
	mux.Handle("POST /api/organizations/{id}/invitations", m.RequireAuth(http.HandlerFunc(m.inviteMember)))

	mux.Handle("POST /organizations/invitations/accept", m.RequireAuth(http.HandlerFunc(m.acceptInvitation)))
	mux.Handle("POST /api/organizations/invitations/accept", m.RequireAuth(http.HandlerFunc(m.acceptInvitation)))

	mux.Handle("POST /organizations/{id}/transfer-ownership", m.RequireAuth(http.HandlerFunc(m.transferOwnership)))
	mux.Handle("POST /api/organizations/{id}/transfer-ownership", m.RequireAuth(http.HandlerFunc(m.transferOwnership)))

	mux.Handle("PUT /organizations/{id}/members/{user_id}/role", m.RequireAuth(http.HandlerFunc(m.updateMemberRole)))
	mux.Handle("PUT /api/organizations/{id}/members/{user_id}/role", m.RequireAuth(http.HandlerFunc(m.updateMemberRole)))

	mux.Handle("DELETE /organizations/{id}/members/{user_id}", m.RequireAuth(http.HandlerFunc(m.removeMember)))
	mux.Handle("DELETE /api/organizations/{id}/members/{user_id}", m.RequireAuth(http.HandlerFunc(m.removeMember)))
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
	case errors.Is(err, ErrInvalidStatus):
		httpx.Error(w, http.StatusBadRequest, err.Error(), httpx.Code("invalid_invitation"))
	default:
		if strings.Contains(err.Error(), "BR-001") {
			httpx.Error(w, http.StatusConflict, "BR-001: Cannot remove or demote the last active owner of an organization", httpx.Code("last_owner_protected"))
			return
		}
		m.logger.Error("organization operation failed", "err", err)
		httpx.Error(w, http.StatusInternalServerError, "Internal server error", httpx.CodeInternalError)
	}
}

func (m *Module) createOrganization(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	var in CreateOrganizationRequest
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

func (m *Module) listOrganizations(w http.ResponseWriter, r *http.Request) {
	tc, ok := tenant.FromContext(r.Context())
	if !ok || tc.UserID == uuid.Nil {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized", httpx.CodeUnauthenticated)
		return
	}

	res, err := m.Service.List(r.Context(), tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) getOrganization(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.Get(r.Context(), orgID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) updateOrganization(w http.ResponseWriter, r *http.Request) {
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

	var in UpdateOrganizationRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.Update(r.Context(), orgID, tc.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) listMembers(w http.ResponseWriter, r *http.Request) {
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

	res, err := m.Service.ListMembers(r.Context(), orgID, tc.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (m *Module) inviteMember(w http.ResponseWriter, r *http.Request) {
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

	var in InviteMemberRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	res, err := m.Service.InviteMember(r.Context(), orgID, tc.UserID, in)
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

	var in AcceptInvitationRequest
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

func (m *Module) transferOwnership(w http.ResponseWriter, r *http.Request) {
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

	var in TransferOwnershipRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	if err := m.Service.TransferOwnership(r.Context(), orgID, tc.UserID, in); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "ownership transferred successfully"})
}

func (m *Module) updateMemberRole(w http.ResponseWriter, r *http.Request) {
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

	targetUserID, err := uuid.Parse(r.PathValue("user_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid target user id", httpx.CodeValidationFailed, "user_id")
		return
	}

	var in UpdateMemberRoleRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}

	if err := m.Service.UpdateMemberRole(r.Context(), orgID, tc.UserID, targetUserID, in); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "member role updated successfully"})
}

func (m *Module) removeMember(w http.ResponseWriter, r *http.Request) {
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

	targetUserID, err := uuid.Parse(r.PathValue("user_id"))
	if err != nil {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, "invalid target user id", httpx.CodeValidationFailed, "user_id")
		return
	}

	if err := m.Service.RemoveMember(r.Context(), orgID, tc.UserID, targetUserID); err != nil {
		m.fail(w, err)
		return
	}
	httpx.NoContent(w)
}
