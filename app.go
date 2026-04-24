package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
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

// SaveImageAs shows a save dialog for PNG and writes the base64-encoded image data to the selected file
func (a *App) SaveImageAs(base64Data string) (string, error) {
	filepath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export Canvas as PNG",
		DefaultFilename: "canvas.png",
		Filters: []runtime.FileFilter{
			{DisplayName: "PNG Images", Pattern: "*.png"},
		},
	})
	if err != nil {
		return "", err
	}
	if filepath == "" {
		return "", nil // User cancelled
	}
	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return "", err
	}
	err = os.WriteFile(filepath, data, 0644)
	if err != nil {
		return "", err
	}
	return filepath, nil
}
