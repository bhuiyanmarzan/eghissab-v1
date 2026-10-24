package billing

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
)

var (
	ErrNotFound            = errors.New("billing: resource not found")
	ErrForbidden           = errors.New("billing: access forbidden")
	ErrPlanNotFound        = errors.New("billing: requested plan not found")
	ErrNoActiveSub         = errors.New("billing: organization has no active subscription")
	ErrWebhookDuplicate    = errors.New("billing: webhook event already received and processed")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CheckOrgPermission(ctx context.Context, tx database.DBTX, orgID, userID uuid.UUID) (bool, error) {
	query := `SELECT is_owner FROM organization.organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`
	var isOwner bool
	err := tx.QueryRowContext(ctx, query, orgID, userID).Scan(&isOwner)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, ErrForbidden
		}
		return false, err
	}
	return isOwner, nil
}

func (r *Repository) ListPlans(ctx context.Context, tx database.DBTX) ([]PlanResponse, error) {
	query := `
		SELECT p.id, p.code, p.name, p.status, pv.version, pv.price_minor, pv.currency, pv.billing_interval, pv.limits
		FROM billing.plans p
		JOIN billing.plan_versions pv ON pv.plan_id = p.id
		WHERE p.status = 'active'
		ORDER BY pv.price_minor ASC`

	rows, err := tx.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}
	defer rows.Close()

	var plans []PlanResponse
	for rows.Next() {
		var p PlanResponse
		var limitsData []byte
		if err := rows.Scan(
			&p.ID, &p.Code, &p.Name, &p.Status, &p.Version, &p.PriceMinor,
			&p.Currency, &p.BillingInterval, &limitsData,
		); err != nil {
			return nil, fmt.Errorf("scan plan: %w", err)
		}
		_ = json.Unmarshal(limitsData, &p.Limits)
		plans = append(plans, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if plans == nil {
		plans = []PlanResponse{}
	}
	return plans, nil
}

func (r *Repository) GetEffectiveSubscription(ctx context.Context, tx database.DBTX, orgID uuid.UUID) (*SubscriptionResponse, error) {
	query := `
		SELECT s.id, s.organization_id, p.code, p.name, s.status, s.period_start, s.period_end,
		       s.canceled_at, pv.limits
		FROM billing.subscriptions s
		JOIN billing.plan_versions pv ON pv.id = s.plan_version_id
		JOIN billing.plans p ON p.id = pv.plan_id
		WHERE s.organization_id = $1 AND s.status IN ('active', 'trialing', 'past_due')
		LIMIT 1`

	var sub SubscriptionResponse
	var pStart, pEnd time.Time
	var canceledAt sql.NullTime
	var limitsData []byte

	err := tx.QueryRowContext(ctx, query, orgID).Scan(
		&sub.ID, &sub.OrganizationID, &sub.PlanCode, &sub.PlanName, &sub.Status,
		&pStart, &pEnd, &canceledAt, &limitsData,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNoActiveSub
		}
		return nil, fmt.Errorf("get effective subscription: %w", err)
	}

	sub.PeriodStart = pStart.Format(time.RFC3339)
	sub.PeriodEnd = pEnd.Format(time.RFC3339)
	if canceledAt.Valid {
		cStr := canceledAt.Time.Format(time.RFC3339)
		sub.CanceledAt = &cStr
	}
	_ = json.Unmarshal(limitsData, &sub.Limits)
	return &sub, nil
}

func (r *Repository) Subscribe(ctx context.Context, tx database.DBTX, orgID uuid.UUID, planCode, billingInterval string) (*SubscriptionResponse, error) {
	// Look up target plan version
	queryPlan := `
		SELECT pv.id, p.name, pv.price_minor, pv.currency, pv.limits
		FROM billing.plans p
		JOIN billing.plan_versions pv ON pv.plan_id = p.id
		WHERE p.code = $1 AND p.status = 'active'
		ORDER BY pv.version DESC
		LIMIT 1`

	var pvID uuid.UUID
	var planName, currency string
	var priceMinor int64
	var limitsData []byte

	err := tx.QueryRowContext(ctx, queryPlan, planCode).Scan(&pvID, &planName, &priceMinor, &currency, &limitsData)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrPlanNotFound
		}
		return nil, fmt.Errorf("lookup plan: %w", err)
	}

	// 1. Cancel / supersede any existing effective subscription to respect partial unique index
	_, err = tx.ExecContext(ctx, `
		UPDATE billing.subscriptions
		SET status = 'canceled', canceled_at = clock_timestamp(), updated_at = clock_timestamp()
		WHERE organization_id = $1 AND status IN ('active', 'trialing', 'past_due')`,
		orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("supersede existing subscription: %w", err)
	}

	// 2. Insert new effective subscription
	periodStart := time.Now().UTC()
	periodEnd := periodStart.AddDate(0, 1, 0)
	if billingInterval == "year" {
		periodEnd = periodStart.AddDate(1, 0, 0)
	} else if billingInterval == "free" || planCode == "free" {
		periodEnd = periodStart.AddDate(100, 0, 0)
	}

	var subID uuid.UUID
	subQuery := `
		INSERT INTO billing.subscriptions (
			organization_id, plan_version_id, status, period_start, period_end
		) VALUES ($1, $2, 'active', $3, $4)
		RETURNING id`

	if err := tx.QueryRowContext(ctx, subQuery, orgID, pvID, periodStart, periodEnd).Scan(&subID); err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}

	// 3. Create billing invoice
	invStatus := "open"
	var paidAt *time.Time
	if priceMinor == 0 {
		invStatus = "paid"
		now := time.Now().UTC()
		paidAt = &now
	}

	invQuery := `
		INSERT INTO billing.billing_invoices (
			subscription_id, amount_minor, currency, status, period_start, period_end, due_at, paid_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`

	dueAt := periodStart.AddDate(0, 0, 7)
	_, _ = tx.ExecContext(ctx, invQuery, subID, priceMinor, currency, invStatus, periodStart, periodEnd, dueAt, paidAt)

	var limits map[string]any
	_ = json.Unmarshal(limitsData, &limits)

	return &SubscriptionResponse{
		ID:             subID,
		OrganizationID: orgID,
		PlanCode:       planCode,
		PlanName:       planName,
		Status:         "active",
		PeriodStart:    periodStart.Format(time.RFC3339),
		PeriodEnd:      periodEnd.Format(time.RFC3339),
		Limits:         limits,
	}, nil
}

func (r *Repository) CancelSubscription(ctx context.Context, tx database.DBTX, orgID uuid.UUID) error {
	res, err := tx.ExecContext(ctx, `
		UPDATE billing.subscriptions
		SET status = 'canceled', canceled_at = clock_timestamp(), updated_at = clock_timestamp()
		WHERE organization_id = $1 AND status IN ('active', 'trialing', 'past_due')`,
		orgID,
	)
	if err != nil {
		return fmt.Errorf("cancel subscription: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNoActiveSub
	}
	return nil
}

func (r *Repository) ListInvoices(ctx context.Context, tx database.DBTX, orgID uuid.UUID) ([]InvoiceResponse, error) {
	query := `
		SELECT i.id, i.subscription_id, i.amount_minor, i.currency, i.status,
		       COALESCE(i.provider_reference, ''), i.period_start, i.period_end, i.due_at,
		       i.paid_at, i.created_at
		FROM billing.billing_invoices i
		JOIN billing.subscriptions s ON s.id = i.subscription_id
		WHERE s.organization_id = $1
		ORDER BY i.created_at DESC`

	rows, err := tx.QueryContext(ctx, query, orgID)
	if err != nil {
		return nil, fmt.Errorf("list invoices: %w", err)
	}
	defer rows.Close()

	var invoices []InvoiceResponse
	for rows.Next() {
		var inv InvoiceResponse
		var pStart, pEnd, dueAt, createdAt time.Time
		var paidAt sql.NullTime

		if err := rows.Scan(
			&inv.ID, &inv.SubscriptionID, &inv.AmountMinor, &inv.Currency, &inv.Status,
			&inv.ProviderReference, &pStart, &pEnd, &dueAt, &paidAt, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan invoice: %w", err)
		}

		inv.PeriodStart = pStart.Format(time.RFC3339)
		inv.PeriodEnd = pEnd.Format(time.RFC3339)
		inv.DueAt = dueAt.Format(time.RFC3339)
		inv.CreatedAt = createdAt.Format(time.RFC3339)
		if paidAt.Valid {
			pStr := paidAt.Time.Format(time.RFC3339)
			inv.PaidAt = &pStr
		}
		invoices = append(invoices, inv)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if invoices == nil {
		invoices = []InvoiceResponse{}
	}
	return invoices, nil
}

func (r *Repository) RecordUsage(ctx context.Context, tx database.DBTX, orgID uuid.UUID, storeID *uuid.UUID, metric string, quantity int64, sourceKey string) error {
	query := `
		INSERT INTO billing.usage_records (organization_id, store_id, metric, quantity, source_key)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (source_key) DO NOTHING`

	_, err := tx.ExecContext(ctx, query, orgID, storeID, metric, quantity, sourceKey)
	return err
}

func (r *Repository) RecordWebhookEvent(ctx context.Context, tx database.DBTX, provider, eventID, eventType string, payload json.RawMessage) (bool, error) {
	query := `
		INSERT INTO billing.billing_webhook_events (provider, event_id, event_type, payload, status)
		VALUES ($1, $2, $3, $4, 'pending')
		ON CONFLICT (provider, event_id) DO NOTHING
		RETURNING id`

	var id uuid.UUID
	err := tx.QueryRowContext(ctx, query, provider, eventID, eventType, payload).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Already recorded! Deduplicated!
			return false, nil
		}
		return false, fmt.Errorf("insert webhook event: %w", err)
	}
	return true, nil
}
