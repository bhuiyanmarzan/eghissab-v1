package identity

import (
	"fmt"
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"
)

// RegisterRequest defines the input payload for user registration.
type RegisterRequest struct {
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Password  string `json:"password"`
}

// ValidationError represents a field-level validation failure.
type ValidationError struct {
	Field string `json:"field"`
	Msg   string `json:"message"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Msg)
}

// Validate checks all input fields of RegisterRequest and returns a ValidationError if any rule fails.
func (req RegisterRequest) Validate() error {
	// 1. Email validation
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		return &ValidationError{Field: "email", Msg: "email is required"}
	}
	if len(email) > 254 {
		return &ValidationError{Field: "email", Msg: "email cannot exceed 254 characters"}
	}
	if strings.ContainsAny(email, "\r\n") || !strings.Contains(email, "@") {
		return &ValidationError{Field: "email", Msg: "invalid email format"}
	}
	a, err := mail.ParseAddress(email)
	if err != nil || a.Address != email {
		return &ValidationError{Field: "email", Msg: "invalid email format"}
	}

	// 2. First name validation
	first := strings.TrimSpace(req.FirstName)
	if first == "" {
		return &ValidationError{Field: "first_name", Msg: "first_name is required"}
	}
	if !utf8.ValidString(first) {
		return &ValidationError{Field: "first_name", Msg: "first_name must be valid UTF-8"}
	}
	if utf8.RuneCountInString(first) > 120 {
		return &ValidationError{Field: "first_name", Msg: "first_name cannot exceed 120 characters"}
	}

	// 3. Last name validation (optional)
	last := strings.TrimSpace(req.LastName)
	if last != "" {
		if !utf8.ValidString(last) {
			return &ValidationError{Field: "last_name", Msg: "last_name must be valid UTF-8"}
		}
		if utf8.RuneCountInString(last) > 120 {
			return &ValidationError{Field: "last_name", Msg: "last_name cannot exceed 120 characters"}
		}
	}

	// 4. Password validation
	if req.Password == "" {
		return &ValidationError{Field: "password", Msg: "password is required"}
	}
	if len(req.Password) < 8 {
		return &ValidationError{Field: "password", Msg: "password must be at least 8 characters long"}
	}
	if len(req.Password) > 72 {
		return &ValidationError{Field: "password", Msg: "password cannot exceed 72 characters"}
	}
	if err := validatePasswordStrength(req.Password); err != nil {
		return err
	}

	return nil
}

// validatePasswordStrength enforces complexity rules:
// at least one uppercase letter, one lowercase letter, one digit,
// and one special (non-letter, non-digit, non-space) character.
func validatePasswordStrength(password string) *ValidationError {
	var (
		hasUpper   bool
		hasLower   bool
		hasDigit   bool
		hasSpecial bool
	)
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		case !unicode.IsLetter(r) && !unicode.IsDigit(r) && !unicode.IsSpace(r):
			hasSpecial = true
		}
	}
	switch {
	case !hasUpper:
		return &ValidationError{Field: "password", Msg: "password must contain at least one uppercase letter"}
	case !hasLower:
		return &ValidationError{Field: "password", Msg: "password must contain at least one lowercase letter"}
	case !hasDigit:
		return &ValidationError{Field: "password", Msg: "password must contain at least one digit"}
	case !hasSpecial:
		return &ValidationError{Field: "password", Msg: "password must contain at least one special character"}
	}
	return nil
}
