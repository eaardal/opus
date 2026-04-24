declare global {
  interface Window {
    runtime?: unknown;
  }
}

export const isDesktop =
  typeof window !== "undefined" && typeof window.runtime !== "undefined";
