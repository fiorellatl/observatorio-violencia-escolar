import type { Config } from "tailwindcss";

// El sistema vive en globals.css como variables CSS; aquí solo se exponen a
// Tailwind. Una sola fuente de verdad: si un color no está en :root, no existe.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
        },
        rule: { DEFAULT: "var(--rule)", 2: "var(--rule-2)", 3: "var(--rule-3)" },
        accent: {
          DEFAULT: "var(--accent)",
          2: "var(--accent-2)",
          soft: "var(--accent-soft)",
        },
        warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)" },
        data: {
          1: "var(--data-1)",
          2: "var(--data-2)",
          3: "var(--data-3)",
          4: "var(--data-4)",
          5: "var(--data-5)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: { prose: "62ch", shell: "1180px", read: "700px", ancho: "1400px" },
      borderRadius: { sm: "var(--r-1)", DEFAULT: "var(--r-2)", md: "var(--r-2)", lg: "var(--r-3)" },
      fontSize: {
        // Editorial: el salto entre niveles es grande a propósito. Una
        // jerarquía con seis tamaños parecidos no es una jerarquía.
        "display-xxl": ["clamp(2.9rem,7.5vw,5.6rem)", { lineHeight: "0.98", letterSpacing: "-0.032em" }],
        "display-xl": ["clamp(2.2rem,5vw,3.5rem)", { lineHeight: "1.05", letterSpacing: "-0.024em" }],
        "display-l": ["clamp(1.6rem,3.4vw,2.35rem)", { lineHeight: "1.14", letterSpacing: "-0.018em" }],
        "display-m": ["clamp(1.22rem,2.2vw,1.55rem)", { lineHeight: "1.22", letterSpacing: "-0.011em" }],
        // Cifras: tres pesos según el papel que hacen en la página.
        "cifra-xl": ["clamp(2.6rem,6vw,4.2rem)", { lineHeight: "0.92", letterSpacing: "-0.03em" }],
        "cifra-l": ["clamp(1.9rem,3.6vw,2.6rem)", { lineHeight: "0.95", letterSpacing: "-0.026em" }],
        "cifra-m": ["1.5rem", { lineHeight: "1", letterSpacing: "-0.02em" }],
        cuerpo: ["1.01rem", { lineHeight: "1.62" }],
        "cuerpo-s": ["0.9rem", { lineHeight: "1.58" }],
      },
      transitionTimingFunction: { suave: "cubic-bezier(0.4, 0, 0.2, 1)" },
    },
  },
  plugins: [],
};
export default config;
