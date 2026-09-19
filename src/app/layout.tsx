import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
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
  metadataBase: new URL("https://observatorio-violencia-escolar.netlify.app"),
  title: {
    default: "Observatorio de Violencia Escolar — Perú",
    template: "%s | Observatorio de Violencia Escolar",
  },
  description:
    "Explora los reportes registrados en SíseVe y relaciónalos con información pública de matrícula, características del colegio y contexto educativo.",
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: "Observatorio de Violencia Escolar",
  },
  robots: { index: true, follow: true },
};

const NAV = [
  { href: "/colegios", label: "Colegios" },
  { href: "/datos", label: "Los datos" },
  { href: "/metodologia", label: "Metodología" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <header className="border-b border-rule">
          <div className="mx-auto flex max-w-shell items-center gap-4 px-5 py-4">
            <Link href="/" className="group flex items-baseline gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-accent" aria-hidden />
              <span className="font-display text-[1.06rem] font-medium leading-none tracking-tight">
                Observatorio de Violencia Escolar
              </span>
            </Link>
            <nav className="ml-auto flex items-center gap-1 text-[0.86rem]">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded px-2.5 py-1.5 text-ink-2 transition-colors hover:bg-surface hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-20 border-t border-rule">
          <div className="mx-auto max-w-shell px-5 py-10">
            <p className="max-w-prose text-[0.84rem] leading-relaxed text-ink-3">
              Datos públicos del Ministerio de Educación del Perú. Los reportes de
              SíseVe son <strong className="font-semibold text-ink-2">alertas registradas</strong>,
              no casos confirmados, y puede existir más de un reporte sobre un mismo
              hecho. Este sitio no publica información individual de estudiantes.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[0.72rem] uppercase tracking-wider text-ink-3">
              <Link href="/metodologia" className="hover:text-accent">
                Metodología y fuentes
              </Link>
              <a
                href="https://siseve.minedu.gob.pe/"
                className="hover:text-accent"
                rel="noopener noreferrer"
                target="_blank"
              >
                SíseVe
              </a>
              <a
                href="https://escale.minedu.gob.pe/"
                className="hover:text-accent"
                rel="noopener noreferrer"
                target="_blank"
              >
                ESCALE
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
