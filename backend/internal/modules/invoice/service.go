package invoice

import (
	"context"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/authz"
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

// Invoicing Operations
func (s *Service) CreateInvoiceDraft(ctx context.Context, storeID, userID uuid.UUID, req CreateInvoiceRequest) (*InvoiceResponse, error) {
	var res *InvoiceResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.issue")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.CreateInvoiceDraft(ctx, tx, storeID, userID, req)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) GetInvoice(ctx context.Context, storeID, invoiceID, userID uuid.UUID) (*InvoiceResponse, error) {
	var res *InvoiceResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasIssuePerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.issue")
		if err != nil {
			return err
		}
		if !hasIssuePerm {
			hasReadPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.read")
			if err != nil {
				return err
			}
			if !hasReadPerm {
				return ErrForbidden
			}
		}

		res, err = s.repo.GetInvoice(ctx, tx, storeID, invoiceID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListInvoices(ctx context.Context, storeID, userID uuid.UUID, customerID *uuid.UUID, status string) ([]InvoiceResponse, error) {
	var res []InvoiceResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasIssuePerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.issue")
		if err != nil {
			return err
		}
		if !hasIssuePerm {
			hasReadPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.read")
			if err != nil {
				return err
			}
			if !hasReadPerm {
				return ErrForbidden
			}
		}

		res, err = s.repo.ListInvoices(ctx, tx, storeID, customerID, status)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) UpdateInvoiceDraft(ctx context.Context, storeID, invoiceID, userID uuid.UUID, req UpdateInvoiceRequest) (*InvoiceResponse, error) {
	var res *InvoiceResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.issue")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.UpdateInvoiceDraft(ctx, tx, storeID, invoiceID, userID, req)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) IssueInvoice(ctx context.Context, storeID, invoiceID, userID uuid.UUID) (*InvoiceResponse, error) {
	var res *InvoiceResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.issue")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.IssueInvoice(ctx, tx, storeID, invoiceID, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) VoidInvoice(ctx context.Context, storeID, invoiceID, userID uuid.UUID, reason string) (*InvoiceResponse, error) {
	var res *InvoiceResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.void")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.VoidInvoice(ctx, tx, storeID, invoiceID, userID, reason)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Payment Operations
func (s *Service) RecordPayment(ctx context.Context, storeID, invoiceID, userID uuid.UUID, req RecordPaymentRequest) (*PaymentResponse, error) {
	var res *PaymentResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.issue")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.RecordPayment(ctx, tx, storeID, invoiceID, userID, req)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListPayments(ctx context.Context, storeID, invoiceID, userID uuid.UUID) ([]PaymentResponse, error) {
	var res []PaymentResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasIssuePerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.issue")
		if err != nil {
			return err
		}
		if !hasIssuePerm {
			hasReadPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.read")
			if err != nil {
				return err
			}
			if !hasReadPerm {
				return ErrForbidden
			}
		}

		res, err = s.repo.ListPayments(ctx, tx, invoiceID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Adjustment Operations
func (s *Service) CreateAdjustment(ctx context.Context, storeID, invoiceID, userID uuid.UUID, req CreateAdjustmentRequest) (*AdjustmentResponse, error) {
	var res *AdjustmentResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.issue")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.CreateAdjustment(ctx, tx, storeID, invoiceID, userID, req)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListAdjustments(ctx context.Context, storeID, invoiceID, userID uuid.UUID) ([]AdjustmentResponse, error) {
	var res []AdjustmentResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasIssuePerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.issue")
		if err != nil {
			return err
		}
		if !hasIssuePerm {
			hasReadPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.read")
			if err != nil {
				return err
			}
			if !hasReadPerm {
				return ErrForbidden
			}
		}

		res, err = s.repo.ListAdjustments(ctx, tx, invoiceID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Consumer Decision Operations
func (s *Service) RecordDecision(ctx context.Context, storeID, invoiceID, consumerID uuid.UUID, req InvoiceDecisionRequest) (*DecisionResponse, error) {
	var res *DecisionResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		// Confirm invoice belongs to store
		_, err := s.repo.GetInvoice(ctx, tx, storeID, invoiceID)
		if err != nil {
			return err
		}

		res, err = s.repo.RecordDecision(ctx, tx, invoiceID, consumerID, req.Decision, req.Notes)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Audit Trail Events
func (s *Service) ListEvents(ctx context.Context, storeID, invoiceID, userID uuid.UUID) ([]InvoiceEventResponse, error) {
	var res []InvoiceEventResponse
	err := s.txm.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasIssuePerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "invoice.issue")
		if err != nil {
			return err
		}
		if !hasIssuePerm {
			hasReadPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "product.read")
			if err != nil {
				return err
			}
			if !hasReadPerm {
				return ErrForbidden
			}
		}

		res, err = s.repo.ListInvoiceEvents(ctx, tx, invoiceID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}
