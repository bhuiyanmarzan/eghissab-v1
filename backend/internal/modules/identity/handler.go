package identity

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/bhuiyanmarzan/eghissab-v1/internal/database"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/httpx"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/middleware"
	"github.com/bhuiyanmarzan/eghissab-v1/internal/tenant"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type Config struct {
	SigningKeyBase64, Issuer, Audience string
	TrustedProxyCIDRs                  string
	GoogleClientID                     string
	GoogleClientSecret                 string
	GoogleRedirectURL                  string
}
type Module struct {
	Service        *Service
	logger         *slog.Logger
	trustedProxies []netip.Prefix
}

func NewModule(tx database.TxManager, config Config, mailer VerificationMailer, logger *slog.Logger) (*Module, error) {
	key, err := base64.StdEncoding.DecodeString(config.SigningKeyBase64)
	if err != nil || len(key) < 32 {
		return nil, fmt.Errorf("AUTH_SIGNING_KEY must be base64 encoding of at least 32 random bytes")
	}
	if config.Issuer == "" || config.Audience == "" || mailer == nil || tx == nil || logger == nil {
		return nil, fmt.Errorf("identity dependencies, issuer and audience are required")
	}
	var proxies []netip.Prefix
	for _, entry := range strings.Split(config.TrustedProxyCIDRs, ",") {
		if strings.TrimSpace(entry) == "" {
			continue
		}
		prefix, err := netip.ParsePrefix(strings.TrimSpace(entry))
		if err != nil {
			return nil, fmt.Errorf("AUTH_TRUSTED_PROXY_CIDRS contains an invalid CIDR")
		}
		proxies = append(proxies, prefix)
	}
	dummy, err := bcrypt.GenerateFromPassword([]byte("dummy-password-never-a-real-account"), 12)
	if err != nil {
		return nil, err
	}

	var googleClient *GoogleOAuthClient
	if config.GoogleClientID != "" {
		googleClient = NewGoogleOAuthClient(GoogleOAuthConfig{
			ClientID:     config.GoogleClientID,
			ClientSecret: config.GoogleClientSecret,
			RedirectURL:  config.GoogleRedirectURL,
			StateSecret:  key,
		})
	}

	return &Module{
		Service: &Service{
			tx:        tx,
			repo:      &Repository{},
			tokens:    tokenManager{key, config.Issuer, config.Audience},
			mail:      mailer,
			dummyHash: string(dummy),
			google:    googleClient,
		},
		logger:         logger,
		trustedProxies: proxies,
	}, nil
}
func (m *Module) RegisterRoutes(mux *http.ServeMux) {
	mux.Handle("POST /auth/register", m.limit("register", http.HandlerFunc(m.register)))
	mux.Handle("POST /auth/verify-email", m.limit("verify", http.HandlerFunc(m.verify)))
	mux.Handle("POST /auth/resend-verification", m.limit("resend", http.HandlerFunc(m.resend)))
	mux.Handle("POST /auth/login", m.limit("login", http.HandlerFunc(m.login)))
	mux.HandleFunc("POST /auth/refresh", m.refresh)
	mux.Handle("GET /auth/me", m.RequireAuth(http.HandlerFunc(m.me)))
	mux.Handle("POST /auth/logout", m.RequireAuth(http.HandlerFunc(m.logout)))
	mux.Handle("POST /auth/logout-all", m.RequireAuth(http.HandlerFunc(m.logoutAll)))

	// Google OAuth & Verified Linking
	mux.HandleFunc("GET /auth/google/url", m.googleAuthURL)
	mux.HandleFunc("GET /api/auth/google/url", m.googleAuthURL)
	mux.Handle("POST /auth/google/login", m.limit("google_login", http.HandlerFunc(m.googleLogin)))
	mux.Handle("POST /api/auth/google/login", m.limit("google_login", http.HandlerFunc(m.googleLogin)))
	mux.HandleFunc("GET /auth/google/callback", m.googleCallback)
	mux.HandleFunc("GET /api/auth/google/callback", m.googleCallback)
	mux.Handle("POST /auth/google/link/confirm", m.limit("google_link", http.HandlerFunc(m.confirmGoogleLink)))
	mux.Handle("POST /api/auth/google/link/confirm", m.limit("google_link", http.HandlerFunc(m.confirmGoogleLink)))

	// Multi-Contact Management
	mux.Handle("GET /auth/contacts", m.RequireAuth(http.HandlerFunc(m.getContacts)))
	mux.Handle("GET /api/auth/contacts", m.RequireAuth(http.HandlerFunc(m.getContacts)))
	mux.Handle("POST /auth/contacts", m.RequireAuth(http.HandlerFunc(m.addContact)))
	mux.Handle("POST /api/auth/contacts", m.RequireAuth(http.HandlerFunc(m.addContact)))
	mux.Handle("POST /auth/contacts/verify", m.RequireAuth(http.HandlerFunc(m.verifyContact)))
	mux.Handle("POST /api/auth/contacts/verify", m.RequireAuth(http.HandlerFunc(m.verifyContact)))
	mux.Handle("PUT /auth/contacts/{id}/primary", m.RequireAuth(http.HandlerFunc(m.setPrimaryContact)))
	mux.Handle("PUT /api/auth/contacts/{id}/primary", m.RequireAuth(http.HandlerFunc(m.setPrimaryContact)))
	mux.Handle("DELETE /auth/contacts/{id}", m.RequireAuth(http.HandlerFunc(m.deleteContact)))
	mux.Handle("DELETE /api/auth/contacts/{id}", m.RequireAuth(http.HandlerFunc(m.deleteContact)))

	// Multi-Identity Management
	mux.Handle("GET /auth/identities", m.RequireAuth(http.HandlerFunc(m.getIdentities)))
	mux.Handle("GET /api/auth/identities", m.RequireAuth(http.HandlerFunc(m.getIdentities)))
}
func (m *Module) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Fields(r.Header.Get("Authorization"))
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			m.fail(w, ErrInvalid)
			return
		}
		p, err := m.Service.Authenticate(r.Context(), parts[1])
		if err != nil {
			m.fail(w, err)
			return
		}
		ctx := context.WithValue(r.Context(), principalKey{}, p)
		ctx = tenant.WithContext(ctx, &tenant.Context{UserID: p.UserID})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	if ct := strings.Split(r.Header.Get("Content-Type"), ";")[0]; strings.TrimSpace(ct) != "application/json" {
		return fmt.Errorf("%w: Content-Type must be application/json", ErrValidation)
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return fmt.Errorf("%w: malformed JSON body", ErrValidation)
	}
	if d.Decode(&struct{}{}) != io.EOF {
		return fmt.Errorf("%w: a single JSON object is required", ErrValidation)
	}
	return nil
}

// respond is removed; use httpx.JSON or httpx.NoContent directly.
func (m *Module) fail(w http.ResponseWriter, err error) {
	w.Header().Set("Cache-Control", "no-store")
	var verr *ValidationError
	if errors.As(err, &verr) {
		httpx.ValidationError(w, http.StatusUnprocessableEntity, verr.Msg, httpx.CodeValidationFailed, verr.Field)
		return
	}
	switch {
	case errors.Is(err, ErrValidation):
		httpx.Error(w, 400, err.Error(), httpx.CodeValidationFailed)
	case errors.Is(err, ErrInvalid):
		w.Header().Set("WWW-Authenticate", "Bearer")
		httpx.Error(w, 401, "Invalid credentials or token", httpx.CodeUnauthenticated)
	case errors.Is(err, ErrLimited):
		w.Header().Set("Retry-After", "900")
		httpx.Error(w, 429, "Too many requests; try again later", httpx.CodeRateLimited)
	case errors.Is(err, ErrDelivery):
		httpx.Error(w, 503, "Email delivery unavailable; request a new verification email after one minute", httpx.Code("delivery_unavailable"))
	default:
		// Do not log raw SQL/mail errors: they may contain email addresses or credentials.
		m.logger.Error("identity operation failed", "error_type", fmt.Sprintf("%T", err))
		httpx.Error(w, 500, "Internal server error", httpx.CodeInternalError)
	}
}

/*
	func accepted(w http.ResponseWriter) {
		respond(w, 202, map[string]string{"message": "If eligible, verification instructions have been sent"})
	}
*/
func accepted(w http.ResponseWriter) {
	// Verification email instructions commented out - direct registration
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusCreated, map[string]string{"message": "Registration successful"})
}
func (m *Module) register(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestId := middleware.RequestIDFromContext(ctx)
	var req RegisterRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		m.logger.Error("failed to decode", "request_id", requestId, "err", err)
		httpx.Error(w, http.StatusBadRequest, "invalid body", httpx.CodeMalformedJson)
		return
	}

	if err := req.Validate(); err != nil {
		var verr *ValidationError
		errors.As(err, &verr)
		httpx.ValidationError(w, http.StatusUnprocessableEntity, err.Error(), httpx.CodeValidationFailed, verr.Field)
		return
	}

	if err := m.Service.Register(r.Context(), req); err != nil {
		m.fail(w, err)
		return
	}
	accepted(w)
}

func (m *Module) resend(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
	}
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := m.Service.Resend(r.Context(), in.Email); err != nil {
		m.fail(w, err)
		return
	}
	accepted(w)
}

func (m *Module) verify(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token string `json:"token"`
	}
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := m.Service.Verify(r.Context(), in.Token); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "Email verified"})
}

const refreshCookieName = "refresh_token"
const refreshCookieLifetime = 30 * 24 * time.Hour
const refreshCookiePath = "/"

func isHTTPS(r *http.Request) bool {
	if s := os.Getenv("AUTH_COOKIE_SECURE"); s != "" {
		return s == "true" || s == "1"
	}
	return r.TLS != nil ||
		strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") ||
		strings.EqualFold(r.Header.Get("X-Forwarded-Ssl"), "on")
}

func setRefreshCookie(w http.ResponseWriter, r *http.Request, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    token,
		Path:     refreshCookiePath,
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(refreshCookieLifetime / time.Second),
	})
}

func clearRefreshCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     refreshCookiePath,
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
	// Invalidate any legacy cookie previously bound to /auth
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     "/auth",
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

func (m *Module) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	out, err := m.Service.Login(r.Context(), in.Email, in.Password)
	if err != nil {
		m.fail(w, err)
		return
	}
	setRefreshCookie(w, r, out.RefreshToken)
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, out)
}

func (m *Module) refresh(w http.ResponseWriter, r *http.Request) {
	var refreshToken string

	// 1. Check HttpOnly cookie first (primary secure transport for browsers)
	if cookie, err := r.Cookie(refreshCookieName); err == nil && cookie.Value != "" {
		refreshToken = cookie.Value
	}

	// 2. If not provided in cookie, fall back to JSON request body
	if refreshToken == "" {
		ct := strings.Split(r.Header.Get("Content-Type"), ";")[0]
		if strings.TrimSpace(ct) == "application/json" && r.Body != nil && r.ContentLength > 0 {
			var in struct {
				Refresh string `json:"refresh_token"`
			}
			if err := decode(w, r, &in); err == nil && in.Refresh != "" {
				refreshToken = in.Refresh
			}
		}
	}

	if refreshToken == "" {
		m.fail(w, fmt.Errorf("%w: refresh_token required in request body or cookie", ErrValidation))
		return
	}

	out, err := m.Service.Refresh(r.Context(), refreshToken)
	if err != nil {
		m.fail(w, err)
		return
	}
	setRefreshCookie(w, r, out.RefreshToken)
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, out)
}

func (m *Module) me(w http.ResponseWriter, r *http.Request) {
	p, _ := FromContext(r.Context())
	out, err := m.Service.Profile(r.Context(), p)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (m *Module) logout(w http.ResponseWriter, r *http.Request)    { m.endSession(w, r, false) }
func (m *Module) logoutAll(w http.ResponseWriter, r *http.Request) { m.endSession(w, r, true) }
func (m *Module) endSession(w http.ResponseWriter, r *http.Request, all bool) {
	p, _ := FromContext(r.Context())
	if err := m.Service.Logout(r.Context(), p, all); err != nil {
		m.fail(w, err)
		return
	}
	clearRefreshCookie(w, r)
	httpx.NoContent(w)
}

func (m *Module) limit(action string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, err := m.clientIP(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid request", httpx.CodeRateLimited)
			return
		}
		if err = m.Service.budget(r.Context(), "ip:"+action+":"+ip); err != nil {
			httpx.Error(w, http.StatusTooManyRequests, "too many requests", httpx.CodeRateLimited)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Walk forwarded addresses only through explicitly trusted proxy hops, from right to left.
func (m *Module) clientIP(r *http.Request) (string, error) {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return "", err
	}
	peer, err := netip.ParseAddr(host)
	if err != nil {
		return "", err
	}
	peer = peer.Unmap()
	trusted := func(ip netip.Addr) bool {
		for _, prefix := range m.trustedProxies {
			if prefix.Contains(ip) {
				return true
			}
		}
		return false
	}
	forwarded := r.Header.Get("X-Forwarded-For")
	if !trusted(peer) || forwarded == "" {
		return peer.String(), nil
	}
	if len(forwarded) > 2048 {
		return "", ErrValidation
	}
	hops := strings.Split(forwarded, ",")
	if len(hops) > 32 {
		return "", ErrValidation
	}
	for i := len(hops) - 1; i >= 0 && trusted(peer); i-- {
		peer, err = netip.ParseAddr(strings.TrimSpace(hops[i]))
		if err != nil {
			return "", ErrValidation
		}
		peer = peer.Unmap()
	}
	return peer.String(), nil
}

func (m *Module) googleAuthURL(w http.ResponseWriter, r *http.Request) {
	authURL, err := m.Service.GoogleAuthURL()
	if err != nil {
		m.fail(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, map[string]string{"url": authURL})
}

func (m *Module) googleLogin(w http.ResponseWriter, r *http.Request) {
	var in GoogleLoginRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}
	res, err := m.Service.GoogleLogin(r.Context(), in.Code, in.State)
	if err != nil {
		m.fail(w, err)
		return
	}
	if res.LinkingRequired {
		w.Header().Set("Cache-Control", "no-store")
		httpx.JSON(w, http.StatusConflict, map[string]any{
			"status":               "linking_required",
			"link_challenge_token": res.LinkChallengeToken,
			"email":                res.Email,
			"message":              "An account with this email already exists. Confirm password or verify email to link Google account.",
		})
		return
	}
	setRefreshCookie(w, r, res.Tokens.RefreshToken)
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, res.Tokens)
}

func (m *Module) googleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if code == "" || state == "" {
		m.fail(w, &ValidationError{Field: "code", Msg: "authorization code and state are required"})
		return
	}
	res, err := m.Service.GoogleLogin(r.Context(), code, state)
	if err != nil {
		m.fail(w, err)
		return
	}
	if res.LinkingRequired {
		redirectURL := fmt.Sprintf("/login?linking_required=true&link_challenge_token=%s&email=%s", url.QueryEscape(res.LinkChallengeToken), url.QueryEscape(res.Email))
		http.Redirect(w, r, redirectURL, http.StatusFound)
		return
	}
	setRefreshCookie(w, r, res.Tokens.RefreshToken)
	http.Redirect(w, r, "/", http.StatusFound)
}

func (m *Module) confirmGoogleLink(w http.ResponseWriter, r *http.Request) {
	var in GoogleLinkConfirmRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}
	tokens, err := m.Service.ConfirmGoogleLink(r.Context(), in)
	if err != nil {
		m.fail(w, err)
		return
	}
	setRefreshCookie(w, r, tokens.RefreshToken)
	w.Header().Set("Cache-Control", "no-store")
	httpx.JSON(w, http.StatusOK, tokens)
}

func (m *Module) getContacts(w http.ResponseWriter, r *http.Request) {
	p, _ := FromContext(r.Context())
	contacts, err := m.Service.Contacts(r.Context(), p.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	if contacts == nil {
		contacts = []ContactResponse{}
	}
	httpx.JSON(w, http.StatusOK, contacts)
}

func (m *Module) addContact(w http.ResponseWriter, r *http.Request) {
	p, _ := FromContext(r.Context())
	var in AddContactRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}
	cid, err := m.Service.AddContact(r.Context(), p.UserID, in)
	if err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"id":      cid,
		"message": "contact added successfully",
	})
}

func (m *Module) verifyContact(w http.ResponseWriter, r *http.Request) {
	var in VerifyContactRequest
	if err := decode(w, r, &in); err != nil {
		m.fail(w, err)
		return
	}
	if err := in.Validate(); err != nil {
		m.fail(w, err)
		return
	}
	if err := m.Service.VerifyContact(r.Context(), in.Token); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "verified"})
}

func (m *Module) setPrimaryContact(w http.ResponseWriter, r *http.Request) {
	p, _ := FromContext(r.Context())
	idStr := r.PathValue("id")
	cid, err := uuid.Parse(idStr)
	if err != nil || cid == uuid.Nil {
		m.fail(w, &ValidationError{Field: "id", Msg: "invalid contact id"})
		return
	}
	if err := m.Service.SetPrimaryContact(r.Context(), p.UserID, cid); err != nil {
		m.fail(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "primary_updated"})
}

func (m *Module) deleteContact(w http.ResponseWriter, r *http.Request) {
	p, _ := FromContext(r.Context())
	idStr := r.PathValue("id")
	cid, err := uuid.Parse(idStr)
	if err != nil || cid == uuid.Nil {
		m.fail(w, &ValidationError{Field: "id", Msg: "invalid contact id"})
		return
	}
	if err := m.Service.DeleteContact(r.Context(), p.UserID, cid); err != nil {
		m.fail(w, err)
		return
	}
	httpx.NoContent(w)
}

func (m *Module) getIdentities(w http.ResponseWriter, r *http.Request) {
	p, _ := FromContext(r.Context())
	identities, err := m.Service.Identities(r.Context(), p.UserID)
	if err != nil {
		m.fail(w, err)
		return
	}
	if identities == nil {
		identities = []IdentityResponse{}
	}
	httpx.JSON(w, http.StatusOK, identities)
}

