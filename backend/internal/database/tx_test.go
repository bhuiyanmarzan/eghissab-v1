package database

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/tenant"
	"github.com/google/uuid"
)

type mockDBTX struct {
	execCalled     bool
	queryRowCalled bool
}

func (m *mockDBTX) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	m.execCalled = true
	return nil, nil
}

func (m *mockDBTX) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	return nil, nil
}

func (m *mockDBTX) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return nil, nil
}

func (m *mockDBTX) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	m.queryRowCalled = true
	return nil
}

func TestTxFromContext_Empty(t *testing.T) {
	ctx := context.Background()

	_, err := TxFromContext(ctx)
	if !errors.Is(err, ErrNoActiveTx) {
		t.Fatalf("expected ErrNoActiveTx, got: %v", err)
	}

	_, err = TenantTxFromContext(ctx)
	if !errors.Is(err, ErrTenantTxRequired) {
		t.Fatalf("expected ErrTenantTxRequired, got: %v", err)
	}
}

func TestTxFromContext_Injected(t *testing.T) {
	mockTx := &mockDBTX{}
	ctx := InjectTx(context.Background(), mockTx)

	tx, err := TxFromContext(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tx != mockTx {
		t.Fatalf("expected injected tx to match mockTx")
	}

	// Generic injection without tenant context must be rejected by TenantTxFromContext
	_, err = TenantTxFromContext(ctx)
	if !errors.Is(err, ErrTenantTxRequired) {
		t.Fatalf("expected ErrTenantTxRequired without authorized tenant scope, got: %v", err)
	}

	// With matching tenant context and authorized tenant tx injection:
	uid := uuid.New()
	orgID := uuid.New()
	tenantCtx := tenant.WithContext(context.Background(), &tenant.Context{
		UserID:         uid,
		OrganizationID: orgID,
	})
	scope := [4]uuid.UUID{uid, orgID}
	authCtx := InjectTenantTx(tenantCtx, mockTx, scope)

	tenantTx, err := TenantTxFromContext(authCtx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tenantTx != mockTx {
		t.Fatalf("expected injected tenantTx to match mockTx")
	}
}

func TestGetExecutor(t *testing.T) {
	ctx := context.Background()

	// Tenant-scoped without tx must fail
	_, err := GetExecutor(ctx, nil, true)
	if !errors.Is(err, ErrTenantTxRequired) {
		t.Fatalf("expected ErrTenantTxRequired, got: %v", err)
	}

	// Non-tenant without tx returns fallback DB
	mockTx := &mockDBTX{}
	ctxWithTx := InjectTx(ctx, mockTx)

	exec, err := GetExecutor(ctxWithTx, nil, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exec != mockTx {
		t.Fatalf("expected injected mockTx")
	}
}

func TestWithTenantTx_RequiresTenantContext(t *testing.T) {
	mgr := &txManager{db: nil}
	ctx := context.Background()

	err := mgr.WithTenantTx(ctx, func(ctx context.Context) error {
		return nil
	})

	if !errors.Is(err, ErrNoTenantContext) {
		t.Fatalf("expected ErrNoTenantContext when no tenant context in ctx, got %v", err)
	}
}

func TestTenantContextPropagation(t *testing.T) {
	orgID := uuid.New()
	userID := uuid.New()

	ctx := tenant.WithContext(context.Background(), &tenant.Context{
		OrganizationID: orgID,
		UserID:         userID,
	})

	tc, ok := tenant.FromContext(ctx)
	if !ok || tc == nil {
		t.Fatalf("expected tenant context to be present")
	}
	if tc.OrganizationID != orgID {
		t.Fatalf("expected orgID %s, got %s", orgID, tc.OrganizationID)
	}
	if tc.UserID != userID {
		t.Fatalf("expected userID %s, got %s", userID, tc.UserID)
	}
}
