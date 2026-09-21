import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { CommandPalette } from "@/components/CommandPalette";
import { getMeta } from "@/lib/data/provider";
import { og } from "@/lib/og";
import { shell } from "@/lib/ui";
import "./globals.css";

/**
 * Dos familias con trabajos distintos.
 *
 * Archivo para todo lo que se lee: es una grotesca de caja alta y ancha que
 * aguanta el peso 700 a 130 px sin volverse decorativa, que es lo que pide un
 * titular a esa escala. JetBrains Mono para los metadatos —fuente, año,
 * unidad, código modular—, en versalita y con tracking abierto: no compite
 * con el texto, lo etiqueta.
 *
 * Nada de serif. El carácter no está en la forma de la letra sino en el
 * sistema: saltos de tamaño grandes, tracking negativo en los titulares y
 * bloques oscuros a sangre.
 */
const sans = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

/** Una sola frase, la misma en el buscador y en la tarjeta de enlace. */
const DESCRIPCION =
  "Explora los reportes registrados en SíseVe y cómo se distribuyen por colegio, territorio y año.";

export const metadata: Metadata = {
  metadataBase: new URL("https://observatorioescolar.netlify.app"),
  title: {
    default: "Observatorio Escolar — Violencia escolar registrada en el Perú",
    template: "%s — Observatorio Escolar",
  },
  description: DESCRIPCION,
  ...og({
    title: "¿Qué se sabe sobre la violencia en los colegios del Perú?",
    description: DESCRIPCION,
    url: "/",
  }),
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
        {/* Isla de cliente: no pinta nada y `useSearchParams` obliga a la
            frontera de Suspense para no volver dinámica toda la cáscara. */}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>

        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:border focus:border-accent focus:bg-surface focus:px-4 focus:py-2 focus:text-[0.88rem]"
        >
          Saltar al contenido
        </a>

        {/* ── Cabecera ────────────────────────────────────────────
            Barra de noche a sangre. La marca va en versalita monoespaciada,
            no en el peso grande de un logotipo: el titular de cada página es
            lo que tiene que dominar, y una cabecera que compita con él
            convierte todas las pantallas en la misma pantalla. */}
        <header className="noche sticky top-0 z-40 border-b border-noche-rule">
          <div className={`${shell} flex h-14 items-center gap-6 sm:h-[4.1rem]`}>
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5"
              aria-label="Observatorio Escolar, inicio"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm bg-menta transition-transform duration-150 ease-suave group-hover:scale-90"
              />
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-noche-ink">
                Observatorio Escolar
              </span>
            </Link>

            <nav aria-label="Principal" className="ml-auto hidden items-center gap-6 lg:flex">
              {[...PRINCIPAL, ...SECUNDARIA].map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="font-mono text-[0.69rem] uppercase tracking-[0.09em] text-noche-ink-3 transition-colors duration-150 ease-suave hover:text-menta"
                >
                  {n.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto shrink-0 lg:ml-0">
              <CommandPalette />
            </div>
          </div>

          {/* En móvil la navegación baja a su propia tira. No se esconde tras
              un menú: son seis destinos y caben desplazándose. */}
          <nav aria-label="Principal" className={`${shell} pb-2 lg:hidden`}>
            <ul className="-mx-2 flex gap-5 overflow-x-auto whitespace-nowrap px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[...PRINCIPAL, ...SECUNDARIA].map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="block font-mono text-[0.69rem] uppercase tracking-[0.09em] text-noche-ink-3 transition-colors hover:text-menta"
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

        <footer className="noche mt-24">
          <div className={`${shell} py-16`}>
            <div className="grid gap-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <p className="flex items-center gap-2.5 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-noche-ink">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm bg-menta" />
                  Observatorio Escolar
                </p>
                <p className="mt-6 max-w-prose text-[0.95rem] leading-relaxed text-noche-ink-2">
                  Los reportes de SíseVe son{" "}
                  <strong className="font-semibold text-noche-ink">alertas registradas</strong>, no
                  casos confirmados, y puede existir más de un reporte sobre un mismo hecho.
                  Este sitio trabaja solo con datos agregados y no publica información
                  individual de estudiantes.
                </p>
              </div>

              <nav aria-label="Pie" className="lg:col-span-3">
                <p className="meta-noche">Explorar</p>
                <ul className="mt-5 space-y-2.5 text-[0.9rem]">
                  {[...PRINCIPAL, ...SECUNDARIA].map((n) => (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        className="text-noche-ink-2 transition-colors hover:text-menta"
                      >
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="lg:col-span-4">
                <p className="meta-noche">Fuentes y actualización</p>
                <dl className="mt-5 space-y-3">
                  {fuentes.map((f) => (
                    <div
                      key={f.nombre}
                      className="flex items-baseline justify-between gap-4 border-b border-noche-rule pb-2.5"
                    >
                      <dt className="text-[0.88rem] text-noche-ink-2">
                        {f.nombre.split("–")[0].trim()}
                      </dt>
                      <dd className="tabular shrink-0 font-mono text-[0.72rem] text-noche-ink-3">
                        {f.anio}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[0.8rem] leading-relaxed text-noche-ink-3">
                  Cada variable conserva el año de su fuente. No todas coinciden, y la
                  interfaz lo dice dato por dato.
                </p>
                <a
                  href="https://github.com/fiorellatl/observatorio-violencia-escolar"
                  className="mt-5 inline-block text-[0.85rem] font-medium text-menta transition-opacity hover:opacity-80"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Código y transparencia ↗
                </a>
              </div>
            </div>
<p className="mt-8 text-[0.8rem] text-noche-ink-3">
  Un proyecto de <strong>Fiorella Toranzo Lossio</strong>
</p>
            <p className="mt-14 border-t border-noche-rule pt-6 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-noche-ink-4">
              Datos públicos del Ministerio de Educación del Perú · Capa pública generada el{" "}
              <span className="tabular">{meta.generado}</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
