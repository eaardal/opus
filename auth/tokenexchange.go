package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const googleTokenEndpoint = "https://oauth2.googleapis.com/token"

// tokenEndpoint is overridden in tests.
var tokenEndpoint = googleTokenEndpoint

// exchangeCodeForIDToken redeems an authorization code for a Google ID
// token using the PKCE verifier. No client secret is sent — desktop
// OAuth clients are public and rely on PKCE instead.
func exchangeCodeForIDToken(ctx context.Context, clientID, code, codeVerifier, redirectURI string) (string, error) {
	form := url.Values{}
	form.Set("client_id", clientID)
	form.Set("code", code)
	form.Set("code_verifier", codeVerifier)
	form.Set("grant_type", "authorization_code")
	form.Set("redirect_uri", redirectURI)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("post: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read body: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token endpoint returned %d: %s", resp.StatusCode, body)
	}
	return parseIDToken(body)
}

// parseIDToken extracts the id_token field from a Google token response.
func parseIDToken(body []byte) (string, error) {
	var out struct {
		IDToken string `json:"id_token"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return "", fmt.Errorf("decode: %w", err)
	}
	if out.IDToken == "" {
		return "", fmt.Errorf("token response missing id_token")
	}
	return out.IDToken, nil
}
