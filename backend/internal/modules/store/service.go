package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/authz"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/modules/system"
	"github.com/google/uuid"
)

type AuditIntegration interface {
	RecordAuditTx(ctx context.Context, tx database.DBTX, actorUserID *uuid.UUID, orgID, storeID *uuid.UUID, action string, details map[string]any) (*system.AuditEventResponse, error)
}

type Service struct {
	repo      *Repository
	txm       database.TxManager
	systemSvc AuditIntegration
}

func NewService(repo *Repository, txm database.TxManager) *Service {
	return &Service{
		repo: repo,
		txm:  txm,
	}
}

func (s *Service) SetSystemService(sys AuditIntegration) {
	s.systemSvc = sys
}

var nonAlphanumericRegex = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = nonAlphanumericRegex.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func generateSecureToken(bytesCount int) (string, error) {
	b := make([]byte, bytesCount)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// Store Management
func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateStoreRequest) (*StoreResponse, error) {
	slug := req.Slug
	if slug == "" {
		slug = slugify(req.Name)
		if len(slug) < 2 {
			slug = fmt.Sprintf("store-%s", uuid.New().String()[:8])
		}
	}

	var res *StoreResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		// Require store.create permission or org owner
		hasPerm, err := authz.HasOrgPermission(ctx, tx, req.OrganizationID, userID, "store.create")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		// Enforce BR-004: Valid subscription entitlement permits store creation
		if err := s.repo.CheckStoreQuota(ctx, tx, req.OrganizationID); err != nil {
			return err
		}

		res, err = s.repo.CreateStore(ctx, tx, req.OrganizationID, req.Name, slug, userID)
		if err != nil {
			return err
		}

		if s.systemSvc != nil {
			_, _ = s.systemSvc.RecordAuditTx(ctx, tx, &userID, &req.OrganizationID, &res.ID, "store.created", map[string]any{
				"store_id":        res.ID.String(),
				"name":            res.Name,
				"slug":            res.Slug,
				"organization_id": req.OrganizationID.String(),
			})
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) Get(ctx context.Context, storeID, userID uuid.UUID) (*StoreResponse, error) {
	var res *StoreResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "store.read")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.GetStore(ctx, tx, storeID, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) List(ctx context.Context, orgID, userID uuid.UUID) ([]StoreResponse, error) {
	var res []StoreResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		_, ok, err := s.repo.CheckOrgPermission(ctx, tx, orgID, userID)
		if err != nil || !ok {
			return ErrForbidden
		}
		res, err = s.repo.ListStores(ctx, tx, orgID, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) Update(ctx context.Context, storeID, userID uuid.UUID, req UpdateStoreRequest) (*StoreResponse, error) {
	var res *StoreResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "store.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.UpdateStore(ctx, tx, storeID, req.Name, req.Status)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Store Settings
func (s *Service) GetSettings(ctx context.Context, storeID, userID uuid.UUID) (*StoreSettingsResponse, error) {
	var res *StoreSettingsResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "store.read")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.GetStoreSettings(ctx, tx, storeID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) UpdateSettings(ctx context.Context, storeID, userID uuid.UUID, req UpdateStoreSettingsRequest) (*StoreSettingsResponse, error) {
	var res *StoreSettingsResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "store.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.UpdateStoreSettings(ctx, tx, storeID, req)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Permissions Catalog
func (s *Service) ListPermissions(ctx context.Context, scope string) ([]PermissionResponse, error) {
	var res []PermissionResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.ListPermissions(ctx, tx, scope)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Reusable Store Roles
func (s *Service) ListRoles(ctx context.Context, orgID, userID uuid.UUID) ([]StoreRoleResponse, error) {
	var res []StoreRoleResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		_, ok, err := s.repo.CheckOrgPermission(ctx, tx, orgID, userID)
		if err != nil || !ok {
			return ErrForbidden
		}
		res, err = s.repo.ListStoreRoles(ctx, tx, orgID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) CreateRole(ctx context.Context, orgID, userID uuid.UUID, req CreateStoreRoleRequest) (*StoreRoleResponse, error) {
	var res *StoreRoleResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasOrgPermission(ctx, tx, orgID, userID, "organization.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.CreateStoreRole(ctx, tx, orgID, req.Code, req.Name, req.Permissions)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) UpdateRolePermissions(ctx context.Context, roleID, userID uuid.UUID, req UpdateStoreRolePermissionsRequest) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		role, err := s.repo.GetStoreRole(ctx, tx, roleID)
		if err != nil {
			return err
		}
		hasPerm, err := authz.HasOrgPermission(ctx, tx, role.OrganizationID, userID, "organization.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		return s.repo.UpdateStoreRolePermissions(ctx, tx, roleID, req.Permissions)
	})
}

func (s *Service) DeleteRole(ctx context.Context, roleID, userID uuid.UUID) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		role, err := s.repo.GetStoreRole(ctx, tx, roleID)
		if err != nil {
			return err
		}
		hasPerm, err := authz.HasOrgPermission(ctx, tx, role.OrganizationID, userID, "organization.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		return s.repo.DeleteStoreRole(ctx, tx, roleID)
	})
}

// Memberships & Invitations
func (s *Service) AssignMember(ctx context.Context, storeID, currentUserID uuid.UUID, req AssignStoreMemberRequest) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, currentUserID, "staff.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		// Enforce BR-002: One active role per user per store
		return s.repo.AssignMember(ctx, tx, storeID, req.UserID, req.RoleCode)
	})
}

func (s *Service) ListMembers(ctx context.Context, storeID, currentUserID uuid.UUID) ([]StoreMembershipResponse, error) {
	var res []StoreMembershipResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, currentUserID, "store.read")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.ListMembers(ctx, tx, storeID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) RemoveMember(ctx context.Context, storeID, currentUserID, targetUserID uuid.UUID) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		if currentUserID != targetUserID {
			hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, currentUserID, "staff.manage")
			if err != nil {
				return err
			}
			if !hasPerm {
				return ErrForbidden
			}
		}

		return s.repo.RemoveMember(ctx, tx, storeID, targetUserID)
	})
}

func (s *Service) InviteStaff(ctx context.Context, storeID, currentUserID uuid.UUID, req CreateStoreInvitationRequest) (*StoreInvitationResponse, error) {
	rawToken, err := generateSecureToken(32)
	if err != nil {
		return nil, fmt.Errorf("generate invitation token: %w", err)
	}
	tokenHash := HashToken(rawToken)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	var res *StoreInvitationResponse
	err = s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, currentUserID, "staff.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.CreateInvitation(ctx, tx, storeID, req.IntendedContact, req.RoleID, tokenHash, expiresAt, currentUserID)
		return err
	})
	if err != nil {
		return nil, err
	}
	res.InvitationToken = rawToken
	return res, nil
}

func (s *Service) ListInvitations(ctx context.Context, storeID, currentUserID uuid.UUID) ([]StoreInvitationResponse, error) {
	var res []StoreInvitationResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, currentUserID, "staff.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.ListInvitations(ctx, tx, storeID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) AcceptInvitation(ctx context.Context, currentUserID uuid.UUID, req AcceptStoreInvitationRequest) (*StoreResponse, error) {
	tokenHash := HashToken(req.Token)
	var res *StoreResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.AcceptInvitation(ctx, tx, tokenHash, currentUserID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) RevokeInvitation(ctx context.Context, storeID, invitationID, currentUserID uuid.UUID) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, currentUserID, "staff.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		return s.repo.RevokeInvitation(ctx, tx, invitationID, storeID)
	})
}

// Presentation Menus
func (s *Service) GetAuthorizedMenus(ctx context.Context, portal string, storeID, userID uuid.UUID) ([]MenuItemResponse, error) {
	if portal == "" {
		portal = "merchant"
	}

	var res []MenuItemResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var perms []string
		if storeID != uuid.Nil {
			var err error
			perms, err = authz.GetStorePermissions(ctx, tx, storeID, userID)
			if err != nil {
				return err
			}
		}

		var err error
		res, err = s.repo.GetAuthorizedMenus(ctx, tx, portal, perms)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Domain D: Products & Inventory

func (s *Service) CreateProduct(ctx context.Context, storeID, userID uuid.UUID, req CreateProductRequest) (*ProductResponse, error) {
	var res *ProductResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.write")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.CreateProduct(ctx, tx, storeID, req.SKU, req.Name, req.Description, req.Price)
		if err != nil {
			return err
		}

		// If initial stock quantity provided, record initial movement
		if req.InitialQuantity != nil && *req.InitialQuantity > 0 {
			var locID uuid.UUID
			if req.LocationID != nil && *req.LocationID != uuid.Nil {
				locID = *req.LocationID
			} else {
				loc, err := s.repo.GetDefaultLocation(ctx, tx, storeID)
				if err != nil {
					return err
				}
				locID = loc.ID
			}

			_, err = s.repo.RecordStockMovement(ctx, tx, storeID, res.ID, locID, *req.InitialQuantity, "initial_stock", nil, &userID)
			if err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) GetProduct(ctx context.Context, storeID, productID, userID uuid.UUID) (*ProductResponse, error) {
	var res *ProductResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.read")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.GetProduct(ctx, tx, storeID, productID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListProducts(ctx context.Context, storeID, userID uuid.UUID) ([]ProductResponse, error) {
	var res []ProductResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.read")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.ListProducts(ctx, tx, storeID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) UpdateProduct(ctx context.Context, storeID, productID, userID uuid.UUID, req UpdateProductRequest) (*ProductResponse, error) {
	var res *ProductResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.write")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.UpdateProduct(ctx, tx, storeID, productID, req.Name, req.Description, req.Price, req.Status)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Inventory Locations
func (s *Service) CreateLocation(ctx context.Context, storeID, userID uuid.UUID, req CreateInventoryLocationRequest) (*InventoryLocationResponse, error) {
	var res *InventoryLocationResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.write")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.CreateLocation(ctx, tx, storeID, req.Name, req.IsDefault)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListLocations(ctx context.Context, storeID, userID uuid.UUID) ([]InventoryLocationResponse, error) {
	var res []InventoryLocationResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.read")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.ListLocations(ctx, tx, storeID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Inventory Balances & Movements
func (s *Service) ListInventoryBalances(ctx context.Context, storeID, userID uuid.UUID, productID, locationID *uuid.UUID) ([]InventoryBalanceResponse, error) {
	var res []InventoryBalanceResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.read")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.ListInventoryBalances(ctx, tx, storeID, productID, locationID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) RecordStockMovement(ctx context.Context, storeID, userID uuid.UUID, req RecordStockMovementRequest) (*StockMovementResponse, error) {
	var res *StockMovementResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.write")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.RecordStockMovement(ctx, tx, storeID, req.ProductID, req.LocationID, req.QuantityDelta, req.Reason, req.ReferenceID, &userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Store Customers
func (s *Service) CreateCustomer(ctx context.Context, storeID, userID uuid.UUID, req CreateStoreCustomerRequest) (*StoreCustomerResponse, error) {
	var res *StoreCustomerResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "customer.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.CreateCustomer(ctx, tx, storeID, req.CustomerNumber, req.DisplayName, req.Phone, req.Email, req.Address, req.ConsumerID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) GetCustomer(ctx context.Context, storeID, customerID, userID uuid.UUID) (*StoreCustomerResponse, error) {
	var res *StoreCustomerResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "customer.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.GetCustomer(ctx, tx, storeID, customerID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListCustomers(ctx context.Context, storeID, userID uuid.UUID) ([]StoreCustomerResponse, error) {
	var res []StoreCustomerResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "customer.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.ListCustomers(ctx, tx, storeID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) UpdateCustomer(ctx context.Context, storeID, customerID, userID uuid.UUID, req UpdateStoreCustomerRequest) (*StoreCustomerResponse, error) {
	var res *StoreCustomerResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "customer.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.UpdateCustomer(ctx, tx, storeID, customerID, req.DisplayName, req.Phone, req.Email, req.Address, req.ConsumerID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

