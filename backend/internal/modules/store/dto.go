package store

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

var (
	slugRegex = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	roleCodeRegex = regexp.MustCompile(`^[a-z0-9_]+$`)
	currencyRegex = regexp.MustCompile(`^[A-Z]{3}$`)
)

type ValidationError struct {
	Field string `json:"field"`
	Msg   string `json:"message"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Msg)
}

// StoreResponse represents a store entity.
type StoreResponse struct {
	ID             uuid.UUID              `json:"id"`
	OrganizationID uuid.UUID              `json:"organization_id"`
	Name           string                 `json:"name"`
	Slug           string                 `json:"slug"`
	Status         string                 `json:"status"`
	CreatedBy      *uuid.UUID             `json:"created_by,omitempty"`
	CreatedAt      string                 `json:"created_at"`
	UpdatedAt      string                 `json:"updated_at"`
	RoleCode       string                 `json:"role_code,omitempty"`
	RoleName       string                 `json:"role_name,omitempty"`
	Settings       *StoreSettingsResponse `json:"settings,omitempty"`
}

// StoreMembershipResponse represents a user's membership and assigned role in a store.
type StoreMembershipResponse struct {
	ID        uuid.UUID `json:"id"`
	StoreID   uuid.UUID `json:"store_id"`
	UserID    uuid.UUID `json:"user_id"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name,omitempty"`
	Email     string    `json:"email"`
	RoleCode  string    `json:"role_code"`
	RoleName  string    `json:"role_name"`
	Status    string    `json:"status"`
	CreatedAt string    `json:"created_at"`
}

// PermissionResponse represents a catalog permission.
type PermissionResponse struct {
	ID          uuid.UUID `json:"id"`
	Code        string    `json:"code"`
	Scope       string    `json:"scope"`
	Description string    `json:"description,omitempty"`
}

// StoreRoleResponse represents an organization-reusable store role.
type StoreRoleResponse struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	Code           string    `json:"code"`
	Name           string    `json:"name"`
	SystemRole     bool      `json:"system_role"`
	Permissions    []string  `json:"permissions"`
	CreatedAt      string    `json:"created_at"`
}

// StoreSettingsResponse represents store-specific configuration.
type StoreSettingsResponse struct {
	StoreID            uuid.UUID       `json:"store_id"`
	Timezone           string          `json:"timezone"`
	Currency           string          `json:"currency"`
	InvoicePreferences json.RawMessage `json:"invoice_preferences"`
	CreatedAt          string          `json:"created_at"`
	UpdatedAt          string          `json:"updated_at"`
}

// StoreInvitationResponse represents a staff member invitation.
type StoreInvitationResponse struct {
	ID              uuid.UUID  `json:"id"`
	StoreID         uuid.UUID  `json:"store_id"`
	IntendedContact string     `json:"intended_contact"`
	RoleID          uuid.UUID  `json:"role_id"`
	RoleCode        string     `json:"role_code"`
	RoleName        string     `json:"role_name"`
	Status          string     `json:"status"`
	ExpiresAt       string     `json:"expires_at"`
	CreatedBy       uuid.UUID  `json:"created_by"`
	CreatedAt       string     `json:"created_at"`
	AcceptedAt      *string    `json:"accepted_at,omitempty"`
	InvitationToken string     `json:"invitation_token,omitempty"`
}

// MenuItemResponse represents an authorized navigation menu item.
type MenuItemResponse struct {
	ID           uuid.UUID          `json:"id"`
	Key          string             `json:"key"`
	Label        string             `json:"label"`
	Route        string             `json:"route"`
	ParentID     *uuid.UUID         `json:"parent_id,omitempty"`
	Portal       string             `json:"portal"`
	DisplayOrder int                `json:"display_order"`
	Icon         string             `json:"icon,omitempty"`
	Children     []MenuItemResponse `json:"children,omitempty"`
}

// CreateStoreRequest defines input for creating a new store.
type CreateStoreRequest struct {
	OrganizationID uuid.UUID `json:"organization_id"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug,omitempty"`
}

func (req *CreateStoreRequest) Validate() error {
	if req.OrganizationID == uuid.Nil {
		return &ValidationError{Field: "organization_id", Msg: "valid organization_id is required"}
	}
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

// UpdateStoreRequest defines input for updating a store's details.
type UpdateStoreRequest struct {
	Name   string `json:"name"`
	Status string `json:"status,omitempty"`
}

func (req *UpdateStoreRequest) Validate() error {
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 || len(req.Name) > 120 {
		return &ValidationError{Field: "name", Msg: "name must be between 2 and 120 characters"}
	}
	if req.Status != "" {
		req.Status = strings.ToLower(strings.TrimSpace(req.Status))
		if req.Status != "active" && req.Status != "suspended" && req.Status != "archived" {
			return &ValidationError{Field: "status", Msg: "status must be active, suspended, or archived"}
		}
	}
	return nil
}

// AssignStoreMemberRequest defines input for assigning a user to a store with a role.
type AssignStoreMemberRequest struct {
	UserID   uuid.UUID `json:"user_id"`
	RoleCode string    `json:"role_code"`
}

func (req *AssignStoreMemberRequest) Validate() error {
	if req.UserID == uuid.Nil {
		return &ValidationError{Field: "user_id", Msg: "valid user_id is required"}
	}
	req.RoleCode = strings.ToLower(strings.TrimSpace(req.RoleCode))
	if req.RoleCode == "" {
		return &ValidationError{Field: "role_code", Msg: "role_code is required"}
	}
	return nil
}

// CreateStoreRoleRequest defines input for creating a reusable store role under an organization.
type CreateStoreRoleRequest struct {
	OrganizationID uuid.UUID `json:"organization_id"`
	Code           string    `json:"code"`
	Name           string    `json:"name"`
	Permissions    []string  `json:"permissions"`
}

func (req *CreateStoreRoleRequest) Validate() error {
	if req.OrganizationID == uuid.Nil {
		return &ValidationError{Field: "organization_id", Msg: "valid organization_id is required"}
	}
	req.Code = strings.ToLower(strings.TrimSpace(req.Code))
	if len(req.Code) < 2 || len(req.Code) > 50 || !roleCodeRegex.MatchString(req.Code) {
		return &ValidationError{Field: "code", Msg: "code must be 2-50 lowercase alphanumeric characters or underscores"}
	}
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 || len(req.Name) > 100 {
		return &ValidationError{Field: "name", Msg: "name must be between 2 and 100 characters"}
	}
	return nil
}

// UpdateStoreRolePermissionsRequest defines input for updating role permissions.
type UpdateStoreRolePermissionsRequest struct {
	Permissions []string `json:"permissions"`
}

func (req *UpdateStoreRolePermissionsRequest) Validate() error {
	if req.Permissions == nil {
		req.Permissions = []string{}
	}
	for i, p := range req.Permissions {
		req.Permissions[i] = strings.TrimSpace(p)
		if req.Permissions[i] == "" {
			return &ValidationError{Field: "permissions", Msg: "permission code cannot be empty"}
		}
	}
	return nil
}

// UpdateStoreSettingsRequest defines input for updating store settings.
type UpdateStoreSettingsRequest struct {
	Timezone           string          `json:"timezone,omitempty"`
	Currency           string          `json:"currency,omitempty"`
	InvoicePreferences json.RawMessage `json:"invoice_preferences,omitempty"`
}

func (req *UpdateStoreSettingsRequest) Validate() error {
	if req.Timezone != "" {
		req.Timezone = strings.TrimSpace(req.Timezone)
		if len(req.Timezone) < 2 || len(req.Timezone) > 50 {
			return &ValidationError{Field: "timezone", Msg: "timezone must be between 2 and 50 characters"}
		}
	}
	if req.Currency != "" {
		req.Currency = strings.ToUpper(strings.TrimSpace(req.Currency))
		if !currencyRegex.MatchString(req.Currency) {
			return &ValidationError{Field: "currency", Msg: "currency must be a valid 3-letter ISO code"}
		}
	}
	if len(req.InvoicePreferences) > 0 {
		var js map[string]any
		if err := json.Unmarshal(req.InvoicePreferences, &js); err != nil {
			return &ValidationError{Field: "invoice_preferences", Msg: "invoice_preferences must be a valid JSON object"}
		}
	}
	return nil
}

// CreateStoreInvitationRequest defines input for inviting staff to a store.
type CreateStoreInvitationRequest struct {
	IntendedContact string    `json:"intended_contact"`
	RoleID          uuid.UUID `json:"role_id"`
}

func (req *CreateStoreInvitationRequest) Validate() error {
	req.IntendedContact = strings.TrimSpace(req.IntendedContact)
	if len(req.IntendedContact) < 3 || len(req.IntendedContact) > 320 {
		return &ValidationError{Field: "intended_contact", Msg: "intended_contact must be between 3 and 320 characters"}
	}
	if req.RoleID == uuid.Nil {
		return &ValidationError{Field: "role_id", Msg: "valid role_id is required"}
	}
	return nil
}

// AcceptStoreInvitationRequest defines input for accepting a store staff invitation.
type AcceptStoreInvitationRequest struct {
	Token string `json:"token"`
}

func (req *AcceptStoreInvitationRequest) Validate() error {
	req.Token = strings.TrimSpace(req.Token)
	if len(req.Token) < 16 {
		return &ValidationError{Field: "token", Msg: "valid invitation token is required"}
	}
	return nil
}

// Domain D: Products & Inventory DTOs

type ProductResponse struct {
	ID          uuid.UUID `json:"id"`
	StoreID     uuid.UUID `json:"store_id"`
	SKU         string    `json:"sku"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Price       float64   `json:"price"`
	Status      string    `json:"status"`
	CreatedAt   string    `json:"created_at"`
	UpdatedAt   string    `json:"updated_at"`
}

type CreateProductRequest struct {
	SKU             string     `json:"sku"`
	Name            string     `json:"name"`
	Description     string     `json:"description,omitempty"`
	Price           float64    `json:"price"`
	InitialQuantity *float64   `json:"initial_quantity,omitempty"`
	LocationID      *uuid.UUID `json:"location_id,omitempty"`
}

func (req *CreateProductRequest) Validate() error {
	req.SKU = strings.TrimSpace(req.SKU)
	if len(req.SKU) < 1 || len(req.SKU) > 64 {
		return &ValidationError{Field: "sku", Msg: "sku is required and must be at most 64 characters"}
	}
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 || len(req.Name) > 200 {
		return &ValidationError{Field: "name", Msg: "name must be between 2 and 200 characters"}
	}
	if req.Price < 0 {
		return &ValidationError{Field: "price", Msg: "price cannot be negative"}
	}
	return nil
}

type UpdateProductRequest struct {
	Name        string   `json:"name,omitempty"`
	Description string   `json:"description,omitempty"`
	Price       *float64 `json:"price,omitempty"`
	Status      string   `json:"status,omitempty"`
}

func (req *UpdateProductRequest) Validate() error {
	if req.Name != "" {
		req.Name = strings.TrimSpace(req.Name)
		if len(req.Name) < 2 || len(req.Name) > 200 {
			return &ValidationError{Field: "name", Msg: "name must be between 2 and 200 characters"}
		}
	}
	if req.Price != nil && *req.Price < 0 {
		return &ValidationError{Field: "price", Msg: "price cannot be negative"}
	}
	if req.Status != "" {
		req.Status = strings.ToLower(strings.TrimSpace(req.Status))
		if req.Status != "active" && req.Status != "inactive" && req.Status != "archived" {
			return &ValidationError{Field: "status", Msg: "status must be active, inactive, or archived"}
		}
	}
	return nil
}

type InventoryLocationResponse struct {
	ID        uuid.UUID `json:"id"`
	StoreID   uuid.UUID `json:"store_id"`
	Name      string    `json:"name"`
	IsDefault bool      `json:"is_default"`
	CreatedAt string    `json:"created_at"`
	UpdatedAt string    `json:"updated_at"`
}

type CreateInventoryLocationRequest struct {
	Name      string `json:"name"`
	IsDefault bool   `json:"is_default"`
}

func (req *CreateInventoryLocationRequest) Validate() error {
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 1 || len(req.Name) > 100 {
		return &ValidationError{Field: "name", Msg: "name must be between 1 and 100 characters"}
	}
	return nil
}

type InventoryBalanceResponse struct {
	StoreID      uuid.UUID `json:"store_id"`
	ProductID    uuid.UUID `json:"product_id"`
	ProductName  string    `json:"product_name"`
	SKU          string    `json:"sku"`
	LocationID   uuid.UUID `json:"location_id"`
	LocationName string    `json:"location_name"`
	Quantity     float64   `json:"quantity"`
	UpdatedAt    string    `json:"updated_at"`
}

type StockMovementResponse struct {
	ID            uuid.UUID  `json:"id"`
	StoreID       uuid.UUID  `json:"store_id"`
	ProductID     uuid.UUID  `json:"product_id"`
	LocationID    uuid.UUID  `json:"location_id"`
	QuantityDelta float64    `json:"quantity_delta"`
	Reason        string     `json:"reason"`
	ReferenceID   *uuid.UUID `json:"reference_id,omitempty"`
	ActorUserID   *uuid.UUID `json:"actor_user_id,omitempty"`
	CreatedAt     string     `json:"created_at"`
}

type RecordStockMovementRequest struct {
	ProductID     uuid.UUID  `json:"product_id"`
	LocationID    uuid.UUID  `json:"location_id"`
	QuantityDelta float64    `json:"quantity_delta"`
	Reason        string     `json:"reason"`
	ReferenceID   *uuid.UUID `json:"reference_id,omitempty"`
}

func (req *RecordStockMovementRequest) Validate() error {
	if req.ProductID == uuid.Nil {
		return &ValidationError{Field: "product_id", Msg: "valid product_id is required"}
	}
	if req.LocationID == uuid.Nil {
		return &ValidationError{Field: "location_id", Msg: "valid location_id is required"}
	}
	if req.QuantityDelta == 0 {
		return &ValidationError{Field: "quantity_delta", Msg: "quantity_delta cannot be zero"}
	}
	req.Reason = strings.ToLower(strings.TrimSpace(req.Reason))
	validReasons := map[string]bool{
		"initial_stock":        true,
		"purchase_received":    true,
		"sale_issued":          true,
		"sale_returned":        true,
		"inventory_adjustment": true,
		"damaged":              true,
		"transfer":             true,
	}
	if !validReasons[req.Reason] {
		return &ValidationError{Field: "reason", Msg: "reason must be one of: initial_stock, purchase_received, sale_issued, sale_returned, inventory_adjustment, damaged, transfer"}
	}
	return nil
}

// Domain D: Store Customers DTOs

type StoreCustomerResponse struct {
	ID             uuid.UUID  `json:"id"`
	StoreID        uuid.UUID  `json:"store_id"`
	CustomerNumber string     `json:"customer_number"`
	DisplayName    string     `json:"display_name"`
	Phone          string     `json:"phone,omitempty"`
	Email          string     `json:"email,omitempty"`
	Address        string     `json:"address,omitempty"`
	ConsumerID     *uuid.UUID `json:"consumer_id,omitempty"`
	CreatedAt      string     `json:"created_at"`
	UpdatedAt      string     `json:"updated_at"`
}

type CreateStoreCustomerRequest struct {
	CustomerNumber string     `json:"customer_number,omitempty"`
	DisplayName    string     `json:"display_name"`
	Phone          string     `json:"phone,omitempty"`
	Email          string     `json:"email,omitempty"`
	Address        string     `json:"address,omitempty"`
	ConsumerID     *uuid.UUID `json:"consumer_id,omitempty"`
}

func (req *CreateStoreCustomerRequest) Validate() error {
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	if len(req.DisplayName) < 1 || len(req.DisplayName) > 150 {
		return &ValidationError{Field: "display_name", Msg: "display_name must be between 1 and 150 characters"}
	}
	req.Phone = strings.TrimSpace(req.Phone)
	req.Email = strings.TrimSpace(req.Email)
	return nil
}

type UpdateStoreCustomerRequest struct {
	DisplayName string     `json:"display_name,omitempty"`
	Phone       string     `json:"phone,omitempty"`
	Email       string     `json:"email,omitempty"`
	Address     string     `json:"address,omitempty"`
	ConsumerID  *uuid.UUID `json:"consumer_id,omitempty"`
}

func (req *UpdateStoreCustomerRequest) Validate() error {
	if req.DisplayName != "" {
		req.DisplayName = strings.TrimSpace(req.DisplayName)
		if len(req.DisplayName) < 1 || len(req.DisplayName) > 150 {
			return &ValidationError{Field: "display_name", Msg: "display_name must be between 1 and 150 characters"}
		}
	}
	return nil
}

