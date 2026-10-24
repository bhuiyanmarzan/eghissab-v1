package consumer

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	currencyRegex = regexp.MustCompile(`^[A-Z]{3}$`)
)

// ValidationError represents a field-level validation failure returning HTTP 422.
type ValidationError struct {
	Field string `json:"field"`
	Msg   string `json:"message"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Msg)
}

// ConsumerProfileResponse represents the user's consumer profile.
type ConsumerProfileResponse struct {
	ID          uuid.UUID      `json:"id"`
	UserID      uuid.UUID      `json:"user_id"`
	Status      string         `json:"status"`
	Preferences map[string]any `json:"preferences"`
	CreatedAt   string         `json:"created_at"`
	UpdatedAt   string         `json:"updated_at"`
}

// CreateConsumerProfileRequest defines the payload to initialize a consumer profile.
type CreateConsumerProfileRequest struct {
	Preferences map[string]any `json:"preferences,omitempty"`
}

func (req CreateConsumerProfileRequest) Validate() error {
	if req.Preferences != nil {
		data, err := json.Marshal(req.Preferences)
		if err != nil || len(data) > 65536 {
			return &ValidationError{Field: "preferences", Msg: "preferences payload must be valid JSON under 64 KiB"}
		}
	}
	return nil
}

// UpdateConsumerPreferencesRequest defines the payload to update consumer preferences.
type UpdateConsumerPreferencesRequest struct {
	Preferences map[string]any `json:"preferences"`
}

func (req UpdateConsumerPreferencesRequest) Validate() error {
	if req.Preferences == nil {
		return &ValidationError{Field: "preferences", Msg: "preferences object is required"}
	}
	data, err := json.Marshal(req.Preferences)
	if err != nil || len(data) > 65536 {
		return &ValidationError{Field: "preferences", Msg: "preferences payload must be valid JSON under 64 KiB"}
	}
	return nil
}

// Domain E: Membership Requests DTOs
type MembershipRequestResponse struct {
	ID                uuid.UUID  `json:"id"`
	ConsumerID        uuid.UUID  `json:"consumer_id"`
	StoreID           uuid.UUID  `json:"store_id"`
	StoreName         string     `json:"store_name"`
	StoreCustomerID   *uuid.UUID `json:"store_customer_id,omitempty"`
	CustomerNumber    string     `json:"customer_number,omitempty"`
	Status            string     `json:"status"`
	Notes             string     `json:"notes,omitempty"`
	ReviewedBy        *uuid.UUID `json:"reviewed_by,omitempty"`
	ReviewedAt        *string    `json:"reviewed_at,omitempty"`
	CreatedAt         string     `json:"created_at"`
	UpdatedAt         string     `json:"updated_at"`
}

type CreateMembershipRequestRequest struct {
	StoreID       uuid.UUID `json:"store_id"`
	CustomerPhone string    `json:"customer_phone,omitempty"`
	Notes         string    `json:"notes,omitempty"`
}

func (req *CreateMembershipRequestRequest) Validate() error {
	if req.StoreID == uuid.Nil {
		return &ValidationError{Field: "store_id", Msg: "valid store_id is required"}
	}
	req.CustomerPhone = strings.TrimSpace(req.CustomerPhone)
	req.Notes = strings.TrimSpace(req.Notes)
	if len(req.Notes) > 500 {
		return &ValidationError{Field: "notes", Msg: "notes must be at most 500 characters"}
	}
	return nil
}

type ReviewMembershipRequestRequest struct {
	Status     string  `json:"status"`
	AccessFrom *string `json:"access_from,omitempty"`
	Notes      string  `json:"notes,omitempty"`
}

func (req *ReviewMembershipRequestRequest) Validate() error {
	req.Status = strings.ToLower(strings.TrimSpace(req.Status))
	if req.Status != "approved" && req.Status != "rejected" {
		return &ValidationError{Field: "status", Msg: "status must be approved or rejected"}
	}
	if req.AccessFrom != nil && *req.AccessFrom != "" {
		if _, err := time.Parse("2006-01-02", *req.AccessFrom); err != nil {
			if _, err := time.Parse(time.RFC3339, *req.AccessFrom); err != nil {
				return &ValidationError{Field: "access_from", Msg: "access_from must be YYYY-MM-DD or RFC3339 format"}
			}
		}
	}
	return nil
}

// Domain E: Customer Links DTOs
type CustomerLinkResponse struct {
	ID                  uuid.UUID `json:"id"`
	ConsumerID          uuid.UUID `json:"consumer_id"`
	StoreID             uuid.UUID `json:"store_id"`
	StoreName           string    `json:"store_name"`
	StoreCustomerID     uuid.UUID `json:"store_customer_id"`
	CustomerNumber      string    `json:"customer_number"`
	CustomerDisplayName string    `json:"customer_display_name"`
	Status              string    `json:"status"`
	VerifiedAt          string    `json:"verified_at"`
	AccessFrom          string    `json:"access_from"`
	CreatedAt           string    `json:"created_at"`
	UpdatedAt           string    `json:"updated_at"`
}

// Domain E: Expense Categories DTOs
type ExpenseCategoryResponse struct {
	ID         uuid.UUID  `json:"id"`
	ConsumerID uuid.UUID  `json:"consumer_id"`
	Name       string     `json:"name"`
	ParentID   *uuid.UUID `json:"parent_id,omitempty"`
	Color      string     `json:"color,omitempty"`
	Icon       string     `json:"icon,omitempty"`
	CreatedAt  string     `json:"created_at"`
	UpdatedAt  string     `json:"updated_at"`
}

type CreateExpenseCategoryRequest struct {
	Name     string     `json:"name"`
	ParentID *uuid.UUID `json:"parent_id,omitempty"`
	Color    string     `json:"color,omitempty"`
	Icon     string     `json:"icon,omitempty"`
}

func (req *CreateExpenseCategoryRequest) Validate() error {
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 1 || len(req.Name) > 100 {
		return &ValidationError{Field: "name", Msg: "name must be between 1 and 100 characters"}
	}
	return nil
}

type UpdateExpenseCategoryRequest struct {
	Name     string     `json:"name,omitempty"`
	ParentID *uuid.UUID `json:"parent_id,omitempty"`
	Color    string     `json:"color,omitempty"`
	Icon     string     `json:"icon,omitempty"`
}

func (req *UpdateExpenseCategoryRequest) Validate() error {
	if req.Name != "" {
		req.Name = strings.TrimSpace(req.Name)
		if len(req.Name) < 1 || len(req.Name) > 100 {
			return &ValidationError{Field: "name", Msg: "name must be between 1 and 100 characters"}
		}
	}
	return nil
}

// Domain E: Expense Entries DTOs
type ExpenseEntryResponse struct {
	ID             uuid.UUID  `json:"id"`
	ConsumerID     uuid.UUID  `json:"consumer_id"`
	InvoiceID      *uuid.UUID `json:"invoice_id,omitempty"`
	InvoiceNumber  string     `json:"invoice_number,omitempty"`
	StoreID        *uuid.UUID `json:"store_id,omitempty"`
	StoreName      string     `json:"store_name,omitempty"`
	CategoryID     *uuid.UUID `json:"category_id,omitempty"`
	CategoryName   string     `json:"category_name,omitempty"`
	Amount         float64    `json:"amount"`
	Currency       string     `json:"currency"`
	SourceType     string     `json:"source_type"`
	EntryDate      string     `json:"entry_date"`
	Description    string     `json:"description"`
	AdjustedAmount float64    `json:"adjusted_amount"`
	CreatedAt      string     `json:"created_at"`
	UpdatedAt      string     `json:"updated_at"`
}

type CreateExpenseEntryRequest struct {
	InvoiceID   *uuid.UUID `json:"invoice_id,omitempty"`
	StoreID     *uuid.UUID `json:"store_id,omitempty"`
	CategoryID  *uuid.UUID `json:"category_id,omitempty"`
	Amount      float64    `json:"amount"`
	Currency    string     `json:"currency,omitempty"`
	SourceType  string     `json:"source_type,omitempty"`
	EntryDate   string     `json:"entry_date,omitempty"`
	Description string     `json:"description"`
}

func (req *CreateExpenseEntryRequest) Validate() error {
	if req.Amount <= 0 {
		return &ValidationError{Field: "amount", Msg: "amount must be greater than 0"}
	}
	if req.Currency != "" {
		req.Currency = strings.ToUpper(strings.TrimSpace(req.Currency))
		if !currencyRegex.MatchString(req.Currency) {
			return &ValidationError{Field: "currency", Msg: "currency must be a valid 3-letter ISO code"}
		}
	}
	req.Description = strings.TrimSpace(req.Description)
	if len(req.Description) < 1 || len(req.Description) > 500 {
		return &ValidationError{Field: "description", Msg: "description must be between 1 and 500 characters"}
	}
	if req.SourceType != "" {
		req.SourceType = strings.ToLower(strings.TrimSpace(req.SourceType))
		validSources := map[string]bool{
			"invoice":   true,
			"manual":    true,
			"bank_feed": true,
			"import":    true,
		}
		if !validSources[req.SourceType] {
			return &ValidationError{Field: "source_type", Msg: "source_type must be one of: invoice, manual, bank_feed, import"}
		}
	}
	if req.EntryDate != "" {
		if _, err := time.Parse("2006-01-02", req.EntryDate); err != nil {
			return &ValidationError{Field: "entry_date", Msg: "entry_date must be formatted as YYYY-MM-DD"}
		}
	}
	return nil
}

type UpdateExpenseEntryRequest struct {
	CategoryID  *uuid.UUID `json:"category_id,omitempty"`
	Amount      *float64   `json:"amount,omitempty"`
	EntryDate   string     `json:"entry_date,omitempty"`
	Description string     `json:"description,omitempty"`
}

func (req *UpdateExpenseEntryRequest) Validate() error {
	if req.Amount != nil && *req.Amount <= 0 {
		return &ValidationError{Field: "amount", Msg: "amount must be greater than 0"}
	}
	if req.Description != "" {
		req.Description = strings.TrimSpace(req.Description)
		if len(req.Description) < 1 || len(req.Description) > 500 {
			return &ValidationError{Field: "description", Msg: "description must be between 1 and 500 characters"}
		}
	}
	if req.EntryDate != "" {
		if _, err := time.Parse("2006-01-02", req.EntryDate); err != nil {
			return &ValidationError{Field: "entry_date", Msg: "entry_date must be formatted as YYYY-MM-DD"}
		}
	}
	return nil
}

type ClaimInvoiceExpenseRequest struct {
	CategoryID *uuid.UUID `json:"category_id,omitempty"`
	Notes      string     `json:"notes,omitempty"`
}

func (req *ClaimInvoiceExpenseRequest) Validate() error {
	req.Notes = strings.TrimSpace(req.Notes)
	if len(req.Notes) > 500 {
		return &ValidationError{Field: "notes", Msg: "notes must be at most 500 characters"}
	}
	return nil
}

// Domain E: Expense Adjustments DTOs
type ExpenseAdjustmentResponse struct {
	ID             uuid.UUID  `json:"id"`
	ExpenseEntryID uuid.UUID  `json:"expense_entry_id"`
	AmountDelta    float64    `json:"amount_delta"`
	Reason         string     `json:"reason"`
	CreatedBy      *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt      string     `json:"created_at"`
}

type CreateExpenseAdjustmentRequest struct {
	AmountDelta float64 `json:"amount_delta"`
	Reason      string  `json:"reason"`
}

func (req *CreateExpenseAdjustmentRequest) Validate() error {
	if req.AmountDelta == 0 {
		return &ValidationError{Field: "amount_delta", Msg: "amount_delta cannot be zero"}
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if len(req.Reason) < 3 || len(req.Reason) > 500 {
		return &ValidationError{Field: "reason", Msg: "reason must be between 3 and 500 characters"}
	}
	return nil
}

// Domain E: Cross-Store Consumer Invoices DTOs
type ConsumerInvoiceItemResponse struct {
	ID                  uuid.UUID `json:"id"`
	DescriptionSnapshot string    `json:"description_snapshot"`
	SKUSnapshot         string    `json:"sku_snapshot,omitempty"`
	Quantity            float64   `json:"quantity"`
	UnitPrice           float64   `json:"unit_price"`
	DiscountAmount      float64   `json:"discount_amount"`
	TaxAmount           float64   `json:"tax_amount"`
	LineTotal           float64   `json:"line_total"`
}

type ConsumerInvoiceResponse struct {
	ID                 uuid.UUID                     `json:"id"`
	StoreID            uuid.UUID                     `json:"store_id"`
	StoreName          string                        `json:"store_name"`
	StoreCustomerID    uuid.UUID                     `json:"store_customer_id"`
	InvoiceNumber      string                        `json:"invoice_number"`
	LifecycleStatus    string                        `json:"lifecycle_status"`
	Subtotal           float64                       `json:"subtotal"`
	DiscountAmount     float64                       `json:"discount_amount"`
	TaxAmount          float64                       `json:"tax_amount"`
	TotalAmount        float64                       `json:"total_amount"`
	PaidAmount         float64                       `json:"paid_amount"`
	Currency           string                        `json:"currency"`
	Notes              string                        `json:"notes,omitempty"`
	InvoiceDate        string                        `json:"invoice_date"`
	DueDate            *string                       `json:"due_date,omitempty"`
	IssuedAt           *string                       `json:"issued_at,omitempty"`
	Decision           string                        `json:"decision,omitempty"`
	DecisionNotes      string                        `json:"decision_notes,omitempty"`
	IsClaimedAsExpense bool                          `json:"is_claimed_as_expense"`
	CreatedAt          string                        `json:"created_at"`
	Items              []ConsumerInvoiceItemResponse `json:"items,omitempty"`
}

type ConsumerInvoiceDecisionRequest struct {
	Decision string `json:"decision"`
	Notes    string `json:"notes,omitempty"`
}

func (req *ConsumerInvoiceDecisionRequest) Validate() error {
	req.Decision = strings.ToLower(strings.TrimSpace(req.Decision))
	validDecisions := map[string]bool{
		"approved": true,
		"disputed": true,
		"rejected": true,
	}
	if !validDecisions[req.Decision] {
		return &ValidationError{Field: "decision", Msg: "decision must be one of: approved, disputed, rejected"}
	}
	req.Notes = strings.TrimSpace(req.Notes)
	if len(req.Notes) > 500 {
		return &ValidationError{Field: "notes", Msg: "notes must be at most 500 characters"}
	}
	return nil
}
