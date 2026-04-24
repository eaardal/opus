package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"testing"
)

func TestNewPKCEPair_VerifierLengthAndCharset(t *testing.T) {
	pair, err := newPKCEPair()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 32 random bytes → 43 base64url chars without padding.
	if len(pair.Verifier) != 43 {
		t.Errorf("verifier length = %d, want 43", len(pair.Verifier))
	}
	if _, err := base64.RawURLEncoding.DecodeString(pair.Verifier); err != nil {
		t.Errorf("verifier is not valid base64url: %v", err)
	}
}

func TestNewPKCEPair_ChallengeIsSHA256OfVerifier(t *testing.T) {
	pair, err := newPKCEPair()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	sum := sha256.Sum256([]byte(pair.Verifier))
	want := base64.RawURLEncoding.EncodeToString(sum[:])
	if pair.Challenge != want {
		t.Errorf("challenge = %q, want %q", pair.Challenge, want)
	}
}

func TestNewPKCEPair_IsRandomEachCall(t *testing.T) {
	a, err := newPKCEPair()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	b, err := newPKCEPair()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if a.Verifier == b.Verifier {
		t.Error("successive calls produced identical verifiers")
	}
}

func TestNewRandomState_IsURLSafeAndNonEmpty(t *testing.T) {
	s, err := newRandomState()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s == "" {
		t.Fatal("state is empty")
	}
	if _, err := base64.RawURLEncoding.DecodeString(s); err != nil {
		t.Errorf("state is not valid base64url: %v", err)
	}
}
