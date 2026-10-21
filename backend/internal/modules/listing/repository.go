package listing

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
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
	db *sql.DB
}

// NewPostgresRepository instantiates a PostgreSQL listing repository.
func NewPostgresRepository(db *sql.DB) Repository {
	return &postgresRepository{db: db}
}

func (r *postgresRepository) List(ctx context.Context, limit int) ([]Listing, error) {
	if limit <= 0 {
		limit = 100
	}

	query := `
		SELECT id, title, description, price, city, created_at
		FROM listings
		ORDER BY created_at DESC
		LIMIT $1`

	rows, err := r.db.QueryContext(ctx, query, limit)
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
	query := `
		SELECT id, title, description, price, city, created_at
		FROM listings
		WHERE id = $1`

	var l Listing
	err := r.db.QueryRowContext(ctx, query, id).Scan(
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
	query := `
		INSERT INTO listings (title, description, price, city)
		VALUES ($1, $2, $3, $4)
		RETURNING id, title, created_at`

	var out CreateListingResponse
	err := r.db.QueryRowContext(ctx, query, req.Title, req.Description, req.Price, req.City).
		Scan(&out.ID, &out.Title, &out.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("listing.repo.Create: %w", err)
	}

	return &out, nil
}

func (r *postgresRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM listings WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("listing.repo.Delete: %w", err)
	}

	return nil
}
