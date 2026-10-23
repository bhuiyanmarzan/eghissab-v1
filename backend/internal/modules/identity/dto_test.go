package identity

import (
	"errors"
	"strings"
	"testing"
)

func TestRegisterRequest_Validate(t *testing.T) {
	baseValid := RegisterRequest{
		Email:     "user@example.com",
		FirstName: "John",
		LastName:  "Doe",
		Password:  "SecurePassword123!",
	}

	tests := []struct {
		name      string
		modify    func(r *RegisterRequest)
		wantErr   bool
		wantField string
	}{
		{
			name:    "valid request",
			modify:  func(r *RegisterRequest) {},
			wantErr: false,
		},
		{
			name: "valid request without last name",
			modify: func(r *RegisterRequest) {
				r.LastName = ""
			},
			wantErr: false,
		},
		// Email validation
		{
			name: "empty email fails",
			modify: func(r *RegisterRequest) {
				r.Email = ""
			},
			wantErr:   true,
			wantField: "email",
		},
		{
			name: "whitespace email fails",
			modify: func(r *RegisterRequest) {
				r.Email = "   "
			},
			wantErr:   true,
			wantField: "email",
		},
		{
			name: "email exceeding 254 chars fails",
			modify: func(r *RegisterRequest) {
				r.Email = strings.Repeat("a", 245) + "@example.com"
			},
			wantErr:   true,
			wantField: "email",
		},
		{
			name: "email with newline fails",
			modify: func(r *RegisterRequest) {
				r.Email = "user\nname@example.com"
			},
			wantErr:   true,
			wantField: "email",
		},
		{
			name: "email with carriage return fails",
			modify: func(r *RegisterRequest) {
				r.Email = "user\rname@example.com"
			},
			wantErr:   true,
			wantField: "email",
		},
		{
			name: "email missing @ fails",
			modify: func(r *RegisterRequest) {
				r.Email = "not-an-email"
			},
			wantErr:   true,
			wantField: "email",
		},
		{
			name: "malformed email address fails",
			modify: func(r *RegisterRequest) {
				r.Email = "user name@example.com"
			},
			wantErr:   true,
			wantField: "email",
		},
		// First name validation
		{
			name: "empty first name fails",
			modify: func(r *RegisterRequest) {
				r.FirstName = ""
			},
			wantErr:   true,
			wantField: "first_name",
		},
		{
			name: "whitespace first name fails",
			modify: func(r *RegisterRequest) {
				r.FirstName = "   "
			},
			wantErr:   true,
			wantField: "first_name",
		},
		{
			name: "invalid UTF-8 first name fails",
			modify: func(r *RegisterRequest) {
				r.FirstName = "John\xff\xfe"
			},
			wantErr:   true,
			wantField: "first_name",
		},
		{
			name: "first name exceeding 120 runes fails",
			modify: func(r *RegisterRequest) {
				r.FirstName = strings.Repeat("a", 121)
			},
			wantErr:   true,
			wantField: "first_name",
		},
		// Last name validation
		{
			name: "invalid UTF-8 last name fails",
			modify: func(r *RegisterRequest) {
				r.LastName = "Doe\xff\xfe"
			},
			wantErr:   true,
			wantField: "last_name",
		},
		{
			name: "last name exceeding 120 runes fails",
			modify: func(r *RegisterRequest) {
				r.LastName = strings.Repeat("b", 121)
			},
			wantErr:   true,
			wantField: "last_name",
		},
		// Password validation
		{
			name: "empty password fails",
			modify: func(r *RegisterRequest) {
				r.Password = ""
			},
			wantErr:   true,
			wantField: "password",
		},
		{
			name: "password too short (< 8 bytes) fails",
			modify: func(r *RegisterRequest) {
				r.Password = "Aa1!abc"
			},
			wantErr:   true,
			wantField: "password",
		},
		{
			name: "password too long (> 72 bytes) fails",
			modify: func(r *RegisterRequest) {
				r.Password = "Aa1!" + strings.Repeat("a", 69)
			},
			wantErr:   true,
			wantField: "password",
		},
		{
			name: "password missing uppercase letter fails",
			modify: func(r *RegisterRequest) {
				r.Password = "password123!"
			},
			wantErr:   true,
			wantField: "password",
		},
		{
			name: "password missing lowercase letter fails",
			modify: func(r *RegisterRequest) {
				r.Password = "PASSWORD123!"
			},
			wantErr:   true,
			wantField: "password",
		},
		{
			name: "password missing digit fails",
			modify: func(r *RegisterRequest) {
				r.Password = "Password!abc"
			},
			wantErr:   true,
			wantField: "password",
		},
		{
			name: "password missing special character fails",
			modify: func(r *RegisterRequest) {
				r.Password = "Password1234"
			},
			wantErr:   true,
			wantField: "password",
		},
		{
			name: "valid 8 bytes password succeeds",
			modify: func(r *RegisterRequest) {
				r.Password = "Aa1!abcd"
			},
			wantErr: false,
		},
		{
			name: "valid 72 bytes password succeeds",
			modify: func(r *RegisterRequest) {
				r.Password = "Aa1!" + strings.Repeat("a", 68)
			},
			wantErr: false,
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
					t.Fatalf("expected ValidationError, got %T (%v)", err, err)
				}
				if verr.Field != tt.wantField {
					t.Errorf("expected field %q, got %q (msg: %s)", tt.wantField, verr.Field, verr.Msg)
				}
				if verr.Error() == "" {
					t.Errorf("expected non-empty error string")
				}
			}
		})
	}
}
