package identity

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/mail"
	"strings"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// VerificationMailer must deliver tokens without logging or exposing them in API responses.
type VerificationMailer interface {
	SendVerification(context.Context, string, string) error
}
type Service struct {
	tx        database.TxManager
	repo      *Repository
	tokens    tokenManager
	mail      VerificationMailer
	dummyHash string
}

func normalizeEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	a, err := mail.ParseAddress(email)
	if err != nil || a.Address != email || len(email) > 254 || strings.ContainsAny(email, "\r\n") || !strings.Contains(email, "@") {
		return "", fmt.Errorf("%w: valid email required", ErrValidation)
	}
	return email, nil
}
func (s *Service) budget(ctx context.Context, key string) error {
	ok, err := inTx(s, ctx, func(ctx context.Context) (bool, error) { return s.repo.budget(ctx, key) })
	if err != nil {
		return err
	}
	if !ok {
		return ErrLimited
	}
	return nil
}
func (s *Service) Register(ctx context.Context, req RegisterRequest) error {
	if err := req.Validate(); err != nil {
		return err
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	first := strings.TrimSpace(req.FirstName)
	last := strings.TrimSpace(req.LastName)
	password := req.Password

	if err := s.budget(ctx, "register:"+email); err != nil {
		return err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	secret, err := opaque()
	if err != nil {
		return err
	}
	id := uuid.New()
	created, err := inTx(s, ctx, func(ctx context.Context) (bool, error) {
		return s.repo.register(ctx, email, first, last, hash, id, digest(secret))
	})
	if err != nil {
		return err
	}
	if created {
		return s.deliver(ctx, email, id.String()+"."+secret)
	}
	return nil
}
func (s *Service) Resend(ctx context.Context, email string) error {
	email, err := normalizeEmail(email)
	if err != nil {
		return err
	}
	if err = s.budget(ctx, "resend:"+email); err != nil {
		return err
	}
	secret, err := opaque()
	if err != nil {
		return err
	}
	id := uuid.New()
	send, err := inTx(s, ctx, func(ctx context.Context) (bool, error) { return s.repo.resend(ctx, email, id, digest(secret)) })
	if err != nil {
		return err
	}
	if send {
		return s.deliver(ctx, email, id.String()+"."+secret)
	}
	return nil
}
func (s *Service) deliver(ctx context.Context, email, token string) error {
	if err := s.mail.SendVerification(ctx, email, token); err != nil {
		return ErrDelivery
	}
	return nil
}
func (s *Service) Verify(ctx context.Context, token string) error {
	parts := strings.Split(token, ".")
	if len(parts) != 2 || !validOpaque(parts[1]) {
		return ErrInvalid
	}
	id, err := uuid.Parse(parts[0])
	if err != nil || id == uuid.Nil {
		return ErrInvalid
	}
	ok, err := inTx(s, ctx, func(ctx context.Context) (bool, error) { return s.repo.verify(ctx, id, digest(parts[1])) })
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalid
	}
	return nil
}
func (s *Service) Login(ctx context.Context, email, password string) (Tokens, error) {
	email, err := normalizeEmail(email)
	if err != nil {
		return Tokens{}, ErrInvalid
	}
	if err = s.budget(ctx, "login:"+email); err != nil {
		return Tokens{}, err
	}
	cred, err := inTx(s, ctx, func(ctx context.Context) (credential, error) { return s.repo.credentials(ctx, email) })
	id, hash := cred.id, cred.hash
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Tokens{}, err
	}
	found := err == nil
	if !found {
		hash = s.dummyHash
	}
	// A dummy hash keeps the absent/unverified-account path computationally comparable.
	matched := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
	if !found || !matched || len(password) > 72 {
		return Tokens{}, ErrInvalid
	}
	refresh, err := opaque()
	if err != nil {
		return Tokens{}, err
	}
	p := Principal{id, uuid.New()}
	tokens, err := s.tokens.issue(p, refresh)
	if err != nil {
		return Tokens{}, err
	}
	ok, err := inTx(s, ctx, func(ctx context.Context) (bool, error) { return s.repo.login(ctx, p, hash, refresh, uuid.New()) })
	if err != nil {
		return Tokens{}, err
	}
	if !ok {
		return Tokens{}, ErrInvalid
	}
	return tokens, nil
}
func (s *Service) Refresh(ctx context.Context, old string) (Tokens, error) {
	if !validOpaque(old) {
		return Tokens{}, ErrInvalid
	}
	next, err := opaque()
	if err != nil {
		return Tokens{}, err
	}
	result, err := inTx(s, ctx, func(ctx context.Context) (refreshResult, error) { return s.repo.refresh(ctx, old, next, uuid.New()) })
	if err != nil {
		return Tokens{}, err
	}
	if !result.valid {
		return Tokens{}, ErrInvalid
	}
	return s.tokens.issue(result.principal, next)
}
func (s *Service) Authenticate(ctx context.Context, token string) (Principal, error) {
	p, err := s.tokens.parse(token)
	if err != nil {
		return Principal{}, err
	}
	ok, err := inTx(s, ctx, func(ctx context.Context) (bool, error) { return s.repo.authorize(ctx, p) })
	if err != nil {
		return Principal{}, err
	}
	if !ok {
		return Principal{}, ErrInvalid
	}
	return p, nil
}

// Each database boundary belongs to the service; mail is sent only after registration commits.
func inTx[T any](s *Service, ctx context.Context, fn func(context.Context) (T, error)) (T, error) {
	var result T
	err := s.tx.WithTx(ctx, func(ctx context.Context, _ database.DBTX) error {
		var err error
		result, err = fn(ctx)
		return err
	})
	return result, err
}
func (s *Service) Profile(ctx context.Context, p Principal) (Profile, error) {
	return inTx(s, ctx, func(ctx context.Context) (Profile, error) { return s.repo.profile(ctx, p) })
}
func (s *Service) Logout(ctx context.Context, p Principal, all bool) error {
	_, err := inTx(s, ctx, func(ctx context.Context) (bool, error) { return true, s.repo.logout(ctx, p, all) })
	return err
}
