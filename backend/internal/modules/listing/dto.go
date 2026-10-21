package listing

import (
	"fmt"
	"strings"
	"time"
)

// CreateListingRequest defines the payload for creating a new listing.
type CreateListingRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Price       int64  `json:"price"`
	City        string `json:"city"`
}

// CreateListingResponse defines the response returned after a successful creation.
type CreateListingResponse struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
}

// ListingResponse defines the response payload for listing details.
type ListingResponse struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Price       int64     `json:"price"`
	City        string    `json:"city"`
	CreatedAt   time.Time `json:"created_at"`
}

// ToListingResponse converts a domain Listing entity into a ListingResponse DTO.
func ToListingResponse(l Listing) ListingResponse {
	return ListingResponse{
		ID:          l.ID,
		Title:       l.Title,
		Description: l.Description,
		Price:       l.Price,
		City:        l.City,
		CreatedAt:   l.CreatedAt,
	}
}

// ToListingResponses converts a slice of domain Listing entities into ListingResponse DTOs.
func ToListingResponses(listings []Listing) []ListingResponse {
	out := make([]ListingResponse, len(listings))
	for i, l := range listings {
		out[i] = ToListingResponse(l)
	}
	return out
}

// ValidationError represents a field-level validation failure.
type ValidationError struct {
	Field string `json:"field"`
	Msg   string `json:"message"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Msg)
}

// Validate checks all input fields of CreateListingRequest and returns a ValidationError if any rule fails.
func (req CreateListingRequest) Validate() error {
	// 1. Title validation
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return &ValidationError{Field: "title", Msg: "title is required"}
	}
	if len(title) < 3 {
		return &ValidationError{Field: "title", Msg: "title must be at least 3 characters long"}
	}
	if len(title) > 100 {
		return &ValidationError{Field: "title", Msg: "title cannot exceed 100 characters"}
	}

	// 2. Description validation
	description := strings.TrimSpace(req.Description)
	if description == "" {
		return &ValidationError{Field: "description", Msg: "description is required"}
	}
	if len(description) < 3 {
		return &ValidationError{Field: "description", Msg: "description must be at least 3 characters long"}
	}
	if len(description) > 5000 {
		return &ValidationError{Field: "description", Msg: "description cannot exceed 5000 characters"}
	}

	// 3. Price validation
	if req.Price <= 0 {
		return &ValidationError{Field: "price", Msg: "price must be greater than zero"}
	}
	if req.Price > 1_000_000_000_000 {
		return &ValidationError{Field: "price", Msg: "price exceeds maximum allowed limit"}
	}

	// 4. City validation
	city := strings.TrimSpace(req.City)
	if city == "" {
		return &ValidationError{Field: "city", Msg: "city is required"}
	}
	if len(city) < 2 {
		return &ValidationError{Field: "city", Msg: "city must be at least 2 characters long"}
	}
	if len(city) > 50 {
		return &ValidationError{Field: "city", Msg: "city cannot exceed 50 characters"}
	}

	return nil
}
