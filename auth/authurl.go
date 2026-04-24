package auth

import "net/url"

const (
	googleAuthEndpoint = "https://accounts.google.com/o/oauth2/v2/auth"
	// Scopes Firebase expects for a Google sign-in credential.
	// openid is required to receive an ID token.
	googleScopes = "openid email profile"
)

// buildGoogleAuthURL assembles the authorization-endpoint URL a user is
// redirected to in order to grant consent to the desktop app.
func buildGoogleAuthURL(clientID, redirectURI, codeChallenge, state string) string {
	q := url.Values{}
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("response_type", "code")
	q.Set("scope", googleScopes)
	q.Set("code_challenge", codeChallenge)
	q.Set("code_challenge_method", "S256")
	q.Set("state", state)
	q.Set("access_type", "online")
	q.Set("prompt", "select_account")
	return googleAuthEndpoint + "?" + q.Encode()
}
