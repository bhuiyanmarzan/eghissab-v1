package system

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

var (
	ErrNotFound      = errors.New("system: resource not found")
	ErrAlreadyExists = errors.New("system: resource already exists")
	ErrForbidden     = errors.New("system: access forbidden")
)

type Repository struct{}

func (r *Repository) setSessionUser(ctx context.Context, tx database.DBTX, userID uuid.UUID) {
	if userID != uuid.Nil {
		var val string
		_ = tx.QueryRowContext(ctx, "SELECT set_config('app.user_id', $1, true)", userID.String()).Scan(&val)
	}
}

// 1. Audit Activity Trail
func (r *Repository) RecordAudit(
	ctx context.Context, tx database.DBTX,
	actorUserID *uuid.UUID, orgID, storeID *uuid.UUID,
	action string, details []byte,
) (*AuditEventResponse, error) {
	if details == nil || len(details) == 0 {
		details = []byte("{}")
	}

	query := `
		INSERT INTO system.audit_events (actor_user_id, organization_id, store_id, action, details)
		VALUES ($1, $2, $3, $4, $5::jsonb)
		RETURNING id, actor_user_id, organization_id, store_id, action, details, created_at`

	var ae AuditEventResponse
	var rawDetails []byte
	var createdAt time.Time
	err := tx.QueryRowContext(ctx, query, actorUserID, orgID, storeID, action, details).Scan(
		&ae.ID, &ae.ActorUserID, &ae.OrganizationID, &ae.StoreID, &ae.Action, &rawDetails, &createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("record audit event: %w", err)
	}

	ae.CreatedAt = createdAt.Format(time.RFC3339)
	ae.Details = make(map[string]any)
	_ = json.Unmarshal(rawDetails, &ae.Details)

	if ae.ActorUserID != nil {
		var name string
		_ = tx.QueryRowContext(ctx, `
			SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
			FROM identity.users WHERE id = $1
		`, *ae.ActorUserID).Scan(&name)
		ae.ActorName = name
	}

	return &ae, nil
}

func (r *Repository) ListAuditEvents(ctx context.Context, tx database.DBTX, filter ListAuditEventsFilter) ([]AuditEventResponse, error) {
	var sb strings.Builder
	var args []any
	argIdx := 1

	sb.WriteString(`
		SELECT ae.id, ae.actor_user_id, 
		       COALESCE(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''),
		       ae.organization_id, ae.store_id, ae.action, ae.details, ae.created_at
		FROM system.audit_events ae
		LEFT JOIN identity.users u ON u.id = ae.actor_user_id
		WHERE 1=1`)

	if filter.OrganizationID != nil {
		sb.WriteString(fmt.Sprintf(" AND ae.organization_id = $%d", argIdx))
		args = append(args, *filter.OrganizationID)
		argIdx++
	}
	if filter.StoreID != nil {
		sb.WriteString(fmt.Sprintf(" AND ae.store_id = $%d", argIdx))
		args = append(args, *filter.StoreID)
		argIdx++
	}
	if filter.ActorUserID != nil {
		sb.WriteString(fmt.Sprintf(" AND ae.actor_user_id = $%d", argIdx))
		args = append(args, *filter.ActorUserID)
		argIdx++
	}
	if filter.Action != "" {
		sb.WriteString(fmt.Sprintf(" AND ae.action = $%d", argIdx))
		args = append(args, filter.Action)
		argIdx++
	}
	if filter.StartDate != "" {
		sb.WriteString(fmt.Sprintf(" AND ae.created_at >= $%d::timestamptz", argIdx))
		args = append(args, filter.StartDate)
		argIdx++
	}
	if filter.EndDate != "" {
		sb.WriteString(fmt.Sprintf(" AND ae.created_at <= $%d::timestamptz", argIdx))
		args = append(args, filter.EndDate)
		argIdx++
	}

	sb.WriteString(" ORDER BY ae.created_at DESC")

	limit := filter.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	sb.WriteString(fmt.Sprintf(" LIMIT $%d", argIdx))
	args = append(args, limit)
	argIdx++

	if filter.Offset > 0 {
		sb.WriteString(fmt.Sprintf(" OFFSET $%d", argIdx))
		args = append(args, filter.Offset)
		argIdx++
	}

	rows, err := tx.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("query audit events: %w", err)
	}
	defer rows.Close()

	var list []AuditEventResponse
	for rows.Next() {
		var ae AuditEventResponse
		var rawDetails []byte
		var createdAt time.Time
		if err := rows.Scan(
			&ae.ID, &ae.ActorUserID, &ae.ActorName, &ae.OrganizationID,
			&ae.StoreID, &ae.Action, &rawDetails, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan audit event: %w", err)
		}
		ae.CreatedAt = createdAt.Format(time.RFC3339)
		ae.Details = make(map[string]any)
		_ = json.Unmarshal(rawDetails, &ae.Details)
		list = append(list, ae)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []AuditEventResponse{}
	}
	return list, nil
}

// 2. Transactionally Committed Outbox Events
func (r *Repository) PublishOutbox(
	ctx context.Context, tx database.DBTX,
	aggregateType string, aggregateID uuid.UUID,
	eventType string, payload []byte,
) (*OutboxEventResponse, error) {
	if payload == nil || len(payload) == 0 {
		payload = []byte("{}")
	}

	query := `
		INSERT INTO system.outbox_events (aggregate_type, aggregate_id, event_type, payload)
		VALUES ($1, $2, $3, $4::jsonb)
		RETURNING id, aggregate_type, aggregate_id, event_type, payload, created_at`

	var oe OutboxEventResponse
	var rawPayload []byte
	var createdAt time.Time
	err := tx.QueryRowContext(ctx, query, aggregateType, aggregateID, eventType, payload).Scan(
		&oe.ID, &oe.AggregateType, &oe.AggregateID, &oe.EventType, &rawPayload, &createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert outbox event: %w", err)
	}

	oe.CreatedAt = createdAt.Format(time.RFC3339)
	oe.Payload = make(map[string]any)
	_ = json.Unmarshal(rawPayload, &oe.Payload)
	return &oe, nil
}

func (r *Repository) ListPendingOutboxEvents(ctx context.Context, tx database.DBTX, consumerName string, limit int) ([]OutboxEventResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := `
		SELECT oe.id, oe.aggregate_type, oe.aggregate_id, oe.event_type, oe.payload, oe.created_at
		FROM system.outbox_events oe
		LEFT JOIN system.event_deliveries ed 
		       ON ed.event_id = oe.id AND ed.consumer_name = $1
		WHERE ed.id IS NULL OR ed.status = 'pending'
		ORDER BY oe.created_at ASC
		LIMIT $2`

	rows, err := tx.QueryContext(ctx, query, consumerName, limit)
	if err != nil {
		return nil, fmt.Errorf("list pending outbox events: %w", err)
	}
	defer rows.Close()

	var list []OutboxEventResponse
	for rows.Next() {
		var oe OutboxEventResponse
		var rawPayload []byte
		var createdAt time.Time
		if err := rows.Scan(
			&oe.ID, &oe.AggregateType, &oe.AggregateID, &oe.EventType, &rawPayload, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan pending outbox event: %w", err)
		}
		oe.CreatedAt = createdAt.Format(time.RFC3339)
		oe.Payload = make(map[string]any)
		_ = json.Unmarshal(rawPayload, &oe.Payload)
		list = append(list, oe)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []OutboxEventResponse{}
	}
	return list, nil
}

func (r *Repository) RecordEventDelivery(
	ctx context.Context, tx database.DBTX,
	eventID uuid.UUID, consumerName, status string, lastError *string,
) error {
	query := `
		INSERT INTO system.event_deliveries (event_id, consumer_name, status, delivered_at, last_error, attempt_count)
		VALUES ($1, $2, $3::varchar, 
		        CASE WHEN $3::varchar = 'delivered' THEN clock_timestamp() ELSE NULL END,
		        $4, 1)
		ON CONFLICT (event_id, consumer_name)
		DO UPDATE SET
			status = EXCLUDED.status,
			delivered_at = CASE WHEN EXCLUDED.status = 'delivered' THEN clock_timestamp() ELSE system.event_deliveries.delivered_at END,
			last_error = EXCLUDED.last_error,
			attempt_count = system.event_deliveries.attempt_count + 1,
			updated_at = clock_timestamp()`

	_, err := tx.ExecContext(ctx, query, eventID, consumerName, status, lastError)
	if err != nil {
		return fmt.Errorf("record event delivery: %w", err)
	}
	return nil
}

func (r *Repository) ListOutboxEvents(ctx context.Context, tx database.DBTX, limit int) ([]OutboxEventResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := `
		SELECT id, aggregate_type, aggregate_id, event_type, payload, created_at
		FROM system.outbox_events
		ORDER BY created_at DESC
		LIMIT $1`

	rows, err := tx.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("list outbox events: %w", err)
	}
	defer rows.Close()

	var list []OutboxEventResponse
	for rows.Next() {
		var oe OutboxEventResponse
		var rawPayload []byte
		var createdAt time.Time
		if err := rows.Scan(
			&oe.ID, &oe.AggregateType, &oe.AggregateID, &oe.EventType, &rawPayload, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan outbox event: %w", err)
		}
		oe.CreatedAt = createdAt.Format(time.RFC3339)
		oe.Payload = make(map[string]any)
		_ = json.Unmarshal(rawPayload, &oe.Payload)
		list = append(list, oe)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []OutboxEventResponse{}
	}
	return list, nil
}

// 3. Background Jobs
func (r *Repository) EnqueueJob(
	ctx context.Context, tx database.DBTX,
	eventID *uuid.UUID, jobType string, payload []byte,
	runAt time.Time, maxAttempts int,
) (*JobResponse, error) {
	if payload == nil || len(payload) == 0 {
		payload = []byte("{}")
	}
	if maxAttempts <= 0 {
		maxAttempts = 3
	}

	query := `
		INSERT INTO system.jobs (event_id, type, status, payload, run_at, max_attempts)
		VALUES ($1, $2, 'queued', $3::jsonb, $4, $5)
		RETURNING id, event_id, type, status, payload, run_at, max_attempts, attempt_count,
		          locked_at, locked_by, created_at, updated_at`

	var j JobResponse
	var rawPayload []byte
	var runAtTime, createdAt, updatedAt time.Time
	var lockedAt *time.Time
	err := tx.QueryRowContext(ctx, query, eventID, jobType, payload, runAt, maxAttempts).Scan(
		&j.ID, &j.EventID, &j.Type, &j.Status, &rawPayload, &runAtTime, &j.MaxAttempts, &j.AttemptCount,
		&lockedAt, &j.LockedBy, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("enqueue job: %w", err)
	}

	j.RunAt = runAtTime.Format(time.RFC3339)
	j.CreatedAt = createdAt.Format(time.RFC3339)
	j.UpdatedAt = updatedAt.Format(time.RFC3339)
	if lockedAt != nil {
		s := lockedAt.Format(time.RFC3339)
		j.LockedAt = &s
	}
	j.Payload = make(map[string]any)
	_ = json.Unmarshal(rawPayload, &j.Payload)
	return &j, nil
}

func (r *Repository) ClaimNextJob(ctx context.Context, tx database.DBTX, workerID string) (*JobResponse, error) {
	query := `
		UPDATE system.jobs
		SET status = 'running',
		    locked_at = clock_timestamp(),
		    locked_by = $1,
		    updated_at = clock_timestamp()
		WHERE id = (
			SELECT id FROM system.jobs
			WHERE status = 'queued' AND run_at <= clock_timestamp()
			ORDER BY run_at ASC
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		RETURNING id, event_id, type, status, payload, run_at, max_attempts, attempt_count,
		          locked_at, locked_by, created_at, updated_at`

	var j JobResponse
	var rawPayload []byte
	var runAtTime, createdAt, updatedAt time.Time
	var lockedAt *time.Time
	err := tx.QueryRowContext(ctx, query, workerID).Scan(
		&j.ID, &j.EventID, &j.Type, &j.Status, &rawPayload, &runAtTime, &j.MaxAttempts, &j.AttemptCount,
		&lockedAt, &j.LockedBy, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // No job ready
		}
		return nil, fmt.Errorf("claim next job: %w", err)
	}

	j.RunAt = runAtTime.Format(time.RFC3339)
	j.CreatedAt = createdAt.Format(time.RFC3339)
	j.UpdatedAt = updatedAt.Format(time.RFC3339)
	if lockedAt != nil {
		s := lockedAt.Format(time.RFC3339)
		j.LockedAt = &s
	}
	j.Payload = make(map[string]any)
	_ = json.Unmarshal(rawPayload, &j.Payload)
	return &j, nil
}

func (r *Repository) CompleteJob(ctx context.Context, tx database.DBTX, jobID uuid.UUID) error {
	query := `
		UPDATE system.jobs
		SET status = 'completed',
		    locked_at = NULL,
		    locked_by = NULL,
		    updated_at = clock_timestamp()
		WHERE id = $1`

	_, err := tx.ExecContext(ctx, query, jobID)
	if err != nil {
		return fmt.Errorf("complete job: %w", err)
	}
	return nil
}

func (r *Repository) FailOrRetryJob(ctx context.Context, tx database.DBTX, jobID uuid.UUID, backoff time.Duration) error {
	query := `
		UPDATE system.jobs
		SET attempt_count = attempt_count + 1,
		    status = CASE WHEN attempt_count + 1 >= max_attempts THEN 'failed' ELSE 'queued' END,
		    run_at = clock_timestamp() + ($2 * INTERVAL '1 second'),
		    locked_at = NULL,
		    locked_by = NULL,
		    updated_at = clock_timestamp()
		WHERE id = $1`

	_, err := tx.ExecContext(ctx, query, jobID, backoff.Seconds())
	if err != nil {
		return fmt.Errorf("fail or retry job: %w", err)
	}
	return nil
}

func (r *Repository) RecordJobAttempt(
	ctx context.Context, tx database.DBTX,
	jobID uuid.UUID, attemptNumber int, outcome string,
	errorMessage *string, durationMs int,
) (*JobAttemptResponse, error) {
	query := `
		INSERT INTO system.job_attempts (job_id, attempt_number, outcome, error_message, duration_ms)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, job_id, attempt_number, outcome, error_message, duration_ms, started_at, finished_at`

	var ja JobAttemptResponse
	var startedAt, finishedAt time.Time
	err := tx.QueryRowContext(ctx, query, jobID, attemptNumber, outcome, errorMessage, durationMs).Scan(
		&ja.ID, &ja.JobID, &ja.AttemptNumber, &ja.Outcome, &ja.ErrorMessage, &ja.DurationMs,
		&startedAt, &finishedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("record job attempt: %w", err)
	}

	ja.StartedAt = startedAt.Format(time.RFC3339)
	ja.FinishedAt = finishedAt.Format(time.RFC3339)
	return &ja, nil
}

func (r *Repository) ListJobs(ctx context.Context, tx database.DBTX, status, jobType string, limit int) ([]JobResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var sb strings.Builder
	var args []any
	argIdx := 1

	sb.WriteString(`
		SELECT id, event_id, type, status, payload, run_at, max_attempts, attempt_count,
		       locked_at, locked_by, created_at, updated_at
		FROM system.jobs
		WHERE 1=1`)

	if status != "" {
		sb.WriteString(fmt.Sprintf(" AND status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if jobType != "" {
		sb.WriteString(fmt.Sprintf(" AND type = $%d", argIdx))
		args = append(args, jobType)
		argIdx++
	}

	sb.WriteString(" ORDER BY created_at DESC")
	sb.WriteString(fmt.Sprintf(" LIMIT $%d", argIdx))
	args = append(args, limit)

	rows, err := tx.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("list jobs: %w", err)
	}
	defer rows.Close()

	var list []JobResponse
	for rows.Next() {
		var j JobResponse
		var rawPayload []byte
		var runAtTime, createdAt, updatedAt time.Time
		var lockedAt *time.Time
		if err := rows.Scan(
			&j.ID, &j.EventID, &j.Type, &j.Status, &rawPayload, &runAtTime, &j.MaxAttempts, &j.AttemptCount,
			&lockedAt, &j.LockedBy, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan job: %w", err)
		}
		j.RunAt = runAtTime.Format(time.RFC3339)
		j.CreatedAt = createdAt.Format(time.RFC3339)
		j.UpdatedAt = updatedAt.Format(time.RFC3339)
		if lockedAt != nil {
			s := lockedAt.Format(time.RFC3339)
			j.LockedAt = &s
		}
		j.Payload = make(map[string]any)
		_ = json.Unmarshal(rawPayload, &j.Payload)
		list = append(list, j)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []JobResponse{}
	}
	return list, nil
}

func (r *Repository) GetJob(ctx context.Context, tx database.DBTX, jobID uuid.UUID) (*JobResponse, error) {
	query := `
		SELECT id, event_id, type, status, payload, run_at, max_attempts, attempt_count,
		       locked_at, locked_by, created_at, updated_at
		FROM system.jobs
		WHERE id = $1`

	var j JobResponse
	var rawPayload []byte
	var runAtTime, createdAt, updatedAt time.Time
	var lockedAt *time.Time
	err := tx.QueryRowContext(ctx, query, jobID).Scan(
		&j.ID, &j.EventID, &j.Type, &j.Status, &rawPayload, &runAtTime, &j.MaxAttempts, &j.AttemptCount,
		&lockedAt, &j.LockedBy, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get job: %w", err)
	}

	j.RunAt = runAtTime.Format(time.RFC3339)
	j.CreatedAt = createdAt.Format(time.RFC3339)
	j.UpdatedAt = updatedAt.Format(time.RFC3339)
	if lockedAt != nil {
		s := lockedAt.Format(time.RFC3339)
		j.LockedAt = &s
	}
	j.Payload = make(map[string]any)
	_ = json.Unmarshal(rawPayload, &j.Payload)
	return &j, nil
}

func (r *Repository) ListJobAttempts(ctx context.Context, tx database.DBTX, jobID uuid.UUID) ([]JobAttemptResponse, error) {
	query := `
		SELECT id, job_id, attempt_number, outcome, error_message, duration_ms, started_at, finished_at
		FROM system.job_attempts
		WHERE job_id = $1
		ORDER BY attempt_number ASC`

	rows, err := tx.QueryContext(ctx, query, jobID)
	if err != nil {
		return nil, fmt.Errorf("list job attempts: %w", err)
	}
	defer rows.Close()

	var list []JobAttemptResponse
	for rows.Next() {
		var ja JobAttemptResponse
		var startedAt, finishedAt time.Time
		if err := rows.Scan(
			&ja.ID, &ja.JobID, &ja.AttemptNumber, &ja.Outcome, &ja.ErrorMessage, &ja.DurationMs,
			&startedAt, &finishedAt,
		); err != nil {
			return nil, fmt.Errorf("scan job attempt: %w", err)
		}
		ja.StartedAt = startedAt.Format(time.RFC3339)
		ja.FinishedAt = finishedAt.Format(time.RFC3339)
		list = append(list, ja)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []JobAttemptResponse{}
	}
	return list, nil
}

func (r *Repository) RetryJob(ctx context.Context, tx database.DBTX, jobID uuid.UUID) (*JobResponse, error) {
	query := `
		UPDATE system.jobs
		SET status = 'queued',
		    run_at = clock_timestamp(),
		    locked_at = NULL,
		    locked_by = NULL,
		    updated_at = clock_timestamp()
		WHERE id = $1
		RETURNING id`

	var id uuid.UUID
	err := tx.QueryRowContext(ctx, query, jobID).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("retry job: %w", err)
	}

	return r.GetJob(ctx, tx, jobID)
}

// 4. File Assets
func (r *Repository) CreateFileAsset(
	ctx context.Context, tx database.DBTX,
	req RegisterFileAssetRequest, uploadedBy *uuid.UUID,
) (*FileAssetResponse, error) {
	query := `
		INSERT INTO system.file_assets (
			invoice_id, organization_id, store_id, storage_key, visibility,
			file_name, mime_type, file_size, checksum_sha256, uploaded_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''), $10)
		RETURNING id, invoice_id, organization_id, store_id, storage_key, visibility,
		          file_name, mime_type, file_size, COALESCE(checksum_sha256, ''),
		          uploaded_by, created_at, updated_at`

	var fa FileAssetResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query,
		req.InvoiceID, req.OrganizationID, req.StoreID, req.StorageKey, req.Visibility,
		req.FileName, req.MimeType, req.FileSize, req.ChecksumSHA256, uploadedBy,
	).Scan(
		&fa.ID, &fa.InvoiceID, &fa.OrganizationID, &fa.StoreID, &fa.StorageKey, &fa.Visibility,
		&fa.FileName, &fa.MimeType, &fa.FileSize, &fa.ChecksumSHA256, &fa.UploadedBy,
		&createdAt, &updatedAt,
	)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, ErrAlreadyExists
		}
		return nil, fmt.Errorf("create file asset: %w", err)
	}

	fa.CreatedAt = createdAt.Format(time.RFC3339)
	fa.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &fa, nil
}

func (r *Repository) GetFileAsset(ctx context.Context, tx database.DBTX, fileID uuid.UUID) (*FileAssetResponse, error) {
	query := `
		SELECT id, invoice_id, organization_id, store_id, storage_key, visibility,
		       file_name, mime_type, file_size, COALESCE(checksum_sha256, ''),
		       uploaded_by, created_at, updated_at
		FROM system.file_assets
		WHERE id = $1`

	var fa FileAssetResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, fileID).Scan(
		&fa.ID, &fa.InvoiceID, &fa.OrganizationID, &fa.StoreID, &fa.StorageKey, &fa.Visibility,
		&fa.FileName, &fa.MimeType, &fa.FileSize, &fa.ChecksumSHA256, &fa.UploadedBy,
		&createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get file asset: %w", err)
	}

	fa.CreatedAt = createdAt.Format(time.RFC3339)
	fa.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &fa, nil
}

func (r *Repository) GetFileAssetByInvoiceID(ctx context.Context, tx database.DBTX, invoiceID uuid.UUID) (*FileAssetResponse, error) {
	query := `
		SELECT id, invoice_id, organization_id, store_id, storage_key, visibility,
		       file_name, mime_type, file_size, COALESCE(checksum_sha256, ''),
		       uploaded_by, created_at, updated_at
		FROM system.file_assets
		WHERE invoice_id = $1
		ORDER BY created_at DESC
		LIMIT 1`

	var fa FileAssetResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, invoiceID).Scan(
		&fa.ID, &fa.InvoiceID, &fa.OrganizationID, &fa.StoreID, &fa.StorageKey, &fa.Visibility,
		&fa.FileName, &fa.MimeType, &fa.FileSize, &fa.ChecksumSHA256, &fa.UploadedBy,
		&createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get file asset by invoice: %w", err)
	}

	fa.CreatedAt = createdAt.Format(time.RFC3339)
	fa.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &fa, nil
}

// 5. Notification Deliveries
func (r *Repository) RecordNotificationDelivery(
	ctx context.Context, tx database.DBTX,
	jobID *uuid.UUID, recipient, channel, template, provider, providerMsgID, status string,
) (*NotificationDeliveryResponse, error) {
	query := `
		INSERT INTO system.notification_deliveries (
			job_id, recipient, channel, template, provider, provider_message_id, status, attempts, delivered_at
		) VALUES (
			$1, $2, $3, $4, $5, NULLIF($6, ''), $7::varchar, 1,
			CASE WHEN $7::varchar IN ('delivered', 'sent') THEN clock_timestamp() ELSE NULL END
		)
		RETURNING id, job_id, recipient, channel, template, provider,
		          provider_message_id, status, attempts, last_error, created_at, delivered_at`

	var nd NotificationDeliveryResponse
	var createdAt time.Time
	var deliveredAt *time.Time
	err := tx.QueryRowContext(ctx, query,
		jobID, recipient, channel, template, provider, providerMsgID, status,
	).Scan(
		&nd.ID, &nd.JobID, &nd.Recipient, &nd.Channel, &nd.Template, &nd.Provider,
		&nd.ProviderMessageID, &nd.Status, &nd.Attempts, &nd.LastError, &createdAt, &deliveredAt,
	)
	if err != nil {
		return nil, fmt.Errorf("record notification delivery: %w", err)
	}

	nd.CreatedAt = createdAt.Format(time.RFC3339)
	if deliveredAt != nil {
		s := deliveredAt.Format(time.RFC3339)
		nd.DeliveredAt = &s
	}
	return &nd, nil
}

// 6. Webhook Receipts & Deduplication
func (r *Repository) RecordWebhookReceipt(
	ctx context.Context, tx database.DBTX,
	provider, providerEventID, eventType string, payload []byte,
) (*WebhookReceiptResponse, error) {
	if payload == nil || len(payload) == 0 {
		payload = []byte("{}")
	}

	query := `
		INSERT INTO system.webhook_receipts (provider, provider_event_id, event_type, payload)
		VALUES ($1, $2, $3, $4::jsonb)
		RETURNING id, provider, provider_event_id, event_type, status, processed_at, last_error, created_at`

	var wr WebhookReceiptResponse
	var createdAt time.Time
	var processedAt *time.Time
	err := tx.QueryRowContext(ctx, query, provider, providerEventID, eventType, payload).Scan(
		&wr.ID, &wr.Provider, &wr.ProviderEventID, &wr.EventType, &wr.Status,
		&processedAt, &wr.LastError, &createdAt,
	)
	if err != nil {
		var pqErr *pq.Error
		if (errors.As(err, &pqErr) && pqErr.Code == "23505") || strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate key") {
			return nil, ErrAlreadyExists
		}
		return nil, fmt.Errorf("record webhook receipt: %w", err)
	}

	wr.CreatedAt = createdAt.Format(time.RFC3339)
	if processedAt != nil {
		s := processedAt.Format(time.RFC3339)
		wr.ProcessedAt = &s
	}
	return &wr, nil
}

func (r *Repository) UpdateWebhookReceiptStatus(
	ctx context.Context, tx database.DBTX,
	receiptID uuid.UUID, status string, lastError *string,
) error {
	query := `
		UPDATE system.webhook_receipts
		SET status = $2,
		    last_error = $3,
		    processed_at = CASE WHEN $2 IN ('processed', 'ignored') THEN clock_timestamp() ELSE processed_at END
		WHERE id = $1`

	_, err := tx.ExecContext(ctx, query, receiptID, status, lastError)
	if err != nil {
		return fmt.Errorf("update webhook receipt status: %w", err)
	}
	return nil
}
