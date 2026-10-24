package invoice

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

type ValidationError struct {
	Field string `json:"field"`
	Msg   string `json:"message"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Msg)
}

// Line Item DTOs
type InvoiceItemInput struct {
	ProductID           *uuid.UUID `json:"product_id,omitempty"`
	DescriptionSnapshot string     `json:"description_snapshot"`
	SKUSnapshot         string     `json:"sku_snapshot,omitempty"`
	Quantity            float64    `json:"quantity"`
	UnitPrice           float64    `json:"unit_price"`
	DiscountAmount      float64    `json:"discount_amount,omitempty"`
	TaxRate             float64    `json:"tax_rate,omitempty"`
	TaxAmount           float64    `json:"tax_amount,omitempty"`
	LineTotal           float64    `json:"line_total,omitempty"`
}

func (item *InvoiceItemInput) Validate(index int) error {
	item.DescriptionSnapshot = strings.TrimSpace(item.DescriptionSnapshot)
	if len(item.DescriptionSnapshot) < 1 || len(item.DescriptionSnapshot) > 255 {
		return &ValidationError{Field: fmt.Sprintf("items[%d].description_snapshot", index), Msg: "description is required (1-255 characters)"}
	}
	if item.Quantity <= 0 {
		return &ValidationError{Field: fmt.Sprintf("items[%d].quantity", index), Msg: "quantity must be greater than 0"}
	}
	if item.UnitPrice < 0 {
		return &ValidationError{Field: fmt.Sprintf("items[%d].unit_price", index), Msg: "unit_price cannot be negative"}
	}
	if item.DiscountAmount < 0 {
		return &ValidationError{Field: fmt.Sprintf("items[%d].discount_amount", index), Msg: "discount_amount cannot be negative"}
	}
	if item.TaxRate < 0 || item.TaxRate > 100 {
		return &ValidationError{Field: fmt.Sprintf("items[%d].tax_rate", index), Msg: "tax_rate must be between 0 and 100"}
	}
	return nil
}

type InvoiceItemResponse struct {
	ID                  uuid.UUID  `json:"id"`
	StoreID             uuid.UUID  `json:"store_id"`
	InvoiceID           uuid.UUID  `json:"invoice_id"`
	ProductID           *uuid.UUID `json:"product_id,omitempty"`
	DescriptionSnapshot string     `json:"description_snapshot"`
	SKUSnapshot         string     `json:"sku_snapshot,omitempty"`
	Quantity            float64    `json:"quantity"`
	UnitPrice           float64    `json:"unit_price"`
	DiscountAmount      float64    `json:"discount_amount"`
	TaxRate             float64    `json:"tax_rate"`
	TaxAmount           float64    `json:"tax_amount"`
	LineTotal           float64    `json:"line_total"`
	CreatedAt           string     `json:"created_at"`
}

// Invoice DTOs
type CreateInvoiceRequest struct {
	StoreCustomerID *uuid.UUID         `json:"store_customer_id,omitempty"`
	Currency        string             `json:"currency,omitempty"`
	InvoiceDate     string             `json:"invoice_date,omitempty"`
	DueDate         *string            `json:"due_date,omitempty"`
	Notes           string             `json:"notes,omitempty"`
	Items           []InvoiceItemInput `json:"items"`
}

func (req *CreateInvoiceRequest) Validate() error {
	if len(req.Items) == 0 {
		return &ValidationError{Field: "items", Msg: "at least one invoice item is required"}
	}
	for i := range req.Items {
		if err := req.Items[i].Validate(i); err != nil {
			return err
		}
	}
	if req.Currency != "" {
		req.Currency = strings.ToUpper(strings.TrimSpace(req.Currency))
		if !currencyRegex.MatchString(req.Currency) {
			return &ValidationError{Field: "currency", Msg: "currency must be a valid 3-letter ISO code"}
		}
	}
	if req.InvoiceDate != "" {
		if _, err := time.Parse("2006-01-02", req.InvoiceDate); err != nil {
			return &ValidationError{Field: "invoice_date", Msg: "invoice_date must be formatted as YYYY-MM-DD"}
		}
	}
	if req.DueDate != nil && *req.DueDate != "" {
		if _, err := time.Parse("2006-01-02", *req.DueDate); err != nil {
			return &ValidationError{Field: "due_date", Msg: "due_date must be formatted as YYYY-MM-DD"}
		}
	}
	return nil
}

type UpdateInvoiceRequest struct {
	StoreCustomerID *uuid.UUID         `json:"store_customer_id,omitempty"`
	InvoiceDate     string             `json:"invoice_date,omitempty"`
	DueDate         *string            `json:"due_date,omitempty"`
	Notes           string             `json:"notes,omitempty"`
	Items           []InvoiceItemInput `json:"items,omitempty"`
}

func (req *UpdateInvoiceRequest) Validate() error {
	if req.Items != nil {
		if len(req.Items) == 0 {
			return &ValidationError{Field: "items", Msg: "if provided, items cannot be empty"}
		}
		for i := range req.Items {
			if err := req.Items[i].Validate(i); err != nil {
				return err
			}
		}
	}
	if req.InvoiceDate != "" {
		if _, err := time.Parse("2006-01-02", req.InvoiceDate); err != nil {
			return &ValidationError{Field: "invoice_date", Msg: "invoice_date must be formatted as YYYY-MM-DD"}
		}
	}
	if req.DueDate != nil && *req.DueDate != "" {
		if _, err := time.Parse("2006-01-02", *req.DueDate); err != nil {
			return &ValidationError{Field: "due_date", Msg: "due_date must be formatted as YYYY-MM-DD"}
		}
	}
	return nil
}

type InvoiceResponse struct {
	ID              uuid.UUID             `json:"id"`
	StoreID         uuid.UUID             `json:"store_id"`
	StoreCustomerID *uuid.UUID            `json:"store_customer_id,omitempty"`
	CustomerName    string                `json:"customer_name,omitempty"`
	InvoiceNumber   string                `json:"invoice_number"`
	LifecycleStatus string                `json:"lifecycle_status"`
	Subtotal        float64               `json:"subtotal"`
	DiscountAmount  float64               `json:"discount_amount"`
	TaxAmount       float64               `json:"tax_amount"`
	TotalAmount     float64               `json:"total_amount"`
	PaidAmount      float64               `json:"paid_amount"`
	Currency        string                `json:"currency"`
	Notes           string                `json:"notes,omitempty"`
	InvoiceDate     string                `json:"invoice_date"`
	DueDate         *string               `json:"due_date,omitempty"`
	IssuedAt        *string               `json:"issued_at,omitempty"`
	CreatedBy       *uuid.UUID            `json:"created_by,omitempty"`
	CreatedAt       string                `json:"created_at"`
	UpdatedAt       string                `json:"updated_at"`
	Items           []InvoiceItemResponse `json:"items,omitempty"`
}

// Payment DTOs
type RecordPaymentRequest struct {
	Amount            float64 `json:"amount"`
	Currency          string  `json:"currency,omitempty"`
	Method            string  `json:"method"`
	ExternalReference string  `json:"external_reference,omitempty"`
}

func (req *RecordPaymentRequest) Validate() error {
	if req.Amount <= 0 {
		return &ValidationError{Field: "amount", Msg: "amount must be greater than 0"}
	}
	if req.Currency != "" {
		req.Currency = strings.ToUpper(strings.TrimSpace(req.Currency))
		if !currencyRegex.MatchString(req.Currency) {
			return &ValidationError{Field: "currency", Msg: "currency must be a valid 3-letter ISO code"}
		}
	}
	req.Method = strings.ToLower(strings.TrimSpace(req.Method))
	validMethods := map[string]bool{
		"cash":           true,
		"card":           true,
		"mobile_banking": true,
		"bank_transfer":  true,
		"credit_balance": true,
		"other":          true,
	}
	if !validMethods[req.Method] {
		return &ValidationError{Field: "method", Msg: "method must be one of: cash, card, mobile_banking, bank_transfer, credit_balance, other"}
	}
	return nil
}

type PaymentResponse struct {
	ID                uuid.UUID  `json:"id"`
	InvoiceID         uuid.UUID  `json:"invoice_id"`
	Amount            float64    `json:"amount"`
	Currency          string     `json:"currency"`
	Method            string     `json:"method"`
	Status            string     `json:"status"`
	ExternalReference string     `json:"external_reference,omitempty"`
	ReceivedBy        *uuid.UUID `json:"received_by,omitempty"`
	PaidAt            string     `json:"paid_at"`
	CreatedAt         string     `json:"created_at"`
}

// Adjustment DTOs (Credit/Debit Notes)
type CreateAdjustmentRequest struct {
	Type      string  `json:"type"`
	Amount    float64 `json:"amount"`
	TaxImpact float64 `json:"tax_impact,omitempty"`
	Reason    string  `json:"reason"`
}

func (req *CreateAdjustmentRequest) Validate() error {
	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	validTypes := map[string]bool{
		"credit_note":       true,
		"debit_note":        true,
		"tax_correction":    true,
		"discount_reversal": true,
		"write_off":         true,
	}
	if !validTypes[req.Type] {
		return &ValidationError{Field: "type", Msg: "type must be one of: credit_note, debit_note, tax_correction, discount_reversal, write_off"}
	}
	if req.Amount <= 0 {
		return &ValidationError{Field: "amount", Msg: "amount must be greater than 0"}
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if len(req.Reason) < 3 || len(req.Reason) > 500 {
		return &ValidationError{Field: "reason", Msg: "reason must be between 3 and 500 characters"}
	}
	return nil
}

type AdjustmentResponse struct {
	ID               uuid.UUID `json:"id"`
	InvoiceID        uuid.UUID `json:"invoice_id"`
	AdjustmentNumber string    `json:"adjustment_number"`
	Type             string    `json:"type"`
	Amount           float64   `json:"amount"`
	TaxImpact        float64   `json:"tax_impact"`
	Reason           string    `json:"reason"`
	CreatedBy        uuid.UUID `json:"created_by"`
	CreatedAt        string    `json:"created_at"`
}

// Consumer Decision DTOs
type InvoiceDecisionRequest struct {
	Decision string `json:"decision"`
	Notes    string `json:"notes,omitempty"`
}

func (req *InvoiceDecisionRequest) Validate() error {
	req.Decision = strings.ToLower(strings.TrimSpace(req.Decision))
	validDecisions := map[string]bool{
		"pending":  true,
		"approved": true,
		"disputed": true,
		"rejected": true,
	}
	if !validDecisions[req.Decision] {
		return &ValidationError{Field: "decision", Msg: "decision must be one of: pending, approved, disputed, rejected"}
	}
	return nil
}

type DecisionResponse struct {
	ID         uuid.UUID `json:"id"`
	InvoiceID  uuid.UUID `json:"invoice_id"`
	ConsumerID uuid.UUID `json:"consumer_id"`
	Decision   string    `json:"decision"`
	Notes      string    `json:"notes,omitempty"`
	DecidedAt  *string   `json:"decided_at,omitempty"`
	CreatedAt  string    `json:"created_at"`
}

// Invoice Events Audit Trail
type InvoiceEventResponse struct {
	ID          uuid.UUID       `json:"id"`
	InvoiceID   uuid.UUID       `json:"invoice_id"`
	ActorUserID *uuid.UUID      `json:"actor_user_id,omitempty"`
	EventType   string          `json:"event_type"`
	Metadata    json.RawMessage `json:"metadata"`
	CreatedAt   string          `json:"created_at"`
}
