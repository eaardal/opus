package auth

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestParseIDToken_ExtractsField(t *testing.T) {
	token, err := parseIDToken([]byte(`{"id_token":"eyJ.ok","access_token":"ignored"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token != "eyJ.ok" {
		t.Errorf("got %q, want %q", token, "eyJ.ok")
	}
}

func TestParseIDToken_MissingFieldErrors(t *testing.T) {
	_, err := parseIDToken([]byte(`{"access_token":"x"}`))
	if err == nil {
		t.Error("expected error for missing id_token")
	}
}

func TestExchangeCodeForIDToken_SendsPKCEFieldsAndReturnsToken(t *testing.T) {
	var got struct {
		ClientID     string
		ClientSecret string
		Code         string
		CodeVerifier string
		GrantType    string
		RedirectURI  string
		ContentType  string
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.ContentType = r.Header.Get("Content-Type")
		body, _ := io.ReadAll(r.Body)
		form, _ := url.ParseQuery(string(body))
		got.ClientID = form.Get("client_id")
		got.ClientSecret = form.Get("client_secret")
		got.Code = form.Get("code")
		got.CodeVerifier = form.Get("code_verifier")
		got.GrantType = form.Get("grant_type")
		got.RedirectURI = form.Get("redirect_uri")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id_token":"eyJ.good"}`))
	}))
	defer server.Close()

	origEndpoint := tokenEndpoint
	tokenEndpoint = server.URL
	defer func() { tokenEndpoint = origEndpoint }()

	token, err := exchangeCodeForIDToken(
		context.Background(),
		"client-abc",
		"secret-shh",
		"auth-code-xyz",
		"verifier-123",
		"http://127.0.0.1:9999/callback",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token != "eyJ.good" {
		t.Errorf("token = %q, want %q", token, "eyJ.good")
	}
	if got.ClientID != "client-abc" {
		t.Errorf("client_id = %q", got.ClientID)
	}
	if got.ClientSecret != "secret-shh" {
		t.Errorf("client_secret = %q", got.ClientSecret)
	}
	if got.Code != "auth-code-xyz" {
		t.Errorf("code = %q", got.Code)
	}
	if got.CodeVerifier != "verifier-123" {
		t.Errorf("code_verifier = %q", got.CodeVerifier)
	}
	if got.GrantType != "authorization_code" {
		t.Errorf("grant_type = %q", got.GrantType)
	}
	if got.RedirectURI != "http://127.0.0.1:9999/callback" {
		t.Errorf("redirect_uri = %q", got.RedirectURI)
	}
	if !strings.HasPrefix(got.ContentType, "application/x-www-form-urlencoded") {
		t.Errorf("content-type = %q", got.ContentType)
	}
}

func TestExchangeCodeForIDToken_OmitsClientSecretWhenEmpty(t *testing.T) {
	var got struct {
		HasClientSecret bool
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		form, _ := url.ParseQuery(string(body))
		_, got.HasClientSecret = form["client_secret"]
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id_token":"eyJ.good"}`))
	}))
	defer server.Close()

	origEndpoint := tokenEndpoint
	tokenEndpoint = server.URL
	defer func() { tokenEndpoint = origEndpoint }()

	_, err := exchangeCodeForIDToken(context.Background(), "c", "", "code", "v", "http://127.0.0.1/callback")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.HasClientSecret {
		t.Error("client_secret should be omitted when empty")
	}
}

func TestExchangeCodeForIDToken_NonOKReturnsError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
	}))
	defer server.Close()

	origEndpoint := tokenEndpoint
	tokenEndpoint = server.URL
	defer func() { tokenEndpoint = origEndpoint }()

	_, err := exchangeCodeForIDToken(context.Background(), "c", "s", "code", "v", "http://127.0.0.1/callback")
	if err == nil {
		t.Error("expected error for non-200 response")
	}
}

