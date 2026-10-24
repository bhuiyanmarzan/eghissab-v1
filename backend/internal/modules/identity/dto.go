package identity

import (
	"fmt"
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
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

// GoogleLoginRequest defines the payload received when completing a Google OAuth sign-in.
type GoogleLoginRequest struct {
	Code  string `json:"code"`
	State string `json:"state"`
}

func (req GoogleLoginRequest) Validate() error {
	code := strings.TrimSpace(req.Code)
	if code == "" {
		return &ValidationError{Field: "code", Msg: "authorization code is required"}
	}
	state := strings.TrimSpace(req.State)
	if state == "" {
		return &ValidationError{Field: "state", Msg: "state parameter is required"}
	}
	return nil
}

// GoogleLinkConfirmRequest defines the payload to confirm linking a Google account to an existing user.
type GoogleLinkConfirmRequest struct {
	LinkChallengeToken string `json:"link_challenge_token"`
	Password           string `json:"password,omitempty"`
	Code               string `json:"code,omitempty"`
}

func (req GoogleLinkConfirmRequest) Validate() error {
	token := strings.TrimSpace(req.LinkChallengeToken)
	if token == "" {
		return &ValidationError{Field: "link_challenge_token", Msg: "link_challenge_token is required"}
	}
	pass := strings.TrimSpace(req.Password)
	code := strings.TrimSpace(req.Code)
	if pass == "" && code == "" {
		return &ValidationError{Field: "password", Msg: "either password or verification code is required to authorize account link"}
	}
	return nil
}

// AddContactRequest defines payload to add a new contact (email or phone) to the user's account.
type AddContactRequest struct {
	Type  string `json:"type"`  // "email" or "phone"
	Value string `json:"value"` // normalized contact value
}

func (req AddContactRequest) Validate() error {
	cType := strings.ToLower(strings.TrimSpace(req.Type))
	if cType != "email" && cType != "phone" {
		return &ValidationError{Field: "type", Msg: "contact type must be 'email' or 'phone'"}
	}
	val := strings.TrimSpace(req.Value)
	if val == "" {
		return &ValidationError{Field: "value", Msg: "contact value is required"}
	}
	if cType == "email" {
		norm := strings.ToLower(val)
		if len(norm) > 254 || strings.ContainsAny(norm, "\r\n") || !strings.Contains(norm, "@") {
			return &ValidationError{Field: "value", Msg: "invalid email format"}
		}
		a, err := mail.ParseAddress(norm)
		if err != nil || a.Address != norm {
			return &ValidationError{Field: "value", Msg: "invalid email format"}
		}
	} else {
		// Phone number format validation: E.164-ish or standard 7-20 chars
		if len(val) < 7 || len(val) > 20 {
			return &ValidationError{Field: "value", Msg: "phone number must be between 7 and 20 digits"}
		}
		for _, r := range val {
			if !unicode.IsDigit(r) && r != '+' && r != '-' && r != ' ' && r != '(' && r != ')' {
				return &ValidationError{Field: "value", Msg: "phone number contains invalid characters"}
			}
		}
	}
	return nil
}

// VerifyContactRequest defines payload to verify a contact verification challenge.
type VerifyContactRequest struct {
	Token string `json:"token"`
}

func (req VerifyContactRequest) Validate() error {
	if strings.TrimSpace(req.Token) == "" {
		return &ValidationError{Field: "token", Msg: "verification token is required"}
	}
	return nil
}

// ContactResponse represents a user contact returned by contact endpoints.
type ContactResponse struct {
	ID        uuid.UUID  `json:"id"`
	Type      string     `json:"type"`
	Value     string     `json:"value"`
	IsPrimary bool       `json:"is_primary"`
	Verified  bool       `json:"verified"`
	CreatedAt string     `json:"created_at"`
}

// IdentityResponse represents an authentication identity linked to a user account.
type IdentityResponse struct {
	ID        uuid.UUID `json:"id"`
	Provider  string    `json:"provider"`
	Status    string    `json:"status"`
	CreatedAt string    `json:"created_at"`
}

