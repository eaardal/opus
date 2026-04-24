package main

import (
	"context"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"domino/auth"
)

// App struct
type App struct {
	ctx context.Context
	cfg Config
}

// NewApp creates a new App application struct
func NewApp(cfg Config) *App {
	return &App{cfg: cfg}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// SignInWithGoogle runs the desktop-side of a PKCE OAuth 2.0 flow and
// returns a Google ID token. The frontend feeds the token to Firebase
// Auth via signInWithCredential.
func (a *App) SignInWithGoogle() (string, error) {
	runtime.LogInfo(a.ctx, "SignInWithGoogle: starting desktop OAuth flow")
	token, err := auth.SignInWithGoogle(a.ctx, a.cfg.GoogleOAuthClientID, a.cfg.GoogleOAuthClientSecret, func(url string) {
		runtime.LogInfof(a.ctx, "SignInWithGoogle: opening browser to %s", url)
		runtime.BrowserOpenURL(a.ctx, url)
	})
	if err != nil {
		runtime.LogErrorf(a.ctx, "SignInWithGoogle: %v", err)
		return "", err
	}
	runtime.LogInfo(a.ctx, "SignInWithGoogle: got ID token")
	return token, nil
}

// OpenFileResult contains the file content and path
type OpenFileResult struct {
	Content  string `json:"content"`
	FilePath string `json:"filePath"`
}

// SaveFileAs shows a save dialog and writes the data to the selected file, returns the filepath
func (a *App) SaveFileAs(data string) (string, error) {
	filepath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Tasks",
		DefaultFilename: "tasks.json",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
	if err != nil {
		return "", err
	}
	if filepath == "" {
		return "", nil // User cancelled
	}
	err = os.WriteFile(filepath, []byte(data), 0644)
	if err != nil {
		return "", err
	}
	return filepath, nil
}

// SaveFile writes the data to the specified file path
func (a *App) SaveFile(filepath string, data string) error {
	return os.WriteFile(filepath, []byte(data), 0644)
}

// OpenFile shows an open dialog and returns the file contents and path
func (a *App) OpenFile() (*OpenFileResult, error) {
	filepath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Tasks",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
	if err != nil {
		return nil, err
	}
	if filepath == "" {
		return nil, nil // User cancelled
	}
	content, err := os.ReadFile(filepath)
	if err != nil {
		return nil, err
	}
	return &OpenFileResult{
		Content:  string(content),
		FilePath: filepath,
	}, nil
}
