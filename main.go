package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

// The Wails binary embeds only a thin bootstrap shell. The shell loads
// the current React bundle from Firebase Hosting at launch, so shipping
// a web deploy updates the desktop app without a binary rebuild.
// See frontend/desktop-shell/index.html.
//
//go:embed all:frontend/desktop-shell
var assets embed.FS

func main() {
	cfg := loadConfig()

	// Create an instance of the app structure
	app := NewApp(cfg)

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Domino",
		Width:  1280,
		Height: 900,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []any{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
