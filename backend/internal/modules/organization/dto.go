package organization

import (
	"fmt"
	"net/mail"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

var slugRegex = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// ValidationError represents a field-level validation failure returning HTTP 422.
type ValidationError struct {
	Field string `json:"field"`
	Msg   string `json:"message"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Msg)
}

type OrganizationResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	Status    string    `json:"status"`
	CreatedBy uuid.UUID `json:"created_by"`
	CreatedAt string    `json:"created_at"`
	UpdatedAt string    `json:"updated_at"`
	IsOwner   bool      `json:"is_owner"`
	Role      string    `json:"role,omitempty"`
}

type MembershipResponse struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	UserID         uuid.UUID `json:"user_id"`
	FirstName      string    `json:"first_name"`
	LastName       string    `json:"last_name,omitempty"`
	Email          string    `json:"email"`
	Status         string    `json:"status"`
	IsOwner        bool      `json:"is_owner"`
	RoleCode       string    `json:"role_code,omitempty"`
	RoleName       string    `json:"role_name,omitempty"`
	CreatedAt      string    `json:"created_at"`
}

type InvitationResponse struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
	Email          string     `json:"email"`
	RoleCode       string     `json:"role_code,omitempty"`
	Status         string     `json:"status"`
	ExpiresAt      string     `json:"expires_at"`
	CreatedAt      string     `json:"created_at"`
	AcceptedAt     *string    `json:"accepted_at,omitempty"`
	Token          string     `json:"invitation_token,omitempty"`
}

type CreateOrganizationRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug,omitempty"`
}

func (req *CreateOrganizationRequest) Validate() error {
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 || len(req.Name) > 120 {
		return &ValidationError{Field: "name", Msg: "name must be between 2 and 120 characters"}
	}
	if req.Slug != "" {
		req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
		if len(req.Slug) < 2 || len(req.Slug) > 120 || !slugRegex.MatchString(req.Slug) {
			return &ValidationError{Field: "slug", Msg: "slug must be 2-120 lowercase alphanumeric characters with single hyphens"}
		}
	}
	return nil
}

type UpdateOrganizationRequest struct {
	Name string `json:"name"`
}

func (req *UpdateOrganizationRequest) Validate() error {
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 || len(req.Name) > 120 {
		return &ValidationError{Field: "name", Msg: "name must be between 2 and 120 characters"}
	}
	return nil
}

type InviteMemberRequest struct {
	Email    string `json:"email"`
	RoleCode string `json:"role_code"`
}

func (req *InviteMemberRequest) Validate() error {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" {
		return &ValidationError{Field: "email", Msg: "email is required"}
	}
	if _, err := mail.ParseAddress(req.Email); err != nil || len(req.Email) > 320 {
		return &ValidationError{Field: "email", Msg: "valid email address is required"}
	}
	req.RoleCode = strings.ToLower(strings.TrimSpace(req.RoleCode))
	if req.RoleCode == "" {
		req.RoleCode = "member"
	}
	if req.RoleCode != "owner" && req.RoleCode != "admin" && req.RoleCode != "member" {
		return &ValidationError{Field: "role_code", Msg: "role_code must be owner, admin, or member"}
	}
	return nil
}

type AcceptInvitationRequest struct {
	Token string `json:"token"`
}

func (req *AcceptInvitationRequest) Validate() error {
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		return &ValidationError{Field: "token", Msg: "invitation token is required"}
	}
	return nil
}

type TransferOwnershipRequest struct {
	NewOwnerUserID uuid.UUID `json:"new_owner_user_id"`
}

func (req *TransferOwnershipRequest) Validate() error {
	if req.NewOwnerUserID == uuid.Nil {
		return &ValidationError{Field: "new_owner_user_id", Msg: "valid new_owner_user_id is required"}
	}
	return nil
}

type UpdateMemberRoleRequest struct {
	RoleCode string `json:"role_code"`
}

func (req *UpdateMemberRoleRequest) Validate() error {
	req.RoleCode = strings.ToLower(strings.TrimSpace(req.RoleCode))
	if req.RoleCode != "owner" && req.RoleCode != "admin" && req.RoleCode != "member" {
		return &ValidationError{Field: "role_code", Msg: "role_code must be owner, admin, or member"}
	}
	return nil
}
