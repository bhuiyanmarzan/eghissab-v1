package identity

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestPasswordHashing(t *testing.T) {
	// Reject password too short (< 12 bytes)
	_, err := hashPassword("short-pass")
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation for < 12 bytes password, got: %v", err)
	}

	// Reject password too long (> 72 bytes)
	longPass := strings.Repeat("a", 73)
	_, err = hashPassword(longPass)
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation for > 72 bytes password, got: %v", err)
	}

	// Valid password (12-72 bytes)
	validPass := "super-secure-password-123"
	hash, err := hashPassword(validPass)
	if err != nil {
		t.Fatalf("unexpected error hashing password: %v", err)
	}

	// Verify bcrypt cost 12
	cost, err := bcrypt.Cost([]byte(hash))
	if err != nil {
		t.Fatalf("failed to get bcrypt cost: %v", err)
	}
	if cost != 12 {
		t.Fatalf("expected bcrypt cost 12, got: %d", cost)
	}

	// Verify matching password
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(validPass)); err != nil {
		t.Fatalf("password should match hash: %v", err)
	}

	// Verify mismatching password
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte("wrong-password-123")); err == nil {
		t.Fatalf("mismatched password should fail bcrypt comparison")
	}
}

func TestOpaqueAndDigest(t *testing.T) {
	token, err := opaque()
	if err != nil {
		t.Fatalf("opaque() failed: %v", err)
	}

	if !validOpaque(token) {
		t.Fatalf("validOpaque() should be true for freshly generated opaque token: %s", token)
	}

	if validOpaque("invalid-token") {
		t.Fatalf("validOpaque() should be false for invalid token")
	}

	dig := digest(token)
	if len(dig) != 64 { // SHA-256 hex encoded is 64 characters
		t.Fatalf("expected 64 character hex string for digest, got len %d: %s", len(dig), dig)
	}
}

func TestTokenManager_IssueAndParse(t *testing.T) {
	key := []byte("01234567890123456789012345678901") // 32 bytes
	tm := tokenManager{
		key:      key,
		issuer:   "test-issuer",
		audience: "test-aud",
	}

	p := Principal{
		UserID:    uuid.New(),
		SessionID: uuid.New(),
	}

	refreshToken := "test-refresh-token"
	tokens, err := tm.issue(p, refreshToken)
	if err != nil {
		t.Fatalf("failed to issue tokens: %v", err)
	}

	if tokens.AccessToken == "" {
		t.Fatalf("expected non-empty access token")
	}
	if tokens.RefreshToken != refreshToken {
		t.Fatalf("expected refresh token %s, got: %s", refreshToken, tokens.RefreshToken)
	}
	if tokens.TokenType != "Bearer" {
		t.Fatalf("expected token type Bearer, got: %s", tokens.TokenType)
	}
	if tokens.ExpiresIn != 600 {
		t.Fatalf("expected expires in 600s, got: %d", tokens.ExpiresIn)
	}

	// Parse back
	parsedPrincipal, err := tm.parse(tokens.AccessToken)
	if err != nil {
		t.Fatalf("failed to parse access token: %v", err)
	}

	if parsedPrincipal.UserID != p.UserID {
		t.Fatalf("expected user id %s, got %s", p.UserID, parsedPrincipal.UserID)
	}
	if parsedPrincipal.SessionID != p.SessionID {
		t.Fatalf("expected session id %s, got %s", p.SessionID, parsedPrincipal.SessionID)
	}
}

func TestTokenManager_TamperedSignature(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	tm := tokenManager{key: key, issuer: "test-iss", audience: "test-aud"}

	tokens, err := tm.issue(Principal{UserID: uuid.New(), SessionID: uuid.New()}, "refresh")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Tamper with signature
	parts := strings.Split(tokens.AccessToken, ".")
	tamperedSig := parts[2] + "x"
	tamperedToken := parts[0] + "." + parts[1] + "." + tamperedSig

	_, err = tm.parse(tamperedToken)
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected ErrInvalid for tampered signature, got: %v", err)
	}
}

func TestTokenManager_ExpiredToken(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	tm := tokenManager{key: key, issuer: "test-iss", audience: "test-aud"}

	// Manually construct an expired token
	past := time.Now().Add(-1 * time.Hour).Unix()
	claimsData, _ := json.Marshal(claims{
		Subject:   uuid.NewString(),
		Session:   uuid.NewString(),
		Issuer:    "test-iss",
		Audience:  "test-aud",
		ID:        uuid.NewString(),
		Issued:    past,
		NotBefore: past,
		Expires:   past + 600, // expired 50 minutes ago
	})

	body := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`)) + "." + base64.RawURLEncoding.EncodeToString(claimsData)
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(body))
	expiredToken := body + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	_, err := tm.parse(expiredToken)
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected ErrInvalid for expired token, got: %v", err)
	}
}
