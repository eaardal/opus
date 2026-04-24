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
  },
});
