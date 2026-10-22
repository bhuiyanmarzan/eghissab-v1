package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/tenant"
	"github.com/google/uuid"
)

var (
	// ErrNoTenantContext is returned when attempting a tenant-scoped transaction without tenant identity in context.
	ErrNoTenantContext = errors.New("database: tenant context is required for tenant transaction")

	// ErrTenantTxRequired is returned when a tenant-scoped repository query runs outside an authorized transaction.
	ErrTenantTxRequired = errors.New("database: tenant-scoped database query attempted outside an authorized transaction")

	// ErrNoActiveTx is returned when no active transaction is present in the context.
	ErrNoActiveTx = errors.New("database: no active transaction in context")
)

type txContextKey struct{}

// DBTX is the common database executor interface satisfied by both *sql.Tx and *sql.DB (or test mocks).
type DBTX interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	PrepareContext(ctx context.Context, query string) (*sql.Stmt, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// TxManager coordinates database transactions and tenant security context.
type TxManager interface {
	// WithTx runs a general transaction with automatic commit/rollback and panic handling.
	WithTx(ctx context.Context, fn func(ctx context.Context, tx DBTX) error) error

	// WithTenantTx validates tenant context, begins a transaction, sets transaction-local
	// RLS variables (set_config(..., true)), binds the transaction into context, and commits on success.
	WithTenantTx(ctx context.Context, fn func(ctx context.Context) error) error
}

type txManager struct {
	db *sql.DB
}

// NewTxManager constructs a new TxManager backed by *sql.DB.
func NewTxManager(db *sql.DB) TxManager {
	return &txManager{db: db}
}

// NoopTxManager executes callbacks directly without a live database transaction, useful for unit tests.
type NoopTxManager struct{}

// NewNoopTxManager returns a TxManager that executes transaction callbacks without a database connection.
func NewNoopTxManager() TxManager {
	return &NoopTxManager{}
}

func (m *NoopTxManager) WithTx(ctx context.Context, fn func(ctx context.Context, tx DBTX) error) error {
	return fn(ctx, nil)
}

func (m *NoopTxManager) WithTenantTx(ctx context.Context, fn func(ctx context.Context) error) error {
	if _, ok := tenant.FromContext(ctx); !ok {
		return ErrNoTenantContext
	}
	return fn(ctx)
}

// InjectTx binds a DBTX transaction into the context.
func InjectTx(ctx context.Context, tx DBTX) context.Context {
	return context.WithValue(ctx, txContextKey{}, tx)
}

// TxFromContext retrieves the DBTX transaction from context, or returns ErrNoActiveTx.
func TxFromContext(ctx context.Context) (DBTX, error) {
	tx, ok := ctx.Value(txContextKey{}).(DBTX)
	if !ok || tx == nil {
		return nil, ErrNoActiveTx
	}
	return tx, nil
}

// TenantTxFromContext retrieves the active transaction from context, failing with ErrTenantTxRequired
// if a tenant repository method is called without WithTenantTx.
func TenantTxFromContext(ctx context.Context) (DBTX, error) {
	tx, ok := ctx.Value(txContextKey{}).(DBTX)
	if !ok || tx == nil {
		return nil, ErrTenantTxRequired
	}
	return tx, nil
}

// GetExecutor resolves the query executor:
// - If an active transaction exists in context, it is returned.
// - If no transaction exists and tenantScoped is true, it strictly fails with ErrTenantTxRequired.
// - If no transaction exists and tenantScoped is false, it returns the fallback *sql.DB.
func GetExecutor(ctx context.Context, fallbackDB *sql.DB, tenantScoped bool) (DBTX, error) {
	tx, ok := ctx.Value(txContextKey{}).(DBTX)
	if ok && tx != nil {
		return tx, nil
	}
	if tenantScoped {
		return nil, ErrTenantTxRequired
	}
	if fallbackDB == nil {
		return nil, ErrNoActiveTx
	}
	return fallbackDB, nil
}

// WithTx runs a standard transaction with automatic commit/rollback.
func (m *txManager) WithTx(ctx context.Context, fn func(ctx context.Context, tx DBTX) error) error {
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("database: begin transaction: %w", err)
	}

	var committed bool
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		} else if !committed {
			_ = tx.Rollback()
		}
	}()

	ctxWithTx := InjectTx(ctx, tx)
	if err := fn(ctxWithTx, tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("database: commit transaction: %w", err)
	}
	committed = true

	return nil
}

// WithTenantTx begins a transaction, sets transaction-local configuration for RLS,
// binds the transaction to the context, and executes the callback.
func (m *txManager) WithTenantTx(ctx context.Context, fn func(ctx context.Context) error) error {
	tc, ok := tenant.FromContext(ctx)
	if !ok || tc == nil {
		return ErrNoTenantContext
	}

	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("database: begin tenant transaction: %w", err)
	}

	var committed bool
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		} else if !committed {
			_ = tx.Rollback()
		}
	}()

	// Apply transaction-local configuration.
	// The 3rd parameter 'true' makes the config local to this transaction (resetting on commit/rollback),
	// preventing state leakage into connection pools.
	if err := applyTenantRLSConfig(ctx, tx, tc); err != nil {
		return fmt.Errorf("database: apply tenant rls config: %w", err)
	}

	ctxWithTx := InjectTx(ctx, tx)
	if err := fn(ctxWithTx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("database: commit tenant transaction: %w", err)
	}
	committed = true

	return nil
}

func applyTenantRLSConfig(ctx context.Context, tx DBTX, tc *tenant.Context) error {
	userIDStr := ""
	if tc.UserID != uuid.Nil {
		userIDStr = tc.UserID.String()
	}

	orgIDStr := ""
	if tc.OrganizationID != uuid.Nil {
		orgIDStr = tc.OrganizationID.String()
	}

	storeIDStr := ""
	if tc.StoreID != nil && *tc.StoreID != uuid.Nil {
		storeIDStr = tc.StoreID.String()
	}

	consumerIDStr := ""
	if tc.ConsumerID != nil && *tc.ConsumerID != uuid.Nil {
		consumerIDStr = tc.ConsumerID.String()
	}

	query := `
		SELECT
			set_config('app.user_id', $1, true),
			set_config('app.organization_id', $2, true),
			set_config('app.store_id', $3, true),
			set_config('app.consumer_id', $4, true);`

	var u, o, s, c string
	if err := tx.QueryRowContext(ctx, query, userIDStr, orgIDStr, storeIDStr, consumerIDStr).Scan(&u, &o, &s, &c); err != nil {
		return err
	}

	return nil
}
