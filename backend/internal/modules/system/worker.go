package system

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Worker struct {
	svc          *Service
	logger       *slog.Logger
	workerID     string
	pollInterval time.Duration
}

func NewWorker(svc *Service, logger *slog.Logger) *Worker {
	if logger == nil {
		logger = slog.Default()
	}
	workerID := fmt.Sprintf("worker-%s", uuid.New().String()[:8])
	return &Worker{
		svc:          svc,
		logger:       logger.With(slog.String("component", "system_worker"), slog.String("worker_id", workerID)),
		workerID:     workerID,
		pollInterval: 500 * time.Millisecond,
	}
}

// Start launches the background worker goroutines (Outbox Dispatcher and Job Processor)
// and blocks until ctx is cancelled.
func (w *Worker) Start(ctx context.Context) {
	w.logger.Info("starting system background workers")

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		w.runOutboxDispatcher(ctx)
	}()

	go func() {
		defer wg.Done()
		w.runJobProcessor(ctx)
	}()

	wg.Wait()
	w.logger.Info("system background workers stopped")
}

// runOutboxDispatcher periodically scans for pending outbox events and dispatches jobs.
func (w *Worker) runOutboxDispatcher(ctx context.Context) {
	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	consumerName := "dispatcher"

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			events, err := w.svc.ListPendingOutboxEvents(ctx, consumerName, 25)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				w.logger.Error("failed to query pending outbox events", slog.String("error", err.Error()))
				continue
			}

			for _, event := range events {
				w.processOutboxEvent(ctx, event, consumerName)
			}
		}
	}
}

func (w *Worker) processOutboxEvent(ctx context.Context, event OutboxEventResponse, consumerName string) {
	var procErr error

	switch event.EventType {
	case "invoice.issued":
		// Enqueue PDF generation job
		pdfPayload := map[string]any{
			"invoice_id": event.AggregateID.String(),
		}
		if storeID, ok := event.Payload["store_id"]; ok {
			pdfPayload["store_id"] = storeID
		}
		if orgID, ok := event.Payload["organization_id"]; ok {
			pdfPayload["organization_id"] = orgID
		}

		_, err := w.svc.EnqueueJob(ctx, &event.ID, "generate_invoice_pdf", pdfPayload, nil, 3)
		if err != nil {
			procErr = fmt.Errorf("enqueue generate_invoice_pdf: %w", err)
		}

		// Enqueue notification delivery job
		notifPayload := map[string]any{
			"invoice_id": event.AggregateID.String(),
			"channel":    "email",
			"template":   "invoice_issued",
			"recipient":  "billing@customer.local",
		}
		if customerEmail, ok := event.Payload["customer_email"].(string); ok && customerEmail != "" {
			notifPayload["recipient"] = customerEmail
		}
		_, err = w.svc.EnqueueJob(ctx, &event.ID, "send_notification", notifPayload, nil, 3)
		if err != nil && procErr == nil {
			procErr = fmt.Errorf("enqueue send_notification: %w", err)
		}

	default:
		// Generic event processed
	}

	if procErr != nil {
		errMsg := procErr.Error()
		w.logger.Error("outbox event dispatch failed",
			slog.String("event_id", event.ID.String()),
			slog.String("event_type", event.EventType),
			slog.String("error", errMsg),
		)
		_ = w.svc.RecordEventDelivery(ctx, event.ID, consumerName, "failed", &errMsg)
	} else {
		_ = w.svc.RecordEventDelivery(ctx, event.ID, consumerName, "delivered", nil)
	}
}

// runJobProcessor claims and executes queued background jobs.
func (w *Worker) runJobProcessor(ctx context.Context) {
	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for {
				if ctx.Err() != nil {
					return
				}

				job, err := w.svc.ClaimNextJob(ctx, w.workerID)
				if err != nil {
					w.logger.Error("failed to claim job", slog.String("error", err.Error()))
					break
				}
				if job == nil {
					// No more jobs ready right now
					break
				}

				w.executeJob(ctx, job)
			}
		}
	}
}

func (w *Worker) executeJob(ctx context.Context, job *JobResponse) {
	start := time.Now()
	var execErr error

	switch job.Type {
	case "generate_invoice_pdf":
		execErr = w.handleGenerateInvoicePDF(ctx, job)

	case "send_notification":
		execErr = w.handleSendNotification(ctx, job)

	default:
		// Check for simulated failure payload
		if failVal, ok := job.Payload["fail"].(bool); ok && failVal {
			execErr = fmt.Errorf("simulated job failure as requested by payload")
		}
	}

	durationMs := int(time.Since(start).Milliseconds())
	attemptNum := job.AttemptCount + 1

	if execErr != nil {
		errMsg := execErr.Error()
		w.logger.Warn("job execution failed",
			slog.String("job_id", job.ID.String()),
			slog.String("job_type", job.Type),
			slog.Int("attempt", attemptNum),
			slog.String("error", errMsg),
		)

		if _, err := w.svc.RecordJobAttempt(ctx, job.ID, attemptNum, "failed", &errMsg, durationMs); err != nil {
			w.logger.Error("failed to record failed job attempt", slog.String("job_id", job.ID.String()), slog.String("error", err.Error()))
		}

		// Exponential backoff: 2^attemptNum seconds
		backoff := time.Duration(1<<attemptNum) * time.Second
		if backoff > 5*time.Minute {
			backoff = 5 * time.Minute
		}
		_ = w.svc.FailOrRetryJob(ctx, job.ID, backoff)
	} else {
		if _, err := w.svc.RecordJobAttempt(ctx, job.ID, attemptNum, "success", nil, durationMs); err != nil {
			w.logger.Error("failed to record succeeded job attempt", slog.String("job_id", job.ID.String()), slog.String("error", err.Error()))
		}
		if err := w.svc.CompleteJob(ctx, job.ID); err != nil {
			w.logger.Error("failed to mark job completed", slog.String("job_id", job.ID.String()), slog.String("error", err.Error()))
		}
		w.logger.Info("job execution succeeded",
			slog.String("job_id", job.ID.String()),
			slog.String("job_type", job.Type),
			slog.Int("duration_ms", durationMs),
		)
	}
}

func (w *Worker) handleGenerateInvoicePDF(ctx context.Context, job *JobResponse) error {
	invoiceIDStr, _ := job.Payload["invoice_id"].(string)
	invoiceID, err := uuid.Parse(invoiceIDStr)
	if err != nil {
		return fmt.Errorf("invalid or missing invoice_id: %w", err)
	}

	var orgID, storeID *uuid.UUID
	if orgIDStr, ok := job.Payload["organization_id"].(string); ok && orgIDStr != "" {
		if parsed, err := uuid.Parse(orgIDStr); err == nil {
			orgID = &parsed
		}
	}
	if storeIDStr, ok := job.Payload["store_id"].(string); ok && storeIDStr != "" {
		if parsed, err := uuid.Parse(storeIDStr); err == nil {
			storeID = &parsed
		}
	}

	storageKey := fmt.Sprintf("invoices/%s/invoice-%s.pdf", invoiceID.String(), job.ID.String()[:8])
	fileName := fmt.Sprintf("invoice-%s.pdf", invoiceID.String()[:8])

	req := RegisterFileAssetRequest{
		InvoiceID:      &invoiceID,
		OrganizationID: orgID,
		StoreID:        storeID,
		StorageKey:     storageKey,
		Visibility:     "tenant",
		FileName:       fileName,
		MimeType:       "application/pdf",
		FileSize:       102400, // ~100 KiB mock generated PDF
		ChecksumSHA256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
	}

	_, err = w.svc.RegisterFileAsset(ctx, nil, req)
	if err != nil && err != ErrAlreadyExists {
		return fmt.Errorf("register file asset: %w", err)
	}
	return nil
}

func (w *Worker) handleSendNotification(ctx context.Context, job *JobResponse) error {
	recipient, _ := job.Payload["recipient"].(string)
	if recipient == "" {
		recipient = "customer@eghissab.local"
	}
	channel, _ := job.Payload["channel"].(string)
	if channel == "" {
		channel = "email"
	}
	template, _ := job.Payload["template"].(string)
	if template == "" {
		template = "generic"
	}

	providerMsgID := fmt.Sprintf("msg_%s", uuid.New().String()[:12])
	_, err := w.svc.RecordNotificationDelivery(ctx, &job.ID, recipient, channel, template, "resend", providerMsgID, "delivered")
	if err != nil {
		return fmt.Errorf("record notification delivery: %w", err)
	}
	return nil
}
