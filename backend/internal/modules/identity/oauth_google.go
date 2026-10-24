package identity

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var (
	ErrGoogleAuthFailed = errors.New("google: authentication failed")
	ErrInvalidState     = errors.New("google: invalid or expired oauth state parameter")
)

type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	StateSecret  []byte
}

type GoogleOAuthClient struct {
	clientID     string
	clientSecret string
	redirectURL  string
	stateSecret  []byte
	httpClient   *http.Client
}

func NewGoogleOAuthClient(cfg GoogleOAuthConfig) *GoogleOAuthClient {
	return &GoogleOAuthClient{
		clientID:     cfg.ClientID,
		clientSecret: cfg.ClientSecret,
		redirectURL:  cfg.RedirectURL,
		stateSecret:  cfg.StateSecret,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

// GenerateState creates an HMAC-signed state token with an expiry timestamp (15 minutes).
func (c *GoogleOAuthClient) GenerateState() (string, error) {
	exp := time.Now().Add(15 * time.Minute).Unix()
	randBytes, err := opaque()
	if err != nil {
		return "", err
	}
	payload := fmt.Sprintf("%d:%s", exp, randBytes)
	mac := hmac.New(sha256.New, c.stateSecret)
	mac.Write([]byte(payload))
	sig := mac.Sum(nil)
	token := fmt.Sprintf("%s.%s", base64.RawURLEncoding.EncodeToString([]byte(payload)), base64.RawURLEncoding.EncodeToString(sig))
	return token, nil
}

// ValidateState checks that the state token signature is authentic and not expired.
func (c *GoogleOAuthClient) ValidateState(state string) bool {
	parts := strings.Split(state, ".")
	if len(parts) != 2 {
		return false
	}
	rawPayload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return false
	}
	rawSig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, c.stateSecret)
	mac.Write(rawPayload)
	expectedSig := mac.Sum(nil)
	if !hmac.Equal(rawSig, expectedSig) {
		return false
	}
	payloadParts := strings.Split(string(rawPayload), ":")
	if len(payloadParts) != 2 {
		return false
	}
	exp, err := strconv.ParseInt(payloadParts[0], 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return false
	}
	return true
}

// AuthURL generates the Google OAuth 2.0 authorization URL.
func (c *GoogleOAuthClient) AuthURL(state string) string {
	q := url.Values{}
	q.Set("client_id", c.clientID)
	q.Set("redirect_uri", c.redirectURL)
	q.Set("response_type", "code")
	q.Set("scope", "openid email profile")
	q.Set("state", state)
	q.Set("access_type", "offline")
	q.Set("prompt", "select_account")
	return "https://accounts.google.com/o/oauth2/v2/auth?" + q.Encode()
}

type GoogleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

type googleTokenResponse struct {
	AccessToken string `json:"access_token"`
	IDToken     string `json:"id_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

// Exchange exchanges the authorization code for tokens and retrieves user info from Google.
func (c *GoogleOAuthClient) Exchange(ctx context.Context, code string) (*GoogleUserInfo, error) {
	data := url.Values{}
	data.Set("code", code)
	data.Set("client_id", c.clientID)
	data.Set("client_secret", c.clientSecret)
	data.Set("redirect_uri", c.redirectURL)
	data.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("google.token: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google.token.request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("%w: token endpoint returned status %d: %s", ErrGoogleAuthFailed, resp.StatusCode, string(body))
	}

	var tokenResp googleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("google.token.decode: %w", err)
	}

	if tokenResp.AccessToken == "" {
		return nil, fmt.Errorf("%w: missing access_token in token response", ErrGoogleAuthFailed)
	}

	// Fetch user info using access token
	userReq, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://openidconnect.googleapis.com/v1/userinfo", nil)
	if err != nil {
		return nil, fmt.Errorf("google.userinfo: %w", err)
	}
	userReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)

	userResp, err := c.httpClient.Do(userReq)
	if err != nil {
		return nil, fmt.Errorf("google.userinfo.request: %w", err)
	}
	defer userResp.Body.Close()

	if userResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(userResp.Body, 1024))
		return nil, fmt.Errorf("%w: userinfo endpoint returned status %d: %s", ErrGoogleAuthFailed, userResp.StatusCode, string(body))
	}

	var userInfo GoogleUserInfo
	if err := json.NewDecoder(userResp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("google.userinfo.decode: %w", err)
	}

	if userInfo.Sub == "" || userInfo.Email == "" {
		return nil, fmt.Errorf("%w: missing sub or email in userinfo", ErrGoogleAuthFailed)
	}

	return &userInfo, nil
}
