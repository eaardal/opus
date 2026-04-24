package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// Config holds runtime configuration loaded from environment variables
// (optionally pre-populated by a .env.local file for local development).
type Config struct {
	GoogleOAuthClientID     string
	GoogleOAuthClientSecret string
}

// Environment variable names. Kept in one place so .env.local files and
// production deployments agree on what to set.
const (
	envGoogleOAuthClientID     = "GOOGLE_OAUTH_CLIENT_ID"
	envGoogleOAuthClientSecret = "GOOGLE_OAUTH_CLIENT_SECRET"
)

// Compile-time overrides. Empty by default; set via linker flags when
// producing a distributable binary so end users don't need to ship a
// .env.local alongside the app:
//
//	wails build -ldflags "-X main.defaultGoogleOAuthClientID=... \
//	                      -X main.defaultGoogleOAuthClientSecret=..."
//
// These must be `var` (not `const`) and strings for the -X flag to
// work. Environment variables still win, so the dev loop with
// .env.local stays unchanged.
var (
	defaultGoogleOAuthClientID     = ""
	defaultGoogleOAuthClientSecret = ""
)

// loadConfig pulls known values from, in order:
//  1. the process environment
//  2. the optional .env.local file (for local development)
//  3. compile-time defaults injected via -ldflags -X
func loadConfig() Config {
	loadEnvFile(".env.local")
	return Config{
		GoogleOAuthClientID:     envOrDefault(envGoogleOAuthClientID, defaultGoogleOAuthClientID),
		GoogleOAuthClientSecret: envOrDefault(envGoogleOAuthClientSecret, defaultGoogleOAuthClientSecret),
	}
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// loadEnvFile reads KEY=value pairs from the given file into the process
// environment. Lines starting with '#' and blank lines are ignored.
// Missing files are silently skipped so production builds work without
// one. Existing environment values are never overwritten.
func loadEnvFile(path string) {
	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "Warning: could not open env file:", err.Error())
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		applyEnvLine(scanner.Text())
	}
}

// applyEnvLine parses a single KEY=value line and sets it in the process
// environment if not already set. Quoted values have their surrounding
// quotes stripped.
func applyEnvLine(raw string) {
	line := strings.TrimSpace(raw)
	if line == "" || strings.HasPrefix(line, "#") {
		return
	}
	key, value, found := strings.Cut(line, "=")
	if !found {
		return
	}
	key = strings.TrimSpace(key)
	value = strings.TrimSpace(value)
	if len(value) >= 2 && value[0] == value[len(value)-1] && (value[0] == '"' || value[0] == '\'') {
		value = value[1 : len(value)-1]
	}
	if os.Getenv(key) == "" {
		os.Setenv(key, value)
	}
}
