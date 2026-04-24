package auth

import (
	"fmt"
	"net/http"
)

// newCallbackHandler returns the http.Handler that terminates the OAuth
// loopback flow: on success it puts the authorization code on codeCh; on
// any failure it puts an error on errCh.
func newCallbackHandler(expectedState string, codeCh chan<- string, errCh chan<- error) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/callback" {
			http.NotFound(w, r)
			return
		}
		q := r.URL.Query()
		if errParam := q.Get("error"); errParam != "" {
			writeCallbackPage(w, false, q.Get("error_description"))
			errCh <- fmt.Errorf("google denied access: %s", errParam)
			return
		}
		if q.Get("state") != expectedState {
			writeCallbackPage(w, false, "state parameter did not match")
			errCh <- fmt.Errorf("state mismatch")
			return
		}
		code := q.Get("code")
		if code == "" {
			writeCallbackPage(w, false, "authorization code missing from response")
			errCh <- fmt.Errorf("missing authorization code")
			return
		}
		writeCallbackPage(w, true, "")
		codeCh <- code
	})
}

// writeCallbackPage renders a minimal HTML page shown in the user's
// browser after the OAuth redirect completes. The Wails window remains
// the user-facing surface; this page is just feedback.
func writeCallbackPage(w http.ResponseWriter, success bool, detail string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if success {
		fmt.Fprint(w, successPage)
		return
	}
	fmt.Fprintf(w, failurePage, detail)
}

const successPage = `<!doctype html>
<html><head><meta charset="utf-8"><title>Signed in — Domino</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0f1115;color:#e6e6e6}
.card{text-align:center;padding:2rem 3rem;border-radius:12px;background:#1a1d24}</style>
</head><body><div class="card"><h1>Signed in</h1>
<p>You can close this tab and return to Domino.</p></div></body></html>`

const failurePage = `<!doctype html>
<html><head><meta charset="utf-8"><title>Sign-in failed — Domino</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0f1115;color:#e6e6e6}
.card{text-align:center;padding:2rem 3rem;border-radius:12px;background:#1a1d24}
.detail{color:#ff8080;font-size:.9rem;margin-top:.5rem}</style>
</head><body><div class="card"><h1>Sign-in failed</h1>
<p>Return to Domino and try again.</p><p class="detail">%s</p></div></body></html>`
