/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Emit manifest.json at the root of dist/ so the Wails desktop
    // bootstrap shell can discover the current entry-chunk filename
    // at runtime and load it from Firebase Hosting.
    manifest: "manifest.json",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    deps: {
      optimizer: {
        web: {
          include: ["@testing-library/react"],
        },
      },
    },
    coverage: {
      provider: "v8",
      // text          → printed to stdout (visible in CI logs)
      // text-summary  → compact one-block summary, also stdout
      // json-summary  → machine-readable, parsed in CI to build the markdown table
      reporter: ["text", "text-summary", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/test/**",
        "src/wailsjs/**",
      ],
    },
  },
});
