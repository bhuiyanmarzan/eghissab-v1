package authz

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

var (
	ErrForbidden     = errors.New("authz: access forbidden")
	ErrStoreNotFound = errors.New("authz: store not found")
	ErrOrgNotFound   = errors.New("authz: organization not found")
)

// HasStorePermission checks whether a user has a specific permission in a store.
// Organization owners possess implicit supervisory authorization over all stores in their organization.
// Other users must have an active store membership whose assigned role includes the permission.
func HasStorePermission(ctx context.Context, tx database.DBTX, storeID, userID uuid.UUID, permissionCode string) (bool, error) {
	if storeID == uuid.Nil || userID == uuid.Nil || permissionCode == "" {
		return false, nil
	}

	var hasPerm bool
	err := tx.QueryRowContext(ctx, "SELECT app.has_store_permission($1, $2, $3)", storeID, userID, permissionCode).Scan(&hasPerm)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("authz: check store permission: %w", err)
	}

	return hasPerm, nil
}

// HasOrgPermission checks whether a user has an organization-scoped permission.
// Organization owners possess implicit supervisory permission over all organization operations.
func HasOrgPermission(ctx context.Context, tx database.DBTX, orgID, userID uuid.UUID, permissionCode string) (bool, error) {
	if orgID == uuid.Nil || userID == uuid.Nil || permissionCode == "" {
		return false, nil
	}

	var hasPerm bool
	err := tx.QueryRowContext(ctx, "SELECT app.has_org_permission($1, $2, $3)", orgID, userID, permissionCode).Scan(&hasPerm)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("authz: check org permission: %w", err)
	}

	return hasPerm, nil
}

// GetStorePermissions returns all permission codes granted to the user for a given store.
// If the caller is an active organization owner, all store-scoped permissions are returned.
func GetStorePermissions(ctx context.Context, tx database.DBTX, storeID, userID uuid.UUID) ([]string, error) {
	if storeID == uuid.Nil || userID == uuid.Nil {
		return []string{}, nil
	}

	var perms []string
	err := tx.QueryRowContext(ctx, "SELECT app.get_store_permissions($1, $2)", storeID, userID).Scan(pq.Array(&perms))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("authz: get store permissions: %w", err)
	}
	if perms == nil {
		perms = []string{}
	}
	return perms, nil
}
