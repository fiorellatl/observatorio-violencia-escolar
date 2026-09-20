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
        // La noche: material oscuro del sistema, no un tema alternativo.
        noche: {
          DEFAULT: "var(--noche)",
          2: "var(--noche-2)",
          rule: "var(--noche-rule)",
          "rule-2": "var(--noche-rule-2)",
          ink: "var(--noche-ink)",
          "ink-2": "var(--noche-ink-2)",
          "ink-3": "var(--noche-ink-3)",
          "ink-4": "var(--noche-ink-4)",
        },
        menta: "var(--menta)",
        data: {
          1: "var(--data-1)",
          2: "var(--data-2)",
          3: "var(--data-3)",
          4: "var(--data-4)",
          5: "var(--data-5)",
        },
        // Color de datos. Vive aparte del color de interfaz: ver src/lib/viz/colors.ts
        viz: {
          blue: "var(--viz-blue)",
          teal: "var(--viz-teal)",
          amber: "var(--viz-amber)",
          coral: "var(--viz-coral)",
          violet: "var(--viz-violet)",
          green: "var(--viz-green)",
          slate: "var(--viz-slate)",
          mute: "var(--viz-mute)",
        },
      },
      fontFamily: {
        // `display` se conserva como token semantico —"esto es un titular"—
        // pero apunta a la misma sans que el resto. No hay serif en el producto.
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: { prose: "62ch", shell: "1180px", read: "700px", ancho: "1400px" },
      borderRadius: { sm: "var(--r-1)", DEFAULT: "var(--r-2)", md: "var(--r-2)", lg: "var(--r-3)" },
      fontSize: {
        // Editorial: el salto entre niveles es grande a propósito. Una
        // jerarquía con seis tamaños parecidos no es una jerarquía.
        // Escala agresiva a propósito: un titular a 132 px es una decisión
        // editorial, no un adorno. Los saltos son grandes porque una jerarquía
        // con seis tamaños parecidos no es una jerarquía.
        "display-xxl": ["clamp(3.2rem,11vw,8.25rem)", { lineHeight: "0.84", letterSpacing: "-0.06em" }],
        "display-xl": ["clamp(2.6rem,8vw,6rem)", { lineHeight: "0.86", letterSpacing: "-0.055em" }],
        "display-l": ["clamp(2.1rem,5.2vw,3.25rem)", { lineHeight: "0.94", letterSpacing: "-0.045em" }],
        "display-m": ["clamp(1.45rem,2.8vw,1.95rem)", { lineHeight: "1.1", letterSpacing: "-0.035em" }],
        "display-s": ["clamp(1.2rem,1.9vw,1.4rem)", { lineHeight: "1.2", letterSpacing: "-0.025em" }],
        // Cifras: cuatro pesos según el papel que hacen en la página.
        "cifra-xl": ["clamp(2.9rem,7vw,3.9rem)", { lineHeight: "0.9", letterSpacing: "-0.05em" }],
        "cifra-l": ["clamp(2.1rem,4vw,3.1rem)", { lineHeight: "0.94", letterSpacing: "-0.048em" }],
        "cifra-m": ["1.75rem", { lineHeight: "1", letterSpacing: "-0.04em" }],
        "cifra-s": ["1.2rem", { lineHeight: "1", letterSpacing: "-0.03em" }],
        stat: ["clamp(1.9rem,4.5vw,2.7rem)", { lineHeight: "1", letterSpacing: "-0.035em" }],
        cuerpo: ["1.01rem", { lineHeight: "1.62" }],
        "cuerpo-s": ["0.9rem", { lineHeight: "1.58" }],
      },
      transitionTimingFunction: { suave: "cubic-bezier(0.4, 0, 0.2, 1)" },
    },
  },
  plugins: [],
};
export default config;
