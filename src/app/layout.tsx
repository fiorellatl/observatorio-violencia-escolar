import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { CommandPalette } from "@/components/CommandPalette";
import { getMeta } from "@/lib/data/provider";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://observatorioescolar.netlify.app"),
  title: {
    default: "Observatorio Escolar — Violencia escolar registrada en el Perú",
    template: "%s — Observatorio Escolar",
  },
  description:
    "Explora los reportes registrados en SíseVe y relaciónalos con información pública de matrícula, características del colegio y contexto educativo.",
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: "Observatorio Escolar",
  },
  robots: { index: true, follow: true },
};

const NAV = [
  { href: "/colegios", label: "Colegios" },
  { href: "/comparar", label: "Comparar" },
  { href: "/datos", label: "Explorar datos" },
  { href: "/metodologia", label: "Metodología" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = getMeta();
  const fuentes = Object.values(meta.fuentes);

  return (
    <html lang="es" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:border focus:border-accent focus:bg-surface focus:px-4 focus:py-2 focus:text-[0.88rem]"
        >
          Saltar al contenido
        </a>

        {/* En móvil la marca y la navegación no caben en una línea: la nav pasa
            a una tira desplazable para que ninguna ruta desaparezca. */}
        <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur-sm">
          <div className="mx-auto flex max-w-shell items-center gap-4 px-5 py-3">
            <Link href="/" className="flex shrink-0 items-baseline gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-sm bg-accent"
                aria-hidden
              />
              <span className="font-display text-[1.05rem] font-medium leading-tight tracking-tight">
                Observatorio Escolar
              </span>
            </Link>

            <nav
              aria-label="Principal"
              className="ml-auto hidden items-center gap-0.5 text-[0.85rem] lg:flex"
            >
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="whitespace-nowrap rounded px-2.5 py-1.5 text-ink-2 transition-colors hover:bg-surface hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto shrink-0 lg:ml-2">
              <CommandPalette />
            </div>
          </div>

          <nav
            aria-label="Principal"
            className="mx-auto max-w-shell px-5 pb-2 lg:hidden"
          >
            <ul className="-mx-1 flex gap-0.5 overflow-x-auto whitespace-nowrap text-[0.84rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="block rounded px-2.5 py-1.5 text-ink-2 transition-colors hover:bg-surface hover:text-ink"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main id="contenido" className="flex-1">
          {children}
        </main>

        <footer className="mt-20 border-t border-rule">
          <div className="mx-auto max-w-shell px-5 py-12">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <p className="flex items-baseline gap-2.5 font-display text-[1.02rem] font-medium">
                  <span className="h-2 w-2 shrink-0 rounded-sm bg-accent" aria-hidden />
                  Observatorio Escolar
                </p>
                <p className="mt-3 max-w-prose text-[0.84rem] leading-relaxed text-ink-3">
                  Los reportes de SíseVe son{" "}
                  <strong className="font-semibold text-ink-2">alertas registradas</strong>, no
                  casos confirmados, y puede existir más de un reporte sobre un mismo hecho.
                  Este sitio no publica información individual de estudiantes.
                </p>
              </div>

              <div>
                <p className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-3">
                  Actualización de datos
                </p>
                <dl className="mt-3 space-y-1.5 text-[0.82rem]">
                  {fuentes.map((f) => (
                    <div key={f.nombre} className="flex items-baseline justify-between gap-3">
                      <dt className="text-ink-2">{f.nombre.split("–")[0].trim()}</dt>
                      <dd className="tabular shrink-0 font-mono text-[0.76rem] text-ink-3">
                        {f.anio}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-[0.75rem] leading-snug text-ink-3">
                  Cada variable conserva el año de su fuente. No todas coinciden.
                </p>
              </div>

              <div>
                <p className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-3">
                  El proyecto
                </p>
                <ul className="mt-3 space-y-1.5 text-[0.84rem]">
                  <li>
                    <Link href="/metodologia" className="text-ink-2 hover:text-accent">
                      Metodología y fuentes
                    </Link>
                  </li>
                  <li>
                    <Link href="/metodologia#privacidad" className="text-ink-2 hover:text-accent">
                      Privacidad
                    </Link>
                  </li>
                  <li>
                    <a
                      href="https://github.com/fiorellatl/observatorio-violencia-escolar"
                      className="text-ink-2 hover:text-accent"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Código y transparencia
                    </a>
                  </li>
                </ul>
                <ul className="mt-3 space-y-1.5 text-[0.84rem]">
                  <li>
                    <a
                      href="https://siseve.minedu.gob.pe/"
                      className="text-ink-3 hover:text-accent"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      SíseVe ↗
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://escale.minedu.gob.pe/"
                      className="text-ink-3 hover:text-accent"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      ESCALE ↗
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <p className="mt-10 border-t border-rule-2 pt-5 font-mono text-[0.7rem] uppercase tracking-wider text-ink-3">
              Datos públicos del Ministerio de Educación del Perú · Capa pública generada el{" "}
              <span className="tabular">{meta.generado}</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
