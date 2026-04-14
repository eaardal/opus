package atlassian

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	authEndpoint  = "https://auth.atlassian.com/authorize"
	tokenEndpoint = "https://auth.atlassian.com/oauth/token"
	meEndpoint    = "https://api.atlassian.com/me"

	callbackPath = "/callback"
	loginTimeout = 5 * time.Minute
)

var (
	// TODO: Replace these placeholders with your Atlassian OAuth 2.0 (3LO) app
	// credentials before using the login feature.
	//
	// Steps:
	//   1. Go to https://developer.atlassian.com/console/myapps/
	//   2. Create a new app → choose "OAuth 2.0 (3LO)"
	//   3. Under "Permissions", enable the Jira and Confluence APIs
	//   4. Under "Authorization", add callback URL: http://localhost
	//      (Atlassian accepts any port when the host is localhost)
	//   5. Copy the Client ID and Secret here.
	clientID     = os.Getenv("ATLASSIAN_CLIENT_ID")
	clientSecret = os.Getenv("ATLASSIAN_CLIENT_SECRET")
)

// scopes defines the Atlassian API permissions requested during login.
// Write/manage scopes are omitted until write features are implemented.
var scopes = []string{
	"read:me",                     // Current user profile — name, email, avatar
	"read:account",                // Basic Atlassian account info
	"offline_access",              // Refresh tokens — keeps the session alive
	"read:jira-user",              // View Jira user profiles
	"read:jira-work",              // Read Jira issues, projects, and boards
	"read:confluence-content.all", // Read all Confluence content
}

// AuthStatus is the current authentication state returned to the app layer.
type AuthStatus struct {
	LoggedIn    bool
	DisplayName string
	Email       string
}

// tokenResponse maps the JSON body from the Atlassian token endpoint.
type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

// meResponse maps the relevant fields from https://api.atlassian.com/me.
type meResponse struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// Auth orchestrates the Atlassian OAuth 2.0 (3LO) flow for desktop apps.
// It spins up a short-lived local HTTP server to receive the callback,
// then exchanges the authorization code for tokens and persists them to disk.
type Auth struct {
	browserOpen func(url string)
}

// New returns an Auth that opens the system browser using the provided function.
// Inject runtime.BrowserOpenURL from the Wails startup context.
func New(browserOpen func(url string)) *Auth {
	return &Auth{browserOpen: browserOpen}
}

// GetStatus returns the current authentication state by reading persisted
// tokens from disk. It does not make any network requests.
func (a *Auth) GetStatus() AuthStatus {
	tokens, err := loadTokens()
	if err != nil || tokens == nil {
		return AuthStatus{}
	}
	return AuthStatus{
		LoggedIn:    true,
		DisplayName: tokens.DisplayName,
		Email:       tokens.Email,
	}
}

// StartLogin initiates the OAuth 2.0 authorization code flow. It blocks until
// the user completes the browser login, an error is returned by Atlassian, or
// the 5-minute timeout expires. Wails runs each bound method in its own
// goroutine, so this blocking call does not freeze the UI.
func (a *Auth) StartLogin() error {
	state, err := randomHex(16)
	if err != nil {
		return fmt.Errorf("generate state: %w", err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("start callback listener: %w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	redirectURI := fmt.Sprintf("http://localhost:%d%s", port, callbackPath)

	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)

	mux := http.NewServeMux()
	mux.HandleFunc(callbackPath, func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		if q.Get("state") != state {
			writeCallbackPage(w, false)
			errCh <- fmt.Errorf("OAuth state mismatch — possible CSRF attack")
			return
		}

		if errParam := q.Get("error"); errParam != "" {
			writeCallbackPage(w, false)
			errCh <- fmt.Errorf("Atlassian denied access: %s — %s", errParam, q.Get("error_description"))
			return
		}

		code := q.Get("code")
		if code == "" {
			writeCallbackPage(w, false)
			errCh <- fmt.Errorf("OAuth callback missing authorization code")
			return
		}

		writeCallbackPage(w, true)
		codeCh <- code
	})

	srv := &http.Server{Handler: mux}
	go func() {
		if serveErr := srv.Serve(listener); serveErr != nil && serveErr != http.ErrServerClosed {
			errCh <- fmt.Errorf("callback server: %w", serveErr)
		}
	}()
	defer srv.Shutdown(context.Background()) //nolint:errcheck

	a.browserOpen(buildAuthURL(redirectURI, state))

	select {
	case code := <-codeCh:
		tr, err := exchangeCode(code, redirectURI)
		if err != nil {
			return fmt.Errorf("exchange code: %w", err)
		}
		me, err := fetchMe(tr.AccessToken)
		if err != nil {
			return fmt.Errorf("fetch user info: %w", err)
		}
		return saveTokens(&StoredTokens{
			AccessToken:  tr.AccessToken,
			RefreshToken: tr.RefreshToken,
			ExpiresAt:    time.Now().Add(time.Duration(tr.ExpiresIn) * time.Second),
			DisplayName:  me.Name,
			Email:        me.Email,
		})

	case loginErr := <-errCh:
		return loginErr

	case <-time.After(loginTimeout):
		return fmt.Errorf("login timed out after %s", loginTimeout)
	}
}

// Logout removes the stored tokens from disk.
func (a *Auth) Logout() error {
	return deleteTokens()
}

func buildAuthURL(redirectURI, state string) string {
	params := url.Values{
		"audience":      {"api.atlassian.com"},
		"client_id":     {clientID},
		"scope":         {strings.Join(scopes, " ")},
		"redirect_uri":  {redirectURI},
		"state":         {state},
		"response_type": {"code"},
		"prompt":        {"consent"},
	}
	return authEndpoint + "?" + params.Encode()
}

func exchangeCode(code, redirectURI string) (*tokenResponse, error) {
	payload, _ := json.Marshal(map[string]string{
		"grant_type":    "authorization_code",
		"client_id":     clientID,
		"client_secret": clientSecret,
		"code":          code,
		"redirect_uri":  redirectURI,
	})
	resp, err := http.Post(tokenEndpoint, "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("POST token: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token endpoint %d: %s", resp.StatusCode, body)
	}
	var tr tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return nil, fmt.Errorf("decode token response: %w", err)
	}
	return &tr, nil
}

func fetchMe(accessToken string) (*meResponse, error) {
	req, _ := http.NewRequest(http.MethodGet, meEndpoint, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GET /me: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("/me returned %d: %s", resp.StatusCode, body)
	}
	var me meResponse
	if err := json.NewDecoder(resp.Body).Decode(&me); err != nil {
		return nil, fmt.Errorf("decode /me response: %w", err)
	}
	return &me, nil
}

// writeCallbackPage sends a minimal HTML page to the browser tab that opened
// for login, telling the user they can return to Domino.
func writeCallbackPage(w http.ResponseWriter, success bool) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if success {
		fmt.Fprint(w, `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;margin-top:80px">
<h2>&#x2713; Login successful</h2>
<p>You can close this tab and return to Domino.</p>
</body></html>`)
	} else {
		fmt.Fprint(w, `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;margin-top:80px">
<h2>&#x2717; Login failed</h2>
<p>An error occurred during login. Please try again in Domino.</p>
</body></html>`)
	}
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
