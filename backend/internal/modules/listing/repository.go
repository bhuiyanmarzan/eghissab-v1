package listing

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
)

var (
	// ErrNotFound indicates that the requested listing does not exist.
	ErrNotFound = errors.New("listing not found")
)

// Repository specifies the persistence contract for listings.
type Repository interface {
	List(ctx context.Context, limit int) ([]Listing, error)
	GetByID(ctx context.Context, id string) (*Listing, error)
	Create(ctx context.Context, req CreateListingRequest) (*CreateListingResponse, error)
	Delete(ctx context.Context, id string) error
}

type postgresRepository struct {
	db           *sql.DB
	tenantScoped bool
}

// NewPostgresRepository instantiates a PostgreSQL listing repository.
func NewPostgresRepository(db *sql.DB) Repository {
	return &postgresRepository{db: db, tenantScoped: false}
}

// NewTenantPostgresRepository instantiates a tenant-guarded repository where queries strictly require an active tenant transaction.
func NewTenantPostgresRepository(db *sql.DB) Repository {
	return &postgresRepository{db: db, tenantScoped: true}
}

func (r *postgresRepository) getExecutor(ctx context.Context) (database.DBTX, error) {
	return database.GetExecutor(ctx, r.db, r.tenantScoped)
}

func (r *postgresRepository) List(ctx context.Context, limit int) ([]Listing, error) {
	if limit <= 0 {
		limit = 100
	}

	exec, err := r.getExecutor(ctx)
	if err != nil {
		return nil, fmt.Errorf("listing.repo.List: %w", err)
	}

	query := `
		SELECT id, title, description, price, city, created_at
		FROM listings
		ORDER BY created_at DESC
		LIMIT $1`

	rows, err := exec.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("listing.repo.List: %w", err)
	}
	defer rows.Close()

	listings := make([]Listing, 0)
	for rows.Next() {
		var l Listing
		if err := rows.Scan(&l.ID, &l.Title, &l.Description, &l.Price, &l.City, &l.CreatedAt); err != nil {
			return nil, fmt.Errorf("listing.repo.List.scan: %w", err)
		}
		listings = append(listings, l)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("listing.repo.List.rows: %w", err)
	}

	return listings, nil
}

func (r *postgresRepository) GetByID(ctx context.Context, id string) (*Listing, error) {
	exec, err := r.getExecutor(ctx)
	if err != nil {
		return nil, fmt.Errorf("listing.repo.GetByID: %w", err)
	}

	query := `
		SELECT id, title, description, price, city, created_at
		FROM listings
		WHERE id = $1`

	var l Listing
	err = exec.QueryRowContext(ctx, query, id).Scan(
		&l.ID, &l.Title, &l.Description, &l.Price, &l.City, &l.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("listing.repo.GetByID: %w", err)
	}
	return &l, nil
}

func (r *postgresRepository) Create(ctx context.Context, req CreateListingRequest) (*CreateListingResponse, error) {
	exec, err := r.getExecutor(ctx)
	if err != nil {
		return nil, fmt.Errorf("listing.repo.Create: %w", err)
	}

	query := `
		INSERT INTO listings (title, description, price, city)
		VALUES ($1, $2, $3, $4)
		RETURNING id, title, created_at`

	var out CreateListingResponse
	err = exec.QueryRowContext(ctx, query, req.Title, req.Description, req.Price, req.City).
		Scan(&out.ID, &out.Title, &out.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("listing.repo.Create: %w", err)
	}

	return &out, nil
}

func (r *postgresRepository) Delete(ctx context.Context, id string) error {
	exec, err := r.getExecutor(ctx)
	if err != nil {
		return fmt.Errorf("listing.repo.Delete: %w", err)
	}

	query := `DELETE FROM listings WHERE id = $1`
	_, err = exec.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("listing.repo.Delete: %w", err)
	}

	return nil
}
