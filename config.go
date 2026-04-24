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

// loadConfig reads the optional .env.local file (if present in the
// current working directory), then pulls known values from the process
// environment. Real environment variables override .env.local so CI and
// production builds can inject values without editing files.
func loadConfig() Config {
	loadEnvFile(".env.local")
	return Config{
		GoogleOAuthClientID:     os.Getenv(envGoogleOAuthClientID),
		GoogleOAuthClientSecret: os.Getenv(envGoogleOAuthClientSecret),
	}
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
