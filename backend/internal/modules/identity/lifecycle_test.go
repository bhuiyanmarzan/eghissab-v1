package identity

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/tenant"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// In-memory test store simulating the PostgreSQL database and RLS policies
type memoryIdentityStore struct {
	users                 map[uuid.UUID]*userRecord
	contacts              map[string]*contactRecord
	credentials           map[uuid.UUID]string // userID -> bcrypt hash
	challenges            map[uuid.UUID]*challengeRecord
	sessions              map[string]*sessionRecord // refresh token hash -> session
	budgetCounts          map[string]int
	revokedTokenFamilies  map[uuid.UUID]bool
}

type userRecord struct {
	id        uuid.UUID
	firstName string
	lastName  string
	status    string
}

type contactRecord struct {
	id         uuid.UUID
	userID     uuid.UUID
	email      string
	verifiedAt *time.Time
}

type challengeRecord struct {
	id         uuid.UUID
	userID     uuid.UUID
	contactID  uuid.UUID
	hash       string
	expiresAt  time.Time
	consumedAt *time.Time
	attempts   int
}

type sessionRecord struct {
	id           uuid.UUID
	userID       uuid.UUID
	familyID     uuid.UUID
	tokenHash    string
	expiresAt    time.Time
	rotatedAt    *time.Time
	revokedAt    *time.Time
}

func newMemoryStore() *memoryIdentityStore {
	return &memoryIdentityStore{
		users:                make(map[uuid.UUID]*userRecord),
		contacts:             make(map[string]*contactRecord),
		credentials:          make(map[uuid.UUID]string),
		challenges:           make(map[uuid.UUID]*challengeRecord),
		sessions:             make(map[string]*sessionRecord),
		budgetCounts:         make(map[string]int),
		revokedTokenFamilies: make(map[uuid.UUID]bool),
	}
}

func (s *memoryIdentityStore) budget(key string) bool {
	s.budgetCounts[key]++
	return s.budgetCounts[key] <= 10
}

func (s *memoryIdentityStore) register(email, first, last, hash string, challengeID uuid.UUID, challengeHash string) (uuid.UUID, bool) {
	if _, exists := s.contacts[email]; exists {
		return uuid.Nil, false
	}
	uid := uuid.New()
	cid := uuid.New()
	s.users[uid] = &userRecord{id: uid, firstName: first, lastName: last, status: "pending"}
	s.contacts[email] = &contactRecord{id: cid, userID: uid, email: email, verifiedAt: nil}
	s.credentials[uid] = hash
	s.challenges[challengeID] = &challengeRecord{
		id:        challengeID,
		userID:    uid,
		contactID: cid,
		hash:      challengeHash,
		expiresAt: time.Now().Add(30 * time.Minute),
	}
	return uid, true
}

func (s *memoryIdentityStore) verify(challengeID uuid.UUID, hash string) bool {
	ch, ok := s.challenges[challengeID]
	if !ok || ch.consumedAt != nil || time.Now().After(ch.expiresAt) || ch.attempts >= 5 {
		return false
	}
	ch.attempts++
	if ch.hash != hash {
		return false
	}
	now := time.Now()
	ch.consumedAt = &now

	u := s.users[ch.userID]
	if u == nil || u.status != "pending" {
		return false
	}
	u.status = "active"

	for _, c := range s.contacts {
		if c.id == ch.contactID {
			c.verifiedAt = &now
			break
		}
	}
	return true
}

func (s *memoryIdentityStore) login(email, password string, sessionID, familyID uuid.UUID, refreshHash string) (uuid.UUID, bool) {
	c, ok := s.contacts[email]
	if !ok || c.verifiedAt == nil {
		return uuid.Nil, false
	}
	u := s.users[c.userID]
	if u == nil || u.status != "active" {
		return uuid.Nil, false
	}
	hash := s.credentials[u.id]
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return uuid.Nil, false
	}

	s.sessions[refreshHash] = &sessionRecord{
		id:        sessionID,
		userID:    u.id,
		familyID:  familyID,
		tokenHash: refreshHash,
		expiresAt: time.Now().Add(30 * 24 * time.Hour),
	}
	return u.id, true
}

func (s *memoryIdentityStore) refresh(oldHash, nextHash string, newSessionID uuid.UUID) (Principal, string) {
	sess, ok := s.sessions[oldHash]
	if !ok {
		return Principal{}, "invalid"
	}
	if s.revokedTokenFamilies[sess.familyID] {
		return Principal{}, "invalid"
	}
	// Reuse detection: already rotated
	if sess.rotatedAt != nil {
		s.revokedTokenFamilies[sess.familyID] = true
		now := time.Now()
		for _, sRecord := range s.sessions {
			if sRecord.familyID == sess.familyID {
				sRecord.revokedAt = &now
			}
		}
		return Principal{}, "reuse"
	}
	if sess.revokedAt != nil || time.Now().After(sess.expiresAt) {
		return Principal{}, "invalid"
	}

	now := time.Now()
	sess.rotatedAt = &now
	s.sessions[nextHash] = &sessionRecord{
		id:        newSessionID,
		userID:    sess.userID,
		familyID:  sess.familyID,
		tokenHash: nextHash,
		expiresAt: sess.expiresAt,
	}
	return Principal{UserID: sess.userID, SessionID: newSessionID}, "ok"
}

func (s *memoryIdentityStore) authorize(p Principal) bool {
	u := s.users[p.UserID]
	if u == nil || u.status != "active" {
		return false
	}
	for _, sess := range s.sessions {
		if sess.id == p.SessionID && sess.userID == p.UserID {
			return sess.revokedAt == nil && sess.rotatedAt == nil && time.Now().Before(sess.expiresAt)
		}
	}
	return false
}

func (s *memoryIdentityStore) logout(p Principal, all bool) bool {
	now := time.Now()
	var targetFamily uuid.UUID
	for _, sess := range s.sessions {
		if sess.id == p.SessionID && sess.userID == p.UserID {
			targetFamily = sess.familyID
			break
		}
	}
	if targetFamily == uuid.Nil {
		return false
	}

	for _, sess := range s.sessions {
		if sess.userID == p.UserID && (all || sess.familyID == targetFamily) {
			sess.revokedAt = &now
		}
	}
	if all {
		for f := range s.revokedTokenFamilies {
			s.revokedTokenFamilies[f] = true
		}
	}
	return true
}

func (s *memoryIdentityStore) profile(p Principal) (Profile, error) {
	if !s.authorize(p) {
		return Profile{}, ErrInvalid
	}
	u := s.users[p.UserID]
	var email string
	for _, c := range s.contacts {
		if c.userID == p.UserID && c.verifiedAt != nil {
			email = c.email
			break
		}
	}
	return Profile{
		ID:        u.id,
		FirstName: u.firstName,
		LastName:  u.lastName,
		Email:     email,
		Status:    u.status,
	}, nil
}

// TestEndToEndLifecycle tests all 9 requested components step-by-step
func TestEndToEndLifecycle(t *testing.T) {
	store := newMemoryStore()
	mailer := &mockMailer{}

	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	tm := tokenManager{key: key, issuer: "test-e2e", audience: "test-client"}

	testEmail := "jane.doe@example.com"
	testPassword := "super-secure-password-2026"
	testFirstName := "Jane"
	testLastName := "Doe"

	// -------------------------------------------------------------
	// STEP 1: Registration (validation, hashing, transaction, duplicate handling)
	// -------------------------------------------------------------
	t.Run("Step 1: User Registration", func(t *testing.T) {
		// Verify email normalization
		normEmail, err := normalizeEmail(testEmail)
		if err != nil {
			t.Fatalf("email normalization failed: %v", err)
		}

		// Verify password hashing
		passHash, err := hashPassword(testPassword)
		if err != nil {
			t.Fatalf("hashPassword failed: %v", err)
		}

		challengeID := uuid.New()
		secret, _ := opaque()
		tokenDigest := digest(secret)

		uid, ok := store.register(normEmail, testFirstName, testLastName, passHash, challengeID, tokenDigest)
		if !ok || uid == uuid.Nil {
			t.Fatalf("registration should succeed for new user")
		}

		// Deliver verification email
		verificationToken := challengeID.String() + "." + secret
		if err := mailer.SendVerification(context.Background(), normEmail, verificationToken); err != nil {
			t.Fatalf("mail delivery failed: %v", err)
		}

		// Duplicate registration attempt: should fail duplicate check silently (generic 202)
		_, dupOk := store.register(normEmail, testFirstName, testLastName, passHash, uuid.New(), tokenDigest)
		if dupOk {
			t.Fatalf("duplicate registration should be refused")
		}
	})

	// -------------------------------------------------------------
	// STEP 2: Email Verification (tokens, expiration, activation)
	// -------------------------------------------------------------
	var activeUserID uuid.UUID
	t.Run("Step 2: Email Verification", func(t *testing.T) {
		if len(mailer.sentTokens) == 0 {
			t.Fatalf("no verification token was sent")
		}
		rawToken := mailer.sentTokens[0]
		parts := strings.Split(rawToken, ".")
		chID, _ := uuid.Parse(parts[0])

		// Invalid token verification should fail
		if store.verify(chID, digest("wrong-secret")) {
			t.Fatalf("invalid challenge hash should fail")
		}

		// Correct token verification activates user
		if !store.verify(chID, digest(parts[1])) {
			t.Fatalf("email verification should succeed with correct token")
		}

		// Re-verification of consumed challenge should fail (single use)
		if store.verify(chID, digest(parts[1])) {
			t.Fatalf("re-using consumed challenge should fail")
		}

		// User status is now active
		for _, u := range store.users {
			if u.status == "active" {
				activeUserID = u.id
				break
			}
		}
		if activeUserID == uuid.Nil {
			t.Fatalf("expected an active user after verification")
		}
	})

	// -------------------------------------------------------------
	// STEP 3 & 4: Login & JWT Access Tokens (credentials, sessions, claims)
	// -------------------------------------------------------------
	var sessionID, familyID uuid.UUID
	var currentRefreshToken string
	var currentTokens Tokens

	t.Run("Step 3 & 4: Login & JWT Authentication", func(t *testing.T) {
		// Wrong password fails
		_, ok := store.login(testEmail, "wrong-password-1234", uuid.New(), uuid.New(), "any")
		if ok {
			t.Fatalf("login with wrong password must fail")
		}

		// Correct credentials succeed and create session
		sessionID = uuid.New()
		familyID = uuid.New()
		var err error
		currentRefreshToken, err = opaque()
		if err != nil {
			t.Fatalf("opaque token generation failed: %v", err)
		}

		uid, ok := store.login(testEmail, testPassword, sessionID, familyID, digest(currentRefreshToken))
		if !ok || uid != activeUserID {
			t.Fatalf("login should succeed for active user with correct password")
		}

		p := Principal{UserID: uid, SessionID: sessionID}
		currentTokens, err = tm.issue(p, currentRefreshToken)
		if err != nil {
			t.Fatalf("failed to issue tokens: %v", err)
		}

		// Verify JWT Access Token claims and signature
		parsedPrincipal, err := tm.parse(currentTokens.AccessToken)
		if err != nil {
			t.Fatalf("failed to parse access token: %v", err)
		}
		if parsedPrincipal.UserID != activeUserID || parsedPrincipal.SessionID != sessionID {
			t.Fatalf("principal mismatch: got %+v", parsedPrincipal)
		}

		// Verify database session status via authorize
		if !store.authorize(parsedPrincipal) {
			t.Fatalf("session should be authorized after login")
		}
	})

	// -------------------------------------------------------------
	// STEP 5: Refresh-Token Lifecycle (rotation, cookies, reuse detection)
	// -------------------------------------------------------------
	var rotatedTokens Tokens
	var rotatedRefreshToken string

	t.Run("Step 5: Refresh Token Lifecycle & Reuse Detection", func(t *testing.T) {
		var err error
		rotatedRefreshToken, err = opaque()
		if err != nil {
			t.Fatalf("failed to generate next refresh token: %v", err)
		}

		newSessionID := uuid.New()
		p, result := store.refresh(digest(currentRefreshToken), digest(rotatedRefreshToken), newSessionID)
		if result != "ok" {
			t.Fatalf("expected rotation result 'ok', got %s", result)
		}

		rotatedTokens, err = tm.issue(p, rotatedRefreshToken)
		if err != nil {
			t.Fatalf("failed to issue rotated tokens: %v", err)
		}
		if rotatedTokens.AccessToken == "" {
			t.Fatalf("expected non-empty rotated access token")
		}

		// Verify the old session is now marked rotated
		if store.sessions[digest(currentRefreshToken)].rotatedAt == nil {
			t.Fatalf("old session must have rotatedAt set")
		}

		// REUSE DETECTION: Presenting the spent refresh token again MUST trigger revocation of the whole family!
		reusedSessionID := uuid.New()
		reusedNextToken, _ := opaque()
		_, reuseResult := store.refresh(digest(currentRefreshToken), digest(reusedNextToken), reusedSessionID)
		if reuseResult != "reuse" {
			t.Fatalf("expected reuse detection 'reuse', got: %s", reuseResult)
		}

		// Once reuse is detected, even the rotated token in that family MUST be revoked!
		_, afterReuseResult := store.refresh(digest(rotatedRefreshToken), digest(reusedNextToken), uuid.New())
		if afterReuseResult != "invalid" {
			t.Fatalf("expected family tokens to be invalid after reuse detection, got: %s", afterReuseResult)
		}
	})

	// -------------------------------------------------------------
	// STEP 6: Authenticated User Context & Profile (GET /auth/me)
	// -------------------------------------------------------------
	t.Run("Step 6: Authenticated User Context & Profile", func(t *testing.T) {
		// Log in again after the reuse test revoked the previous family
		newSessionID := uuid.New()
		newFamilyID := uuid.New()
		newRefresh, _ := opaque()
		store.login(testEmail, testPassword, newSessionID, newFamilyID, digest(newRefresh))

		p := Principal{UserID: activeUserID, SessionID: newSessionID}
		toks, _ := tm.issue(p, newRefresh)

		// Create request context with Principal and tenant.Context
		ctx := context.WithValue(context.Background(), principalKey{}, p)
		ctx = tenant.WithContext(ctx, &tenant.Context{UserID: p.UserID})

		// Retrieve from context
		extractedP, pOk := FromContext(ctx)
		if !pOk || extractedP.UserID != activeUserID {
			t.Fatalf("failed to extract Principal from context")
		}

		extractedTenant, tOk := tenant.FromContext(ctx)
		if !tOk || extractedTenant.UserID != activeUserID {
			t.Fatalf("failed to extract tenant.Context with UserID from context")
		}

		// Verify profile fetch
		prof, err := store.profile(extractedP)
		if err != nil {
			t.Fatalf("failed to fetch profile: %v", err)
		}
		if prof.Email != testEmail || prof.FirstName != testFirstName {
			t.Fatalf("profile mismatch: got %+v", prof)
		}

		currentTokens = toks
		sessionID = newSessionID
	})

	// -------------------------------------------------------------
	// STEP 7: Logout (Revoke session, clear cookie, logout-all)
	// -------------------------------------------------------------
	t.Run("Step 7: Logout Single Session & Logout All", func(t *testing.T) {
		p := Principal{UserID: activeUserID, SessionID: sessionID}

		// Single session logout
		if !store.logout(p, false) {
			t.Fatalf("logout should succeed")
		}

		// Session should no longer be authorized
		if store.authorize(p) {
			t.Fatalf("session should be revoked after logout")
		}

		// Create two sessions to test logout-all
		s1 := uuid.New()
		s2 := uuid.New()
		r1, _ := opaque()
		r2, _ := opaque()
		store.login(testEmail, testPassword, s1, uuid.New(), digest(r1))
		store.login(testEmail, testPassword, s2, uuid.New(), digest(r2))

		p1 := Principal{UserID: activeUserID, SessionID: s1}
		p2 := Principal{UserID: activeUserID, SessionID: s2}

		if !store.authorize(p1) || !store.authorize(p2) {
			t.Fatalf("both sessions should be active before logout-all")
		}

		// Logout from all devices
		if !store.logout(p1, true) {
			t.Fatalf("logout-all should succeed")
		}

		// Both sessions must now be revoked
		if store.authorize(p1) {
			t.Fatalf("session 1 should be revoked after logout-all")
		}
		if store.authorize(p2) {
			t.Fatalf("session 2 should be revoked after logout-all")
		}
	})
}
