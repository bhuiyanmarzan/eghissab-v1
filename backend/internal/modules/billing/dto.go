package billing

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type ValidationError struct {
	Field string `json:"field"`
	Msg   string `json:"message"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Msg)
}

type PlanResponse struct {
	ID              uuid.UUID      `json:"id"`
	Code            string         `json:"code"`
	Name            string         `json:"name"`
	Status          string         `json:"status"`
	Version         int            `json:"version"`
	PriceMinor      int64          `json:"price_minor"`
	Currency        string         `json:"currency"`
	BillingInterval string         `json:"billing_interval"`
	Limits          map[string]any `json:"limits"`
}

type SubscriptionResponse struct {
	ID             uuid.UUID      `json:"id"`
	OrganizationID uuid.UUID      `json:"organization_id"`
	PlanCode       string         `json:"plan_code"`
	PlanName       string         `json:"plan_name"`
	Status         string         `json:"status"`
	PeriodStart    string         `json:"period_start"`
	PeriodEnd      string         `json:"period_end"`
	CanceledAt     *string        `json:"canceled_at,omitempty"`
	Limits         map[string]any `json:"limits"`
}

type InvoiceResponse struct {
	ID                uuid.UUID `json:"id"`
	SubscriptionID    uuid.UUID `json:"subscription_id"`
	AmountMinor       int64     `json:"amount_minor"`
	Currency          string    `json:"currency"`
	Status            string    `json:"status"`
	ProviderReference string    `json:"provider_reference,omitempty"`
	PeriodStart       string    `json:"period_start"`
	PeriodEnd         string    `json:"period_end"`
	DueAt             string    `json:"due_at"`
	PaidAt            *string   `json:"paid_at,omitempty"`
	CreatedAt         string    `json:"created_at"`
}

type SubscribeRequest struct {
	OrganizationID  uuid.UUID `json:"organization_id"`
	PlanCode        string    `json:"plan_code"`
	BillingInterval string    `json:"billing_interval,omitempty"`
}

func (req *SubscribeRequest) Validate() error {
	if req.OrganizationID == uuid.Nil {
		return &ValidationError{Field: "organization_id", Msg: "valid organization_id is required"}
	}
	req.PlanCode = strings.ToLower(strings.TrimSpace(req.PlanCode))
	if req.PlanCode == "" {
		return &ValidationError{Field: "plan_code", Msg: "plan_code is required"}
	}
	if req.BillingInterval != "" {
		req.BillingInterval = strings.ToLower(strings.TrimSpace(req.BillingInterval))
		if req.BillingInterval != "month" && req.BillingInterval != "year" && req.BillingInterval != "free" {
			return &ValidationError{Field: "billing_interval", Msg: "billing_interval must be month, year, or free"}
		}
	}
	return nil
}

type CancelSubscriptionRequest struct {
	OrganizationID uuid.UUID `json:"organization_id"`
	Reason         string    `json:"reason,omitempty"`
}

func (req *CancelSubscriptionRequest) Validate() error {
	if req.OrganizationID == uuid.Nil {
		return &ValidationError{Field: "organization_id", Msg: "valid organization_id is required"}
	}
	return nil
}

type RecordUsageRequest struct {
	OrganizationID uuid.UUID  `json:"organization_id"`
	StoreID        *uuid.UUID `json:"store_id,omitempty"`
	Metric         string     `json:"metric"`
	Quantity       int64      `json:"quantity"`
	SourceKey      string     `json:"source_key"`
}

func (req *RecordUsageRequest) Validate() error {
	if req.OrganizationID == uuid.Nil {
		return &ValidationError{Field: "organization_id", Msg: "valid organization_id is required"}
	}
	req.Metric = strings.TrimSpace(req.Metric)
	if req.Metric == "" || len(req.Metric) > 64 {
		return &ValidationError{Field: "metric", Msg: "metric must be 1-64 characters"}
	}
	if req.Quantity <= 0 {
		return &ValidationError{Field: "quantity", Msg: "quantity must be greater than 0"}
	}
	req.SourceKey = strings.TrimSpace(req.SourceKey)
	if req.SourceKey == "" || len(req.SourceKey) > 128 {
		return &ValidationError{Field: "source_key", Msg: "source_key must be 1-128 characters"}
	}
	return nil
}

type WebhookPayload struct {
	EventID   string          `json:"event_id"`
	EventType string          `json:"event_type"`
	Payload   json.RawMessage `json:"payload"`
}

func (req *WebhookPayload) Validate() error {
	req.EventID = strings.TrimSpace(req.EventID)
	if req.EventID == "" {
		return &ValidationError{Field: "event_id", Msg: "event_id is required"}
	}
	req.EventType = strings.TrimSpace(req.EventType)
	if req.EventType == "" {
		return &ValidationError{Field: "event_type", Msg: "event_type is required"}
	}
	if len(req.Payload) == 0 {
		return &ValidationError{Field: "payload", Msg: "payload is required"}
	}
	return nil
}
