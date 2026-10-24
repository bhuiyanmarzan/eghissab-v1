package store

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
	"github.com/lib/pq"
)

var (
	ErrNotFound            = errors.New("store: resource not found")
	ErrAlreadyExists       = errors.New("store: store slug or role code already exists")
	ErrForbidden           = errors.New("store: access forbidden")
	ErrQuotaExceeded       = errors.New("store: organization store creation quota exceeded for current subscription plan")
	ErrNoSubscription      = errors.New("store: organization has no active or trial subscription")
	ErrSystemRoleProtected = errors.New("store: system roles cannot be deleted")
	ErrRoleInUse           = errors.New("store: role is currently assigned to members and cannot be deleted")
	ErrInvitationExpired   = errors.New("store: invitation is expired or invalid")
	ErrInvitationAccepted  = errors.New("store: invitation has already been accepted")
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

func (r *Repository) CheckOrgPermission(ctx context.Context, tx database.DBTX, orgID, userID uuid.UUID) (bool, bool, error) {
	var isOwner bool
	err := tx.QueryRowContext(ctx, "SELECT organization.is_org_owner($1, $2)", orgID, userID).Scan(&isOwner)
	if err != nil {
		return false, false, err
	}
	if isOwner {
		return true, true, nil
	}

	var isMember bool
	err = tx.QueryRowContext(ctx, "SELECT organization.is_org_member($1, $2)", orgID, userID).Scan(&isMember)
	if err != nil {
		return false, false, err
	}
	if !isMember {
		return false, false, ErrForbidden
	}
	return false, true, nil
}

func (r *Repository) CheckStoreQuota(ctx context.Context, tx database.DBTX, orgID uuid.UUID) error {
	quotaQuery := `
		SELECT COALESCE((pv.limits->>'max_stores')::int, 1)
		FROM billing.subscriptions s
		JOIN billing.plan_versions pv ON pv.id = s.plan_version_id
		WHERE s.organization_id = $1 AND s.status IN ('active', 'trialing', 'past_due')
		LIMIT 1`

	var maxStores int
	err := tx.QueryRowContext(ctx, quotaQuery, orgID).Scan(&maxStores)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNoSubscription
		}
		return fmt.Errorf("check quota: %w", err)
	}

	countQuery := `SELECT COUNT(*) FROM store.stores WHERE organization_id = $1 AND status != 'archived'`
	var currentStores int
	if err := tx.QueryRowContext(ctx, countQuery, orgID).Scan(&currentStores); err != nil {
		return fmt.Errorf("count stores: %w", err)
	}

	if currentStores >= maxStores {
		return fmt.Errorf("%w: maximum allowed is %d", ErrQuotaExceeded, maxStores)
	}
	return nil
}

func (r *Repository) CreateStore(ctx context.Context, tx database.DBTX, orgID uuid.UUID, name, slug string, creatorUserID uuid.UUID) (*StoreResponse, error) {
	query := `
		INSERT INTO store.stores (organization_id, name, slug, status, created_by)
		VALUES ($1, $2, $3, 'active', $4)
		RETURNING id, organization_id, name, slug, status, created_by, created_at, updated_at`

	var s StoreResponse
	var createdAt, updatedAt time.Time
	var createdBy *uuid.UUID
	err := tx.QueryRowContext(ctx, query, orgID, name, slug, creatorUserID).Scan(
		&s.ID, &s.OrganizationID, &s.Name, &s.Slug, &s.Status, &createdBy, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert store: %w", err)
	}
	s.CreatedBy = createdBy
	s.CreatedAt = createdAt.Format(time.RFC3339)
	s.UpdatedAt = updatedAt.Format(time.RFC3339)

	// Fetch initialized store settings
	settings, err := r.GetStoreSettings(ctx, tx, s.ID)
	if err == nil {
		s.Settings = settings
	}

	return &s, nil
}

func (r *Repository) GetStore(ctx context.Context, tx database.DBTX, storeID, userID uuid.UUID) (*StoreResponse, error) {
	query := `
		SELECT s.id, s.organization_id, s.name, s.slug, s.status, s.created_by, s.created_at, s.updated_at,
		       COALESCE(r.code, ''), COALESCE(r.name, '')
		FROM store.stores s
		LEFT JOIN store.store_memberships m ON m.store_id = s.id AND m.user_id = $2
		LEFT JOIN store.store_roles r ON r.id = m.role_id
		WHERE s.id = $1`

	var s StoreResponse
	var createdAt, updatedAt time.Time
	var createdBy *uuid.UUID
	err := tx.QueryRowContext(ctx, query, storeID, userID).Scan(
		&s.ID, &s.OrganizationID, &s.Name, &s.Slug, &s.Status, &createdBy, &createdAt, &updatedAt,
		&s.RoleCode, &s.RoleName,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get store: %w", err)
	}
	s.CreatedBy = createdBy
	s.CreatedAt = createdAt.Format(time.RFC3339)
	s.UpdatedAt = updatedAt.Format(time.RFC3339)

	settings, err := r.GetStoreSettings(ctx, tx, s.ID)
	if err == nil {
		s.Settings = settings
	}

	return &s, nil
}

func (r *Repository) ListStores(ctx context.Context, tx database.DBTX, orgID, userID uuid.UUID) ([]StoreResponse, error) {
	query := `
		SELECT s.id, s.organization_id, s.name, s.slug, s.status, s.created_by, s.created_at, s.updated_at,
		       COALESCE(r.code, ''), COALESCE(r.name, '')
		FROM store.stores s
		LEFT JOIN store.store_memberships m ON m.store_id = s.id AND m.user_id = $2
		LEFT JOIN store.store_roles r ON r.id = m.role_id
		WHERE s.organization_id = $1 AND s.status != 'archived'
		ORDER BY s.name ASC`

	rows, err := tx.QueryContext(ctx, query, orgID, userID)
	if err != nil {
		return nil, fmt.Errorf("list stores: %w", err)
	}
	defer rows.Close()

	var stores []StoreResponse
	for rows.Next() {
		var s StoreResponse
		var createdAt, updatedAt time.Time
		var createdBy *uuid.UUID
		if err := rows.Scan(
			&s.ID, &s.OrganizationID, &s.Name, &s.Slug, &s.Status, &createdBy, &createdAt, &updatedAt,
			&s.RoleCode, &s.RoleName,
		); err != nil {
			return nil, fmt.Errorf("scan store: %w", err)
		}
		s.CreatedBy = createdBy
		s.CreatedAt = createdAt.Format(time.RFC3339)
		s.UpdatedAt = updatedAt.Format(time.RFC3339)
		stores = append(stores, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if stores == nil {
		stores = []StoreResponse{}
	}
	return stores, nil
}

func (r *Repository) UpdateStore(ctx context.Context, tx database.DBTX, storeID uuid.UUID, name, status string) (*StoreResponse, error) {
	query := `
		UPDATE store.stores
		SET name = $2, status = COALESCE(NULLIF($3, ''), status), updated_at = clock_timestamp()
		WHERE id = $1
		RETURNING id, organization_id, name, slug, status, created_by, created_at, updated_at`

	var s StoreResponse
	var createdAt, updatedAt time.Time
	var createdBy *uuid.UUID
	err := tx.QueryRowContext(ctx, query, storeID, name, status).Scan(
		&s.ID, &s.OrganizationID, &s.Name, &s.Slug, &s.Status, &createdBy, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update store: %w", err)
	}
	s.CreatedBy = createdBy
	s.CreatedAt = createdAt.Format(time.RFC3339)
	s.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &s, nil
}

// Store Settings
func (r *Repository) GetStoreSettings(ctx context.Context, tx database.DBTX, storeID uuid.UUID) (*StoreSettingsResponse, error) {
	query := `
		SELECT store_id, timezone, currency, invoice_preferences, created_at, updated_at
		FROM store.store_settings
		WHERE store_id = $1`

	var s StoreSettingsResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID).Scan(
		&s.StoreID, &s.Timezone, &s.Currency, &s.InvoicePreferences, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Auto initialize if missing
			insertQuery := `
				INSERT INTO store.store_settings (store_id)
				VALUES ($1)
				RETURNING store_id, timezone, currency, invoice_preferences, created_at, updated_at`
			if insertErr := tx.QueryRowContext(ctx, insertQuery, storeID).Scan(
				&s.StoreID, &s.Timezone, &s.Currency, &s.InvoicePreferences, &createdAt, &updatedAt,
			); insertErr != nil {
				return nil, fmt.Errorf("init store settings: %w", insertErr)
			}
		} else {
			return nil, fmt.Errorf("get store settings: %w", err)
		}
	}
	s.CreatedAt = createdAt.Format(time.RFC3339)
	s.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &s, nil
}

func (r *Repository) UpdateStoreSettings(ctx context.Context, tx database.DBTX, storeID uuid.UUID, req UpdateStoreSettingsRequest) (*StoreSettingsResponse, error) {
	var prefArg any
	if len(req.InvoicePreferences) > 0 {
		prefArg = string(req.InvoicePreferences)
	}

	query := `
		UPDATE store.store_settings
		SET timezone = COALESCE(NULLIF($2, ''), timezone),
		    currency = COALESCE(NULLIF($3, ''), currency),
		    invoice_preferences = CASE WHEN $4::text IS NOT NULL THEN $4::jsonb ELSE invoice_preferences END,
		    updated_at = clock_timestamp()
		WHERE store_id = $1
		RETURNING store_id, timezone, currency, invoice_preferences, created_at, updated_at`

	var s StoreSettingsResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID, req.Timezone, req.Currency, prefArg).Scan(
		&s.StoreID, &s.Timezone, &s.Currency, &s.InvoicePreferences, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update store settings: %w", err)
	}
	s.CreatedAt = createdAt.Format(time.RFC3339)
	s.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &s, nil
}

// Permissions Catalog
func (r *Repository) ListPermissions(ctx context.Context, tx database.DBTX, scope string) ([]PermissionResponse, error) {
	query := `
		SELECT id, code, scope, COALESCE(description, '')
		FROM app.permissions
		WHERE ($1 = '' OR scope = $1)
		ORDER BY scope, code`

	rows, err := tx.QueryContext(ctx, query, scope)
	if err != nil {
		return nil, fmt.Errorf("list permissions: %w", err)
	}
	defer rows.Close()

	var perms []PermissionResponse
	for rows.Next() {
		var p PermissionResponse
		if err := rows.Scan(&p.ID, &p.Code, &p.Scope, &p.Description); err != nil {
			return nil, fmt.Errorf("scan permission: %w", err)
		}
		perms = append(perms, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if perms == nil {
		perms = []PermissionResponse{}
	}
	return perms, nil
}

// Organization-Reusable Store Roles
func (r *Repository) ListStoreRoles(ctx context.Context, tx database.DBTX, orgID uuid.UUID) ([]StoreRoleResponse, error) {
	query := `
		SELECT r.id, r.organization_id, r.code, r.name, r.system_role, r.created_at,
		       COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') as permissions
		FROM store.store_roles r
		LEFT JOIN store.store_role_permissions srp ON srp.role_id = r.id
		LEFT JOIN app.permissions p ON p.id = srp.permission_id
		WHERE r.organization_id = $1
		GROUP BY r.id, r.organization_id, r.code, r.name, r.system_role, r.created_at
		ORDER BY r.name ASC`

	rows, err := tx.QueryContext(ctx, query, orgID)
	if err != nil {
		return nil, fmt.Errorf("list store roles: %w", err)
	}
	defer rows.Close()

	var roles []StoreRoleResponse
	for rows.Next() {
		var role StoreRoleResponse
		var createdAt time.Time
		if err := rows.Scan(
			&role.ID, &role.OrganizationID, &role.Code, &role.Name, &role.SystemRole, &createdAt,
			pq.Array(&role.Permissions),
		); err != nil {
			return nil, fmt.Errorf("scan store role: %w", err)
		}
		role.CreatedAt = createdAt.Format(time.RFC3339)
		if role.Permissions == nil {
			role.Permissions = []string{}
		}
		roles = append(roles, role)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if roles == nil {
		roles = []StoreRoleResponse{}
	}
	return roles, nil
}

func (r *Repository) GetStoreRole(ctx context.Context, tx database.DBTX, roleID uuid.UUID) (*StoreRoleResponse, error) {
	query := `
		SELECT r.id, r.organization_id, r.code, r.name, r.system_role, r.created_at,
		       COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') as permissions
		FROM store.store_roles r
		LEFT JOIN store.store_role_permissions srp ON srp.role_id = r.id
		LEFT JOIN app.permissions p ON p.id = srp.permission_id
		WHERE r.id = $1
		GROUP BY r.id, r.organization_id, r.code, r.name, r.system_role, r.created_at`

	var role StoreRoleResponse
	var createdAt time.Time
	err := tx.QueryRowContext(ctx, query, roleID).Scan(
		&role.ID, &role.OrganizationID, &role.Code, &role.Name, &role.SystemRole, &createdAt,
		pq.Array(&role.Permissions),
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get store role: %w", err)
	}
	role.CreatedAt = createdAt.Format(time.RFC3339)
	if role.Permissions == nil {
		role.Permissions = []string{}
	}
	return &role, nil
}

func (r *Repository) CreateStoreRole(ctx context.Context, tx database.DBTX, orgID uuid.UUID, code, name string, permissions []string) (*StoreRoleResponse, error) {
	insertRole := `
		INSERT INTO store.store_roles (organization_id, code, name, system_role)
		VALUES ($1, $2, $3, false)
		RETURNING id, organization_id, code, name, system_role, created_at`

	var role StoreRoleResponse
	var createdAt time.Time
	err := tx.QueryRowContext(ctx, insertRole, orgID, code, name).Scan(
		&role.ID, &role.OrganizationID, &role.Code, &role.Name, &role.SystemRole, &createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create store role: %w", err)
	}
	role.CreatedAt = createdAt.Format(time.RFC3339)
	role.Permissions = []string{}

	if len(permissions) > 0 {
		insertPerms := `
			INSERT INTO store.store_role_permissions (role_id, permission_id)
			SELECT $1, id FROM app.permissions WHERE code = ANY($2)
			ON CONFLICT DO NOTHING`
		if _, err := tx.ExecContext(ctx, insertPerms, role.ID, pq.Array(permissions)); err != nil {
			return nil, fmt.Errorf("assign store role permissions: %w", err)
		}
		role.Permissions = permissions
	}

	return &role, nil
}

func (r *Repository) UpdateStoreRolePermissions(ctx context.Context, tx database.DBTX, roleID uuid.UUID, permissions []string) error {
	// Clear existing permissions
	if _, err := tx.ExecContext(ctx, "DELETE FROM store.store_role_permissions WHERE role_id = $1", roleID); err != nil {
		return fmt.Errorf("clear permissions: %w", err)
	}

	if len(permissions) > 0 {
		insertPerms := `
			INSERT INTO store.store_role_permissions (role_id, permission_id)
			SELECT $1, id FROM app.permissions WHERE code = ANY($2)
			ON CONFLICT DO NOTHING`
		if _, err := tx.ExecContext(ctx, insertPerms, roleID, pq.Array(permissions)); err != nil {
			return fmt.Errorf("update store role permissions: %w", err)
		}
	}
	return nil
}

func (r *Repository) DeleteStoreRole(ctx context.Context, tx database.DBTX, roleID uuid.UUID) error {
	var systemRole bool
	err := tx.QueryRowContext(ctx, "SELECT system_role FROM store.store_roles WHERE id = $1", roleID).Scan(&systemRole)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if systemRole {
		return ErrSystemRoleProtected
	}

	var inUse bool
	err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM store.store_memberships WHERE role_id = $1)", roleID).Scan(&inUse)
	if err != nil {
		return err
	}
	if inUse {
		return ErrRoleInUse
	}

	res, err := tx.ExecContext(ctx, "DELETE FROM store.store_roles WHERE id = $1", roleID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// Memberships & Invitations
func (r *Repository) AssignMember(ctx context.Context, tx database.DBTX, storeID, userID uuid.UUID, roleCode string) error {
	var orgID uuid.UUID
	if err := tx.QueryRowContext(ctx, "SELECT organization_id FROM store.stores WHERE id = $1", storeID).Scan(&orgID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	var roleID uuid.UUID
	err := tx.QueryRowContext(ctx, "SELECT id FROM store.store_roles WHERE organization_id = $1 AND code = $2", orgID, roleCode).Scan(&roleID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("store role %q not found", roleCode)
		}
		return err
	}

	// Enforce BR-002: exactly one active role per user per store
	query := `
		INSERT INTO store.store_memberships (store_id, user_id, role_id, status, updated_at)
		VALUES ($1, $2, $3, 'active', clock_timestamp())
		ON CONFLICT (store_id, user_id)
		DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active', updated_at = clock_timestamp()`

	_, err = tx.ExecContext(ctx, query, storeID, userID, roleID)
	return err
}

func (r *Repository) ListMembers(ctx context.Context, tx database.DBTX, storeID uuid.UUID) ([]StoreMembershipResponse, error) {
	query := `
		SELECT m.id, m.store_id, m.user_id, u.first_name, COALESCE(u.last_name, ''),
		       COALESCE(c.normalized_value, ''), r.code, r.name, m.status, m.created_at
		FROM store.store_memberships m
		JOIN identity.users u ON u.id = m.user_id
		LEFT JOIN identity.user_contacts c ON c.user_id = u.id AND c.type = 'email' AND c.is_primary = true
		JOIN store.store_roles r ON r.id = m.role_id
		WHERE m.store_id = $1
		ORDER BY u.first_name ASC`

	rows, err := tx.QueryContext(ctx, query, storeID)
	if err != nil {
		return nil, fmt.Errorf("list store members: %w", err)
	}
	defer rows.Close()

	var members []StoreMembershipResponse
	for rows.Next() {
		var mem StoreMembershipResponse
		var createdAt time.Time
		if err := rows.Scan(
			&mem.ID, &mem.StoreID, &mem.UserID, &mem.FirstName, &mem.LastName,
			&mem.Email, &mem.RoleCode, &mem.RoleName, &mem.Status, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan store member: %w", err)
		}
		mem.CreatedAt = createdAt.Format(time.RFC3339)
		members = append(members, mem)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if members == nil {
		members = []StoreMembershipResponse{}
	}
	return members, nil
}

func (r *Repository) RemoveMember(ctx context.Context, tx database.DBTX, storeID, userID uuid.UUID) error {
	res, err := tx.ExecContext(ctx, "DELETE FROM store.store_memberships WHERE store_id = $1 AND user_id = $2", storeID, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) CreateInvitation(ctx context.Context, tx database.DBTX, storeID uuid.UUID, contact string, roleID uuid.UUID, tokenHash string, expiresAt time.Time, creatorID uuid.UUID) (*StoreInvitationResponse, error) {
	query := `
		INSERT INTO store.store_invitations (store_id, intended_contact, role_id, token_hash, expires_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, store_id, intended_contact, role_id, status, expires_at, created_by, created_at`

	var inv StoreInvitationResponse
	var expAt, createdAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID, contact, roleID, tokenHash, expiresAt, creatorID).Scan(
		&inv.ID, &inv.StoreID, &inv.IntendedContact, &inv.RoleID, &inv.Status, &expAt, &inv.CreatedBy, &createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create store invitation: %w", err)
	}
	inv.ExpiresAt = expAt.Format(time.RFC3339)
	inv.CreatedAt = createdAt.Format(time.RFC3339)

	// Fetch role details
	_ = tx.QueryRowContext(ctx, "SELECT code, name FROM store.store_roles WHERE id = $1", roleID).Scan(&inv.RoleCode, &inv.RoleName)
	return &inv, nil
}

func (r *Repository) ListInvitations(ctx context.Context, tx database.DBTX, storeID uuid.UUID) ([]StoreInvitationResponse, error) {
	query := `
		SELECT i.id, i.store_id, i.intended_contact, i.role_id, r.code, r.name, i.status, i.expires_at, i.created_by, i.created_at, i.accepted_at
		FROM store.store_invitations i
		JOIN store.store_roles r ON r.id = i.role_id
		WHERE i.store_id = $1 AND i.status = 'pending'
		ORDER BY i.created_at DESC`

	rows, err := tx.QueryContext(ctx, query, storeID)
	if err != nil {
		return nil, fmt.Errorf("list invitations: %w", err)
	}
	defer rows.Close()

	var list []StoreInvitationResponse
	for rows.Next() {
		var inv StoreInvitationResponse
		var expAt, createdAt time.Time
		var acceptedAt sql.NullTime
		if err := rows.Scan(
			&inv.ID, &inv.StoreID, &inv.IntendedContact, &inv.RoleID, &inv.RoleCode, &inv.RoleName,
			&inv.Status, &expAt, &inv.CreatedBy, &createdAt, &acceptedAt,
		); err != nil {
			return nil, fmt.Errorf("scan invitation: %w", err)
		}
		inv.ExpiresAt = expAt.Format(time.RFC3339)
		inv.CreatedAt = createdAt.Format(time.RFC3339)
		if acceptedAt.Valid {
			str := acceptedAt.Time.Format(time.RFC3339)
			inv.AcceptedAt = &str
		}
		list = append(list, inv)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []StoreInvitationResponse{}
	}
	return list, nil
}

func (r *Repository) AcceptInvitation(ctx context.Context, tx database.DBTX, tokenHash string, userID uuid.UUID) (*StoreResponse, error) {
	query := `
		SELECT id, store_id, role_id, status, expires_at
		FROM store.store_invitations
		WHERE token_hash = $1
		FOR UPDATE`

	var invID, storeID, roleID uuid.UUID
	var status string
	var expiresAt time.Time
	err := tx.QueryRowContext(ctx, query, tokenHash).Scan(&invID, &storeID, &roleID, &status, &expiresAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	if status == "accepted" {
		return nil, ErrInvitationAccepted
	}
	if status != "pending" || expiresAt.Before(time.Now()) {
		return nil, ErrInvitationExpired
	}

	// Update invitation status
	_, err = tx.ExecContext(ctx, `
		UPDATE store.store_invitations
		SET status = 'accepted', accepted_at = clock_timestamp()
		WHERE id = $1`, invID)
	if err != nil {
		return nil, fmt.Errorf("mark invitation accepted: %w", err)
	}

	// Assign membership (BR-002: exactly one role per store membership)
	assignQuery := `
		INSERT INTO store.store_memberships (store_id, user_id, role_id, status, updated_at)
		VALUES ($1, $2, $3, 'active', clock_timestamp())
		ON CONFLICT (store_id, user_id)
		DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active', updated_at = clock_timestamp()`
	if _, err := tx.ExecContext(ctx, assignQuery, storeID, userID, roleID); err != nil {
		return nil, fmt.Errorf("assign store membership from invitation: %w", err)
	}

	return r.GetStore(ctx, tx, storeID, userID)
}

func (r *Repository) RevokeInvitation(ctx context.Context, tx database.DBTX, invitationID, storeID uuid.UUID) error {
	res, err := tx.ExecContext(ctx, `
		UPDATE store.store_invitations
		SET status = 'revoked'
		WHERE id = $1 AND store_id = $2 AND status = 'pending'`,
		invitationID, storeID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// Dynamic Presentation Menus
func (r *Repository) GetAuthorizedMenus(ctx context.Context, tx database.DBTX, portal string, allowedPermissions []string) ([]MenuItemResponse, error) {
	query := `
		SELECT m.id, m.key, m.label, m.route, m.parent_id, m.portal, m.display_order, COALESCE(m.icon, '')
		FROM app.menus m
		WHERE m.portal = $1
		  AND (
		    NOT EXISTS (SELECT 1 FROM app.menu_permissions mp WHERE mp.menu_id = m.id)
		    OR EXISTS (
		      SELECT 1 FROM app.menu_permissions mp
		      JOIN app.permissions p ON p.id = mp.permission_id
		      WHERE mp.menu_id = m.id AND p.code = ANY($2)
		    )
		  )
		ORDER BY m.display_order ASC`

	rows, err := tx.QueryContext(ctx, query, portal, pq.Array(allowedPermissions))
	if err != nil {
		return nil, fmt.Errorf("query menus: %w", err)
	}
	defer rows.Close()

	var allItems []MenuItemResponse
	for rows.Next() {
		var item MenuItemResponse
		if err := rows.Scan(
			&item.ID, &item.Key, &item.Label, &item.Route, &item.ParentID, &item.Portal,
			&item.DisplayOrder, &item.Icon,
		); err != nil {
			return nil, fmt.Errorf("scan menu: %w", err)
		}
		item.Children = []MenuItemResponse{}
		allItems = append(allItems, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Build parent-child tree
	itemMap := make(map[uuid.UUID]*MenuItemResponse)
	for i := range allItems {
		itemMap[allItems[i].ID] = &allItems[i]
	}

	var rootItems []MenuItemResponse
	for _, item := range allItems {
		if item.ParentID == nil {
			rootItems = append(rootItems, *itemMap[item.ID])
		} else if parent, ok := itemMap[*item.ParentID]; ok {
			parent.Children = append(parent.Children, item)
		}
	}

	if rootItems == nil {
		rootItems = []MenuItemResponse{}
	}
	return rootItems, nil
}

// Domain D: Products, Inventory, and Customer Repositories

func (r *Repository) CreateProduct(ctx context.Context, tx database.DBTX, storeID uuid.UUID, sku, name, description string, price float64) (*ProductResponse, error) {
	query := `
		INSERT INTO store.products (store_id, sku, name, description, price, status)
		VALUES ($1, $2, $3, $4, $5, 'active')
		RETURNING id, store_id, sku, name, COALESCE(description, ''), price, status, created_at, updated_at`

	var p ProductResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID, sku, name, description, price).Scan(
		&p.ID, &p.StoreID, &p.SKU, &p.Name, &p.Description, &p.Price, &p.Status, &createdAt, &updatedAt,
	)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, ErrAlreadyExists
		}
		return nil, fmt.Errorf("insert product: %w", err)
	}
	p.CreatedAt = createdAt.Format(time.RFC3339)
	p.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &p, nil
}

func (r *Repository) GetProduct(ctx context.Context, tx database.DBTX, storeID, productID uuid.UUID) (*ProductResponse, error) {
	query := `
		SELECT id, store_id, sku, name, COALESCE(description, ''), price, status, created_at, updated_at
		FROM store.products
		WHERE store_id = $1 AND id = $2`

	var p ProductResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID, productID).Scan(
		&p.ID, &p.StoreID, &p.SKU, &p.Name, &p.Description, &p.Price, &p.Status, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get product: %w", err)
	}
	p.CreatedAt = createdAt.Format(time.RFC3339)
	p.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &p, nil
}

func (r *Repository) ListProducts(ctx context.Context, tx database.DBTX, storeID uuid.UUID) ([]ProductResponse, error) {
	query := `
		SELECT id, store_id, sku, name, COALESCE(description, ''), price, status, created_at, updated_at
		FROM store.products
		WHERE store_id = $1 AND status != 'archived'
		ORDER BY created_at DESC`

	rows, err := tx.QueryContext(ctx, query, storeID)
	if err != nil {
		return nil, fmt.Errorf("query products: %w", err)
	}
	defer rows.Close()

	var products []ProductResponse
	for rows.Next() {
		var p ProductResponse
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&p.ID, &p.StoreID, &p.SKU, &p.Name, &p.Description, &p.Price, &p.Status, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan product: %w", err)
		}
		p.CreatedAt = createdAt.Format(time.RFC3339)
		p.UpdatedAt = updatedAt.Format(time.RFC3339)
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if products == nil {
		products = []ProductResponse{}
	}
	return products, nil
}

func (r *Repository) UpdateProduct(ctx context.Context, tx database.DBTX, storeID, productID uuid.UUID, name, description string, price *float64, status string) (*ProductResponse, error) {
	existing, err := r.GetProduct(ctx, tx, storeID, productID)
	if err != nil {
		return nil, err
	}

	if name == "" {
		name = existing.Name
	}
	if description == "" {
		description = existing.Description
	}
	targetPrice := existing.Price
	if price != nil {
		targetPrice = *price
	}
	if status == "" {
		status = existing.Status
	}

	query := `
		UPDATE store.products
		SET name = $1, description = $2, price = $3, status = $4, updated_at = clock_timestamp()
		WHERE store_id = $5 AND id = $6
		RETURNING id, store_id, sku, name, COALESCE(description, ''), price, status, created_at, updated_at`

	var p ProductResponse
	var createdAt, updatedAt time.Time
	err = tx.QueryRowContext(ctx, query, name, description, targetPrice, status, storeID, productID).Scan(
		&p.ID, &p.StoreID, &p.SKU, &p.Name, &p.Description, &p.Price, &p.Status, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update product: %w", err)
	}
	p.CreatedAt = createdAt.Format(time.RFC3339)
	p.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &p, nil
}

// Inventory Locations
func (r *Repository) GetDefaultLocation(ctx context.Context, tx database.DBTX, storeID uuid.UUID) (*InventoryLocationResponse, error) {
	query := `
		SELECT id, store_id, name, is_default, created_at, updated_at
		FROM store.inventory_locations
		WHERE store_id = $1 AND is_default = true
		LIMIT 1`

	var l InventoryLocationResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID).Scan(
		&l.ID, &l.StoreID, &l.Name, &l.IsDefault, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			fallbackQuery := `
				SELECT id, store_id, name, is_default, created_at, updated_at
				FROM store.inventory_locations
				WHERE store_id = $1
				ORDER BY created_at ASC
				LIMIT 1`
			err = tx.QueryRowContext(ctx, fallbackQuery, storeID).Scan(
				&l.ID, &l.StoreID, &l.Name, &l.IsDefault, &createdAt, &updatedAt,
			)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					return nil, ErrNotFound
				}
				return nil, fmt.Errorf("get fallback location: %w", err)
			}
		} else {
			return nil, fmt.Errorf("get default location: %w", err)
		}
	}
	l.CreatedAt = createdAt.Format(time.RFC3339)
	l.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &l, nil
}

func (r *Repository) CreateLocation(ctx context.Context, tx database.DBTX, storeID uuid.UUID, name string, isDefault bool) (*InventoryLocationResponse, error) {
	if isDefault {
		_, err := tx.ExecContext(ctx, `UPDATE store.inventory_locations SET is_default = false WHERE store_id = $1`, storeID)
		if err != nil {
			return nil, fmt.Errorf("clear default location: %w", err)
		}
	}

	query := `
		INSERT INTO store.inventory_locations (store_id, name, is_default)
		VALUES ($1, $2, $3)
		RETURNING id, store_id, name, is_default, created_at, updated_at`

	var l InventoryLocationResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID, name, isDefault).Scan(
		&l.ID, &l.StoreID, &l.Name, &l.IsDefault, &createdAt, &updatedAt,
	)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, ErrAlreadyExists
		}
		return nil, fmt.Errorf("insert location: %w", err)
	}
	l.CreatedAt = createdAt.Format(time.RFC3339)
	l.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &l, nil
}

func (r *Repository) ListLocations(ctx context.Context, tx database.DBTX, storeID uuid.UUID) ([]InventoryLocationResponse, error) {
	query := `
		SELECT id, store_id, name, is_default, created_at, updated_at
		FROM store.inventory_locations
		WHERE store_id = $1
		ORDER BY is_default DESC, name ASC`

	rows, err := tx.QueryContext(ctx, query, storeID)
	if err != nil {
		return nil, fmt.Errorf("query locations: %w", err)
	}
	defer rows.Close()

	var locs []InventoryLocationResponse
	for rows.Next() {
		var l InventoryLocationResponse
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&l.ID, &l.StoreID, &l.Name, &l.IsDefault, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan location: %w", err)
		}
		l.CreatedAt = createdAt.Format(time.RFC3339)
		l.UpdatedAt = updatedAt.Format(time.RFC3339)
		locs = append(locs, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if locs == nil {
		locs = []InventoryLocationResponse{}
	}
	return locs, nil
}

// Inventory Balances & Movements
func (r *Repository) ListInventoryBalances(ctx context.Context, tx database.DBTX, storeID uuid.UUID, productID, locationID *uuid.UUID) ([]InventoryBalanceResponse, error) {
	query := `
		SELECT b.store_id, b.product_id, p.name, p.sku, b.location_id, l.name, b.quantity, b.updated_at
		FROM store.inventory_balances b
		JOIN store.products p ON p.id = b.product_id
		JOIN store.inventory_locations l ON l.id = b.location_id
		WHERE b.store_id = $1
		  AND ($2::uuid IS NULL OR b.product_id = $2)
		  AND ($3::uuid IS NULL OR b.location_id = $3)
		ORDER BY p.name ASC, l.name ASC`

	rows, err := tx.QueryContext(ctx, query, storeID, productID, locationID)
	if err != nil {
		return nil, fmt.Errorf("query inventory balances: %w", err)
	}
	defer rows.Close()

	var balances []InventoryBalanceResponse
	for rows.Next() {
		var b InventoryBalanceResponse
		var updatedAt time.Time
		if err := rows.Scan(
			&b.StoreID, &b.ProductID, &b.ProductName, &b.SKU,
			&b.LocationID, &b.LocationName, &b.Quantity, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan inventory balance: %w", err)
		}
		b.UpdatedAt = updatedAt.Format(time.RFC3339)
		balances = append(balances, b)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if balances == nil {
		balances = []InventoryBalanceResponse{}
	}
	return balances, nil
}

func (r *Repository) RecordStockMovement(ctx context.Context, tx database.DBTX, storeID, productID, locationID uuid.UUID, delta float64, reason string, refID, actorID *uuid.UUID) (*StockMovementResponse, error) {
	query := `
		INSERT INTO store.stock_movements (store_id, product_id, location_id, quantity_delta, reason, reference_id, actor_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, store_id, product_id, location_id, quantity_delta, reason, reference_id, actor_user_id, created_at`

	var m StockMovementResponse
	var createdAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID, productID, locationID, delta, reason, refID, actorID).Scan(
		&m.ID, &m.StoreID, &m.ProductID, &m.LocationID, &m.QuantityDelta, &m.Reason, &m.ReferenceID, &m.ActorUserID, &createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert stock movement: %w", err)
	}
	m.CreatedAt = createdAt.Format(time.RFC3339)
	return &m, nil
}

// Store Customers
func (r *Repository) CreateCustomer(ctx context.Context, tx database.DBTX, storeID uuid.UUID, customerNumber, displayName, phone, email, address string, consumerID *uuid.UUID) (*StoreCustomerResponse, error) {
	if customerNumber == "" {
		var count int
		_ = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM store.store_customers WHERE store_id = $1", storeID).Scan(&count)
		customerNumber = fmt.Sprintf("CUST-%05d", count+1)
	}

	query := `
		INSERT INTO store.store_customers (store_id, customer_number, display_name, phone, email, address, consumer_id)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), $7)
		RETURNING id, store_id, customer_number, display_name, COALESCE(phone, ''), COALESCE(email, ''), COALESCE(address, ''), consumer_id, created_at, updated_at`

	var c StoreCustomerResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID, customerNumber, displayName, phone, email, address, consumerID).Scan(
		&c.ID, &c.StoreID, &c.CustomerNumber, &c.DisplayName, &c.Phone, &c.Email, &c.Address, &c.ConsumerID, &createdAt, &updatedAt,
	)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, ErrAlreadyExists
		}
		return nil, fmt.Errorf("insert customer: %w", err)
	}
	c.CreatedAt = createdAt.Format(time.RFC3339)
	c.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &c, nil
}

func (r *Repository) GetCustomer(ctx context.Context, tx database.DBTX, storeID, customerID uuid.UUID) (*StoreCustomerResponse, error) {
	query := `
		SELECT id, store_id, customer_number, display_name, COALESCE(phone, ''), COALESCE(email, ''), COALESCE(address, ''), consumer_id, created_at, updated_at
		FROM store.store_customers
		WHERE store_id = $1 AND id = $2`

	var c StoreCustomerResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID, customerID).Scan(
		&c.ID, &c.StoreID, &c.CustomerNumber, &c.DisplayName, &c.Phone, &c.Email, &c.Address, &c.ConsumerID, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get customer: %w", err)
	}
	c.CreatedAt = createdAt.Format(time.RFC3339)
	c.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &c, nil
}

func (r *Repository) ListCustomers(ctx context.Context, tx database.DBTX, storeID uuid.UUID) ([]StoreCustomerResponse, error) {
	query := `
		SELECT id, store_id, customer_number, display_name, COALESCE(phone, ''), COALESCE(email, ''), COALESCE(address, ''), consumer_id, created_at, updated_at
		FROM store.store_customers
		WHERE store_id = $1
		ORDER BY created_at DESC`

	rows, err := tx.QueryContext(ctx, query, storeID)
	if err != nil {
		return nil, fmt.Errorf("query customers: %w", err)
	}
	defer rows.Close()

	var customers []StoreCustomerResponse
	for rows.Next() {
		var c StoreCustomerResponse
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&c.ID, &c.StoreID, &c.CustomerNumber, &c.DisplayName, &c.Phone, &c.Email, &c.Address, &c.ConsumerID, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan customer: %w", err)
		}
		c.CreatedAt = createdAt.Format(time.RFC3339)
		c.UpdatedAt = updatedAt.Format(time.RFC3339)
		customers = append(customers, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if customers == nil {
		customers = []StoreCustomerResponse{}
	}
	return customers, nil
}

func (r *Repository) UpdateCustomer(ctx context.Context, tx database.DBTX, storeID, customerID uuid.UUID, displayName, phone, email, address string, consumerID *uuid.UUID) (*StoreCustomerResponse, error) {
	existing, err := r.GetCustomer(ctx, tx, storeID, customerID)
	if err != nil {
		return nil, err
	}

	if displayName == "" {
		displayName = existing.DisplayName
	}
	if phone == "" {
		phone = existing.Phone
	}
	if email == "" {
		email = existing.Email
	}
	if address == "" {
		address = existing.Address
	}
	targetConsumerID := existing.ConsumerID
	if consumerID != nil {
		targetConsumerID = consumerID
	}

	query := `
		UPDATE store.store_customers
		SET display_name = $1, phone = NULLIF($2, ''), email = NULLIF($3, ''), address = NULLIF($4, ''), consumer_id = $5, updated_at = clock_timestamp()
		WHERE store_id = $6 AND id = $7
		RETURNING id, store_id, customer_number, display_name, COALESCE(phone, ''), COALESCE(email, ''), COALESCE(address, ''), consumer_id, created_at, updated_at`

	var c StoreCustomerResponse
	var createdAt, updatedAt time.Time
	err = tx.QueryRowContext(ctx, query, displayName, phone, email, address, targetConsumerID, storeID, customerID).Scan(
		&c.ID, &c.StoreID, &c.CustomerNumber, &c.DisplayName, &c.Phone, &c.Email, &c.Address, &c.ConsumerID, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update customer: %w", err)
	}
	c.CreatedAt = createdAt.Format(time.RFC3339)
	c.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &c, nil
}

