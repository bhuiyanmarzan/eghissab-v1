package system

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ValidationError represents a field-level validation failure returning HTTP 422.
type ValidationError struct {
	Field string `json:"field"`
	Msg   string `json:"message"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Msg)
}

// Audit Event DTOs
type AuditEventResponse struct {
	ID             uuid.UUID      `json:"id"`
	ActorUserID    *uuid.UUID     `json:"actor_user_id,omitempty"`
	ActorName      string         `json:"actor_name,omitempty"`
	OrganizationID *uuid.UUID     `json:"organization_id,omitempty"`
	StoreID        *uuid.UUID     `json:"store_id,omitempty"`
	Action         string         `json:"action"`
	Details        map[string]any `json:"details"`
	CreatedAt      string         `json:"created_at"`
}

type ListAuditEventsFilter struct {
	OrganizationID *uuid.UUID
	StoreID        *uuid.UUID
	ActorUserID    *uuid.UUID
	Action         string
	StartDate      string
	EndDate        string
	Limit          int
	Offset         int
}

type RecordAuditRequest struct {
	Action  string         `json:"action"`
	Details map[string]any `json:"details,omitempty"`
	StoreID *uuid.UUID     `json:"store_id,omitempty"`
}

func (req *RecordAuditRequest) Validate() error {
	req.Action = strings.TrimSpace(req.Action)
	if len(req.Action) < 3 || len(req.Action) > 100 {
		return &ValidationError{Field: "action", Msg: "action must be between 3 and 100 characters"}
	}
	if req.Details != nil {
		data, err := json.Marshal(req.Details)
		if err != nil || len(data) > 65536 {
			return &ValidationError{Field: "details", Msg: "details payload must be valid JSON under 64 KiB"}
		}
	}
	return nil
}

// Outbox Event DTOs
type OutboxEventResponse struct {
	ID            uuid.UUID      `json:"id"`
	AggregateType string         `json:"aggregate_type"`
	AggregateID   uuid.UUID      `json:"aggregate_id"`
	EventType     string         `json:"event_type"`
	Payload       map[string]any `json:"payload"`
	CreatedAt     string         `json:"created_at"`
}

type EventDeliveryResponse struct {
	ID           uuid.UUID `json:"id"`
	EventID      uuid.UUID `json:"event_id"`
	ConsumerName string    `json:"consumer_name"`
	Status       string    `json:"status"`
	DeliveredAt  *string   `json:"delivered_at,omitempty"`
	LastError    *string   `json:"last_error,omitempty"`
	AttemptCount int       `json:"attempt_count"`
	CreatedAt    string    `json:"created_at"`
	UpdatedAt    string    `json:"updated_at"`
}

// Background Job DTOs
type JobResponse struct {
	ID           uuid.UUID      `json:"id"`
	EventID      *uuid.UUID     `json:"event_id,omitempty"`
	Type         string         `json:"type"`
	Status       string         `json:"status"`
	Payload      map[string]any `json:"payload"`
	RunAt        string         `json:"run_at"`
	MaxAttempts  int            `json:"max_attempts"`
	AttemptCount int            `json:"attempt_count"`
	LockedAt     *string        `json:"locked_at,omitempty"`
	LockedBy     *string        `json:"locked_by,omitempty"`
	CreatedAt    string         `json:"created_at"`
	UpdatedAt    string         `json:"updated_at"`
}

type CreateJobRequest struct {
	Type        string         `json:"type"`
	Payload     map[string]any `json:"payload,omitempty"`
	RunAt       *string        `json:"run_at,omitempty"`
	MaxAttempts int            `json:"max_attempts,omitempty"`
}

func (req *CreateJobRequest) Validate() error {
	req.Type = strings.TrimSpace(req.Type)
	if len(req.Type) < 2 || len(req.Type) > 100 {
		return &ValidationError{Field: "type", Msg: "job type must be between 2 and 100 characters"}
	}
	if req.MaxAttempts <= 0 {
		req.MaxAttempts = 3
	}
	if req.MaxAttempts > 10 {
		return &ValidationError{Field: "max_attempts", Msg: "max_attempts cannot exceed 10"}
	}
	if req.RunAt != nil && *req.RunAt != "" {
		if _, err := time.Parse(time.RFC3339, *req.RunAt); err != nil {
			if _, err := time.Parse("2006-01-02", *req.RunAt); err != nil {
				return &ValidationError{Field: "run_at", Msg: "run_at must be formatted in RFC3339 or YYYY-MM-DD"}
			}
		}
	}
	return nil
}

type JobAttemptResponse struct {
	ID            uuid.UUID `json:"id"`
	JobID         uuid.UUID `json:"job_id"`
	AttemptNumber int       `json:"attempt_number"`
	Outcome       string    `json:"outcome"`
	ErrorMessage  *string   `json:"error_message,omitempty"`
	DurationMs    int       `json:"duration_ms"`
	StartedAt     string    `json:"started_at"`
	FinishedAt    string    `json:"finished_at"`
}

// File Asset DTOs
type FileAssetResponse struct {
	ID             uuid.UUID  `json:"id"`
	InvoiceID      *uuid.UUID `json:"invoice_id,omitempty"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
	StoreID        *uuid.UUID `json:"store_id,omitempty"`
	StorageKey     string     `json:"storage_key"`
	Visibility     string     `json:"visibility"`
	FileName       string     `json:"file_name"`
	MimeType       string     `json:"mime_type"`
	FileSize       int64      `json:"file_size"`
	ChecksumSHA256 string     `json:"checksum_sha256,omitempty"`
	UploadedBy     *uuid.UUID `json:"uploaded_by,omitempty"`
	CreatedAt      string     `json:"created_at"`
	UpdatedAt      string     `json:"updated_at"`
}

type RegisterFileAssetRequest struct {
	InvoiceID      *uuid.UUID `json:"invoice_id,omitempty"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
	StoreID        *uuid.UUID `json:"store_id,omitempty"`
	StorageKey     string     `json:"storage_key"`
	Visibility     string     `json:"visibility,omitempty"`
	FileName       string     `json:"file_name"`
	MimeType       string     `json:"mime_type"`
	FileSize       int64      `json:"file_size"`
	ChecksumSHA256 string     `json:"checksum_sha256,omitempty"`
}

func (req *RegisterFileAssetRequest) Validate() error {
	req.StorageKey = strings.TrimSpace(req.StorageKey)
	if len(req.StorageKey) < 3 || len(req.StorageKey) > 500 {
		return &ValidationError{Field: "storage_key", Msg: "storage_key must be between 3 and 500 characters"}
	}
	req.FileName = strings.TrimSpace(req.FileName)
	if len(req.FileName) < 1 || len(req.FileName) > 255 {
		return &ValidationError{Field: "file_name", Msg: "file_name must be between 1 and 255 characters"}
	}
	req.MimeType = strings.TrimSpace(req.MimeType)
	if len(req.MimeType) < 3 || len(req.MimeType) > 100 {
		return &ValidationError{Field: "mime_type", Msg: "mime_type must be between 3 and 100 characters"}
	}
	if req.FileSize < 0 {
		return &ValidationError{Field: "file_size", Msg: "file_size cannot be negative"}
	}
	if req.Visibility == "" {
		req.Visibility = "private"
	}
	if req.Visibility != "private" && req.Visibility != "public" && req.Visibility != "tenant" {
		return &ValidationError{Field: "visibility", Msg: "visibility must be one of: private, public, tenant"}
	}
	return nil
}

// Notification Delivery DTOs
type NotificationDeliveryResponse struct {
	ID                uuid.UUID  `json:"id"`
	JobID             *uuid.UUID `json:"job_id,omitempty"`
	Recipient         string     `json:"recipient"`
	Channel           string     `json:"channel"`
	Template          string     `json:"template"`
	Provider          string     `json:"provider"`
	ProviderMessageID *string    `json:"provider_message_id,omitempty"`
	Status            string     `json:"status"`
	Attempts          int        `json:"attempts"`
	LastError         *string    `json:"last_error,omitempty"`
	CreatedAt         string     `json:"created_at"`
	DeliveredAt       *string    `json:"delivered_at,omitempty"`
}

// Webhook Receipt DTOs
type WebhookReceiptResponse struct {
	ID              uuid.UUID      `json:"id"`
	Provider        string         `json:"provider"`
	ProviderEventID string         `json:"provider_event_id"`
	EventType       string         `json:"event_type"`
	Payload         map[string]any `json:"payload,omitempty"`
	Status          string         `json:"status"`
	ProcessedAt     *string        `json:"processed_at,omitempty"`
	LastError       *string        `json:"last_error,omitempty"`
	CreatedAt       string         `json:"created_at"`
}

type IngestWebhookRequest struct {
	ProviderEventID string         `json:"provider_event_id"`
	EventType       string         `json:"event_type"`
	Payload         map[string]any `json:"payload,omitempty"`
}

func (req *IngestWebhookRequest) Validate() error {
	req.ProviderEventID = strings.TrimSpace(req.ProviderEventID)
	if len(req.ProviderEventID) < 1 || len(req.ProviderEventID) > 255 {
		return &ValidationError{Field: "provider_event_id", Msg: "provider_event_id is required (1-255 characters)"}
	}
	req.EventType = strings.TrimSpace(req.EventType)
	if len(req.EventType) < 1 || len(req.EventType) > 100 {
		return &ValidationError{Field: "event_type", Msg: "event_type is required (1-100 characters)"}
	}
	return nil
}
