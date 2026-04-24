package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCallbackHandler_SuccessDeliversCode(t *testing.T) {
	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)
	h := newCallbackHandler("expected-state", codeCh, errCh)

	req := httptest.NewRequest(http.MethodGet, "/callback?state=expected-state&code=abc-123", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	select {
	case code := <-codeCh:
		if code != "abc-123" {
			t.Errorf("code = %q, want %q", code, "abc-123")
		}
	default:
		t.Error("expected code on codeCh")
	}
	if len(errCh) != 0 {
		t.Error("errCh should be empty on success")
	}
}

func TestCallbackHandler_StateMismatchFails(t *testing.T) {
	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)
	h := newCallbackHandler("expected-state", codeCh, errCh)

	req := httptest.NewRequest(http.MethodGet, "/callback?state=wrong&code=abc", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if len(errCh) != 1 {
		t.Fatalf("expected one error, got %d", len(errCh))
	}
	if len(codeCh) != 0 {
		t.Error("codeCh should be empty on state mismatch")
	}
}

func TestCallbackHandler_ProviderErrorFails(t *testing.T) {
	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)
	h := newCallbackHandler("expected-state", codeCh, errCh)

	req := httptest.NewRequest(http.MethodGet, "/callback?error=access_denied&error_description=user%20cancelled", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if len(errCh) != 1 {
		t.Fatalf("expected one error, got %d", len(errCh))
	}
}

func TestCallbackHandler_UnknownPathIs404(t *testing.T) {
	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)
	h := newCallbackHandler("expected-state", codeCh, errCh)

	req := httptest.NewRequest(http.MethodGet, "/somewhere-else", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rr.Code)
	}
}
