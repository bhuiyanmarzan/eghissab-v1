package tenant

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	// ErrMissingTenantContext indicates that an operation required a tenant context but none was found.
	ErrMissingTenantContext = errors.New("tenant: missing tenant context in request")
)

type tenantKey struct{}

// Context encapsulates multi-tenant identity and authorization boundaries.
type Context struct {
	UserID         uuid.UUID
	OrganizationID uuid.UUID
	StoreID        *uuid.UUID
	ConsumerID     *uuid.UUID
}

// WithContext returns a new context containing the provided tenant Context.
func WithContext(ctx context.Context, tc *Context) context.Context {
	return context.WithValue(ctx, tenantKey{}, tc)
}

// FromContext extracts the tenant Context from the provided context.
func FromContext(ctx context.Context) (*Context, bool) {
	tc, ok := ctx.Value(tenantKey{}).(*Context)
	return tc, ok && tc != nil
}
