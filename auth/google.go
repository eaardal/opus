// Package auth implements the desktop-side of a Firebase-compatible
// Google OAuth 2.0 flow. The Wails shell opens the system browser,
// receives the authorization code on a loopback listener, and exchanges
// it for a Google ID token that the frontend feeds to Firebase Auth.
package auth

import (
	"context"
	"fmt"
	"time"
)

const signInTimeout = 5 * time.Minute

// SignInWithGoogle runs a PKCE-protected OAuth 2.0 flow against Google's
// authorization server and returns a Google ID token. The ID token is
// intended to be passed to Firebase Auth on the frontend via
// signInWithCredential(GoogleAuthProvider.credential(idToken)).
//
// The openBrowser callback is expected to open the given URL in the
// user's default browser (Wails' runtime.BrowserOpenURL).
func SignInWithGoogle(ctx context.Context, clientID string, openBrowser func(string)) (string, error) {
	if clientID == "" {
		return "", fmt.Errorf("google OAuth client ID not configured")
	}
	pair, err := newPKCEPair()
	if err != nil {
		return "", fmt.Errorf("pkce: %w", err)
	}
	state, err := newRandomState()
	if err != nil {
		return "", fmt.Errorf("state: %w", err)
	}
	code, redirectURI, err := awaitAuthorizationCode(ctx, clientID, pair.Challenge, state, openBrowser, signInTimeout)
	if err != nil {
		return "", err
	}
	return exchangeCodeForIDToken(ctx, clientID, code, pair.Verifier, redirectURI)
}
