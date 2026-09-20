import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { CommandPalette } from "@/components/CommandPalette";
import { getMeta } from "@/lib/data/provider";
import { shell } from "@/lib/ui";
import "./globals.css";

/**
 * Una sola familia para todo el producto.
 *
 * Antes los titulares y las cifras iban en Newsreader, una serif. El carácter
 * editorial ya no depende de la forma de la letra sino del sistema: tamaños
 * con saltos grandes, tracking negativo en los títulos, pesos contrastados,
 * aire y filetes finos. Una sola familia también significa una petición menos
 * y ninguna discordancia entre un titular y la cifra que lo acompaña.
 */
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
    "Explora los reportes registrados en SíseVe y relaciónalos con información pública del número de alumnos, características del colegio y contexto educativo.",
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: "Observatorio Escolar",
  },
  robots: { index: true, follow: true },
};

/**
 * Las dos formas de entrar van juntas y con descripción: son el producto.
 * El resto de la navegación es secundaria y se ve como secundaria.
 */
const PRINCIPAL = [
  { href: "/colegios", label: "Explora un colegio" },
  { href: "/datos", label: "Explora los datos" },
];
const SECUNDARIA = [
  { href: "/senales", label: "Señales" },
  { href: "/rankings", label: "Rankings" },
  { href: "/comparar", label: "Comparar" },
  { href: "/metodologia", label: "Metodología" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = getMeta();
  const fuentes = Object.values(meta.fuentes);

  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:border focus:border-accent focus:bg-surface focus:px-4 focus:py-2 focus:text-[0.88rem]"
        >
          Saltar al contenido
        </a>

        <header className="sticky top-0 z-40 border-b border-rule bg-paper/92 backdrop-blur-sm">
          <div className={`${shell} flex h-14 items-center gap-5 sm:h-16`}>
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5"
              aria-label="Observatorio Escolar, inicio"
            >
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-sm bg-accent transition-transform duration-150 ease-suave group-hover:scale-90"
              />
              <span className="font-display text-[1.02rem] font-medium leading-none tracking-tight sm:text-[1.1rem]">
                Observatorio Escolar
              </span>
            </Link>

            <nav aria-label="Principal" className="ml-auto hidden items-center gap-1 lg:flex">
              {PRINCIPAL.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded px-2.5 py-1.5 text-[0.88rem] text-ink-2 transition-colors duration-150 ease-suave hover:bg-surface hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
              <span aria-hidden className="mx-1.5 h-4 w-px bg-rule" />
              {SECUNDARIA.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded px-2.5 py-1.5 text-[0.88rem] text-ink-3 transition-colors duration-150 ease-suave hover:bg-surface hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto shrink-0 lg:ml-3">
              <CommandPalette />
            </div>
          </div>

          {/* En móvil la navegación baja a su propia tira. No se esconde tras
              un menú: son cuatro destinos y caben. */}
          <nav aria-label="Principal" className={`${shell} pb-2 lg:hidden`}>
            <ul className="-mx-1.5 flex gap-0.5 overflow-x-auto whitespace-nowrap text-[0.84rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[...PRINCIPAL, ...SECUNDARIA].map((n) => (
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

        <footer className="mt-24 border-t border-rule">
          <div className={`${shell} py-14`}>
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <p className="flex items-center gap-2.5 font-display text-[1.1rem] font-medium">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm bg-accent" />
                  Observatorio Escolar
                </p>
                <p className="mt-4 max-w-prose text-cuerpo-s leading-relaxed text-ink-2">
                  Los reportes de SíseVe son{" "}
                  <strong className="font-semibold text-ink">alertas registradas</strong>, no
                  casos confirmados, y puede existir más de un reporte sobre un mismo hecho.
                  Este sitio trabaja solo con datos agregados y no publica información
                  individual de estudiantes.
                </p>
              </div>

              <nav aria-label="Pie" className="lg:col-span-3">
                <p className="meta">Explorar</p>
                <ul className="mt-4 space-y-2 text-[0.88rem]">
                  {[...PRINCIPAL, ...SECUNDARIA].map((n) => (
                    <li key={n.href}>
                      <Link href={n.href} className="text-ink-2 transition-colors hover:text-accent">
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="lg:col-span-4">
                <p className="meta">Fuentes y actualización</p>
                <dl className="mt-4 space-y-2.5">
                  {fuentes.map((f) => (
                    <div
                      key={f.nombre}
                      className="flex items-baseline justify-between gap-4 border-b border-rule-3 pb-2"
                    >
                      <dt className="text-[0.86rem] text-ink-2">{f.nombre.split("–")[0].trim()}</dt>
                      <dd className="tabular shrink-0 font-mono text-[0.76rem] text-ink-3">
                        {f.anio}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-[0.78rem] leading-snug text-ink-3">
                  Cada variable conserva el año de su fuente. No todas coinciden, y la
                  interfaz lo dice dato por dato.
                </p>
                <a
                  href="https://github.com/fiorellatl/observatorio-violencia-escolar"
                  className="mt-4 inline-block text-[0.84rem] text-ink-2 transition-colors hover:text-accent"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Código y transparencia ↗
                </a>
              </div>
            </div>

            <p className="meta mt-12 border-t border-rule-2 pt-6">
              Datos públicos del Ministerio de Educación del Perú · Capa pública generada el{" "}
              <span className="tabular">{meta.generado}</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
