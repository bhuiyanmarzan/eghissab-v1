package invoice

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
)

var (
	ErrNotFound      = errors.New("invoice: resource not found")
	ErrForbidden     = errors.New("invoice: access forbidden")
	ErrAlreadyIssued = errors.New("invoice: invoice is already issued and line items cannot be modified")
	ErrNotIssued     = errors.New("invoice: invoice must be in issued status to perform this action")
	ErrAlreadyVoided = errors.New("invoice: invoice is already voided")
	ErrAlreadyPaid   = errors.New("invoice: invoice is already fully paid")
	ErrOverpayment   = errors.New("invoice: payment amount exceeds remaining invoice balance")
	ErrConflict      = errors.New("invoice: conflict or concurrent update")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// GenerateNextInvoiceNumber atomically fetches and increments the store invoice counter
func (r *Repository) GenerateNextInvoiceNumber(ctx context.Context, tx database.DBTX, storeID uuid.UUID) (string, error) {
	query := `
		UPDATE store.store_settings
		SET invoice_preferences = jsonb_set(
			invoice_preferences,
			'{next_number}',
			to_jsonb(COALESCE((invoice_preferences->>'next_number')::int, 1001) + 1)
		),
		updated_at = clock_timestamp()
		WHERE store_id = $1
		RETURNING COALESCE(invoice_preferences->>'prefix', 'INV'), COALESCE((invoice_preferences->>'next_number')::int, 1001) - 1`

	var prefix string
	var currentNum int
	err := tx.QueryRowContext(ctx, query, storeID).Scan(&prefix, &currentNum)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Fallback: count existing store invoices
			var count int
			_ = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM invoice.invoices WHERE store_id = $1", storeID).Scan(&count)
			return fmt.Sprintf("INV-%06d", count+1), nil
		}
		return "", fmt.Errorf("generate invoice number: %w", err)
	}

	return fmt.Sprintf("%s-%06d", prefix, currentNum), nil
}

// GenerateNextAdjustmentNumber atomically creates sequential adjustment numbers
func (r *Repository) GenerateNextAdjustmentNumber(ctx context.Context, tx database.DBTX, invoiceID uuid.UUID, adjType string) (string, error) {
	prefix := "ADJ"
	if adjType == "credit_note" {
		prefix = "CN"
	} else if adjType == "debit_note" {
		prefix = "DN"
	}

	var count int
	err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM invoice.invoice_adjustments WHERE invoice_id = $1", invoiceID).Scan(&count)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%04d", prefix, count+1), nil
}

// CalculateTotals computes financial summary from items
func CalculateTotals(items []InvoiceItemInput) (subtotal, discount, tax, total float64, calculatedItems []InvoiceItemInput) {
	calculatedItems = make([]InvoiceItemInput, len(items))
	for i, item := range items {
		gross := item.Quantity * item.UnitPrice
		itemDiscount := item.DiscountAmount
		net := gross - itemDiscount
		if net < 0 {
			net = 0
		}
		itemTax := item.TaxAmount
		if itemTax == 0 && item.TaxRate > 0 {
			itemTax = math.Round((net*item.TaxRate/100.0)*100) / 100
		}
		lineTotal := net + itemTax

		item.TaxAmount = itemTax
		item.LineTotal = lineTotal
		calculatedItems[i] = item

		subtotal += gross
		discount += itemDiscount
		tax += itemTax
		total += lineTotal
	}
	subtotal = math.Round(subtotal*100) / 100
	discount = math.Round(discount*100) / 100
	tax = math.Round(tax*100) / 100
	total = math.Round(total*100) / 100
	return
}

func (r *Repository) CreateInvoiceDraft(ctx context.Context, tx database.DBTX, storeID, creatorUserID uuid.UUID, req CreateInvoiceRequest) (*InvoiceResponse, error) {
	subtotal, discount, tax, total, calcItems := CalculateTotals(req.Items)

	currency := req.Currency
	if currency == "" {
		currency = "BDT"
	}
	invoiceDate := req.InvoiceDate
	if invoiceDate == "" {
		invoiceDate = time.Now().UTC().Format("2006-01-02")
	}

	draftNumber := fmt.Sprintf("DRAFT-%s", uuid.New().String()[:8])

	insertInvoiceQuery := `
		INSERT INTO invoice.invoices (
			store_id, store_customer_id, invoice_number, lifecycle_status,
			subtotal, discount_amount, tax_amount, total_amount, paid_amount,
			currency, notes, invoice_date, due_date, created_by
		) VALUES (
			$1, $2, $3, 'draft',
			$4, $5, $6, $7, 0,
			$8, NULLIF($9, ''), $10::date, $11::date, $12
		)
		RETURNING id, store_id, store_customer_id, invoice_number, lifecycle_status,
		          subtotal, discount_amount, tax_amount, total_amount, paid_amount,
		          currency, COALESCE(notes, ''), invoice_date, due_date, issued_at,
		          created_by, created_at, updated_at`

	var inv InvoiceResponse
	var invDate time.Time
	var dueDate, issuedAt *time.Time
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, insertInvoiceQuery,
		storeID, req.StoreCustomerID, draftNumber,
		subtotal, discount, tax, total,
		currency, req.Notes, invoiceDate, req.DueDate, creatorUserID,
	).Scan(
		&inv.ID, &inv.StoreID, &inv.StoreCustomerID, &inv.InvoiceNumber, &inv.LifecycleStatus,
		&inv.Subtotal, &inv.DiscountAmount, &inv.TaxAmount, &inv.TotalAmount, &inv.PaidAmount,
		&inv.Currency, &inv.Notes, &invDate, &dueDate, &issuedAt,
		&inv.CreatedBy, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert invoice draft: %w", err)
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
	inv.UpdatedAt = updatedAt.Format(time.RFC3339)

	// Insert line items
	insertItemQuery := `
		INSERT INTO invoice.invoice_items (
			store_id, invoice_id, product_id, description_snapshot, sku_snapshot,
			quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total
		) VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8, $9, $10, $11)
		RETURNING id, store_id, invoice_id, product_id, description_snapshot, COALESCE(sku_snapshot, ''),
		          quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total, created_at`

	var items []InvoiceItemResponse
	for _, itm := range calcItems {
		var itemRes InvoiceItemResponse
		var itmCreatedAt time.Time
		err := tx.QueryRowContext(ctx, insertItemQuery,
			storeID, inv.ID, itm.ProductID, itm.DescriptionSnapshot, itm.SKUSnapshot,
			itm.Quantity, itm.UnitPrice, itm.DiscountAmount, itm.TaxRate, itm.TaxAmount, itm.LineTotal,
		).Scan(
			&itemRes.ID, &itemRes.StoreID, &itemRes.InvoiceID, &itemRes.ProductID,
			&itemRes.DescriptionSnapshot, &itemRes.SKUSnapshot, &itemRes.Quantity,
			&itemRes.UnitPrice, &itemRes.DiscountAmount, &itemRes.TaxRate, &itemRes.TaxAmount,
			&itemRes.LineTotal, &itmCreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("insert line item: %w", err)
		}
		itemRes.CreatedAt = itmCreatedAt.Format(time.RFC3339)
		items = append(items, itemRes)
	}
	inv.Items = items

	// Log audit event
	_ = r.RecordInvoiceEvent(ctx, tx, inv.ID, &creatorUserID, "draft_created", map[string]any{
		"invoice_id":   inv.ID,
		"total_amount": inv.TotalAmount,
		"items_count":  len(items),
	})

	return &inv, nil
}

func (r *Repository) GetInvoice(ctx context.Context, tx database.DBTX, storeID, invoiceID uuid.UUID) (*InvoiceResponse, error) {
	query := `
		SELECT i.id, i.store_id, i.store_customer_id, COALESCE(c.display_name, ''),
		       i.invoice_number, i.lifecycle_status, i.subtotal, i.discount_amount,
		       i.tax_amount, i.total_amount, i.paid_amount, i.currency, COALESCE(i.notes, ''),
		       i.invoice_date, i.due_date, i.issued_at, i.created_by, i.created_at, i.updated_at
		FROM invoice.invoices i
		LEFT JOIN store.store_customers c ON c.id = i.store_customer_id
		WHERE i.store_id = $1 AND i.id = $2`

	var inv InvoiceResponse
	var invDate time.Time
	var dueDate, issuedAt *time.Time
	var createdAt, updatedAt time.Time
	err := tx.QueryRowContext(ctx, query, storeID, invoiceID).Scan(
		&inv.ID, &inv.StoreID, &inv.StoreCustomerID, &inv.CustomerName,
		&inv.InvoiceNumber, &inv.LifecycleStatus, &inv.Subtotal, &inv.DiscountAmount,
		&inv.TaxAmount, &inv.TotalAmount, &inv.PaidAmount, &inv.Currency, &inv.Notes,
		&invDate, &dueDate, &issuedAt, &inv.CreatedBy, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get invoice: %w", err)
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
	inv.UpdatedAt = updatedAt.Format(time.RFC3339)

	// Fetch items
	items, err := r.ListInvoiceItems(ctx, tx, inv.ID)
	if err != nil {
		return nil, err
	}
	inv.Items = items

	return &inv, nil
}

func (r *Repository) ListInvoiceItems(ctx context.Context, tx database.DBTX, invoiceID uuid.UUID) ([]InvoiceItemResponse, error) {
	query := `
		SELECT id, store_id, invoice_id, product_id, description_snapshot, COALESCE(sku_snapshot, ''),
		       quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total, created_at
		FROM invoice.invoice_items
		WHERE invoice_id = $1
		ORDER BY created_at ASC`

	rows, err := tx.QueryContext(ctx, query, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("query invoice items: %w", err)
	}
	defer rows.Close()

	var items []InvoiceItemResponse
	for rows.Next() {
		var item InvoiceItemResponse
		var createdAt time.Time
		if err := rows.Scan(
			&item.ID, &item.StoreID, &item.InvoiceID, &item.ProductID,
			&item.DescriptionSnapshot, &item.SKUSnapshot, &item.Quantity,
			&item.UnitPrice, &item.DiscountAmount, &item.TaxRate, &item.TaxAmount,
			&item.LineTotal, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan invoice item: %w", err)
		}
		item.CreatedAt = createdAt.Format(time.RFC3339)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if items == nil {
		items = []InvoiceItemResponse{}
	}
	return items, nil
}

func (r *Repository) ListInvoices(ctx context.Context, tx database.DBTX, storeID uuid.UUID, customerID *uuid.UUID, status string) ([]InvoiceResponse, error) {
	query := `
		SELECT i.id, i.store_id, i.store_customer_id, COALESCE(c.display_name, ''),
		       i.invoice_number, i.lifecycle_status, i.subtotal, i.discount_amount,
		       i.tax_amount, i.total_amount, i.paid_amount, i.currency, COALESCE(i.notes, ''),
		       i.invoice_date, i.due_date, i.issued_at, i.created_by, i.created_at, i.updated_at
		FROM invoice.invoices i
		LEFT JOIN store.store_customers c ON c.id = i.store_customer_id
		WHERE i.store_id = $1
		  AND ($2::uuid IS NULL OR i.store_customer_id = $2)
		  AND ($3 = '' OR i.lifecycle_status = $3)
		ORDER BY i.created_at DESC`

	rows, err := tx.QueryContext(ctx, query, storeID, customerID, status)
	if err != nil {
		return nil, fmt.Errorf("query invoices: %w", err)
	}
	defer rows.Close()

	var list []InvoiceResponse
	for rows.Next() {
		var inv InvoiceResponse
		var invDate time.Time
		var dueDate, issuedAt *time.Time
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&inv.ID, &inv.StoreID, &inv.StoreCustomerID, &inv.CustomerName,
			&inv.InvoiceNumber, &inv.LifecycleStatus, &inv.Subtotal, &inv.DiscountAmount,
			&inv.TaxAmount, &inv.TotalAmount, &inv.PaidAmount, &inv.Currency, &inv.Notes,
			&invDate, &dueDate, &issuedAt, &inv.CreatedBy, &createdAt, &updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan invoice: %w", err)
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
		inv.UpdatedAt = updatedAt.Format(time.RFC3339)
		list = append(list, inv)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []InvoiceResponse{}
	}
	return list, nil
}

func (r *Repository) UpdateInvoiceDraft(ctx context.Context, tx database.DBTX, storeID, invoiceID, userID uuid.UUID, req UpdateInvoiceRequest) (*InvoiceResponse, error) {
	existing, err := r.GetInvoice(ctx, tx, storeID, invoiceID)
	if err != nil {
		return nil, err
	}
	if existing.LifecycleStatus != "draft" {
		return nil, ErrAlreadyIssued
	}

	targetCustomerID := existing.StoreCustomerID
	if req.StoreCustomerID != nil {
		targetCustomerID = req.StoreCustomerID
	}
	invoiceDate := existing.InvoiceDate
	if req.InvoiceDate != "" {
		invoiceDate = req.InvoiceDate
	}
	dueDate := existing.DueDate
	if req.DueDate != nil {
		dueDate = req.DueDate
	}
	notes := existing.Notes
	if req.Notes != "" {
		notes = req.Notes
	}

	// If items are modified
	if req.Items != nil {
		subtotal, discount, tax, total, calcItems := CalculateTotals(req.Items)

		// Delete old items
		_, err = tx.ExecContext(ctx, "DELETE FROM invoice.invoice_items WHERE invoice_id = $1", invoiceID)
		if err != nil {
			return nil, fmt.Errorf("delete old invoice items: %w", err)
		}

		// Insert new items
		insertItemQuery := `
			INSERT INTO invoice.invoice_items (
				store_id, invoice_id, product_id, description_snapshot, sku_snapshot,
				quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total
			) VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8, $9, $10, $11)`
		for _, itm := range calcItems {
			_, err := tx.ExecContext(ctx, insertItemQuery,
				storeID, invoiceID, itm.ProductID, itm.DescriptionSnapshot, itm.SKUSnapshot,
				itm.Quantity, itm.UnitPrice, itm.DiscountAmount, itm.TaxRate, itm.TaxAmount, itm.LineTotal,
			)
			if err != nil {
				return nil, fmt.Errorf("insert line item: %w", err)
			}
		}

		updateQuery := `
			UPDATE invoice.invoices
			SET store_customer_id = $1, invoice_date = $2::date, due_date = $3::date, notes = NULLIF($4, ''),
			    subtotal = $5, discount_amount = $6, tax_amount = $7, total_amount = $8, updated_at = clock_timestamp()
			WHERE store_id = $9 AND id = $10`
		_, err = tx.ExecContext(ctx, updateQuery, targetCustomerID, invoiceDate, dueDate, notes, subtotal, discount, tax, total, storeID, invoiceID)
		if err != nil {
			return nil, fmt.Errorf("update invoice totals: %w", err)
		}
	} else {
		updateQuery := `
			UPDATE invoice.invoices
			SET store_customer_id = $1, invoice_date = $2::date, due_date = $3::date, notes = NULLIF($4, ''), updated_at = clock_timestamp()
			WHERE store_id = $5 AND id = $6`
		_, err = tx.ExecContext(ctx, updateQuery, targetCustomerID, invoiceDate, dueDate, notes, storeID, invoiceID)
		if err != nil {
			return nil, fmt.Errorf("update invoice metadata: %w", err)
		}
	}

	_ = r.RecordInvoiceEvent(ctx, tx, invoiceID, &userID, "draft_updated", map[string]any{
		"invoice_id": invoiceID,
	})

	return r.GetInvoice(ctx, tx, storeID, invoiceID)
}

func (r *Repository) IssueInvoice(ctx context.Context, tx database.DBTX, storeID, invoiceID, userID uuid.UUID) (*InvoiceResponse, error) {
	inv, err := r.GetInvoice(ctx, tx, storeID, invoiceID)
	if err != nil {
		return nil, err
	}
	if inv.LifecycleStatus != "draft" {
		return nil, ErrAlreadyIssued
	}

	// 1. Generate sequential invoice number
	invoiceNumber, err := r.GenerateNextInvoiceNumber(ctx, tx, storeID)
	if err != nil {
		return nil, err
	}

	// 2. Transition lifecycle_status to 'issued' and lock issued_at
	updateQuery := `
		UPDATE invoice.invoices
		SET invoice_number = $1, lifecycle_status = 'issued', issued_at = clock_timestamp(), updated_at = clock_timestamp()
		WHERE store_id = $2 AND id = $3`
	_, err = tx.ExecContext(ctx, updateQuery, invoiceNumber, storeID, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("issue invoice: %w", err)
	}

	// 3. Inventory Stock Movement Control
	// For each line item that references a product_id, decrement stock via stock_movements
	var defaultLocID uuid.UUID
	err = tx.QueryRowContext(ctx, `
		SELECT id FROM store.inventory_locations WHERE store_id = $1 AND is_default = true LIMIT 1
	`, storeID).Scan(&defaultLocID)
	if err != nil {
		// Fallback to any location
		_ = tx.QueryRowContext(ctx, `SELECT id FROM store.inventory_locations WHERE store_id = $1 LIMIT 1`, storeID).Scan(&defaultLocID)
	}

	if defaultLocID != uuid.Nil {
		for _, itm := range inv.Items {
			if itm.ProductID != nil && *itm.ProductID != uuid.Nil {
				// Record sale_issued (negative delta)
				stockQuery := `
					INSERT INTO store.stock_movements (
						store_id, product_id, location_id, quantity_delta, reason, reference_id, actor_user_id
					) VALUES ($1, $2, $3, $4, 'sale_issued', $5, $6)`
				_, err = tx.ExecContext(ctx, stockQuery, storeID, *itm.ProductID, defaultLocID, -itm.Quantity, invoiceID, userID)
				if err != nil {
					return nil, fmt.Errorf("record issue stock movement: %w", err)
				}
			}
		}
	}

	// 4. Log audit event
	_ = r.RecordInvoiceEvent(ctx, tx, invoiceID, &userID, "invoice_issued", map[string]any{
		"invoice_number": invoiceNumber,
		"total_amount":   inv.TotalAmount,
	})

	return r.GetInvoice(ctx, tx, storeID, invoiceID)
}

func (r *Repository) VoidInvoice(ctx context.Context, tx database.DBTX, storeID, invoiceID, userID uuid.UUID, reason string) (*InvoiceResponse, error) {
	inv, err := r.GetInvoice(ctx, tx, storeID, invoiceID)
	if err != nil {
		return nil, err
	}
	if inv.LifecycleStatus == "voided" {
		return nil, ErrAlreadyVoided
	}
	if inv.LifecycleStatus == "draft" {
		return nil, ErrNotIssued
	}

	// Transition to 'voided'
	updateQuery := `
		UPDATE invoice.invoices
		SET lifecycle_status = 'voided', updated_at = clock_timestamp()
		WHERE store_id = $1 AND id = $2`
	_, err = tx.ExecContext(ctx, updateQuery, storeID, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("void invoice: %w", err)
	}

	// Reverse stock movements
	var defaultLocID uuid.UUID
	err = tx.QueryRowContext(ctx, `
		SELECT id FROM store.inventory_locations WHERE store_id = $1 AND is_default = true LIMIT 1
	`, storeID).Scan(&defaultLocID)
	if err != nil {
		_ = tx.QueryRowContext(ctx, `SELECT id FROM store.inventory_locations WHERE store_id = $1 LIMIT 1`, storeID).Scan(&defaultLocID)
	}

	if defaultLocID != uuid.Nil {
		for _, itm := range inv.Items {
			if itm.ProductID != nil && *itm.ProductID != uuid.Nil {
				stockQuery := `
					INSERT INTO store.stock_movements (
						store_id, product_id, location_id, quantity_delta, reason, reference_id, actor_user_id
					) VALUES ($1, $2, $3, $4, 'sale_returned', $5, $6)`
				_, err = tx.ExecContext(ctx, stockQuery, storeID, *itm.ProductID, defaultLocID, itm.Quantity, invoiceID, userID)
				if err != nil {
					return nil, fmt.Errorf("record void reverse stock movement: %w", err)
				}
			}
		}
	}

	_ = r.RecordInvoiceEvent(ctx, tx, invoiceID, &userID, "invoice_voided", map[string]any{
		"reason": reason,
	})

	return r.GetInvoice(ctx, tx, storeID, invoiceID)
}

// Invoice Payments
func (r *Repository) RecordPayment(ctx context.Context, tx database.DBTX, storeID, invoiceID, userID uuid.UUID, req RecordPaymentRequest) (*PaymentResponse, error) {
	inv, err := r.GetInvoice(ctx, tx, storeID, invoiceID)
	if err != nil {
		return nil, err
	}
	if inv.LifecycleStatus != "issued" && inv.LifecycleStatus != "partially_paid" {
		if inv.LifecycleStatus == "paid" {
			return nil, ErrAlreadyPaid
		}
		return nil, ErrNotIssued
	}

	remaining := inv.TotalAmount - inv.PaidAmount
	if req.Amount > remaining+0.001 { // Slight float buffer
		return nil, ErrOverpayment
	}

	currency := req.Currency
	if currency == "" {
		currency = inv.Currency
	}

	insertPaymentQuery := `
		INSERT INTO invoice.invoice_payments (
			invoice_id, amount, currency, method, status, external_reference, received_by
		) VALUES ($1, $2, $3, $4, 'completed', NULLIF($5, ''), $6)
		RETURNING id, invoice_id, amount, currency, method, status, COALESCE(external_reference, ''), received_by, paid_at, created_at`

	var p PaymentResponse
	var paidAt, createdAt time.Time
	err = tx.QueryRowContext(ctx, insertPaymentQuery, invoiceID, req.Amount, currency, req.Method, req.ExternalReference, userID).Scan(
		&p.ID, &p.InvoiceID, &p.Amount, &p.Currency, &p.Method, &p.Status, &p.ExternalReference, &p.ReceivedBy, &paidAt, &createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert payment: %w", err)
	}
	p.PaidAt = paidAt.Format(time.RFC3339)
	p.CreatedAt = createdAt.Format(time.RFC3339)

	// Recompute total paid amount
	var totalPaid float64
	err = tx.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount), 0) FROM invoice.invoice_payments WHERE invoice_id = $1 AND status = 'completed'
	`, invoiceID).Scan(&totalPaid)
	if err != nil {
		return nil, fmt.Errorf("sum invoice payments: %w", err)
	}

	newStatus := "partially_paid"
	if totalPaid >= inv.TotalAmount {
		newStatus = "paid"
	}

	updateInvoiceQuery := `
		UPDATE invoice.invoices
		SET paid_amount = $1, lifecycle_status = $2, updated_at = clock_timestamp()
		WHERE id = $3`
	_, err = tx.ExecContext(ctx, updateInvoiceQuery, totalPaid, newStatus, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("update invoice paid status: %w", err)
	}

	_ = r.RecordInvoiceEvent(ctx, tx, invoiceID, &userID, "payment_recorded", map[string]any{
		"payment_id": p.ID,
		"amount":     p.Amount,
		"method":     p.Method,
		"new_status": newStatus,
	})

	return &p, nil
}

func (r *Repository) ListPayments(ctx context.Context, tx database.DBTX, invoiceID uuid.UUID) ([]PaymentResponse, error) {
	query := `
		SELECT id, invoice_id, amount, currency, method, status, COALESCE(external_reference, ''), received_by, paid_at, created_at
		FROM invoice.invoice_payments
		WHERE invoice_id = $1
		ORDER BY paid_at DESC`

	rows, err := tx.QueryContext(ctx, query, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("query payments: %w", err)
	}
	defer rows.Close()

	var payments []PaymentResponse
	for rows.Next() {
		var p PaymentResponse
		var paidAt, createdAt time.Time
		if err := rows.Scan(
			&p.ID, &p.InvoiceID, &p.Amount, &p.Currency, &p.Method, &p.Status,
			&p.ExternalReference, &p.ReceivedBy, &paidAt, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan payment: %w", err)
		}
		p.PaidAt = paidAt.Format(time.RFC3339)
		p.CreatedAt = createdAt.Format(time.RFC3339)
		payments = append(payments, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if payments == nil {
		payments = []PaymentResponse{}
	}
	return payments, nil
}

// Invoice Adjustments (Credit/Debit Notes)
func (r *Repository) CreateAdjustment(ctx context.Context, tx database.DBTX, storeID, invoiceID, userID uuid.UUID, req CreateAdjustmentRequest) (*AdjustmentResponse, error) {
	inv, err := r.GetInvoice(ctx, tx, storeID, invoiceID)
	if err != nil {
		return nil, err
	}
	if inv.LifecycleStatus != "issued" && inv.LifecycleStatus != "paid" && inv.LifecycleStatus != "partially_paid" {
		return nil, ErrNotIssued
	}

	adjNumber, err := r.GenerateNextAdjustmentNumber(ctx, tx, invoiceID, req.Type)
	if err != nil {
		return nil, err
	}

	query := `
		INSERT INTO invoice.invoice_adjustments (
			invoice_id, adjustment_number, type, amount, tax_impact, reason, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, invoice_id, adjustment_number, type, amount, tax_impact, reason, created_by, created_at`

	var adj AdjustmentResponse
	var createdAt time.Time
	err = tx.QueryRowContext(ctx, query, invoiceID, adjNumber, req.Type, req.Amount, req.TaxImpact, req.Reason, userID).Scan(
		&adj.ID, &adj.InvoiceID, &adj.AdjustmentNumber, &adj.Type, &adj.Amount, &adj.TaxImpact, &adj.Reason, &adj.CreatedBy, &createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert adjustment: %w", err)
	}
	adj.CreatedAt = createdAt.Format(time.RFC3339)

	_ = r.RecordInvoiceEvent(ctx, tx, invoiceID, &userID, "adjustment_created", map[string]any{
		"adjustment_id":     adj.ID,
		"adjustment_number": adj.AdjustmentNumber,
		"type":              adj.Type,
		"amount":            adj.Amount,
	})

	return &adj, nil
}

func (r *Repository) ListAdjustments(ctx context.Context, tx database.DBTX, invoiceID uuid.UUID) ([]AdjustmentResponse, error) {
	query := `
		SELECT id, invoice_id, adjustment_number, type, amount, tax_impact, reason, created_by, created_at
		FROM invoice.invoice_adjustments
		WHERE invoice_id = $1
		ORDER BY created_at DESC`

	rows, err := tx.QueryContext(ctx, query, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("query adjustments: %w", err)
	}
	defer rows.Close()

	var adjustments []AdjustmentResponse
	for rows.Next() {
		var a AdjustmentResponse
		var createdAt time.Time
		if err := rows.Scan(
			&a.ID, &a.InvoiceID, &a.AdjustmentNumber, &a.Type, &a.Amount, &a.TaxImpact,
			&a.Reason, &a.CreatedBy, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan adjustment: %w", err)
		}
		a.CreatedAt = createdAt.Format(time.RFC3339)
		adjustments = append(adjustments, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if adjustments == nil {
		adjustments = []AdjustmentResponse{}
	}
	return adjustments, nil
}

// Consumer Decisions
func (r *Repository) RecordDecision(ctx context.Context, tx database.DBTX, invoiceID, consumerID uuid.UUID, decision, notes string) (*DecisionResponse, error) {
	query := `
		INSERT INTO invoice.invoice_decisions (invoice_id, consumer_id, decision, notes, decided_at)
		VALUES ($1, $2, $3, NULLIF($4, ''), clock_timestamp())
		ON CONFLICT (invoice_id, consumer_id)
		DO UPDATE SET decision = EXCLUDED.decision, notes = EXCLUDED.notes, decided_at = clock_timestamp()
		RETURNING id, invoice_id, consumer_id, decision, COALESCE(notes, ''), decided_at, created_at`

	var d DecisionResponse
	var decidedAt, createdAt time.Time
	err := tx.QueryRowContext(ctx, query, invoiceID, consumerID, decision, notes).Scan(
		&d.ID, &d.InvoiceID, &d.ConsumerID, &d.Decision, &d.Notes, &decidedAt, &createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("record consumer decision: %w", err)
	}
	decidedStr := decidedAt.Format(time.RFC3339)
	d.DecidedAt = &decidedStr
	d.CreatedAt = createdAt.Format(time.RFC3339)

	_ = r.RecordInvoiceEvent(ctx, tx, invoiceID, nil, "consumer_decision", map[string]any{
		"consumer_id": consumerID,
		"decision":    decision,
	})

	return &d, nil
}

// Audit Trail Events
func (r *Repository) RecordInvoiceEvent(ctx context.Context, tx database.DBTX, invoiceID uuid.UUID, actorUserID *uuid.UUID, eventType string, metadata any) error {
	metaJSON, err := json.Marshal(metadata)
	if err != nil {
		metaJSON = []byte("{}")
	}

	query := `
		INSERT INTO invoice.invoice_events (invoice_id, actor_user_id, event_type, metadata)
		VALUES ($1, $2, $3, $4)`

	_, err = tx.ExecContext(ctx, query, invoiceID, actorUserID, eventType, metaJSON)
	return err
}

func (r *Repository) ListInvoiceEvents(ctx context.Context, tx database.DBTX, invoiceID uuid.UUID) ([]InvoiceEventResponse, error) {
	query := `
		SELECT id, invoice_id, actor_user_id, event_type, metadata, created_at
		FROM invoice.invoice_events
		WHERE invoice_id = $1
		ORDER BY created_at ASC`

	rows, err := tx.QueryContext(ctx, query, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("query invoice events: %w", err)
	}
	defer rows.Close()

	var events []InvoiceEventResponse
	for rows.Next() {
		var e InvoiceEventResponse
		var createdAt time.Time
		if err := rows.Scan(
			&e.ID, &e.InvoiceID, &e.ActorUserID, &e.EventType, &e.Metadata, &createdAt,
		); err != nil {
			return nil, fmt.Errorf("scan invoice event: %w", err)
		}
		e.CreatedAt = createdAt.Format(time.RFC3339)
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if events == nil {
		events = []InvoiceEventResponse{}
	}
	return events, nil
}
