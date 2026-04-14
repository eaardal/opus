package atlassian

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const (
	configDirName = "Domino"
	tokenFileName = "atlassian_tokens.json"
)

// StoredTokens holds OAuth tokens and the user's profile, persisted to disk.
// File is written to $HOME/.config/Domino/atlassian_tokens.json with mode 0600.
type StoredTokens struct {
	AccessToken  string    `json:"accessToken"`
	RefreshToken string    `json:"refreshToken"`
	ExpiresAt    time.Time `json:"expiresAt"`
	DisplayName  string    `json:"displayName"`
	Email        string    `json:"email"`
}

func tokenFilePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("get home dir: %w", err)
	}
	return filepath.Join(home, ".config", configDirName, tokenFileName), nil
}

func loadTokens() (*StoredTokens, error) {
	path, err := tokenFilePath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read token file: %w", err)
	}
	var tokens StoredTokens
	if err := json.Unmarshal(data, &tokens); err != nil {
		return nil, fmt.Errorf("parse token file: %w", err)
	}
	return &tokens, nil
}

func saveTokens(tokens *StoredTokens) error {
	path, err := tokenFilePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}
	data, err := json.MarshalIndent(tokens, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal tokens: %w", err)
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("write token file: %w", err)
	}
	return nil
}

func deleteTokens() error {
	path, err := tokenFilePath()
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
