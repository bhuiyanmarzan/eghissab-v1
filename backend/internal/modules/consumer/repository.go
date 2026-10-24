package consumer

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
	ErrNotFound       = errors.New("consumer: resource not found")
	ErrAlreadyExists  = errors.New("consumer: resource already exists")
	ErrForbidden      = errors.New("consumer: access forbidden")
	ErrDuplicateClaim = errors.New("consumer: invoice has already been claimed as an expense")
	ErrRequestClosed  = errors.New("consumer: membership request has already been reviewed or cancelled")
	ErrLinkInactive   = errors.New("consumer: customer link is inactive or revoked")
)

type Repository struct{}

func (r *Repository) setSessionUser(ctx context.Context, tx database.DBTX, userID uuid.UUID) {
	if userID != uuid.Nil {
		var val string
		_ = tx.QueryRowContext(ctx, "SELECT set_config('app.user_id', $1, true)", userID.String()).Scan(&val)
	}
}

func (r *Repository) getProfile(ctx context.Context, tx database.DBTX, userID uuid.UUID) (*ConsumerProfileResponse, error) {
	r.setSessionUser(ctx, tx, userID)
	query := `
		SELECT id, user_id, status, preferences, created_at, updated_at
		FROM consumer.consumer_profiles
		WHERE user_id = $1`

	var out ConsumerProfileResponse
	var rawPrefs []byte
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, userID).Scan(
		&out.ID, &out.UserID, &out.Status, &rawPrefs, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("consumer.getProfile: %w", err)
	}

	out.CreatedAt = createdAt.Format(time.RFC3339)
	out.UpdatedAt = updatedAt.Format(time.RFC3339)
	out.Preferences = make(map[string]any)
	if len(rawPrefs) > 0 {
		_ = json.Unmarshal(rawPrefs, &out.Preferences)
	}
	return &out, nil
}

func (r *Repository) getProfileByID(ctx context.Context, tx database.DBTX, consumerID uuid.UUID) (*ConsumerProfileResponse, error) {
	query := `
		SELECT id, user_id, status, preferences, created_at, updated_at
		FROM consumer.consumer_profiles
		WHERE id = $1`

	var out ConsumerProfileResponse
	var rawPrefs []byte
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, consumerID).Scan(
		&out.ID, &out.UserID, &out.Status, &rawPrefs, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("consumer.getProfileByID: %w", err)
	}

	out.CreatedAt = createdAt.Format(time.RFC3339)
	out.UpdatedAt = updatedAt.Format(time.RFC3339)
	out.Preferences = make(map[string]any)
	if len(rawPrefs) > 0 {
		_ = json.Unmarshal(rawPrefs, &out.Preferences)
	}
	return &out, nil
}

func (r *Repository) getOrCreateProfile(ctx context.Context, tx database.DBTX, userID uuid.UUID) (*ConsumerProfileResponse, error) {
	p, err := r.getProfile(ctx, tx, userID)
	if err == nil {
		return p, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	return r.createProfile(ctx, tx, userID, []byte("{}"))
}

func (r *Repository) createProfile(ctx context.Context, tx database.DBTX, userID uuid.UUID, prefsJSON []byte) (*ConsumerProfileResponse, error) {
	r.setSessionUser(ctx, tx, userID)
	query := `
		INSERT INTO consumer.consumer_profiles (user_id, status, preferences)
		VALUES ($1, 'active', $2::jsonb)
		RETURNING id, user_id, status, preferences, created_at, updated_at`

	var out ConsumerProfileResponse
	var rawPrefs []byte
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, userID, prefsJSON).Scan(
		&out.ID, &out.UserID, &out.Status, &rawPrefs, &createdAt, &updatedAt,
	)
	if err != nil {
		var pqErr *pq.Error
		if (errors.As(err, &pqErr) && pqErr.Code == "23505") || strings.Contains(err.Error(), "23505") {
			return nil, ErrAlreadyExists
		}
		return nil, fmt.Errorf("consumer.createProfile: %w", err)
	}

	out.CreatedAt = createdAt.Format(time.RFC3339)
	out.UpdatedAt = updatedAt.Format(time.RFC3339)
	out.Preferences = make(map[string]any)
	if len(rawPrefs) > 0 {
		_ = json.Unmarshal(rawPrefs, &out.Preferences)
	}
	return &out, nil
}

func (r *Repository) updatePreferences(ctx context.Context, tx database.DBTX, userID uuid.UUID, prefsJSON []byte) (*ConsumerProfileResponse, error) {
	r.setSessionUser(ctx, tx, userID)
	query := `
		UPDATE consumer.consumer_profiles
		SET preferences = $2::jsonb, updated_at = clock_timestamp()
		WHERE user_id = $1
		RETURNING id, user_id, status, preferences, created_at, updated_at`

	var out ConsumerProfileResponse
	var rawPrefs []byte
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, userID, prefsJSON).Scan(
		&out.ID, &out.UserID, &out.Status, &rawPrefs, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("consumer.updatePreferences: %w", err)
	}

	out.CreatedAt = createdAt.Format(time.RFC3339)
	out.UpdatedAt = updatedAt.Format(time.RFC3339)
	out.Preferences = make(map[string]any)
	if len(rawPrefs) > 0 {
		_ = json.Unmarshal(rawPrefs, &out.Preferences)
	}
	return &out, nil
}

// Domain E: Membership Requests
func (r *Repository) CreateMembershipRequest(ctx context.Context, tx database.DBTX, consumerID, storeID uuid.UUID, customerPhone, notes string) (*MembershipRequestResponse, error) {
	// Look up store customer if phone was provided
	var storeCustomerID *uuid.UUID
	if customerPhone != "" {
		var matchedID uuid.UUID
		err := tx.QueryRowContext(ctx, `
			SELECT id FROM store.store_customers WHERE store_id = $1 AND phone = $2 LIMIT 1
		`, storeID, customerPhone).Scan(&matchedID)
		if err == nil {
			storeCustomerID = &matchedID
		}
	}

	query := `
		INSERT INTO consumer.membership_requests (consumer_id, store_id, store_customer_id, status, notes)
		VALUES ($1, $2, $3, 'pending', NULLIF($4, ''))
		RETURNING id, consumer_id, store_id, store_customer_id, status, COALESCE(notes, ''), reviewed_by, reviewed_at, created_at, updated_at`

	var mr MembershipRequestResponse
	var reviewedAt *time.Time
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, consumerID, storeID, storeCustomerID, notes).Scan(
		&mr.ID, &mr.ConsumerID, &mr.StoreID, &mr.StoreCustomerID, &mr.Status,
		&mr.Notes, &mr.ReviewedBy, &reviewedAt, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert membership request: %w", err)
	}
	mr.CreatedAt = createdAt.Format(time.RFC3339)
	mr.UpdatedAt = updatedAt.Format(time.RFC3339)
	if reviewedAt != nil {
		s := reviewedAt.Format(time.RFC3339)
		mr.ReviewedAt = &s
	}

	// Fetch store name
	_ = tx.QueryRowContext(ctx, "SELECT name FROM store.stores WHERE id = $1", storeID).Scan(&mr.StoreName)
	return &mr, nil
}

func (r *Repository) GetMembershipRequest(ctx context.Context, tx database.DBTX, requestID uuid.UUID) (*MembershipRequestResponse, error) {
	query := `
		SELECT mr.id, mr.consumer_id, mr.store_id, s.name, mr.store_customer_id,
		       COALESCE(sc.customer_number, ''), mr.status, COALESCE(mr.notes, ''),
		       mr.reviewed_by, mr.reviewed_at, mr.created_at, mr.updated_at
		FROM consumer.membership_requests mr
		JOIN store.stores s ON s.id = mr.store_id
		LEFT JOIN store.store_customers sc ON sc.id = mr.store_customer_id
		WHERE mr.id = $1`

	var mr MembershipRequestResponse
	var reviewedAt *time.Time
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, requestID).Scan(
		&mr.ID, &mr.ConsumerID, &mr.StoreID, &mr.StoreName, &mr.StoreCustomerID,
		&mr.CustomerNumber, &mr.Status, &mr.Notes, &mr.ReviewedBy, &reviewedAt, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get membership request: %w", err)
	}
	mr.CreatedAt = createdAt.Format(time.RFC3339)
	mr.UpdatedAt = updatedAt.Format(time.RFC3339)
	if reviewedAt != nil {
		s := reviewedAt.Format(time.RFC3339)
		mr.ReviewedAt = &s
	}
	return &mr, nil
}

func (r *Repository) ListConsumerMembershipRequests(ctx context.Context, tx database.DBTX, consumerID uuid.UUID) ([]MembershipRequestResponse, error) {
	query := `
		SELECT mr.id, mr.consumer_id, mr.store_id, s.name, mr.store_customer_id,
		       COALESCE(sc.customer_number, ''), mr.status, COALESCE(mr.notes, ''),
		       mr.reviewed_by, mr.reviewed_at, mr.created_at, mr.updated_at
		FROM consumer.membership_requests mr
		JOIN store.stores s ON s.id = mr.store_id
		LEFT JOIN store.store_customers sc ON sc.id = mr.store_customer_id
		WHERE mr.consumer_id = $1
		ORDER BY mr.created_at DESC`

	rows, err := tx.QueryContext(ctx, query, consumerID)
	if err != nil {
		return nil, fmt.Errorf("query consumer membership requests: %w", err)
	}
	defer rows.Close()

	var list []MembershipRequestResponse
	for rows.Next() {
		var mr MembershipRequestResponse
		var reviewedAt *time.Time
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&mr.ID, &mr.ConsumerID, &mr.StoreID, &mr.StoreName, &mr.StoreCustomerID,
			&mr.CustomerNumber, &mr.Status, &mr.Notes, &mr.ReviewedBy, &reviewedAt, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan membership request: %w", err)
		}
		mr.CreatedAt = createdAt.Format(time.RFC3339)
		mr.UpdatedAt = updatedAt.Format(time.RFC3339)
		if reviewedAt != nil {
			s := reviewedAt.Format(time.RFC3339)
			mr.ReviewedAt = &s
		}
		list = append(list, mr)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []MembershipRequestResponse{}
	}
	return list, nil
}

func (r *Repository) ListStoreMembershipRequests(ctx context.Context, tx database.DBTX, storeID uuid.UUID, status string) ([]MembershipRequestResponse, error) {
	query := `
		SELECT mr.id, mr.consumer_id, mr.store_id, s.name, mr.store_customer_id,
		       COALESCE(sc.customer_number, ''), mr.status, COALESCE(mr.notes, ''),
		       mr.reviewed_by, mr.reviewed_at, mr.created_at, mr.updated_at
		FROM consumer.membership_requests mr
		JOIN store.stores s ON s.id = mr.store_id
		LEFT JOIN store.store_customers sc ON sc.id = mr.store_customer_id
		WHERE mr.store_id = $1
		  AND ($2 = '' OR mr.status = $2)
		ORDER BY mr.created_at DESC`

	rows, err := tx.QueryContext(ctx, query, storeID, status)
	if err != nil {
		return nil, fmt.Errorf("query store membership requests: %w", err)
	}
	defer rows.Close()

	var list []MembershipRequestResponse
	for rows.Next() {
		var mr MembershipRequestResponse
		var reviewedAt *time.Time
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&mr.ID, &mr.ConsumerID, &mr.StoreID, &mr.StoreName, &mr.StoreCustomerID,
			&mr.CustomerNumber, &mr.Status, &mr.Notes, &mr.ReviewedBy, &reviewedAt, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan store membership request: %w", err)
		}
		mr.CreatedAt = createdAt.Format(time.RFC3339)
		mr.UpdatedAt = updatedAt.Format(time.RFC3339)
		if reviewedAt != nil {
			s := reviewedAt.Format(time.RFC3339)
			mr.ReviewedAt = &s
		}
		list = append(list, mr)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []MembershipRequestResponse{}
	}
	return list, nil
}

func (r *Repository) ReviewMembershipRequest(ctx context.Context, tx database.DBTX, requestID, reviewerUserID uuid.UUID, status string) (*MembershipRequestResponse, error) {
	query := `
		UPDATE consumer.membership_requests
		SET status = $1, reviewed_by = $2, reviewed_at = clock_timestamp(), updated_at = clock_timestamp()
		WHERE id = $3 AND status = 'pending'
		RETURNING id`

	var id uuid.UUID
	err := tx.QueryRowContext(ctx, query, status, reviewerUserID, requestID).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRequestClosed
		}
		return nil, fmt.Errorf("review membership request: %w", err)
	}

	return r.GetMembershipRequest(ctx, tx, requestID)
}

// Domain E: Customer Links
func (r *Repository) CreateCustomerLink(ctx context.Context, tx database.DBTX, consumerID, storeCustomerID uuid.UUID, accessFrom time.Time) (*CustomerLinkResponse, error) {
	query := `
		INSERT INTO consumer.customer_links (consumer_id, store_customer_id, status, verified_at, access_from)
		VALUES ($1, $2, 'active', clock_timestamp(), $3)
		ON CONFLICT (consumer_id, store_customer_id)
		DO UPDATE SET status = 'active', access_from = EXCLUDED.access_from, updated_at = clock_timestamp()
		RETURNING id, consumer_id, store_customer_id, status, verified_at, access_from, created_at, updated_at`

	var cl CustomerLinkResponse
	var verifiedAt, accessFromTime, createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, consumerID, storeCustomerID, accessFrom).Scan(
		&cl.ID, &cl.ConsumerID, &cl.StoreCustomerID, &cl.Status,
		&verifiedAt, &accessFromTime, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert customer link: %w", err)
	}
	cl.VerifiedAt = verifiedAt.Format(time.RFC3339)
	cl.AccessFrom = accessFromTime.Format(time.RFC3339)
	cl.CreatedAt = createdAt.Format(time.RFC3339)
	cl.UpdatedAt = updatedAt.Format(time.RFC3339)

	// Fetch store & customer details
	_ = tx.QueryRowContext(ctx, `
		SELECT sc.store_id, s.name, sc.customer_number, sc.display_name
		FROM store.store_customers sc
		JOIN store.stores s ON s.id = sc.store_id
		WHERE sc.id = $1
	`, storeCustomerID).Scan(&cl.StoreID, &cl.StoreName, &cl.CustomerNumber, &cl.CustomerDisplayName)

	return &cl, nil
}

func (r *Repository) ListConsumerCustomerLinks(ctx context.Context, tx database.DBTX, consumerID uuid.UUID) ([]CustomerLinkResponse, error) {
	query := `
		SELECT cl.id, cl.consumer_id, sc.store_id, s.name, cl.store_customer_id,
		       sc.customer_number, sc.display_name, cl.status,
		       cl.verified_at, cl.access_from, cl.created_at, cl.updated_at
		FROM consumer.customer_links cl
		JOIN store.store_customers sc ON sc.id = cl.store_customer_id
		JOIN store.stores s ON s.id = sc.store_id
		WHERE cl.consumer_id = $1
		ORDER BY cl.created_at DESC`

	rows, err := tx.QueryContext(ctx, query, consumerID)
	if err != nil {
		return nil, fmt.Errorf("query consumer customer links: %w", err)
	}
	defer rows.Close()

	var list []CustomerLinkResponse
	for rows.Next() {
		var cl CustomerLinkResponse
		var verifiedAt, accessFromTime, createdAt, updatedAt time.Time
		if err := rows.Scan(
			&cl.ID, &cl.ConsumerID, &cl.StoreID, &cl.StoreName, &cl.StoreCustomerID,
			&cl.CustomerNumber, &cl.CustomerDisplayName, &cl.Status,
			&verifiedAt, &accessFromTime, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan customer link: %w", err)
		}
		cl.VerifiedAt = verifiedAt.Format(time.RFC3339)
		cl.AccessFrom = accessFromTime.Format(time.RFC3339)
		cl.CreatedAt = createdAt.Format(time.RFC3339)
		cl.UpdatedAt = updatedAt.Format(time.RFC3339)
		list = append(list, cl)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []CustomerLinkResponse{}
	}
	return list, nil
}

func (r *Repository) RevokeCustomerLink(ctx context.Context, tx database.DBTX, linkID, consumerID uuid.UUID) error {
	query := `
		UPDATE consumer.customer_links
		SET status = 'revoked', updated_at = clock_timestamp()
		WHERE id = $1 AND consumer_id = $2`

	res, err := tx.ExecContext(ctx, query, linkID, consumerID)
	if err != nil {
		return fmt.Errorf("revoke customer link: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) ListStoreCustomerLinks(ctx context.Context, tx database.DBTX, storeID uuid.UUID) ([]CustomerLinkResponse, error) {
	query := `
		SELECT cl.id, cl.consumer_id, sc.store_id, s.name, cl.store_customer_id,
		       sc.customer_number, sc.display_name, cl.status,
		       cl.verified_at, cl.access_from, cl.created_at, cl.updated_at
		FROM consumer.customer_links cl
		JOIN store.store_customers sc ON sc.id = cl.store_customer_id
		JOIN store.stores s ON s.id = sc.store_id
		WHERE sc.store_id = $1
		ORDER BY cl.created_at DESC`

	rows, err := tx.QueryContext(ctx, query, storeID)
	if err != nil {
		return nil, fmt.Errorf("query store customer links: %w", err)
	}
	defer rows.Close()

	var list []CustomerLinkResponse
	for rows.Next() {
		var cl CustomerLinkResponse
		var verifiedAt, accessFromTime, createdAt, updatedAt time.Time
		if err := rows.Scan(
			&cl.ID, &cl.ConsumerID, &cl.StoreID, &cl.StoreName, &cl.StoreCustomerID,
			&cl.CustomerNumber, &cl.CustomerDisplayName, &cl.Status,
			&verifiedAt, &accessFromTime, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan store customer link: %w", err)
		}
		cl.VerifiedAt = verifiedAt.Format(time.RFC3339)
		cl.AccessFrom = accessFromTime.Format(time.RFC3339)
		cl.CreatedAt = createdAt.Format(time.RFC3339)
		cl.UpdatedAt = updatedAt.Format(time.RFC3339)
		list = append(list, cl)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []CustomerLinkResponse{}
	}
	return list, nil
}

// Domain E: Expense Categories
func (r *Repository) CreateExpenseCategory(ctx context.Context, tx database.DBTX, consumerID uuid.UUID, name string, parentID *uuid.UUID, color, icon string) (*ExpenseCategoryResponse, error) {
	query := `
		INSERT INTO consumer.expense_categories (consumer_id, name, parent_id, color, icon)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''))
		RETURNING id, consumer_id, name, parent_id, COALESCE(color, ''), COALESCE(icon, ''), created_at, updated_at`

	var cat ExpenseCategoryResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, consumerID, name, parentID, color, icon).Scan(
		&cat.ID, &cat.ConsumerID, &cat.Name, &cat.ParentID, &cat.Color, &cat.Icon, &createdAt, &updatedAt,
	)
	if err != nil {
		var pqErr *pq.Error
		if (errors.As(err, &pqErr) && pqErr.Code == "23505") || strings.Contains(err.Error(), "23505") {
			return nil, ErrAlreadyExists
		}
		return nil, fmt.Errorf("insert expense category: %w", err)
	}
	cat.CreatedAt = createdAt.Format(time.RFC3339)
	cat.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &cat, nil
}

func (r *Repository) ListExpenseCategories(ctx context.Context, tx database.DBTX, consumerID uuid.UUID) ([]ExpenseCategoryResponse, error) {
	query := `
		SELECT id, consumer_id, name, parent_id, COALESCE(color, ''), COALESCE(icon, ''), created_at, updated_at
		FROM consumer.expense_categories
		WHERE consumer_id = $1
		ORDER BY name ASC`

	rows, err := tx.QueryContext(ctx, query, consumerID)
	if err != nil {
		return nil, fmt.Errorf("query expense categories: %w", err)
	}
	defer rows.Close()

	var list []ExpenseCategoryResponse
	for rows.Next() {
		var cat ExpenseCategoryResponse
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&cat.ID, &cat.ConsumerID, &cat.Name, &cat.ParentID, &cat.Color, &cat.Icon, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan expense category: %w", err)
		}
		cat.CreatedAt = createdAt.Format(time.RFC3339)
		cat.UpdatedAt = updatedAt.Format(time.RFC3339)
		list = append(list, cat)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []ExpenseCategoryResponse{}
	}
	return list, nil
}

func (r *Repository) UpdateExpenseCategory(ctx context.Context, tx database.DBTX, consumerID, categoryID uuid.UUID, name string, parentID *uuid.UUID, color, icon string) (*ExpenseCategoryResponse, error) {
	query := `
		UPDATE consumer.expense_categories
		SET name = COALESCE(NULLIF($1, ''), name),
		    parent_id = $2,
		    color = NULLIF($3, ''),
		    icon = NULLIF($4, ''),
		    updated_at = clock_timestamp()
		WHERE consumer_id = $5 AND id = $6
		RETURNING id, consumer_id, name, parent_id, COALESCE(color, ''), COALESCE(icon, ''), created_at, updated_at`

	var cat ExpenseCategoryResponse
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, name, parentID, color, icon, consumerID, categoryID).Scan(
		&cat.ID, &cat.ConsumerID, &cat.Name, &cat.ParentID, &cat.Color, &cat.Icon, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update expense category: %w", err)
	}
	cat.CreatedAt = createdAt.Format(time.RFC3339)
	cat.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &cat, nil
}

func (r *Repository) DeleteExpenseCategory(ctx context.Context, tx database.DBTX, consumerID, categoryID uuid.UUID) error {
	query := `DELETE FROM consumer.expense_categories WHERE consumer_id = $1 AND id = $2`
	res, err := tx.ExecContext(ctx, query, consumerID, categoryID)
	if err != nil {
		return fmt.Errorf("delete expense category: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// Domain E: Expense Entries
func (r *Repository) CreateExpenseEntry(
	ctx context.Context, tx database.DBTX, consumerID uuid.UUID,
	invoiceID, storeID, categoryID *uuid.UUID,
	amount float64, currency, sourceType, entryDate, description string,
) (*ExpenseEntryResponse, error) {
	if currency == "" {
		currency = "BDT"
	}
	if sourceType == "" {
		if invoiceID != nil {
			sourceType = "invoice"
		} else {
			sourceType = "manual"
		}
	}
	if entryDate == "" {
		entryDate = time.Now().UTC().Format("2006-01-02")
	}

	query := `
		INSERT INTO consumer.expense_entries (
			consumer_id, invoice_id, store_id, category_id,
			amount, currency, source_type, entry_date, description
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9)
		RETURNING id, consumer_id, invoice_id, store_id, category_id,
		          amount, currency, source_type, entry_date, description, created_at, updated_at`

	var ee ExpenseEntryResponse
	var eDate, createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query,
		consumerID, invoiceID, storeID, categoryID,
		amount, currency, sourceType, entryDate, description,
	).Scan(
		&ee.ID, &ee.ConsumerID, &ee.InvoiceID, &ee.StoreID, &ee.CategoryID,
		&ee.Amount, &ee.Currency, &ee.SourceType, &eDate, &ee.Description, &createdAt, &updatedAt,
	)
	if err != nil {
		var pqErr *pq.Error
		if (errors.As(err, &pqErr) && pqErr.Code == "23505") || strings.Contains(err.Error(), "23505") {
			return nil, ErrDuplicateClaim
		}
		return nil, fmt.Errorf("insert expense entry: %w", err)
	}
	ee.EntryDate = eDate.Format("2006-01-02")
	ee.CreatedAt = createdAt.Format(time.RFC3339)
	ee.UpdatedAt = updatedAt.Format(time.RFC3339)
	ee.AdjustedAmount = ee.Amount

	return r.GetExpenseEntry(ctx, tx, consumerID, ee.ID)
}

func (r *Repository) GetExpenseEntry(ctx context.Context, tx database.DBTX, consumerID, expenseID uuid.UUID) (*ExpenseEntryResponse, error) {
	query := `
		SELECT ee.id, ee.consumer_id, ee.invoice_id, COALESCE(i.invoice_number, ''),
		       ee.store_id, COALESCE(s.name, ''), ee.category_id, COALESCE(ec.name, ''),
		       ee.amount, ee.currency, ee.source_type, ee.entry_date, ee.description,
		       (ee.amount + COALESCE((SELECT SUM(amount_delta) FROM consumer.expense_adjustments WHERE expense_entry_id = ee.id), 0)) AS adjusted_amount,
		       ee.created_at, ee.updated_at
		FROM consumer.expense_entries ee
		LEFT JOIN invoice.invoices i ON i.id = ee.invoice_id
		LEFT JOIN store.stores s ON s.id = ee.store_id
		LEFT JOIN consumer.expense_categories ec ON ec.id = ee.category_id
		WHERE ee.consumer_id = $1 AND ee.id = $2`

	var ee ExpenseEntryResponse
	var eDate, createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, consumerID, expenseID).Scan(
		&ee.ID, &ee.ConsumerID, &ee.InvoiceID, &ee.InvoiceNumber,
		&ee.StoreID, &ee.StoreName, &ee.CategoryID, &ee.CategoryName,
		&ee.Amount, &ee.Currency, &ee.SourceType, &eDate, &ee.Description,
		&ee.AdjustedAmount, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get expense entry: %w", err)
	}
	ee.EntryDate = eDate.Format("2006-01-02")
	ee.CreatedAt = createdAt.Format(time.RFC3339)
	ee.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ee, nil
}

func (r *Repository) ListExpenseEntries(ctx context.Context, tx database.DBTX, consumerID uuid.UUID, categoryID *uuid.UUID, startDate, endDate string) ([]ExpenseEntryResponse, error) {
	query := `
		SELECT ee.id, ee.consumer_id, ee.invoice_id, COALESCE(i.invoice_number, ''),
		       ee.store_id, COALESCE(s.name, ''), ee.category_id, COALESCE(ec.name, ''),
		       ee.amount, ee.currency, ee.source_type, ee.entry_date, ee.description,
		       (ee.amount + COALESCE((SELECT SUM(amount_delta) FROM consumer.expense_adjustments WHERE expense_entry_id = ee.id), 0)) AS adjusted_amount,
		       ee.created_at, ee.updated_at
		FROM consumer.expense_entries ee
		LEFT JOIN invoice.invoices i ON i.id = ee.invoice_id
		LEFT JOIN store.stores s ON s.id = ee.store_id
		LEFT JOIN consumer.expense_categories ec ON ec.id = ee.category_id
		WHERE ee.consumer_id = $1
		  AND ($2::uuid IS NULL OR ee.category_id = $2)
		  AND ($3 = '' OR ee.entry_date >= $3::date)
		  AND ($4 = '' OR ee.entry_date <= $4::date)
		ORDER BY ee.entry_date DESC, ee.created_at DESC`

	rows, err := tx.QueryContext(ctx, query, consumerID, categoryID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("query expense entries: %w", err)
	}
	defer rows.Close()

	var list []ExpenseEntryResponse
	for rows.Next() {
		var ee ExpenseEntryResponse
		var eDate, createdAt, updatedAt time.Time
		if err := rows.Scan(
			&ee.ID, &ee.ConsumerID, &ee.InvoiceID, &ee.InvoiceNumber,
			&ee.StoreID, &ee.StoreName, &ee.CategoryID, &ee.CategoryName,
			&ee.Amount, &ee.Currency, &ee.SourceType, &eDate, &ee.Description,
			&ee.AdjustedAmount, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan expense entry: %w", err)
		}
		ee.EntryDate = eDate.Format("2006-01-02")
		ee.CreatedAt = createdAt.Format(time.RFC3339)
		ee.UpdatedAt = updatedAt.Format(time.RFC3339)
		list = append(list, ee)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []ExpenseEntryResponse{}
	}
	return list, nil
}

func (r *Repository) UpdateExpenseEntry(ctx context.Context, tx database.DBTX, consumerID, expenseID uuid.UUID, categoryID *uuid.UUID, amount *float64, entryDate, description string) (*ExpenseEntryResponse, error) {
	existing, err := r.GetExpenseEntry(ctx, tx, consumerID, expenseID)
	if err != nil {
		return nil, err
	}

	targetCat := existing.CategoryID
	if categoryID != nil {
		targetCat = categoryID
	}
	targetAmount := existing.Amount
	if amount != nil {
		targetAmount = *amount
	}
	targetDate := existing.EntryDate
	if entryDate != "" {
		targetDate = entryDate
	}
	targetDesc := existing.Description
	if description != "" {
		targetDesc = description
	}

	query := `
		UPDATE consumer.expense_entries
		SET category_id = $1, amount = $2, entry_date = $3::date, description = $4, updated_at = clock_timestamp()
		WHERE consumer_id = $5 AND id = $6`

	_, err = tx.ExecContext(ctx, query, targetCat, targetAmount, targetDate, targetDesc, consumerID, expenseID)
	if err != nil {
		return nil, fmt.Errorf("update expense entry: %w", err)
	}

	return r.GetExpenseEntry(ctx, tx, consumerID, expenseID)
}

func (r *Repository) DeleteExpenseEntry(ctx context.Context, tx database.DBTX, consumerID, expenseID uuid.UUID) error {
	query := `DELETE FROM consumer.expense_entries WHERE consumer_id = $1 AND id = $2`
	res, err := tx.ExecContext(ctx, query, consumerID, expenseID)
	if err != nil {
		return fmt.Errorf("delete expense entry: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// Domain E: Expense Adjustments
func (r *Repository) CreateExpenseAdjustment(ctx context.Context, tx database.DBTX, expenseID uuid.UUID, amountDelta float64, reason string, userID uuid.UUID) (*ExpenseAdjustmentResponse, error) {
	query := `
		INSERT INTO consumer.expense_adjustments (expense_entry_id, amount_delta, reason, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, expense_entry_id, amount_delta, reason, created_by, created_at`

	var adj ExpenseAdjustmentResponse
	var createdAt time.Time
	err := tx.QueryRowContext(ctx, query, expenseID, amountDelta, reason, userID).Scan(
		&adj.ID, &adj.ExpenseEntryID, &adj.AmountDelta, &adj.Reason, &adj.CreatedBy, &createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert expense adjustment: %w", err)
	}
	adj.CreatedAt = createdAt.Format(time.RFC3339)
	return &adj, nil
}

func (r *Repository) ListExpenseAdjustments(ctx context.Context, tx database.DBTX, expenseID uuid.UUID) ([]ExpenseAdjustmentResponse, error) {
	query := `
		SELECT id, expense_entry_id, amount_delta, reason, created_by, created_at
		FROM consumer.expense_adjustments
		WHERE expense_entry_id = $1
		ORDER BY created_at ASC`

	rows, err := tx.QueryContext(ctx, query, expenseID)
	if err != nil {
		return nil, fmt.Errorf("query expense adjustments: %w", err)
	}
	defer rows.Close()

	var list []ExpenseAdjustmentResponse
	for rows.Next() {
		var adj ExpenseAdjustmentResponse
		var createdAt time.Time
		if err := rows.Scan(
			&adj.ID, &adj.ExpenseEntryID, &adj.AmountDelta, &adj.Reason, &adj.CreatedBy, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan expense adjustment: %w", err)
		}
		adj.CreatedAt = createdAt.Format(time.RFC3339)
		list = append(list, adj)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []ExpenseAdjustmentResponse{}
	}
	return list, nil
}

// Domain E: Cross-Store Consumer Invoices Discovery & Access
func (r *Repository) ListConsumerInvoices(ctx context.Context, tx database.DBTX, consumerID uuid.UUID) ([]ConsumerInvoiceResponse, error) {
	query := `
		SELECT i.id, i.store_id, s.name, i.store_customer_id,
		       i.invoice_number, i.lifecycle_status, i.subtotal, i.discount_amount,
		       i.tax_amount, i.total_amount, i.paid_amount, i.currency, COALESCE(i.notes, ''),
		       i.invoice_date, i.due_date, i.issued_at,
		       COALESCE(id.decision, ''), COALESCE(id.notes, ''),
		       EXISTS(SELECT 1 FROM consumer.expense_entries ee WHERE ee.consumer_id = $1 AND ee.invoice_id = i.id) AS is_claimed,
		       i.created_at
		FROM invoice.invoices i
		JOIN consumer.customer_links cl ON cl.store_customer_id = i.store_customer_id 
		                               AND cl.consumer_id = $1 
		                               AND cl.status = 'active'
		JOIN store.stores s ON s.id = i.store_id
		LEFT JOIN invoice.invoice_decisions id ON id.invoice_id = i.id AND id.consumer_id = $1
		WHERE i.invoice_date >= cl.access_from::date
		  AND i.lifecycle_status IN ('issued', 'paid', 'partially_paid', 'voided')
		ORDER BY i.invoice_date DESC, i.created_at DESC`

	rows, err := tx.QueryContext(ctx, query, consumerID)
	if err != nil {
		return nil, fmt.Errorf("query consumer invoices: %w", err)
	}
	defer rows.Close()

	var list []ConsumerInvoiceResponse
	for rows.Next() {
		var inv ConsumerInvoiceResponse
		var invDate time.Time
		var dueDate, issuedAt *time.Time
		var createdAt time.Time
		if err := rows.Scan(
			&inv.ID, &inv.StoreID, &inv.StoreName, &inv.StoreCustomerID,
			&inv.InvoiceNumber, &inv.LifecycleStatus, &inv.Subtotal, &inv.DiscountAmount,
			&inv.TaxAmount, &inv.TotalAmount, &inv.PaidAmount, &inv.Currency, &inv.Notes,
			&invDate, &dueDate, &issuedAt,
			&inv.Decision, &inv.DecisionNotes, &inv.IsClaimedAsExpense, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan consumer invoice: %w", err)
		}
		inv.InvoiceDate = invDate.Format("2006-01-02")
		if dueDate != nil {
			s := dueDate.Format("2006-01-02")
			inv.DueDate = &s
		}
		if issuedAt != nil {
			s := issuedAt.Format(time.RFC3339)
			inv.IssuedAt = &s
		}
		inv.CreatedAt = createdAt.Format(time.RFC3339)
		list = append(list, inv)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []ConsumerInvoiceResponse{}
	}
	return list, nil
}

func (r *Repository) GetConsumerInvoice(ctx context.Context, tx database.DBTX, consumerID, invoiceID uuid.UUID) (*ConsumerInvoiceResponse, error) {
	query := `
		SELECT i.id, i.store_id, s.name, i.store_customer_id,
		       i.invoice_number, i.lifecycle_status, i.subtotal, i.discount_amount,
		       i.tax_amount, i.total_amount, i.paid_amount, i.currency, COALESCE(i.notes, ''),
		       i.invoice_date, i.due_date, i.issued_at,
		       COALESCE(id.decision, ''), COALESCE(id.notes, ''),
		       EXISTS(SELECT 1 FROM consumer.expense_entries ee WHERE ee.consumer_id = $1 AND ee.invoice_id = i.id) AS is_claimed,
		       i.created_at
		FROM invoice.invoices i
		JOIN consumer.customer_links cl ON cl.store_customer_id = i.store_customer_id 
		                               AND cl.consumer_id = $1 
		                               AND cl.status = 'active'
		JOIN store.stores s ON s.id = i.store_id
		LEFT JOIN invoice.invoice_decisions id ON id.invoice_id = i.id AND id.consumer_id = $1
		WHERE i.id = $2
		  AND i.invoice_date >= cl.access_from::date
		  AND i.lifecycle_status IN ('issued', 'paid', 'partially_paid', 'voided')`

	var inv ConsumerInvoiceResponse
	var invDate time.Time
	var dueDate, issuedAt *time.Time
	var createdAt time.Time
	err := tx.QueryRowContext(ctx, query, consumerID, invoiceID).Scan(
		&inv.ID, &inv.StoreID, &inv.StoreName, &inv.StoreCustomerID,
		&inv.InvoiceNumber, &inv.LifecycleStatus, &inv.Subtotal, &inv.DiscountAmount,
		&inv.TaxAmount, &inv.TotalAmount, &inv.PaidAmount, &inv.Currency, &inv.Notes,
		&invDate, &dueDate, &issuedAt,
		&inv.Decision, &inv.DecisionNotes, &inv.IsClaimedAsExpense, &createdAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get consumer invoice: %w", err)
	}
	inv.InvoiceDate = invDate.Format("2006-01-02")
	if dueDate != nil {
		s := dueDate.Format("2006-01-02")
		inv.DueDate = &s
	}
	if issuedAt != nil {
		s := issuedAt.Format(time.RFC3339)
		inv.IssuedAt = &s
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)

	// Fetch line item snapshots
	itemQuery := `
		SELECT id, description_snapshot, COALESCE(sku_snapshot, ''),
		       quantity, unit_price, discount_amount, tax_amount, line_total
		FROM invoice.invoice_items
		WHERE invoice_id = $1
		ORDER BY created_at ASC`
	rows, err := tx.QueryContext(ctx, itemQuery, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("query consumer invoice items: %w", err)
	}
	defer rows.Close()

	var items []ConsumerInvoiceItemResponse
	for rows.Next() {
		var itm ConsumerInvoiceItemResponse
		if err := rows.Scan(
			&itm.ID, &itm.DescriptionSnapshot, &itm.SKUSnapshot,
			&itm.Quantity, &itm.UnitPrice, &itm.DiscountAmount, &itm.TaxAmount, &itm.LineTotal,
		); err != nil {
			return nil, fmt.Errorf("scan consumer invoice item: %w", err)
		}
		items = append(items, itm)
	}
	if items == nil {
		items = []ConsumerInvoiceItemResponse{}
	}
	inv.Items = items

	return &inv, nil
}

func (r *Repository) RecordConsumerInvoiceDecision(ctx context.Context, tx database.DBTX, consumerID, invoiceID uuid.UUID, decision, notes string) error {
	query := `
		INSERT INTO invoice.invoice_decisions (invoice_id, consumer_id, decision, notes, decided_at)
		VALUES ($1, $2, $3, NULLIF($4, ''), clock_timestamp())
		ON CONFLICT (invoice_id, consumer_id)
		DO UPDATE SET decision = EXCLUDED.decision, notes = EXCLUDED.notes, decided_at = clock_timestamp()`

	_, err := tx.ExecContext(ctx, query, invoiceID, consumerID, decision, notes)
	if err != nil {
		return fmt.Errorf("record invoice decision: %w", err)
	}

	// Record in invoice events audit trail
	eventMeta, _ := json.Marshal(map[string]any{
		"consumer_id": consumerID,
		"decision":    decision,
		"notes":       notes,
	})
	_, _ = tx.ExecContext(ctx, `
		INSERT INTO invoice.invoice_events (invoice_id, event_type, metadata)
		VALUES ($1, 'consumer_decision', $2)
	`, invoiceID, eventMeta)

	return nil
}
