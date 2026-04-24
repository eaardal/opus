package auth

import (
	"net/url"
	"strings"
	"testing"
)

func TestBuildGoogleAuthURL_ContainsRequiredParams(t *testing.T) {
	got := buildGoogleAuthURL("client-123", "http://127.0.0.1:9999/callback", "challenge-abc", "state-xyz")

	if !strings.HasPrefix(got, googleAuthEndpoint+"?") {
		t.Fatalf("URL does not target the auth endpoint: %s", got)
	}

	parsed, err := url.Parse(got)
	if err != nil {
		t.Fatalf("unparseable URL: %v", err)
	}
	q := parsed.Query()

	cases := map[string]string{
		"client_id":             "client-123",
		"redirect_uri":          "http://127.0.0.1:9999/callback",
		"response_type":         "code",
		"scope":                 googleScopes,
		"code_challenge":        "challenge-abc",
		"code_challenge_method": "S256",
		"state":                 "state-xyz",
	}
	for key, want := range cases {
		if got := q.Get(key); got != want {
			t.Errorf("param %s = %q, want %q", key, got, want)
		}
	}
}
