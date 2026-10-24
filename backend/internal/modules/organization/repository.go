package organization

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
)

var (
	ErrNotFound       = errors.New("organization: resource not found")
	ErrAlreadyExists  = errors.New("organization: resource already exists")
	ErrForbidden      = errors.New("organization: access forbidden")
	ErrLastOwner      = errors.New("organization: cannot remove or demote the last active owner")
	ErrInvalidStatus  = errors.New("organization: invitation is not pending or has expired")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func (r *Repository) CreateOrganization(ctx context.Context, tx database.DBTX, name, slug string, creatorUserID uuid.UUID) (*OrganizationResponse, error) {
	var orgID, memID, roleID uuid.UUID
	var subID sql.NullString

	query := `SELECT organization_id, membership_id, role_id, subscription_id::text
	          FROM organization.create_organization_with_owner($1, $2, $3)`

	err := tx.QueryRowContext(ctx, query, name, slug, creatorUserID).Scan(&orgID, &memID, &roleID, &subID)
	if err != nil {
		return nil, fmt.Errorf("create_organization_with_owner: %w", err)
	}

	return &OrganizationResponse{
		ID:        orgID,
		Name:      name,
		Slug:      slug,
		Status:    "active",
		CreatedBy: creatorUserID,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		IsOwner:   true,
		Role:      "owner",
	}, nil
}

func (r *Repository) GetOrganization(ctx context.Context, tx database.DBTX, orgID, userID uuid.UUID) (*OrganizationResponse, error) {
	query := `
		SELECT o.id, o.name, o.slug, o.status, o.created_by, o.created_at, o.updated_at,
		       COALESCE(m.is_owner, false), COALESCE(r.code, '')
		FROM organization.organizations o
		LEFT JOIN organization.organization_memberships m ON m.organization_id = o.id AND m.user_id = $2
		LEFT JOIN organization.organization_role_assignments ra ON ra.membership_id = m.id
		LEFT JOIN organization.organization_roles r ON r.id = ra.role_id
		WHERE o.id = $1`

	var org OrganizationResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, orgID, userID).Scan(
		&org.ID, &org.Name, &org.Slug, &org.Status, &org.CreatedBy,
		&createdAt, &updatedAt, &org.IsOwner, &org.Role,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get organization: %w", err)
	}
	org.CreatedAt = createdAt.Format(time.RFC3339)
	org.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &org, nil
}

func (r *Repository) ListUserOrganizations(ctx context.Context, tx database.DBTX, userID uuid.UUID) ([]OrganizationResponse, error) {
	query := `
		SELECT o.id, o.name, o.slug, o.status, o.created_by, o.created_at, o.updated_at,
		       m.is_owner, COALESCE(r.code, 'member')
		FROM organization.organizations o
		JOIN organization.organization_memberships m ON m.organization_id = o.id
		LEFT JOIN organization.organization_role_assignments ra ON ra.membership_id = m.id
		LEFT JOIN organization.organization_roles r ON r.id = ra.role_id
		WHERE m.user_id = $1 AND m.status = 'active'
		ORDER BY o.name ASC`

	rows, err := tx.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list organizations: %w", err)
	}
	defer rows.Close()

	var orgs []OrganizationResponse
	for rows.Next() {
		var org OrganizationResponse
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&org.ID, &org.Name, &org.Slug, &org.Status, &org.CreatedBy,
			&createdAt, &updatedAt, &org.IsOwner, &org.Role,
		); err != nil {
			return nil, fmt.Errorf("scan organization: %w", err)
		}
		org.CreatedAt = createdAt.Format(time.RFC3339)
		org.UpdatedAt = updatedAt.Format(time.RFC3339)
		orgs = append(orgs, org)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if orgs == nil {
		orgs = []OrganizationResponse{}
	}
	return orgs, nil
}

func (r *Repository) UpdateOrganization(ctx context.Context, tx database.DBTX, orgID uuid.UUID, name string) (*OrganizationResponse, error) {
	query := `
		UPDATE organization.organizations
		SET name = $2, updated_at = clock_timestamp()
		WHERE id = $1
		RETURNING id, name, slug, status, created_by, created_at, updated_at`

	var org OrganizationResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, orgID, name).Scan(
		&org.ID, &org.Name, &org.Slug, &org.Status, &org.CreatedBy, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update organization: %w", err)
	}
	org.CreatedAt = createdAt.Format(time.RFC3339)
	org.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &org, nil
}

func (r *Repository) ListMembers(ctx context.Context, tx database.DBTX, orgID uuid.UUID) ([]MembershipResponse, error) {
	query := `
		SELECT m.id, m.organization_id, m.user_id, u.first_name, COALESCE(u.last_name, ''),
		       COALESCE(c.normalized_value, ''), m.status, m.is_owner,
		       COALESCE(r.code, ''), COALESCE(r.name, ''), m.created_at
		FROM organization.organization_memberships m
		JOIN identity.users u ON u.id = m.user_id
		LEFT JOIN identity.user_contacts c ON c.user_id = u.id AND c.type = 'email' AND c.is_primary = true
		LEFT JOIN organization.organization_role_assignments ra ON ra.membership_id = m.id
		LEFT JOIN organization.organization_roles r ON r.id = ra.role_id
		WHERE m.organization_id = $1
		ORDER BY m.is_owner DESC, u.first_name ASC`

	rows, err := tx.QueryContext(ctx, query, orgID)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	defer rows.Close()

	var members []MembershipResponse
	for rows.Next() {
		var mem MembershipResponse
		var createdAt time.Time
		if err := rows.Scan(
			&mem.ID, &mem.OrganizationID, &mem.UserID, &mem.FirstName, &mem.LastName,
			&mem.Email, &mem.Status, &mem.IsOwner, &mem.RoleCode, &mem.RoleName, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan member: %w", err)
		}
		mem.CreatedAt = createdAt.Format(time.RFC3339)
		members = append(members, mem)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if members == nil {
		members = []MembershipResponse{}
	}
	return members, nil
}

func (r *Repository) GetMembership(ctx context.Context, tx database.DBTX, orgID, userID uuid.UUID) (*MembershipResponse, error) {
	query := `
		SELECT m.id, m.organization_id, m.user_id, u.first_name, COALESCE(u.last_name, ''),
		       COALESCE(c.normalized_value, ''), m.status, m.is_owner,
		       COALESCE(r.code, ''), COALESCE(r.name, ''), m.created_at
		FROM organization.organization_memberships m
		JOIN identity.users u ON u.id = m.user_id
		LEFT JOIN identity.user_contacts c ON c.user_id = u.id AND c.type = 'email' AND c.is_primary = true
		LEFT JOIN organization.organization_role_assignments ra ON ra.membership_id = m.id
		LEFT JOIN organization.organization_roles r ON r.id = ra.role_id
		WHERE m.organization_id = $1 AND m.user_id = $2`

	var mem MembershipResponse
	var createdAt time.Time
	err := tx.QueryRowContext(ctx, query, orgID, userID).Scan(
		&mem.ID, &mem.OrganizationID, &mem.UserID, &mem.FirstName, &mem.LastName,
		&mem.Email, &mem.Status, &mem.IsOwner, &mem.RoleCode, &mem.RoleName, &createdAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get membership: %w", err)
	}
	mem.CreatedAt = createdAt.Format(time.RFC3339)
	return &mem, nil
}

func (r *Repository) CreateInvitation(ctx context.Context, tx database.DBTX, orgID uuid.UUID, email, tokenHash, roleCode string, createdBy uuid.UUID, expiresAt time.Time) (*InvitationResponse, error) {
	var roleID sql.NullString
	if roleCode != "" {
		_ = tx.QueryRowContext(ctx, "SELECT id::text FROM organization.organization_roles WHERE organization_id = $1 AND code = $2", orgID, roleCode).Scan(&roleID)
	}

	query := `
		INSERT INTO organization.organization_invitations (
			organization_id, email, invitation_token_hash, role_id, status, expires_at, created_by
		) VALUES ($1, $2, $3, $4, 'pending', $5, $6)
		RETURNING id, organization_id, email, status, expires_at, created_at`

	var inv InvitationResponse
	var exp, created time.Time
	err := tx.QueryRowContext(ctx, query, orgID, email, tokenHash, roleID, expiresAt, createdBy).Scan(
		&inv.ID, &inv.OrganizationID, &inv.Email, &inv.Status, &exp, &created,
	)
	if err != nil {
		return nil, fmt.Errorf("create invitation: %w", err)
	}
	inv.RoleCode = roleCode
	inv.ExpiresAt = exp.Format(time.RFC3339)
	inv.CreatedAt = created.Format(time.RFC3339)
	return &inv, nil
}

func (r *Repository) AcceptInvitation(ctx context.Context, tx database.DBTX, tokenHash string, userID uuid.UUID) (*OrganizationResponse, error) {
	// Look up invitation
	query := `
		SELECT i.id, i.organization_id, i.email, i.role_id, i.status, i.expires_at, o.name, o.slug
		FROM organization.organization_invitations i
		JOIN organization.organizations o ON o.id = i.organization_id
		WHERE i.invitation_token_hash = $1
		FOR UPDATE OF i`

	var invID, orgID uuid.UUID
	var roleID sql.NullString
	var email, status, orgName, orgSlug string
	var expiresAt time.Time

	err := tx.QueryRowContext(ctx, query, tokenHash).Scan(
		&invID, &orgID, &email, &roleID, &status, &expiresAt, &orgName, &orgSlug,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("lookup invitation: %w", err)
	}

	if status != "pending" || time.Now().After(expiresAt) {
		return nil, ErrInvalidStatus
	}

	// Insert or activate membership
	var memID uuid.UUID
	memQuery := `
		INSERT INTO organization.organization_memberships (organization_id, user_id, status, is_owner)
		VALUES ($1, $2, 'active', false)
		ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active', updated_at = clock_timestamp()
		RETURNING id`

	if err := tx.QueryRowContext(ctx, memQuery, orgID, userID).Scan(&memID); err != nil {
		return nil, fmt.Errorf("upsert membership: %w", err)
	}

	// Assign role if specified
	if roleID.Valid && roleID.String != "" {
		assignQuery := `
			INSERT INTO organization.organization_role_assignments (membership_id, role_id)
			VALUES ($1, $2::uuid)
			ON CONFLICT (membership_id, role_id) DO NOTHING`
		if _, err := tx.ExecContext(ctx, assignQuery, memID, roleID.String); err != nil {
			return nil, fmt.Errorf("assign role: %w", err)
		}
	}

	// Mark invitation accepted
	markQuery := `UPDATE organization.organization_invitations SET status = 'accepted', accepted_at = clock_timestamp() WHERE id = $1`
	if _, err := tx.ExecContext(ctx, markQuery, invID); err != nil {
		return nil, fmt.Errorf("mark invitation: %w", err)
	}

	return &OrganizationResponse{
		ID:        orgID,
		Name:      orgName,
		Slug:      orgSlug,
		Status:    "active",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		IsOwner:   false,
		Role:      "member",
	}, nil
}

func (r *Repository) TransferOwnership(ctx context.Context, tx database.DBTX, orgID, currentOwnerUserID, newOwnerUserID uuid.UUID) error {
	// Promote new owner
	promoteQuery := `
		UPDATE organization.organization_memberships
		SET is_owner = true, updated_at = clock_timestamp()
		WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`

	res, err := tx.ExecContext(ctx, promoteQuery, orgID, newOwnerUserID)
	if err != nil {
		return fmt.Errorf("promote new owner: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("%w: target user must be an active member", ErrNotFound)
	}

	// Demote old owner (protected by trigger if something went wrong)
	demoteQuery := `
		UPDATE organization.organization_memberships
		SET is_owner = false, updated_at = clock_timestamp()
		WHERE organization_id = $1 AND user_id = $2`

	_, err = tx.ExecContext(ctx, demoteQuery, orgID, currentOwnerUserID)
	if err != nil {
		return fmt.Errorf("demote old owner: %w", err)
	}
	return nil
}

func (r *Repository) UpdateMemberRole(ctx context.Context, tx database.DBTX, orgID, targetUserID uuid.UUID, roleCode string) error {
	var memID uuid.UUID
	var isOwner bool
	err := tx.QueryRowContext(ctx, "SELECT id, is_owner FROM organization.organization_memberships WHERE organization_id = $1 AND user_id = $2", orgID, targetUserID).Scan(&memID, &isOwner)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	var roleID uuid.UUID
	err = tx.QueryRowContext(ctx, "SELECT id FROM organization.organization_roles WHERE organization_id = $1 AND code = $2", orgID, roleCode).Scan(&roleID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("role %q does not exist", roleCode)
		}
		return err
	}

	// If demoting an owner, let trigger enforce last-owner rule
	if isOwner && roleCode != "owner" {
		if _, err := tx.ExecContext(ctx, "UPDATE organization.organization_memberships SET is_owner = false, updated_at = clock_timestamp() WHERE id = $1", memID); err != nil {
			return err
		}
	} else if !isOwner && roleCode == "owner" {
		if _, err := tx.ExecContext(ctx, "UPDATE organization.organization_memberships SET is_owner = true, updated_at = clock_timestamp() WHERE id = $1", memID); err != nil {
			return err
		}
	}

	// Clear and reassign role
	_, _ = tx.ExecContext(ctx, "DELETE FROM organization.organization_role_assignments WHERE membership_id = $1", memID)
	_, err = tx.ExecContext(ctx, "INSERT INTO organization.organization_role_assignments (membership_id, role_id) VALUES ($1, $2)", memID, roleID)
	return err
}

func (r *Repository) RemoveMember(ctx context.Context, tx database.DBTX, orgID, targetUserID uuid.UUID) error {
	// Trigger automatically prevents removing the last active owner!
	res, err := tx.ExecContext(ctx, "DELETE FROM organization.organization_memberships WHERE organization_id = $1 AND user_id = $2", orgID, targetUserID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
