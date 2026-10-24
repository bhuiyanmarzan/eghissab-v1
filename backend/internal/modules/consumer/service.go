package consumer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/authz"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
)

type Service struct {
	tx   database.TxManager
	repo *Repository
}

func NewService(tx database.TxManager) *Service {
	return &Service{
		tx:   tx,
		repo: &Repository{},
	}
}

// Profile Operations
func (s *Service) GetProfile(ctx context.Context, userID uuid.UUID) (*ConsumerProfileResponse, error) {
	var res *ConsumerProfileResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.getProfile(ctx, tx, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) CreateProfile(ctx context.Context, userID uuid.UUID, req CreateConsumerProfileRequest) (*ConsumerProfileResponse, error) {
	prefs := req.Preferences
	if prefs == nil {
		prefs = make(map[string]any)
	}
	prefsJSON, err := json.Marshal(prefs)
	if err != nil {
		return nil, &ValidationError{Field: "preferences", Msg: "failed to serialize preferences JSON"}
	}

	var res *ConsumerProfileResponse
	err = s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		existing, err := s.repo.getProfile(ctx, tx, userID)
		if err == nil && existing != nil {
			return ErrAlreadyExists
		}
		if err != nil && !errors.Is(err, ErrNotFound) {
			return err
		}
		res, err = s.repo.createProfile(ctx, tx, userID, prefsJSON)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) UpdatePreferences(ctx context.Context, userID uuid.UUID, req UpdateConsumerPreferencesRequest) (*ConsumerProfileResponse, error) {
	prefsJSON, err := json.Marshal(req.Preferences)
	if err != nil {
		return nil, &ValidationError{Field: "preferences", Msg: "failed to serialize preferences JSON"}
	}

	var res *ConsumerProfileResponse
	err = s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		var err error
		res, err = s.repo.updatePreferences(ctx, tx, userID, prefsJSON)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Domain E: Membership Requests
func (s *Service) SubmitMembershipRequest(ctx context.Context, userID uuid.UUID, req CreateMembershipRequestRequest) (*MembershipRequestResponse, error) {
	var res *MembershipRequestResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		// Ensure consumer profile exists
		profile, err := s.repo.getOrCreateProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		res, err = s.repo.CreateMembershipRequest(ctx, tx, profile.ID, req.StoreID, req.CustomerPhone, req.Notes)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListConsumerMembershipRequests(ctx context.Context, userID uuid.UUID) ([]MembershipRequestResponse, error) {
	var res []MembershipRequestResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return nil
			}
			return err
		}

		res, err = s.repo.ListConsumerMembershipRequests(ctx, tx, profile.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	if res == nil {
		res = []MembershipRequestResponse{}
	}
	return res, nil
}

func (s *Service) ListStoreMembershipRequests(ctx context.Context, storeID, userID uuid.UUID, status string) ([]MembershipRequestResponse, error) {
	var res []MembershipRequestResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "customer.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.ListStoreMembershipRequests(ctx, tx, storeID, status)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ReviewMembershipRequest(ctx context.Context, storeID, requestID, reviewerUserID uuid.UUID, req ReviewMembershipRequestRequest) (*MembershipRequestResponse, error) {
	var res *MembershipRequestResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, reviewerUserID, "customer.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		mr, err := s.repo.GetMembershipRequest(ctx, tx, requestID)
		if err != nil {
			return err
		}
		if mr.StoreID != storeID {
			return ErrForbidden
		}
		if mr.Status != "pending" {
			return ErrRequestClosed
		}

		if req.Status == "approved" {
			// Resolve or create store_customer
			var targetCustomerID uuid.UUID
			if mr.StoreCustomerID != nil && *mr.StoreCustomerID != uuid.Nil {
				targetCustomerID = *mr.StoreCustomerID
			} else {
				// Create store customer for this consumer
				var userName string
				_ = tx.QueryRowContext(ctx, `
					SELECT COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name, '')), ''), 'Customer')
					FROM identity.users u
					JOIN consumer.consumer_profiles cp ON cp.user_id = u.id
					WHERE cp.id = $1
				`, mr.ConsumerID).Scan(&userName)

				var count int
				_ = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM store.store_customers WHERE store_id = $1", storeID).Scan(&count)
				custNum := fmt.Sprintf("CUST-%05d", count+1)

				insertCustQuery := `
					INSERT INTO store.store_customers (store_id, customer_number, display_name, consumer_id)
					VALUES ($1, $2, $3, $4)
					RETURNING id`
				err = tx.QueryRowContext(ctx, insertCustQuery, storeID, custNum, userName, mr.ConsumerID).Scan(&targetCustomerID)
				if err != nil {
					return fmt.Errorf("create store customer on link approval: %w", err)
				}
			}

			// Determine access_from temporal gate
			accessFrom := time.Now().UTC()
			if req.AccessFrom != nil && *req.AccessFrom != "" {
				parsedDate, err := time.Parse("2006-01-02", *req.AccessFrom)
				if err == nil {
					accessFrom = parsedDate
				} else {
					parsedRFC, err := time.Parse(time.RFC3339, *req.AccessFrom)
					if err == nil {
						accessFrom = parsedRFC
					}
				}
			}

			// Create verified customer_link
			_, err = s.repo.CreateCustomerLink(ctx, tx, mr.ConsumerID, targetCustomerID, accessFrom)
			if err != nil {
				return err
			}

			// Link store customer to consumer profile
			_, _ = tx.ExecContext(ctx, `
				UPDATE store.store_customers SET consumer_id = $1 WHERE id = $2
			`, mr.ConsumerID, targetCustomerID)

			// Update membership request with assigned store_customer_id
			_, _ = tx.ExecContext(ctx, `
				UPDATE consumer.membership_requests SET store_customer_id = $1 WHERE id = $2
			`, targetCustomerID, requestID)
		}

		res, err = s.repo.ReviewMembershipRequest(ctx, tx, requestID, reviewerUserID, req.Status)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Domain E: Customer Links
func (s *Service) ListConsumerCustomerLinks(ctx context.Context, userID uuid.UUID) ([]CustomerLinkResponse, error) {
	var res []CustomerLinkResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return nil
			}
			return err
		}

		res, err = s.repo.ListConsumerCustomerLinks(ctx, tx, profile.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	if res == nil {
		res = []CustomerLinkResponse{}
	}
	return res, nil
}

func (s *Service) RevokeCustomerLink(ctx context.Context, userID, linkID uuid.UUID) error {
	return s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		return s.repo.RevokeCustomerLink(ctx, tx, linkID, profile.ID)
	})
}

func (s *Service) ListStoreCustomerLinks(ctx context.Context, storeID, userID uuid.UUID) ([]CustomerLinkResponse, error) {
	var res []CustomerLinkResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		hasPerm, err := authz.HasStorePermission(ctx, tx, storeID, userID, "customer.manage")
		if err != nil {
			return err
		}
		if !hasPerm {
			return ErrForbidden
		}

		res, err = s.repo.ListStoreCustomerLinks(ctx, tx, storeID)
		return err
	})
	if err != nil {
		return nil, err
	}
	if res == nil {
		res = []CustomerLinkResponse{}
	}
	return res, nil
}

// Domain E: Cross-Store Invoices for Consumer
func (s *Service) ListConsumerInvoices(ctx context.Context, userID uuid.UUID) ([]ConsumerInvoiceResponse, error) {
	var res []ConsumerInvoiceResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return nil
			}
			return err
		}

		res, err = s.repo.ListConsumerInvoices(ctx, tx, profile.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	if res == nil {
		res = []ConsumerInvoiceResponse{}
	}
	return res, nil
}

func (s *Service) GetConsumerInvoice(ctx context.Context, userID, invoiceID uuid.UUID) (*ConsumerInvoiceResponse, error) {
	var res *ConsumerInvoiceResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		res, err = s.repo.GetConsumerInvoice(ctx, tx, profile.ID, invoiceID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) RecordConsumerInvoiceDecision(ctx context.Context, userID, invoiceID uuid.UUID, req ConsumerInvoiceDecisionRequest) (*ConsumerInvoiceResponse, error) {
	var res *ConsumerInvoiceResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		// Verify access
		_, err = s.repo.GetConsumerInvoice(ctx, tx, profile.ID, invoiceID)
		if err != nil {
			return err
		}

		err = s.repo.RecordConsumerInvoiceDecision(ctx, tx, profile.ID, invoiceID, req.Decision, req.Notes)
		if err != nil {
			return err
		}

		res, err = s.repo.GetConsumerInvoice(ctx, tx, profile.ID, invoiceID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// Domain E: Expense Categories
func (s *Service) CreateExpenseCategory(ctx context.Context, userID uuid.UUID, req CreateExpenseCategoryRequest) (*ExpenseCategoryResponse, error) {
	var res *ExpenseCategoryResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getOrCreateProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		res, err = s.repo.CreateExpenseCategory(ctx, tx, profile.ID, req.Name, req.ParentID, req.Color, req.Icon)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListExpenseCategories(ctx context.Context, userID uuid.UUID) ([]ExpenseCategoryResponse, error) {
	var res []ExpenseCategoryResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return nil
			}
			return err
		}

		res, err = s.repo.ListExpenseCategories(ctx, tx, profile.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	if res == nil {
		res = []ExpenseCategoryResponse{}
	}
	return res, nil
}

func (s *Service) UpdateExpenseCategory(ctx context.Context, userID, categoryID uuid.UUID, req UpdateExpenseCategoryRequest) (*ExpenseCategoryResponse, error) {
	var res *ExpenseCategoryResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		res, err = s.repo.UpdateExpenseCategory(ctx, tx, profile.ID, categoryID, req.Name, req.ParentID, req.Color, req.Icon)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) DeleteExpenseCategory(ctx context.Context, userID, categoryID uuid.UUID) error {
	return s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		return s.repo.DeleteExpenseCategory(ctx, tx, profile.ID, categoryID)
	})
}

// Domain E: Expense Entries
func (s *Service) CreateExpenseEntry(ctx context.Context, userID uuid.UUID, req CreateExpenseEntryRequest) (*ExpenseEntryResponse, error) {
	var res *ExpenseEntryResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getOrCreateProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		// If invoice_id provided, verify consumer has access to this invoice
		var storeID *uuid.UUID = req.StoreID
		if req.InvoiceID != nil && *req.InvoiceID != uuid.Nil {
			inv, err := s.repo.GetConsumerInvoice(ctx, tx, profile.ID, *req.InvoiceID)
			if err != nil {
				return fmt.Errorf("invoice not found or inaccessible: %w", err)
			}
			storeID = &inv.StoreID
		}

		res, err = s.repo.CreateExpenseEntry(
			ctx, tx, profile.ID, req.InvoiceID, storeID, req.CategoryID,
			req.Amount, req.Currency, req.SourceType, req.EntryDate, req.Description,
		)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ClaimInvoiceExpense(ctx context.Context, userID, invoiceID uuid.UUID, req ClaimInvoiceExpenseRequest) (*ExpenseEntryResponse, error) {
	var res *ExpenseEntryResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getOrCreateProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		inv, err := s.repo.GetConsumerInvoice(ctx, tx, profile.ID, invoiceID)
		if err != nil {
			return err
		}

		desc := fmt.Sprintf("Store purchase - %s (Invoice %s)", inv.StoreName, inv.InvoiceNumber)
		if req.Notes != "" {
			desc = fmt.Sprintf("%s: %s", desc, req.Notes)
		}

		res, err = s.repo.CreateExpenseEntry(
			ctx, tx, profile.ID, &inv.ID, &inv.StoreID, req.CategoryID,
			inv.TotalAmount, inv.Currency, "invoice", inv.InvoiceDate, desc,
		)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) GetExpenseEntry(ctx context.Context, userID, expenseID uuid.UUID) (*ExpenseEntryResponse, error) {
	var res *ExpenseEntryResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		res, err = s.repo.GetExpenseEntry(ctx, tx, profile.ID, expenseID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListExpenseEntries(ctx context.Context, userID uuid.UUID, categoryID *uuid.UUID, startDate, endDate string) ([]ExpenseEntryResponse, error) {
	var res []ExpenseEntryResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return nil
			}
			return err
		}

		res, err = s.repo.ListExpenseEntries(ctx, tx, profile.ID, categoryID, startDate, endDate)
		return err
	})
	if err != nil {
		return nil, err
	}
	if res == nil {
		res = []ExpenseEntryResponse{}
	}
	return res, nil
}

func (s *Service) UpdateExpenseEntry(ctx context.Context, userID, expenseID uuid.UUID, req UpdateExpenseEntryRequest) (*ExpenseEntryResponse, error) {
	var res *ExpenseEntryResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		res, err = s.repo.UpdateExpenseEntry(ctx, tx, profile.ID, expenseID, req.CategoryID, req.Amount, req.EntryDate, req.Description)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) DeleteExpenseEntry(ctx context.Context, userID, expenseID uuid.UUID) error {
	return s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		return s.repo.DeleteExpenseEntry(ctx, tx, profile.ID, expenseID)
	})
}

// Domain E: Expense Adjustments
func (s *Service) CreateExpenseAdjustment(ctx context.Context, userID, expenseID uuid.UUID, req CreateExpenseAdjustmentRequest) (*ExpenseAdjustmentResponse, error) {
	var res *ExpenseAdjustmentResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		// Confirm caller owns the expense entry
		_, err = s.repo.GetExpenseEntry(ctx, tx, profile.ID, expenseID)
		if err != nil {
			return err
		}

		res, err = s.repo.CreateExpenseAdjustment(ctx, tx, expenseID, req.AmountDelta, req.Reason, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ListExpenseAdjustments(ctx context.Context, userID, expenseID uuid.UUID) ([]ExpenseAdjustmentResponse, error) {
	var res []ExpenseAdjustmentResponse
	err := s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		profile, err := s.repo.getProfile(ctx, tx, userID)
		if err != nil {
			return err
		}

		// Confirm caller owns the expense entry
		_, err = s.repo.GetExpenseEntry(ctx, tx, profile.ID, expenseID)
		if err != nil {
			return err
		}

		res, err = s.repo.ListExpenseAdjustments(ctx, tx, expenseID)
		return err
	})
	if err != nil {
		return nil, err
	}
	if res == nil {
		res = []ExpenseAdjustmentResponse{}
	}
	return res, nil
}
