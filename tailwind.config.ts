import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blush: "var(--bg)",
        panel: "var(--panel)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--fg)",
        muted: "var(--muted)",
        border: "var(--border)",
        accent: "var(--accent)",
        "accent-read": "var(--accent-read)",
        "accent-files": "var(--accent-files)",
        "accent-on": "var(--accent-on)",
        success: "var(--success)",
        warning: "var(--warn)",
        error: "var(--error)",
        "ink-muted": "var(--muted)",
        "markdown-gray": "var(--muted)"
      },
      boxShadow: {
        soft: "0 12px 28px rgb(83 45 92 / 10%)"
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
        reader: ["var(--font-reader)"]
      }
    }
  },
  plugins: []
};

export default config;
