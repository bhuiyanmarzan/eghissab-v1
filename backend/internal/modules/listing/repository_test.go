package listing

import (
	"context"
	"errors"
	"testing"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
)

func TestTenantRepository_GuardsAgainstUnauthorizedExecution(t *testing.T) {
	// A tenant-guarded repository without an active transaction in context
	repo := NewTenantPostgresRepository(nil)
	ctx := context.Background()

	// Calling List outside of an authorized transaction must fail fast
	_, err := repo.List(ctx, 10)
	if !errors.Is(err, database.ErrTenantTxRequired) {
		t.Fatalf("expected ErrTenantTxRequired when running outside transaction, got: %v", err)
	}

	// Calling Create outside of an authorized transaction must fail fast
	_, err = repo.Create(ctx, CreateListingRequest{
		Title: "Test",
	})
	if !errors.Is(err, database.ErrTenantTxRequired) {
		t.Fatalf("expected ErrTenantTxRequired when running outside transaction, got: %v", err)
	}

	// Calling Delete outside of an authorized transaction must fail fast
	err = repo.Delete(ctx, "test-id")
	if !errors.Is(err, database.ErrTenantTxRequired) {
		t.Fatalf("expected ErrTenantTxRequired when running outside transaction, got: %v", err)
	}
}
