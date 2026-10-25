package identity

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"

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
	google    *GoogleOAuthClient
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

func (s *Service) PruneAttempts(ctx context.Context, olderThan time.Duration) (int, error) {
	return inTx(s, ctx, func(ctx context.Context) (int, error) {
		return s.repo.pruneAttempts(ctx, olderThan)
	})
}
func (s *Service) Register(ctx context.Context, req RegisterRequest) error {
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

	return s.tx.WithTx(ctx, func(ctx context.Context, tx database.DBTX) error {
		_, ok, err := s.repo.RegisterTx(ctx, tx, email, first, last, hash)
		if err != nil {
			return err
		}
		if !ok {
			// Email already exists: complete without duplicate creation (anti-enumeration)
			return nil
		}
		return nil
	})
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

type GoogleAuthResult struct {
	Tokens             Tokens `json:"tokens,omitempty"`
	LinkingRequired    bool   `json:"linking_required"`
	LinkChallengeToken string `json:"link_challenge_token,omitempty"`
	Email              string `json:"email,omitempty"`
}

func (s *Service) GoogleAuthURL() (string, error) {
	if s.google == nil {
		return "", fmt.Errorf("%w: google oauth not configured", ErrInvalid)
	}
	state, err := s.google.GenerateState()
	if err != nil {
		return "", err
	}
	return s.google.AuthURL(state), nil
}

func (s *Service) signLinkToken(challengeID, userID uuid.UUID, subject, secret string) string {
	raw := fmt.Sprintf("%s:%s:%s:%s", challengeID.String(), userID.String(), base64.RawURLEncoding.EncodeToString([]byte(subject)), secret)
	mac := hmac.New(sha256.New, s.tokens.key)
	mac.Write([]byte(raw))
	sig := mac.Sum(nil)
	return fmt.Sprintf("%s.%s", base64.RawURLEncoding.EncodeToString([]byte(raw)), base64.RawURLEncoding.EncodeToString(sig))
}

func (s *Service) parseLinkToken(token string) (challengeID, userID uuid.UUID, subject, secret string, err error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return uuid.Nil, uuid.Nil, "", "", ErrInvalid
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return uuid.Nil, uuid.Nil, "", "", ErrInvalid
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return uuid.Nil, uuid.Nil, "", "", ErrInvalid
	}
	mac := hmac.New(sha256.New, s.tokens.key)
	mac.Write(raw)
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return uuid.Nil, uuid.Nil, "", "", ErrInvalid
	}
	fields := strings.Split(string(raw), ":")
	if len(fields) != 4 {
		return uuid.Nil, uuid.Nil, "", "", ErrInvalid
	}
	cid, err := uuid.Parse(fields[0])
	if err != nil {
		return uuid.Nil, uuid.Nil, "", "", ErrInvalid
	}
	uid, err := uuid.Parse(fields[1])
	if err != nil {
		return uuid.Nil, uuid.Nil, "", "", ErrInvalid
	}
	subjBytes, err := base64.RawURLEncoding.DecodeString(fields[2])
	if err != nil {
		return uuid.Nil, uuid.Nil, "", "", ErrInvalid
	}
	return cid, uid, string(subjBytes), fields[3], nil
}

func (s *Service) GoogleLogin(ctx context.Context, code, state string) (GoogleAuthResult, error) {
	if s.google == nil {
		return GoogleAuthResult{}, fmt.Errorf("%w: google oauth not configured", ErrInvalid)
	}
	if !s.google.ValidateState(state) {
		return GoogleAuthResult{}, ErrInvalidState
	}
	userInfo, err := s.google.Exchange(ctx, code)
	if err != nil {
		return GoogleAuthResult{}, err
	}
	email, err := normalizeEmail(userInfo.Email)
	if err != nil {
		return GoogleAuthResult{}, err
	}
	if err := s.budget(ctx, "google_login:"+userInfo.Sub); err != nil {
		return GoogleAuthResult{}, err
	}

	sessionID := uuid.New()
	familyID := uuid.New()
	refresh, err := opaque()
	if err != nil {
		return GoogleAuthResult{}, err
	}

	// 1. Check if user already has this Google identity linked
	loginRes, err := inTx(s, ctx, func(ctx context.Context) (idResult, error) {
		return s.repo.googleLogin(ctx, userInfo.Sub, sessionID, familyID, refresh)
	})
	if err != nil {
		return GoogleAuthResult{}, err
	}
	if loginRes.ok {
		tokens, err := s.tokens.issue(Principal{loginRes.id, sessionID}, refresh)
		if err != nil {
			return GoogleAuthResult{}, err
		}
		return GoogleAuthResult{Tokens: tokens}, nil
	}

	// 2. New Google identity: attempt registration
	first := strings.TrimSpace(userInfo.GivenName)
	if first == "" {
		first = strings.TrimSpace(userInfo.Name)
	}
	if first == "" {
		first = "User"
	}
	last := strings.TrimSpace(userInfo.FamilyName)

	regRes, err := inTx(s, ctx, func(ctx context.Context) (idResult, error) {
		return s.repo.googleRegister(ctx, email, first, last, userInfo.Sub, sessionID, familyID, refresh)
	})
	if err != nil {
		return GoogleAuthResult{}, err
	}
	if regRes.ok {
		tokens, err := s.tokens.issue(Principal{regRes.id, sessionID}, refresh)
		if err != nil {
			return GoogleAuthResult{}, err
		}
		return GoogleAuthResult{Tokens: tokens}, nil
	}

	// 3. Email collision detected: user exists via credentials, must link with verification!
	challengeID := uuid.New()
	secret, err := opaque()
	if err != nil {
		return GoogleAuthResult{}, err
	}
	linkRes, err := inTx(s, ctx, func(ctx context.Context) (idResult, error) {
		return s.repo.googleLinkChallenge(ctx, email, challengeID, digest(secret))
	})
	if err != nil {
		return GoogleAuthResult{}, err
	}
	if !linkRes.ok {
		return GoogleAuthResult{}, ErrInvalid
	}

	linkToken := s.signLinkToken(challengeID, linkRes.id, userInfo.Sub, secret)
	_ = s.deliver(ctx, email, challengeID.String()+"."+secret)

	return GoogleAuthResult{
		LinkingRequired:    true,
		LinkChallengeToken: linkToken,
		Email:              email,
	}, nil
}

func (s *Service) ConfirmGoogleLink(ctx context.Context, req GoogleLinkConfirmRequest) (Tokens, error) {
	challengeID, userID, subject, secret, err := s.parseLinkToken(req.LinkChallengeToken)
	if err != nil {
		return Tokens{}, ErrInvalid
	}

	sessionID := uuid.New()
	familyID := uuid.New()
	refresh, err := opaque()
	if err != nil {
		return Tokens{}, err
	}

	// Authorization option A: Password
	if strings.TrimSpace(req.Password) != "" {
		password := req.Password
		contacts, err := s.repo.userContacts(ctx, userID)
		if err != nil || len(contacts) == 0 {
			return Tokens{}, ErrInvalid
		}
		var userEmail string
		for _, c := range contacts {
			if c.Type == "email" && c.IsPrimary {
				userEmail = c.Value
				break
			}
		}
		if userEmail == "" {
			userEmail = contacts[0].Value
		}
		cred, err := inTx(s, ctx, func(ctx context.Context) (credential, error) {
			return s.repo.credentials(ctx, userEmail)
		})
		if err != nil {
			return Tokens{}, ErrInvalid
		}
		if bcrypt.CompareHashAndPassword([]byte(cred.hash), []byte(password)) != nil {
			return Tokens{}, &ValidationError{Field: "password", Msg: "invalid account password"}
		}

		ok, err := inTx(s, ctx, func(ctx context.Context) (bool, error) {
			return s.repo.googleLinkWithPassword(ctx, userID, subject, sessionID, familyID, refresh)
		})
		if err != nil || !ok {
			return Tokens{}, ErrInvalid
		}
		return s.tokens.issue(Principal{userID, sessionID}, refresh)
	}

	// Authorization option B: Code
	if strings.TrimSpace(req.Code) != "" {
		code := strings.TrimSpace(req.Code)
		hash := digest(code)
		if code != secret && hash != digest(secret) {
			return Tokens{}, &ValidationError{Field: "code", Msg: "invalid verification code"}
		}
		ok, err := inTx(s, ctx, func(ctx context.Context) (bool, error) {
			return s.repo.googleLinkConfirm(ctx, challengeID, digest(secret), userID, subject, sessionID, familyID, refresh)
		})
		if err != nil || !ok {
			return Tokens{}, ErrInvalid
		}
		return s.tokens.issue(Principal{userID, sessionID}, refresh)
	}

	return Tokens{}, ErrInvalid
}

func (s *Service) Contacts(ctx context.Context, userID uuid.UUID) ([]ContactResponse, error) {
	return inTx(s, ctx, func(ctx context.Context) ([]ContactResponse, error) {
		return s.repo.userContacts(ctx, userID)
	})
}

func (s *Service) AddContact(ctx context.Context, userID uuid.UUID, req AddContactRequest) (uuid.UUID, error) {
	challengeID := uuid.New()
	secret, err := opaque()
	if err != nil {
		return uuid.Nil, err
	}
	cType := strings.ToLower(strings.TrimSpace(req.Type))
	val := strings.TrimSpace(req.Value)
	if cType == "email" {
		val = strings.ToLower(val)
	}

	res, err := inTx(s, ctx, func(ctx context.Context) (idResult, error) {
		return s.repo.addContact(ctx, userID, cType, val, challengeID, digest(secret))
	})
	if err != nil {
		return uuid.Nil, err
	}
	if !res.ok {
		return uuid.Nil, fmt.Errorf("%w: contact value already in use", ErrValidation)
	}

	if cType == "email" {
		_ = s.deliver(ctx, val, challengeID.String()+"."+secret)
	}
	return res.id, nil
}

func (s *Service) VerifyContact(ctx context.Context, token string) error {
	parts := strings.Split(token, ".")
	if len(parts) != 2 || !validOpaque(parts[1]) {
		return ErrInvalid
	}
	id, err := uuid.Parse(parts[0])
	if err != nil || id == uuid.Nil {
		return ErrInvalid
	}
	ok, err := inTx(s, ctx, func(ctx context.Context) (bool, error) {
		return s.repo.verifyContact(ctx, id, digest(parts[1]))
	})
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalid
	}
	return nil
}

func (s *Service) SetPrimaryContact(ctx context.Context, userID, contactID uuid.UUID) error {
	ok, err := inTx(s, ctx, func(ctx context.Context) (bool, error) {
		return s.repo.setPrimaryContact(ctx, userID, contactID)
	})
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalid
	}
	return nil
}

func (s *Service) DeleteContact(ctx context.Context, userID, contactID uuid.UUID) error {
	ok, err := inTx(s, ctx, func(ctx context.Context) (bool, error) {
		return s.repo.deleteContact(ctx, userID, contactID)
	})
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("%w: cannot delete primary or unowned contact", ErrValidation)
	}
	return nil
}

func (s *Service) Identities(ctx context.Context, userID uuid.UUID) ([]IdentityResponse, error) {
	return inTx(s, ctx, func(ctx context.Context) ([]IdentityResponse, error) {
		return s.repo.userIdentities(ctx, userID)
	})
}
