package auth

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"
)

// awaitAuthorizationCode opens the system browser to Google's consent
// page, waits for the OAuth callback on a loopback listener bound to a
// random free port, and returns the authorization code plus the exact
// redirect URI used (which must be repeated during token exchange).
func awaitAuthorizationCode(
	ctx context.Context,
	clientID, codeChallenge, state string,
	openBrowser func(string),
	timeout time.Duration,
) (code, redirectURI string, err error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", "", fmt.Errorf("listen: %w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	redirectURI = fmt.Sprintf("http://127.0.0.1:%d/callback", port)

	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)
	server := &http.Server{Handler: newCallbackHandler(state, codeCh, errCh)}
	go func() { _ = server.Serve(listener) }()
	defer shutdownServer(server)

	openBrowser(buildGoogleAuthURL(clientID, redirectURI, codeChallenge, state))

	select {
	case c := <-codeCh:
		return c, redirectURI, nil
	case e := <-errCh:
		return "", "", e
	case <-time.After(timeout):
		return "", "", fmt.Errorf("timed out waiting for sign-in")
	case <-ctx.Done():
		return "", "", ctx.Err()
	}
}

// shutdownServer gracefully shuts the callback server down with a short
// deadline so the user's browser callback response still flushes.
func shutdownServer(server *http.Server) {
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
}
