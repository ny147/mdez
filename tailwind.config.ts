import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        lagoon: "#07292f",
        abyss: "#071827",
        ice: "#9feaff",
        mint: "#8cffd7",
        lavender: "#c8a8ff",
        bubble: "#ff80cc",
        cream: "#fff8fb"
      },
      boxShadow: {
        glow: "0 0 26px rgba(159, 234, 255, 0.38)",
        sticker: "0 16px 50px rgba(0, 0, 0, 0.35)"
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Arial", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
