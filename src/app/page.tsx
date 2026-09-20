import type { Metadata } from "next";
import Link from "next/link";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ReportTrend } from "@/components/ReportTrend";
import { SearchBox } from "@/components/SearchBox";
import { getInstitutionCount, getMeta, getNational } from "@/lib/data/provider";
import { nf } from "@/lib/format";
import { enlace, h2, panel, shell } from "@/lib/ui";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  const meta = getMeta();
  const nacional = getNational();
  // La unidad pública es la institución, no el servicio educativo: la portada
  // tiene que contar lo mismo que cuentan el buscador y el ranking.
  const colegios = getInstitutionCount();

  const comparables = nacional.filter((n) => !n.pandemia && n.anio !== meta.anio_parcial);
  const ultimo = comparables[comparables.length - 1];

  const serie = nacional.map((n) => ({
    anio: n.anio,
    total: n.total,
    pandemia: n.pandemia,
    parcial: n.anio === meta.anio_parcial,
  }));

  /** Solo métricas que ya existen. Ninguna cifra decorativa. */
  const cifras = [
    {
      valor: nf(ultimo?.total ?? 0),
      titulo: "reportes registrados",
      detalle: `en ${ultimo?.anio}, el último año completo`,
      fuente: "SíseVe",
      anio: ultimo?.anio,
    },
    {
      valor: nf(colegios),
      titulo: "colegios con al menos un reporte",
      detalle: `entre ${meta.anio_min} y ${meta.anio_max}`,
      fuente: "SíseVe",
      anio: `${meta.anio_min}–${meta.anio_max}`,
    },
    {
      valor: nf(meta.reportes),
      titulo: "reportes en todo el histórico",
      detalle: "cada uno es una alerta registrada, no un caso confirmado",
      fuente: "SíseVe",
      anio: `${meta.anio_min}–${meta.anio_max}`,
    },
  ];

  return (
    <>
      {/* ══ PORTADA, SOBRE LA NOCHE ═══════════════════════
          La pregunta ocupa la pantalla entera y el buscador va inmediatamente
          debajo, con el filete de menta: entrar aquí es buscar un colegio.
          Las tres cifras cierran el bloque como una franja divida por filetes,
          sin tarjetas. */}
      <section className="noche">
        <div className={`${shell} pb-14 pt-16 sm:pb-16 sm:pt-24`}>
          <p className="meta-noche surgir">
            Datos públicos SíseVe · {meta.anio_min}–{meta.anio_max}
          </p>

          <h1 className="titular surgir mt-6 max-w-[12ch] text-display-xxl text-noche-ink">
            ¿Qué sabemos de cada colegio
            <span className="text-menta">?</span>
          </h1>

          <p className="surgir mt-8 max-w-[52ch] text-[1.08rem] leading-relaxed text-noche-ink-2">
            {nf(meta.reportes)} reportes registrados en {nf(colegios)} colegios. Un
            reporte es una alerta registrada en SíseVe, no un caso confirmado.
          </p>

          <div className="surgir mt-12">
            <SearchBox
              tono="noche"
              placeholder="nombre del colegio, distrito o código modular"
            />
          </div>
        </div>

        {/* Tres cifras, sin tarjetas: las separan filetes. */}
        <dl className={`${shell} grid border-t border-noche-rule sm:grid-cols-3`}>
          {cifras.map((c, i) => (
            <div
              key={c.titulo}
              className={`border-noche-rule px-1 py-8 sm:px-7 sm:py-9 ${
                i < 2 ? "border-b sm:border-b-0 sm:border-r" : ""
              } ${i === 0 ? "sm:pl-0" : ""}`}
            >
              <dd className="cifra text-[clamp(2.6rem,5.5vw,3.6rem)] text-noche-ink">
                {c.valor}
              </dd>
              <dt className="mt-3 text-[0.95rem] text-noche-ink-2">{c.titulo}</dt>
              <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-noche-ink-4">
                {c.detalle}
              </p>
            </div>
          ))}
        </dl>

        {/* Las dos puertas de entrada, a sangre. */}
        <div className="grid border-t border-noche-rule sm:grid-cols-2">
          {[
            {
              n: "01",
              href: "/colegios",
              t: "Quiero buscar un colegio",
              d: "Ficha completa: reportes, número de alumnos, evolución y contexto.",
            },
            {
              n: "02",
              href: "/datos",
              t: "Quiero explorar los datos",
              d: "Qué se registra, cómo ha cambiado y qué no puede leerse ahí.",
            },
          ].map((x, i) => (
            <Link
              key={x.href}
              href={x.href}
              className={`group flex flex-col gap-3 px-5 py-10 transition-colors duration-150 ease-suave hover:bg-noche-2 sm:px-10 sm:py-14 ${
                i === 0 ? "border-b border-noche-rule sm:border-b-0 sm:border-r" : ""
              }`}
            >
              <span className="meta-noche">{x.n}</span>
              <span className="text-[clamp(1.5rem,3vw,2.15rem)] font-bold leading-tight tracking-[-0.04em] text-noche-ink">
                {x.t}
              </span>
              <span className="max-w-[38ch] text-[0.92rem] leading-relaxed text-noche-ink-3">
                {x.d}
              </span>
              <span
                aria-hidden
                className="mt-1 text-menta transition-transform duration-150 ease-suave group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Qué es un reporte ───────────────────────────────────── */}
      <section className="border-t border-rule bg-surface">
        <div className={`${shell} py-14 sm:py-20`}>
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="meta">Antes de mirar cualquier cifra</p>
              <h2 className="mt-4 max-w-[16ch] font-display text-display-l font-medium text-balance">
                Un reporte no es un caso probado
              </h2>
            </div>

            <div className="space-y-5 text-cuerpo leading-relaxed text-ink-2 lg:col-span-7 lg:col-start-6">
              <p>
                SíseVe es el portal del Ministerio de Educación donde cualquier persona
                —un estudiante, su familia, un docente— puede registrar un hecho de
                violencia escolar. Funciona desde 2013.
              </p>
              <p>
                Lo que se registra son alertas. El propio Ministerio advierte que puede
                existir más de un reporte sobre un mismo hecho, y que un reporte no
                equivale a un caso confirmado ni a una víctima única.
              </p>
              <p>
                Un colegio con muchos reportes puede ser, simplemente, un colegio donde
                denunciar funciona. Por eso aquí no hay rankings de colegios
                «peligrosos» ni «seguros».
              </p>
              <p>
                Pero nos da una luz de cómo se está gestionando el bullying y la
                violencia —física, psicológica, sexual— dentro de las instituciones
                educativas de nuestro país.
              </p>
              <p>
                Si bien son alertas, pasar por un proceso de denuncia no solo suele ser
                un proceso burocrático engorroso, sino que revictimiza y tiene barreras:
                de acceso, de jerarquía, de información. Por eso esta data podría y debe
                ser solo la punta del iceberg de un problema sistematizado y profundo.
              </p>
              <p className="border-l-2 border-accent pl-5 text-ink">
                Basta con ver un par de cifras para detenernos. ¿Podemos ver patrones?
                ¿Nos pueden dar herramientas de prevención? ¿Los colegios de zonas
                rurales son menos violentos o son lugares en donde denunciar no funciona?
              </p>
              <p>
                Este portal busca transparentar esa información pero, sobre todo, busca
                que nos hagamos más de esas preguntas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Los datos en contexto ───────────────────────────────── */}
      <section className="border-t border-rule">
        <div className={`${shell} py-14 sm:py-20`}>
          <h2 className="meta">Los datos en contexto</h2>

          <dl className="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-3">
            {cifras.map((c) => (
              <div key={c.titulo} className="border-t border-rule pt-5">
                <dd className="cifra text-cifra-xl font-medium">{c.valor}</dd>
                <dt className="mt-3 text-[0.98rem] font-medium leading-snug text-ink">
                  {c.titulo}
                </dt>
                <p className="mt-1.5 max-w-[34ch] text-[0.84rem] leading-relaxed text-ink-3">
                  {c.detalle}
                </p>
                <div className="mt-3">
                  <DataSourceBadge fuente={c.fuente} anio={c.anio} />
                </div>
              </div>
            ))}
          </dl>

          <div className="mt-12 max-w-prose">
            <MethodologyNote href="/metodologia">
              Más reportes no significa necesariamente más violencia. Puede reflejar un
              colegio más grande, o uno donde denunciar funciona mejor. Y cero reportes no
              significa que no ocurra nada: significa que nadie lo registró.
            </MethodologyNote>
          </div>
        </div>
      </section>

      {/* ── Las dos entradas ────────────────────────────────────── */}
      <section className="border-t border-rule">
        <div className={`${shell} py-14 sm:py-20`}>
          <h2 className={h2}>Dos formas de mirar</h2>

          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2">
            <Link
              href="/colegios"
              className="group bg-surface p-7 transition-colors duration-150 ease-suave hover:bg-accent-soft sm:p-9"
            >
              <p className="meta">Entrada 1</p>
              <p className="mt-4 font-display text-display-m font-medium">
                Explora un colegio
              </p>
              <p className="mt-3 max-w-prose text-cuerpo-s leading-relaxed text-ink-2">
                Busca por nombre, distrito o código modular. Cada ficha muestra la
                trayectoria de reportes, el número de alumnos cuando lo conocemos y el contexto
                que declara la institución, con el año de cada fuente.
              </p>
              <span className="mt-6 inline-flex items-baseline gap-2 text-[0.9rem] font-medium text-accent">
                Buscar un colegio
                <span
                  aria-hidden
                  className="transition-transform duration-150 ease-suave group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
            </Link>

            <Link
              href="/datos"
              className="group bg-surface p-7 transition-colors duration-150 ease-suave hover:bg-accent-soft sm:p-9"
            >
              <p className="meta">Entrada 2</p>
              <p className="mt-4 font-display text-display-m font-medium">
                Explora los datos
              </p>
              <p className="mt-3 max-w-prose text-cuerpo-s leading-relaxed text-ink-2">
                Qué está pasando, cómo ha cambiado, qué tipos de violencia se registran y
                cómo se relaciona con el tamaño del colegio. Cada bloque dice con cuántos
                colegios trabaja y qué no se puede concluir.
              </p>
              <span className="mt-6 inline-flex items-baseline gap-2 text-[0.9rem] font-medium text-accent">
                Ver los datos
                <span
                  aria-hidden
                  className="transition-transform duration-150 ease-suave group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
            </Link>
          </div>

          <p className="mt-8 max-w-prose text-[0.84rem] leading-relaxed text-ink-3">
            ¿Quieres saber cómo se construyó todo esto, qué mide SíseVe y qué decidimos no
            publicar?{" "}
            <Link href="/metodologia" className={enlace}>
              Lee la metodología
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
