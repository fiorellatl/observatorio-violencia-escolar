import type { Config } from "tailwindcss";

// Identidad: instrumento cívico, no dashboard. Papel gris documento, tinta casi
// negra, un solo acento verde pino usado con avaricia. Los colores de dato son
// aparte y están validados para daltonismo.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        rule: { DEFAULT: "var(--rule)", 2: "var(--rule-2)" },
        accent: { DEFAULT: "var(--accent)", soft: "var(--accent-soft)" },
        warn: "var(--warn)",
        data: { 1: "var(--data-1)", 2: "var(--data-2)", 3: "var(--data-3)" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: { prose: "64ch", shell: "1120px", read: "720px" },
      fontSize: {
        "display-xl": ["clamp(2.4rem,6vw,4.1rem)", { lineHeight: "1.04", letterSpacing: "-0.02em" }],
        "display-l": ["clamp(1.7rem,4vw,2.6rem)", { lineHeight: "1.14", letterSpacing: "-0.015em" }],
        "display-m": ["clamp(1.35rem,3vw,1.8rem)", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        stat: ["clamp(1.9rem,4.5vw,2.7rem)", { lineHeight: "1", letterSpacing: "-0.025em" }],
      },
    },
  },
  plugins: [],
};
export default config;
