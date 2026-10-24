package system

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/authz"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
)

var sensitiveKeyRegex = regexp.MustCompile(`(?i)(password|token|secret|hash|authorization|cookie|key|cvv|pin|credential)`)

// SanitizeDetails recursively inspects details and redacts any key matching sensitive credential terms.
func SanitizeDetails(details map[string]any) map[string]any {
	if details == nil {
		return make(map[string]any)
	}
	sanitized := make(map[string]any, len(details))
	for k, v := range details {
		if sensitiveKeyRegex.MatchString(k) {
			sanitized[k] = "[REDACTED]"
			continue
		}
		sanitized[k] = sanitizeValue(v)
	}
	return sanitized
}

func sanitizeValue(val any) any {
	switch v := val.(type) {
	case map[string]any:
		return SanitizeDetails(v)
	case []any:
		sanitizedSlice := make([]any, len(v))
		for i, item := range v {
			sanitizedSlice[i] = sanitizeValue(item)
		}
		return sanitizedSlice
	default:
		return v
	}
}

type Service struct {
	repo *Repository
	txm  database.TxManager
}

func NewService(repo *Repository, txm database.TxManager) *Service {
	return &Service{
		repo: repo,
		txm:  txm,
	}
}

// 1. Audit Activity Trail
func (s *Service) RecordAudit(
	ctx context.Context,
	actorUserID *uuid.UUID,
	orgID, storeID *uuid.UUID,
	action string,
	details map[string]any,
) (*AuditEventResponse, error) {
	var res *AuditEventResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.RecordAuditTx(ctx, tx, actorUserID, orgID, storeID, action, details)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) RecordAuditTx(
	ctx context.Context, tx database.DBTX,
	actorUserID *uuid.UUID,
	orgID, storeID *uuid.UUID,
	action string,
	details map[string]any,
) (*AuditEventResponse, error) {
	sanitized := SanitizeDetails(details)
	detailsJSON, err := json.Marshal(sanitized)
	if err != nil {
		return nil, fmt.Errorf("serialize audit details: %w", err)
	}
	return s.repo.RecordAudit(ctx, tx, actorUserID, orgID, storeID, action, detailsJSON)
}

func (s *Service) ListAuditEvents(
	ctx context.Context,
	callerUserID uuid.UUID,
	filter ListAuditEventsFilter,
) ([]AuditEventResponse, error) {
	var res []AuditEventResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		// Authorization check
		if filter.StoreID != nil {
			hasStorePerm, err := authz.HasStorePermission(ctx, tx, *filter.StoreID, callerUserID, "audit.read")
			if err != nil {
				return err
			}
			if !hasStorePerm {
				// Fallback to store.manage or org permission
				hasStoreManage, err := authz.HasStorePermission(ctx, tx, *filter.StoreID, callerUserID, "store.manage")
				if err != nil {
					return err
				}
				if !hasStoreManage {
					return ErrForbidden
				}
			}
		} else if filter.OrganizationID != nil {
			hasOrgPerm, err := authz.HasOrgPermission(ctx, tx, *filter.OrganizationID, callerUserID, "audit.read")
			if err != nil {
				return err
			}
			if !hasOrgPerm {
				hasOrgManage, err := authz.HasOrgPermission(ctx, tx, *filter.OrganizationID, callerUserID, "organization.manage")
				if err != nil {
					return err
				}
				if !hasOrgManage {
					return ErrForbidden
				}
			}
		} else {
			// Require at least store or org scope, or platform admin
			var isPlatformAdmin bool
			err := tx.QueryRowContext(ctx, `
				SELECT EXISTS (
					SELECT 1 FROM identity.platform_role_assignments pra
					JOIN identity.platform_roles pr ON pr.id = pra.role_id
					WHERE pra.user_id = $1 AND pra.revoked_at IS NULL AND pr.code IN ('super_admin', 'platform_admin')
				)
			`, callerUserID).Scan(&isPlatformAdmin)
			if err != nil {
				return err
			}
			if !isPlatformAdmin {
				return ErrForbidden
			}
		}

		var err error
		res, err = s.repo.ListAuditEvents(ctx, tx, filter)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// 2. Transactionally Committed Outbox Events
func (s *Service) PublishOutbox(
	ctx context.Context,
	aggregateType string,
	aggregateID uuid.UUID,
	eventType string,
	payload map[string]any,
) (*OutboxEventResponse, error) {
	var res *OutboxEventResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.PublishOutboxTx(ctx, tx, aggregateType, aggregateID, eventType, payload)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) PublishOutboxTx(
	ctx context.Context, tx database.DBTX,
	aggregateType string,
	aggregateID uuid.UUID,
	eventType string,
	payload map[string]any,
) (*OutboxEventResponse, error) {
	if payload == nil {
		payload = make(map[string]any)
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("serialize outbox payload: %w", err)
	}
	return s.repo.PublishOutbox(ctx, tx, aggregateType, aggregateID, eventType, payloadJSON)
}

func (s *Service) ListPendingOutboxEvents(ctx context.Context, consumerName string, limit int) ([]OutboxEventResponse, error) {
	var res []OutboxEventResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.ListPendingOutboxEvents(ctx, tx, consumerName, limit)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) RecordEventDelivery(ctx context.Context, eventID uuid.UUID, consumerName, status string, lastError *string) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		return s.repo.RecordEventDelivery(ctx, tx, eventID, consumerName, status, lastError)
	})
}

func (s *Service) ListOutboxEvents(ctx context.Context, limit int) ([]OutboxEventResponse, error) {
	var res []OutboxEventResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.ListOutboxEvents(ctx, tx, limit)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// 3. Background Jobs
func (s *Service) EnqueueJob(
	ctx context.Context,
	eventID *uuid.UUID,
	jobType string,
	payload map[string]any,
	runAt *time.Time,
	maxAttempts int,
) (*JobResponse, error) {
	var res *JobResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.EnqueueJobTx(ctx, tx, eventID, jobType, payload, runAt, maxAttempts)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) EnqueueJobTx(
	ctx context.Context, tx database.DBTX,
	eventID *uuid.UUID,
	jobType string,
	payload map[string]any,
	runAt *time.Time,
	maxAttempts int,
) (*JobResponse, error) {
	if payload == nil {
		payload = make(map[string]any)
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("serialize job payload: %w", err)
	}
	execTime := time.Now()
	if runAt != nil {
		execTime = *runAt
	}
	return s.repo.EnqueueJob(ctx, tx, eventID, jobType, payloadJSON, execTime, maxAttempts)
}

func (s *Service) ClaimNextJob(ctx context.Context, workerID string) (*JobResponse, error) {
	var res *JobResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.ClaimNextJob(ctx, tx, workerID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) CompleteJob(ctx context.Context, jobID uuid.UUID) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		return s.repo.CompleteJob(ctx, tx, jobID)
	})
}

func (s *Service) FailOrRetryJob(ctx context.Context, jobID uuid.UUID, backoff time.Duration) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		return s.repo.FailOrRetryJob(ctx, tx, jobID, backoff)
	})
}

func (s *Service) RecordJobAttempt(
	ctx context.Context,
	jobID uuid.UUID,
	attemptNumber int,
	outcome string,
	errorMessage *string,
	durationMs int,
) (*JobAttemptResponse, error) {
	var res *JobAttemptResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.RecordJobAttempt(ctx, tx, jobID, attemptNumber, outcome, errorMessage, durationMs)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListJobs(ctx context.Context, status, jobType string, limit int) ([]JobResponse, error) {
	var res []JobResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.ListJobs(ctx, tx, status, jobType, limit)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) GetJob(ctx context.Context, jobID uuid.UUID) (*JobResponse, error) {
	var res *JobResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.GetJob(ctx, tx, jobID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListJobAttempts(ctx context.Context, jobID uuid.UUID) ([]JobAttemptResponse, error) {
	var res []JobAttemptResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.ListJobAttempts(ctx, tx, jobID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) RetryJob(ctx context.Context, jobID uuid.UUID) (*JobResponse, error) {
	var res *JobResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.RetryJob(ctx, tx, jobID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// 4. File Assets
func (s *Service) RegisterFileAsset(
	ctx context.Context,
	uploadedBy *uuid.UUID,
	req RegisterFileAssetRequest,
) (*FileAssetResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	var res *FileAssetResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.CreateFileAsset(ctx, tx, req, uploadedBy)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) RegisterFileAssetTx(
	ctx context.Context, tx database.DBTX,
	uploadedBy *uuid.UUID,
	req RegisterFileAssetRequest,
) (*FileAssetResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}
	return s.repo.CreateFileAsset(ctx, tx, req, uploadedBy)
}

func (s *Service) GetFileAsset(ctx context.Context, callerUserID uuid.UUID, fileID uuid.UUID) (*FileAssetResponse, error) {
	var res *FileAssetResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		fa, err := s.repo.GetFileAsset(ctx, tx, fileID)
		if err != nil {
			return err
		}

		if fa.Visibility == "public" {
			res = fa
			return nil
		}

		// Check if uploader
		if fa.UploadedBy != nil && *fa.UploadedBy == callerUserID {
			res = fa
			return nil
		}

		// Check store permissions if store-scoped
		if fa.StoreID != nil {
			hasPerm, err := authz.HasStorePermission(ctx, tx, *fa.StoreID, callerUserID, "invoice.issue")
			if err == nil && hasPerm {
				res = fa
				return nil
			}
			hasRead, err := authz.HasStorePermission(ctx, tx, *fa.StoreID, callerUserID, "product.read")
			if err == nil && hasRead {
				res = fa
				return nil
			}
		}

		// Check consumer permission if invoice-scoped
		if fa.InvoiceID != nil {
			var isConsumer bool
			err := tx.QueryRowContext(ctx, `
				SELECT EXISTS (
					SELECT 1 FROM billing.invoices i
					JOIN consumer.customer_links cl ON cl.store_customer_id = i.store_customer_id
					JOIN consumer.consumer_profiles cp ON cp.id = cl.consumer_id
					WHERE i.id = $1 AND cp.user_id = $2 AND cl.status = 'verified'
				)
			`, *fa.InvoiceID, callerUserID).Scan(&isConsumer)
			if err == nil && isConsumer {
				res = fa
				return nil
			}
		}

		return ErrForbidden
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) GetFileAssetByInvoiceID(ctx context.Context, callerUserID uuid.UUID, invoiceID uuid.UUID) (*FileAssetResponse, error) {
	var res *FileAssetResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		fa, err := s.repo.GetFileAssetByInvoiceID(ctx, tx, invoiceID)
		if err != nil {
			return err
		}

		if fa.Visibility == "public" {
			res = fa
			return nil
		}

		if fa.UploadedBy != nil && *fa.UploadedBy == callerUserID {
			res = fa
			return nil
		}

		if fa.StoreID != nil {
			hasPerm, err := authz.HasStorePermission(ctx, tx, *fa.StoreID, callerUserID, "invoice.issue")
			if err == nil && hasPerm {
				res = fa
				return nil
			}
			hasRead, err := authz.HasStorePermission(ctx, tx, *fa.StoreID, callerUserID, "product.read")
			if err == nil && hasRead {
				res = fa
				return nil
			}
		}

		var isConsumer bool
		err = tx.QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM billing.invoices i
				JOIN consumer.customer_links cl ON cl.store_customer_id = i.store_customer_id
				JOIN consumer.consumer_profiles cp ON cp.id = cl.consumer_id
				WHERE i.id = $1 AND cp.user_id = $2 AND cl.status = 'verified'
			)
		`, invoiceID, callerUserID).Scan(&isConsumer)
		if err == nil && isConsumer {
			res = fa
			return nil
		}

		return ErrForbidden
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// 5. Notification Deliveries
func (s *Service) RecordNotificationDelivery(
	ctx context.Context,
	jobID *uuid.UUID,
	recipient, channel, template, provider, providerMsgID, status string,
) (*NotificationDeliveryResponse, error) {
	var res *NotificationDeliveryResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.RecordNotificationDelivery(ctx, tx, jobID, recipient, channel, template, provider, providerMsgID, status)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// 6. Webhook Receipts
func (s *Service) IngestWebhook(
	ctx context.Context,
	provider string,
	req IngestWebhookRequest,
) (*WebhookReceiptResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}
	provider = strings.TrimSpace(strings.ToLower(provider))
	if provider == "" {
		return nil, &ValidationError{Field: "provider", Msg: "provider is required"}
	}

	payloadJSON, err := json.Marshal(req.Payload)
	if err != nil {
		return nil, &ValidationError{Field: "payload", Msg: "failed to serialize payload"}
	}

	var res *WebhookReceiptResponse
	err = s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.RecordWebhookReceipt(ctx, tx, provider, req.ProviderEventID, req.EventType, payloadJSON)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) UpdateWebhookReceiptStatus(ctx context.Context, receiptID uuid.UUID, status string, lastError *string) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		return s.repo.UpdateWebhookReceiptStatus(ctx, tx, receiptID, status, lastError)
	})
}
