package identity

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalid    = errors.New("invalid credentials or token")
	ErrValidation = errors.New("invalid request")
	ErrLimited    = errors.New("too many requests")
	ErrDelivery   = errors.New("verification delivery unavailable")
)

const accessLifetime = 10 * time.Minute

type Principal struct {
	UserID    uuid.UUID `json:"user_id"`
	SessionID uuid.UUID `json:"session_id"`
}
type principalKey struct{}

func FromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalKey{}).(Principal)
	return p, ok && p.UserID != uuid.Nil && p.SessionID != uuid.Nil
}

type claims struct {
	Subject   string `json:"sub"`
	Session   string `json:"sid"`
	Issuer    string `json:"iss"`
	Audience  string `json:"aud"`
	ID        string `json:"jti"`
	Issued    int64  `json:"iat"`
	NotBefore int64  `json:"nbf"`
	Expires   int64  `json:"exp"`
}
type Tokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}
type tokenManager struct {
	key              []byte
	issuer, audience string
}

func (t tokenManager) issue(p Principal, refresh string) (Tokens, error) {
	now := time.Now().Unix()
	data, err := json.Marshal(claims{Subject: p.UserID.String(), Session: p.SessionID.String(), Issuer: t.issuer, Audience: t.audience, ID: uuid.NewString(), Issued: now, NotBefore: now, Expires: now + int64(accessLifetime/time.Second)})
	if err != nil {
		return Tokens{}, err
	}
	body := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`)) + "." + base64.RawURLEncoding.EncodeToString(data)
	mac := hmac.New(sha256.New, t.key)
	_, _ = mac.Write([]byte(body))
	return Tokens{AccessToken: body + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), RefreshToken: refresh, TokenType: "Bearer", ExpiresIn: int64(accessLifetime / time.Second)}, nil
}
func (t tokenManager) parse(token string) (Principal, error) {
	if len(token) > 4096 {
		return Principal{}, ErrInvalid
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Principal{}, ErrInvalid
	}
	header, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || string(header) != `{"alg":"HS256","typ":"JWT"}` {
		return Principal{}, ErrInvalid
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return Principal{}, ErrInvalid
	}
	mac := hmac.New(sha256.New, t.key)
	_, _ = mac.Write([]byte(parts[0] + "." + parts[1]))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return Principal{}, ErrInvalid
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Principal{}, ErrInvalid
	}
	var c claims
	if json.Unmarshal(payload, &c) != nil {
		return Principal{}, ErrInvalid
	}
	now := time.Now().Unix()
	if c.Issuer != t.issuer || c.Audience != t.audience || c.Expires <= now || c.NotBefore > now || c.Issued > now || c.Issued <= 0 || c.NotBefore != c.Issued || c.Expires <= c.Issued || c.Expires-c.Issued > int64(accessLifetime/time.Second) {
		return Principal{}, ErrInvalid
	}
	uid, e1 := uuid.Parse(c.Subject)
	sid, e2 := uuid.Parse(c.Session)
	jti, e3 := uuid.Parse(c.ID)
	if e1 != nil || e2 != nil || e3 != nil || uid == uuid.Nil || sid == uuid.Nil || jti == uuid.Nil {
		return Principal{}, ErrInvalid
	}
	return Principal{uid, sid}, nil
}
func opaque() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func digest(v string) string { h := sha256.Sum256([]byte(v)); return hex.EncodeToString(h[:]) }
func validOpaque(v string) bool {
	b, e := base64.RawURLEncoding.DecodeString(v)
	return e == nil && len(b) == 32 && base64.RawURLEncoding.EncodeToString(b) == v
}
func hashPassword(password string) (string, error) {
	// bcrypt counts bytes and rejects inputs above 72 bytes; never silently truncate.
	if len(password) < 12 || len(password) > 72 {
		return "", fmt.Errorf("%w: password must contain 12–72 bytes", ErrValidation)
	}
	b, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(b), err
}
