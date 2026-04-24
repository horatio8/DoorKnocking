import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        navy: {
          DEFAULT: "#0B1F3A",
          50: "#E7EBF2",
          100: "#C2CBDC",
          500: "#1F3B6B",
          700: "#13294B",
          900: "#0B1F3A",
        },
        crimson: {
          DEFAULT: "#B5121B",
          500: "#D4242D",
          700: "#8F0C13",
        },
        // Client-themeable tokens. Use `bg-client-primary`, `text-client-accent` etc.
        client: {
          primary: "var(--client-primary)",
          accent: "var(--client-accent)",
        },
        pin: {
          not_knocked: "#2563EB",
          come_back: "#F59E0B",
          no_answer: "#F97316",
          contacted: "#6B7280",
          refused: "#DC2626",
          mixed: "#7C3AED",
        },

        // Civic marketing palette (from design_handoff_onboarding_flow/styles.css).
        // Scoped to its own keys so the admin + knocker surfaces don't shift.
        ink: { DEFAULT: "#1A1817", 2: "#2E2B27" },
        civic: {
          navy: "#0B2545",
          "navy-2": "#143059",
          "navy-3": "#1E4680",
          green: "#2E5E3A",
          amber: "#8A6A1B",
        },
        oxblood: { DEFAULT: "#8B2635", 2: "#6E1E2A" },
        gold: "#A47E3B",
        parchment: { DEFAULT: "#F7F3EC", 2: "#EEE7DB" },
        paper: "#FBFAF6",
        rule: { DEFAULT: "#CFC7B5", 2: "#E3DCCC", dark: "#1F1C18" },
        mute: { DEFAULT: "#6B655A", 2: "#8C867A" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["'Source Serif 4'", "'Source Serif Pro'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "'SF Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
export default config;
