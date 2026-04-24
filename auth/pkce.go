package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
)

// pkcePair is a PKCE verifier + its S256 challenge (RFC 7636).
type pkcePair struct {
	Verifier  string
	Challenge string
}

// newPKCEPair generates a cryptographically random 43-octet verifier
// and its SHA-256 / base64url-encoded challenge.
func newPKCEPair() (pkcePair, error) {
	// 32 random bytes → 43 chars of base64url (no padding) — the minimum
	// recommended length per RFC 7636 §4.1.
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return pkcePair{}, err
	}
	verifier := base64.RawURLEncoding.EncodeToString(buf)
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	return pkcePair{Verifier: verifier, Challenge: challenge}, nil
}

// newRandomState returns a URL-safe random string used as the OAuth
// `state` parameter for CSRF protection.
func newRandomState() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
