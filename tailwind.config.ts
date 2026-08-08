import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blush: "var(--color-canvas)",
        panel: "var(--color-panel)",
        surface: "var(--color-paper)",
        "surface-2": "var(--color-lavender)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        border: "var(--color-rule)",
        accent: "var(--color-edit)",
        "accent-read": "var(--color-read)",
        "accent-files": "var(--color-shelf)",
        "accent-on": "var(--color-on-accent)",
        success: "var(--color-read)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
        "ink-muted": "var(--color-muted)",
        "markdown-gray": "var(--color-muted)"
      },
      boxShadow: {
        soft: "none"
      },
      fontFamily: {
        sans: ["var(--font-ui)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
        reader: ["var(--font-reader)"]
      }
    }
  },
  plugins: []
};

export default config;
