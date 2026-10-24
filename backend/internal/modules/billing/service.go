package billing

import (
	"context"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
)

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

func (s *Service) ListPlans(ctx context.Context) ([]PlanResponse, error) {
	var res []PlanResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.ListPlans(ctx, tx)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) GetSubscription(ctx context.Context, orgID, userID uuid.UUID) (*SubscriptionResponse, error) {
	var res *SubscriptionResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		_, err := s.repo.CheckOrgPermission(ctx, tx, orgID, userID)
		if err != nil {
			return err
		}
		res, err = s.repo.GetEffectiveSubscription(ctx, tx, orgID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) Subscribe(ctx context.Context, userID uuid.UUID, req SubscribeRequest) (*SubscriptionResponse, error) {
	var res *SubscriptionResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		isOwner, err := s.repo.CheckOrgPermission(ctx, tx, req.OrganizationID, userID)
		if err != nil {
			return err
		}
		if !isOwner {
			return ErrForbidden
		}

		res, err = s.repo.Subscribe(ctx, tx, req.OrganizationID, req.PlanCode, req.BillingInterval)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) Cancel(ctx context.Context, userID uuid.UUID, req CancelSubscriptionRequest) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		isOwner, err := s.repo.CheckOrgPermission(ctx, tx, req.OrganizationID, userID)
		if err != nil {
			return err
		}
		if !isOwner {
			return ErrForbidden
		}
		return s.repo.CancelSubscription(ctx, tx, req.OrganizationID)
	})
}

func (s *Service) ListInvoices(ctx context.Context, orgID, userID uuid.UUID) ([]InvoiceResponse, error) {
	var res []InvoiceResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		_, err := s.repo.CheckOrgPermission(ctx, tx, orgID, userID)
		if err != nil {
			return err
		}
		res, err = s.repo.ListInvoices(ctx, tx, orgID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) RecordUsage(ctx context.Context, userID uuid.UUID, req RecordUsageRequest) error {
	return s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		_, err := s.repo.CheckOrgPermission(ctx, tx, req.OrganizationID, userID)
		if err != nil {
			return err
		}
		return s.repo.RecordUsage(ctx, tx, req.OrganizationID, req.StoreID, req.Metric, req.Quantity, req.SourceKey)
	})
}

func (s *Service) ProcessWebhook(ctx context.Context, provider string, req WebhookPayload) (bool, error) {
	var isNew bool
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		isNew, err = s.repo.RecordWebhookEvent(ctx, tx, provider, req.EventID, req.EventType, req.Payload)
		return err
	})
	return isNew, err
}
