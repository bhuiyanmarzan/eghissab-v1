package listing

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestCreateListingRequest_Validate(t *testing.T) {
	baseValid := CreateListingRequest{
		Title:       "MacBook Pro 16",
		Description: "Mint condition with all accessories",
		Price:       2500,
		City:        "Dhaka",
	}

	tests := []struct {
		name      string
		modify    func(r *CreateListingRequest)
		wantErr   bool
		wantField string
	}{
		{
			name:    "valid request",
			modify:  func(r *CreateListingRequest) {},
			wantErr: false,
		},
		// Title validation
		{
			name: "empty title fails",
			modify: func(r *CreateListingRequest) {
				r.Title = ""
			},
			wantErr:   true,
			wantField: "title",
		},
		{
			name: "whitespace title fails",
			modify: func(r *CreateListingRequest) {
				r.Title = "   "
			},
			wantErr:   true,
			wantField: "title",
		},
		{
			name: "title too short (< 3 chars)",
			modify: func(r *CreateListingRequest) {
				r.Title = "ab"
			},
			wantErr:   true,
			wantField: "title",
		},
		{
			name: "title too long (> 100 chars)",
			modify: func(r *CreateListingRequest) {
				r.Title = strings.Repeat("a", 101)
			},
			wantErr:   true,
			wantField: "title",
		},
		// Description validation
		{
			name: "empty description fails",
			modify: func(r *CreateListingRequest) {
				r.Description = ""
			},
			wantErr:   true,
			wantField: "description",
		},
		{
			name: "whitespace description fails",
			modify: func(r *CreateListingRequest) {
				r.Description = "   "
			},
			wantErr:   true,
			wantField: "description",
		},
		{
			name: "description too short (< 3 chars)",
			modify: func(r *CreateListingRequest) {
				r.Description = "hi"
			},
			wantErr:   true,
			wantField: "description",
		},
		{
			name: "description too long (> 5000 chars)",
			modify: func(r *CreateListingRequest) {
				r.Description = strings.Repeat("x", 5001)
			},
			wantErr:   true,
			wantField: "description",
		},
		// Price validation
		{
			name: "zero price fails",
			modify: func(r *CreateListingRequest) {
				r.Price = 0
			},
			wantErr:   true,
			wantField: "price",
		},
		{
			name: "negative price fails",
			modify: func(r *CreateListingRequest) {
				r.Price = -100
			},
			wantErr:   true,
			wantField: "price",
		},
		{
			name: "excessive price fails",
			modify: func(r *CreateListingRequest) {
				r.Price = 1_000_000_000_001
			},
			wantErr:   true,
			wantField: "price",
		},
		// City validation
		{
			name: "empty city fails",
			modify: func(r *CreateListingRequest) {
				r.City = ""
			},
			wantErr:   true,
			wantField: "city",
		},
		{
			name: "whitespace city fails",
			modify: func(r *CreateListingRequest) {
				r.City = "  "
			},
			wantErr:   true,
			wantField: "city",
		},
		{
			name: "city too short (< 2 chars)",
			modify: func(r *CreateListingRequest) {
				r.City = "a"
			},
			wantErr:   true,
			wantField: "city",
		},
		{
			name: "city too long (> 50 chars)",
			modify: func(r *CreateListingRequest) {
				r.City = strings.Repeat("c", 51)
			},
			wantErr:   true,
			wantField: "city",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := baseValid
			tt.modify(&req)

			err := req.Validate()
			if (err != nil) != tt.wantErr {
				t.Fatalf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				var verr *ValidationError
				if !errors.As(err, &verr) {
					t.Fatalf("expected ValidationError, got %T", err)
				}
				if verr.Field != tt.wantField {
					t.Errorf("expected field %q, got %q", tt.wantField, verr.Field)
				}
				if verr.Error() == "" {
					t.Errorf("expected non-empty error string")
				}
			}
		})
	}
}

func TestDTO_Conversions(t *testing.T) {
	now := time.Now()
	entity := Listing{
		ID:          "123",
		Title:       "Sample Listing",
		Description: "Detailed description here",
		Price:       500,
		City:        "Dhaka",
		CreatedAt:   now,
	}

	dto := ToListingResponse(entity)
	if dto.ID != entity.ID || dto.Title != entity.Title || dto.Price != entity.Price || dto.City != entity.City {
		t.Errorf("ToListingResponse mapping mismatch: got %+v, want %+v", dto, entity)
	}

	dtos := ToListingResponses([]Listing{entity})
	if len(dtos) != 1 || dtos[0].ID != entity.ID {
		t.Errorf("ToListingResponses mapping mismatch: got %+v", dtos)
	}
}
