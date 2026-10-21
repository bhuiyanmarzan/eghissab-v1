package listing

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"
)

type mockRepository struct {
	listings []Listing
	createFn func(ctx context.Context, req CreateListingRequest) (*CreateListingResponse, error)
	deleteFn func(ctx context.Context, id string) error
}

func (m *mockRepository) List(ctx context.Context, limit int) ([]Listing, error) {
	return m.listings, nil
}

func (m *mockRepository) GetByID(ctx context.Context, id string) (*Listing, error) {
	for _, l := range m.listings {
		if l.ID == id {
			return &l, nil
		}
	}
	return nil, ErrNotFound
}

func (m *mockRepository) Create(ctx context.Context, req CreateListingRequest) (*CreateListingResponse, error) {
	if m.createFn != nil {
		return m.createFn(ctx, req)
	}
	return &CreateListingResponse{
		ID:        "test-uuid",
		Title:     req.Title,
		CreatedAt: time.Now(),
	}, nil
}

func (m *mockRepository) Delete(ctx context.Context, id string) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestService_List(t *testing.T) {
	mockRepo := &mockRepository{
		listings: []Listing{
			{ID: "1", Title: "Item 1", Price: 100, City: "Dhaka"},
			{ID: "2", Title: "Item 2", Price: 200, City: "Chittagong"},
		},
	}

	svc := NewService(mockRepo, testLogger())
	res, err := svc.List(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res) != 2 {
		t.Fatalf("expected 2 items, got %d", len(res))
	}
}

func TestService_Create_Validation(t *testing.T) {
	mockRepo := &mockRepository{}
	svc := NewService(mockRepo, testLogger())

	_, err := svc.Create(context.Background(), CreateListingRequest{
		Title: "",
	})
	if err == nil {
		t.Fatal("expected validation error on empty title, got nil")
	}
}

func TestService_Create_Success(t *testing.T) {
	mockRepo := &mockRepository{}
	svc := NewService(mockRepo, testLogger())

	out, err := svc.Create(context.Background(), CreateListingRequest{
		Title:       "Phone",
		Description: "Good",
		Price:       500,
		City:        "Dhaka",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.ID != "test-uuid" {
		t.Errorf("expected ID 'test-uuid', got %q", out.ID)
	}
}

func TestService_Delete_Success(t *testing.T) {
	mockRepo := &mockRepository{}
	svc := NewService(mockRepo, testLogger())

	if err := svc.Delete(context.Background(), "test-uuid"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
