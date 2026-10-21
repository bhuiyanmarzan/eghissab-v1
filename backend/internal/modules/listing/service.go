package listing

import (
	"context"
	"log/slog"
	"strings"
)

// Service defines application business logic for listings.
type Service interface {
	List(ctx context.Context) ([]Listing, error)
	GetByID(ctx context.Context, id string) (*Listing, error)
	Create(ctx context.Context, req CreateListingRequest) (*CreateListingResponse, error)
	Delete(ctx context.Context, id string) error
}

type service struct {
	repo   Repository
	logger *slog.Logger
}

// NewService constructs a new listing service instance.
func NewService(repo Repository, logger *slog.Logger) Service {
	return &service{
		repo:   repo,
		logger: logger,
	}
}

func (s *service) List(ctx context.Context) ([]Listing, error) {
	listings, err := s.repo.List(ctx, 100)
	if err != nil {
		s.logger.Error("listings query error", "err", err)
		return nil, err
	}
	s.logger.Info("listings fetched", "total", len(listings))
	return listings, nil
}

func (s *service) GetByID(ctx context.Context, id string) (*Listing, error) {
	listing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		s.logger.Error("listing get by id failed", "id", id, "err", err)
		return nil, err
	}
	return listing, nil
}

func (s *service) Create(ctx context.Context, req CreateListingRequest) (*CreateListingResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.City = strings.TrimSpace(req.City)

	res, err := s.repo.Create(ctx, req)
	if err != nil {
		s.logger.Error("failed to insert listing", "err", err)
		return nil, err
	}

	return res, nil
}

func (s *service) Delete(ctx context.Context, id string) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		s.logger.Error("delete failed", "listing_id", id, "err", err)
		return err
	}
	return nil
}
