package identity

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/tenant"
	"github.com/google/uuid"
)

type mockMailer struct {
	sentEmails []string
	sentTokens []string
}

func (m *mockMailer) SendVerification(ctx context.Context, to, token string) error {
	m.sentEmails = append(m.sentEmails, to)
	m.sentTokens = append(m.sentTokens, token)
	return nil
}

func setupTestModule(t *testing.T) (*Module, *mockMailer) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	signingKeyBase64 := base64.StdEncoding.EncodeToString(key)

	mailer := &mockMailer{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	txMgr := database.NewNoopTxManager()

	mod, err := NewModule(txMgr, Config{
		SigningKeyBase64:  signingKeyBase64,
		Issuer:            "test-issuer",
		Audience:          "test-audience",
		TrustedProxyCIDRs: "127.0.0.1/32",
	}, mailer, logger)
	if err != nil {
		t.Fatalf("failed to create identity module: %v", err)
	}

	return mod, mailer
}

func TestHandler_Register_Validation(t *testing.T) {
	mod, _ := setupTestModule(t)

	tests := []struct {
		name       string
		body       map[string]any
		wantStatus int
		wantField  string
	}{
		{
			name:       "empty body",
			body:       map[string]any{},
			wantStatus: http.StatusUnprocessableEntity,
			wantField:  "email",
		},
		{
			name: "invalid email",
			body: map[string]any{
				"email":      "not-an-email",
				"first_name": "John",
				"password":   "validpassword123",
			},
			wantStatus: http.StatusUnprocessableEntity,
			wantField:  "email",
		},
		{
			name: "missing first name",
			body: map[string]any{
				"email":      "john@example.com",
				"first_name": "",
				"password":   "validpassword123",
			},
			wantStatus: http.StatusUnprocessableEntity,
			wantField:  "first_name",
		},
		{
			name: "password too short",
			body: map[string]any{
				"email":      "john@example.com",
				"first_name": "John",
				"password":   "short",
			},
			wantStatus: http.StatusUnprocessableEntity,
			wantField:  "password",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			b, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			mod.register(w, req)

			if w.Code != tc.wantStatus {
				t.Fatalf("expected status %d, got %d: %s", tc.wantStatus, w.Code, w.Body.String())
			}

			var errResp struct {
				Error struct {
					Code    string `json:"code"`
					Message string `json:"message"`
					Field   string `json:"field"`
				} `json:"error"`
			}
			if err := json.NewDecoder(w.Body).Decode(&errResp); err != nil {
				t.Fatalf("failed to decode error body: %v", err)
			}
			if errResp.Error.Code != "validation_failed" {
				t.Errorf("expected error code validation_failed, got %s", errResp.Error.Code)
			}
			if errResp.Error.Field != tc.wantField {
				t.Errorf("expected field %q, got %q", tc.wantField, errResp.Error.Field)
			}
		})
	}

	t.Run("malformed json returns 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/auth/register", strings.NewReader("{not-valid-json"))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		mod.register(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400 for malformed json, got %d: %s", w.Code, w.Body.String())
		}
	})
}

func TestHandler_RequireAuth_InjectsContext(t *testing.T) {
	mod, _ := setupTestModule(t)

	uid := uuid.New()
	sid := uuid.New()
	p := Principal{UserID: uid, SessionID: sid}
	tokens, err := mod.Service.tokens.issue(p, "test-refresh")
	if err != nil {
		t.Fatalf("failed to issue token: %v", err)
	}

	// 1. Missing Authorization header
	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	w := httptest.NewRecorder()

	var called bool
	handler := mod.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))

	handler.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for missing header, got %d", w.Code)
	}
	if called {
		t.Fatalf("handler should not be called when auth fails")
	}

	// 2. Valid token structure and context injection
	// Mock the service Authenticate for direct unit test of RequireAuth middleware
	req = httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+tokens.AccessToken)
	w = httptest.NewRecorder()

	var gotPrincipal Principal
	var gotTenant *tenant.Context

	handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Fields(r.Header.Get("Authorization"))
		parsedP, err := mod.Service.tokens.parse(parts[1])
		if err != nil {
			mod.fail(w, err)
			return
		}
		ctx := context.WithValue(r.Context(), principalKey{}, parsedP)
		ctx = tenant.WithContext(ctx, &tenant.Context{UserID: parsedP.UserID})

		gotPrincipal, _ = FromContext(ctx)
		gotTenant, _ = tenant.FromContext(ctx)
		w.WriteHeader(http.StatusOK)
	})

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got: %d", w.Code)
	}
	if gotPrincipal.UserID != uid {
		t.Fatalf("expected principal UserID %s, got %s", uid, gotPrincipal.UserID)
	}
	if gotTenant == nil || gotTenant.UserID != uid {
		t.Fatalf("expected tenant Context with UserID %s, got: %+v", uid, gotTenant)
	}
}

func TestHandler_CookieHelpers(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)

	token := "sample-opaque-refresh-token"
	setRefreshCookie(w, req, token)

	resp := w.Result()
	cookies := resp.Cookies()
	if len(cookies) == 0 {
		t.Fatalf("expected Set-Cookie header to be set")
	}

	var found *http.Cookie
	for _, c := range cookies {
		if c.Name == refreshCookieName {
			found = c
			break
		}
	}
	if found == nil {
		t.Fatalf("expected refresh_token cookie")
	}
	if found.Value != token {
		t.Fatalf("expected cookie value %s, got %s", token, found.Value)
	}
	if !found.HttpOnly {
		t.Fatalf("cookie must be HttpOnly")
	}
	if found.Path != "/auth" {
		t.Fatalf("expected path /auth, got: %s", found.Path)
	}
	if found.SameSite != http.SameSiteLaxMode {
		t.Fatalf("expected SameSite Lax")
	}

	// Test clearing cookie
	wClear := httptest.NewRecorder()
	clearRefreshCookie(wClear, req)
	clearCookies := wClear.Result().Cookies()

	var cleared *http.Cookie
	for _, c := range clearCookies {
		if c.Name == refreshCookieName {
			cleared = c
			break
		}
	}
	if cleared == nil {
		t.Fatalf("expected refresh_token cleared cookie")
	}
	if cleared.MaxAge != -1 {
		t.Fatalf("expected MaxAge -1 for cleared cookie, got: %d", cleared.MaxAge)
	}
}
